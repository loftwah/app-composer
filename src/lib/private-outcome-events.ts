import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { publicStack, STACK_APPS } from "./stacks.mjs";

export const OUTCOME_RETENTION_DAYS = 35;
export const OUTCOME_DAILY_CAP = 1000;
export const outcomeEvents = [
  "app_open_action",
  "postcard_approved",
  "postcard_hidden",
  "postcard_deleted",
] as const;
export type OutcomeEvent = (typeof outcomeEvents)[number];
export type TrafficMode = "unclassified" | "demo";
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const identifier = z.string().regex(/^[a-z0-9-]{6,64}$/);
const activation = z
  .object({
    contract: z.literal(1),
    publication: revision,
    publicationKey: z.string().regex(/^[a-f0-9]{64}$/),
    token: z
      .string()
      .regex(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      ),
    interaction: z.enum(["keyboard", "touch", "pointer"]),
    disposition: z.enum(["same_tab", "new_tab"]),
  })
  .strict();

// A revision can recur when a slug is deleted and recreated. This public,
// opaque key binds an activation to one immutable stack/publication identity.
export async function publicationActionKey(stack: string, revision: number) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`composer.stack-actions/1\0${stack}\0${revision}`),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export interface OutcomeRuntime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  USAGE_LIMIT?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
interface Receipt {
  id: string;
  workspace: string;
  stack: string;
  instance: string;
  event: OutcomeEvent;
  interaction: "keyboard" | "touch" | "pointer" | "server";
  disposition: "same_tab" | "new_tab" | "none";
  publication: number | null;
}
const empty = (status = 204) =>
  new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

// Each entry is guarded by its own fresh nonce. Replays and a losing eligibility
// check cannot increment a row written by another request in the same window.
export async function appendOutcome(
  db: D1Database,
  receipt: Receipt,
  eligibility: string,
  eligibleValues: (string | number)[],
  now = new Date(),
) {
  const day = now.toISOString().slice(0, 10);
  const nonce = crypto.randomUUID();
  const result = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO creator_outcome_receipts
      (id,day,workspace_id,stack_id,instance_id,event,interaction,disposition,traffic,publication_revision,write_nonce)
      SELECT ?,?,?,?,?,?,?,?,COALESCE((SELECT traffic_mode FROM creator_outcome_settings WHERE stack_id=? AND workspace_id=?),'unclassified'),?,?
      WHERE (${eligibility}) AND COALESCE((SELECT SUM(n) FROM creator_outcome_daily WHERE day=? AND stack_id=?),0)<? RETURNING id`,
      )
      .bind(
        receipt.id,
        day,
        receipt.workspace,
        receipt.stack,
        receipt.instance,
        receipt.event,
        receipt.interaction,
        receipt.disposition,
        receipt.stack,
        receipt.workspace,
        receipt.publication,
        nonce,
        ...eligibleValues,
        day,
        receipt.stack,
        OUTCOME_DAILY_CAP,
      ),
    db
      .prepare(
        `INSERT INTO creator_outcome_daily(day,workspace_id,stack_id,instance_id,event,interaction,disposition,traffic,n)
      SELECT day,workspace_id,stack_id,instance_id,event,interaction,disposition,traffic,1 FROM creator_outcome_receipts
      WHERE id=? AND write_nonce=?
      ON CONFLICT(day,workspace_id,stack_id,instance_id,event,interaction,disposition,traffic) DO UPDATE SET n=n+1`,
      )
      .bind(receipt.id, nonce),
  ]);
  return Boolean(result[0]?.results?.[0]);
}

async function boundedBody(request: Request) {
  if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json")
    throw Error("Unsupported body");
  if (Number(request.headers.get("Content-Length") || 0) > 512)
    throw Error("Oversized body");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing body");
  let bytes = new Uint8Array();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (bytes.length + part.value.length > 512) {
        await reader.cancel();
        throw Error("Oversized body");
      }
      const next = new Uint8Array(bytes.length + part.value.length);
      next.set(bytes);
      next.set(part.value, bytes.length);
      bytes = next;
    }
  } finally {
    reader.releaseLock();
  }
  return activation.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

// Public payloads select only a published slug/instance and a version. Workspace,
// allowed app and destination authority always come from the current snapshot.
export async function collectStackAction(
  request: Request,
  runtime: OutcomeRuntime,
  slug: string,
  instance: string,
) {
  if (request.method !== "POST") return empty(405);
  if (new URL(request.url).search) return empty(400);
  const origin =
    typeof runtime.PUBLIC_ORIGIN === "string" ? runtime.PUBLIC_ORIGIN : "";
  if (
    !origin ||
    request.headers.get("Origin") !== origin ||
    new URL(request.url).origin !== origin ||
    (request.headers.has("Sec-Fetch-Site") &&
      request.headers.get("Sec-Fetch-Site") !== "same-origin")
  )
    return empty(403);
  if (
    !/^[a-z0-9-]{1,60}$/.test(slug) ||
    !identifier.safeParse(instance).success
  )
    return empty(400);
  let input: z.infer<typeof activation>;
  try {
    input = await boundedBody(request);
  } catch {
    return empty(400);
  }
  if (
    request.headers.get("X-Composer-Verification") === "1" ||
    /(?:googlebot|bingbot|duckduckbot|baiduspider|yandexbot|slurp|curl\/|wget\/)/i.test(
      request.headers.get("User-Agent") || "",
    )
  )
    return empty();
  if (!runtime.DB || !runtime.USAGE_LIMIT) return empty();
  try {
    const stack = await publicStack(runtime.DB, slug);
    if (!stack || stack.revision !== input.publication) return empty();
    if (
      input.publicationKey !==
      (await publicationActionKey(stack.id, stack.revision))
    )
      return empty();
    const target = stack.document.instances.find(
      (value: { id: string }) => value.id === instance,
    );
    if (
      !target ||
      target.visible === false ||
      !Object.hasOwn(STACK_APPS, target.app) ||
      target.app === "state"
    )
      return empty();
    const selected = await runtime.DB.prepare(
      "SELECT workspace_id FROM creator_stacks WHERE id=? AND status='published' AND published_revision=?",
    )
      .bind(stack.id, stack.revision)
      .first<{ workspace_id: string }>();
    if (
      !selected ||
      !(await runtime.USAGE_LIMIT.limit({ key: "creator-open:" + stack.id }))
        .success
    )
      return empty();
    const eligible = `EXISTS(SELECT 1 FROM creator_stacks s JOIN creator_stack_publications p ON p.stack_id=s.id AND p.revision=s.published_revision
      WHERE s.id=? AND s.workspace_id=? AND s.status='published' AND s.published_json IS NOT NULL AND p.revision=?
      AND EXISTS(SELECT 1 FROM json_each(p.document_json,'$.instances') i WHERE json_extract(i.value,'$.id')=?
      AND json_extract(i.value,'$.app')=? AND COALESCE(json_extract(i.value,'$.visible'),1)!=0))`;
    await appendOutcome(
      runtime.DB,
      {
        id: "activation:" + input.token,
        workspace: selected.workspace_id,
        stack: stack.id,
        instance,
        event: "app_open_action",
        interaction: input.interaction,
        disposition: input.disposition,
        publication: stack.revision,
      },
      eligible,
      [stack.id, selected.workspace_id, stack.revision, instance, target.app],
    );
  } catch {
    /* Recording can drop; it never controls navigation or app access. */
  }
  return empty();
}

export async function purgePrivateOutcomes(db: D1Database, now = new Date()) {
  const cutoff = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate() - OUTCOME_RETENTION_DAYS + 1);
  const day = cutoff.toISOString().slice(0, 10);
  await db.batch([
    db.prepare("DELETE FROM creator_outcome_daily WHERE day<?").bind(day),
    db.prepare("DELETE FROM creator_outcome_receipts WHERE day<?").bind(day),
    db
      .prepare("DELETE FROM creator_outcome_intents WHERE created_at<?")
      .bind(day + " 00:00:00"),
  ]);
}

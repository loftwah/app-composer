import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { filmFeedbackReasons, shareFilms } from "./share-films.ts";

const key = {
  assetId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
};
const save = z.strictObject({
  ...key, action: z.literal("save"), vote: z.enum(["up", "down"]),
  reasons: z.array(z.string().max(80)).max(5),
  note: z.string().trim().max(1000),
});
const remove = z.strictObject({ ...key, action: z.literal("remove") });
const mutation = z.discriminatedUnion("action", [save, remove]);
const maxBody = 8192;

async function readMutation(request: Request) {
  if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json" ||
      Number(request.headers.get("Content-Length")) > maxBody) throw Error("Invalid input");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing input");
  const bytes = new Uint8Array(maxBody);
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (part.value.length > maxBody - length) {
        await reader.cancel();
        throw Error("Oversized input");
      }
      bytes.set(part.value, length);
      length += part.value.length;
    }
  } finally {
    reader.releaseLock();
  }
  return mutation.parse(JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))));
}

export interface ShareFeedback {
  assetId: string;
  revision: string;
  title: string;
  href: string;
  vote: "up" | "down";
  reasons: string[];
  note: string;
  updatedAt: string;
}
type StoredFeedback = Omit<ShareFeedback, "reasons"> & { reasons: string };
const fields = `asset_id AS assetId, asset_revision AS revision, asset_title AS title,
  asset_url AS href, vote, reasons, note, updated_at AS updatedAt`;
const decode = (row: StoredFeedback): ShareFeedback => ({
  ...row, reasons: JSON.parse(row.reasons) as string[],
});
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export async function handleShareFeedback(request: Request, actorId: string | undefined, db: D1Database | undefined) {
  if (!actorId) return reply({ error: "Sign in to give feedback." }, 401);
  if (!db) return reply({ error: "Feedback is unavailable. Try again shortly." }, 503);
  if (request.method === "GET") {
    try {
      const { results } = await db.prepare(`SELECT ${fields} FROM composer_share_feedback
        WHERE actor_id=? ORDER BY updated_at DESC, asset_id, asset_revision LIMIT 100`).bind(actorId).all<StoredFeedback>();
      return reply({ items: results.map(decode) });
    } catch {
      return reply({ error: "Your feedback could not be loaded. Try again." }, 503);
    }
  }
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    return reply({ error: "Open Share directly to save feedback." }, 403);
  let input;
  try { input = await readMutation(request); }
  catch { return reply({ error: "Check your vote and keep notes to 1,000 characters." }, 400); }

  try {
    if (input.action === "remove") {
      await db.prepare("DELETE FROM composer_share_feedback WHERE actor_id=? AND asset_id=? AND asset_revision=?")
        .bind(actorId, input.assetId, input.revision).run();
      return reply({ item: null });
    }
    const asset = shareFilms.find((film) => film.id === input.assetId && film.revision === input.revision);
    if (!asset) return reply({ error: "That film version changed. Reload Share to review the current cut." }, 409);
    const suggested: readonly string[] = filmFeedbackReasons[input.vote];
    if (input.reasons.some((reason) => !suggested.includes(reason)))
      return reply({ error: "Choose reasons from the suggestions or add a note." }, 400);
    const row = await db.prepare(`INSERT INTO composer_share_feedback
      (actor_id,asset_id,asset_revision,asset_title,asset_url,vote,reasons,note)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(actor_id,asset_id,asset_revision) DO UPDATE SET
      vote=excluded.vote,reasons=excluded.reasons,note=excluded.note,updated_at=CURRENT_TIMESTAMP
      RETURNING ${fields}`)
      .bind(actorId, asset.id, asset.revision, asset.title, asset.href, input.vote, JSON.stringify([...new Set(input.reasons)]), input.note)
      .first<StoredFeedback>();
    if (!row) throw Error("Save did not return a row");
    return reply({ item: decode(row) });
  } catch {
    return reply({ error: "Feedback could not be saved. Try again." }, 503);
  }
}

import type { D1Database } from "@cloudflare/workers-types";
import { verificationRequest } from "../../lib/usage/publisher.mjs";
import {
  resourceActionPayload,
  resourceIds,
  resourceActions,
} from "./resource-action-contract.ts";

export const resourceDailyCap = 1000;
export const resourceRetentionDays = 35;
export const resourceIncrementSQL = `INSERT INTO composer_resource_usage(day,resource,action,n) VALUES(?1,?2,?3,1)
 ON CONFLICT(day,resource,action) DO UPDATE SET n=n+1 WHERE n < ${resourceDailyCap}`;
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: string;
  USAGE_LIMIT?: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
}
const empty = (status = 204) =>
  new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const unavailable = () =>
  Response.json(
    { contract: 1, state: "unavailable", total: null },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );

async function boundedInput(request: Request) {
  if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json")
    throw Error("Unsupported body");
  if (Number(request.headers.get("Content-Length") || 0) > 128)
    throw Error("Oversized body");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing body");
  let bytes = new Uint8Array();
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (bytes.length + part.value.length > 128) {
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
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "action,contract,resource"
  )
    throw Error("Unsupported body");
  const input = value as Record<string, unknown>;
  const payload = resourceActionPayload(input.resource, input.action);
  if (!payload || input.contract !== 1) throw Error("Unsupported body");
  return payload;
}

// A client activation can be forged; this is an aggregate feedback signal, never
// execution/visitor/conversion proof. It shares no publisher token or authority.
export async function collectResourceAction(
  request: Request,
  runtime: Runtime,
  now = new Date(),
) {
  if (request.method !== "POST") return empty(405);
  const url = new URL(request.url);
  if (
    !runtime.PUBLIC_ORIGIN ||
    url.origin !== runtime.PUBLIC_ORIGIN ||
    request.headers.get("Origin") !== runtime.PUBLIC_ORIGIN ||
    (request.headers.has("Sec-Fetch-Site") &&
      request.headers.get("Sec-Fetch-Site") !== "same-origin")
  )
    return empty(403);
  if (verificationRequest(request)) return empty();
  if (url.search) return empty(400);
  let input: NonNullable<ReturnType<typeof resourceActionPayload>>;
  try {
    input = await boundedInput(request);
  } catch {
    return empty(400);
  }
  if (!runtime.DB || !runtime.USAGE_LIMIT) return unavailable();
  try {
    if (
      !(
        await runtime.USAGE_LIMIT.limit({
          key: `resource:${input.resource}:${input.action}`,
        })
      ).success
    )
      return empty(429);
    const result = await runtime.DB.prepare(resourceIncrementSQL)
      .bind(now.toISOString().slice(0, 10), input.resource, input.action)
      .run();
    if (!result.success) return unavailable();
    return empty();
  } catch {
    return unavailable();
  }
}

export async function resourceActionSummary(
  request: Request,
  runtime: Runtime,
  now = new Date(),
) {
  if (request.method !== "GET") return empty(405);
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== "days") ||
    params.getAll("days").length > 1 ||
    (params.has("days") && !["7", "30"].includes(params.get("days")!))
  )
    return empty(400);
  if (!runtime.DB) return unavailable();
  const days = params.get("days") === "30" ? 30 : 7;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const from = start.toISOString().slice(0, 10),
    through = now.toISOString().slice(0, 10);
  try {
    const result = await runtime.DB.prepare(
      "SELECT day,resource,action,n FROM composer_resource_usage WHERE day>=?1 AND day<=?2 ORDER BY day,resource,action",
    )
      .bind(from, through)
      .all<{ day: string; resource: string; action: string; n: number }>();
    if (!result.success) return unavailable();
    const rows = result.results;
    if (
      !Array.isArray(rows) ||
      rows.some(
        (row) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(row.day) ||
          row.day < from ||
          row.day > through ||
          !resourceIds.includes(row.resource as (typeof resourceIds)[number]) ||
          !resourceActions.includes(
            row.action as (typeof resourceActions)[number],
          ) ||
          !Number.isInteger(row.n) ||
          row.n < 1 ||
          row.n > resourceDailyCap,
      )
    )
      return unavailable();
    return Response.json(
      {
        contract: 1,
        state: rows.length ? "observed" : "no_retained_actions",
        from,
        through,
        days,
        total: rows.length ? rows.reduce((n, row) => n + row.n, 0) : null,
        rows,
        dailyCap: resourceDailyCap,
        retentionDays: resourceRetentionDays,
        measure:
          "Client-reported resource activations and resolved clipboard copies; not completed downloads, operations or people.",
        limits:
          "Missing rows are unobserved, not historic zeros. Recording can drop; totals at the daily cap are lower bounds.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return unavailable();
  }
}

export async function purgeResourceActions(db: D1Database, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - resourceRetentionDays + 1);
  return db
    .prepare("DELETE FROM composer_resource_usage WHERE day < ?1")
    .bind(start.toISOString().slice(0, 10))
    .run();
}

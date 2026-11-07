// Durable, owner-controlled Plugin Trust watch. The default state is disabled;
// the daily scheduled run only proceeds after the owner enables it. A failed or
// partial observation keeps the last good snapshot and is never shown as green.
import type { D1Database } from "@cloudflare/workers-types";
import {
  pluginTrustSnapshot,
  type TrustSnapshot,
} from "./plugin-trust-contract.ts";
import {
  refreshPluginTrust,
  type Discovery,
} from "./plugin-trust-refresh.ts";
import { reviewItems } from "./plugin-trust-watch.ts";
import { workerDiscovery } from "./plugin-trust-discovery.ts";

export const watchId = "default";
export type WatchState = "never" | "ok" | "partial" | "failed";
export interface WatchRecord {
  enabled: boolean;
  lastRunAt: string | null;
  state: WatchState;
  error: string;
  snapshot: TrustSnapshot | null;
}
export interface PersistedReview {
  key: string;
  did: string;
  slug: string;
  version: string;
  severity: "review" | "block";
  code: string;
  detail: string;
  firstSeenAt: string;
  lastSeenAt: string;
}
const empty: WatchRecord = {
  enabled: false,
  lastRunAt: null,
  state: "never",
  error: "",
  snapshot: null,
};
const states = new Set<WatchState>(["never", "ok", "partial", "failed"]);
const runIntervalMs = 20 * 60 * 60 * 1000;
const maximumSnapshotBytes = 200 * 1024;
const safeCode = /^[a-z][a-z0-9-]{0,60}$/;

function parseSnapshot(value: unknown): TrustSnapshot | null {
  if (typeof value !== "string" || value.length > maximumSnapshotBytes)
    return null;
  try {
    return pluginTrustSnapshot.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function readWatch(db?: D1Database): Promise<WatchRecord> {
  if (!db) return { ...empty };
  const row = await db
    .prepare(
      "SELECT enabled,last_run_at,last_state,last_error,snapshot_json FROM composer_plugin_trust_watch WHERE id=?",
    )
    .bind(watchId)
    .first<{
      enabled: number;
      last_run_at: string | null;
      last_state: string;
      last_error: string;
      snapshot_json: string | null;
    }>();
  if (!row) return { ...empty };
  return {
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    state: states.has(row.last_state as WatchState)
      ? (row.last_state as WatchState)
      : "failed",
    error: safeCode.test(row.last_error) ? row.last_error : "",
    snapshot: parseSnapshot(row.snapshot_json),
  };
}

export async function setWatchEnabled(
  db: D1Database,
  enabled: boolean,
  now = new Date(),
) {
  await db
    .prepare(
      "INSERT INTO composer_plugin_trust_watch (id,enabled,last_state,updated_at) VALUES (? , ?, 'never', ?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled, updated_at=excluded.updated_at",
    )
    .bind(watchId, enabled ? 1 : 0, now.toISOString())
    .run();
  return readWatch(db);
}

export async function openReviews(db?: D1Database): Promise<PersistedReview[]> {
  if (!db) return [];
  const result = await db
    .prepare(
      "SELECT review_key,did,slug,version,severity,code,detail,first_seen_at,last_seen_at FROM composer_plugin_trust_reviews WHERE state='open' ORDER BY CASE severity WHEN 'block' THEN 0 ELSE 1 END, last_seen_at DESC LIMIT 60",
    )
    .all<{
      review_key: string;
      did: string;
      slug: string;
      version: string;
      severity: string;
      code: string;
      detail: string;
      first_seen_at: string;
      last_seen_at: string;
    }>();
  if (!result.success || !Array.isArray(result.results)) return [];
  return result.results.map((row) => ({
    key: row.review_key,
    did: row.did,
    slug: row.slug,
    version: row.version,
    severity: row.severity === "block" ? "block" : "review",
    code: row.code,
    detail: row.detail,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export async function resolveReview(
  db: D1Database,
  key: string,
  now = new Date(),
) {
  const result = await db
    .prepare(
      "UPDATE composer_plugin_trust_reviews SET state='resolved', last_seen_at=? WHERE review_key=? AND state='open'",
    )
    .bind(now.toISOString(), key)
    .run();
  return result.success && (result.meta?.changes ?? 0) === 1;
}

async function fail(
  db: D1Database,
  code: string,
  now: Date,
): Promise<{ state: "failed"; error: string }> {
  const error = safeCode.test(code) ? code : "observation-failed";
  await db
    .prepare(
      "UPDATE composer_plugin_trust_watch SET last_run_at=?, last_state='failed', last_error=?, updated_at=? WHERE id=?",
    )
    .bind(now.toISOString(), error, now.toISOString(), watchId)
    .run();
  return { state: "failed", error };
}

export async function runPluginTrustWatch(
  db: D1Database | undefined,
  {
    discovery,
    now = new Date(),
    committed,
    force = false,
  }: {
    discovery: Discovery;
    now?: Date;
    committed: TrustSnapshot;
    force?: boolean;
  },
) {
  if (!db) return { state: "unavailable" as const };
  const watch = await readWatch(db);
  if (!watch.enabled) return { state: "disabled" as const };
  if (
    !force &&
    watch.lastRunAt &&
    now.getTime() - Date.parse(watch.lastRunAt) < runIntervalMs
  )
    return { state: "skipped" as const };
  const base = watch.snapshot ?? committed;
  let next: TrustSnapshot;
  try {
    next = await refreshPluginTrust(base, discovery, now);
  } catch {
    return fail(db, "registry-unavailable", now);
  }
  if (next.packages.some((plugin) => plugin.refreshFailed))
    return fail(db, "partial-observation", now);
  const serialized = JSON.stringify(next);
  if (serialized.length > maximumSnapshotBytes)
    return fail(db, "snapshot-too-large", now);
  const items = reviewItems(base, next);
  const at = now.toISOString();
  for (const item of items) {
    await db
      .prepare(
        "INSERT INTO composer_plugin_trust_reviews (review_key,did,slug,version,severity,code,detail,state,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,'open',?,?) ON CONFLICT(review_key) DO UPDATE SET severity=excluded.severity, code=excluded.code, detail=excluded.detail, state='open', last_seen_at=excluded.last_seen_at",
      )
      .bind(
        item.key,
        item.did,
        item.slug,
        item.version,
        item.severity === "block" ? "block" : "review",
        item.code,
        item.detail,
        at,
        at,
      )
      .run();
  }
  await db
    .prepare(
      "UPDATE composer_plugin_trust_watch SET last_run_at=?, last_state='ok', last_error='', snapshot_json=?, updated_at=? WHERE id=?",
    )
    .bind(at, serialized, at, watchId)
    .run();
  return { state: "ok" as const, reviews: items.length };
}

export async function runScheduledPluginTrustWatch(
  db: D1Database | undefined,
  committed: TrustSnapshot,
  now = new Date(),
  discovery: Discovery = workerDiscovery(),
) {
  try {
    return await runPluginTrustWatch(db, { discovery, now, committed });
  } catch {
    if (db) await fail(db, "observation-failed", now).catch(() => undefined);
    return { state: "failed" as const, error: "observation-failed" };
  }
}

export async function watchView(db?: D1Database) {
  const [record, reviews] = await Promise.all([readWatch(db), openReviews(db)]);
  return {
    available: Boolean(db),
    enabled: record.enabled,
    lastRunAt: record.lastRunAt,
    latestSnapshotAt: record.snapshot?.observedAt ?? null,
    state: record.state,
    error: record.error,
    reviews,
  };
}

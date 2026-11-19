// Private Benchmarks Studio run history (#933 B2/B4).
//
// This is the storage boundary for owner-imported native reports. It never
// touches the public suite catalogue or its "Not run" state, never executes a
// suite or any imported content, provisions no workspace, calls no provider and
// changes no D1 binding. It is not a public projection: a run is visible only
// to the actor who imported it while that actor is still an owner of the
// workspace. Viewers, editors and other owners get nothing.
//
// The caller passes only the current EmDash actor as `ownerId`. That one value
// is bound both to the membership guard and to the row's actor id, so a caller
// can never choose, forge or inherit another actor's private history.
import type { D1Database } from "@cloudflare/workers-types";
import { parseLocalBenchmarkResult } from "./benchmark-local-result.ts";

export const PRIVATE_BENCHMARK_RUNS_TABLE = "private_benchmark_runs";
export const PRIVATE_BENCHMARK_VERIFICATION = "owner-imported" as const;
export const MAX_PRIVATE_BENCHMARK_RUNS = 20;
export const MAX_PRIVATE_BENCHMARK_BYTES = 1024 * 1024;

export type PrivateBenchmarkCheck = {
  id: string;
  name: string;
  status: "pass" | "fail" | "blocked";
  detail: string;
};

export type PrivateBenchmarkSuite = {
  id: string;
  name: string;
  checks: PrivateBenchmarkCheck[];
};

/** The canonical native report shape. Nothing else is ever stored or served. */
export type PrivateBenchmarkReport = {
  source: string;
  generatedAt: string;
  suites: PrivateBenchmarkSuite[];
  pack?: { id: string };
};

export type PrivateBenchmarkRunSummary = {
  id: string;
  sha256: string;
  source: string;
  generatedAt: string;
  importedAt: string;
  packId: string | null;
  checks: number;
};

export type PrivateBenchmarkRun = PrivateBenchmarkRunSummary & {
  report: PrivateBenchmarkReport;
  verification: typeof PRIVATE_BENCHMARK_VERIFICATION;
};

export type PrivateBenchmarkWorkspace = { id: string; name: string };

type SummaryRow = {
  id: string;
  sha256: string;
  source: string;
  generated_at: string;
  imported_at: string;
  pack_id: string | null;
  checks: number;
};

type FullRow = SummaryRow & { report_json: string };

// ?1 is the workspace and ?2 the current actor in every read and delete
// statement. The INSERT binds the new id first, so it uses ?2 and ?3 instead.
const OWNER_GUARD =
  "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=?1 AND user_id=?2 AND role='owner')";
const INSERT_OWNER_GUARD =
  "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=?2 AND user_id=?3 AND role='owner')";

const SUMMARY_FIELDS =
  "id, sha256, source, generated_at, imported_at, pack_id, checks";

function summary(row: SummaryRow): PrivateBenchmarkRunSummary {
  return {
    id: row.id,
    sha256: row.sha256,
    source: row.source,
    generatedAt: row.generated_at,
    importedAt: row.imported_at,
    packId: row.pack_id ?? null,
    checks: Number(row.checks),
  };
}

/** Workspaces this actor currently owns. No personal-workspace fallback and no
 * provisioning: an owner membership is the only source of truth. */
export async function listPrivateBenchmarkWorkspaces(
  db: D1Database,
  ownerId: string,
): Promise<PrivateBenchmarkWorkspace[]> {
  const { results } = await db
    .prepare(
      `SELECT w.id, w.name FROM creator_members m
       JOIN creator_workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ?1 AND m.role = 'owner'
       ORDER BY w.name, w.id LIMIT 128`,
    )
    .bind(ownerId)
    .all<PrivateBenchmarkWorkspace>();
  return (results ?? []).map((row) => ({ id: row.id, name: row.name }));
}

export async function isPrivateBenchmarkOwner(
  db: D1Database,
  ownerId: string,
  workspaceId: string,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT ${OWNER_GUARD} AS owned`)
    .bind(workspaceId, ownerId)
    .first<{ owned: number }>();
  return row?.owned === 1;
}

/** Summaries the importing actor may still read in this workspace. */
export async function listPrivateBenchmarkRuns(
  db: D1Database,
  ownerId: string,
  workspaceId: string,
): Promise<PrivateBenchmarkRunSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT ${SUMMARY_FIELDS} FROM ${PRIVATE_BENCHMARK_RUNS_TABLE}
       WHERE workspace_id = ?1 AND actor_id = ?2 AND ${OWNER_GUARD}
       ORDER BY imported_at DESC, id DESC LIMIT ${MAX_PRIVATE_BENCHMARK_RUNS}`,
    )
    .bind(workspaceId, ownerId)
    .all<SummaryRow>();
  return (results ?? []).map(summary);
}

/** The full re-openable record, or null when any part of the scope is wrong. */
export async function getPrivateBenchmarkRun(
  db: D1Database,
  ownerId: string,
  workspaceId: string,
  id: string,
): Promise<PrivateBenchmarkRun | null> {
  const row = await db
    .prepare(
      `SELECT ${SUMMARY_FIELDS}, report_json FROM ${PRIVATE_BENCHMARK_RUNS_TABLE}
       WHERE workspace_id = ?1 AND actor_id = ?2 AND id = ?3 AND ${OWNER_GUARD}`,
    )
    .bind(workspaceId, ownerId, id)
    .first<FullRow>();
  if (!row) return null;
  return {
    ...summary(row),
    report: JSON.parse(row.report_json) as PrivateBenchmarkReport,
    verification: PRIVATE_BENCHMARK_VERIFICATION,
  };
}

/**
 * Import one canonical native report in a single atomic INSERT ... SELECT.
 * The statement itself enforces a current owner membership and the 20-run cap
 * per actor per workspace, so there is no check-then-write gap. A duplicate is
 * allowed through the cap and the UNIQUE(workspace_id, actor_id, sha256) key
 * makes it a no-op; the follow-up read then returns the original row, with its
 * original id and importedAt. When the scope fails or a new report is over the
 * cap, no row is written and the read finds nothing, so the result is null.
 */
export async function savePrivateBenchmarkRun(
  db: D1Database,
  ownerId: string,
  workspaceId: string,
  canonicalReport: PrivateBenchmarkReport,
  now = new Date(),
): Promise<PrivateBenchmarkRunSummary | null> {
  // The current parser is the shape authority. Re-parsing strips anything the
  // native contract does not declare, so only {source, generatedAt, suites,
  // pack?: {id}} reaches storage and the stored bytes re-open in that parser.
  const parsed = parseLocalBenchmarkResult(canonicalReport);
  const report: PrivateBenchmarkReport = {
    source: parsed.source,
    generatedAt: parsed.generatedAt,
    suites: parsed.suites,
    ...(parsed.packId ? { pack: { id: parsed.packId } } : {}),
  };
  const raw = JSON.stringify(report);
  if (new TextEncoder().encode(raw).length > MAX_PRIVATE_BENCHMARK_BYTES)
    throw new RangeError("The private benchmark report exceeds the 1 MiB limit.");

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  await db
    .prepare(
      `INSERT INTO ${PRIVATE_BENCHMARK_RUNS_TABLE}
         (id, workspace_id, actor_id, sha256, source, generated_at, imported_at,
          pack_id, checks, report_json)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
       WHERE ${INSERT_OWNER_GUARD}
         AND (
           EXISTS(SELECT 1 FROM ${PRIVATE_BENCHMARK_RUNS_TABLE}
                  WHERE workspace_id = ?2 AND actor_id = ?3 AND sha256 = ?4)
           OR (SELECT COUNT(*) FROM ${PRIVATE_BENCHMARK_RUNS_TABLE}
               WHERE workspace_id = ?2 AND actor_id = ?3) < ?11
         )
       ON CONFLICT(workspace_id, actor_id, sha256) DO NOTHING`,
    )
    .bind(
      globalThis.crypto.randomUUID(),
      workspaceId,
      ownerId,
      sha256,
      parsed.source,
      parsed.generatedAt,
      now.toISOString(),
      parsed.packId ?? null,
      parsed.totals.checks,
      raw,
      MAX_PRIVATE_BENCHMARK_RUNS,
    )
    .run();

  const row = await db
    .prepare(
      `SELECT ${SUMMARY_FIELDS} FROM ${PRIVATE_BENCHMARK_RUNS_TABLE}
       WHERE workspace_id = ?1 AND actor_id = ?2 AND sha256 = ?3 AND ${OWNER_GUARD}`,
    )
    .bind(workspaceId, ownerId, sha256)
    .first<SummaryRow>();
  return row ? summary(row) : null;
}

/** True only when this actor's own row in this owned workspace was removed. */
export async function deletePrivateBenchmarkRun(
  db: D1Database,
  ownerId: string,
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM ${PRIVATE_BENCHMARK_RUNS_TABLE}
       WHERE workspace_id = ?1 AND actor_id = ?2 AND id = ?3 AND ${OWNER_GUARD}`,
    )
    .bind(workspaceId, ownerId, id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

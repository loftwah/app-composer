// Private native suite definitions are scoped to the current owner and active project.
import type { D1Database } from "@cloudflare/workers-types";

export const PRIVATE_BENCHMARK_SUITES_TABLE = "private_benchmark_suites";
export const MAX_PRIVATE_BENCHMARK_SUITES = 20;
export const MAX_PRIVATE_BENCHMARK_SUITE_BYTES = 32768;

export type PrivateBenchmarkSuiteScope = {
  workspaceId: string;
  projectId: string;
  ownerId: string;
};

export type PrivateBenchmarkSuiteDefinition = {
  schema: "benchmark-suite/v1";
  id: string;
  name: string;
  checks: unknown[];
};

export type PrivateBenchmarkSuiteSummary = {
  id: string;
  name: string;
  checks: number;
  sha256: string;
  importedAt: string;
};

export type PrivateBenchmarkSuite = PrivateBenchmarkSuiteSummary & {
  definition: unknown;
};

export type PrivateBenchmarkSuiteProject = { id: string; name: string };

type SummaryRow = {
  id: string;
  name: string;
  checks: number;
  sha256: string;
  imported_at: string;
};

type FullRow = SummaryRow & { definition_json: string };

// Reads/deletes bind ?1 = workspace, ?2 = project, ?3 = actor. The INSERT binds
// the new id first, so there the workspace/project/actor are ?2/?3/?4.
const SCOPE_GUARD =
  "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=?1 AND user_id=?3 AND role='owner')" +
  " AND EXISTS(SELECT 1 FROM creator_stacks WHERE id=?2 AND workspace_id=?1 AND status <> 'archived')";
const INSERT_SCOPE_GUARD =
  "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=?2 AND user_id=?4 AND role='owner')" +
  " AND EXISTS(SELECT 1 FROM creator_stacks WHERE id=?3 AND workspace_id=?2 AND status <> 'archived')";

const SUMMARY_FIELDS = "id, name, checks, sha256, imported_at";

function summary(row: SummaryRow): PrivateBenchmarkSuiteSummary {
  return {
    id: row.id,
    name: row.name,
    checks: Number(row.checks),
    sha256: row.sha256,
    importedAt: row.imported_at,
  };
}

async function sha256Hex(raw: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Real active stacks in the given workspace that this actor currently owns.
 * No personal-workspace fallback and no provisioning: an owner membership is
 * the only source of truth. */
export async function listPrivateBenchmarkSuiteProjects(
  db: D1Database,
  ownerId: string,
  workspaceId: string,
): Promise<PrivateBenchmarkSuiteProject[]> {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.name FROM creator_stacks s
       JOIN creator_members m ON m.workspace_id = s.workspace_id
       WHERE s.workspace_id = ?2 AND m.user_id = ?1 AND m.role = 'owner'
         AND s.status <> 'archived'
       ORDER BY s.name, s.id LIMIT 128`,
    )
    .bind(ownerId, workspaceId)
    .all<PrivateBenchmarkSuiteProject>();
  return (results ?? []).map((row) => ({ id: row.id, name: row.name }));
}

/** True only for a live, non-archived project in a workspace this actor owns. */
export async function isPrivateBenchmarkSuiteProject(
  db: D1Database,
  scope: PrivateBenchmarkSuiteScope,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT (${SCOPE_GUARD}) AS ok`)
    .bind(scope.workspaceId, scope.projectId, scope.ownerId)
    .first<{ ok: number }>();
  return row?.ok === 1;
}

/** Summaries the importing actor may still read for this active project. */
export async function listPrivateBenchmarkSuites(
  db: D1Database,
  scope: PrivateBenchmarkSuiteScope,
): Promise<PrivateBenchmarkSuiteSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT ${SUMMARY_FIELDS} FROM ${PRIVATE_BENCHMARK_SUITES_TABLE}
       WHERE workspace_id = ?1 AND project_id = ?2 AND actor_id = ?3 AND ${SCOPE_GUARD}
       ORDER BY imported_at DESC, id DESC LIMIT ${MAX_PRIVATE_BENCHMARK_SUITES}`,
    )
    .bind(scope.workspaceId, scope.projectId, scope.ownerId)
    .all<SummaryRow>();
  return (results ?? []).map(summary);
}

/** The saved native definition for this owner and project. */
export async function getPrivateBenchmarkSuite(
  db: D1Database,
  scope: PrivateBenchmarkSuiteScope,
  id: string,
): Promise<PrivateBenchmarkSuite | null> {
  const row = await db
    .prepare(
      `SELECT ${SUMMARY_FIELDS}, definition_json FROM ${PRIVATE_BENCHMARK_SUITES_TABLE}
       WHERE workspace_id = ?1 AND project_id = ?2 AND actor_id = ?3 AND id = ?4
         AND ${SCOPE_GUARD}`,
    )
    .bind(scope.workspaceId, scope.projectId, scope.ownerId, id)
    .first<FullRow>();
  if (!row) return null;
  return {
    ...summary(row),
    definition: JSON.parse(row.definition_json) as unknown,
  };
}

/**
 * Save one native definition in a single atomic INSERT ... SELECT. The
 * statement rechecks the active-project + current-owner scope and the 20-suite
 * cap per project per actor, so there is no check-then-write gap. A repeat of
 * the exact digest is allowed through the cap and the UNIQUE key makes the
 * insert a no-op; the read-back then returns the original row. A differing
 * digest on the same id conflicts, is never overwritten, and reads back as
 * null. When the scope fails or a new suite is over the cap, no row is written
 * and the read finds nothing, so the result is null.
 */
export async function savePrivateBenchmarkSuite(
  db: D1Database,
  scope: PrivateBenchmarkSuiteScope,
  definition: PrivateBenchmarkSuiteDefinition,
  now = new Date(),
): Promise<PrivateBenchmarkSuiteSummary | null> {
  if (
    definition?.schema !== "benchmark-suite/v1" ||
    typeof definition.id !== "string" ||
    typeof definition.name !== "string" ||
    !Array.isArray(definition.checks)
  )
    throw new TypeError("Save one native suite definition with id, name and checks.");
  if (definition.checks.length < 1 || definition.checks.length > 100)
    throw new RangeError("A private suite must have between 1 and 100 checks.");

  // Preserve the full validated native definition for the existing inspector and runner.
  const raw = JSON.stringify(definition);
  if (new TextEncoder().encode(raw).length > MAX_PRIVATE_BENCHMARK_SUITE_BYTES)
    throw new RangeError("The private benchmark suite exceeds the 32 KiB limit.");

  const sha256 = await sha256Hex(raw);

  await db
    .prepare(
      `INSERT INTO ${PRIVATE_BENCHMARK_SUITES_TABLE}
         (id, workspace_id, project_id, actor_id, name, checks, sha256,
          definition_json, imported_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
       WHERE ${INSERT_SCOPE_GUARD}
         AND (
           EXISTS(SELECT 1 FROM ${PRIVATE_BENCHMARK_SUITES_TABLE}
                  WHERE workspace_id = ?2 AND project_id = ?3 AND actor_id = ?4
                    AND id = ?1 AND sha256 = ?7)
           OR (SELECT COUNT(*) FROM ${PRIVATE_BENCHMARK_SUITES_TABLE}
               WHERE workspace_id = ?2 AND project_id = ?3 AND actor_id = ?4) < ?10
         )
       ON CONFLICT(workspace_id, project_id, actor_id, id) DO NOTHING`,
    )
    .bind(
      definition.id,
      scope.workspaceId,
      scope.projectId,
      scope.ownerId,
      definition.name,
      definition.checks.length,
      sha256,
      raw,
      now.toISOString(),
      MAX_PRIVATE_BENCHMARK_SUITES,
    )
    .run();

  const row = await db
    .prepare(
      `SELECT ${SUMMARY_FIELDS} FROM ${PRIVATE_BENCHMARK_SUITES_TABLE}
       WHERE workspace_id = ?1 AND project_id = ?2 AND actor_id = ?3
         AND id = ?4 AND sha256 = ?5 AND ${SCOPE_GUARD}`,
    )
    .bind(scope.workspaceId, scope.projectId, scope.ownerId, definition.id, sha256)
    .first<SummaryRow>();
  return row ? summary(row) : null;
}

/** True only when this actor's own row in this active, owned project was removed. */
export async function deletePrivateBenchmarkSuite(
  db: D1Database,
  scope: PrivateBenchmarkSuiteScope,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `DELETE FROM ${PRIVATE_BENCHMARK_SUITES_TABLE}
       WHERE workspace_id = ?1 AND project_id = ?2 AND actor_id = ?3 AND id = ?4
         AND ${SCOPE_GUARD}`,
    )
    .bind(scope.workspaceId, scope.projectId, scope.ownerId, id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

-- Private, owner-imported Benchmarks Studio run history (#933 B2/B4).
--
-- Additive and idempotent: one new table and one new index. Every existing
-- public suite, committed result and vote row is untouched, and the public
-- catalogue keeps saying Not run. There is no backfill: a private run exists
-- only when an owner deliberately uploads a native report, and no legacy row
-- can be guessed to have an owner.
--
-- The boundary is the existing creator workspace membership. A row carries the
-- actor who imported it; reads and writes require BOTH a current owner
-- membership for that workspace AND that the row's actor is that same owner.
-- There is no viewer/editor projection and no sharing between co-owners. The
-- caller never supplies an actor id: the module binds the current EmDash actor
-- for both the membership check and the stored actor.
--
-- The report is the canonical native shape only -- {source, generatedAt,
-- suites, pack?: {id}} -- so it re-opens in the current parser. SHA-256 is
-- computed over those canonical UTF-8 bytes in the application (SQLite has no
-- SHA-256 here) and stored as lowercase hex. A 1 MiB ceiling is enforced both
-- here (characters) and in the application (UTF-8 bytes).
CREATE TABLE IF NOT EXISTS private_benchmark_runs (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  source TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  pack_id TEXT,
  checks INTEGER NOT NULL CHECK (checks BETWEEN 0 AND 1000),
  report_json TEXT NOT NULL CHECK (
    json_valid(report_json) AND length(report_json) <= 1048576
  ),
  UNIQUE (workspace_id, actor_id, sha256)
) STRICT;

CREATE INDEX IF NOT EXISTS private_benchmark_runs_scope
  ON private_benchmark_runs (workspace_id, actor_id, imported_at DESC, id DESC);

-- Private, owner-imported Benchmarks Studio suite definitions (#933).
--
-- Additive and idempotent: one new table and one new index. No existing public
-- suite, result or vote row is touched and there is no backfill: a private suite
-- exists only when an owner deliberately saves a native definition, and no
-- legacy row can be guessed to have an owner.
--
-- The boundary is the real creator workspace + active stack + current owner
-- membership. A row carries the actor who imported it. Every read and write
-- rechecks that the stack is active/non-archived in that workspace and that the
-- actor is still an owner of the workspace. There is no viewer/editor
-- projection and no sharing between co-owners; the caller never supplies an
-- actor id, the module binds the current EmDash actor for both checks.
--
-- Keep the complete native v1 definition and its UTF-8 SHA-256.
-- Each owner can keep up to 20 definitions per project.
CREATE TABLE IF NOT EXISTS private_benchmark_suites (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES creator_stacks(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  checks INTEGER NOT NULL CHECK (checks BETWEEN 1 AND 100),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  definition_json TEXT NOT NULL CHECK (
    json_valid(definition_json) AND length(definition_json) <= 32768
      AND json_extract(definition_json, '$.schema') IS 'benchmark-suite/v1'
      AND json_extract(definition_json, '$.id') IS id
      AND json_extract(definition_json, '$.name') IS name
      AND json_type(definition_json, '$.checks') IS 'array'
      AND json_array_length(definition_json, '$.checks') IS checks
  ),
  imported_at TEXT NOT NULL,
  UNIQUE (workspace_id, project_id, actor_id, id)
) STRICT;

CREATE INDEX IF NOT EXISTS private_benchmark_suites_scope
  ON private_benchmark_suites (workspace_id, project_id, actor_id, imported_at DESC, id DESC);

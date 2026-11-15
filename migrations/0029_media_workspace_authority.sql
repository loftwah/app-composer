-- Media authority becomes one row per creator workspace (#599).
--
-- Additive and idempotent: this migration creates new tables and indexes only.
-- The legacy deployment-wide `media_capability` row and every `media_jobs` row
-- stay exactly as they were. Nothing is renamed, dropped or rewritten, so a
-- second application of this file is a no-op and no provider/HTTP call is made.
--
-- Backfill rule (explicit, no guessing):
--   * Automatic workspace backfill is **none**. A legacy media row stores no
--     workspace, environment or account identity, and the pre-#599 handlers ran
--     under deployment-wide authority. There is therefore no provable workspace
--     owner for any legacy row.
--   * Every legacy job is copied once into owner custody (`workspace_id =
--     'custody:owner'`, `scope = 'custody'`, `adopted_from = 'legacy:0027'`).
--     Custody is readable only by the deployment owner and is never mixed into
--     a workspace list.
--   * A custody job moves to a workspace only through the explicit, audited
--     owner `adopt` action, which records the previous scope plus actor and
--     timestamp on the job and in `media_scope_events`. That declaration is the
--     only provable ownership evidence, and it is reversible by the same owner.
--
-- Credentials are never copied into D1. A connection stores a credential
-- *reference* (`OYSTER` or `OYSTER_CONNECTION_<NAME>`); the matching
-- `_ORIGIN` / `_OWNER_KEY` values stay in Worker secrets.

CREATE TABLE IF NOT EXISTS media_workspace_connections (
  workspace_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  host TEXT NOT NULL,
  installation TEXT NOT NULL DEFAULT 'prints',
  credential_ref TEXT NOT NULL,
  credential_scope TEXT NOT NULL CHECK (credential_scope IN ('workspace', 'deployment-legacy')),
  -- `enabled = 0` is this workspace's revocation of the connection: new
  -- dispatch and retained-result reads stop, and jobs/imports are kept.
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  models_json TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
) STRICT;

-- The one canonical job table after #599. `request_id` stays globally unique:
-- it is the provider's own replay identity, so two workspaces can never share
-- one provider request. The row id is derived from the workspace and request
-- id, so ids do not collide across scopes either.
CREATE TABLE IF NOT EXISTS media_workspace_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('workspace', 'custody')),
  connection_id TEXT,
  connection_revision INTEGER,
  request_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  state TEXT NOT NULL CHECK (
    state IN ('intent', 'pending', 'completed', 'failed', 'refused', 'unknown')
  ),
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  reference_path TEXT,
  cost_milliunits INTEGER NOT NULL DEFAULT 0,
  output_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  imported_key TEXT,
  imported_sha256 TEXT,
  imported_bytes INTEGER,
  imported_format TEXT,
  created_by TEXT NOT NULL,
  adopted_from TEXT,
  adopted_at TEXT,
  adopted_by TEXT,
  CHECK (
    (scope = 'workspace' AND workspace_id <> 'custody:owner') OR
    (scope = 'custody' AND workspace_id = 'custody:owner')
  ),
  -- A dispatched row records the connection it used. A legacy row adopted by
  -- the owner keeps its provenance instead, because it was sent before
  -- per-workspace connections existed.
  CHECK (scope = 'custody' OR connection_id IS NOT NULL OR adopted_from IS NOT NULL)
) STRICT;

CREATE INDEX IF NOT EXISTS media_workspace_jobs_workspace
  ON media_workspace_jobs (workspace_id, created_at DESC);

-- Owner-issued, workspace-scoped agent admission. Only the SHA-256 of the token
-- is stored; the token itself is shown once at issue time. No deployment-wide
-- agent token grants workspace media authority after this migration.
CREATE TABLE IF NOT EXISTS media_agent_grants (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  label TEXT NOT NULL,
  token_sha256 TEXT NOT NULL UNIQUE,
  actions_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  CHECK (length(token_sha256) = 64)
) STRICT;

CREATE INDEX IF NOT EXISTS media_agent_grants_workspace
  ON media_agent_grants (workspace_id, status);

-- Owner-custody and connection receipts. Each row names the owning media
-- record (`subject`), so a reusable receipt always resolves back to it.
CREATE TABLE IF NOT EXISTS media_scope_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  event TEXT NOT NULL CHECK (
    event IN ('enable', 'disable', 'refresh', 'grant-agent', 'revoke-agent', 'adopt-custody')
  ),
  subject TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS media_scope_events_workspace
  ON media_scope_events (workspace_id, created_at);

-- The bounded legacy transition: every pre-#599 job becomes custody, unchanged
-- apart from the scope column that now records it. `INSERT OR IGNORE` keeps the
-- statement idempotent for a partially applied or re-run database.
INSERT OR IGNORE INTO media_workspace_jobs (
  id, workspace_id, scope, request_id, kind, state, prompt, model, settings_json,
  reference_path, cost_milliunits, output_json, error_code, created_at, updated_at,
  imported_key, imported_sha256, imported_bytes, imported_format, created_by,
  adopted_from
)
SELECT
  id, 'custody:owner', 'custody', request_id, kind, state, prompt, model, settings_json,
  reference_path, cost_milliunits, output_json, error_code, created_at, updated_at,
  imported_key, imported_sha256, imported_bytes, imported_format, created_by,
  'legacy:0027'
FROM media_jobs;

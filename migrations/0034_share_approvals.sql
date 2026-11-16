-- Exact Bluesky approval bindings (#604, third slice). An approval binds the
-- public account DID, the saved share item revision, the exact text hash, the
-- media descriptor hash/revision, the canonical link and the intended UTC
-- instant. Editing any bound value requires a new approval revision. The table
-- stores public identity and hashes only: no password, app password, token,
-- refresh credential or private key column exists here.
CREATE TABLE IF NOT EXISTS creator_share_approvals (
  item_id TEXT PRIMARY KEY REFERENCES creator_share_calendar_items(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel = 'bluesky'),
  state TEXT NOT NULL CHECK(state IN ('approved','cancelled','revoked')),
  account_handle TEXT NOT NULL CHECK(length(account_handle) BETWEEN 3 AND 253),
  account_did TEXT NOT NULL CHECK(length(account_did) BETWEEN 8 AND 256),
  draft_revision INTEGER NOT NULL CHECK(draft_revision > 0),
  approval_revision INTEGER NOT NULL CHECK(approval_revision > 0),
  text_hash TEXT NOT NULL CHECK(length(text_hash) = 64),
  media_hash TEXT NOT NULL CHECK(length(media_hash) = 64),
  media_revision TEXT NOT NULL CHECK(length(media_revision) BETWEEN 1 AND 2048),
  link TEXT NOT NULL CHECK(length(link) BETWEEN 1 AND 2048),
  scheduled_at TEXT NOT NULL,
  binding_hash TEXT NOT NULL CHECK(length(binding_hash) = 64),
  approved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  cancelled_at TEXT,
  revoked_at TEXT,
  revocation_reason TEXT NOT NULL DEFAULT '' CHECK(length(revocation_reason) <= 280),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(
    (state = 'approved' AND cancelled_at IS NULL AND revoked_at IS NULL) OR
    (state = 'cancelled' AND cancelled_at IS NOT NULL AND revoked_at IS NULL) OR
    (state = 'revoked' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS creator_share_approvals_workspace
  ON creator_share_approvals(workspace_id, state);

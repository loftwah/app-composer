-- Governed intent and operation receipts only; app data stays with its owner.
CREATE TABLE IF NOT EXISTS creator_platform_profiles (
  workspace_id TEXT PRIMARY KEY REFERENCES creator_workspaces(id),
  revision INTEGER NOT NULL DEFAULT 1,
  profile_json TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS creator_platform_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id),
  actor_id TEXT NOT NULL,
  submission_key TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  request_json TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  plan_digest TEXT NOT NULL,
  policy_revision INTEGER NOT NULL,
  decision_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('waiting','running','verifying','complete','needs-attention','denied','sent-back')),
  stack_id TEXT,
  expected_stack_revision INTEGER,
  expected_stack_json TEXT,
  approval_digest TEXT,
  approval_actor TEXT,
  approval_expires INTEGER,
  lease_token TEXT,
  lease_until INTEGER,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,submission_key)
);
CREATE INDEX IF NOT EXISTS creator_platform_request_scope ON creator_platform_requests(workspace_id,created_at);
CREATE TABLE IF NOT EXISTS creator_platform_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES creator_platform_requests(id),
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  plan_digest TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

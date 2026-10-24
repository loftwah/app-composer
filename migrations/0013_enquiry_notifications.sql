-- Minimal notification metadata only; private enquiry bodies remain app-owned.
CREATE TABLE IF NOT EXISTS creator_enquiry_notification_preferences (
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  destination_digest TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,resource_id)
);
CREATE TABLE IF NOT EXISTS creator_enquiry_notification_outbox (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version=1),
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  target TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('queued','blocked','sending','accepted','failed','uncertain')),
  attempts INTEGER NOT NULL DEFAULT 0,
  destination_digest TEXT,
  provider_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id,resource_id,event_id,version)
);
CREATE INDEX IF NOT EXISTS creator_enquiry_notification_scope ON creator_enquiry_notification_outbox(workspace_id,resource_id,created_at);

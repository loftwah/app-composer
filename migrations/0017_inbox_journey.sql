-- One durable owner journey per confirmed private enquiry event. The run holds
-- no brief body, visitor identity or recipient address; Guestbook still owns the
-- private record. Delivery metadata stays in 0013's outbox.
CREATE TABLE IF NOT EXISTS creator_enquiry_workflow_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  target TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK(actor_kind IN ('system','member')),
  actor_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('queued','running','finished','failed')),
  stage TEXT NOT NULL CHECK(stage IN ('observed','source-checked','notice-prepared')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
  reason TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  outbox_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id,resource_id,event_id,account_id,environment)
);
CREATE INDEX IF NOT EXISTS creator_enquiry_workflow_history ON creator_enquiry_workflow_runs(workspace_id,created_at);

-- A reconciliation is a local re-read after an uncertain provider attempt. It
-- never sends, and it never promotes an unknown outcome to success.
ALTER TABLE creator_enquiry_notification_outbox ADD COLUMN reconciled_at TEXT;
ALTER TABLE creator_enquiry_notification_outbox ADD COLUMN reconciliations INTEGER NOT NULL DEFAULT 0;

-- The receipt hook knows the submission intent; the app export exposes the
-- retained brief by its own item id. A bounded exact-values/provenance match
-- links the two without storing brief content. Null means no exact link was
-- proven and the Inbox must not offer a delivery action.
ALTER TABLE creator_enquiry_workflow_runs ADD COLUMN item_id TEXT;
ALTER TABLE creator_enquiry_notification_outbox ADD COLUMN item_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS creator_enquiry_workflow_item ON creator_enquiry_workflow_runs(workspace_id,resource_id,item_id) WHERE item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creator_enquiry_notification_item ON creator_enquiry_notification_outbox(workspace_id,resource_id,item_id) WHERE item_id IS NOT NULL;

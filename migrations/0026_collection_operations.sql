-- A Linkarooie collection request is a remote write. Keep its exact reference
-- before dispatch so a lost response survives a reload and cannot be repeated
-- as if nothing had happened.
CREATE TABLE creator_collection_operations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  stack_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  configuration_revision INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','applied','unchanged','refused','unknown')),
  card_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX creator_collection_operation_open
  ON creator_collection_operations(workspace_id,stack_id,instance_id,resource_id,configuration_revision,item_id)
  WHERE state IN ('pending','unknown');
CREATE INDEX creator_collection_operation_workspace
  ON creator_collection_operations(workspace_id,updated_at DESC,id DESC);

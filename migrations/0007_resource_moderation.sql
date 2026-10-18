-- Keep configuration and content writes in one reconciliation journal.
-- No table references operation ids; preserve every existing receipt and index.
CREATE TABLE creator_resource_operations_next (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id),
  stack_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','stage','activate','moderate','control')),
  state TEXT NOT NULL CHECK(state IN ('pending','confirmed','unknown','refused')),
  source_revision TEXT NOT NULL,
  request_json TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO creator_resource_operations_next SELECT * FROM creator_resource_operations;
DROP TABLE creator_resource_operations;
ALTER TABLE creator_resource_operations_next RENAME TO creator_resource_operations;
CREATE INDEX creator_resource_operations_pending ON creator_resource_operations(resource_id,state);

-- A resource operation whose app record was explicitly confirmed absent can be
-- abandoned by its owner. This is not a silent retry or a deletion: the
-- operation receipt and its recorded request stay readable.
--
-- SQLite cannot widen an existing CHECK, so rebuild the journal exactly as
-- migration 0007 did. No table references an operation id.
CREATE TABLE creator_resource_operations_next (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id),
  stack_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','stage','activate','moderate','control')),
  state TEXT NOT NULL CHECK(state IN ('pending','confirmed','unknown','refused','abandoned')),
  source_revision TEXT NOT NULL,
  request_json TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO creator_resource_operations_next SELECT * FROM creator_resource_operations;
DROP TABLE creator_resource_operations;
ALTER TABLE creator_resource_operations_next RENAME TO creator_resource_operations;
-- Keep the earliest open operation as the canonical recovery note. Any later
-- duplicate is retained read-only as abandoned instead of failing the one-open
-- invariant below.
UPDATE creator_resource_operations
SET state='abandoned',
    result_json=COALESCE(result_json, '{"abandoned":"A duplicate open operation was retained by migration 0024. Reconcile the earliest operation."}')
WHERE state IN ('pending','unknown')
  AND EXISTS (
    SELECT 1 FROM creator_resource_operations AS older
    WHERE older.resource_id = creator_resource_operations.resource_id
      AND older.state IN ('pending','unknown')
      AND (older.created_at < creator_resource_operations.created_at
        OR (older.created_at = creator_resource_operations.created_at
          AND older.rowid < creator_resource_operations.rowid))
  );
CREATE UNIQUE INDEX creator_resource_operations_one_open
  ON creator_resource_operations(resource_id)
  WHERE state IN ('pending','unknown');
CREATE INDEX creator_resource_operations_pending ON creator_resource_operations(resource_id,state);
CREATE INDEX creator_resource_operations_recent ON creator_resource_operations(resource_id,created_at DESC,id DESC);

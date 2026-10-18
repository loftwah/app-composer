-- Private references to resources owned by independently deployed apps. The
-- resource itself, configuration history, contributions and media stay there.
ALTER TABLE creator_stacks ADD COLUMN resource_mutation TEXT;
CREATE TABLE IF NOT EXISTS creator_app_resources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  app TEXT NOT NULL CHECK(app='guestbook'),
  account_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  target TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK(state IN ('reserved','ready','unknown','refused')) DEFAULT 'reserved',
  configuration_revision INTEGER,
  configuration_digest TEXT,
  configuration_source TEXT,
  configuration_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS creator_stack_resource_bindings (
  stack_id TEXT NOT NULL REFERENCES creator_stacks(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id),
  mode TEXT NOT NULL CHECK(mode IN ('own','shared')),
  PRIMARY KEY(stack_id, instance_id)
);
CREATE TABLE IF NOT EXISTS creator_resource_operations (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id),
  stack_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','stage','activate')),
  state TEXT NOT NULL CHECK(state IN ('pending','confirmed','unknown','refused')),
  source_revision TEXT NOT NULL,
  request_json TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS creator_resources_workspace ON creator_app_resources(workspace_id);
CREATE INDEX IF NOT EXISTS creator_resource_operations_pending ON creator_resource_operations(resource_id,state);

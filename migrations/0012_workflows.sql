-- Native deterministic recipes reuse Composer's existing workspace and source
-- operation records. No provider queue, scheduler or new execution service.
CREATE TABLE IF NOT EXISTS creator_workflow_recipes (
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  recipe TEXT NOT NULL CHECK(recipe IN ('release-summary','operation-attention')),
  revision INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  account_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(workspace_id,recipe)
);
CREATE TABLE IF NOT EXISTS creator_workflow_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  recipe TEXT NOT NULL CHECK(recipe IN ('release-summary','operation-attention')),
  event_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  recipe_revision INTEGER NOT NULL,
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK(synthetic IN (0,1)),
  state TEXT NOT NULL CHECK(state IN ('finished','needs-attention')),
  revision INTEGER NOT NULL DEFAULT 1,
  attempts INTEGER NOT NULL DEFAULT 1,
  steps_json TEXT NOT NULL,
  result_json TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,recipe,event_id)
);
CREATE INDEX IF NOT EXISTS creator_workflow_history ON creator_workflow_runs(workspace_id,created_at);

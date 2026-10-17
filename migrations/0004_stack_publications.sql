-- Immutable stack publications and an atomic personal-workspace bootstrap
-- (#113). A published document is copied here by revision, so public metadata
-- always reads a snapshot that a later private draft cannot change. The
-- personal-workspace row is the database invariant that makes concurrent
-- bootstrap converge on one workspace; membership still allows a creator to
-- belong to further workspaces through explicit invitation.
CREATE TABLE IF NOT EXISTS creator_stack_publications (
  stack_id TEXT NOT NULL REFERENCES creator_stacks(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  document_json TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stack_id, revision)
);

CREATE TABLE IF NOT EXISTS creator_personal_workspaces (
  user_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Creator workspaces, membership and saved stacks (#113/#114).
-- Stacks are Composer-owned documents: they reference mini-app instances by
-- route and configuration; they never copy app-owned records or media.
CREATE TABLE IF NOT EXISTS creator_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS creator_members (
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS creator_stacks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','published','archived')) DEFAULT 'draft',
  revision INTEGER NOT NULL DEFAULT 1,
  draft_json TEXT NOT NULL,
  published_json TEXT,
  published_revision INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS creator_stacks_workspace ON creator_stacks(workspace_id);

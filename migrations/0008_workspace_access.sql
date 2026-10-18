-- Collaboration stays inside the existing authenticated CMS boundary.
ALTER TABLE creator_workspaces ADD COLUMN access_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE creator_workspaces ADD COLUMN access_mutation TEXT;
ALTER TABLE creator_members ADD COLUMN display_name TEXT;
ALTER TABLE creator_members ADD COLUMN email TEXT;

CREATE TABLE creator_workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('editor','viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
  revision INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  accepted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT
);
CREATE UNIQUE INDEX creator_workspace_invitation_pending ON creator_workspace_invitations(workspace_id,email) WHERE status='pending';
CREATE INDEX creator_workspace_invitation_recipient ON creator_workspace_invitations(email,status);

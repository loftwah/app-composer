-- Reuse authenticated workspace membership. Grants never own or delete app data.
CREATE TABLE creator_app_grants (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL CHECK(issuer='https://composer.loftwah.com'),
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  app TEXT NOT NULL CHECK(app IN ('showcase','guestbook')),
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','maintain','publish','export','contribute','moderate')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(workspace_id,user_id) REFERENCES creator_members(workspace_id,user_id) ON DELETE CASCADE,
  UNIQUE(issuer,workspace_id,user_id,app,resource_id,action)
);
CREATE TABLE creator_app_access_audit (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  app TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('grant','revoke','dispatch','bind')),
  grant_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX creator_app_grants_member ON creator_app_grants(workspace_id,user_id,status);
CREATE INDEX creator_app_access_audit_workspace ON creator_app_access_audit(workspace_id,created_at);

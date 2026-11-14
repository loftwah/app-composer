-- Media Studio joins the existing member grant authority.
--
-- The independent studio is an installation, not a row in
-- creator_app_resources, so its resource id names the installation
-- ("studio-installation") and the action set is read/edit/generate/publish/admin.
-- Existing Showcase and Guestbook grants, revisions and audit rows are copied
-- unchanged. SQLite cannot widen a CHECK constraint in place, so the two
-- tables are rebuilt with every row preserved.

ALTER TABLE creator_app_grants RENAME TO creator_app_grants_old;

CREATE TABLE creator_app_grants (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL CHECK(issuer='https://composer.loftwah.com'),
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  app TEXT NOT NULL CHECK(app IN ('showcase','guestbook','media-studio')),
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','maintain','publish','export','contribute','moderate','read','edit','generate','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(workspace_id,user_id) REFERENCES creator_members(workspace_id,user_id) ON DELETE CASCADE,
  UNIQUE(issuer,workspace_id,user_id,app,resource_id,action)
);

INSERT INTO creator_app_grants (
  id,issuer,workspace_id,user_id,app,resource_id,action,status,revision,created_by,updated_at
)
SELECT
  id,issuer,workspace_id,user_id,app,resource_id,action,status,revision,created_by,updated_at
FROM creator_app_grants_old;

DROP TABLE creator_app_grants_old;

CREATE INDEX IF NOT EXISTS creator_app_grants_member ON creator_app_grants(workspace_id,user_id,status);
CREATE INDEX IF NOT EXISTS creator_app_grants_app ON creator_app_grants(workspace_id,app,resource_id);

ALTER TABLE creator_app_access_audit RENAME TO creator_app_access_audit_old;

CREATE TABLE creator_app_access_audit (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  app TEXT NOT NULL CHECK(app IN ('showcase','guestbook','media-studio')),
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('grant','revoke','dispatch','bind')),
  grant_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO creator_app_access_audit (
  id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision,created_at
)
SELECT
  id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision,created_at
FROM creator_app_access_audit_old;

DROP TABLE creator_app_access_audit_old;

CREATE INDEX IF NOT EXISTS creator_app_access_audit_workspace ON creator_app_access_audit(workspace_id,created_at);

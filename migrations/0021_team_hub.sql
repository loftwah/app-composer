-- Widen only the finite application discriminator. Preserve every existing
-- grant, revision, status, timestamp, issuer, membership FK and audit row.
CREATE TABLE creator_app_grants_team_hub (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL CHECK(issuer='https://composer.loftwah.com'),
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  app TEXT NOT NULL CHECK(app IN ('showcase','guestbook','team-hub')),
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','maintain','publish','export','contribute','moderate')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(workspace_id,user_id) REFERENCES creator_members(workspace_id,user_id) ON DELETE CASCADE,
  UNIQUE(issuer,workspace_id,user_id,app,resource_id,action)
);
INSERT INTO creator_app_grants_team_hub SELECT * FROM creator_app_grants;
DROP TABLE creator_app_grants;
ALTER TABLE creator_app_grants_team_hub RENAME TO creator_app_grants;
CREATE INDEX creator_app_grants_member ON creator_app_grants(workspace_id,user_id,status);

CREATE TABLE team_hub_spaces (
  scope TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment IN ('production','preview')),
  revision INTEGER NOT NULL DEFAULT 1,
  operation_id TEXT NOT NULL
);
CREATE TABLE team_hub_requests (
  scope TEXT NOT NULL REFERENCES team_hub_spaces(scope) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  assignee_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('open','in-progress','done')),
  attachment_json TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(scope,id)
);
CREATE TABLE team_hub_request_versions (
  scope TEXT NOT NULL,
  request_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(scope,request_id,revision),
  FOREIGN KEY(scope,request_id) REFERENCES team_hub_requests(scope,id) ON DELETE RESTRICT
);
CREATE TABLE team_hub_activity (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL REFERENCES team_hub_spaces(scope) ON DELETE RESTRICT,
  hub_revision INTEGER NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('enable','create','update','grant','revoke')),
  actor_id TEXT NOT NULL,
  request_id TEXT,
  member_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

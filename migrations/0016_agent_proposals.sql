-- Reviewable agent proposals for one workspace, app and isolated environment.
-- A grant is proposal-only: it can never approve, deploy or change access.
-- Acceptance records a decision; execution is a separate handoff for the
-- existing authorised release flow and is not implemented here.
CREATE TABLE IF NOT EXISTS creator_agent_grants (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  app TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  environment_kind TEXT NOT NULL CHECK(environment_kind IN ('local','preview')),
  account_id TEXT NOT NULL,
  role_pack TEXT NOT NULL CHECK(role_pack IN ('service-owner','programmer','architect','devops','security','qa')),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  fallback_id TEXT NOT NULL,
  fallback_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode='proposal-only') DEFAULT 'proposal-only',
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  issued_by TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  revoke_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS creator_agent_grants_scope ON creator_agent_grants(workspace_id,app,environment_id,role_pack,agent_id);

CREATE TABLE IF NOT EXISTS creator_agent_briefings (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL REFERENCES creator_agent_grants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  app TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  role_pack TEXT NOT NULL,
  role_pack_version TEXT NOT NULL,
  as_of TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  content_json TEXT NOT NULL,
  digest TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(grant_id,digest)
);

CREATE TABLE IF NOT EXISTS creator_agent_proposals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  app TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  environment_kind TEXT NOT NULL CHECK(environment_kind IN ('local','preview')),
  account_id TEXT NOT NULL,
  role_pack TEXT NOT NULL,
  role_pack_version TEXT NOT NULL,
  briefing_id TEXT NOT NULL REFERENCES creator_agent_briefings(id),
  briefing_digest TEXT NOT NULL,
  grant_id TEXT NOT NULL REFERENCES creator_agent_grants(id),
  proposer_id TEXT NOT NULL,
  proposer_name TEXT NOT NULL,
  proposer_key TEXT NOT NULL,
  current_version INTEGER NOT NULL CHECK(current_version > 0),
  digest TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('submitted','changes-requested','rejected','accepted')),
  accepted_digest TEXT,
  accepted_version INTEGER,
  accepted_by_id TEXT,
  accepted_by_name TEXT,
  accepted_at TEXT,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((state='accepted') = (accepted_digest IS NOT NULL)),
  CHECK(accepted_digest IS NULL OR accepted_version = current_version)
);
CREATE INDEX IF NOT EXISTS creator_agent_proposals_scope ON creator_agent_proposals(workspace_id,state,updated_at);

CREATE TABLE IF NOT EXISTS creator_agent_proposal_versions (
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES creator_agent_proposals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK(version > 0),
  digest TEXT NOT NULL,
  source_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  risk TEXT NOT NULL CHECK(risk IN ('low','medium','high')),
  change_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY(proposal_id,version),
  UNIQUE(workspace_id,digest)
);

CREATE TABLE IF NOT EXISTS creator_agent_proposal_reviews (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES creator_agent_proposals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  digest TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('accept','request-changes','reject')),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(proposal_id,version)
);

CREATE TABLE IF NOT EXISTS creator_agent_proposal_handoffs (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES creator_agent_proposals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  digest TEXT NOT NULL,
  destination TEXT NOT NULL CHECK(destination IN ('existing-release-flow','existing-delivery-flow')),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  artifact_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state='prepared') DEFAULT 'prepared',
  execution TEXT NOT NULL CHECK(execution='not-performed') DEFAULT 'not-performed',
  created_at TEXT NOT NULL,
  UNIQUE(proposal_id,version)
);

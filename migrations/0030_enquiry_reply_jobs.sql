-- One reply job per exact retained brief. Composer owns the reply draft and its
-- approval/export receipt; Guestbook still owns the enquiry body and the reply
-- consent. No recipient address is stored here: only its digest, used to prove
-- that an approval still belongs to the consented address.
CREATE TABLE IF NOT EXISTS creator_enquiry_reply_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES creator_app_resources(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_revision INTEGER NOT NULL CHECK(item_revision > 0),
  source_digest TEXT NOT NULL,
  account_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  target TEXT NOT NULL,
  consent_version INTEGER NOT NULL CHECK(consent_version = 2),
  consent_at TEXT NOT NULL,
  consent_expires_at TEXT NOT NULL,
  recipient_digest TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('draft','approved','exported','invalidated','declined')),
  generator TEXT NOT NULL CHECK(generator IN ('owner','agent')),
  generator_id TEXT NOT NULL DEFAULT '',
  draft_body TEXT NOT NULL DEFAULT '',
  draft_digest TEXT NOT NULL DEFAULT '',
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK(draft_revision >= 0),
  approval_id TEXT,
  approval_digest TEXT,
  approved_by TEXT,
  approved_at TEXT,
  approval_expires_at TEXT,
  exported_at TEXT,
  reason TEXT NOT NULL DEFAULT '',
  actor_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id,resource_id,item_id,account_id,environment)
);
CREATE INDEX IF NOT EXISTS creator_enquiry_reply_state ON creator_enquiry_reply_jobs(workspace_id,state,updated_at);

-- The timeline is append-only and deliberately small: no body copy, no address
-- and no provider identifier. An exported event is unique per approval, so a
-- replayed export can never record a second handoff.
CREATE TABLE IF NOT EXISTS creator_enquiry_reply_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES creator_enquiry_reply_jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('draft','approved','exported','invalidated','declined')),
  draft_revision INTEGER NOT NULL,
  digest TEXT NOT NULL,
  approval_id TEXT,
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS creator_enquiry_reply_timeline ON creator_enquiry_reply_events(job_id,at);
CREATE UNIQUE INDEX IF NOT EXISTS creator_enquiry_reply_export_once ON creator_enquiry_reply_events(job_id,approval_id) WHERE kind='exported' AND approval_id IS NOT NULL;

-- Private, bounded action aggregates. App content and visitor identity stay out.
CREATE TABLE creator_outcome_settings (
  stack_id TEXT PRIMARY KEY REFERENCES creator_stacks(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  traffic_mode TEXT NOT NULL DEFAULT 'unclassified' CHECK(traffic_mode IN ('unclassified','demo')),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A verified pre-dispatch state is bound to one exact existing app operation.
-- It never asserts success; only a confirmed journal receipt can be counted.
CREATE TABLE creator_outcome_intents (
  operation_id TEXT PRIMARY KEY REFERENCES creator_resource_operations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  stack_id TEXT NOT NULL REFERENCES creator_stacks(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('postcard_approved','postcard_hidden','postcard_deleted')),
  expected_version INTEGER NOT NULL CHECK(expected_version>=0),
  request_digest TEXT NOT NULL CHECK(length(request_digest)=64),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- An opaque token belongs to one activation/operation, never to a visitor.
-- A fresh write nonce makes the aggregate conditional on this insertion.
CREATE TABLE creator_outcome_receipts (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL CHECK(length(day)=10),
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  stack_id TEXT NOT NULL REFERENCES creator_stacks(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('app_open_action','postcard_approved','postcard_hidden','postcard_deleted')),
  interaction TEXT NOT NULL CHECK(interaction IN ('keyboard','touch','pointer','server')),
  disposition TEXT NOT NULL CHECK(disposition IN ('same_tab','new_tab','none')),
  traffic TEXT NOT NULL CHECK(traffic IN ('unclassified','demo')),
  publication_revision INTEGER,
  write_nonce TEXT NOT NULL
);
CREATE INDEX creator_outcome_receipts_retention ON creator_outcome_receipts(day);
CREATE INDEX creator_outcome_intents_retention ON creator_outcome_intents(created_at);

CREATE TABLE creator_outcome_daily (
  day TEXT NOT NULL CHECK(length(day)=10),
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  stack_id TEXT NOT NULL REFERENCES creator_stacks(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('app_open_action','postcard_approved','postcard_hidden','postcard_deleted')),
  interaction TEXT NOT NULL CHECK(interaction IN ('keyboard','touch','pointer','server')),
  disposition TEXT NOT NULL CHECK(disposition IN ('same_tab','new_tab','none')),
  traffic TEXT NOT NULL CHECK(traffic IN ('unclassified','demo')),
  n INTEGER NOT NULL CHECK(n BETWEEN 1 AND 1000),
  PRIMARY KEY(day,workspace_id,stack_id,instance_id,event,interaction,disposition,traffic)
);
CREATE INDEX creator_outcome_daily_workspace ON creator_outcome_daily(workspace_id,day,stack_id);
CREATE INDEX creator_outcome_daily_retention ON creator_outcome_daily(day);
CREATE INDEX creator_publications_time ON creator_stack_publications(published_at,stack_id);

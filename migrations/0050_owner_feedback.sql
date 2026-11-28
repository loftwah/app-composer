CREATE TABLE composer_owner_feedback (
  owner_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  kind TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  note TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, event_id),
  UNIQUE (owner_id, thread_id, revision)
);

CREATE INDEX composer_owner_feedback_targets
  ON composer_owner_feedback(owner_id, json_extract(context, '$.key'), created_at)
  WHERE revision = 1;

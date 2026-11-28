CREATE TABLE composer_decision_briefs (
  owner_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  brief TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, decision_id)
);

CREATE TABLE composer_decision_responses (
  owner_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  selected TEXT NOT NULL,
  note TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, decision_id, revision)
);

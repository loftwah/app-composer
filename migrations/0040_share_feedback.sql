-- Private creative feedback scoped to the signed-in actor and exact asset bytes.
CREATE TABLE composer_share_feedback (
  actor_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_revision TEXT NOT NULL,
  asset_title TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  vote TEXT NOT NULL CHECK(vote IN ('up', 'down')),
  reasons TEXT NOT NULL,
  note TEXT NOT NULL CHECK(length(note) <= 1000),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(actor_id, asset_id, asset_revision)
) WITHOUT ROWID;

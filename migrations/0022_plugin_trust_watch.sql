-- Owner-controlled Plugin Trust watch. The default row is disabled; nothing
-- runs until the owner enables it from the native Trust Centre. Observations
-- and review items are read-only evidence, never an install or update record.
CREATE TABLE IF NOT EXISTS composer_plugin_trust_watch (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  last_run_at TEXT,
  last_state TEXT NOT NULL DEFAULT 'never' CHECK(last_state IN ('never','ok','partial','failed')),
  last_error TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS composer_plugin_trust_reviews (
  review_key TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  slug TEXT NOT NULL,
  version TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('review','block')),
  code TEXT NOT NULL,
  detail TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS composer_plugin_trust_reviews_open ON composer_plugin_trust_reviews(state,severity,last_seen_at);

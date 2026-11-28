-- Public AppView observations belong to a single immutable provider receipt.
-- A baseline is a current measurement for an older receipt; it never
-- substitutes for a missed historical observation window.
CREATE TABLE creator_share_bluesky_observations (
  delivery_key TEXT NOT NULL REFERENCES creator_share_deliveries(idempotency_key) ON DELETE CASCADE,
  window_hours INTEGER NOT NULL CHECK(window_hours IN (0,24,72,168)),
  due_at TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  retry_at TEXT,
  lease_until TEXT,
  claim TEXT,
  attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 3),
  observed_at TEXT,
  likes INTEGER CHECK(likes >= 0),
  replies INTEGER CHECK(replies >= 0),
  reposts INTEGER CHECK(reposts >= 0),
  quotes INTEGER CHECK(quotes >= 0),
  last_failure TEXT CHECK(last_failure IS NULL OR last_failure IN ('appview_unavailable','post_missing','revision_changed')),
  failed_at TEXT,
  PRIMARY KEY(delivery_key, window_hours)
);
CREATE INDEX creator_share_bluesky_published_at
  ON creator_share_deliveries(published_at) WHERE state = 'published';

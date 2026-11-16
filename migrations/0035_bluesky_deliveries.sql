-- Durable Bluesky delivery receipts (#604, send slice). One row per share item
-- and exact approval revision. The unique idempotency key and the conditional
-- state transitions make claiming atomic, so two workers cannot send the same
-- approval. `rkey` is deterministic, so a retry targets the same record and a
-- timeout can be reconciled by reading that key instead of posting again.
--
-- This table stores public identity, a record key, provider AT URI/CID and a
-- native permalink. It deliberately has no password, app password, access JWT,
-- refresh token, encryption key or raw provider response column. `error_*`
-- values are fixed Composer codes/messages, never provider bodies.
CREATE TABLE IF NOT EXISTS creator_share_deliveries (
  idempotency_key TEXT PRIMARY KEY CHECK(length(idempotency_key) BETWEEN 20 AND 200),
  item_id TEXT NOT NULL REFERENCES creator_share_calendar_items(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel = 'bluesky'),
  approval_revision INTEGER NOT NULL CHECK(approval_revision > 0),
  account_handle TEXT NOT NULL CHECK(length(account_handle) BETWEEN 3 AND 253),
  account_did TEXT NOT NULL CHECK(length(account_did) BETWEEN 8 AND 256),
  binding_hash TEXT NOT NULL CHECK(length(binding_hash) = 64),
  text_hash TEXT NOT NULL CHECK(length(text_hash) = 64),
  rkey TEXT NOT NULL CHECK(length(rkey) BETWEEN 1 AND 512),
  state TEXT NOT NULL CHECK(state IN (
    'approved','sending','published','failed','unknown','cancelled','needs_auth'
  )),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 10),
  provider_uri TEXT CHECK(provider_uri IS NULL OR length(provider_uri) <= 1024),
  provider_cid TEXT CHECK(provider_cid IS NULL OR length(provider_cid) <= 256),
  permalink TEXT CHECK(permalink IS NULL OR length(permalink) <= 1024),
  error_code TEXT NOT NULL DEFAULT '' CHECK(length(error_code) <= 80),
  error_message TEXT NOT NULL DEFAULT '' CHECK(length(error_message) <= 280),
  claimed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(item_id, approval_revision),
  CHECK(state <> 'sending' OR claimed_at IS NOT NULL),
  CHECK(state <> 'published' OR (
    provider_uri IS NOT NULL AND provider_cid IS NOT NULL AND
    permalink IS NOT NULL AND published_at IS NOT NULL
  )),
  CHECK(state NOT IN ('failed','needs_auth','unknown') OR error_code <> '')
);
CREATE INDEX IF NOT EXISTS creator_share_deliveries_item
  ON creator_share_deliveries(workspace_id, item_id, approval_revision);
CREATE INDEX IF NOT EXISTS creator_share_deliveries_state
  ON creator_share_deliveries(workspace_id, state);

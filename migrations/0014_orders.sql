-- Shared commerce receipts. This release's native controls create fictional
-- fixtures only; provider adapters and authenticated webhooks remain separate.
CREATE TABLE IF NOT EXISTS creator_orders (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  creation_key TEXT NOT NULL,
  installation_account TEXT NOT NULL,
  installation_environment TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL CHECK(provider IN ('stripe','paypal','shopify')),
  provider_account TEXT NOT NULL,
  payment_environment TEXT NOT NULL CHECK(payment_environment IN ('fixture','test','live')),
  proof TEXT NOT NULL CHECK(proof IN ('fixture','sandbox','production')),
  payment_state TEXT NOT NULL,
  order_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id,creation_key)
);
CREATE INDEX IF NOT EXISTS creator_orders_scope ON creator_orders(workspace_id,provider,payment_state);
CREATE TABLE IF NOT EXISTS creator_order_events (
  operation TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES creator_orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  digest TEXT NOT NULL,
  event_json TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(workspace_id,operation)
);
CREATE TABLE IF NOT EXISTS creator_order_actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES creator_orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('create-checkout','prepare-fulfilment')),
  state TEXT NOT NULL CHECK(state IN ('prepared','unknown','succeeded','failed')),
  provider_reference TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id,kind)
);

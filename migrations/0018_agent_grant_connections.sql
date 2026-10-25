-- One narrowly scoped, revocable connection credential per agent grant.
--
-- The raw credential is shown once to the owner. Only its SHA-256 hash and a
-- short display prefix are stored here, so reading the database does not yield
-- a usable credential. Emitting, rotating or revoking it changes no EmDash
-- session, Cloudflare Access policy, Cloudflare API token or Git credential:
-- this is the agent's own proposal-only credential and nothing else.
ALTER TABLE creator_agent_grants ADD COLUMN connection_hash TEXT;
ALTER TABLE creator_agent_grants ADD COLUMN connection_prefix TEXT;
ALTER TABLE creator_agent_grants ADD COLUMN connection_issued_at TEXT;
ALTER TABLE creator_agent_grants ADD COLUMN connection_last_used_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS creator_agent_grants_connection
  ON creator_agent_grants(connection_hash)
  WHERE connection_hash IS NOT NULL;

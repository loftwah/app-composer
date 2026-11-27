CREATE TABLE composer_spin_sessions (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  seed TEXT NOT NULL,
  config TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  commitment TEXT NOT NULL,
  rounds TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'abandoned')),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX composer_spin_expiry ON composer_spin_sessions(expires_at);

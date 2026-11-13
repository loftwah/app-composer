-- Media capability: one per-workspace switch and the owned jobs it produced.
-- Enabled state, the authorised host and the last verified model catalogue are
-- one row; jobs keep their request identity so a retry can never buy a second
-- generation for the same intent.
CREATE TABLE IF NOT EXISTS media_capability (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  host TEXT NOT NULL DEFAULT '',
  installation TEXT NOT NULL DEFAULT 'prints',
  models_json TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS media_jobs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  state TEXT NOT NULL CHECK (
    state IN ('intent', 'pending', 'completed', 'failed', 'refused', 'unknown')
  ),
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  reference_path TEXT,
  cost_milliunits INTEGER NOT NULL DEFAULT 0,
  output_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  imported_key TEXT,
  imported_sha256 TEXT,
  imported_bytes INTEGER,
  imported_format TEXT,
  created_by TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS media_jobs_created ON media_jobs (created_at DESC);

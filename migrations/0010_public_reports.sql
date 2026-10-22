-- Frozen public analytics snapshots. Only aggregate, already-public measures
-- are stored: app identity, signal, period, daily counts and coverage.
-- No visitor, enquiry, workspace, stack or private record is referenced.
CREATE TABLE IF NOT EXISTS composer_reports (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS composer_reports_created ON composer_reports(created_at);

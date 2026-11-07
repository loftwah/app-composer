-- Owner-recorded delivery-run receipts. A row is bounded evidence supplied by
-- a real journey run; it never approves a release, changes a deployment or
-- stores command output, logs, tokens or credentials. The newest 20 are kept.
CREATE TABLE IF NOT EXISTS composer_delivery_runs (
  id TEXT PRIMARY KEY,
  runner TEXT NOT NULL CHECK(runner IN ('local','jenkins','gitlab','buildkite','azure-pipelines','circleci','codebuild','other')),
  mode TEXT NOT NULL CHECK(mode IN ('local','candidate','release','verify')),
  state TEXT NOT NULL CHECK(state IN ('passed','failed','refused')),
  run_id TEXT,
  run_url TEXT,
  repository TEXT,
  branch TEXT,
  commit_sha TEXT,
  worker TEXT,
  account TEXT,
  environment TEXT,
  origin TEXT,
  artefact_digest TEXT,
  artefact_files INTEGER,
  candidate_digest TEXT,
  release_performed INTEGER NOT NULL DEFAULT 0 CHECK(release_performed IN (0,1)),
  verification_performed INTEGER NOT NULL DEFAULT 0 CHECK(verification_performed IN (0,1)),
  generated_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  receipt_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS composer_delivery_runs_recent ON composer_delivery_runs(recorded_at DESC);

-- Benchmarks Studio public review record (#601): append-only submissions.
--
-- The earlier table made (run_id, task_id, reviewer_label) unique and updated
-- that row on a later vote. A live media review showed the consequence: a blind
-- vote at 11:08 was silently overwritten at 11:55 by a considered vote under the
-- same self-declared label, and the first observation disappeared. A public
-- benchmark record cannot rewrite history.
--
-- This migration is additive to the evidence: every earlier row is preserved
-- with its choice, reason, timestamps and label. Each row also gains a
-- submission id and a reviewer token. The browser token did not exist before
-- this migration, so an earlier row receives a random server-generated token
-- that no browser has ever held: the old row is preserved but cannot be
-- restored as "this browser's vote". New rows carry the token the browser
-- sends. The token is not an identity; the label stays a self-declared display
-- label.
--
-- There is deliberately no UNIQUE constraint on (run, task, reviewer): the same
-- browser token may submit twice and both observations stay visible.
CREATE TABLE IF NOT EXISTS benchmark_votes_append (
  submission_id TEXT NOT NULL UNIQUE CHECK(length(submission_id) BETWEEN 8 AND 64),
  run_id TEXT NOT NULL CHECK(length(run_id) BETWEEN 1 AND 80),
  task_id TEXT NOT NULL CHECK(length(task_id) BETWEEN 1 AND 64),
  pair_id TEXT NOT NULL CHECK(length(pair_id) BETWEEN 1 AND 32),
  trial_a TEXT NOT NULL CHECK(length(trial_a) BETWEEN 1 AND 80),
  trial_b TEXT NOT NULL CHECK(length(trial_b) BETWEEN 1 AND 80),
  choice TEXT NOT NULL CHECK(choice IN ('a','b','tie','cant-tell','revealed')),
  reason TEXT NOT NULL DEFAULT '' CHECK(length(reason) <= 240),
  reasons_json TEXT NOT NULL DEFAULT '[]'
    CHECK(json_valid(reasons_json) AND json_type(reasons_json) = 'array' AND length(reasons_json) <= 1024),
  blind INTEGER NOT NULL CHECK(blind IN (0,1)),
  reviewer_label TEXT NOT NULL DEFAULT 'visitor' CHECK(length(reviewer_label) BETWEEN 1 AND 32),
  reviewer_token TEXT NOT NULL CHECK(length(reviewer_token) BETWEEN 32 AND 64),
  reviewer_token_hash TEXT NOT NULL CHECK(length(reviewer_token_hash) = 64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(choice <> 'revealed' OR blind = 0)
);

-- One materialised legacy row per old vote, so each row gets one random token
-- and one unrelated random hash. The old table had one row per reviewer; all of
-- them are carried over, including rows the old API had already overwritten in
-- place (those earlier values are unrecoverable and are not invented here).
-- The hash is not derived from the token because SQLite has no SHA-256 here;
-- the token was never issued to a browser, so the row cannot be claimed, and
-- publishing the unrelated hash never publishes the stored token.
WITH legacy AS MATERIALIZED (
  SELECT *,
         lower(hex(randomblob(32))) AS generated_token,
         lower(hex(randomblob(16))) || lower(hex(randomblob(16))) AS generated_hash
  FROM benchmark_votes
)
INSERT INTO benchmark_votes_append
  (submission_id, run_id, task_id, pair_id, trial_a, trial_b, choice, reason,
   reasons_json, blind, reviewer_label, reviewer_token, reviewer_token_hash,
   created_at, updated_at)
SELECT
  id, run_id, task_id, pair_id, trial_a, trial_b, choice, reason,
  '[]', blind, reviewer_label, generated_token, generated_hash,
  created_at, updated_at
FROM legacy;

DROP TABLE benchmark_votes;
ALTER TABLE benchmark_votes_append RENAME TO benchmark_votes;

CREATE INDEX IF NOT EXISTS benchmark_votes_run
  ON benchmark_votes(run_id, created_at ASC);
CREATE INDEX IF NOT EXISTS benchmark_votes_pair
  ON benchmark_votes(run_id, pair_id, created_at ASC);
CREATE INDEX IF NOT EXISTS benchmark_votes_token
  ON benchmark_votes(run_id, reviewer_token_hash);

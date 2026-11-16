-- Benchmarks Studio blind review (#601). The comparison record itself is a
-- committed JSON file; this table holds only the reviewer's durable choice.
--
-- One vote per (run, task, reviewer) is deliberate: a reviewer has one recorded
-- position on a run. A later vote updates that record and the API says whether
-- the earlier pair was replaced. `blind` is 1 only when the reviewer chose
-- before seeing the labels; revealing without choosing forces it to 0, and a
-- record that has been unblinded cannot become blind again.
--
-- The reviewer label is self-declared and unauthenticated. The default is
-- 'visitor', never 'owner': a public POST cannot claim the owner's judgement.
-- The page and run record must keep saying that a label is not a verified
-- identity and a vote count is not proof of who voted.
CREATE TABLE IF NOT EXISTS benchmark_votes (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL CHECK(length(run_id) BETWEEN 1 AND 80),
  task_id TEXT NOT NULL CHECK(length(task_id) BETWEEN 1 AND 64),
  pair_id TEXT NOT NULL CHECK(length(pair_id) BETWEEN 1 AND 32),
  trial_a TEXT NOT NULL CHECK(length(trial_a) BETWEEN 1 AND 80),
  trial_b TEXT NOT NULL CHECK(length(trial_b) BETWEEN 1 AND 80),
  choice TEXT NOT NULL CHECK(choice IN ('a','b','tie','cant-tell','revealed')),
  reason TEXT NOT NULL DEFAULT '' CHECK(length(reason) <= 240),
  blind INTEGER NOT NULL CHECK(blind IN (0,1)),
  reviewer_label TEXT NOT NULL DEFAULT 'visitor' CHECK(length(reviewer_label) BETWEEN 1 AND 32),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (run_id, task_id, reviewer_label),
  CHECK(choice <> 'revealed' OR blind = 0)
);
CREATE INDEX IF NOT EXISTS benchmark_votes_run
  ON benchmark_votes(run_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS benchmark_votes_pair
  ON benchmark_votes(run_id, pair_id);

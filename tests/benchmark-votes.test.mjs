// The Benchmarks Studio public review record's own proof.
//
// 1. The pre-vote state names no configuration, model, harness, trial or static
//    preview path. The forbidden list comes from the real committed record.
// 2. The pair mapping is stable and its URLs are opaque.
// 3. Submission validation refuses an unknown run/task/pair, HTML, long text, a
//    bad reviewer label, a bad browser token, too many chips and a cross-run
//    pair. An omitted label is the unauthenticated visitor; only a same-origin
//    POST may write.
// 4. D1 is append-only: two submissions with the same token and label are two
//    rows, and both appear in the export in creation order.
// 5. The migration from 0033 preserves every existing row with a submission id
//    and a generated token.
// 6. A reason and its chips persist and are shown in the record.
// 7. Export and reopen share one shape, ordered by createdAt, with the token
//    hash and never the raw token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  appendVote,
  buildRunEvidence,
  blindView,
  DEFAULT_REVIEWER_LABEL,
  exportFilename,
  forbiddenIdentityTokens,
  getRunRecord,
  hashReviewerToken,
  independentTokenCount,
  listVotes,
  listVotesForToken,
  pairFor,
  pairTallies,
  pairsFor,
  renderBlindPairGrid,
  revealPair,
  runView,
  runIdFor,
  validateVote,
  voteOriginAllowed,
} from '../src/lib/benchmark-runs.ts';
import { mediaBlindView, mediaRunView } from '../src/lib/benchmark-media.mjs';
import { sqliteD1, migration } from './helpers/stacks-sqlite.mjs';

const compare = JSON.parse(
  readFileSync(new URL('../benchmarks/results/compare.json', import.meta.url), 'utf8'),
);
const mediaRecord = JSON.parse(
  readFileSync(new URL('../benchmarks/media/run.json', import.meta.url), 'utf8'),
);
const found = getRunRecord();
assert.ok(found, 'the committed run must be present');

const TOKEN = 'a1'.repeat(32);
const OTHER_TOKEN = 'b2'.repeat(32);

function database({ migrate = true } = {}) {
  const db = sqliteD1({ schema: migration('0033_benchmark_votes.sql') });
  try {
    if (migrate) db.migrate(migration('0036_benchmark_votes_append.sql'));
  } catch (error) {
    db.cleanup();
    throw error;
  }
  return db;
}

function voteBody(overrides = {}) {
  const pair = pairsFor(found.record)[0];
  return {
    run: found.id,
    task: found.record.task.id,
    pair: pair.id,
    choice: 'a',
    reason: 'The page holds together at 390px.',
    chips: ['A: holds the still'],
    blind: true,
    token: TOKEN,
    ...overrides,
  };
}

test('the pre-vote state contains no recorded configuration identity', () => {
  const view = blindView(found.record);
  const html = renderBlindPairGrid(view);
  const state = `${JSON.stringify(view)}\n${html}`.toLowerCase();

  const forbidden = new Set(forbiddenIdentityTokens(found.record));
  for (const configuration of compare.configurations) {
    for (const value of [
      configuration.id,
      configuration.label,
      configuration.model,
      configuration.resolvedModel,
      configuration.harness,
      configuration.harnessVersion,
    ]) {
      if (typeof value === 'string' && value.trim().length >= 3) forbidden.add(value.trim());
    }
    for (const trial of configuration.trials ?? []) {
      forbidden.add(trial.id);
      forbidden.add(trial.previewUrl);
    }
  }
  for (const token of forbidden) {
    assert.equal(
      state.includes(token.toLowerCase()),
      false,
      `the pre-vote state must not contain ${JSON.stringify(token)}`,
    );
  }
  assert.doesNotMatch(state, /\/benchmarks\/trials\//);
  assert.doesNotMatch(html, /data-trial\b|data-configuration\b|data-model\b|data-harness\b/);
  assert.match(html, /data-recorded-preview/);
  for (const pair of view.pairs) {
    for (const side of pair.sides) {
      assert.match(side.previewHtml, /^\/benchmarks\/preview\/[^/]+\/p\d{2}\/[ab]\/index\.html$/);
      assert.ok(!side.previewHtml.includes('gpt'), 'a preview URL cannot name a model');
    }
  }
});

test('the committed preview files do not name their own configuration', () => {
  const forbidden = forbiddenIdentityTokens(found.record).map((token) => token.toLowerCase());
  for (const configuration of compare.configurations) {
    for (const trial of configuration.trials ?? []) {
      const base = trial.previewUrl.replace(/index\.html$/, '');
      for (const asset of ['index.html', 'app.css', 'app.json']) {
        const body = readFileSync(
          new URL(`../public${base}${asset}`, import.meta.url),
          'utf8',
        ).toLowerCase();
        for (const token of forbidden) {
          if (!token.startsWith('/benchmarks/trials/'))
            assert.equal(
              body.includes(token),
              false,
              `${trial.id} ${asset} must not contain ${JSON.stringify(token)}`,
            );
        }
      }
    }
  }
});

test('the compare page source has no second route that names a configuration', () => {
  const page = readFileSync(
    new URL('../src/pages/benchmarks/compare.astro', import.meta.url),
    'utf8',
  );
  for (const configuration of compare.configurations) {
    for (const value of [
      configuration.id,
      configuration.label,
      configuration.model,
      configuration.resolvedModel,
      configuration.harness,
    ]) {
      if (typeof value === 'string' && value.trim().length >= 3)
        assert.equal(
          page.toLowerCase().includes(value.toLowerCase()),
          false,
          `compare.astro must not hardcode ${JSON.stringify(value)}`,
        );
    }
  }
  assert.doesNotMatch(page, /\/benchmarks\/trials\//);
  assert.doesNotMatch(page, /\/benchmarks\/runs\//, 'the blind page must not pre-render the revealed run link');
  assert.doesNotMatch(page, /configuration\.label|configuration\.model|trial\.model|trial\.harness|previewUrl/);
});

test('pair and side order is stable, opaque and derived from the run', () => {
  const pairs = pairsFor(found.record);
  assert.equal(pairs.length, 9);
  assert.deepEqual(
    pairs.map((pair) => pair.id),
    ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09'],
  );
  assert.deepEqual(
    pairsFor(found.record).map((pair) => [pair.trialA.id, pair.trialB.id]),
    pairs.map((pair) => [pair.trialA.id, pair.trialB.id]),
  );
  for (const pair of pairs) {
    assert.notEqual(pair.trialA.configurationId, pair.trialB.configurationId);
    assert.equal(pairFor(found.record, pair.id)?.id, pair.id);
    assert.equal(revealPair(found.record, pair.id)?.pairId, pair.id);
    assert.ok(pair.id.length <= 3, 'the pair id only names the pair');
  }
  assert.equal(pairFor(found.record, 'p99'), null);
  const first = revealPair(found.record, 'p01');
  assert.ok(first);
  const untimed = first.sides.find((side) => side.durationMs === null);
  assert.ok(untimed, 'an ingested trial with no recorded duration stays unknown, not 0ms');
  assert.equal(untimed.durationMs, null);
});

test('submission validation refuses unknown records, unsafe text and a bad token', () => {
  assert.equal(validateVote(found.record, voteBody({ run: 'not-a-run' })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ task: 'another-task' })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ pair: 'p99' })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ choice: 'winner' })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ reason: '<b>looks good</b>' })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ reason: 'x'.repeat(241) })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ reviewer: 'owner<script>' })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ reviewer: 'x'.repeat(33) })).ok, false);
  assert.equal(
    validateVote(found.record, voteBody({ trialA: 'invented-trial' })).ok,
    false,
    'the API resolves trial ids itself; a supplied trial is an unknown field',
  );

  for (const token of [undefined, '', 'xyz', 'a'.repeat(31), 'a'.repeat(65), 'g'.repeat(64)]) {
    assert.equal(
      validateVote(found.record, voteBody({ token })).ok,
      false,
      `token ${String(token)} must be refused`,
    );
  }
  assert.equal(validateVote(found.record, voteBody({ chips: 'A: holds the still' })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ chips: ['x'.repeat(49)] })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ chips: ['A: <b>still</b>'] })).ok, false);
  assert.equal(validateVote(found.record, voteBody({ chips: ['A: one, B: two'] })).ok, false);
  assert.equal(
    validateVote(found.record, voteBody({ chips: Array.from({ length: 9 }, (_, index) => `chip ${index}`) })).ok,
    false,
  );
  assert.equal(
    validateVote(found.record, {
      run: found.id,
      task: found.record.task.id,
      pair: 'p01',
      choice: 'a',
      token: TOKEN,
      chips: ['A: comma, inside'],
    }).ok,
    false,
  );

  const crossRun = validateVote(found.record, {
    run: 'animate-a-still-v1-d20cbf5',
    task: 'animate-a-still',
    pair: 'p01',
    choice: 'a',
    token: TOKEN,
  });
  assert.equal(crossRun.ok, false, 'a media run cannot be written through the text run record');

  const valid = validateVote(found.record, voteBody());
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.runId, found.id);
    assert.equal(valid.value.taskId, found.record.task.id);
    assert.equal(valid.value.choice, 'a');
    assert.equal(valid.value.blind, true);
    assert.equal(valid.value.reviewerToken, TOKEN);
    assert.deepEqual(valid.value.reasons, ['A: holds the still']);
    assert.match(valid.value.trialA, /-t1$/);
    assert.match(valid.value.trialB, /-t1$/);
  }

  const revealed = validateVote(found.record, voteBody({ choice: 'revealed', blind: true }));
  assert.equal(revealed.ok, true);
  if (revealed.ok) assert.equal(revealed.value.blind, false, 'revealing without choosing is unblinded');
});

test('an omitted reviewer label is visitor, never a claimed owner', () => {
  assert.equal(DEFAULT_REVIEWER_LABEL, 'visitor');
  const omitted = validateVote(found.record, voteBody());
  assert.equal(omitted.ok, true);
  if (omitted.ok) assert.equal(omitted.value.reviewerLabel, 'visitor');
  const blank = validateVote(found.record, voteBody({ reviewer: '   ' }));
  assert.equal(blank.ok, true);
  if (blank.ok) assert.equal(blank.value.reviewerLabel, 'visitor');
  const supplied = validateVote(found.record, voteBody({ reviewer: 'owner' }));
  assert.equal(supplied.ok, true);
  if (supplied.ok) assert.equal(supplied.value.reviewerLabel, 'owner', 'a supplied label is kept, but it is not verified');
  const migrationText = migration('0033_benchmark_votes.sql');
  assert.match(migrationText, /reviewer_label TEXT NOT NULL DEFAULT 'visitor'/);
});

test('only a same-origin POST can write a submission', () => {
  const expected = 'https://composer.loftwah.com';
  assert.equal(voteOriginAllowed(expected, expected), true);
  assert.equal(voteOriginAllowed(null, expected), false, 'an absent Origin is refused');
  assert.equal(voteOriginAllowed(undefined, expected), false);
  assert.equal(voteOriginAllowed('', expected), false);
  assert.equal(voteOriginAllowed('https://evil.example', expected), false);
  const request = new Request(`${expected}/api/benchmark-votes`, { method: 'POST' });
  assert.equal(request.headers.get('Origin'), null);
  assert.equal(voteOriginAllowed(request.headers.get('Origin'), expected), false);

  const api = readFileSync(
    new URL('../src/pages/api/benchmark-votes.ts', import.meta.url),
    'utf8',
  );
  assert.match(api, /if \(!voteOriginAllowed\(request\.headers\.get\("Origin"\), origin\)\)/);
  assert.doesNotMatch(api, /suppliedOrigin/, 'the optional-origin bypass must stay removed');
  assert.match(api, /listVotesForToken/, 'the blind page only receives this token\'s rows');
  assert.match(api, /pairTallies/, 'other submissions are counted without labels or reveals');
  assert.doesNotMatch(api, /reviewer_label = \?/, 'a label must not unlock another browser\'s reveal');
});

test('the blind and run pages disclose unauthenticated submissions and the token', () => {
  const comparePage = readFileSync(
    new URL('../src/pages/benchmarks/compare.astro', import.meta.url),
    'utf8',
  );
  const runPage = readFileSync(
    new URL('../src/pages/benchmarks/runs/[id].astro', import.meta.url),
    'utf8',
  );
  const mediaPage = readFileSync(
    new URL('../src/pages/benchmarks/media.astro', import.meta.url),
    'utf8',
  );
  for (const page of [comparePage, mediaPage]) {
    assert.match(page, /Observations are unauthenticated/);
    assert.match(page, /not verified people/);
    assert.match(page, /localStorage/);
    assert.match(page, /Record another observation/);
    assert.match(page, /published only as a hash/);
  }
  assert.match(runPage, /unauthenticated label/);
  assert.match(runPage, /append-only/i);
  assert.match(runPage, /independent submission/);
});

test('the migration removes the old uniqueness rule and adds submission ids and tokens', () => {
  const text = migration('0036_benchmark_votes_append.sql');
  assert.doesNotMatch(text, /UNIQUE\s*\(run_id,\s*task_id,\s*reviewer_label\)/);
  assert.match(text, /submission_id TEXT NOT NULL UNIQUE/);
  assert.match(text, /reviewer_token TEXT NOT NULL/);
  assert.match(text, /reviewer_token_hash TEXT NOT NULL/);
  assert.match(text, /CREATE TABLE IF NOT EXISTS benchmark_votes_append/);
  assert.doesNotMatch(text, /\bDELETE\s+FROM\s+benchmark_votes\b/i);
});

test('two submissions with the same token and label are two rows', async () => {
  const db = database();
  try {
    const first = validateVote(found.record, voteBody({ choice: 'a' }));
    assert.ok(first.ok);
    const firstStore = await appendVote(db, first.value, new Date('2026-11-16T11:08:09Z'));
    assert.equal(firstStore.appended, true);
    assert.equal(firstStore.vote.choice, 'a');
    assert.equal(firstStore.vote.blind, true);

    const second = validateVote(
      found.record,
      voteBody({ choice: 'b', reason: 'B is smoother.', chips: ['B: smoother motion'] }),
    );
    assert.ok(second.ok);
    const secondStore = await appendVote(db, second.value, new Date('2026-11-16T11:55:35Z'));
    assert.equal(secondStore.appended, true);
    assert.notEqual(firstStore.vote.submissionId, secondStore.vote.submissionId);
    assert.equal(secondStore.vote.choice, 'b');
    assert.equal(
      JSON.stringify(firstStore).includes(TOKEN),
      false,
      'the write result never carries the raw browser token',
    );

    const rows = await listVotes(db, found.id);
    assert.equal(rows.length, 2, 'the same reviewer token and label keep both observations');
    assert.deepEqual(rows.map((row) => row.choice), ['a', 'b']);
    assert.deepEqual(
      rows.map((row) => row.createdAt),
      ['2026-11-16T11:08:09.000Z', '2026-11-16T11:55:35.000Z'],
    );
    assert.equal(rows[0].reason, 'The page holds together at 390px.');
    assert.deepEqual(rows[1].reasons, ['B: smoother motion']);
    assert.equal(rows[0].reviewerTokenHash, await hashReviewerToken(TOKEN));
    assert.equal(independentTokenCount(rows), 1);

    const evidence = buildRunEvidence(found.record, rows, { votesAvailable: true });
    assert.equal(evidence.votes.length, 2);
    assert.deepEqual(evidence.votes.map((vote) => vote.choice), ['a', 'b']);
    assert.deepEqual(evidence.votes.map((vote) => vote.submissionId), rows.map((row) => row.submissionId));

    const view = runView(evidence);
    assert.equal(view.sample.recordedPairs, 1);
    assert.equal(view.sample.submissions, 2);
    assert.equal(view.sample.independentTokens, 1);
    assert.equal(view.pairs[0].submissions.length, 2);
    assert.deepEqual(view.pairs[0].submissions.map((vote) => vote.choice), ['a', 'b']);

    const tallies = pairTallies(rows);
    assert.equal(tallies.length, 1);
    assert.equal(tallies[0].submissions.length, 2);
    assert.equal('reviewerLabel' in tallies[0].submissions[0], false);
  } finally {
    db.cleanup();
  }
});

test('the 0033 rows survive the migration with a submission id and token', async () => {
  const db = database({ migrate: false });
  try {
    await db
      .prepare(
        `INSERT INTO benchmark_votes
           (id, run_id, task_id, pair_id, trial_a, trial_b, choice, reason, blind, reviewer_label, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        '11111111-2222-4333-8444-555555555555',
        found.id,
        found.record.task.id,
        'p01',
        'take-01',
        'take-02',
        'b',
        'An earlier observation that must not disappear.',
        1,
        'visitor',
        '2026-11-16T09:00:00.000Z',
        '2026-11-16T09:00:00.000Z',
      )
      .run();
    db.migrate(migration('0036_benchmark_votes_append.sql'));
    const rows = await listVotes(db, found.id);
    assert.equal(rows.length, 1, 'the existing vote is preserved, not deleted');
    assert.equal(rows[0].submissionId, '11111111-2222-4333-8444-555555555555');
    assert.equal(rows[0].choice, 'b');
    assert.equal(rows[0].reason, 'An earlier observation that must not disappear.');
    assert.equal(rows[0].blind, true);
    assert.equal(rows[0].reviewerLabel, 'visitor');
    assert.equal(rows[0].createdAt, '2026-11-16T09:00:00.000Z');
    assert.deepEqual(rows[0].reasons, []);
    assert.match(rows[0].reviewerTokenHash, /^[0-9a-f]{64}$/);

    const raw = await db
      .prepare('SELECT reviewer_token, reviewer_token_hash FROM benchmark_votes')
      .first();
    assert.ok(raw);
    assert.match(String(raw.reviewer_token), /^[0-9a-f]{32,64}$/);
    assert.match(String(raw.reviewer_token_hash), /^[0-9a-f]{64}$/);
    assert.notEqual(raw.reviewer_token, raw.reviewer_token_hash, 'the published hash is not the token');
    assert.equal(raw.reviewer_token_hash, rows[0].reviewerTokenHash);
  } finally {
    db.cleanup();
  }
});

test('a reason and its selected chips persist and are shown in the record', async () => {
  const db = database();
  try {
    const valid = validateVote(
      found.record,
      voteBody({
        reason: 'B keeps the still; A has flicker.',
        chips: ['A: flicker or artifacts', 'B: holds the still'],
      }),
    );
    assert.ok(valid.ok);
    const stored = await appendVote(db, valid.value, new Date('2026-11-16T12:00:00Z'));
    assert.equal(stored.vote.reason, 'B keeps the still; A has flicker.');
    assert.deepEqual(stored.vote.reasons, ['A: flicker or artifacts', 'B: holds the still']);

    const [row] = await listVotes(db, found.id);
    assert.equal(row.reason, 'B keeps the still; A has flicker.');
    assert.deepEqual(row.reasons, ['A: flicker or artifacts', 'B: holds the still']);

    const evidence = buildRunEvidence(found.record, [row], { votesAvailable: true });
    const exported = JSON.parse(JSON.stringify(evidence));
    assert.equal(exported.votes[0].reason, 'B keeps the still; A has flicker.');
    assert.deepEqual(exported.votes[0].reasons, ['A: flicker or artifacts', 'B: holds the still']);

    const view = runView(evidence);
    assert.equal(view.pairs[0].submissions[0].reason, 'B keeps the still; A has flicker.');
    assert.deepEqual(view.pairs[0].submissions[0].reasons, ['A: flicker or artifacts', 'B: holds the still']);
  } finally {
    db.cleanup();
  }
});

test('a second observation on a revealed pair stays unblinded but is appended', async () => {
  const db = database();
  try {
    const reveal = validateVote(found.record, voteBody({ choice: 'revealed' }));
    assert.ok(reveal.ok);
    const storedReveal = await appendVote(db, reveal.value, new Date('2026-11-16T13:00:00Z'));
    assert.equal(storedReveal.vote.blind, false);

    const later = validateVote(found.record, voteBody({ choice: 'a', blind: true }));
    assert.ok(later.ok);
    const stored = await appendVote(db, later.value, new Date('2026-11-16T13:01:00Z'));
    assert.equal(stored.vote.blind, false, 'a revealed pair cannot become blind again');
    assert.equal(stored.vote.choice, 'a');
    assert.notEqual(stored.vote.submissionId, storedReveal.vote.submissionId);
    assert.equal((await listVotes(db, found.id)).length, 2, 'the reveal is retained alongside the later choice');

    const other = validateVote(found.record, voteBody({ token: OTHER_TOKEN, choice: 'b', blind: true }));
    assert.ok(other.ok);
    const otherStored = await appendVote(db, other.value, new Date('2026-11-16T13:02:00Z'));
    assert.equal(otherStored.vote.blind, true, 'another browser token is still blind');
    assert.equal((await listVotes(db, found.id)).length, 3);
  } finally {
    db.cleanup();
  }
});

test('the read path can be scoped to the browser token, not a label', async () => {
  const db = database();
  try {
    const first = validateVote(found.record, voteBody({ token: TOKEN, reviewer: 'owner', choice: 'a' }));
    const second = validateVote(found.record, voteBody({ token: OTHER_TOKEN, reviewer: 'owner', choice: 'b' }));
    assert.ok(first.ok && second.ok);
    await appendVote(db, first.value, new Date('2026-11-16T03:00:00Z'));
    await appendVote(db, second.value, new Date('2026-11-16T03:01:00Z'));
    assert.equal((await listVotes(db, found.id)).length, 2);

    const scoped = await listVotesForToken(db, found.id, TOKEN);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0].choice, 'a');
    assert.equal(scoped[0].reviewerLabel, 'owner');
    assert.equal((await listVotesForToken(db, found.id, 'c3'.repeat(32))).length, 0);
  } finally {
    db.cleanup();
  }
});

test('export is append-only, ordered, token-hashed and a real round trip', async () => {
  const db = database();
  try {
    const first = validateVote(found.record, voteBody({ choice: 'a' }));
    const second = validateVote(
      found.record,
      voteBody({ choice: 'b', reason: 'Second look.', chips: ['B: smoother motion'] }),
    );
    assert.ok(first.ok && second.ok);
    await appendVote(db, second.value, new Date('2026-11-16T02:01:00Z'));
    await appendVote(db, first.value, new Date('2026-11-16T02:00:00Z'));

    const votes = await listVotes(db, found.id);
    const evidence = buildRunEvidence(found.record, votes, { votesAvailable: true });
    assert.equal(evidence.schema, 'composer/benchmark-run-evidence/1');
    assert.equal(evidence.runId, found.id);
    assert.deepEqual(evidence.record, compare);
    assert.equal(evidence.votes.length, 2);
    assert.equal(evidence.votesAvailable, true);
    assert.deepEqual(
      evidence.votes.map((vote) => vote.createdAt),
      ['2026-11-16T02:00:00.000Z', '2026-11-16T02:01:00.000Z'],
      'export is ordered by createdAt, not insertion order',
    );
    for (const vote of evidence.votes) {
      assert.match(vote.submissionId, /^[0-9a-f-]{36}$/);
      assert.equal(vote.reviewerTokenHash, await hashReviewerToken(TOKEN));
      assert.equal(vote.reviewerLabel, 'visitor');
      assert.ok(Array.isArray(vote.reasons));
      assert.ok('blind' in vote && 'createdAt' in vote && 'updatedAt' in vote);
    }
    const serialised = JSON.stringify(evidence);
    assert.equal(serialised.includes(TOKEN), false, 'the raw browser token is not exported');
    assert.equal(serialised.includes('reviewer_token'), false);

    const pageView = runView(evidence);
    const reopened = runView(JSON.parse(serialised));
    assert.deepEqual(reopened, pageView);
    assert.equal(pageView.sample.recordedPairs, 1);
    assert.equal(pageView.sample.submissions, 2);
    assert.equal(pageView.sample.blindSubmissions, 2);
    assert.equal(pageView.pairs[0].submissions.length, 2);
    assert.equal(pageView.pairs[0].submissions[1].choice, 'b');
    assert.ok(pageView.pairs[0].sideA.configurationLabel);
    assert.ok(pageView.pairs[0].sideB.configurationLabel);
    assert.equal(pageView.provenance.recordFile, 'benchmarks/results/compare.json');
    assert.equal(exportFilename(found.id), `composer-benchmark-run-${found.id}.json`);
  } finally {
    db.cleanup();
  }
});

test('an unvoted pair exposes no model or provider identity; a recorded one reveals it', async () => {
  const blind = mediaBlindView(mediaRecord);
  const blindState = JSON.stringify(blind).toLowerCase();
  for (const configuration of mediaRecord.configurations) {
    for (const value of [
      configuration.model,
      configuration.resolvedModel,
      configuration.provider,
      configuration.harness,
      configuration.label,
    ]) {
      if (typeof value === 'string' && value.length >= 3) {
        assert.equal(blindState.includes(value.toLowerCase()), false, `blind state must not contain ${value}`);
      }
    }
  }

  const empty = mediaRunView(mediaRecord, [], { votesAvailable: true });
  assert.equal(empty.pairs[0].submissions.length, 0);

  const valid = validateVote(mediaRecord, {
    run: 'animate-a-still-v1-d20cbf5',
    task: 'animate-a-still',
    pair: 'p01',
    choice: 'a',
    reason: 'A holds the still.',
    chips: ['A: holds the still'],
    blind: true,
    token: TOKEN,
  });
  assert.ok(valid.ok);
  const vote = {
    submissionId: 'submission-1',
    runId: valid.value.runId,
    taskId: valid.value.taskId,
    pairId: valid.value.pairId,
    trialA: valid.value.trialA,
    trialB: valid.value.trialB,
    choice: valid.value.choice,
    reason: valid.value.reason,
    reasons: valid.value.reasons,
    blind: valid.value.blind,
    reviewerLabel: valid.value.reviewerLabel,
    reviewerTokenHash: await hashReviewerToken(TOKEN),
    createdAt: '2026-11-16T11:08:09.000Z',
    updatedAt: '2026-11-16T11:08:09.000Z',
  };
  const voted = mediaRunView(mediaRecord, [vote], { votesAvailable: true });
  assert.equal(voted.pairs[0].submissions.length, 1);
  assert.equal(voted.pairs[0].submissions[0].choice, 'a');
  assert.ok(voted.pairs[0].sideA.configurationLabel);
  assert.ok(voted.pairs[0].sideB.configurationLabel);

  const client = readFileSync(
    new URL('../src/browser/benchmark-media.ts', import.meta.url),
    'utf8',
  );
  assert.match(client, /if \(entry\) renderReveal\(pair, entry\)/);
  assert.match(client, /const entry = latestOwn\(pairId\)/);
  assert.match(client, /Record another observation/);
  assert.match(client, /crypto\.getRandomValues/);
  assert.doesNotMatch(client, /console\.(?:log|info|debug)/, 'the token is never logged');
});

test('absent fields render as unknown instead of being guessed', async () => {
  const record = { task: {}, configurations: [] };
  const evidence = buildRunEvidence(record, [], { votesAvailable: false });
  assert.equal(evidence.votesAvailable, false);
  const view = runView(evidence);
  assert.equal(view.task.title, 'unknown');
  assert.equal(view.task.version, 'unknown');
  assert.equal(view.task.briefSha256, 'unknown');
  assert.equal(view.recordedAt, null);
  assert.equal(view.sourceVersion, null);
  assert.equal(view.sample.pairs, 0);
  assert.equal(view.sample.submissions, 0);
  assert.match(view.verdict.headline, /No trials recorded yet/);
  assert.equal(runIdFor(record), 'unknown-vunknown-unrecorded');
});

test('the missing-run page returns a useful 404 rather than an empty run', () => {
  const page = readFileSync(
    new URL('../src/pages/benchmarks/runs/[id].astro', import.meta.url),
    'utf8',
  );
  assert.match(page, /Astro\.response\.status = 404/);
  assert.match(page, /That run is not recorded here\./);
  assert.match(page, /href="\/benchmarks\/compare"/);
});

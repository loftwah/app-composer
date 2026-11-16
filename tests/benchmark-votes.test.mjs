// The blind comparison's own proof.
//
// 1. The pre-vote state names no configuration, model, harness, trial or static
//    preview path. The forbidden list comes from the real committed record.
// 2. The pair mapping is stable and its URLs are opaque.
// 3. Vote validation refuses an unknown run/task/pair, HTML, long text and a
//    bad reviewer label. An omitted label is the unauthenticated visitor, and
//    only a same-origin POST may write.
// 4. The D1 record is one row per (run, task, reviewer) and reports an update.
// 5. Export has the same shape the run page reads, so export → reopen is a real
//    round trip rather than a second renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildRunEvidence,
  blindView,
  DEFAULT_REVIEWER_LABEL,
  exportFilename,
  forbiddenIdentityTokens,
  getRunRecord,
  listVotes,
  pairFor,
  pairsFor,
  recordVote,
  renderBlindPairGrid,
  revealPair,
  runView,
  runIdFor,
  validateVote,
  voteOriginAllowed,
} from '../src/lib/benchmark-runs.ts';
import { sqliteD1, migration } from './helpers/stacks-sqlite.mjs';

const compare = JSON.parse(
  readFileSync(new URL('../benchmarks/results/compare.json', import.meta.url), 'utf8'),
);
const found = getRunRecord();
assert.ok(found, 'the committed run must be present');

function database() {
  return sqliteD1({ schema: migration('0033_benchmark_votes.sql') });
}

function voteBody(overrides = {}) {
  const pair = pairsFor(found.record)[0];
  return {
    run: found.id,
    task: found.record.task.id,
    pair: pair.id,
    choice: 'a',
    reason: 'The page holds together at 390px.',
    blind: true,
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

test('vote validation refuses unknown records and unsafe text', () => {
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

  const valid = validateVote(found.record, voteBody());
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.runId, found.id);
    assert.equal(valid.value.taskId, found.record.task.id);
    assert.equal(valid.value.choice, 'a');
    assert.equal(valid.value.blind, true);
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
  assert.match(
    migration('0033_benchmark_votes.sql'),
    /reviewer_label TEXT NOT NULL DEFAULT 'visitor'/,
  );
});

test('only a same-origin POST can write a vote', () => {
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
});

test('the compare and run pages say the vote record is unauthenticated', () => {
  const comparePage = readFileSync(
    new URL('../src/pages/benchmarks/compare.astro', import.meta.url),
    'utf8',
  );
  const runPage = readFileSync(
    new URL('../src/pages/benchmarks/runs/[id].astro', import.meta.url),
    'utf8',
  );
  assert.match(comparePage, /Votes are unauthenticated/);
  assert.match(comparePage, /not\s+proof of who voted/);
  assert.match(runPage, /Votes are unauthenticated/);
  assert.match(runPage, /not\s+proof of who voted/);
  assert.match(runPage, /unauthenticated label/);
});

test('the D1 record updates one row per run, task and reviewer and says so', async () => {
  const db = database();
  try {
    const first = validateVote(found.record, voteBody({ choice: 'a' }));
    assert.ok(first.ok);
    const firstStore = await recordVote(db, first.value, new Date('2026-11-16T00:00:00Z'));
    assert.equal(firstStore.updated, false);
    assert.equal(firstStore.vote.blind, true);
    assert.equal(firstStore.vote.choice, 'a');

    const second = validateVote(found.record, voteBody({ choice: 'b', reason: 'B is faster.' }));
    assert.ok(second.ok);
    const secondStore = await recordVote(db, second.value, new Date('2026-11-16T00:01:00Z'));
    assert.equal(secondStore.updated, true);
    assert.equal(secondStore.replacedPair, null, 'the same pair is an update, not a replacement');
    assert.equal(secondStore.vote.choice, 'b');
    assert.equal(secondStore.vote.createdAt, '2026-11-16T00:00:00.000Z');
    assert.equal(secondStore.vote.updatedAt, '2026-11-16T00:01:00.000Z');

    const pair = pairsFor(found.record)[4];
    const third = validateVote(found.record, voteBody({ pair: pair.id, choice: 'tie' }));
    assert.ok(third.ok);
    const thirdStore = await recordVote(db, third.value, new Date('2026-11-16T00:02:00Z'));
    assert.equal(thirdStore.updated, true);
    assert.equal(thirdStore.replacedPair, pairsFor(found.record)[0].id);
    assert.equal(thirdStore.vote.pairId, pair.id);

    const rows = await listVotes(db, found.id);
    assert.equal(rows.length, 1, 'one reviewer has one durable vote per run');
    assert.equal(rows[0].pairId, pair.id);
    assert.equal(rows[0].trialA, pair.trialA.id);
    assert.equal(rows[0].trialB, pair.trialB.id);
    assert.equal(rows[0].choice, 'tie');
  } finally {
    db.cleanup();
  }
});

test('the read path can be scoped to one reviewer', async () => {
  const db = database();
  try {
    const owner = validateVote(found.record, voteBody({ reviewer: 'owner', choice: 'a' }));
    const guest = validateVote(found.record, voteBody({ reviewer: 'guest', choice: 'b' }));
    assert.ok(owner.ok && guest.ok);
    await recordVote(db, owner.value, new Date('2026-11-16T03:00:00Z'));
    await recordVote(db, guest.value, new Date('2026-11-16T03:01:00Z'));
    assert.equal((await listVotes(db, found.id)).length, 2);
    const ownerOnly = await listVotes(db, found.id, 'owner');
    assert.equal(ownerOnly.length, 1);
    assert.equal(ownerOnly[0].reviewerLabel, 'owner');
    assert.equal(ownerOnly[0].choice, 'a');
    const guestOnly = await listVotes(db, found.id, 'guest');
    assert.equal(guestOnly.length, 1);
    assert.equal(guestOnly[0].choice, 'b');
    assert.equal((await listVotes(db, found.id, 'nobody')).length, 0);

    const view = runView(buildRunEvidence(found.record, await listVotes(db, found.id), { votesAvailable: true }));
    assert.equal(view.sample.recordedPairs, 1, 'one pair, even when two reviewers voted on it');
    assert.equal(view.pairs[0].votes.length, 2);
    assert.deepEqual(
      view.pairs[0].votes.map((vote) => vote.reviewerLabel).sort(),
      ['guest', 'owner'],
    );
  } finally {
    db.cleanup();
  }
});

test('revealing without choosing keeps a later choice unblinded', async () => {
  const db = database();
  try {
    const reveal = validateVote(found.record, voteBody({ choice: 'revealed' }));
    assert.ok(reveal.ok);
    const stored = await recordVote(db, reveal.value, new Date('2026-11-16T01:00:00Z'));
    assert.equal(stored.vote.blind, false);

    const later = validateVote(found.record, voteBody({ choice: 'a', blind: true }));
    assert.ok(later.ok);
    const updated = await recordVote(db, later.value, new Date('2026-11-16T01:01:00Z'));
    assert.equal(updated.vote.blind, false, 'a revealed evaluation cannot become blind again');
    assert.equal(updated.blindStayedOff, true);
    assert.equal(updated.vote.choice, 'a');
  } finally {
    db.cleanup();
  }
});

test('export is the same shape the run page reads, so reopen is a real round trip', async () => {
  const db = database();
  try {
    const first = validateVote(found.record, voteBody({ choice: 'a' }));
    assert.ok(first.ok);
    await recordVote(db, first.value, new Date('2026-11-16T02:00:00Z'));
    const votes = await listVotes(db, found.id);
    const evidence = buildRunEvidence(found.record, votes, { votesAvailable: true });
    assert.equal(evidence.schema, 'composer/benchmark-run-evidence/1');
    assert.equal(evidence.runId, found.id);
    assert.deepEqual(evidence.record, compare);
    assert.equal(evidence.votes.length, 1);
    assert.equal(evidence.votesAvailable, true);

    const pageView = runView(evidence);
    const reopened = runView(JSON.parse(JSON.stringify(evidence)));
    assert.deepEqual(reopened, pageView);
    assert.equal(pageView.sample.recordedPairs, 1);
    assert.equal(pageView.sample.blindVotes, 1);
    assert.equal(pageView.pairs[0].votes.length, 1);
    assert.equal(pageView.pairs[0].votes[0].choice, 'a');
    assert.ok(pageView.pairs[0].sideA.configurationLabel);
    assert.ok(pageView.pairs[0].sideB.configurationLabel);
    assert.equal(pageView.provenance.recordFile, 'benchmarks/results/compare.json');
    assert.equal(exportFilename(found.id), `composer-benchmark-run-${found.id}.json`);
  } finally {
    db.cleanup();
  }
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

// The suite pack contract. A pack is data: it may only name deterministic
// checks that already exist and point at the committed results file. A pack that
// asks for a provider, a credential or spend is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  assertBenchmarkSuite,
  validateBenchmarkSuite,
} from '../src/lib/benchmark-suite.mjs';
import { discoverSuiteSpecs, findSuiteSpec, runSuitePack } from '../benchmarks/runner.mjs';

const exec = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(
  await readFile(path.join(repoRoot, 'benchmarks/suites/flow-01.json'), 'utf8'),
);
const latest = JSON.parse(
  await readFile(path.join(repoRoot, 'benchmarks/results/latest.json'), 'utf8'),
);

test('the shipped FLOW-01 pack validates against its committed evidence', () => {
  const result = validateBenchmarkSuite(spec, { results: latest });
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
  assert.equal(result.summary.id, 'FLOW-01');
  assert.equal(result.summary.providerFree, true);
  assert.equal(result.summary.evidenceState, 'recorded');
  assert.equal(result.summary.checks.length, 6);
  assert.deepEqual(
    result.summary.checks.map((check) => `${check.module}::${check.id}`),
    [
      'sandbox-save-reopen::edit-survives-reopen',
      'sandbox-save-reopen::tampered-save-rejected',
      'sandbox-save-reopen::restore-keeps-moderation',
      'sandbox-save-reopen::export-still-reads-restored-state',
      'blueprint-roundtrip::export-succeeds',
      'blueprint-roundtrip::fields-survive',
    ],
  );
  assert.equal(assertBenchmarkSuite(spec, { results: latest }).evidenceState, 'recorded');
});

test('a pack that asks for a provider, network, credential or spend is refused', () => {
  for (const patch of [
    { providerFree: false },
    { requirements: { network: true, credentials: [], spendMicro: 0 } },
    { requirements: { network: false, credentials: ['token'], spendMicro: 0 } },
    { requirements: { network: false, credentials: [], spendMicro: 1 } },
  ]) {
    const result = validateBenchmarkSuite({ ...spec, ...patch });
    assert.equal(result.ok, false, JSON.stringify(patch));
  }
});

test('unknown fields and a non-deterministic kind are refused', () => {
  assert.equal(validateBenchmarkSuite({ ...spec, surprise: true }).ok, false);
  assert.equal(validateBenchmarkSuite({ ...spec, kind: 'provider' }).ok, false);
  assert.equal(validateBenchmarkSuite({ ...spec, id: 'flow-01' }).ok, false);
});

test('a check the committed results file does not contain makes the pack not run', () => {
  const result = validateBenchmarkSuite(
    {
      ...spec,
      checks: [{ module: 'sandbox-save-reopen', id: 'not-a-check' }],
    },
    { results: latest },
  );
  assert.equal(result.ok, true, 'a stale or missing check is a rendered state, not a build gate');
  assert.equal(result.summary.evidenceState, 'not-run');
  assert.match(result.summary.evidenceNote, /not-a-check/);
});

test('a newer committed results file makes the pack stale rather than silently current', () => {
  const result = validateBenchmarkSuite(
    { ...spec, evidence: { ...spec.evidence, source: 'f'.repeat(40) } },
    { results: latest },
  );
  assert.equal(result.ok, true);
  assert.equal(result.summary.evidenceState, 'stale');
  assert.match(result.summary.evidenceNote, /needs its evidence refreshed/);
});

test('a pack with no evidence says not run and must explain why', () => {
  const notRun = {
    ...spec,
    evidence: { status: 'not-run', note: 'No run has been recorded for this pack yet.' },
  };
  const result = validateBenchmarkSuite(notRun, { results: latest });
  assert.equal(result.ok, true);
  assert.equal(result.summary.evidenceState, 'not-run');

  const unexplained = { ...spec, evidence: { status: 'not-run' } };
  assert.equal(validateBenchmarkSuite(unexplained).ok, false);
});

test('the runner discovers the JSON packs without changing .mjs discovery', async () => {
  const packs = await discoverSuiteSpecs();
  assert.ok(packs.some((pack) => pack.summary?.id === 'FLOW-01'));
  assert.equal(packs.some((pack) => pack.error), false);
  const found = await findSuiteSpec('FLOW-01');
  assert.equal(found.summary.id, 'FLOW-01');
  await assert.rejects(findSuiteSpec('NOPE-01'), /Unknown suite pack/);
});

test('the runner runs only the checks a pack names', async () => {
  const pack = await findSuiteSpec('FLOW-01');
  const result = await runSuitePack(pack, {
    directory: path.join(repoRoot, 'benchmarks/suites'),
  });
  assert.equal(result.id, 'FLOW-01');
  assert.equal(result.status, 'pass');
  assert.equal(result.checks.length, 6);
  assert.equal(new Set(result.checks.map((check) => check.id)).size, 6);
});

test('a pack check that the module does not return fails instead of passing', async () => {
  const fake = {
    spec: { schema: 'benchmark-suite/v1' },
    summary: {
      id: 'FIX-01',
      name: 'Missing check fixture',
      checks: [{ module: 'sandbox-save-reopen', id: 'not-a-check' }],
    },
  };
  const result = await runSuitePack(fake, {
    directory: path.join(repoRoot, 'benchmarks/suites'),
  });
  assert.equal(result.status, 'fail');
  assert.equal(result.checks[0].status, 'fail');
  assert.match(result.checks[0].detail, /did not return/);
});

test('a pack result cannot replace the full results record without an explicit --out', async () => {
  await assert.rejects(
    exec(
      process.execPath,
      [path.join(repoRoot, 'benchmarks/runner.mjs'), '--suite', 'FLOW-01', '--write'],
      { cwd: repoRoot, timeout: 20000 },
    ),
    (error) => {
      assert.notEqual(error.code, 0);
      assert.match(String(error.stderr), /needs --out/);
      return true;
    },
  );
});

test('the CLI accepts --suite and keeps the normal exit contract', async () => {
  const { stdout } = await exec(
    process.execPath,
    [path.join(repoRoot, 'benchmarks/runner.mjs'), '--suite', 'FLOW-01'],
    { cwd: repoRoot, timeout: 20000 },
  );
  const json = JSON.parse(stdout);
  assert.equal(json.totals.fail, 0);
  assert.equal(json.totals.checks, 6);
  assert.equal(json.suites[0].id, 'FLOW-01');
  assert.equal(json.pack.id, 'FLOW-01');
  assert.equal(json.pack.providerFree, true);
});

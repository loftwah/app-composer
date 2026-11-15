// The comparison track's own proof: the same files get the same verdict every
// time, a plausible-looking failure is caught, and a configuration with no
// usable take never reads as a winner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTrial,
  isUsable,
  money,
  routeFailures,
  summariseConfiguration,
  verdictFor,
} from '../src/lib/benchmark-compare.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GOOD = {
  'app.json': JSON.stringify({
    title: 'Night Shift Radio',
    tagline: 'Two hours of quiet, made on a kitchen table.',
    theme: 'dark',
    links: [
      { label: 'Latest release', url: 'https://example.com/release' },
      { label: 'Behind the scenes', url: 'https://example.com/notes' },
      { label: 'Get the newsletter', url: 'https://example.com/subscribe' },
    ],
    sections: ['about', 'guestbook'],
  }),
  'app.css': '.page{max-width:60ch;margin:0 auto}',
  'index.html': `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Night Shift Radio</title><link rel="stylesheet" href="app.css"></head>
<body>
<main class="page">
<h1>Night Shift Radio</h1>
<p>Two hours of quiet, made on a kitchen table.</p>
<h2 id="about">About</h2>
<h2 id="guestbook">Guestbook</h2>
<ul>
<li><a href="https://example.com/release">Latest release</a></li>
<li><a href="https://example.com/notes">Behind the scenes</a></li>
<li><a href="https://example.com/subscribe">Get the newsletter</a></li>
</ul>
</main>
</body></html>`,
};

test('a take that meets the whole brief passes every assertion', () => {
  const result = evaluateTrial({ files: GOOD });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.failed, []);
  assert.equal(result.checks.length, 9);
});

test('an inline style attribute fails even when everything else is right', () => {
  const files = { ...GOOD, 'index.html': GOOD['index.html'].replace('<h1>', '<h1 style="color:red">') };
  const result = evaluateTrial({ files });
  assert.equal(result.status, 'fail');
  assert.deepEqual(result.failed, ['csp-compatible']);
});

test('a script element fails, so a page that would break the site policy cannot pass', () => {
  const files = { ...GOOD, 'index.html': GOOD['index.html'].replace('</body>', '<script>alert(1)</script></body>') };
  const result = evaluateTrial({ files });
  assert.deepEqual(result.failed, ['csp-compatible']);
});

test('a new origin fails even when the page looks complete', () => {
  const files = { ...GOOD, 'index.html': GOOD['index.html'].replace('</body>', '<img src="https://cdn.example.net/x.png" alt="">') };
  const result = evaluateTrial({ files });
  assert.deepEqual(result.failed, ['no-external']);
});

test('the three permitted link destinations are not reported as other origins', () => {
  const result = evaluateTrial({ files: GOOD });
  assert.ok(result.checks.find((check) => check.id === 'no-external')?.status === 'pass');
});

test('a wrong link order fails the manifest check and not the page check', () => {
  const manifest = JSON.parse(GOOD['app.json']);
  manifest.links = [manifest.links[1], manifest.links[0], manifest.links[2]];
  const result = evaluateTrial({ files: { ...GOOD, 'app.json': JSON.stringify(manifest) } });
  assert.deepEqual(result.failed, ['manifest-content']);
});

test('missing files are named, not silently skipped', () => {
  const result = evaluateTrial({ files: { 'index.html': GOOD['index.html'] } });
  assert.ok(result.failed.includes('files-present'));
  assert.match(result.checks[0].detail, /app\.json/);
});

test('an empty result is not usable, so a blocked trial cannot count as a pass', () => {
  assert.equal(isUsable({ status: 'blocked', checks: [] }), false);
  assert.equal(isUsable({ status: 'pass', checks: [] }), false);
  assert.equal(isUsable({ status: 'pass', checks: [{ status: 'pass' }] }), true);
});

test('cost per usable take divides by takes that actually worked', () => {
  const summary = summariseConfiguration({
    trials: [
      { status: 'pass', durationMs: 1000, checks: [{ status: 'pass' }], cost: { estimateMicro: 100 } },
      { status: 'fail', durationMs: 3000, checks: [{ status: 'fail' }], cost: { estimateMicro: 100 } },
      { status: 'pass', durationMs: 2000, checks: [{ status: 'pass' }], cost: { estimateMicro: 100 } },
    ],
  });
  assert.equal(summary.usable, 2);
  assert.equal(summary.estimatedCostMicro, 300);
  assert.equal(summary.costPerUsableTakeMicro, 150);
  assert.equal(summary.medianDurationMs, 2000);
  assert.equal(summary.reportedCostMicro, null, 'no provider charge was reported, so it stays unknown');
});

test('cost per usable take is unknown when nothing worked rather than free', () => {
  const summary = summariseConfiguration({
    trials: [{ status: 'fail', checks: [{ status: 'fail' }], cost: { estimateMicro: 500 } }],
  });
  assert.equal(summary.costPerUsableTakeMicro, null);
  assert.equal(money(summary.costPerUsableTakeMicro), 'unknown');
});

test('the verdict refuses to crown a winner when every take failed', () => {
  const verdict = verdictFor([
    { id: 'a', label: 'A', trials: [{ status: 'fail', checks: [{ status: 'fail' }] }] },
    { id: 'b', label: 'B', trials: [{ status: 'fail', checks: [{ status: 'fail' }] }] },
  ]);
  assert.match(verdict.headline, /Neither configuration/);
  assert.equal(verdict.lead, undefined);
});

test('the verdict separates configurations by reliability when one is usable', () => {
  const verdict = verdictFor([
    { id: 'a', label: 'A', trials: [{ status: 'pass', checks: [{ status: 'pass' }], cost: { estimateMicro: 10 } }, { status: 'fail', checks: [{ status: 'fail' }] }] },
    { id: 'b', label: 'B', trials: [{ status: 'pass', checks: [{ status: 'pass' }], cost: { estimateMicro: 10 } }] },
  ]);
  assert.equal(verdict.lead, 'b');
  assert.match(verdict.headline, /safer choice/);
});

test('one configuration is a check, not a comparison', () => {
  const verdict = verdictFor([{ id: 'a', label: 'A', trials: [{ status: 'pass', checks: [{ status: 'pass' }] }] }]);
  assert.equal(verdict.comparable, false);
  assert.match(verdict.detail, /not a comparison/);
});

test('failures route to their owning issue once each', () => {
  const routes = routeFailures(
    [{ trials: [{ failed: ['csp-compatible'] }, { failed: ['csp-compatible', 'no-external'] }] }],
    { 'csp-compatible': '#605 layout', 'no-external': '#601 benchmarks' },
  );
  assert.deepEqual(routes, [
    { assertion: 'csp-compatible', owner: '#605 layout' },
    { assertion: 'no-external', owner: '#601 benchmarks' },
  ]);
});

test('the frozen task keeps the assertions the evaluator implements', async () => {
  const task = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/compare/task.json'), 'utf8'));
  const evaluated = evaluateTrial({ files: GOOD }).checks.map((check) => check.id);
  assert.deepEqual(task.assertions.map((assertion) => assertion.id), evaluated);
  assert.ok(task.brief.includes('Night Shift Radio'));
  assert.equal(task.version >= 1, true);
});

test('the recorded comparison is internally consistent', async () => {
  const record = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/results/compare.json'), 'utf8'));
  assert.equal(record.schema, 'benchmark-compare/v1');
  assert.ok(Array.isArray(record.configurations) && record.configurations.length >= 2);
  for (const configuration of record.configurations) {
    assert.ok(configuration.trials.length >= 3, `${configuration.id} needs three trials`);
    for (const trial of configuration.trials) {
      assert.ok(['pass', 'fail', 'blocked'].includes(trial.status));
      assert.ok(trial.previewUrl.startsWith('/benchmarks/trials/'));
      assert.ok(trial.previewUrl.endsWith('/index.html'), 'a trial links to a real file, not a directory');
      assert.ok(trial.cost && 'providerChargedMicro' in trial.cost);
      const judged = evaluateTrial({ files: {} });
      assert.ok(Array.isArray(trial.checks) && trial.checks.length === judged.checks.length);
    }
  }
});

// The inventory contract's own proof: a dated row with a real source validates,
// and every way of faking freshness is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INVENTORY_IDS,
  freshness,
  statusCounts,
  summariseInventory,
  validateInventories,
  validateInventory,
} from '../src/lib/model-inventory.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8'));
const NOW = Date.parse('2026-11-16T03:00:00Z');

function validInventory(overrides = {}) {
  return {
    schema: 'composer/model-inventory/1',
    id: 'studio-media',
    title: 'Studio media models',
    question: 'What can the independent Studio generate today, from its own catalogue?',
    checkedAt: '2026-11-16T02:00:00Z',
    staleAfterDays: 3,
    previousCheck: { checkedAt: '2026-11-15T02:00:00Z', source: 'config/media-studio-capabilities.json', what: 'An earlier snapshot.' },
    entries: [
      {
        id: 'example',
        label: 'Example model',
        kind: 'media-model',
        status: 'current',
        checkedAt: '2026-11-16T01:00:00Z',
        source: 'GET https://developers.cloudflare.com/workers-ai/models/example/index.md',
        observed: 'HTTP 200, title "example", no Planned Deprecation field.',
        endpoint: '@cf/black-forest-labs/flux-1-schnell',
      },
    ],
    changes: [],
    pinnedRuns: [],
    sources: [
      { id: 'example', url: 'https://developers.cloudflare.com/workers-ai/models/', readAt: '2026-11-16T01:00:00Z', shape: 'HTTP 200' },
    ],
    limits: ['A catalogue read is not proof that a request would succeed today.'],
    ...overrides,
  };
}

const codes = (file, options = {}) => validateInventory(file, { now: NOW, ...options }).issues.map((issue) => issue.code);

test('the three committed inventories validate together, and all three exist', () => {
  const files = INVENTORY_IDS.map((id) => read(`benchmarks/inventory/${id}.json`));
  const results = validateInventories(files, { now: NOW, exists: (relative) => existsSync(path.join(repoRoot, relative)) });
  for (const result of results) assert.deepEqual(result.issues, [], `${result.id} should be valid`);
  assert.equal(results.length, 3);
  assert.deepEqual(results.map((result) => result.id).sort(), [...INVENTORY_IDS].sort());
});

test('a well-formed inventory passes', () => {
  assert.deepEqual(codes(validInventory()), []);
});

test('a row checked after the file claims is refused', () => {
  const file = validInventory();
  file.entries[0].checkedAt = '2026-11-17T00:00:00Z';
  assert.ok(codes(file).includes('entry-checked-later'));
});

test('an inventory dated in the future is refused', () => {
  assert.ok(codes(validInventory({ checkedAt: '2026-11-20T00:00:00Z' })).includes('checked-at-future'));
});

test('an unverified row must say why, and cannot also be live', () => {
  const file = validInventory();
  file.entries[0].status = 'unverified';
  assert.ok(codes(file).includes('entry-unverified-reason'));
  file.entries[0].reason = 'No CLI is installed here, so the harness was never executed.';
  assert.deepEqual(codes(file), []);
  file.entries[0].live = true;
  assert.ok(codes(file).includes('entry-unverified-live'));
});

test('a media row carrying a display name instead of an endpoint is refused', () => {
  const file = validInventory();
  file.entries[0].endpoint = 'FLUX.2 Klein 9B';
  assert.ok(codes(file).includes('entry-endpoint'));
});

test('a change whose previous and current values are identical is refused', () => {
  const file = validInventory({
    changes: [{ entry: 'example', field: 'price', kind: 'price', previous: 'US$0.04', current: 'US$0.04', note: 'Nothing actually changed here.' }],
  });
  assert.ok(codes(file).includes('change-empty'));
});

test('a change naming a row that does not exist is refused', () => {
  const file = validInventory({
    changes: [{ entry: 'imaginary-model', field: 'price', kind: 'price', previous: 'a', current: 'b', note: 'This row is not in the inventory.' }],
  });
  assert.ok(codes(file).includes('change-entry'));
});

test('a source that is not a URL or a file is refused', () => {
  const file = validInventory();
  file.sources[0].url = 'the provider website';
  assert.ok(codes(file).includes('source-url'));
});

test('a pinned run pointing at a missing file is refused', () => {
  const file = validInventory({
    pinnedRuns: [{ id: 'run', where: 'file:benchmarks/results/not-a-real-run.json', recordedAt: '2026-11-15T08:42:03.193Z' }],
  });
  assert.ok(codes(file, { exists: () => false }).includes('pinned-missing'));
});

test('an inventory with no stated limits is refused', () => {
  assert.ok(codes(validInventory({ limits: [] })).includes('limits'));
});

test('a missing inventory is reported rather than quietly skipped', () => {
  const results = validateInventories([read('benchmarks/inventory/build-agents.json')], { now: NOW });
  const missing = results.filter((result) => result.issues.some((issue) => issue.code === 'missing'));
  assert.deepEqual(missing.map((result) => result.id).sort(), ['hosted-execution', 'studio-media']);
  assert.equal(results.filter((result) => result.ok).length, 1);
});

test('freshness turns stale at its own limit and refuses an undated check', () => {
  const base = { checkedAt: '2026-11-10T03:00:00Z', staleAfterDays: 3, now: NOW };
  assert.equal(freshness(base).stale, true);
  assert.equal(freshness({ ...base, checkedAt: '2026-11-14T03:00:00Z' }).stale, false);
  assert.equal(freshness({ checkedAt: 'yesterday', staleAfterDays: 3, now: NOW }).stale, true);
  assert.equal(freshness({ checkedAt: '2026-11-16T02:00:00Z', staleAfterDays: 3, now: NOW }).ageDays, 0);
});

test('counts come from the rows, so prose cannot claim a status the data lacks', () => {
  const file = read('benchmarks/inventory/hosted-execution.json');
  const summary = summariseInventory(file, { now: NOW });
  assert.equal(summary.total, file.entries.length);
  assert.equal(summary.counts.absent, file.entries.filter((entry) => entry.status === 'absent').length);
  assert.deepEqual(statusCounts([{ status: 'current' }, { status: 'current' }, { status: 'unverified' }]), {
    current: 2,
    drifted: 0,
    retired: 0,
    absent: 0,
    unverified: 1,
  });
});

test('the committed inventories keep the claims the issue needs to be true', () => {
  const build = read('benchmarks/inventory/build-agents.json');
  const hosted = read('benchmarks/inventory/hosted-execution.json');
  const studio = read('benchmarks/inventory/studio-media.json');

  // An agent with no installed binary is not presented as verified.
  const claude = build.entries.find((entry) => entry.id === 'claude-code');
  assert.equal(claude.status, 'unverified');
  assert.ok(claude.reason.length > 20);

  // The deployed Worker has no inference binding, and that absence is a row.
  const inference = hosted.entries.find((entry) => entry.id === 'model-inference-binding');
  assert.equal(inference.status, 'absent');
  assert.match(inference.observed, /no binding of type ai/);
  assert.equal(hosted.entries.find((entry) => entry.id === 'composer-inference-ids').status, 'absent');

  // Every Studio row that claims a route carries an exact endpoint and a source.
  const models = studio.entries.filter((entry) => entry.kind === 'media-model');
  assert.equal(models.length, 17);
  for (const model of models) {
    assert.match(model.endpoint, /^(?:@cf\/|fal-ai\/|[a-z0-9-]+\/)/);
    assert.ok(model.source.length > 10);
  }
  const retired = models.filter((model) => model.status === 'retired');
  assert.deepEqual(retired.map((model) => model.id), ['studio-draft-retired']);
  assert.equal(retired[0].replacement, 'studio-craft');
});

test('the pending decision queue labels cost and stays queued', () => {
  const pending = read('benchmarks/inventory/pending.json');
  assert.equal(pending.schema, 'composer/inventory-decisions/1');
  assert.ok(pending.decisions.length > 0);
  for (const decision of pending.decisions) {
    assert.equal(decision.status, 'queued');
    assert.ok(decision.cost.label.length > 0);
    assert.ok(decision.ownerAction.length > 0);
    // An unpriced spend is labelled unknown, never zero.
    if (decision.kind === 'spend' && decision.cost.micro === null) assert.equal(decision.cost.label, 'unknown');
  }
});

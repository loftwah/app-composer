// The Studio job-receipt contract's own proof: the committed aggregate
// validates against the committed studio-media inventory, and every way of
// faking a comparison, leaking a private record or mixing inventories is
// refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COST_ESTIMATE_LABEL,
  JOB_EVIDENCE_INVENTORY,
  JOB_EVIDENCE_SCHEMA,
  assertJobEvidence,
  summariseJobEvidence,
  validateJobEvidence,
} from '../src/lib/studio-job-evidence.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8'));
const committed = read('benchmarks/comparisons/studio-job-receipts.json');
const inventory = read('benchmarks/inventory/studio-media.json');
const NOW = Date.parse('2026-11-16T06:00:00Z');

const clone = () => JSON.parse(JSON.stringify(committed));
const codes = (file, options = {}) =>
  validateJobEvidence(file, { now: NOW, inventoryEntries: inventory.entries, ...options }).issues.map((issue) => issue.code);

test('the committed Studio job receipts validate against the committed studio-media inventory', () => {
  const result = validateJobEvidence(committed, { now: NOW, inventoryEntries: inventory.entries });
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
  assert.equal(result.summary.inventory, 'studio-media');
  assert.equal(result.summary.groups.length, 17);
  assert.equal(result.summary.totals.jobs, 86);
  assert.equal(result.summary.totals.saved, 66);
  assert.equal(result.summary.totals.failed, 13);
  assert.equal(result.summary.totals.unknown, 7);
  assert.equal(result.summary.totals.cancelled, 0);
  assert.equal(result.summary.totals.costEstimateMicroSum, 12_863_702);
  assert.equal(result.summary.cost.label, COST_ESTIMATE_LABEL);
  // A saved rate is derived from the counts, never stored in the file.
  assert.equal(result.summary.totals.savedRate, 66 / 86);
});

test('every committed group count adds up, and every saved job has a latency sample', () => {
  for (const group of committed.groups) {
    assert.equal(group.saved + group.failed + group.unknown + group.cancelled, group.jobs, group.model);
    assert.equal(group.withoutTerminal, group.failed + group.unknown, group.model);
    assert.equal(group.savedLatencyMs.samples, group.saved, group.model);
    assert.equal(group.costEstimateMicro.samples, group.jobs, group.model);
    assert.ok(group.savedLatencyMs.median >= 0, group.model);
    assert.ok(group.savedLatencyMs.p90 >= group.savedLatencyMs.median, group.model);
  }
});

test('the committed examples are settings, not private records', () => {
  assert.ok(committed.examples.length >= 2 && committed.examples.length <= 3);
  for (const example of committed.examples) {
    assert.deepEqual(Object.keys(example).filter((key) => /prompt|asset|project|client|provider|retained/i.test(key)), []);
  }
  const kinds = new Set(committed.examples.map((example) => example.kind));
  assert.ok(kinds.size >= 2);
});

test('an undated receipt is refused', () => {
  const file = clone();
  delete file.checkedAt;
  assert.ok(codes(file).includes('checked-at'));
  file.checkedAt = 'last Tuesday';
  assert.ok(codes(file).includes('checked-at'));
});

test('a receipt in the future is refused', () => {
  const file = clone();
  file.checkedAt = '2026-11-20T00:00:00Z';
  assert.ok(codes(file).includes('checked-at-future'));
});

test('zero jobs are refused even when every other field is well formed', () => {
  const file = clone();
  file.groups = [];
  file.totals = { jobs: 0, saved: 0, failed: 0, unknown: 0, cancelled: 0, costEstimateMicroSum: 0, providerChargeRows: 0 };
  file.scope.rows = 0;
  const found = codes(file);
  assert.ok(found.includes('zero-jobs'));
  assert.ok(found.includes('groups'));
});

test('evidence labelled with another inventory is refused as mixed', () => {
  const file = clone();
  file.inventory = 'build-agents';
  assert.ok(codes(file).includes('inventory-mixed'));
});

test('a model mapped to a non-media inventory row is refused', () => {
  const file = clone();
  const group = file.groups.find((entry) => entry.inventoryEntry === 'h3-max-turbo');
  group.inventoryEntry = 'composer-account';
  assert.ok(codes(file).includes('inventory-entry'));
});

test('an unlisted route must say it is unlisted, and is accepted when it does', () => {
  const file = clone();
  const group = file.groups.find((entry) => !entry.inventoryEntry);
  const note = group.inventoryNote;
  delete group.inventoryNote;
  assert.ok(codes(file).includes('inventory-unmapped-note'));
  group.inventoryNote = note;
  assert.deepEqual(codes(file), []);
});

test('a different production key mapped to an inventory row needs an explanation', () => {
  const file = clone();
  const group = file.groups.find((entry) => entry.inventoryEntry === 'studio-draft-retired');
  delete group.inventoryNote;
  assert.ok(codes(file).includes('inventory-mapping-note'));
});

test('a private field is refused wherever it appears', () => {
  const file = clone();
  file.groups[0].prompt = 'a private instruction';
  const found = codes(file);
  assert.ok(found.includes('private-field'));
  assert.ok(found.includes('group-field'));

  const example = clone();
  example.examples[0].assetId = 'asset-private';
  assert.ok(codes(example).includes('private-field'));
  assert.ok(codes(example).includes('example-field'));
});

test('a prompt column in the recorded SQL is refused', () => {
  const file = clone();
  file.source.sql = `${file.source.sql}\n-- prompt`;
  const found = codes(file);
  assert.ok(found.includes('sql-prompt-column'));
});

test('SELECT * in the recorded SQL is refused', () => {
  const file = clone();
  file.source.sql = 'SELECT * FROM generations WHERE deleted_at IS NULL';
  assert.ok(codes(file).includes('sql-select-star'));
});

test('a negative latency is refused', () => {
  const file = clone();
  const group = file.groups.find((entry) => entry.saved > 0);
  group.savedLatencyMs.median = -1;
  group.savedLatencyMs.p90 = -1;
  const found = codes(file);
  assert.ok(found.includes('latency-median'));
  assert.ok(found.includes('latency-p90'));
});

test('a p90 lower than the median is refused', () => {
  const file = clone();
  const group = file.groups.find((entry) => entry.saved > 1);
  group.savedLatencyMs.p90 = group.savedLatencyMs.median - 1;
  assert.ok(codes(file).includes('latency-order'));
});

test('counts that do not add up are refused', () => {
  const file = clone();
  file.groups[0].failed += 1;
  const found = codes(file);
  assert.ok(found.includes('group-counts'));
  assert.ok(found.includes('group-terminal'));
});

test('totals that disagree with the groups are refused', () => {
  const file = clone();
  file.totals.saved += 1;
  assert.ok(codes(file).includes('totals-saved-mismatch'));
  assert.ok(codes(file).includes('totals-counts'));
});

test('a cost estimate labelled as anything but an estimate is refused', () => {
  const file = clone();
  file.cost.label = 'provider invoice';
  assert.ok(codes(file).includes('cost-label'));
});

test('an undated example setting or an unreadable limit is refused', () => {
  const file = clone();
  file.examples[0].durationSeconds = -5;
  file.limits = [''];
  const found = codes(file);
  assert.ok(found.includes('example-duration'));
  assert.ok(found.includes('limit-text'));
});

test('the validator needs the studio-media inventory to check the mapping', () => {
  assert.ok(codes(committed, { inventoryEntries: undefined }).includes('inventory-entries'));
});

test('the page helper refuses an invalid file and returns a summary for a valid one', () => {
  const file = clone();
  delete file.checkedAt;
  assert.throws(
    () => assertJobEvidence(file, { now: NOW, inventoryEntries: inventory.entries }),
    /Refusing to render the Studio job comparison/,
  );
  const summary = assertJobEvidence(committed, { now: NOW, inventoryEntries: inventory.entries });
  assert.equal(summary.id, committed.id);
  assert.equal(summary.inventory, JOB_EVIDENCE_INVENTORY);
  assert.equal(summary.question.length > 20, true);
});

test('the summary keeps freshness separate from validity', () => {
  const stale = summariseJobEvidence(committed, { now: Date.parse('2026-11-20T06:00:00Z') });
  assert.equal(stale.stale, true);
  assert.ok(stale.ageDays !== null);
  const fresh = summariseJobEvidence(committed, { now: NOW });
  assert.equal(fresh.stale, false);
});

test('the committed schema, inventory and cost label stay exact', () => {
  assert.equal(committed.schema, JOB_EVIDENCE_SCHEMA);
  assert.equal(committed.inventory, JOB_EVIDENCE_INVENTORY);
  assert.equal(committed.cost.label, COST_ESTIMATE_LABEL);
  assert.equal(committed.source.database, 'media-studio');
  assert.doesNotMatch(committed.source.sql, /select\s+\*/i);
  assert.doesNotMatch(committed.source.sql, /\bprompt\b/i);
});

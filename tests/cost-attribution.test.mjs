import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { buildAttribution, attributionContract, missingAuthority, AttributionError } from '../src/lib/cost-attribution.ts';
import { recordedMapping, unmappedApps, readPaths } from '../scripts/finops-attribution.mjs';

const root = resolve('.');
const configuration = JSON.parse(readFileSync(`${root}/wrangler.jsonc`, 'utf8'));
const account = '1003dc1d93af0ebea56b2f1252f89627';
const now = Date.parse('2026-10-25T00:00:00.000Z');
const observation = () => ({
  source: 'cloudflare-rest-read',
  accountId: account,
  capturedAt: '2026-10-24T23:55:00.000Z',
  windowEnd: '2026-10-24T20:20:00.000Z',
  workers: [{ id: 'app-composer' }, { id: 'app-composer-preview' }, { id: 'composer-owned-reference' }],
  d1: [
    { uuid: '1b2b29c8-4109-4a5f-901a-befc91173bc5', name: 'app-composer-emdash', fileSize: 90112 },
    { uuid: 'bdbbe1c4-e1ff-43d3-a89d-d7dd76d13c0a', name: 'app-composer-emdash-preview', fileSize: 204800 },
  ],
  r2: [
    { name: 'app-composer-media', payloadBytes: 12514, objectCount: 1, periodEnd: '2026-10-24T20:20:00.000Z' },
    { name: 'app-composer-media-preview', payloadBytes: 0, objectCount: 0, periodEnd: '2026-10-24T20:20:00.000Z' },
  ],
});

test('the recorded mapping comes from wrangler.jsonc and never names an independent app Worker', () => {
  const mapping = recordedMapping(configuration);
  assert.ok(mapping.length >= 6);
  assert.deepEqual(new Set(mapping.map((entry) => entry.environmentId)), new Set(['production', 'preview']));
  assert.deepEqual(new Set(mapping.map((entry) => entry.kind)), new Set(['worker', 'd1', 'r2']));
  for (const entry of mapping) {
    assert.equal(entry.appId, 'app-composer');
    assert.equal(entry.recordedIn, 'wrangler.jsonc');
  }
  assert.ok(mapping.some((entry) => entry.resourceName === 'app-composer' && entry.kind === 'worker'));
  assert.ok(mapping.some((entry) => entry.resourceName === 'app-composer-emdash' && entry.resourceId === '1b2b29c8-4109-4a5f-901a-befc91173bc5'));
  assert.ok(!mapping.some((entry) => /guestbook|showcase|linkcheck|paperwork/.test(entry.resourceName)));
  const appIds = unmappedApps();
  assert.ok(appIds.includes('guestbook') && appIds.includes('ldraw') && appIds.length >= 8);
});

test('measured storage and inventory are attributed; requests, CPU and cost stay unverified', () => {
  const view = buildAttribution({ mapping: recordedMapping(configuration), observation: observation(), now });
  assert.equal(view.contract, attributionContract);
  assert.equal(view.accountId, account);
  const d1 = view.rows.find((row) => row.resourceName === 'app-composer-emdash');
  assert.equal(d1.measures.find((measure) => measure.id === 'd1StorageBytes').state, 'measured');
  assert.equal(d1.measures.find((measure) => measure.id === 'd1StorageBytes').value, 90112);
  const r2 = view.rows.find((row) => row.resourceName === 'app-composer-media');
  assert.equal(r2.measures.find((measure) => measure.id === 'r2StorageBytes').value, 12514);
  for (const row of view.rows) {
    for (const measure of row.measures) {
      if (measure.state === 'unverified') {
        assert.equal(measure.value, null, `${row.resourceName}/${measure.id} must not be zero`);
        assert.ok(measure.reason.length > 10);
        assert.ok(measure.missingAuthority.length > 20);
      }
    }
    assert.deepEqual(row.measures.filter((measure) => measure.id === 'cost').map((measure) => measure.state), ['unverified']);
  }
  const coverage = new Map(view.coverage.map((entry) => [entry.measure, entry]));
  assert.equal(coverage.get('d1StorageBytes').state, 'complete');
  assert.equal(coverage.get('r2StorageBytes').state, 'complete');
  assert.equal(coverage.get('requests').state, 'unverified');
  assert.equal(coverage.get('cost').state, 'unverified');
  assert.ok(view.unallocated.some((entry) => entry.resourceName === 'composer-owned-reference'));
  assert.ok(view.unallocated.some((entry) => entry.resourceName === 'app-composer-media-preview') === false);
  assert.ok(view.limits.some((limit) => /point-in-time/.test(limit)));
  assert.deepEqual(missingAuthority().map((entry) => entry.measure), ['requests', 'cpuMs', 'cost']);
});

test('a missing resource is unverified rather than absent or zero', () => {
  const provider = observation();
  provider.workers = [{ id: 'app-composer' }];
  provider.d1 = [];
  provider.r2 = [];
  const view = buildAttribution({ mapping: recordedMapping(configuration), observation: provider, now });
  const preview = view.rows.find((row) => row.resourceName === 'app-composer-preview');
  assert.equal(preview.present, false);
  assert.equal(preview.measures.find((measure) => measure.id === 'workerExists').state, 'unverified');
  assert.equal(view.rows.find((row) => row.resourceName === 'app-composer-emdash').measures.find((measure) => measure.id === 'd1StorageBytes').value, null);
});

test('unsafe or ambiguous attribution is refused before a view exists', () => {
  const mapping = recordedMapping(configuration);
  const cases = [
    [{ ...observation(), accountId: 'not-an-account' }, mapping],
    [{ ...observation(), capturedAt: '2026-10-26T00:00:00.000Z' }, mapping],
    [{ ...observation(), source: 'estimated' }, mapping],
    [observation(), [...mapping, mapping[0]]],
    [observation(), mapping.map((entry) => ({ ...entry, kind: 'queue' }))],
    [observation(), mapping.map((entry) => ({ ...entry, resourceName: '/private/secret' }))],
  ];
  for (const [provider, record] of cases) {
    assert.throws(() => buildAttribution({ mapping: record, observation: provider, now }), (error) => error instanceof AttributionError, JSON.stringify(record?.[0] ?? provider).slice(0, 60));
  }
  const duplicates = [...mapping, { ...mapping[0], appId: 'other-app' }];
  assert.throws(() => buildAttribution({ mapping: duplicates, observation: observation(), now }), /repeats/);
});

test('the collector plans GET-only reads and refuses an unauthorised live read', () => {
  const plan = spawnSync(process.execPath, ['scripts/finops-attribution.mjs', '--plan'], { cwd: root, encoding: 'utf8' });
  assert.equal(plan.status, 0, plan.stderr);
  const parsed = JSON.parse(plan.stdout);
  assert.equal(parsed.mode, 'plan');
  assert.ok(parsed.requests.every((request) => request.method === 'GET'));
  assert.equal(parsed.requests.length, 4);
  assert.ok(parsed.missingAuthority.some((entry) => entry.measure === 'cost'));
  const refused = spawnSync(process.execPath, ['scripts/finops-attribution.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /--allow-live-read/);
  assert.ok(readPaths(account).every((path) => path.startsWith('/accounts/' + account)));
});

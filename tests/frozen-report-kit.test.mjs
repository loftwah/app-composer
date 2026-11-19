import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportKitManifest, reportKitPath } from '../src/lib/public-report.ts';

test('the frozen report attachment advertises only its public measurement and scope', () => {
  const id = 'r0123456789abcdef01234567';
  const snapshot = {
    id, headline: 'Two recorded Open actions', metric: 'app_open_action',
    metricLabel: 'Open actions', value: 2, unit: 'recorded opens', quality: 'bounded',
    createdAt: '2026-11-06T01:00:00.000Z', sourceRevision: 'approved-release',
    period: {from:'2026-11-01',to:'2026-11-06',days:6,surface:'all'},
    coverage: {quality:'bounded',startedAt:'2026-11-01T00:00:00.000Z',limitations:['Includes only recorded actions.'],privateMetadata:'excluded'},
    origin: {kind:'owner-permitted',traffic:'all',scopeId:'private-scope-fixture'},
  };
  const manifest = reportKitManifest(snapshot);
  assert.equal(reportKitPath(id), `/reports/${id}/kit.zip`);
  assert.equal(manifest.canonical, `https://composer.loftwah.com/reports/${id}`);
  assert.deepEqual(manifest.measurement, {key:'app_open_action',label:'Open actions',value:2,unit:'recorded opens',quality:'bounded'});
  assert.equal(manifest.window.timezone, 'UTC');
  assert.doesNotMatch(JSON.stringify(manifest), /origin|private-scope-fixture|privateMetadata/);
});

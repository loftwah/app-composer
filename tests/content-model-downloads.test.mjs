import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contentModelDownloadNames,
  contentModelHandoff,
  emdashSeed,
  starterModel,
  validateContentModel,
} from '../lib/content-model/index.mjs';

test('model and seed downloads are named for their own collection', () => {
  const events = {
    schema: 'app-composer.content-model',
    version: 1,
    collection: 'events',
    label: 'Club events',
    groups: ['Event'],
    fields: [{ key: 'title', label: 'Event name', type: 'string', required: true, group: 'Event' }],
  };
  const notices = { ...structuredClone(events), collection: 'notices', label: 'Club notices' };
  assert.deepEqual(contentModelDownloadNames(events), {
    model: 'events.app-composer-content-model.json',
    seed: 'events.emdash-content-seed.json',
  });
  assert.deepEqual(contentModelDownloadNames(notices), {
    model: 'notices.app-composer-content-model.json',
    seed: 'notices.emdash-content-seed.json',
  });
  assert.notEqual(contentModelDownloadNames(events).model, contentModelDownloadNames(notices).model);
  assert.deepEqual(contentModelDownloadNames(starterModel), {
    model: 'workshops.app-composer-content-model.json',
    seed: 'workshops.emdash-content-seed.json',
  });
});

test('download names use the validated collection and refuse an unknown model', () => {
  const model = structuredClone(starterModel);
  model.collection = 'Community-Club';
  assert.throws(() => contentModelDownloadNames(model), /unique lowercase name/);
  assert.throws(() => contentModelDownloadNames({}), /Use content model version 1/);
  assert.match(contentModelHandoff(starterModel), /Content model:/);
  assert.equal(emdashSeed(starterModel).collections[0].slug, 'workshops');
});

test('the public client uses the shared download-name helper rather than fixed names', async () => {
  const { readFile } = await import('node:fs/promises');
  const client = await readFile(new URL('../src/lib/content-model-client.ts', import.meta.url), 'utf8');
  assert.match(client, /contentModelDownloadNames\(valid\)\.model/);
  assert.match(client, /contentModelDownloadNames\(valid\)\.seed/);
  assert.doesNotMatch(client, /'app-composer-content-model\.json'/);
  assert.doesNotMatch(client, /'emdash-content-seed\.json'/);
});

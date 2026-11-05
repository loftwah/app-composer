import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateContentModel, emdashSeed} from '../lib/content-model/index.mjs';

const models = [
  'collectibles.app-composer-content-model.json',
  'machines.app-composer-content-model.json',
];

for (const name of models) {
  test('Oddpull lab model validates and converts to an EmDash seed: '+name, () => {
    const raw = JSON.parse(readFileSync(new URL('../labs/oddpull-composer-pilot/models/'+name, import.meta.url), 'utf8'));
    const model = validateContentModel(raw); // actual maintained Composer validator
    assert.equal(model.schema, 'app-composer.content-model');
    assert.equal(model.version, 1);
    assert.deepEqual(emdashSeed(model).collections.map(c=>c.slug), [model.collection]);
    assert.ok(model.fields.some(f=>f.key==='publication'));
  });
}

test('Oddpull lab models cannot override reserved CMS identity fields', () => {
  const model = JSON.parse(readFileSync(new URL('../labs/oddpull-composer-pilot/models/collectibles.app-composer-content-model.json', import.meta.url), 'utf8'));
  model.fields[0].key = 'owner_id';
  assert.throws(()=>validateContentModel(model));
});

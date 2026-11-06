import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {publicPagePaths, builderPagePaths, builderStaticPaths} from '../src/lib/public-pages.mjs';
import {isBuilderPath} from '../src/lib/builder-context.mjs';

test('public and builder page inventories stay distinct and complete', () => {
  assert.equal(new Set(publicPagePaths).size, publicPagePaths.length, 'public paths must not repeat');
  assert.equal(new Set(builderPagePaths).size, builderPagePaths.length, 'builder paths must not repeat');
  for (const path of builderPagePaths)
    assert.ok(publicPagePaths.includes(path), `${path} must also be an indexable public page`);
  for (const path of builderStaticPaths)
    assert.ok(!publicPagePaths.includes(path), `${path} is a static example, not a public page`);
  assert.ok(publicPagePaths.includes('/init/launch-kit'));
  assert.ok(existsSync(new URL('../src/pages/init/launch-kit.astro', import.meta.url)));
});

test('the named-edition handoff never admits administration or API routes', () => {
  assert.equal(isBuilderPath('/_emdash/admin'), false);
  assert.equal(isBuilderPath('/api/composition.json'), false);
  assert.equal(isBuilderPath('/init/launch-kit'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('the launcher study mounts the maintained controller once', () => {
  const base = read('src/layouts/Base.astro');
  const page = read('src/pages/launcher.astro');
  const component = read('src/components/AppLauncher.astro');
  const controller = read('src/browser/launcher.ts');

  assert.match(base, /Astro\.props\.launcher !== false && <AppLauncher \/>/);
  assert.match(page, /launcher=\{false\}/);
  assert.match(page, /import AppLauncher from '\.\.\/components\/AppLauncher\.astro';/);
  assert.equal(page.match(/<AppLauncher\s*\/>/g)?.length, 1);
  assert.doesNotMatch(page, /id="app-navigation"|data-open-apps|data-close-apps/);
  assert.match(component, /<script is:inline src="\/brand\/launcher\.js" defer><\/script>/);
  assert.doesNotMatch(component, /type="module" src="\/brand\/launcher\.js"/);
  assert.match(controller, /querySelector<HTMLDialogElement>\("#app-navigation"\)/);
});

test('the launcher recipe stays linked from the agent, design and docs entry points', () => {
  assert.match(read('src/lib/public-pages.mjs'), /'\/launcher'/);
  assert.match(read('src/pages/agent.md.ts'), /composer\.loftwah\.com\/launcher/);
  assert.match(read('src/pages/agent.astro'), /href="\/launcher"/);
  assert.match(read('AGENTS.md'), /docs\/source-maintenance\.md#launcher-interaction-recipe/);
  assert.match(read('DESIGN.md'), /docs\/source-maintenance\.md#launcher-interaction-recipe/);
  assert.match(read('docs/README.md'), /source-maintenance\.md#launcher-interaction-recipe/);

  const recipe = read('docs/source-maintenance.md');
  assert.match(recipe, /### Launcher interaction recipe/);
  for (const source of [
    'src/browser/launcher.ts',
    'public/brand/launcher.js',
    'public/brand/launcher.css',
    'src/components/AppLauncher.astro',
    'src/pages/launcher.astro',
    'tests/launcher-recipe.test.mjs',
  ])
    assert.match(recipe, new RegExp(escape(source)));
});

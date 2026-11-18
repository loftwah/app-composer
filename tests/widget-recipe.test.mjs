import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GET } from '../src/pages/widgets/loftwahfm-night-signal-v1.json.ts';
import { GET as downloadStarter } from '../src/pages/widgets/loftwahfm-night-signal-v1.html.ts';
import {
  agentTask,
  embed,
  embedHtml,
  embedJsx,
  recipeFilename,
  recipeUrl,
  starterFilename,
  starterHtml,
  widgetRecipe,
  widgetRecipeJson,
} from '../src/lib/widget-recipe.ts';

// The widget recipe is publishable data. These checks keep the one shared
// definition honest: the v1 Night Signal contract stays exact, the served
// download matches the JSON embedded in the page, and the page keeps
// consuming the shared module instead of redefining it.

test('the shipped recipe is the v1 Night Signal contract with no authority', () => {
  assert.deepEqual(Object.keys(widgetRecipe), [
    'version',
    'id',
    'provider',
    'builder',
    'target',
    'permissionsPolicy',
    'requirements',
    'config',
    'embed',
  ]);
  assert.equal(widgetRecipe.version, 1);
  assert.equal(widgetRecipe.id, 'loftwahfm-night-signal');
  assert.equal(widgetRecipe.provider, 'https://fm.loftwah.com');
  assert.equal(widgetRecipe.builder, 'https://fm.loftwah.com/widgets?station=night-signal#builder');
  assert.equal(widgetRecipe.target, 'iframe');
  assert.equal(widgetRecipe.permissionsPolicy, embed.allow);
  assert.equal(widgetRecipe.embed, 'https://fm.loftwah.com/widget?station=night-signal');
  assert.deepEqual(widgetRecipe.requirements, {
    frameSource: 'https://fm.loftwah.com',
    account: false,
    credentials: false,
  });
  assert.deepEqual(widgetRecipe.config, { station: 'night-signal', width: 560, height: 420, autoplay: false });
  assert.equal(JSON.stringify(widgetRecipe), widgetRecipeJson);
});

test('the embed stays the exact reviewed 245-byte HTML with unchanged attributes', () => {
  assert.equal(Buffer.byteLength(embedHtml), 245);
  assert.equal(
    embedHtml,
    [
      '<iframe',
      `  src="${embed.src}"`,
      `  title="${embed.title}"`,
      `  width="${embed.width}"`,
      `  height="${embed.height}"`,
      `  style="${embed.style}"`,
      `  loading="${embed.loading}"`,
      `  allow="${embed.allow}"`,
      '></iframe>',
    ].join('\n'),
  );
  for (const attribute of [embed.src, embed.title, embed.width, embed.height, embed.loading, embed.allow]) {
    assert.ok(embedJsx.includes(attribute), 'the React version carries the same attribute value');
  }
  assert.ok(embedJsx.includes(`style={{ border: 0, maxWidth: '100%' }}`), 'the React style object matches the HTML style');
  assert.ok(
    agentTask.includes(
      `<iframe src="${embed.src}" title="${embed.title}" width="${embed.width}" height="${embed.height}" style="${embed.style}" loading="${embed.loading}" allow="${embed.allow}"></iframe>`,
    ),
    'the agent task carries the same one-line embed',
  );
  assert.ok(agentTask.includes(recipeUrl), 'the agent task points at the machine-readable recipe');
});

test('the public recipe route serves the same JSON the page embeds, as a download', async () => {
  const response = await GET({ url: new URL(recipeUrl), params: {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="${recipeFilename}"`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.text();
  assert.equal(body, widgetRecipeJson, 'the route serves the exact page serialisation');
  assert.deepEqual(JSON.parse(body), widgetRecipe);
});

test('the standalone HTML stays a byte-preserving attachment at the edge', async () => {
  const response = await downloadStarter({ url: new URL(starterFilename, recipeUrl), params: {} });
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="${starterFilename}"`);
  assert.equal(response.headers.get('cache-control'), 'no-store, no-transform');
  const body = await response.text();
  assert.equal(body, starterHtml);
  assert.ok(body.includes(embedHtml));
  assert.doesNotMatch(body, /<script\b/);
});

test('the widget page consumes the shared definition and the CSP swap stays exact', async () => {
  const page = await readFile('src/pages/widgets.astro', 'utf8');
  assert.ok(page.includes("from '../lib/widget-recipe'"), 'the page imports the shared definition');
  assert.ok(page.includes('set:html={widgetRecipeJson}'), 'the embedded JSON comes from the shared serialisation');
  assert.ok(!page.includes('const recipe = {'), 'the recipe is not redefined inside the page');
  assert.ok(page.includes(`download={recipeFilename}`), 'the page offers the recipe download');
  const middleware = await readFile('src/middleware.ts', 'utf8');
  assert.ok(middleware.includes('context.url.pathname === "/widgets"'), 'the CSP swap stays scoped to /widgets');
  assert.ok(middleware.includes('"frame-src https://fm.loftwah.com"'), 'the selective frame-src swap is preserved');
});

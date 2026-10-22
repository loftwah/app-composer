import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {publicStack} from '../src/lib/stacks.mjs';
import {stackShareDetails, stackSharePayload, isStackImageIdentity} from '../src/lib/stack-sharing.ts';
import {stackShareSvg, wrapCardText} from '../src/lib/stack-share-svg.ts';
import {initWasm, Resvg} from '@resvg/resvg-wasm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import jsQR from 'jsqr';
import pngjs from 'pngjs';

const brandBytes = readFileSync(new URL('../src/assets/composer-icon-20261022-96.png.bin', import.meta.url));
const brandImage = `data:image/png;base64,${brandBytes.toString('base64')}`;
const font = readFileSync(new URL('../src/assets/fonts/SpaceGrotesk.ttf.bin', import.meta.url));
const fontOptions = {font: {fontBuffers: [font], defaultFontFamily: 'Space Grotesk'}};
let rendererReady;
function prepareRenderer() {
  const require = createRequire(import.meta.url);
  rendererReady ??= initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  return rendererReady;
}

const sample = {
  version: 1, name: 'Trail Notes', description: 'Fictional weekend photos and favourite finds.', theme: 'midnight',
  instances: [
    {id: 'aaaaaaaa-1111-2222-3333-444444444444', app: 'guestbook', label: 'Weekend postcards', visible: true},
    {id: 'bbbbbbbb-1111-2222-3333-444444444444', app: 'showcase', label: 'Favourite trails', visible: true},
    {id: 'cccccccc-1111-2222-3333-444444444444', app: 'hello', label: 'Withheld label', visible: false},
  ],
};
const row = document => ({id: 'stack-identity-0001', slug: 'trail-notes', revision: 3, published_at: '2026-10-18 00:00:00', document_json: JSON.stringify(document)});
const db = source => ({prepare() { return {bind() { return {async first() { return source; }}}}; }});
const measure = text => Array.from(text).length * 20;

test('script data preserves less-than signs, closing tags, quotes and backslashes exactly', () => {
  for (const title of ['<', '</script>', '"quoted"', String.raw`one\two`, String.raw`<a "quote" \ backslash></script>`]) {
    const data = {title, description: `Description: ${title}`, url: 'https://composer.loftwah.com/s/trail-notes'};
    const payload = stackSharePayload(data);
    assert.equal(payload.includes('<'), false, 'raw script data cannot terminate the HTML script element');
    assert.deepEqual(JSON.parse(payload), data, 'JSON must restore the exact authored strings');
  }
});

test('card identity, copy, alt and visible labels come only from the persisted publication', async () => {
  const persisted = row(sample);
  const first = await stackShareDetails(await publicStack(db(persisted), 'trail-notes'));
  // Mutable draft columns can change while the publication remains unchanged.
  persisted.name = 'Secret renamed draft';
  persisted.draft_json = JSON.stringify({...sample, name: 'Secret renamed draft', description: 'Secret draft description'});
  const later = await stackShareDetails(await publicStack(db(persisted), 'trail-notes'));
  assert.deepEqual(later, first);
  assert.equal(first.url, 'https://composer.loftwah.com/s/trail-notes');
  assert.match(first.imagePath, /^\/s\/trail-notes\/share\/v2-r3-[a-f0-9]{64}\.png$/);
  assert.equal(isStackImageIdentity(first.imageIdentity), true);
  assert.deepEqual(first.apps, ['Weekend postcards', 'Favourite trails']);
  const svg = stackShareSvg(await publicStack(db(persisted), 'trail-notes'), first, measure, brandImage);
  assert.match(svg, /width="1200" height="630"/);
  assert.match(svg, />Trail Notes</);
  assert.doesNotMatch(svg + first.imageAlt + JSON.stringify(first), /Secret|Withheld label/);
});

test('legacy immutable publication JSON retains its exact shape and social identity', async () => {
  const original = {...sample, description: '  Original publication whitespace  ', extension: {reviewed: 'inert public data'}};
  const stack = await publicStack(db(row(original)), 'trail-notes');
  assert.deepEqual(stack.document, original, 'read validation never fills, strips or reorders publication fields');
  assert.equal(JSON.stringify(stack.document), JSON.stringify(original));
  const expected = await stackShareDetails({id: 'stack-identity-0001', slug: 'trail-notes', revision: 3, name: original.name, description: original.description, theme: original.theme, document: original});
  assert.equal((await stackShareDetails(stack)).imageIdentity, expected.imageIdentity);
});

test('republishing, recreated slugs and document changes cannot reuse an image identity', async () => {
  const stack = await publicStack(db(row(sample)), 'trail-notes');
  const original = await stackShareDetails(stack);
  for (const next of [
    {...stack, id: 'new-stack-identity'},
    {...stack, revision: 4},
    {...stack, document: {...stack.document, theme: 'daylight'}},
    {...stack, document: {...stack.document, description: 'A later public description'}},
  ]) assert.notEqual((await stackShareDetails(next)).imageIdentity, original.imageIdentity);
  for (const invalid of ['', '../x', original.imageIdentity + '.png', original.imageIdentity.replace('-r3-', '-r0-'), original.imageIdentity.replace('v2-', 'v1-')]) {
    assert.equal(isStackImageIdentity(invalid), false);
  }
});

test('card text is bounded and XML-safe, including long unspaced words', async () => {
  const hostile = {...sample, name: '</text><image href="https://example.test/private"/>', description: 'A & B < C\u0000'};
  assert.equal(await publicStack(db(row(hostile)), 'trail-notes'), null, 'corrupt stored text is refused before presentation');
  // Exercise the renderer defensively too, independently of the storage guard.
  const valid = await publicStack(db(row(sample)), 'trail-notes');
  const stack = {...valid, name: hostile.name, description: hostile.description, document: {...valid.document, name: hostile.name, description: hostile.description}};
  const share = await stackShareDetails(stack);
  const svg = stackShareSvg(stack, share, measure, brandImage);
  assert.equal(svg.match(/<image\s/g)?.length, 1, 'only the fixed bundled Composer PNG can be an image element');
  assert.ok(svg.includes(`href="${brandImage}"`));
  assert.doesNotMatch(svg, /href="https:|\u0000/);
  assert.match(svg, /&lt;/);
  assert.match(svg, /A &amp; B &lt; C/);
  const lines = wrapCardText('W'.repeat(80), 70, 600, 120, 2, measure);
  assert.equal(lines.length, 2);
  assert.ok(lines.every(line => measure(line) <= 120));
  assert.ok(lines[1].endsWith('…'));
});

test('the Worker route rechecks public visibility and the exact image identity before rendering', () => {
  const route = readFileSync(new URL('../src/pages/s/[slug]/share/[identity].png.ts', import.meta.url), 'utf8');
  assert.ok(route.indexOf('await publicStack(') < route.indexOf('await renderStackShareImage('));
  assert.match(route, /share\.imageIdentity !== params\.identity/);
  assert.match(route, /'Cache-Control': 'no-store'/);
  assert.match(route, /'Content-Type', 'image\/png'/);
  assert.match(route, /status: 404/);
  assert.match(route, /status: 503/);
});

test('deployable browser and QR modules match their checked TypeScript sources', () => {
  execFileSync(process.execPath, ['scripts/stack-share-assets.mjs', '--check'], {cwd: new URL('..', import.meta.url), stdio: 'pipe'});
});

test('the selected Composer PNG is embedded in the rendered card and the independent decoder still reads its QR', async () => {
  assert.equal(createHash('sha256').update(brandBytes).digest('hex'), '46430b9644c2c5332d177745976a2460861f300bd37283591b8dad6d41b22a35');
  const selected = pngjs.PNG.sync.read(brandBytes);
  assert.equal(selected.width, 96);
  assert.equal(selected.height, 96);
  await prepareRenderer();
  for (const theme of ['midnight', 'daylight']) {
    const stack = await publicStack(db(row({...sample, theme})), 'trail-notes');
    const share = await stackShareDetails(stack);
    const svg = stackShareSvg(stack, share, measure, brandImage);
    assert.doesNotMatch(svg, /M72 108h40v40H72z/, 'the superseded geometric mark cannot remain behind the raster');
    const renderer = new Resvg(svg, fontOptions);
    let image;
    try {
      image = renderer.render();
      const card = pngjs.PNG.sync.read(Buffer.from(image.asPng()));
      assert.equal(card.width, 1200);
      assert.equal(card.height, 630);
      const colours = new Set();
      for (let y = 108; y < 156; y++) {
        for (let x = 72; x < 120; x++) {
          const offset = (y * card.width + x) * 4;
          colours.add(card.data.subarray(offset, offset + 4).toString('hex'));
        }
      }
      assert.ok(colours.size > 100, 'the card header must contain the selected raster pixels, not a missing-image blank');
      const result = jsQR(new Uint8ClampedArray(card.data), card.width, card.height);
      assert.equal(result?.data, share.url, `${theme} QR must still decode after embedding the PNG`);
    } finally {
      image?.free();
      renderer.free();
    }
  }
});

test('the checked browser accepts the current image version and refuses the superseded version before fetching', async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.document = {querySelectorAll() { return []; }};
    const {stackShareArtifacts} = await import('../public/brand/stack-share.mjs');
    const stack = await publicStack(db(row(sample)), 'trail-notes');
    const share = await stackShareDetails(stack);
    const data = {slug: stack.slug, revision: stack.revision, title: stack.name, description: share.description, url: share.url, imagePath: share.imagePath, imageUrl: share.imageUrl};
    const element = value => ({querySelector() { return {textContent: JSON.stringify(value)}; }});
    const requested = [];
    globalThis.fetch = async url => { requested.push(url); return new Response(null, {status: 404}); };
    await assert.rejects(stackShareArtifacts(element(data)), /published card is unavailable/);
    assert.deepEqual(requested, [share.imagePath], 'v2 reaches only the publication-derived local PNG route');
    requested.length = 0;
    await assert.rejects(stackShareArtifacts(element({...data, imagePath: data.imagePath.replace('/v2-', '/v1-'), imageUrl: data.imageUrl.replace('/v2-', '/v1-')})), /no published stack to share/);
    assert.equal(requested.length, 0, 'v1 must be refused before any image request');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});

test('the bundled server face renders Latin letters rather than repeated missing-glyph boxes', async () => {
  await prepareRenderer();
  const width = text => {
    const renderer = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="200"><text x="0" y="100" font-family="Space Grotesk" font-size="100">${text}</text></svg>`, fontOptions);
    const bounds = renderer.innerBBox();
    try { return bounds?.width ?? 0; }
    finally { bounds?.free(); renderer.free(); }
  };
  const narrow = width('IIIIIIII');
  const wide = width('WWWWWWWW');
  assert.ok(narrow > 0);
  // A font with no Latin cmap rendered the same .notdef glyph for every
  // character. It parsed without error and had nonzero bounds, so merely
  // accepting the font or observing image dimensions did not catch the defect.
  assert.ok(wide > narrow * 2, `Latin glyph widths must differ: ${wide}/${narrow}`);
});

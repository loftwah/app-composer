import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {publicStack} from '../src/lib/stacks.mjs';
import {stackShareDetails, isStackImageIdentity} from '../src/lib/stack-sharing.ts';
import {stackShareSvg, wrapCardText} from '../src/lib/stack-share-svg.ts';

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

test('card identity, copy, alt and visible labels come only from the persisted publication', async () => {
  const persisted = row(sample);
  const first = await stackShareDetails(await publicStack(db(persisted), 'trail-notes'));
  // Mutable draft columns can change while the publication remains unchanged.
  persisted.name = 'Secret renamed draft';
  persisted.draft_json = JSON.stringify({...sample, name: 'Secret renamed draft', description: 'Secret draft description'});
  const later = await stackShareDetails(await publicStack(db(persisted), 'trail-notes'));
  assert.deepEqual(later, first);
  assert.equal(first.url, 'https://composer.loftwah.com/s/trail-notes');
  assert.match(first.imagePath, /^\/s\/trail-notes\/share\/v1-r3-[a-f0-9]{64}\.png$/);
  assert.equal(isStackImageIdentity(first.imageIdentity), true);
  assert.deepEqual(first.apps, ['Weekend postcards', 'Favourite trails']);
  const svg = stackShareSvg(await publicStack(db(persisted), 'trail-notes'), first, measure);
  assert.match(svg, /width="1200" height="630"/);
  assert.match(svg, />Trail Notes</);
  assert.doesNotMatch(svg + first.imageAlt + JSON.stringify(first), /Secret|Withheld label/);
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
  for (const invalid of ['', '../x', original.imageIdentity + '.png', original.imageIdentity.replace('-r3-', '-r0-')]) {
    assert.equal(isStackImageIdentity(invalid), false);
  }
});

test('card text is bounded and XML-safe, including long unspaced words', async () => {
  const hostile = {...sample, name: '</text><image href="https://example.test/private"/>', description: 'A & B < C\u0000'};
  const stack = await publicStack(db(row(hostile)), 'trail-notes');
  const share = await stackShareDetails(stack);
  const svg = stackShareSvg(stack, share, measure);
  assert.doesNotMatch(svg, /<image|\u0000/);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  checkThisOrThatPhoto, cleanThisOrThatAlt, customThisOrThatAltLimit,
  freezeThisOrThatPhotos, moveThisOrThatCustom,
} from '../src/lib/this-or-that.ts';
import { coverFileLimit, coverPixelLimit } from '../src/lib/top-nine-cover.ts';

// One optional prompt photo per written question. The bytes stay in the tab,
// so every check here works on headers and plain values without decoding.

const u16be = (value) => [value >> 8 & 255, value & 255];
const u32be = (value) => [value >>> 24 & 255, value >>> 16 & 255, value >>> 8 & 255, value & 255];
const png = (width, height) => new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  ...u32be(width), ...u32be(height),
]);
const jpeg = (width, height) => new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, ...u16be(height), ...u16be(width), 3,
]);

test('a written question photo uses the shared real-byte format and size guard', () => {
  assert.deepEqual(checkThisOrThatPhoto(10, png(640, 480)),
    { ok: true, kind: 'png', width: 640, height: 480 });
  assert.deepEqual(checkThisOrThatPhoto(10, jpeg(1920, 1080)),
    { ok: true, kind: 'jpeg', width: 1920, height: 1080 });

  assert.deepEqual(checkThisOrThatPhoto(coverFileLimit + 1, png(640, 480)),
    { ok: false, reason: 'size', limit: coverFileLimit });
  const invalid = [
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    new TextEncoder().encode('<?xml version="1.0"?><svg viewBox="0 0 1 1"/>'),
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]), // GIF
    new TextEncoder().encode('%PDF-1.7'),
    new Uint8Array(),
  ];
  for (const bytes of invalid) {
    assert.deepEqual(checkThisOrThatPhoto(10, bytes), { ok: false, reason: 'format' });
  }

  const huge = checkThisOrThatPhoto(10, png(40000, 40000));
  assert.equal(huge.ok, false);
  assert.equal(huge.reason, 'pixels');
  assert.equal(huge.width * huge.height > coverPixelLimit, true);
  assert.equal(huge.limit, coverPixelLimit);
});

test('the optional description is short, single-spaced and bounded', () => {
  assert.equal(cleanThisOrThatAlt('  A red   door  '), 'A red door');
  assert.equal(cleanThisOrThatAlt('x'.repeat(200)).length, customThisOrThatAltLimit);
  assert.equal(cleanThisOrThatAlt(undefined), '');
});

test('an applied run copies photo values so later editor changes cannot alter it', () => {
  const editor = [
    { url: 'blob:question-one', alt: ' A red door ' },
    null,
    { url: 'blob:question-three', alt: '' },
  ];
  const applied = freezeThisOrThatPhotos(editor, 3);
  assert.deepEqual(applied, [
    { url: 'blob:question-one', alt: 'A red door' },
    null,
    { url: 'blob:question-three', alt: '' },
  ]);
  assert.notEqual(applied[0], editor[0], 'the applied photo is its own object');

  // Replacing or clearing the editor's photo leaves the active run untouched.
  editor[0].url = 'blob:replacement';
  editor[0].alt = 'Changed';
  editor[2] = null;
  assert.deepEqual(applied[0], { url: 'blob:question-one', alt: 'A red door' });
  assert.deepEqual(applied[2], { url: 'blob:question-three', alt: '' });

  // Only local blob URLs count; a crafted data or script URL is not a photo.
  assert.deepEqual(freezeThisOrThatPhotos([
    { url: 'javascript:alert(1)', alt: 'nope' },
    { url: 'data:image/svg+xml,<svg/>', alt: 'nope' },
    { url: 'blob:kept', alt: ' fine ' },
  ], 3), [null, null, { url: 'blob:kept', alt: 'fine' }]);
  assert.equal(freezeThisOrThatPhotos(editor, 2).length, 2, 'the applied count is the played length');
});

test('a move carries the photo and description with the full draft row', () => {
  const draft = [
    ['Prompt one', 'Left one', 'Right one', { url: 'blob:one' }, 'One photo'],
    ['Prompt two', 'Left two', 'Right two', null, ''],
    ['Prompt three', 'Left three', 'Right three', { url: 'blob:three' }, 'Three photo'],
  ];
  const moved = moveThisOrThatCustom(draft, 2, -1, 3);
  assert.deepEqual(moved[0], draft[0]);
  assert.deepEqual(moved[1], draft[2]);
  assert.deepEqual(moved[2], draft[1]);
  assert.notEqual(moved, draft, 'the source draft is never mutated');
  assert.deepEqual(draft[2],
    ['Prompt three', 'Left three', 'Right three', { url: 'blob:three' }, 'Three photo'],
    'the source row still holds its own photo');

  // A hidden row never moves into play or loses its attached photo.
  assert.deepEqual(moveThisOrThatCustom(draft, 2, 1, 2), draft);
});

test('the editor and stage carry one optional photo, not one per choice', async () => {
  const component = await readFile(
    new URL('../src/components/share-experiences/ShareExperience.astro', import.meta.url),
    'utf8',
  );
  assert.equal((component.match(/data-tot-custom-photo(?![-\w])/g) ?? []).length, 1,
    'each generated row has one hidden file input');
  assert.equal(component.includes('accept="image/png,image/jpeg,image/webp"'), true,
    'the picker offers only the three sniffed formats');
  assert.equal(component.includes('image/svg'), false);
  assert.equal(component.includes('data-tot-question-photo'), true, 'the stage can show the photo');
  assert.equal(component.includes('data-tot-custom-left-photo'), false);
  assert.equal(component.includes('data-tot-custom-right-photo'), false);
  assert.match(component, /maxlength=\{customThisOrThatAltLimit\}/);

  const controller = await readFile(
    new URL('../src/browser/share-experiences.ts', import.meta.url),
    'utf8',
  );
  assert.match(controller, /checkThisOrThatPhoto\(file\.size, head\)/,
    'the real bytes are checked before any decode');
  assert.match(controller, /source\.decode\(\)/, 'the accepted file is decoded locally');
  assert.match(controller, /URL\.revokeObjectURL/, 'photo URLs are released');
  assert.match(controller, /pagehide/, 'a real unload releases the remaining photo URLs');
});

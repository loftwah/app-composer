import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  customThisOrThatOptionLimit, customThisOrThatPromptLimit,
  readThisOrThatDraftFile, thisOrThatDraftFileLimit, thisOrThatDraftFileName,
  thisOrThatDraftFileSchema, thisOrThatDraftRowCount, thisOrThatLegacyDraftFileSchema,
  writeThisOrThatDraftFile,
} from '../src/lib/this-or-that.ts';
import { twentyOnePromptFileLimit } from '../src/lib/twenty-one-questions.ts';

// #1064 local question drafts: the editor's eleven rows and active length only.
// No pick, photo, description, URL, storage or run state can travel in the file.

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const blankRows = () => Array.from({ length: thisOrThatDraftRowCount }, () => ['', '', '']);
const check = (value) => readThisOrThatDraftFile(typeof value === 'string' ? value : JSON.stringify(value));

test('v2 strictly round-trips all eleven sanitized rows, hidden drafts, blanks and every active length', () => {
  const rows = Array.from({ length: 11 }, (_, index) =>
    [`  Prompt ${index + 1}?  `, `  Left ${index + 1}  `, ` Right ${index + 1} `]);
  rows[5] = ['', '', ''];
  rows[6] = ['  Hidden   prompt ', '', ' Hidden right '];
  rows[7] = ['   ', '\t', '\n'];
  rows[8] = ['  Prompt\twith\nspace  ', ' Left   space ', ' Right\u00a0space '];
  rows[9] = ['Hidden ten', 'Kept left', 'Kept right'];
  rows[10] = ['', 'Unfinished left', ''];
  const expected = rows.map(([prompt, left, right], index) => index < 5
    ? [`Prompt ${index + 1}?`, `Left ${index + 1}`, `Right ${index + 1}`]
    : [prompt.trim().replace(/\s+/g, ' '), left.trim().replace(/\s+/g, ' '), right.trim().replace(/\s+/g, ' ')]);

  for (const length of [5, 9, 11]) {
    const text = writeThisOrThatDraftFile(rows, length);
    assert.equal(typeof text, 'string');
    assert.equal(writeThisOrThatDraftFile(rows, length), text, 'the same draft always writes the same bytes');
    assert.ok(Buffer.byteLength(text, 'utf8') <= thisOrThatDraftFileLimit);
    assert.equal(thisOrThatDraftFileLimit, twentyOnePromptFileLimit, 'the local JSON bound matches 21 Questions');

    const file = JSON.parse(text);
    assert.deepEqual(Object.keys(file), ['schema', 'rows', 'length'], 'exactly the owned schema, eleven rows and length');
    assert.equal(file.schema, thisOrThatDraftFileSchema);
    assert.equal(thisOrThatDraftFileSchema, 'composer.this-or-that-draft/2');
    assert.equal(thisOrThatDraftFileName, 'composer-this-or-that-draft.json');
    assert.equal(file.length, length);
    assert.equal(file.rows.length, 11);
    assert.deepEqual(file.rows, expected, 'hidden and blank rows survive with exact cleaned text');
    for (const forbidden of ['answers', 'result', 'byline', 'picks', 'marked', 'photos', 'photo', 'alt', 'url', 'href', 'storage', 'request']) {
      assert.equal(Object.keys(file).some((key) => key.toLowerCase().includes(forbidden)), false,
        `no ${forbidden} field travels in the file`);
    }

    const opened = readThisOrThatDraftFile(text);
    assert.equal(opened.fault, null);
    assert.deepEqual(opened.draft, { rows: expected, length });
    assert.equal(opened.gap, -1);
    assert.equal(opened.field, null);
  }

  const unfinished = writeThisOrThatDraftFile(blankRows(), 5);
  assert.ok(unfinished, 'an entirely blank unfinished draft is saveable');
  assert.deepEqual(readThisOrThatDraftFile(unfinished).draft, { rows: blankRows(), length: 5 });
});

test('an exact downloaded v1 nine-row draft restores faithfully with two blank new rows', () => {
  const legacyRows = Array.from({ length: 9 }, (_, index) =>
    [`  Prompt ${index + 1}?  `, `  Left ${index + 1}  `, ` Right ${index + 1} `]);
  legacyRows[5] = ['', '', ''];
  legacyRows[6] = ['  Hidden   prompt ', '', ' Hidden right '];
  legacyRows[8] = ['Prompt\twith\nspace', 'Left   space', 'Right\u00a0space'];
  const cleaned = legacyRows.map(([prompt, left, right]) =>
    [prompt, left, right].map((text) => text.trim().replace(/\s+/g, ' ')));
  for (const length of [5, 9]) {
    const raw = JSON.stringify({ schema: thisOrThatLegacyDraftFileSchema, rows: legacyRows, length });
    assert.equal(thisOrThatLegacyDraftFileSchema, 'composer.this-or-that-draft/1');
    assert.deepEqual(readThisOrThatDraftFile(raw), {
      draft: { rows: [...cleaned, ['', '', ''], ['', '', '']], length },
      fault: null, gap: -1, field: null,
    });
  }

  const valid = { schema: thisOrThatLegacyDraftFileSchema, rows: legacyRows, length: 9 };
  for (const rows of [legacyRows.slice(0, 8), [...legacyRows, ['', '', '']], [...legacyRows, ['', '', ''], ['', '', '']]]) {
    assert.equal(check({ ...valid, rows }).fault, 'shape', 'v1 accepts exactly nine rows');
  }
  assert.equal(check({ ...valid, length: 11 }).fault, 'length', 'v1 never invents an eleven-run');
  assert.equal(check({ ...valid, extra: true }).fault, 'shape', 'v1 keeps the exact three-key shape');
  const overlong = legacyRows.map((row) => [...row]);
  overlong[8][2] = 'x'.repeat(customThisOrThatOptionLimit + 1);
  assert.deepEqual({ fault: check({ ...valid, rows: overlong }).fault, gap: check({ ...valid, rows: overlong }).gap },
    { fault: 'long', gap: 8 }, 'v1 keeps the same per-field bounds');
  assert.equal(writeThisOrThatDraftFile(legacyRows, 9), null, 'new writes never emit the old nine-row shape');
});

test('the widest sanitized eleven-row editor set still fits the byte bound', () => {
  const rows = Array.from({ length: 11 }, () => [
    'é'.repeat(customThisOrThatPromptLimit),
    'é'.repeat(customThisOrThatOptionLimit),
    'é'.repeat(customThisOrThatOptionLimit),
  ]);
  const text = writeThisOrThatDraftFile(rows, 11);
  assert.ok(text);
  assert.ok(Buffer.byteLength(text, 'utf8') <= thisOrThatDraftFileLimit);
  assert.deepEqual(readThisOrThatDraftFile(text).draft, { rows, length: 11 });
});

test('malformed, oversized, foreign, wrong-shape and overlong files return no draft', () => {
  const valid = JSON.parse(writeThisOrThatDraftFile(blankRows(), 5));
  const mutateRows = (change) => {
    const rows = valid.rows.map((row) => [...row]);
    change(rows);
    return { ...valid, rows };
  };

  for (const value of [null, undefined, 5, {}, [], 'not json']) {
    assert.equal(check(value).draft, null);
  }
  assert.equal(check('not json').fault, 'unreadable');
  assert.equal(check([]).fault, 'unreadable');
  assert.equal(check({}).fault, 'schema');
  assert.equal(check({ ...valid, schema: 'composer.this-or-that-draft/3' }).fault, 'version');
  assert.equal(check({ ...valid, schema: 'composer.twenty-one-prompts/1' }).fault, 'schema');
  assert.equal(check({ ...valid, extra: 'x' }).fault, 'shape');
  assert.equal(check({ ...valid, rows: undefined }).fault, 'shape');
  assert.equal(check({ ...valid, rows: valid.rows.slice(0, 8) }).fault, 'shape');
  assert.equal(check({ ...valid, rows: valid.rows.slice(0, 10) }).fault, 'shape');
  assert.equal(check({ ...valid, rows: [...valid.rows, ['', '', '']] }).fault, 'shape');
  assert.equal(check(mutateRows((rows) => { rows[4] = ['one', 'two']; })).fault, 'shape');
  assert.equal(check(mutateRows((rows) => { rows[4] = ['one', 'two', 'three', 'four']; })).fault, 'shape');
  assert.equal(check(mutateRows((rows) => { rows[4][2] = 3; })).fault, 'shape');
  for (const length of [4, 6, 7, 10, 12, '5', null, true]) {
    assert.equal(check({ ...valid, length }).fault, 'length');
  }
  for (const field of ['answers', 'picks', 'marked', 'photos', 'urls', 'requests']) {
    assert.equal(check({ ...valid, [field]: [] }).fault, 'shape', `${field} is not part of the owned schema`);
  }

  const prompt = check(mutateRows((rows) => { rows[7][0] = `  ${'x'.repeat(customThisOrThatPromptLimit + 1)}  `; }));
  assert.deepEqual({ fault: prompt.fault, gap: prompt.gap, field: prompt.field },
    { fault: 'long', gap: 7, field: 'prompt' });
  const left = check(mutateRows((rows) => { rows[3][1] = 'x'.repeat(customThisOrThatOptionLimit + 1); }));
  assert.deepEqual({ fault: left.fault, gap: left.gap, field: left.field },
    { fault: 'long', gap: 3, field: 'left' });
  const right = check(mutateRows((rows) => { rows[8][2] = 'x'.repeat(customThisOrThatOptionLimit + 1); }));
  assert.deepEqual({ fault: right.fault, gap: right.gap, field: right.field },
    { fault: 'long', gap: 8, field: 'right' });

  assert.equal(writeThisOrThatDraftFile(valid.rows.slice(0, 8), 5), null);
  assert.equal(writeThisOrThatDraftFile(valid.rows.slice(0, 10), 11), null);
  assert.equal(writeThisOrThatDraftFile(valid.rows, 7), null);
  assert.equal(writeThisOrThatDraftFile(mutateRows((rows) => { rows[0][0] = 'x'.repeat(73); }), 5), null);

  // Bytes, not characters, are bounded before JSON.parse.
  assert.equal(check('é'.repeat(thisOrThatDraftFileLimit / 2 + 1)).fault, 'oversized');
  assert.equal(check('x'.repeat(thisOrThatDraftFileLimit + 1)).fault, 'oversized');
  for (const value of [
    'not json', {}, { ...valid, answers: [] }, { ...valid, length: 12 },
    mutateRows((rows) => { rows[0][0] = 'x'.repeat(73); }),
  ]) {
    assert.equal(check(value).draft, null, 'every refusal hands back no editor replacement');
  }
});

test('the live route keeps file controls mount-gated, local and separate from the frozen run', () => {
  const route = source('src/pages/share/experiences/[game].astro');
  assert.match(route, /if \(!Object\.hasOwn\(experiences, id\)\) return new Response\("Experience not found", \{ status: 404 \}\);/,
    'the live route still admits only known experiences');
  const middleware = source('src/middleware.ts');
  assert.match(middleware, /twenty-one-questions\|this-or-that\|developer-type\|language-type/);
  assert.match(middleware, /img-src 'self' blob:/);
  assert.match(middleware, /Cache-Control", "no-store"/);

  const markup = source('src/components/share-experiences/ShareExperience.astro');
  const markupStart = markup.indexOf('{isThis && <section data-play-panel');
  const markupEnd = markup.indexOf('{isTwentyOne &&', markupStart);
  assert.ok(markupStart > 0 && markupEnd > markupStart, 'the controls belong to the live This or That panel only');
  const panel = markup.slice(markupStart, markupEnd);
  assert.match(panel, /data-tot-draft-file-save disabled>Save question draft \(\.json\)</);
  assert.match(panel, /accept="application\/json,\.json" data-tot-draft-file/);
  assert.match(panel, /aria-describedby="tot-draft-file-note" disabled/);
  assert.match(panel, /question text and the selected length, including hidden rows/);
  assert.match(panel, /Opening a file replaces the editor/);
  assert.match(panel, /Choose Play my questions to play the opened draft/);
  assert.match(panel, /role="status" data-tot-draft-file-status/);
  assert.equal((markup.match(/data-tot-draft-file-save/g) ?? []).length, 1);

  const controller = source('src/browser/share-experiences.ts');
  assert.match(controller, /import \{[^}]*\bcustomThisOrThatPromptLimit\b[^}]*\} from "\.\.\/lib\/this-or-that\.ts";/,
    'the browser can name the shared limit when a draft prompt is too long');
  const start = controller.indexOf('function mountThisOrThat');
  const end = controller.indexOf('function mountTwentyQuestions', start);
  assert.ok(start > 0 && end > start);
  const block = controller.slice(start, end);
  assert.match(block, /draftFileSave\.disabled = false;/);
  assert.match(block, /draftFileInput\.disabled = false;/);
  assert.match(block, /photoPickRevisions\[index\] = draftRevision;/);
  assert.match(block, /pickedAt !== draftRevision/);
  assert.match(block, /row\.run \+= 1;\s*row\.pending = false;/);

  const handlersStart = block.indexOf('function draftFileProblem');
  const handlersEnd = block.indexOf('// Row moves edit only', handlersStart);
  assert.ok(handlersStart > 0 && handlersEnd > handlersStart);
  const handlers = block.slice(handlersStart, handlersEnd);
  assert.ok(handlers.indexOf('file.size > thisOrThatDraftFileLimit') < handlers.indexOf('await file.text()'),
    'the byte bound is checked before any read');
  assert.match(handlers, /const attempt = \+\+draftFileAttempt;/);
  assert.match(handlers, /const revision = draftRevision;/);
  assert.match(handlers, /if \(attempt !== draftFileAttempt\) return;/);
  assert.match(handlers, /if \(revision !== draftRevision\)/);
  assert.match(handlers, /hasEditorContent\(\) && !window\.confirm\(/);
  assert.match(handlers, /clearEditorPhotos\(\);/);
  assert.match(handlers, /draft\.rows\.forEach\(\(row, index\) => \{/);
  assert.match(handlers, /applyLength\(draft\.length\);/);
  assert.match(handlers, /writeThisOrThatDraftFile\(draftRows\(\), customLength\)/);
  assert.match(handlers, /readThisOrThatDraftFile\(text\)/);
  assert.match(handlers, /link\.download = thisOrThatDraftFileName;/);
  assert.match(handlers, /URL\.revokeObjectURL\(url\)/);
  assert.doesNotMatch(handlers, /playCustom|retextPanels|releaseAppliedPhotos|appliedPhotos\s*=|picks\s*=|custom\s*=|update\(\)/,
    'opening and saving never change the applied run');
  for (const forbidden of [
    'localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'upload',
    'resultLink', 'history.', 'location.', 'file.name',
  ]) {
    assert.equal(handlers.includes(forbidden), false, `the draft file never touches ${forbidden}`);
  }
});

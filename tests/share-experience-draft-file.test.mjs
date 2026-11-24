import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { approvedOpenGoldbergCover } from '../src/lib/top-nine-approved-cover.ts';
import {
  draftFileLimit, draftFileName, draftFileSchema, draftKey, draftVersion,
  readNineDraft, readNineDraftFile, writeNineDraft, writeNineDraftFile,
} from '../src/lib/share-experience-draft.ts';

// #1063 one private, portable Top Nine board file. The stored draft keeps its
// own key and shape; the file is a separate, explicitly versioned boundary
// that opens on the same restore path in a fresh tab or another browser.

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const blank = () => Array.from({ length: 9 }, () => '');
const spotify = 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy';
const hrefs = blank().map((_, index) => (index === 0 || index === 2 ? spotify : null));
const pages = blank().map((_, index) => (index === 0
  ? 'https://example.com/one'
  : index === 2 ? 'https://example.com/three' : null));

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

const board = {
  title: '  Nine   sounds ',
  subtitle: ' One   small  internet ',
  items: [' One ', '', 'Three', 'Four', 'Five', '', 'Seven', 'Eight', 'Nine'],
  byline: ' Editor ',
  profile: 'https://example.com/@dean',
  skin: 2,
  ranked: true,
  hrefs,
  pages,
};
const cleaned = {
  title: 'Nine sounds',
  subtitle: 'One small internet',
  items: ['One', '', 'Three', 'Four', 'Five', '', 'Seven', 'Eight', 'Nine'],
  byline: 'Editor',
  profile: 'https://example.com/@dean',
  skin: 2,
  ranked: true,
  hrefs,
  pages,
};

test('a complete board round-trips through one portable file in a fresh browser', () => {
  const text = writeNineDraftFile(board);
  assert.equal(typeof text, 'string');
  assert.ok(Buffer.byteLength(text, 'utf8') <= draftFileLimit, 'the written file obeys its own bound');
  assert.equal(writeNineDraftFile(board), text, 'the same board always writes the same bytes');

  const opened = readNineDraftFile(text);
  assert.equal(opened.fault, null);
  assert.deepEqual(opened.draft, cleaned);

  // A fresh browser has no stored value: the file alone restores the board,
  // and saving there writes the unchanged stored shape.
  const fresh = storage();
  assert.equal(readNineDraft(fresh), null);
  assert.equal(writeNineDraft(fresh, opened.draft), 'saved');
  assert.deepEqual(readNineDraft(fresh), cleaned);
  const stored = JSON.parse(fresh.values.get(draftKey('top-nine')));
  assert.equal(stored.version, draftVersion);
  assert.equal('schema' in stored, false);
});

test('the file has its own schema boundary and never becomes the stored value', () => {
  assert.equal(draftFileSchema, 'composer.top-nine-draft/1');
  assert.equal(draftFileName, 'composer-top-nine-draft.json');
  const saved = JSON.parse(writeNineDraftFile(board));
  assert.deepEqual(Object.keys(saved), [
    'schema', 'title', 'items', 'subtitle', 'byline', 'profile', 'skin', 'ranked', 'hrefs', 'pages',
  ]);
  assert.equal(saved.schema, draftFileSchema);
  assert.equal('version' in saved, false, 'a file is never mistaken for the stored value');
  const text = writeNineDraftFile(board);
  assert.equal(text.includes('composer.share-experience'), false, 'the file never names a storage key');
  assert.equal(/cover/i.test(text), false, 'no cover field or pixels travel in the file');

  // The stored reader keeps refusing a file, and the file reader keeps
  // refusing a stored value: the two boundaries stay separate.
  assert.equal(readNineDraft(storage({ [draftKey('top-nine')]: text })), null);
  const storedOnly = storage();
  writeNineDraft(storedOnly, board);
  assert.equal(readNineDraftFile(storedOnly.values.get(draftKey('top-nine'))).fault, 'schema');
});

test('a board without optional fields keeps the older stored and file shapes', () => {
  const plain = { title: 'Nine', items: blank() };
  const storedOnly = storage();
  writeNineDraft(storedOnly, plain);
  assert.equal(
    storedOnly.values.get(draftKey('top-nine')),
    JSON.stringify({ version: draftVersion, title: 'Nine', items: blank(), byline: '', skin: 0 }),
    'the pre-file stored bytes are unchanged',
  );
  const saved = JSON.parse(writeNineDraftFile(plain));
  assert.deepEqual(Object.keys(saved), ['schema', 'title', 'items', 'byline', 'skin']);
  assert.deepEqual(readNineDraftFile(writeNineDraftFile(plain)).draft, {
    title: 'Nine', items: blank(), byline: '', skin: 0,
  });
  // A stored draft from before subtitles, links and ranking still opens exactly
  // as it did, through the cleaning both readers share.
  const old = storage({
    [draftKey('top-nine')]: JSON.stringify({ version: draftVersion, title: 'Nine', items: blank() }),
  });
  assert.deepEqual(readNineDraft(old), { title: 'Nine', items: blank(), byline: '', skin: 0 });
  assert.deepEqual(readNineDraftFile(writeNineDraftFile(readNineDraft(old))).draft, readNineDraft(old));
});

test('nine ordered slots, ranking, style and links survive the widest supported board', () => {
  const long = (prefix) => `${prefix}${'a'.repeat(300 - prefix.length)}`;
  const widest = {
    title: 't'.repeat(72),
    subtitle: 's'.repeat(70),
    items: Array.from({ length: 9 }, (_, index) => `Exhibit ${index + 1} ${'x'.repeat(40)}`),
    byline: 'b'.repeat(48),
    profile: long('https://example.com/'),
    skin: 1,
    ranked: true,
    hrefs: Array.from({ length: 9 }, () => spotify),
    pages: Array.from({ length: 9 }, () => long('https://example.com/')),
  };
  const text = writeNineDraftFile(widest);
  assert.ok(Buffer.byteLength(text, 'utf8') <= draftFileLimit,
    'the largest board the editor can build still fits one file');
  const read = readNineDraftFile(text);
  assert.equal(read.fault, null);
  assert.equal(read.draft.items.length, 9);
  assert.deepEqual(read.draft.items, widest.items);
  assert.equal(read.draft.ranked, true);
  assert.equal(read.draft.skin, 1);
  assert.deepEqual(read.draft.hrefs, widest.hrefs);
  assert.deepEqual(read.draft.pages, widest.pages);
});

test('invalid, foreign and oversized files are refused without a board', () => {
  const valid = JSON.parse(writeNineDraftFile(board));
  const check = (value) => readNineDraftFile(typeof value === 'string' ? value : JSON.stringify(value));

  assert.equal(check('not json').fault, 'unreadable');
  assert.equal(check(null).fault, 'unreadable');
  assert.equal(check('[]').fault, 'unreadable');
  assert.equal(check('{}').fault, 'schema');
  assert.equal(check({ ...valid, schema: 'composer.top-nine-draft/2' }).fault, 'version');
  assert.equal(check({ ...valid, schema: 'composer.persona-quiz-draft/1' }).fault, 'schema');
  assert.equal(check({ ...valid, cover: 'data:image/png;base64,xx' }).fault, 'shape');
  assert.equal(check({ ...valid, items: valid.items.slice(0, 8) }).fault, 'shape');
  assert.equal(check({ ...valid, items: [1, ...valid.items.slice(1)] }).fault, 'shape');
  assert.equal(check({ ...valid, skin: 3 }).fault, 'shape');
  assert.equal(check({ ...valid, ranked: 'yes' }).fault, 'shape');
  assert.equal(check({ ...valid, hrefs: Array.from({ length: 10 }, () => spotify) }).fault, 'shape');
  assert.equal(check({ ...valid, pages: Array.from({ length: 10 }, () => 'https://example.com/') }).fault, 'shape');
  assert.equal(check({ ...valid, title: '   ', items: blank() }).fault, 'empty');
  for (const value of ['not json', '{}', { ...valid, items: [] }, { ...valid, title: '', items: blank() }]) {
    assert.equal(check(value).draft, null, 'every fault hands back no board to apply');
  }

  // Bytes, not characters, are bounded before the browser parses anything.
  assert.equal(check('é'.repeat(draftFileLimit / 2 + 1)).fault, 'oversized');
  assert.equal(check('x'.repeat(draftFileLimit + 1)).fault, 'oversized');
});

test('unsafe links drop from a file exactly as they drop from a stored draft', () => {
  const saved = JSON.parse(writeNineDraftFile(board));
  saved.profile = 'http://example.com/you';
  saved.pages = ['javascript:alert(1)', ...pages.slice(1)];
  saved.hrefs = ['https://example.com/not-a-source', ...hrefs.slice(1)];
  const read = readNineDraftFile(JSON.stringify(saved));
  assert.equal(read.fault, null);
  assert.equal('profile' in read.draft, false);
  assert.deepEqual(read.draft.pages, [null, null, 'https://example.com/three', ...blank().slice(3).map(() => null)]);
  assert.deepEqual(read.draft.hrefs, [null, null, spotify, ...blank().slice(3).map(() => null)]);
});

test('the file controls are local, bounded and leave the browser draft path intact', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  assert.match(stage, /class="nine-board-links">\s+<button type="button"[^>]+data-draft-save>Save draft</);
  assert.match(stage, /class="secondary" data-draft-open hidden>Open saved draft</);
  assert.match(stage, /class="secondary" data-draft-clear>Clear saved draft</);
  assert.match(stage, /data-draft-file-save disabled>Download draft file</);
  assert.match(stage, /accept="application\/json,\.json" data-draft-file disabled/);
  assert.match(stage, /role="status" data-draft-file-status/);
  assert.match(stage, /id="nine-draft-file-note">A draft file keeps your board, links and approved covers/);
  assert.match(stage, /Save a PNG if you want to share your custom artwork/);

  const controller = source('src/browser/share-experiences.ts');
  const start = controller.indexOf('function mountNine');
  const end = controller.indexOf('function mountThisOrThat', start);
  assert.ok(start > 0 && end > start, 'the exhibition editor exists');
  const nine = controller.slice(start, end);
  assert.ok(nine.indexOf('file.size > draftFileLimit') < nine.indexOf('await file.text()'),
    'the byte bound is checked before any read');
  assert.match(nine, /const attempt = \+\+draftFileAttempt;/);
  assert.match(nine, /if \(attempt !== draftFileAttempt\) return;/);
  assert.match(nine, /const before = boardSignature\(\);/);
  assert.match(nine, /if \(boardSignature\(\) !== before\)/);
  assert.match(nine, /const read = readNineDraftFile\(text\);/);
  assert.match(nine, /applyDraft\(read\.draft\);/);
  assert.match(nine, /writeNineDraftFile\(boardDraft\(\)\)/);
  assert.match(nine, /if \(!readNineDraftFile\(text\)\.draft\)/);
  assert.match(nine, /URL\.revokeObjectURL\(url\)/);
  assert.match(nine, /for \(const control of \[saveDraftFile, openDraftFile\]\) control\.disabled = false;/);

  const handlersStart = nine.indexOf('function draftFileProblem');
  const handlersEnd = nine.indexOf('markTarget();', handlersStart);
  assert.ok(handlersStart > 0 && handlersEnd > handlersStart, 'both file handlers exist');
  const handlers = nine.slice(handlersStart, handlersEnd);
  for (const forbidden of ['localStorage', 'fetch(', 'XMLHttpRequest', 'sessionStorage', 'covers[']) {
    assert.equal(handlers.includes(forbidden), false, `a draft file never touches ${forbidden}`);
  }
});

test('saved and portable drafts preserve only approved cover references and their fit', () => {
  const album = 'https://music.apple.com/us/album/open-goldberg/1162185845';
  const ref = { id: approvedOpenGoldbergCover.id, fit: 'contain' };
  const approvedCovers = [ref, ...Array(8).fill(null)];
  const draft = { ...board, hrefs: [album, ...Array(8).fill(null)], approvedCovers };
  const local = storage();
  assert.equal(writeNineDraft(local, draft), 'saved');
  assert.deepEqual(readNineDraft(local).approvedCovers, approvedCovers);
  assert.deepEqual(readNineDraftFile(writeNineDraftFile(draft)).draft.approvedCovers, approvedCovers);
  const withoutTitle = { ...draft, items: ['', ...draft.items.slice(1)] };
  assert.equal(JSON.parse(writeNineDraftFile(withoutTitle)).approvedCovers, undefined);
  const file = JSON.parse(writeNineDraftFile(draft));
  file.approvedCovers[0].url = 'https://example.com/art.png';
  assert.equal(readNineDraftFile(JSON.stringify(file)).fault, 'shape');
  delete file.approvedCovers[0].url;
  file.hrefs[0] = spotify;
  assert.equal(readNineDraftFile(JSON.stringify(file)).fault, 'shape');
});

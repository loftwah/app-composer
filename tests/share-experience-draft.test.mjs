import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearNineDraft, draftKey, draftLimit, draftVersion, readNineDraft, writeNineDraft,
} from '../src/lib/share-experience-draft.ts';

// A creator draft is one bounded, versioned value in local storage. These
// checks cover the stored contract only; the editor journey is verified in a
// browser (see tests/README.md route in the PR).
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}
const blank = () => Array.from({ length: 9 }, () => '');
const payload = (value) => JSON.stringify(value);

test('a partial exhibition round-trips through one versioned key', () => {
  const storage = fakeStorage();
  const outcome = writeNineDraft(storage, {
    title: `  Nine   things   `, items: [' One ', '', 'Three', ...Array(6).fill('')], byline: ' Editor ', skin: 2,
  });
  assert.equal(outcome, 'saved');
  assert.equal(storage.data.has(draftKey('top-nine')), true);
  assert.equal(storage.data.get(draftKey('top-nine')).includes(`"version":${draftVersion}`), true);
  assert.deepEqual(readNineDraft(storage), {
    title: 'Nine things', items: ['One', '', 'Three', ...Array(6).fill('')], byline: 'Editor', skin: 2,
  });
});

test('saved text keeps the editor limits', () => {
  const storage = fakeStorage();
  writeNineDraft(storage, { title: 'x'.repeat(80), items: [...Array(8).fill('y'.repeat(60)), 'z'] });
  const draft = readNineDraft(storage);
  assert.equal(draft.title.length, 72);
  assert.equal(draft.items[0].length, 54);
  assert.equal(draft.items[8], 'z');
});

test('foreign, malformed, oversized and empty values are ignored', () => {
  const cases = [
    payload({ version: 2, title: 'Nine', items: [...Array(8).fill('a'), 'b'] }),
    payload({ version: 1, title: 'Nine', items: ['a'] }),
    payload({ version: 1, title: 'Nine', items: [...Array(8).fill('a'), 'b'], extra: 'x'.repeat(draftLimit) }),
    '{not json',
    payload({ version: 1, title: '   ', items: blank() }),
    '',
  ];
  for (const raw of cases) {
    const storage = fakeStorage({ [draftKey('top-nine')]: raw });
    assert.equal(readNineDraft(storage), null);
  }
});

test('blocked storage reports itself and stays readable as empty', () => {
  const blocked = {
    getItem() { return null; },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(writeNineDraft(blocked, { title: 'Nine', items: blank() }), 'blocked');
  assert.equal(readNineDraft(blocked), null);
  assert.equal(clearNineDraft(blocked), false);
});

test('clear removes only the exhibition draft', () => {
  const storage = fakeStorage({ 'composer-theme': 'dark' });
  writeNineDraft(storage, { title: 'Nine', items: blank() });
  assert.equal(clearNineDraft(storage), true);
  assert.equal(readNineDraft(storage), null);
  assert.equal(storage.data.get('composer-theme'), 'dark');
});

test('an empty editor cannot overwrite a saved exhibition', () => {
  const storage = fakeStorage();
  writeNineDraft(storage, { title: 'Nine', items: blank() });
  assert.equal(writeNineDraft(storage, { title: '', items: blank() }), 'empty');
  assert.equal(readNineDraft(storage).title, 'Nine');
});

const album = (id) => `https://music.apple.com/au/album/${id}`;
const song = (id) => `https://open.spotify.com/track/${id.padStart(22, 'a')}`;

test('optional per-exhibit links round-trip and keep their exhibit position', () => {
  const storage = fakeStorage();
  const hrefs = [album('1'), null, song('2'), ...Array(6).fill(null)];
  writeNineDraft(storage, { title: 'Nine albums', items: ['Blue', '', 'Kid A', ...Array(6).fill('x')], hrefs });
  assert.deepEqual(readNineDraft(storage).hrefs, hrefs);
  const saved = JSON.parse(storage.data.get(draftKey('top-nine')));
  assert.deepEqual(saved.hrefs, hrefs);
});

test('an exhibition without music keeps the exact old stored shape', () => {
  const storage = fakeStorage();
  writeNineDraft(storage, { title: 'Nine', items: ['One', ...Array(8).fill('x')] });
  assert.equal(storage.data.get(draftKey('top-nine')).includes('hrefs'), false);
  assert.deepEqual(readNineDraft(storage), {
    title: 'Nine', items: ['One', ...Array(8).fill('x')], byline: '', skin: 0,
  });
  writeNineDraft(storage, { title: 'Nine', items: blank(), hrefs: Array(9).fill(null) });
  assert.equal(storage.data.get(draftKey('top-nine')).includes('hrefs'), false);
  assert.equal('hrefs' in readNineDraft(storage), false);
});

test('stored links stay bounded, HTTPS-only and nine slots wide', () => {
  const storage = fakeStorage();
  writeNineDraft(storage, {
    title: 'Nine', items: ['One', 'Two', ...Array(7).fill('')],
    hrefs: [
      'http://music.apple.com/au/album/blue/1',
      'javascript:alert(1)',
      `https://open.spotify.com/track/${'x'.repeat(300)}`,
      'https://example.com/album',
      ...Array(8).fill(song('9')),
    ],
  });
  assert.deepEqual(readNineDraft(storage).hrefs, [
    null, null, null, null, song('9'), song('9'), song('9'), song('9'), song('9'),
  ]);
});

test('a malformed link list is ignored instead of failing the draft', () => {
  const storage = fakeStorage({
    [draftKey('top-nine')]: payload({
      version: draftVersion, title: 'Nine', items: ['One', ...Array(8).fill('x')], hrefs: 'https://open.spotify.com/track/1',
    }),
  });
  assert.equal(readNineDraft(storage).hrefs, undefined);
});

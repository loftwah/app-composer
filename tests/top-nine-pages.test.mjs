import test from 'node:test';
import assert from 'node:assert/strict';
import { normalisePageLinks, pageLink, pageUrlLimit } from '../src/lib/top-nine-pages.ts';
import { profileUrl, profileUrlLimit } from '../src/lib/top-nine-profile.ts';
import { publicHttpsUrl } from '../src/lib/public-https-url.ts';
import {
  draftKey, draftVersion, readNineDraft, writeNineDraft,
} from '../src/lib/share-experience-draft.ts';

function storage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

const blank = () => Array.from({ length: 9 }, () => '');

test('the page link reuses the exact public HTTPS validator shipped for profiles', () => {
  assert.equal(profileUrlLimit, 300);
  assert.equal(pageUrlLimit, 300);
  for (const value of [
    'https://example.com/thing',
    'https://www.example.co.uk/@dean/thing?tab=page#top',
    'https://example.com',
    'https://example.com:8443/thing',
  ]) {
    assert.equal(pageLink(value), publicHttpsUrl(value, pageUrlLimit));
    assert.equal(pageLink(value), profileUrl(value));
  }
  for (const value of [
    'http://example.com/thing',
    'javascript:alert(1)',
    'ftp://example.com/thing',
    'https://user:secret@example.com/thing',
    'https://localhost/thing',
    'https://app.localhost/thing',
    'https://machine.local/thing',
    'https://127.0.0.1/thing',
    'https://192.168.1.2/thing',
    'https://[::1]/thing',
    'https://intranet/thing',
    'https://example.com/a b',
    'https://example.com\\@evil.test',
    'not a url',
    '',
    '   ',
    null,
    undefined,
    [`https://example.com/thing`],
    `https://example.com/${'a'.repeat(pageUrlLimit)}`,
  ]) {
    assert.equal(pageLink(value), null);
  }
});

test('page links stay positional across nine exhibits', () => {
  const first = 'https://example.com/one';
  const third = 'https://example.org/three?x=1';
  assert.deepEqual(normalisePageLinks([first, null, third]), [first, null, third, ...Array(6).fill(null)]);
  assert.deepEqual(normalisePageLinks([first, 'http://bad', third]), [first, null, third, ...Array(6).fill(null)]);
  assert.deepEqual(normalisePageLinks('https://example.com/thing'), Array(9).fill(null));
});

test('an exact page round-trips in a saved draft beside its exhibit title', () => {
  const store = storage();
  const pages = ['https://example.com/one', null, 'https://example.org/three?x=1#top', ...Array(6).fill(null)];
  const outcome = writeNineDraft(store, {
    title: 'Nine things', items: ['One', '', 'Three', ...Array(6).fill('Else')], pages,
  });
  assert.equal(outcome, 'saved');
  assert.deepEqual(readNineDraft(store).pages, pages);
  assert.deepEqual(JSON.parse(store.values.get(draftKey('top-nine'))).pages, pages);
});

test('invalid or empty pages stay out of the draft and older shapes stay untouched', () => {
  const store = storage();
  writeNineDraft(store, { title: 'Nine', items: blank() });
  assert.equal(store.values.get(draftKey('top-nine')).includes('pages'), false);
  assert.equal('pages' in readNineDraft(store), false);

  writeNineDraft(store, {
    title: 'Nine', items: ['One', ...Array(8).fill('Else')],
    pages: ['https://example.com/one', 'http://example.com/two', 'javascript:alert(1)', ...Array(6).fill(undefined)],
  });
  assert.deepEqual(readNineDraft(store).pages, ['https://example.com/one', ...Array(8).fill(null)]);

  // A page for an empty exhibit is not saved with the draft.
  writeNineDraft(store, {
    title: 'Nine', items: blank(),
    pages: ['https://example.com/one', ...Array(8).fill(null)],
  });
  assert.equal('pages' in readNineDraft(store), false);
});

test('a tampered stored page is dropped on read while the rest of the draft survives', () => {
  const store = storage();
  store.setItem(draftKey('top-nine'), JSON.stringify({
    version: draftVersion,
    title: 'Nine',
    items: ['One', ...Array(8).fill('Else')],
    pages: ['https://example.com/one', 'https://user@example.com/two', 'https://127.0.0.1/three', ...Array(6).fill(null)],
  }));
  assert.deepEqual(readNineDraft(store).pages, ['https://example.com/one', ...Array(8).fill(null)]);

  store.setItem(draftKey('top-nine'), JSON.stringify({
    version: draftVersion, title: 'Nine', items: ['One', ...Array(8).fill('Else')], pages: 'https://example.com/one',
  }));
  assert.equal('pages' in readNineDraft(store), false);
});

test('an older V1 draft without pages opens with its exact shape', () => {
  const store = storage();
  const old = {
    version: draftVersion,
    title: 'Nine',
    items: ['One', ...Array(8).fill('Else')],
    subtitle: 'A line',
    byline: 'Dean',
    skin: 2,
    ranked: true,
    hrefs: [null, 'https://www.wikidata.org/wiki/Q2', ...Array(7).fill(null)],
  };
  store.setItem(draftKey('top-nine'), JSON.stringify(old));
  const { version: _version, ...restored } = old;
  assert.deepEqual(readNineDraft(store), restored);
  assert.equal('pages' in readNineDraft(store), false);
});

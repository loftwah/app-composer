import test from 'node:test';
import assert from 'node:assert/strict';
import { profileUrl, profileUrlLimit } from '../src/lib/top-nine-profile.ts';
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

test('a public HTTPS profile address is accepted and canonical', () => {
  assert.equal(profileUrl('https://example.com/you'), 'https://example.com/you');
  assert.equal(profileUrl('  https://www.example.co.uk/@dean?tab=posts#top  '),
    'https://www.example.co.uk/@dean?tab=posts#top');
  assert.equal(profileUrl('https://example.com'), 'https://example.com/');
  assert.equal(profileUrl('https://example.com:8443/you'), 'https://example.com:8443/you');
  const exact = `https://example.com/${'a'.repeat(profileUrlLimit - 'https://example.com/'.length)}`;
  assert.equal(exact.length, profileUrlLimit);
  assert.equal(profileUrl(exact), exact);
});

test('insecure, credentialled, local and malformed links are rejected', () => {
  for (const value of [
    'http://example.com/you',
    'javascript:alert(1)',
    'ftp://example.com/you',
    'https://user@example.com/you',
    'https://user:secret@example.com/you',
    'https:example.com/you',
    'https:/example.com/you',
    'https://localhost/you',
    'https://localhost./you',
    'https://app.localhost/you',
    'https://app.localhost./you',
    'https://machine.local/you',
    'https://service.internal/you',
    'https://example.test/you',
    'https://127.0.0.1/you',
    'https://192.168.1.2/you',
    'https://[::1]/you',
    'https://intranet/you',
    'https://example.com/a b',
    'https://example.com\\@evil.test',
    'not a url',
    '',
    '   ',
    null,
    undefined,
    ['https://example.com/you'],
    `https://example.com/${'a'.repeat(profileUrlLimit)}`,
  ]) {
    assert.equal(profileUrl(value), null);
  }
});

test('a saved draft with a valid profile round-trips and older fields stay intact', () => {
  const store = storage();
  const hrefs = ['https://www.wikidata.org/wiki/Q1', ...Array(8).fill(null)];
  assert.equal(writeNineDraft(store, {
    title: 'Nine', items: ['One', ...Array(8).fill('x')], subtitle: 'A line',
    byline: 'Dean', profile: 'https://example.com/you', ranked: true, hrefs,
  }), 'saved');
  assert.deepEqual(readNineDraft(store), {
    title: 'Nine', items: ['One', ...Array(8).fill('x')], subtitle: 'A line',
    byline: 'Dean', profile: 'https://example.com/you', skin: 0, ranked: true, hrefs,
  });
});

test('an invalid profile is left out of saved and read data', () => {
  const store = storage();
  writeNineDraft(store, { title: 'Nine', items: Array(9).fill('x'), profile: 'http://example.com/you' });
  assert.equal('profile' in readNineDraft(store), false);
  assert.equal(String(store.values.get(draftKey('top-nine'))).includes('profile'), false);

  // A tampered stored value is dropped on read, just like an untrusted hash.
  store.setItem(draftKey('top-nine'), JSON.stringify({
    version: draftVersion, title: 'Nine', items: Array(9).fill('x'),
    profile: 'javascript:alert(1)',
  }));
  assert.equal('profile' in readNineDraft(store), false);
});

test('older V1 drafts keep their exact shape and load unchanged', () => {
  const store = storage();
  const old = {
    version: draftVersion, title: 'Nine', items: ['One', ...Array(8).fill('x')],
    subtitle: 'A line', byline: 'Dean', skin: 2, ranked: true,
    hrefs: [null, 'https://www.wikidata.org/wiki/Q2', ...Array(7).fill(null)],
  };
  store.setItem(draftKey('top-nine'), JSON.stringify(old));
  const { version: _version, ...restored } = old;
  assert.deepEqual(readNineDraft(store), restored);
  assert.equal('profile' in readNineDraft(store), false);
});

test('a legacy result snapshot without a profile keeps its fields', () => {
  // The fragment is plain JSON; a missing profile must stay missing and an
  // unsafe one must never become a validated link.
  const legacy = { game: 'top-nine', title: 'Nine', items: Array(9).fill('x'), byline: 'Dean', skin: 0 };
  assert.equal('profile' in legacy, false);
  assert.equal(profileUrl(legacy['profile']), null);
  assert.equal(profileUrl({ profile: 'https://example.com/you' }.profile), 'https://example.com/you');
});

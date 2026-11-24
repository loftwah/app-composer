import test from 'node:test';
import assert from 'node:assert/strict';
import { appleBookRef } from '../src/lib/top-nine-books.ts';
import { normaliseSourceLinks, sourceLink } from '../src/lib/top-nine-source.ts';

const apple = 'https://music.apple.com/au/album/discovery/697194953?uo=4';
const spotify = 'https://open.spotify.com/intl-au/album/6b08FpNaFFTjc1dJ9DSWfn?si=tracking';
const book = 'https://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834?uo=4';
const graphic = 'https://books.apple.com/us/book/a-wizard-of-earthsea-a-graphic-novel/id6526483806?uo=4';
const app = 'https://apps.apple.com/au/app/obsidian-connected-notes/id1557175442?uo=4';
const film = 'https://www.wikidata.org/wiki/Q60834962?uselang=en';

test('one resolver types all five supported source providers', () => {
  assert.equal(sourceLink(apple)?.provider, 'Apple Music');
  assert.equal(sourceLink(apple)?.href, 'https://music.apple.com/au/album/697194953');
  assert.equal(sourceLink(spotify)?.provider, 'Spotify');
  assert.equal(sourceLink(spotify)?.href, 'https://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn');
  assert.equal(sourceLink(book)?.provider, 'Apple Books');
  assert.equal(sourceLink(book)?.href, 'https://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834');
  assert.equal(sourceLink(graphic)?.provider, 'Apple Books');
  assert.equal(sourceLink(graphic)?.href,
    'https://books.apple.com/us/book/a-wizard-of-earthsea-a-graphic-novel/id6526483806');
  assert.equal(sourceLink(app)?.provider, 'App Store');
  assert.equal(sourceLink(app)?.href, 'https://apps.apple.com/au/app/obsidian-connected-notes/id1557175442');
  assert.equal(sourceLink(film)?.provider, 'Wikidata');
  assert.equal(sourceLink(film)?.href, 'https://www.wikidata.org/wiki/Q60834962');
});

test('canonical links round-trip unchanged so save, share and reopen keep them', () => {
  for (const href of [
    'https://music.apple.com/au/album/697194953',
    'https://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn',
    'https://books.apple.com/gb/book/the-lathe-of-heaven/id6443080858',
    'https://apps.apple.com/gb/app/1password-8-password-manager/id1511601750',
  ]) {
    assert.equal(sourceLink(href)?.href, href);
  }
  // The Apple Music canonical form keeps only country, kind, id and optional track.
  assert.equal(sourceLink('https://music.apple.com/us/album/blue/123?i=456')?.href,
    'https://music.apple.com/us/album/123?i=456');
});

test('unsupported, insecure and spoofed URLs stay rejected across providers', () => {
  for (const href of [
    'https://books.apple.com.example.test/us/book/a-wizard-of-earthsea/id1602695834',
    'https://apps.apple.com.example.test/au/app/obsidian/id1557175442',
    'https://apps.apple.com/au/developer/dynalist-inc/id1195392807?uo=4',
    'https://apps.apple.com/au/app/obsidian',
    'https://user@books.apple.com/us/book/a-wizard-of-earthsea/id1602695834',
    'http://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834',
    'https://books.apple.com:8443/us/book/a-wizard-of-earthsea/id1602695834',
    'https://itunes.apple.com/us/book/a-wizard-of-earthsea/id1602695834',
    'https://books.apple.com/us/book/a-wizard-of-earthsea',
    'https://books.apple.com/us/book/a-wizard-of-earthsea/id0',
    'https://music.apple.com/au/album/697194953?i=1&i=2',
    'https://open.spotify.com/playlist/6b08FpNaFFTjc1dJ9DSWfn',
    'https://www.wikidata.org/wiki/Special:Search?search=Dune',
    'https://www.wikipedia.org/wiki/Q60834962',
    'https://example.com/book/a-wizard-of-earthsea/id1602695834',
    'javascript:alert(1)',
    'not a url',
    null,
  ]) {
    assert.equal(sourceLink(href), null);
  }
});

test('the verified exact-ID book link keeps one canonical source and ebook ID', () => {
  const pasted = 'https://books.apple.com/us/book/steve-jobs/id431617578?uo=4&si=share';
  assert.deepEqual(sourceLink(pasted), {
    href: 'https://books.apple.com/us/book/steve-jobs/id431617578',
    provider: 'Apple Books',
  });
  assert.deepEqual(appleBookRef(pasted), { country: 'us', id: '431617578' });
  assert.deepEqual(normaliseSourceLinks([pasted]), [
    'https://books.apple.com/us/book/steve-jobs/id431617578',
    ...Array(8).fill(null),
  ]);
});

test('normalised links keep nine positional slots and drop unsupported entries', () => {
  assert.deepEqual(normaliseSourceLinks([apple, book, 'https://example.test', app, film]), [
    'https://music.apple.com/au/album/697194953',
    'https://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834',
    null,
    'https://apps.apple.com/au/app/obsidian-connected-notes/id1557175442',
    'https://www.wikidata.org/wiki/Q60834962',
    null, null, null, null,
  ]);
  assert.deepEqual(normaliseSourceLinks('https://music.apple.com/au/album/1'), Array(9).fill(null));
  assert.deepEqual(normaliseSourceLinks([]), Array(9).fill(null));
});

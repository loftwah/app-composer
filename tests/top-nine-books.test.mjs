import assert from 'node:assert/strict';
import test from 'node:test';
import { bookSource, searchBooks } from '../src/lib/top-nine-books.ts';

const book = 'https://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834?uo=4';
const graphic = 'https://books.apple.com/us/book/a-wizard-of-earthsea-a-graphic-novel/id6526483806?uo=4';

test('rebuilds exact Apple Books source links without query trackers', () => {
  assert.equal(bookSource(book), 'https://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834');
  assert.equal(bookSource(graphic),
    'https://books.apple.com/us/book/a-wizard-of-earthsea-a-graphic-novel/id6526483806');
  assert.equal(bookSource('https://books.apple.com/gb/book/the-lathe-of-heaven/id6443080858'),
    'https://books.apple.com/gb/book/the-lathe-of-heaven/id6443080858');
});

test('ignores spoofed, credentialed, insecure and malformed URLs', () => {
  for (const href of [
    'https://books.apple.com.example.test/us/book/a-wizard-of-earthsea/id1602695834',
    'https://user@books.apple.com/us/book/a-wizard-of-earthsea/id1602695834',
    'http://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834',
    'https://books.apple.com:8443/us/book/a-wizard-of-earthsea/id1602695834',
    'https://itunes.apple.com/us/book/a-wizard-of-earthsea/id1602695834',
    'https://music.apple.com/us/album/discovery/id697194953',
    'https://books.apple.com/us/book/a-wizard-of-earthsea',
    'https://books.apple.com/us/book/a-wizard-of-earthsea/id0',
    'https://books.apple.com/us/book/id1602695834',
    'not a url',
    null,
  ]) {
    assert.equal(bookSource(href), null);
  }
});

test('uses the requested storefront, keeps ebook metadata and preserves distinct editions', async (t) => {
  const bookRow = {
    kind: 'ebook', trackName: 'A Wizard of Earthsea', artistName: 'Ursula K. Le Guin',
    releaseDate: '2012-09-11T07:00:00Z', trackViewUrl: book,
    artworkUrl100: 'https://example.test/cover.jpg', previewUrl: 'https://example.test/sample',
  };
  const graphicRow = {
    kind: 'ebook', trackName: 'A Wizard of Earthsea: A Graphic Novel', artistName: 'Ursula K. Le Guin',
    releaseDate: '2025-03-11T07:00:00Z', trackViewUrl: graphic,
    artworkUrl100: 'https://example.test/cover.jpg',
  };
  const request = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://itunes.apple.com');
    assert.equal(url.pathname, '/search');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      term: 'A Wizard of Earthsea', media: 'ebook', entity: 'ebook', country: 'us', limit: '15',
    });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    return Response.json({ results: [bookRow, graphicRow, bookRow, {
      kind: 'album', trackName: 'A Wizard of Earthsea', artistName: 'Someone',
      trackViewUrl: 'https://music.apple.com/us/album/x/id123',
    }] });
  });
  const picks = await searchBooks('A Wizard of Earthsea', 'US');
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(picks, [
    { title: 'A Wizard of Earthsea', artist: 'Ursula K. Le Guin', year: 2012,
      href: 'https://books.apple.com/us/book/a-wizard-of-earthsea/id1602695834' },
    { title: 'A Wizard of Earthsea: A Graphic Novel', artist: 'Ursula K. Le Guin', year: 2025,
      href: 'https://books.apple.com/us/book/a-wizard-of-earthsea-a-graphic-novel/id6526483806' },
  ]);
  for (const pick of picks) {
    assert.deepEqual(Object.keys(pick).sort(), ['artist', 'href', 'title', 'year']);
  }
});

test('ranks the exact title first and keeps book and graphic editions distinct', async (t) => {
  const near = {
    kind: 'ebook', trackName: 'A Wizard of Earthsea Cycle', artistName: 'Ursula K. Le Guin',
    trackViewUrl: 'https://books.apple.com/us/book/a-wizard-of-earthsea-cycle/id1234567890',
  };
  t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [near, bookRow()] }));
  const picks = await searchBooks('a wizard of earthsea', 'us');
  assert.equal(picks[0].title, 'A Wizard of Earthsea');
  assert.equal(picks[1].title, 'A Wizard of Earthsea Cycle');
});

function bookRow() {
  return {
    kind: 'ebook', trackName: 'A Wizard of Earthsea', artistName: 'Ursula K. Le Guin',
    trackViewUrl: book,
  };
}

test('distinguishes a failed or cancelled search from an empty catalogue result', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(searchBooks('Earthsea', 'US'), /429/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchBooks('Earthsea', 'US', controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(await searchBooks(' ', 'US'), []);
});

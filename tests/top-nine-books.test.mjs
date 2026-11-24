import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { appleBookRef, bookSource, lookupAppleBook, searchBooks } from '../src/lib/top-nine-books.ts';

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

// Verified from the public /lookup response on 24 November 2026: id 431617578
// in the us storefront returns this ebook, title and author. Only these fields
// are read; the cover, description and preview URLs in that response are not.
const steveJobs = 'https://books.apple.com/us/book/steve-jobs/id431617578?uo=4';
function steveJobsRow() {
  return {
    kind: 'ebook', trackId: 431617578, trackName: 'Steve Jobs',
    artistName: 'Walter Isaacson', trackViewUrl: steveJobs,
    artworkUrl100: 'https://example.test/cover.jpg',
    description: '<b>never read</b>',
  };
}

test('reads one exact Apple Books link as its own storefront and ebook ID', () => {
  assert.deepEqual(appleBookRef(steveJobs), { country: 'us', id: '431617578' });
  assert.deepEqual(appleBookRef('https://books.apple.com/gb/book/the-lathe-of-heaven/id6443080858?si=share'),
    { country: 'gb', id: '6443080858' });
  // A tracker-bearing link still resolves to the same canonical book ID, while
  // another provider, a spoofed host, a malformed page or no link never seeds it.
  for (const href of [
    'https://books.apple.com.example.test/us/book/steve-jobs/id431617578',
    'https://user@books.apple.com/us/book/steve-jobs/id431617578',
    'http://books.apple.com/us/book/steve-jobs/id431617578',
    'https://books.apple.com:8443/us/book/steve-jobs/id431617578',
    'https://itunes.apple.com/us/book/steve-jobs/id431617578',
    'https://music.apple.com/us/album/discovery/697194953',
    'https://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn',
    'https://books.apple.com/us/book/steve-jobs',
    'https://books.apple.com/us/book/steve-jobs/id0',
    'https://books.apple.com/us/book/id431617578',
    '', null,
  ]) {
    assert.equal(appleBookRef(href), null);
  }
});

test('looks up one exact ebook by link storefront and ID, never by search', async (t) => {
  const fetches = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://itunes.apple.com');
    assert.equal(url.pathname, '/lookup');
    assert.deepEqual(Object.fromEntries(url.searchParams), { id: '431617578', country: 'us' });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.redirect, 'error');
    return Response.json({ resultCount: 1, results: [steveJobsRow()] });
  });
  assert.deepEqual(await lookupAppleBook(steveJobs), { title: 'Steve Jobs', artist: 'Walter Isaacson' });
  assert.equal(fetches.mock.callCount(), 1);
});

test('applies only an ebook with the matching track ID and canonical source', async (t) => {
  let row = steveJobsRow();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ resultCount: 1, results: [row] }));
  for (const variant of [
    { ...steveJobsRow(), kind: 'album' },
    { ...steveJobsRow(), kind: undefined },
    { ...steveJobsRow(), trackId: 431617579 },
    { ...steveJobsRow(), trackId: '431617579' },
    { ...steveJobsRow(), trackViewUrl: 'https://books.apple.com/us/book/steve-jobs/id431617579' },
    { ...steveJobsRow(), trackViewUrl: 'https://example.test/us/book/steve-jobs/id431617578' },
    { ...steveJobsRow(), trackViewUrl: 'https://books.apple.com/gb/book/steve-jobs/id431617578' },
    { ...steveJobsRow(), trackViewUrl: 'https://music.apple.com/us/album/steve-jobs/id431617578' },
    { ...steveJobsRow(), trackName: '' },
    { ...steveJobsRow(), artistName: '   ' },
  ]) {
    row = variant;
    assert.equal(await lookupAppleBook(steveJobs), null);
  }
});

test('an empty book result keeps the link and offers no title', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ resultCount: 0, results: [] }));
  assert.equal(await lookupAppleBook(steveJobs), null);
});

test('a pasted-book lookup never fetches for a non-book link', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('a lookup must not run for this link');
  });
  assert.equal(await lookupAppleBook('https://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn'), null);
  assert.equal(await lookupAppleBook('https://music.apple.com/us/album/discovery/697194953'), null);
  assert.equal(await lookupAppleBook('https://books.apple.com/us/book/steve-jobs'), null);
  assert.equal(await lookupAppleBook(''), null);
  assert.equal(await lookupAppleBook(null), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test('a failed or cancelled book lookup makes one request and is not retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }));
  await assert.rejects(lookupAppleBook(steveJobs), /500/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lookupAppleBook(steveJobs, controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('the editor submits exact-ID lookups only for an empty exhibit, reusing the shared guards', () => {
  const controller = readFileSync(new URL('../src/browser/share-experiences.ts', import.meta.url), 'utf8');
  assert.match(controller, /if \(!typed\) void fillSourceTitle\(slot, source\.href\);/);
  const start = controller.indexOf('async function fillSourceTitle(');
  const block = controller.slice(start, controller.indexOf('async function runSearch(', start));
  assert.match(block, /pendingLookups\.get\(slot\)\?\.abort\(\)/);
  assert.match(block, /pendingLookups\.set\(slot, controller\)/);
  assert.match(block, /albumTitleApplies\(/);
  assert.match(block, /appleAppRef\(href\)/);
  assert.match(block, /lookupAppleBook\(href, controller\.signal\)/);
  assert.match(block, /lookupAppleAlbum\(href, controller\.signal\)/);
  assert.match(block, /appleSongRef\(href\)/);
  assert.match(block, /lookupAppleSong\(href, controller\.signal\)/);
  assert.match(block, /lookupAppleApp\(href, controller\.signal\)/);
  assert.match(block, /wikidataSource\(href\)/);
  assert.match(block, /lookupWikidataTitle\(href, controller\.signal\)/);
  assert.match(block, /lookupSpotifyAlbumTitle\(href, controller\.signal\)/);
  // No parallel async state: one bounded lookup per paste, through the shared map.
  assert.equal((block.match(/new Map</g) ?? []).length, 0);
  for (const file of ['top-nine-books.ts', 'top-nine-apps.ts']) {
    const lib = readFileSync(new URL(`../src/lib/${file}`, import.meta.url), 'utf8');
    assert.match(lib, /lookupCatalogue\(\{/);
    assert.doesNotMatch(lib, /new Map<|AbortController|fetch\(/);
  }
});

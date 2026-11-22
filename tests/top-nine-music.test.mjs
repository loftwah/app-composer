import assert from 'node:assert/strict';
import test from 'node:test';
import { musicPreview, musicSearchLinks, normaliseMusicPicks, searchMusic } from '../src/lib/top-nine-music.ts';

const apple = 'https://music.apple.com/au/album/discovery/697194953?uo=4';
const spotify = 'https://open.spotify.com/intl-au/album/6b08FpNaFFTjc1dJ9DSWfn?si=tracking';

test('rebuilds approved album and song links without tracking parameters', () => {
  assert.deepEqual(musicPreview(apple), {
    href: 'https://music.apple.com/au/album/697194953',
    embedUrl: 'https://embed.music.apple.com/au/album/697194953',
    provider: 'Apple Music',
  });
  assert.equal(musicPreview('https://music.apple.com/us/song/1078915006').embedUrl,
    'https://embed.music.apple.com/us/song/1078915006');
  assert.equal(musicPreview('https://music.apple.com/gb/album/123456789?i=123456780&uo=4').embedUrl,
    'https://embed.music.apple.com/gb/album/123456789?i=123456780');
  assert.equal(musicPreview(spotify).embedUrl, 'https://open.spotify.com/embed/album/6b08FpNaFFTjc1dJ9DSWfn');
});

test('ignores spoofed, credentialed, conflicting and unsupported URLs', () => {
  for (const href of [
    'https://music.apple.com.example.test/au/album/697194953',
    'https://user@music.apple.com/au/album/697194953',
    'http://music.apple.com/au/album/697194953',
    'https://music.apple.com/au/album/697194953?i=1&i=2',
    'https://open.spotify.com/playlist/6b08FpNaFFTjc1dJ9DSWfn',
    'https://music.apple.com/au/album/other',
  ]) {
    assert.equal(musicPreview(href), null);
  }
  assert.deepEqual(normaliseMusicPicks([null, apple, 'https://example.test', spotify]), [
    null, 'https://music.apple.com/au/album/697194953', null, 'https://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn',
    null, null, null, null, null,
  ]);
});

test('builds only the verified official search routes for the selected storefront', () => {
  assert.deepEqual(musicSearchLinks('Nujabes Modal Soul', 'US'), {
    apple: 'https://music.apple.com/us/search?term=Nujabes%20Modal%20Soul',
    spotify: 'https://open.spotify.com/search/Nujabes%20Modal%20Soul',
  });
  assert.deepEqual(musicSearchLinks('サカナクション', 'JP'), {
    apple: 'https://music.apple.com/jp/search?term=%E3%82%B5%E3%82%AB%E3%83%8A%E3%82%AF%E3%82%B7%E3%83%A7%E3%83%B3',
    spotify: 'https://open.spotify.com/search/%E3%82%B5%E3%82%AB%E3%83%8A%E3%82%AF%E3%82%B7%E3%83%A7%E3%83%B3',
  });
  assert.equal(musicSearchLinks('A & B/C?', 'gb').apple,
    'https://music.apple.com/gb/search?term=A%20%26%20B%2FC%3F');
  assert.equal(musicSearchLinks('Modal Soul', '??').apple,
    'https://music.apple.com/us/search?term=Modal%20Soul');
  // A UI slice can cut a surrogate pair; encode from a well-formed term so the
  // recovery catch path never re-throws, while intact terms stay unchanged.
  assert.equal(musicSearchLinks('Nujabes \uD83C', 'US').apple,
    'https://music.apple.com/us/search?term=Nujabes%20%EF%BF%BD');
});

test('uses the requested storefront and keeps only album metadata and exact canonical editions', async (t) => {
  const row = {
    collectionName: 'Discovery', artistName: 'Daft Punk', releaseDate: '2001-03-13T08:00:00Z',
    collectionViewUrl: apple, previewUrl: 'https://example.test/song.m4a', artworkUrl100: 'https://example.test/cover.jpg',
  };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://itunes.apple.com');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      term: 'Discovery', media: 'music', entity: 'album', country: 'au', limit: '15',
    });
    assert.equal(init.credentials, 'omit');
    return Response.json({ results: [row, row] });
  });
  assert.deepEqual(await searchMusic('Discovery', 'album', 'AU'), [
    { title: 'Discovery', artist: 'Daft Punk', year: 2001, href: 'https://music.apple.com/au/album/697194953' },
  ]);
});

test('distinguishes a failed or cancelled search from an empty catalogue result', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', {status: 429}));
  await assert.rejects(searchMusic('Discovery', 'album', 'AU'), /429/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchMusic('Discovery', 'album', 'AU', controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

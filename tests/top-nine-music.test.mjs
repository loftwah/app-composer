import assert from 'node:assert/strict';
import test from 'node:test';
import { musicPreview, normaliseMusicPicks, searchMusic } from '../src/lib/top-nine-music.ts';

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

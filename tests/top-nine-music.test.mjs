import assert from 'node:assert/strict';
import test from 'node:test';
import {
  albumTitleApplies, appleAlbumRef, lookupAppleAlbum, lookupSpotifyAlbumTitle,
  musicPreview, musicSearchLinks, normaliseMusicPicks, searchMusic, spotifyAlbumRef,
} from '../src/lib/top-nine-music.ts';

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
    // A player URL with an extra path segment is too wide for the strict ID parser.
    'https://open.spotify.com/embed/album/6b08FpNaFFTjc1dJ9DSWfn/related',
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
      term: 'Discovery', media: 'music', entity: 'album', country: 'au', limit: '30',
    });
    assert.equal(init.credentials, 'omit');
    return Response.json({ results: [row, row] });
  });
  assert.deepEqual(await searchMusic('Discovery', 'album', 'AU'), [
    { title: 'Discovery', artist: 'Daft Punk', year: 2001, href: 'https://music.apple.com/au/album/697194953' },
  ]);
});

test('asks for up to thirty song rows on the same single catalogue request', async (t) => {
  const row = {
    kind: 'song', trackName: 'Digital Love', artistName: 'Daft Punk', releaseDate: '2001-03-13T08:00:00Z',
    trackViewUrl: 'https://music.apple.com/au/song/digital-love/697194960?uo=4',
  };
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      term: 'Digital Love', media: 'music', entity: 'song', country: 'au', limit: '30',
    });
    return Response.json({ results: [row] });
  });
  assert.deepEqual(await searchMusic('Digital Love', 'song', 'AU'), [
    { title: 'Digital Love', artist: 'Daft Punk', year: 2001, href: 'https://music.apple.com/au/song/697194960' },
  ]);
  assert.equal(fetch.mock.callCount(), 1);
});

test('distinguishes a failed or cancelled search from an empty catalogue result', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', {status: 429}));
  await assert.rejects(searchMusic('Discovery', 'album', 'AU'), /429/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchMusic('Discovery', 'album', 'AU', controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

const modalSoul = 'https://music.apple.com/au/album/modal-soul/1078914477?uo=4';
const modalSoulRow = {
  wrapperType: 'collection', collectionType: 'Album', collectionId: 1078914477,
  collectionName: 'Modal Soul', artistName: 'Nujabes',
  collectionViewUrl: 'https://music.apple.com/au/album/modal-soul/1078914477?uo=4',
  artworkUrl100: 'https://example.test/art.jpg', previewUrl: 'https://example.test/track.m4a',
};

test('reads a pasted canonical album link as its own storefront and collection ID', () => {
  assert.deepEqual(appleAlbumRef(modalSoul), { country: 'au', id: '1078914477' });
  assert.deepEqual(appleAlbumRef('https://music.apple.com/tw/album/greatest-works/1632190508'),
    { country: 'tw', id: '1632190508' });
  // A track inside an album, a song link, Spotify and unknown hosts are not
  // album choices, so they never seed an album lookup.
  for (const href of [
    'https://music.apple.com/au/album/697194953?i=697194960',
    'https://music.apple.com/au/song/digital-love/697194960',
    spotify, 'https://example.test/au/album/697194953', '', null,
  ]) {
    assert.equal(appleAlbumRef(href), null);
  }
});

test('looks up one exact album by link country and collection ID, never by search', async (t) => {
  const fetches = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://itunes.apple.com');
    assert.equal(url.pathname, '/lookup');
    assert.deepEqual(Object.fromEntries(url.searchParams), { id: '1078914477', country: 'au' });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.redirect, 'error');
    return Response.json({ resultCount: 1, results: [modalSoulRow] });
  });
  assert.deepEqual(await lookupAppleAlbum(modalSoul), { title: 'Modal Soul', artist: 'Nujabes' });
  assert.equal(fetches.mock.callCount(), 1);
});

test('applies only a matching collection ID behind a canonical album source', async (t) => {
  let row = modalSoulRow;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [row] }));
  for (const variant of [
    { ...modalSoulRow, collectionId: 697194953 },
    { ...modalSoulRow, collectionViewUrl: 'https://music.apple.com/au/song/modal-soul/1078914477' },
    { ...modalSoulRow, collectionViewUrl: 'https://example.test/au/album/modal-soul/1078914477' },
    { ...modalSoulRow, collectionName: '' },
    { ...modalSoulRow, artistName: '' },
  ]) {
    row = variant;
    assert.equal(await lookupAppleAlbum(modalSoul), null);
  }
});

test('a pasted-link lookup never fetches for a non-album link', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('a lookup must not run for this link');
  });
  assert.equal(await lookupAppleAlbum('https://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn'), null);
  assert.equal(await lookupAppleAlbum('https://music.apple.com/au/album/697194953?i=697194960'), null);
  assert.equal(await lookupAppleAlbum(''), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test('a failed or cancelled lookup makes one request and is not retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', {status: 500}));
  await assert.rejects(lookupAppleAlbum(modalSoul), /500/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lookupAppleAlbum(modalSoul, controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('a late album title only lands on the same link in a still-empty slot', () => {
  const href = 'https://music.apple.com/au/album/697194953';
  assert.equal(albumTitleApplies({ href, title: '' }, href), true);
  assert.equal(albumTitleApplies({ href, title: '   ' }, href), true);
  // An authored title, a replaced link, a moved exhibit or an emptied slot
  // always wins over the response that arrived after the change.
  assert.equal(albumTitleApplies({ href, title: 'Discovery · Daft Punk' }, href), false);
  assert.equal(albumTitleApplies({ href: null, title: '' }, href), false);
  assert.equal(albumTitleApplies({ href: 'https://music.apple.com/au/album/1078914477', title: '' }, href), false);
});

const spotifyAlbum = 'https://open.spotify.com/intl-au/album/6b08FpNaFFTjc1dJ9DSWfn?si=tracking';
const spotifyAlbumId = '6b08FpNaFFTjc1dJ9DSWfn';
const spotifyPayload = {
  html: '<iframe title="Spotify Embed: Modal Soul"></iframe>',
  iframe_url: `https://open.spotify.com/embed/album/${spotifyAlbumId}?utm_source=oembed`,
  width: 456, height: 352, version: '1.0',
  provider_name: 'Spotify', provider_url: 'https://spotify.com', type: 'rich',
  title: 'Modal Soul',
  thumbnail_url: 'https://image-cdn-fa.spotifycdn.com/image/example',
};

test('reads a pasted Spotify album link as its own canonical album ID', () => {
  assert.deepEqual(spotifyAlbumRef(spotifyAlbum), { id: spotifyAlbumId });
  assert.deepEqual(spotifyAlbumRef(`https://open.spotify.com/album/${spotifyAlbumId}`),
    { id: spotifyAlbumId });
  // Tracks, playlists, Apple links, shortened links and spoofed hosts never
  // seed an album lookup.
  for (const href of [
    `https://open.spotify.com/track/${spotifyAlbumId}`,
    'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    'https://open.spotify.com/album/too-short',
    'https://spotify.link/abc123',
    'https://open.spotify.com.example.test/album/6b08FpNaFFTjc1dJ9DSWfn',
    apple, '', null,
  ]) {
    assert.equal(spotifyAlbumRef(href), null);
  }
});

test('rebuilds the official Spotify player URLs pasted back as canonical sources', () => {
  const albumEmbed = `https://open.spotify.com/embed/album/${spotifyAlbumId}`;
  assert.deepEqual(musicPreview(albumEmbed), {
    href: `https://open.spotify.com/album/${spotifyAlbumId}`,
    embedUrl: albumEmbed,
    provider: 'Spotify',
  });
  const trackEmbed = 'https://open.spotify.com/embed/track/3KkXRkHbMCARz0aVfEt68P';
  assert.deepEqual(musicPreview(trackEmbed), {
    href: 'https://open.spotify.com/track/3KkXRkHbMCARz0aVfEt68P',
    embedUrl: trackEmbed,
    provider: 'Spotify',
  });
  // Pasted parameters and fragments never reach the source link or the frame,
  // and normal/storefront paths still parse exactly as before.
  assert.deepEqual(musicPreview(`${albumEmbed}?si=tracking&utm_source=copy#player`), {
    href: `https://open.spotify.com/album/${spotifyAlbumId}`,
    embedUrl: albumEmbed,
    provider: 'Spotify',
  });
  assert.equal(musicPreview(spotify).embedUrl, albumEmbed);
  assert.equal(musicPreview('https://open.spotify.com/intl-au/album/6b08FpNaFFTjc1dJ9DSWfn').href,
    `https://open.spotify.com/album/${spotifyAlbumId}`);
  // A pasted player still feeds the album-only oEmbed lookup, but a track
  // player never seeds it.
  assert.deepEqual(spotifyAlbumRef(albumEmbed), { id: spotifyAlbumId });
  assert.equal(spotifyAlbumRef(trackEmbed), null);
});

test('looks up one exact Spotify album through official oEmbed, never by search', async (t) => {
  const fetches = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://open.spotify.com');
    assert.equal(url.pathname, '/oembed');
    // The request carries the parsed canonical album URL, not the pasted
    // share or tracking parameters.
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      url: `https://open.spotify.com/album/${spotifyAlbumId}`,
    });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.redirect, 'error');
    return Response.json(spotifyPayload);
  });
  assert.equal(await lookupSpotifyAlbumTitle(spotifyAlbum), 'Modal Soul');
  assert.equal(fetches.mock.callCount(), 1);
});

test('accepts only the provider and embed frame for the same pasted album', async (t) => {
  let payload = spotifyPayload;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  for (const variant of [
    { ...spotifyPayload, provider_name: 'Example' },
    { ...spotifyPayload, provider_name: undefined },
    { ...spotifyPayload, iframe_url: undefined },
    { ...spotifyPayload, iframe_url: 'https://example.test/embed/album/6b08FpNaFFTjc1dJ9DSWfn' },
    { ...spotifyPayload, iframe_url: 'https://open.spotify.com/embed/track/6b08FpNaFFTjc1dJ9DSWfn' },
    { ...spotifyPayload, iframe_url: 'https://open.spotify.com/embed/album/0b08FpNaFFTjc1dJ9DSWfn' },
    { ...spotifyPayload, iframe_url: `https://open.spotify.com/embed/album/${spotifyAlbumId}?si=tracking` },
    { ...spotifyPayload, title: '' },
    { ...spotifyPayload, title: '   ' },
    { ...spotifyPayload, title: 'x'.repeat(141) },
    { ...spotifyPayload, title: 42 },
  ]) {
    payload = variant;
    assert.equal(await lookupSpotifyAlbumTitle(spotifyAlbum), null);
  }
  // The documented utm_source=oembed marker is the only accepted embed query,
  // and it must not be required for the exact same album.
  payload = { ...spotifyPayload, iframe_url: `https://open.spotify.com/embed/album/${spotifyAlbumId}` };
  assert.equal(await lookupSpotifyAlbumTitle(spotifyAlbum), 'Modal Soul');
});

test('a pasted-link lookup never fetches for a non-album Spotify link', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('a lookup must not run for this link');
  });
  assert.equal(await lookupSpotifyAlbumTitle(`https://open.spotify.com/track/${spotifyAlbumId}`), null);
  assert.equal(await lookupSpotifyAlbumTitle('https://spotify.link/abc123'), null);
  assert.equal(await lookupSpotifyAlbumTitle(modalSoul), null);
  assert.equal(await lookupSpotifyAlbumTitle(''), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test('a failed or cancelled Spotify lookup makes one request and is not retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }));
  await assert.rejects(lookupSpotifyAlbumTitle(spotifyAlbum), /500/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lookupSpotifyAlbumTitle(spotifyAlbum, controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

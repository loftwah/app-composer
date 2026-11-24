import assert from 'node:assert/strict';
import test from 'node:test';
import { appleAppRef, appSource, lookupAppleApp, searchApps } from '../src/lib/top-nine-apps.ts';

// Real iTunes Search row (media=software, entity=software, country=au,
// term=Obsidian), captured 2026-11-22 and trimmed to the fields the picker
// reads. Promo-content terms apply: metadata and link only, never artwork.
const obsidianRow = {
  wrapperType: 'software', kind: 'software', trackName: 'Obsidian - Connected Notes',
  artistName: 'Dynalist Inc.', releaseDate: '2021-07-10T07:00:00Z',
  trackViewUrl: 'https://apps.apple.com/au/app/obsidian-connected-notes/id1557175442?uo=4',
  artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/…/AppIcon…png/100x100bb.jpg',
  screenshotUrls: ['https://is1-ssl.mzstatic.com/image/thumb/…/screen1.jpg'],
};

const clipper = 'https://apps.apple.com/au/app/obsidian-web-clipper/id6720708363';

test('rebuilds exact App Store source links without query trackers', () => {
  assert.equal(appSource(obsidianRow.trackViewUrl),
    'https://apps.apple.com/au/app/obsidian-connected-notes/id1557175442');
  assert.equal(appSource(`${clipper}?uo=4&itscg=30200`), clipper);
  assert.equal(appSource(`${clipper}?platform=iphone`), clipper);
  assert.equal(appSource('https://apps.apple.com/gb/app/1password-8-password-manager/id1511601750'),
    'https://apps.apple.com/gb/app/1password-8-password-manager/id1511601750');
});

test('canonical links round-trip unchanged', () => {
  for (const href of [
    'https://apps.apple.com/au/app/obsidian-connected-notes/id1557175442',
    'https://apps.apple.com/gb/app/1password-8-password-manager/id1511601750',
  ]) {
    assert.equal(appSource(href), href);
  }
});

test('ignores spoofed, credentialed, insecure and malformed URLs', () => {
  for (const href of [
    'https://apps.apple.com.example.test/au/app/obsidian/id1557175442',
    'https://user@apps.apple.com/au/app/obsidian/id1557175442',
    'http://apps.apple.com/au/app/obsidian/id1557175442',
    'https://apps.apple.com:8443/au/app/obsidian/id1557175442',
    'https://itunes.apple.com/au/app/obsidian/id1557175442',
    'https://books.apple.com/au/app/obsidian/id1557175442',
    'https://apps.apple.com/au/developer/dynalist-inc/id1195392807?uo=4',
    'https://apps.apple.com/au/app/obsidian',
    'https://apps.apple.com/au/app/obsidian/id0',
    'https://apps.apple.com/au/app/id1557175442',
    'not a url',
    null,
  ]) {
    assert.equal(appSource(href), null);
  }
});

test('uses the requested storefront, keeps software metadata and drops artwork fields', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://itunes.apple.com');
    assert.equal(url.pathname, '/search');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      term: 'Obsidian', media: 'software', entity: 'software', country: 'au', limit: '15',
    });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    return Response.json({ results: [obsidianRow, {
      kind: 'software', trackName: 'Obsidian Web Clipper', artistName: 'Dynalist Inc.',
      releaseDate: '2024-09-26T07:00:00Z', trackViewUrl: `${clipper}?uo=4`,
      artworkUrl100: 'https://example.test/icon.jpg',
    }, obsidianRow, { kind: 'album', trackName: 'Obsidian', trackViewUrl: clipper }] });
  });
  const picks = await searchApps('Obsidian', 'AU');
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(picks, [
    { title: 'Obsidian - Connected Notes', artist: 'Dynalist Inc.', year: 2021,
      href: 'https://apps.apple.com/au/app/obsidian-connected-notes/id1557175442' },
    { title: 'Obsidian Web Clipper', artist: 'Dynalist Inc.', year: 2024,
      href: 'https://apps.apple.com/au/app/obsidian-web-clipper/id6720708363' },
  ]);
  for (const pick of picks) {
    assert.deepEqual(Object.keys(pick).sort(), ['artist', 'href', 'title', 'year']);
  }
});

test('ranks the exact title first and keeps apps with matching names distinct', async (t) => {
  const near = {
    kind: 'software', trackName: 'Actions For Obsidian', artistName: 'Carlo Zottmann',
    trackViewUrl: 'https://apps.apple.com/au/app/actions-for-obsidian/id1659667937',
  };
  t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [near, obsidianRow] }));
  const picks = await searchApps('obsidian - connected notes', 'au');
  assert.equal(picks[0].title, 'Obsidian - Connected Notes');
  assert.equal(picks[1].title, 'Actions For Obsidian');
});

test('distinguishes a failed or cancelled search from an empty catalogue result', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(searchApps('Obsidian', 'AU'), /429/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchApps('Obsidian', 'AU', controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(await searchApps(' ', 'AU'), []);
});

test('malformed upstream rows never become picks', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [
    null,
    'software',
    { kind: 'software', trackName: 'No URL' },
    { kind: 'software', trackName: 'Bad URL', artistName: 'x', trackViewUrl: 'https://apps.apple.com/au/app/bad' },
    { kind: 'software', trackName: 'No artist', trackViewUrl: obsidianRow.trackViewUrl },
    { kind: 'software', trackName: '  ', artistName: 'x', trackViewUrl: obsidianRow.trackViewUrl },
  ] }));
  assert.deepEqual(await searchApps('Obsidian', 'au'), []);
  // A broken JSON body reads as an invalid result, not an empty one.
  t.mock.method(globalThis, 'fetch', async () => new Response('not json', { status: 200 }));
  await assert.rejects(searchApps('Obsidian', 'au'));
});

// Verified from the public /lookup response on 24 November 2026: id 1557175442
// in the us storefront returns this software row, title and developer. Only
// these two fields are read; the icon, screenshots and preview URLs in that
// response are never used.
const obsidianUs = 'https://apps.apple.com/us/app/obsidian-connected-notes/id1557175442?uo=4';
function obsidianUsRow() {
  return {
    wrapperType: 'software', kind: 'software', trackId: 1557175442,
    trackName: 'Obsidian - Connected Notes', artistName: 'Dynalist Inc.',
    trackViewUrl: obsidianUs,
    artworkUrl100: 'https://example.test/icon.jpg',
    screenshotUrls: ['https://example.test/screen1.jpg'],
  };
}

test('reads one exact App Store link as its own storefront and app ID', () => {
  assert.deepEqual(appleAppRef(obsidianUs), { country: 'us', id: '1557175442' });
  assert.deepEqual(appleAppRef(
    'https://apps.apple.com/gb/app/1password-8-password-manager/id1511601750?si=share',
  ), { country: 'gb', id: '1511601750' });
  // A tracker-bearing link still resolves to the same canonical app ID, while
  // a developer page, another provider, a spoofed host, a malformed page or no
  // link never seeds it.
  for (const href of [
    'https://apps.apple.com.example.test/us/app/obsidian-connected-notes/id1557175442',
    'https://user@apps.apple.com/us/app/obsidian-connected-notes/id1557175442',
    'http://apps.apple.com/us/app/obsidian-connected-notes/id1557175442',
    'https://apps.apple.com:8443/us/app/obsidian-connected-notes/id1557175442',
    'https://itunes.apple.com/us/app/obsidian-connected-notes/id1557175442',
    'https://books.apple.com/us/book/steve-jobs/id431617578',
    'https://music.apple.com/us/album/discovery/697194953',
    'https://apps.apple.com/us/developer/dynalist-inc/id1195392807',
    'https://apps.apple.com/us/app/obsidian-connected-notes',
    'https://apps.apple.com/us/app/obsidian-connected-notes/id0',
    'https://apps.apple.com/us/app/id1557175442',
    '', null,
  ]) {
    assert.equal(appleAppRef(href), null);
  }
});

test('a Mac App Store link can fill its exact software title', async (t) => {
  const xcode = 'https://apps.apple.com/us/app/xcode/id497799835';
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.searchParams.get('id'), '497799835');
    return Response.json({ results: [{
      kind: 'mac-software', trackId: 497799835, trackViewUrl: xcode,
      trackName: 'Xcode', artistName: 'Apple',
    }] });
  });
  assert.deepEqual(await lookupAppleApp(xcode), { title: 'Xcode', artist: 'Apple' });
});

test('looks up one exact app by link storefront and track ID, never by search', async (t) => {
  const fetches = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://itunes.apple.com');
    assert.equal(url.pathname, '/lookup');
    assert.deepEqual(Object.fromEntries(url.searchParams), { id: '1557175442', country: 'us' });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.redirect, 'error');
    return Response.json({ resultCount: 1, results: [obsidianUsRow()] });
  });
  assert.deepEqual(await lookupAppleApp(obsidianUs), {
    title: 'Obsidian - Connected Notes', artist: 'Dynalist Inc.',
  });
  assert.equal(fetches.mock.callCount(), 1);
});

test('applies only a software row with the matching track ID and canonical source', async (t) => {
  let row = obsidianUsRow();
  t.mock.method(globalThis, 'fetch', async () => Response.json({ resultCount: 1, results: [row] }));
  for (const variant of [
    { ...obsidianUsRow(), kind: 'album' },
    { ...obsidianUsRow(), kind: undefined },
    { ...obsidianUsRow(), trackId: 1557175443 },
    { ...obsidianUsRow(), trackId: '1557175443' },
    { ...obsidianUsRow(), trackViewUrl: 'https://apps.apple.com/us/app/obsidian-connected-notes/id1557175443' },
    { ...obsidianUsRow(), trackViewUrl: 'https://example.test/us/app/obsidian-connected-notes/id1557175442' },
    { ...obsidianUsRow(), trackViewUrl: 'https://apps.apple.com/gb/app/obsidian-connected-notes/id1557175442' },
    { ...obsidianUsRow(), trackViewUrl: 'https://books.apple.com/us/book/obsidian/id1557175442' },
    { ...obsidianUsRow(), trackName: '' },
    { ...obsidianUsRow(), artistName: '   ' },
  ]) {
    row = variant;
    assert.equal(await lookupAppleApp(obsidianUs), null);
  }
});

test('an empty app result keeps the link and offers no title', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ resultCount: 0, results: [] }));
  assert.equal(await lookupAppleApp(obsidianUs), null);
});

test('a pasted-app lookup never fetches for a non-app link', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('a lookup must not run for this link');
  });
  assert.equal(await lookupAppleApp('https://books.apple.com/us/book/steve-jobs/id431617578'), null);
  assert.equal(await lookupAppleApp('https://music.apple.com/us/album/discovery/697194953'), null);
  assert.equal(await lookupAppleApp('https://apps.apple.com/us/app/obsidian-connected-notes'), null);
  assert.equal(await lookupAppleApp(''), null);
  assert.equal(await lookupAppleApp(null), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test('a failed or cancelled app lookup makes one request and is not retried', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }));
  await assert.rejects(lookupAppleApp(obsidianUs), /500/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lookupAppleApp(obsidianUs, controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

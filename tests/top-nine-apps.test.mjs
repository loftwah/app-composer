import assert from 'node:assert/strict';
import test from 'node:test';
import { appSource, searchApps } from '../src/lib/top-nine-apps.ts';

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

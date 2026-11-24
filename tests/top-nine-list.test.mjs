import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appleAppRef, appSource } from '../src/lib/top-nine-apps.ts';
import { appleBookRef } from '../src/lib/top-nine-books.ts';
import {
  nineListApplied, nineListLimit, nineListSummary, planNineList, planNineListUndo,
} from '../src/lib/top-nine-list.ts';
import { pageLink, pageUrlLimit } from '../src/lib/top-nine-pages.ts';
import { wikidataSource } from '../src/lib/top-nine-wikidata.ts';
import { musicUrlLimit } from '../src/lib/top-nine-music.ts';
import {
  draftKey, nineItemLimit, readNineDraft, writeNineDraft,
} from '../src/lib/share-experience-draft.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const wikidataKey = (href) => href.slice(href.lastIndexOf('/') + 1);
const appleAuAppKey = (href) => {
  const ref = appleAppRef(href);
  return ref?.country === 'au' ? ref.id : null;
};
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
};

test('a pasted list fills only the slots the board is waiting for, in board order', () => {
  const plan = planNineList('Alpha\nBeta', [1, 3, 4]);
  assert.deepEqual(plan.indexes, [1, 3]);
  assert.deepEqual(plan.titles, ['Alpha', 'Beta']);
  assert.deepEqual(plan.overflow, []);
  // Nothing in the plan can address an occupied slot: the caller passes only
  // free ones, and every target came from that list.
  assert.ok(plan.indexes.every((index) => [1, 3, 4].includes(index)));
});

test('blank lines are skipped and every title keeps the editor limit', () => {
  assert.equal(nineItemLimit, 54);
  const long = 'x'.repeat(80);
  const plan = planNineList(`\n  First   thing \n\n\t\n${long}\nΛυρική 🎛️\n`, [0, 1, 2, 3]);
  assert.deepEqual(plan.titles, ['First thing', 'x'.repeat(54), 'Λυρική 🎛️']);
  assert.deepEqual(plan.overflow, []);
  // The same bound the saved draft applies, so a filled title survives a save.
  const saved = storage();
  writeNineDraft(saved, { title: 'Nine', items: [long, '', '', '', '', '', '', '', ''] });
  assert.equal(readNineDraft(saved).items[0].length, 54);
});

test('past the last empty slot the remaining lines stay in the editor, in order', () => {
  const plan = planNineList('A\nB\nC\nD', [0, 2]);
  assert.deepEqual(plan.indexes, [0, 2]);
  assert.deepEqual(plan.titles, ['A', 'B']);
  assert.deepEqual(plan.overflow, ['C', 'D']);
  // A second fill with those lines completes a board that still has room.
  const next = planNineList(plan.overflow.join('\n'), [1, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(next.titles, ['C', 'D']);
  assert.deepEqual(next.overflow, []);
  const long = `  ${'x'.repeat(80)}  `;
  assert.deepEqual(planNineList(`A\n${long}`, [0]).overflow, [long]);
});

test('a full board places nothing and keeps every line for the editor', () => {
  const plan = planNineList('A\nB', []);
  assert.deepEqual(plan.indexes, []);
  assert.deepEqual(plan.titles, []);
  assert.deepEqual(plan.overflow, ['A', 'B']);
  assert.equal(nineListSummary(plan, 0), 'No empty slots are available · 2 lines staying in the editor.');
});

test('a repeated or malformed index cannot take two lines', () => {
  const plan = planNineList('A\nB\nC', [2, 2, -1, 1.5, 0]);
  assert.deepEqual(plan.indexes, [2, 0]);
  assert.deepEqual(plan.titles, ['A', 'B']);
  assert.deepEqual(plan.overflow, ['C']);
});

test('the count beside the paste box names what is ready and what stays', () => {
  assert.equal(nineListSummary(planNineList('', [0, 1]), 2), '2 empty slots in board order.');
  assert.equal(nineListSummary(planNineList('', []), 0), 'No empty slots are available.');
  assert.equal(nineListSummary(planNineList('A\nB', [0, 1, 2, 3, 4, 5]), 6), '6 empty slots · 2 ready.');
  assert.equal(
    nineListSummary(planNineList('A\nB\nC', [0, 1]), 2),
    '2 empty slots · 2 ready · 1 staying in the editor.',
  );
  assert.equal(
    nineListApplied(planNineList('A\nB\nC', [0, 1]), 7),
    'Filled 2 exhibits · 7 empty slots left · 1 line stayed in the editor.',
  );
  assert.equal(nineListApplied(planNineList('A', [0]), 8), 'Filled 1 exhibit · 8 empty slots left.');
  assert.ok(nineListLimit >= 9 * nineItemLimit, 'the paste box holds a full board plus overdue lines');
});

test('one Undo clears the whole fill and leaves earlier and later edits alone', () => {
  const filled = { indexes: [0, 2, 4], titles: ['Alpha', 'Beta', 'Gamma'] };
  // Slot 2 was retitled after the fill; slots 1 and 3 were never part of it.
  const current = ['Alpha', 'Earlier edit', 'Edited later', 'Another earlier edit', 'Gamma', '', '', '', ''];
  const plan = planNineListUndo(filled, current, (index) => index === 4);
  assert.deepEqual(plan.clear, [0]);
  assert.deepEqual(plan.restored, ['Alpha']);
  assert.equal(plan.kept, 2);
  // Every untouched exhibit keeps its exact text: the undo only names slots
  // this fill wrote when they still hold the same title.
  assert.deepEqual(current.slice(1, 4), ['Earlier edit', 'Edited later', 'Another earlier edit']);
});

test('a plain one-title-per-line paste stays exactly page-free', () => {
  const plan = planNineList('Alpha\nBeta', [0, 1, 2]);
  assert.deepEqual(plan.lines, ['Alpha', 'Beta']);
  assert.deepEqual(plan.urls, [null, null]);
  assert.deepEqual(plan.sources, [null, null]);
  assert.deepEqual(plan.rows, ['Alpha', 'Beta']);
  assert.deepEqual(plan.remaining, []);
  assert.deepEqual(plan.invalid, []);
  // A spreadsheet export's trailing tab is still one ordinary title.
  const trailing = planNineList('Title\t', [0]);
  assert.deepEqual(trailing.titles, ['Title']);
  assert.deepEqual(trailing.urls, [null]);
  assert.deepEqual(trailing.sources, [null]);
  assert.deepEqual(trailing.invalid, []);
});

test('a second column becomes one exact public page validated by pageLink', () => {
  const safe = 'https://Example.COM/watch?v=one#part';
  assert.equal(pageLink(safe), 'https://example.com/watch?v=one#part');
  const plan = planNineList(`  First   thing \t ${safe} \nSecond`, [0, 1]);
  assert.deepEqual(plan.titles, ['First thing', 'Second']);
  assert.deepEqual(plan.urls, ['https://example.com/watch?v=one#part', null]);
  assert.deepEqual(plan.sources, [null, null]);
  // The title keeps the existing editor bound; the page keeps the page bound.
  assert.deepEqual(plan.remaining, []);
  const long = 'x'.repeat(80);
  const bounded = planNineList(`${long}\thttps://example.com/${'y'.repeat(280)}`, [0]);
  assert.deepEqual(bounded.titles, ['x'.repeat(nineItemLimit)]);
  assert.equal(bounded.urls[0].length, pageUrlLimit);
});

test('a two-column row that is not title TAB public HTTPS page stays verbatim', () => {
  const good = ['Good\thttps://example.com/good'];
  const bad = [
    'Plain\thttp://example.com/page',
    'Plain\tjavascript:alert(1)',
    'Plain\thttps://localhost/page',
    'Plain\thttps://example.com/a b',
    'Plain\thttps://user:pass@example.com/',
    '\thttps://example.com/no-title',
    `Long\thttps://example.com/${'x'.repeat(pageUrlLimit)}`,
  ];
  const plan = planNineList([...good, ...bad].join('\n'), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(plan.indexes, [0]);
  assert.deepEqual(plan.titles, ['Good']);
  assert.deepEqual(plan.urls, ['https://example.com/good']);
  assert.deepEqual(plan.invalid, bad);
  assert.deepEqual(plan.remaining, bad);
  // Never placed, and the count beside the box says how many need fixing.
  assert.equal(plan.overflow.length, 0);
  assert.equal(
    nineListSummary(plan, 9),
    '9 empty slots · 1 ready · 7 staying in the editor · 7 rows not placed, need title TAB public HTTPS page.',
  );
  assert.equal(
    nineListApplied(plan, 8),
    'Filled 1 exhibit · 8 empty slots left · 1 page linked · 7 rows not placed, need title TAB public HTTPS page.',
  );
});

test('old two-column music addresses stay ordinary pages, never sources', () => {
  const href = 'https://music.apple.com/au/album/discovery/697194953?uo=4';
  for (const raw of [`Old page\t${href}`, `Old page\t${href}\t`]) {
    const plan = planNineList(raw, [0]);
    assert.deepEqual(plan.titles, ['Old page']);
    assert.deepEqual(plan.urls, [pageLink(href)]);
    assert.deepEqual(plan.sources, [null]);
    assert.deepEqual(plan.rows, [raw]);
    assert.deepEqual(plan.invalid, []);
  }
});

test('a third column keeps the title and page and canonicalises only official music sources', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('planning a list must not fetch');
  });
  const page = 'https://Example.COM/watch?v=one#part';
  const appleAlbum = 'https://music.apple.com/au/album/discovery/697194953?uo=4';
  const appleSong = 'https://music.apple.com/au/album/digital-love/697194953?i=697195633&uo=4';
  const spotifyTrack = 'https://open.spotify.com/intl-au/track/2VEZx7NWsZ1D0eJ4uv5Fym?si=tracking';
  const rows = [
    `  Discovery \t\t ${appleAlbum} `,
    `Digital Love\t${page}\t${spotifyTrack}`,
    `Modal Soul\t\t${appleSong}`,
    `No source\t${page}\t`,
  ];
  const plan = planNineList(rows.join('\n'), [4, 1, 7, 0]);
  assert.deepEqual(plan.titles, ['Discovery', 'Digital Love', 'Modal Soul', 'No source']);
  assert.deepEqual(plan.urls, [
    null, 'https://example.com/watch?v=one#part', null, 'https://example.com/watch?v=one#part',
  ]);
  assert.deepEqual(plan.sources, [
    'https://music.apple.com/au/album/697194953',
    'https://open.spotify.com/track/2VEZx7NWsZ1D0eJ4uv5Fym',
    'https://music.apple.com/au/album/697194953?i=697195633',
    null,
  ]);
  assert.deepEqual(plan.rows, rows);
  assert.deepEqual(plan.remaining, []);
  assert.equal(plan.invalidMusic, 0);
  assert.equal(
    nineListApplied(plan, 5),
    'Filled 4 exhibits · 5 empty slots left · 2 pages linked · 3 music links added.',
  );
  assert.equal(fetch.mock.callCount(), 0);
});

test('the repeatable nine-album fixture fills every empty slot with canonical official sources', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('planning the local album fixture must not fetch');
  });
  const fixture = read('tests/fixtures/top-nine-albums.tsv').trimEnd();
  const rows = fixture.split('\n');
  const empty = Array.from({ length: 9 }, (_, index) => index);
  assert.equal(rows.length, 9);
  assert.deepEqual(rows.map((row) => row.split('\t')[1]), Array(9).fill(''));
  // Keep both the legacy US URL and the Armenia storefront in the repeatable input.
  assert.equal(rows[0], 'Discovery — Daft Punk\t\thttps://itunes.apple.com/us/album/discovery/id697194953');
  assert.equal(rows[8], 'Hounds of Love — Kate Bush\t\thttps://music.apple.com/am/album/hounds-of-love/1675375084');

  const plan = planNineList(fixture, empty);
  assert.deepEqual(plan.indexes, empty);
  assert.deepEqual(plan.titles, [
    'Discovery — Daft Punk', 'Lemonade — Beyoncé', 'Jubilee — Japanese Breakfast',
    'Kind of Blue — Miles Davis', 'Madvillainy — Madvillain',
    'Blackstar — David Bowie', 'Donuts — J Dilla', 'Endtroducing (Deluxe Edition) — DJ Shadow', 'Hounds of Love — Kate Bush',
  ]);
  assert.deepEqual(plan.urls, Array(9).fill(null));
  assert.deepEqual(plan.sources, [
    'https://music.apple.com/us/album/697194953',
    'https://music.apple.com/us/album/1460473526',
    'https://music.apple.com/us/album/1553364590',
    'https://music.apple.com/us/album/268443092',
    'https://music.apple.com/us/album/887699504',
    'https://music.apple.com/us/album/1676286487',
    'https://music.apple.com/us/album/108233171',
    'https://music.apple.com/us/album/1660367299',
    'https://music.apple.com/am/album/1675375084',
  ]);
  assert.deepEqual(plan.rows, rows);
  assert.deepEqual(plan.overflow, []);
  assert.deepEqual(plan.remaining, []);
  assert.deepEqual(plan.invalid, []);
  assert.equal(plan.invalidMusic, 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test('the repeatable nine-technical-book fixture keeps canonical Apple Books as ordinary pages', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('planning the local technical book fixture must not fetch');
  });
  const fixture = read('tests/fixtures/top-nine-technical-books.tsv').trimEnd();
  const rows = fixture.split('\n');
  const empty = Array.from({ length: 9 }, (_, index) => index);
  assert.equal(rows.length, 9);
  assert.deepEqual(rows.map((row) => row.split('\t').length), Array(9).fill(2));

  const plan = planNineList(fixture, empty);
  assert.deepEqual(plan.indexes, empty);
  assert.deepEqual(plan.titles, [
    'SQL Antipatterns, Volume 1', 'The Art of Debugging with GDB, DDD, and Eclipse',
    'Practical TLA+', 'The Algorithm Design Manual', 'Refactoring Databases',
    'The Linux Programming Interface', 'The Art of Multiprocessor Programming',
    'Systems Performance', 'Continuous Delivery',
  ]);
  assert.deepEqual(plan.urls, [
    'https://books.apple.com/us/book/sql-antipatterns-volume-1/id6752626489',
    'https://books.apple.com/us/book/the-art-of-debugging-with-gdb-ddd-and-eclipse/id1266461736',
    'https://books.apple.com/us/book/practical-tla/id1438817914',
    'https://books.apple.com/us/book/the-algorithm-design-manual/id498841695',
    'https://books.apple.com/us/book/refactoring-databases/id401494431',
    'https://books.apple.com/us/book/the-linux-programming-interface/id1266462069',
    'https://books.apple.com/us/book/the-art-of-multiprocessor-programming/id945565021',
    'https://books.apple.com/us/book/systems-performance/id1547166839',
    'https://books.apple.com/us/book/continuous-delivery/id401000597',
  ]);
  const refs = plan.urls.map(appleBookRef);
  assert.deepEqual(refs, [
    { country: 'us', id: '6752626489' }, { country: 'us', id: '1266461736' },
    { country: 'us', id: '1438817914' }, { country: 'us', id: '498841695' },
    { country: 'us', id: '401494431' }, { country: 'us', id: '1266462069' },
    { country: 'us', id: '945565021' }, { country: 'us', id: '1547166839' },
    { country: 'us', id: '401000597' },
  ]);
  assert.equal(new Set(refs.map((ref) => ref.id)).size, 9);
  assert.deepEqual(plan.sources, Array(9).fill(null));
  assert.deepEqual(plan.rows, rows);
  assert.deepEqual(plan.overflow, []);
  assert.deepEqual(plan.remaining, []);
  assert.deepEqual(plan.invalid, []);
  assert.equal(plan.invalidMusic, 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test('the repeatable nine-film and series fixture keeps distinct official Wikidata pages in paste order', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('planning the local film and series fixture must not fetch');
  });
  const fixture = read('tests/fixtures/top-nine-films-and-series.tsv').trimEnd();
  const rows = fixture.split('\n');
  const columns = rows.map((row) => row.split('\t'));
  const empty = Array.from({ length: 9 }, (_, index) => index);
  const titles = [
    'Dune (1984)', 'Dune (2021)', 'Solaris (1972)', 'Solaris (2002)',
    'The Thing (1982)', 'The Thing (2011)', 'Stalker (1979 film)',
    'Stalker (2014 TV series)', 'Aniara (2018)',
  ];
  const pages = [
    'https://www.wikidata.org/wiki/Q114819',
    'https://www.wikidata.org/wiki/Q60834962',
    'https://www.wikidata.org/wiki/Q125772',
    'https://www.wikidata.org/wiki/Q673195',
    'https://www.wikidata.org/wiki/Q210756',
    'https://www.wikidata.org/wiki/Q909749',
    'https://www.wikidata.org/wiki/Q200437',
    'https://www.wikidata.org/wiki/Q16893352',
    'https://www.wikidata.org/wiki/Q27996429',
  ];
  assert.equal(rows.length, 9);
  assert.deepEqual(columns.map((row) => row.length), Array(9).fill(2));
  assert.deepEqual(columns.map(([title]) => title), titles);
  assert.deepEqual(columns.map(([, page]) => page), pages);
  assert.equal(new Set(titles).size, 9);
  assert.equal(new Set(pages).size, 9);

  const plan = planNineList(fixture, empty);
  assert.deepEqual(plan.indexes, empty);
  assert.deepEqual(plan.titles, titles);
  assert.deepEqual(plan.urls, pages);
  assert.deepEqual(plan.urls, pages.map(pageLink));
  assert.deepEqual(plan.urls, pages.map(wikidataSource));
  assert.deepEqual(plan.sources, Array(9).fill(null));
  assert.deepEqual(plan.rows, rows);
  assert.deepEqual(plan.overflow, []);
  assert.deepEqual(plan.remaining, []);
  assert.deepEqual(plan.invalid, []);
  assert.equal(plan.invalidMusic, 0);
  assert.equal(fetch.mock.callCount(), 0);
});

// The fixtures use canonical metadata pages. No lookup or artwork is needed
// when the creator supplied both the title and the source.
const ninePageFixtures = [
  { name: 'pc-game', file: 'top-nine-pc-games.tsv', canonical: wikidataSource, key: wikidataKey },
  { name: 'console-game', file: 'top-nine-console-games.tsv', canonical: wikidataSource, key: wikidataKey },
  { name: 'app', file: 'top-nine-apps.tsv', canonical: appSource, key: appleAuAppKey },
  { name: 'programming-language', file: 'top-nine-languages.tsv', canonical: wikidataSource, key: wikidataKey },
];

for (const source of ninePageFixtures) {
  test(`the repeatable nine-${source.name} fixture keeps unique ordinary canonical pages and keys in paste order`, (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => {
      throw new Error(`planning the local ${source.name} fixture must not fetch`);
    });
    const fixture = read(`tests/fixtures/${source.file}`).trimEnd();
    const rows = fixture.split('\n');
    const columns = rows.map((row) => row.split('\t'));
    const empty = Array.from({ length: 9 }, (_, index) => index);
    const titles = columns.map(([title]) => title);
    const pages = columns.map(([, page]) => page);
    const keys = pages.map(source.key);
    assert.equal(rows.length, 9);
    assert.deepEqual(columns.map((row) => row.length), Array(9).fill(2));
    assert.ok(titles.every(Boolean));
    assert.ok(keys.every(Boolean));
    assert.equal(new Set(titles).size, 9);
    assert.equal(new Set(pages).size, 9);
    assert.equal(new Set(keys).size, 9);
    assert.deepEqual(pages.map(source.canonical), pages);

    const plan = planNineList(fixture, empty);
    assert.deepEqual(plan.indexes, empty);
    assert.deepEqual(plan.titles, titles);
    assert.deepEqual(plan.urls, pages.map(pageLink));
    assert.deepEqual(plan.sources, Array(9).fill(null));
    assert.deepEqual(plan.rows, rows);
    assert.deepEqual(plan.overflow, []);
    assert.deepEqual(plan.remaining, []);
    assert.deepEqual(plan.invalid, []);
    assert.equal(plan.invalidMusic, 0);
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('invalid third-column sources stay verbatim with corrective music help', () => {
  const spotifyAlbum = 'https://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn';
  const good = `Good\t\t${spotifyAlbum}`;
  const bad = [
    'Bad\t\thttps://example.test/not-music',
    'Bad\t\thttps://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
    'Bad\t\thttps://music.apple.com/au/album/not-an-id',
    'Bad\t\thttps://open.spotify.com.example.test/album/6b08FpNaFFTjc1dJ9DSWfn',
    'Bad\t\thttp://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn',
    'Bad\t\thttps://user@open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn',
    'Bad\thttp://example.com/page\thttps://open.spotify.com/album/6b08FpNaFFTjc1dJ9DSWfn',
    `Bad\t\thttps://open.spotify.com/album/${'x'.repeat(musicUrlLimit)}`,
    `Bad\t\t${spotifyAlbum}\textra`,
    `\t\t${spotifyAlbum}`,
  ];
  const plan = planNineList([good, ...bad].join('\n'), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(plan.indexes, [0]);
  assert.deepEqual(plan.titles, ['Good']);
  assert.deepEqual(plan.urls, [null]);
  assert.deepEqual(plan.sources, [spotifyAlbum]);
  assert.deepEqual(plan.invalid, bad);
  assert.deepEqual(plan.remaining, bad);
  assert.equal(plan.invalidMusic, bad.length);
  assert.equal(plan.overflow.length, 0);
  assert.match(nineListSummary(plan, 9), /title TAB optional public HTTPS page TAB exact Apple Music or Spotify album\/track URL/);
  assert.match(nineListApplied(plan, 8), /1 music link added/);
});

test('blank, unplaced and overflow rows keep their original order beside pages', () => {
  const rows = [
    'One\thttps://example.com/one',
    '',
    'Plain two',
    'Bad\thttp://example.com/bad',
    'Three\thttps://example.com/three',
    'Hero\thttps://example.com/four',
  ];
  const plan = planNineList(`\n${rows.join('\n')}\n`, [3, 1]);
  assert.deepEqual(plan.indexes, [3, 1]);
  assert.deepEqual(plan.titles, ['One', 'Plain two']);
  assert.deepEqual(plan.urls, ['https://example.com/one', null]);
  assert.deepEqual(plan.sources, [null, null]);
  assert.deepEqual(plan.overflow, [rows[4], rows[5]]);
  assert.deepEqual(plan.invalid, [rows[3]]);
  assert.deepEqual(plan.remaining, [rows[3], rows[4], rows[5]]);
  // A second fill of what is left only claims the slots still waiting.
  const next = planNineList(plan.remaining.join('\n'), [0, 2]);
  assert.deepEqual(next.titles, ['Three', 'Hero']);
  assert.deepEqual(next.urls, ['https://example.com/three', 'https://example.com/four']);
  assert.deepEqual(next.sources, [null, null]);
  assert.deepEqual(next.invalid, [rows[3]]);
});

test('a page-filled board saves and an older page-free draft still fills', () => {
  const saved = storage();
  writeNineDraft(saved, { title: 'Older', items: ['Kept', '', '', '', '', '', '', '', ''], byline: '', skin: 0 });
  // A draft saved before pages existed keeps its exact stored shape.
  assert.doesNotMatch(saved.getItem(draftKey("top-nine")), /"pages"/);
  const older = readNineDraft(saved);
  assert.equal(older.pages, undefined);
  const open = older.items.map((item, index) => (item ? -1 : index)).filter((index) => index >= 0);
  const plan = planNineList('Alpha\thttps://example.com/alpha\nBeta', open);
  assert.deepEqual(plan.indexes, [1, 2]);
  assert.deepEqual(plan.urls, ['https://example.com/alpha', null]);
  const items = older.items.slice();
  const pages = older.items.map(() => null);
  plan.indexes.forEach((index, line) => {
    items[index] = plan.titles[line];
    pages[index] = plan.urls[line];
  });
  writeNineDraft(saved, { ...older, items, pages });
  const filled = readNineDraft(saved);
  assert.deepEqual(filled.items, ['Kept', 'Alpha', 'Beta', '', '', '', '', '', '']);
  assert.equal(filled.pages[0], null);
  assert.equal(filled.pages[1], 'https://example.com/alpha');
  assert.equal(filled.pages[2], null);
});

test('a music-filled row keeps its canonical source and page through the existing draft codec', () => {
  const saved = storage();
  const plan = planNineList(
    'Digital Love\thttps://example.com/notes\thttps://open.spotify.com/intl-au/track/2VEZx7NWsZ1D0eJ4uv5Fym?si=tracking',
    [2],
  );
  const items = Array(9).fill('');
  const pages = Array(9).fill(null);
  const hrefs = Array(9).fill(null);
  plan.indexes.forEach((index, line) => {
    items[index] = plan.titles[line];
    pages[index] = plan.urls[line];
    hrefs[index] = plan.sources[line];
  });
  assert.equal(writeNineDraft(saved, { title: 'Songs', items, pages, hrefs }), 'saved');
  const restored = readNineDraft(saved);
  assert.equal(restored.items[2], 'Digital Love');
  assert.equal(restored.pages[2], 'https://example.com/notes');
  assert.equal(restored.hrefs[2], 'https://open.spotify.com/track/2VEZx7NWsZ1D0eJ4uv5Fym');
});

test('Undo clears only the untouched title/page pairs and restores raw rows', () => {
  const filled = {
    indexes: [0, 1, 2, 3],
    titles: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    urls: ['https://example.com/alpha', 'https://example.com/beta', null, 'https://example.com/delta'],
    rows: [
      '  Alpha\t https://example.com/alpha ',
      'Beta\thttps://example.com/beta',
      'Gamma',
      'Delta\thttps://example.com/delta',
    ],
  };
  const current = ['Alpha', 'Beta', 'Gamma retitled', 'Delta'];
  const currentPages = ['https://example.com/alpha', 'https://example.com/replaced', null, 'https://example.com/delta'];
  // Slot 0 is untouched; 1 has a replaced page; 2 was retitled; 3 gained a cover.
  const plan = planNineListUndo(filled, current, (index) => index === 3, currentPages);
  assert.deepEqual(plan.clear, [0]);
  assert.deepEqual(plan.restored, ['  Alpha\t https://example.com/alpha ']);
  assert.equal(plan.pages, 1);
  assert.equal(plan.kept, 3);
  // Removing a filled page is a later change too, so its title is left alone.
  const removed = planNineListUndo(
    { indexes: [5], titles: ['Echo'], urls: ['https://example.com/echo'] },
    ['Echo'], () => false, [null],
  );
  assert.deepEqual(removed.clear, []);
  assert.deepEqual(removed.restored, []);
  assert.equal(removed.kept, 1);
  // A preexisting attachment on a filled slot is never this fill's to remove.
  const attached = planNineListUndo(filled, current, () => true, currentPages);
  assert.deepEqual(attached.clear, []);
  assert.equal(attached.kept, 4);
});

test('Undo compares the exact music source as well as title and page', () => {
  const apple = 'https://music.apple.com/au/album/697194953';
  const spotify = 'https://open.spotify.com/track/2VEZx7NWsZ1D0eJ4uv5Fym';
  const other = 'https://music.apple.com/au/album/1078914477';
  const page = 'https://example.com/notes';
  const filled = {
    indexes: [0, 1, 2, 3, 4, 5, 6],
    titles: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf'],
    urls: [page, null, page, page, null, null, null],
    sources: [apple, spotify, apple, spotify, null, apple, spotify],
    rows: ['Alpha raw', 'Beta raw', 'Gamma raw', 'Delta raw', 'Echo raw', 'Foxtrot raw', 'Golf raw'],
  };
  const current = ['Alpha', 'Beta', 'Gamma', 'Delta edited', 'Echo', 'Foxtrot', 'Golf'];
  const currentPages = [page, null, 'https://example.com/replaced', page, null, null, null];
  const currentSources = [apple, other, apple, spotify, spotify, null, spotify];
  const plan = planNineListUndo(filled, current, (index) => index === 6, currentPages, currentSources);
  assert.deepEqual(plan.clear, [0]);
  assert.deepEqual(plan.restored, ['Alpha raw']);
  assert.equal(plan.pages, 1);
  assert.equal(plan.sources, 1);
  assert.equal(plan.kept, 6);
  // An older fill with no source field still compares every current slot as
  // source-free, so a link added later remains the person's work.
  const legacy = planNineListUndo(
    { indexes: [0], titles: ['Alpha'], urls: [null], rows: ['Alpha raw'] },
    ['Alpha'], () => false, [null], [apple],
  );
  assert.deepEqual(legacy.clear, []);
  assert.equal(legacy.kept, 1);
});

test('the editor offers one compact paste affordance wired to the normal inputs', () => {
  const component = read('src/components/share-experiences/ShareExperience.astro');
  assert.match(component, /<details class="exhibit-list" data-list-panel>/);
  assert.match(component, /<summary>Paste a list<\/summary>/);
  assert.match(component, /id="exhibit-list"[^>]*maxlength=\{nineListLimit\}[^>]*data-list-text/);
  assert.match(component, /data-list-fill disabled/);
  assert.match(component, /data-list-undo disabled/);
  assert.match(component, /data-list-status/);

  const controller = read('src/browser/share-experiences.ts');
  const start = controller.indexOf('function listSlots()');
  assert.ok(start > 0, 'the fill feature exists in the exhibition editor');
  const block = controller.slice(start, controller.indexOf('cover.target.addEventListener', start));
  // The ordinary input path: no parallel store, no search, no clipboard read.
  assert.match(block, /dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
  assert.match(block, /planNineListUndo\(/);
  assert.doesNotMatch(block, /fetch\(|navigator\.|clipboard|runSearch|fillSourceTitle/);
  assert.doesNotMatch(read('src/lib/top-nine-list.ts'), /fetch\(|navigator\.|https?:\/\//);
});

test('the paste box explains the optional page and music columns and holds nine full rows', () => {
  const component = read('src/components/share-experiences/ShareExperience.astro');
  assert.match(component, /add a tab and a public HTTPS page/i);
  assert.match(component, /another tab and an exact Apple Music or Spotify album or track link/i);
  assert.match(component, /Leave the page column blank/i);
  assert.match(component, /<label for="exhibit-list">Exhibit titles, optional pages and music links<\/label>/);
  assert.ok(
    nineListLimit >= 9 * (nineItemLimit + 1 + pageUrlLimit + 1 + musicUrlLimit),
    'nine bounded titles plus full-length public pages and music sources fit in the paste box',
  );

  const controller = read('src/browser/share-experiences.ts');
  const start = controller.indexOf('function listSlots()');
  const block = controller.slice(start, controller.indexOf('cover.target.addEventListener', start));
  // The ordinary local page state, never a provider source, fetch or preview.
  assert.match(block, /plan\.urls\.forEach/);
  assert.match(block, /plan\.sources\.forEach/);
  assert.match(block, /hrefs\[plan\.indexes\[line\]\] = source/);
  assert.match(block, /pageLinks\[index\] = url/);
  assert.match(block, /pageTitles\[index\] = plan\.titles\[line\]/);
  assert.match(block, /currentSources = hrefs\.slice\(\)/);
  assert.match(block, /plan\.remaining\.join\("\\n"\)/);
  assert.match(block, /hasFillBlocker/);
  assert.doesNotMatch(block, /fillSourceTitle|lookupApple|lookupSpotify|showPlayer|fetch\(|runSearch/);
});

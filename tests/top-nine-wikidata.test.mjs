import test from 'node:test';
import assert from 'node:assert/strict';
import { searchWikidata, wikidataSource } from '../src/lib/top-nine-wikidata.ts';

// Real Wikidata Action API responses, captured 2026-11-22 with
// Api-User-Agent 'App Composer/1.0 (https://composer.loftwah.com)' and
// trimmed to the fields the picker reads. Wikidata data and labels are CC0.

const searchRow = (id, label, description) => ({ id, label, description });
const claim = (id) => ({ mainsnak: { datavalue: { value: { id } } } });
const time = (time, precision) => ({ mainsnak: { datavalue: { value: { time, precision } } } });
const ok = (body) => async () => new Response(JSON.stringify(body), { status: 200 });

// Dune: wbsearchentities for "Dune" (5 of the 30 live rows) and the batched
// wbgetentities read for the matched items.
const duneSearch = { searchinfo: { search: 'Dune' }, search: [
  searchRow('Q25391', 'dune', 'landform, hill of sand'),
  searchRow('Q6095696', 'Dune', 'science fiction novel series by Frank Herbert'),
  searchRow('Q60834962', 'Dune', '2021 film directed by Denis Villeneuve'),
  searchRow('Q114819', 'Dune', '1984 film directed by David Lynch'),
  searchRow('Q125657547', 'Dune', '2021 Gollancz hardcover edition'),
] };
const duneEntities = { entities: {
  Q25391: { claims: { P31: [claim('Q343301')] } },
  Q6095696: { claims: { P31: [claim('Q277759')] } },
  Q60834962: {
    claims: {
      P31: [claim('Q11424')],
      P577: [
        time('+2021-09-03T00:00:00Z', 11), time('+2021-12-02T00:00:00Z', 11),
        time('+2021-10-22T00:00:00Z', 11),
      ],
    },
    sitelinks: { enwiki: { title: 'Dune (2021 film)' } },
  },
  Q114819: {
    claims: { P31: [claim('Q11424')], P577: [time('+1984-12-14T00:00:00Z', 11)] },
    sitelinks: { enwiki: { title: 'Dune (1984 film)' } },
  },
} };

test('rebuilds exact Wikidata item links, dropping aliases and trackers', () => {
  assert.equal(wikidataSource('https://www.wikidata.org/wiki/Q60834962?uselang=en'),
    'https://www.wikidata.org/wiki/Q60834962');
  assert.equal(wikidataSource('https://www.wikidata.org/entity/Q186597'),
    'https://www.wikidata.org/wiki/Q186597');
  assert.equal(wikidataSource('https://www.wikidata.org/wiki/Q189784'),
    'https://www.wikidata.org/wiki/Q189784');
});

test('ignores spoofed, credentialed, insecure and malformed URLs', () => {
  for (const href of [
    'https://www.wikidata.org.example.test/wiki/Q189784',
    'https://user@www.wikidata.org/wiki/Q189784',
    'http://www.wikidata.org/wiki/Q189784',
    'https://www.wikidata.org:8443/wiki/Q189784',
    'https://www.wikipedia.org/wiki/Q189784',
    'https://www.wikidata.org/wiki/Special:Search?search=Dune',
    'https://www.wikidata.org/w/index.php?search=Dune',
    'https://www.wikidata.org/wiki/Q0',
    'https://www.wikidata.org/wiki/Q',
    'https://www.wikidata.org/wiki/Q12345678901',
    'not a url',
    null,
  ]) {
    assert.equal(wikidataSource(href), null);
  }
});

test('one search plus one batched read filters films by the exact type', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://www.wikidata.org');
    assert.equal(url.pathname, '/w/api.php');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers['Api-User-Agent'], 'App Composer/1.0 (https://composer.loftwah.com)');
    if (url.searchParams.get('action') === 'wbsearchentities') {
      assert.deepEqual(Object.fromEntries(url.searchParams), {
        action: 'wbsearchentities', search: 'Dune', language: 'en', uselang: 'en',
        type: 'item', limit: '30', format: 'json', origin: '*',
      });
      return ok(duneSearch)();
    }
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      action: 'wbgetentities', props: 'claims|sitelinks',
      ids: 'Q25391|Q6095696|Q60834962|Q114819|Q125657547', format: 'json', origin: '*',
    });
    return ok(duneEntities)();
  });
  const picks = await searchWikidata('Dune', 'film');
  assert.equal(request.mock.callCount(), 2);
  assert.deepEqual(picks, [
    { title: 'Dune', artist: '2021 film directed by Denis Villeneuve', year: 2021,
      href: 'https://www.wikidata.org/wiki/Q60834962',
      article: 'https://en.wikipedia.org/wiki/Dune_(2021_film)' },
    { title: 'Dune', artist: '1984 film directed by David Lynch', year: 1984,
      href: 'https://www.wikidata.org/wiki/Q114819',
      article: 'https://en.wikipedia.org/wiki/Dune_(1984_film)' },
  ]);
});

// Doom: live rows for the game sample, with the 2005 film typed as a film.
const doomSearch = { searchinfo: { search: 'Doom' }, search: [
  searchRow('Q189784', 'Doom', '1993 first-person shooter video game developed by id Software'),
  searchRow('Q513867', 'Doom', '2016 first-person shooter video game'),
  searchRow('Q755523', 'Doom', '2005 film directed by Andrzej Bartkowiak'),
] };
const doomEntities = { entities: {
  // Doom (1993): 31 platform values, several outside the curated set.
  Q189784: {
    claims: {
      P31: [claim('Q7889')],
      P577: [
        time('+1993-12-10T00:00:00Z', 11), time('+1993-00-00T00:00:00Z', 9),
        time('+1994-11-14T00:00:00Z', 11), time('+1995-12-00T00:00:00Z', 10),
        time('+1996-00-00T00:00:00Z', 9),
      ],
      P400: ['Q188642', 'Q1353312', 'Q229429', 'Q388', 'Q132020', 'Q1406', 'Q183259',
        'Q10676', 'Q10677', 'Q471094', 'Q170434', 'Q48263', 'Q10683', 'Q200912',
        'Q48493', 'Q650601', 'Q14116', 'Q627611', 'Q14646', 'Q1063978', 'Q19610114',
        'Q13522376', 'Q94', 'Q47604', 'Q5014725', 'Q13361286', 'Q183505', 'Q41357',
        'Q113245462', 'Q831367', 'Q189794'].map(claim),
    },
    sitelinks: { enwiki: { title: 'Doom (1993 video game)' } },
  },
  Q513867: {
    claims: {
      P31: [claim('Q7889'), claim('Q112144412')],
      P577: [time('+2016-05-13T00:00:00Z', 11), time('+2017-11-10T00:00:00Z', 11)],
      P400: [claim('Q5014725'), claim('Q1406'), claim('Q13361286'), claim('Q19610114')],
    },
    sitelinks: { enwiki: { title: 'Doom (2016 video game)' } },
  },
  Q755523: {
    claims: { P31: [claim('Q11424')], P577: [time('+2005-10-21T00:00:00Z', 11)] },
    sitelinks: { enwiki: { title: 'Doom (film)' } },
  },
} };

test('games keep the earliest full year, films stay out of the game kind', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok(doomSearch)()
    : ok(doomEntities)());
  const picks = await searchWikidata('Doom', 'game');
  assert.equal(request.mock.callCount(), 2);
  assert.deepEqual(picks, [
    { title: 'Doom', artist: '1993 first-person shooter video game developed by id Software',
      year: 1993, href: 'https://www.wikidata.org/wiki/Q189784',
      article: 'https://en.wikipedia.org/wiki/Doom_(1993_video_game)' },
    { title: 'Doom', artist: '2016 first-person shooter video game', year: 2016,
      href: 'https://www.wikidata.org/wiki/Q513867',
      article: 'https://en.wikipedia.org/wiki/Doom_(2016_video_game)',
      platform: 'PlayStation 4 · Windows · Xbox One · Nintendo Switch' },
  ]);
  // The film typed exactly as Q11424 never appears in the game kind…
  const films = await searchWikidata('Doom', 'film');
  assert.deepEqual(films.map((pick) => pick.href), ['https://www.wikidata.org/wiki/Q755523']);
  // …and a coarser precision never fakes a year.
  assert.equal(films[0].year, 2005);
});

test('a verified anime film type is offered, unknown types are not', async (t) => {
  // Live response: Spirited Away (Q155653) is P31 Q20650540, an anime film.
  const spiritedSearch = { search: [
    searchRow('Q155653', 'Spirited Away', '2001 anime film directed by Hayao Miyazaki'),
    searchRow('Q1556532', 'Spirited Away', '2001 film soundtrack album'),
  ] };
  const spiritedEntities = { entities: {
    Q155653: {
      claims: { P31: [claim('Q20650540')], P577: [time('+2001-07-20T00:00:00Z', 11)] },
      sitelinks: { enwiki: { title: 'Spirited Away' } },
    },
    // An album, not a film, even though the label matches exactly.
    Q1556532: { claims: { P31: [claim('Q482994')] } },
  } };
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok(spiritedSearch)()
    : ok(spiritedEntities)());
  assert.deepEqual(await searchWikidata('Spirited Away', 'film'), [
    { title: 'Spirited Away', artist: '2001 anime film directed by Hayao Miyazaki',
      year: 2001, href: 'https://www.wikidata.org/wiki/Q155653',
      article: 'https://en.wikipedia.org/wiki/Spirited_Away' },
  ]);
  assert.equal(fetch.mock.callCount(), 2);
});

test('malformed claims and sitelinks never crash or invent a record', async (t) => {
  // Claims and sitelinks arrive in shapes the Action API does not promise.
  const malformedSearch = { search: [
    searchRow('Q60834962', 'Dune', '2021 film directed by Denis Villeneuve'),
    searchRow('Q114819', 'Dune', '1984 film directed by David Lynch'),
    searchRow('Q1234687', 'Dune: Part Two', '2024 film directed by Denis Villeneuve'),
  ] };
  const malformedEntities = { entities: {
    Q60834962: {
      // Non-array P31/P577/P400 entries are ignored, not fatal.
      claims: { P31: [claim('Q11424'), 'Q11424', null], P577: '2021', P400: { id: 'Q1406' } },
      // A File: page is not an article and must not be offered as one.
      sitelinks: { enwiki: { title: 'File:Dune (2021 film).jpg' } },
    },
    // Sitelinks as an array still keep the film, just without an article.
    Q114819: {
      claims: { P31: [claim('Q11424')], P577: [time('+1984-12-14T00:00:00Z', 11)] },
      sitelinks: ['Dune (1984 film)'],
    },
    // A main-namespace title with a colon is a real article.
    Q1234687: { claims: { P31: [claim('Q11424')] },
      sitelinks: { enwiki: { title: 'Dune: Part Two' } } },
  } };
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok(malformedSearch)()
    : ok(malformedEntities)());
  assert.deepEqual(await searchWikidata('Dune', 'film'), [
    { title: 'Dune', artist: '2021 film directed by Denis Villeneuve',
      href: 'https://www.wikidata.org/wiki/Q60834962' },
    { title: 'Dune', artist: '1984 film directed by David Lynch', year: 1984,
      href: 'https://www.wikidata.org/wiki/Q114819' },
    { title: 'Dune: Part Two', artist: '2024 film directed by Denis Villeneuve',
      href: 'https://www.wikidata.org/wiki/Q1234687',
      article: 'https://en.wikipedia.org/wiki/Dune%3A_Part_Two' },
  ]);
  assert.equal(fetch.mock.callCount(), 2);
});

test('malformed upstream data never becomes a pick', async (t) => {
  const brokenSearch = { search: [
    null, 'film', { id: 'Q0', label: 'Zero' }, { id: 'Q1' },
    { id: 'Q12345678901', label: 'Too long' }, { id: 'Q9', label: '   ' },
    { id: 'Q5', label: 'Human', description: 'common name of Homo sapiens' },
  ] };
  const emptyRead = { entities: {} };
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok(brokenSearch)()
    : ok(emptyRead)());
  assert.deepEqual(await searchWikidata('Human', 'film'), []);
  assert.equal(fetch.mock.callCount(), 2);
  // A missing entity in the batched read drops that row silently.
  const missingRead = { entities: { Q25391: duneEntities.entities.Q25391 } };
  fetch.mock.mockImplementation(async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok(duneSearch)()
    : ok(missingRead)());
  assert.deepEqual(await searchWikidata('Dune', 'film'), []);
});

test('a failed or cancelled search stays one request with no retries', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(searchWikidata('Dune', 'film'), /429/);
  assert.equal(fetch.mock.callCount(), 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchWikidata('Dune', 'film', controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
  // A MediaWiki error body reads as a rejected request, not an empty result.
  fetch.mock.mockImplementation(async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok({ error: { code: 'param_invalid', info: 'badvalue' } })()
    : ok(duneEntities)());
  await assert.rejects(searchWikidata('Dune', 'film'), /rejected/);
  // Out-of-bounds queries never reach the network.
  assert.deepEqual(await searchWikidata('  ', 'film'), []);
  assert.deepEqual(await searchWikidata('x'.repeat(101), 'film'), []);
  assert.equal(fetch.mock.callCount(), 2);
});

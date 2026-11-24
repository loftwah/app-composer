import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupWikidataTitle, searchWikidata, wikidataSource } from '../src/lib/top-nine-wikidata.ts';

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

// Modal Soul: live wbsearchentities rows for "Modal Soul" and the batched
// read, captured 2026-11-22 (trimming untyped claims). Both samples are P31
// Q482994 album with enwiki sitelinks.
const modalSoulSearch = { searchinfo: { search: 'Modal Soul' }, search: [
  searchRow('Q3317763', 'Modal Soul', '2005 album by Nujabes'),
  searchRow('Q6887999', 'Modal Soul Classics', '2008 compilation album; various artists'),
  searchRow('Q17143147', 'Modal Soul Classics II – Dedicated to Nujabes',
    '2010 tribute compilation album; various artists'),
] };
const modalSoulEntities = { entities: {
  Q3317763: {
    claims: { P31: [claim('Q482994')], P577: [time('+2005-11-11T00:00:00Z', 11)] },
    sitelinks: { enwiki: { title: 'Modal Soul' } },
  },
  Q6887999: {
    claims: { P31: [claim('Q482994')], P577: [time('+2008-00-00T00:00:00Z', 9)] },
  },
  Q17143147: { claims: { P31: [claim('Q482994')] } },
} };

test('albums come from the same two requests, exact title first', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://www.wikidata.org');
    assert.equal(init.credentials, 'omit');
    if (url.searchParams.get('action') === 'wbsearchentities') {
      assert.equal(url.searchParams.get('search'), 'Modal Soul');
      return ok(modalSoulSearch)();
    }
    assert.equal(url.searchParams.get('ids'), 'Q3317763|Q6887999|Q17143147');
    return ok(modalSoulEntities)();
  });
  const picks = await searchWikidata('Modal Soul', 'album');
  assert.equal(request.mock.callCount(), 2);
  assert.deepEqual(picks, [
    { title: 'Modal Soul', artist: '2005 album by Nujabes', year: 2005,
      href: 'https://www.wikidata.org/wiki/Q3317763',
      article: 'https://en.wikipedia.org/wiki/Modal_Soul' },
    { title: 'Modal Soul Classics', artist: '2008 compilation album; various artists', year: 2008,
      href: 'https://www.wikidata.org/wiki/Q6887999' },
    { title: 'Modal Soul Classics II – Dedicated to Nujabes',
      artist: '2010 tribute compilation album; various artists',
      href: 'https://www.wikidata.org/wiki/Q17143147' },
  ]);
});

test('the album kind accepts exactly Q482994 and studio albums, never films', async (t) => {
  // Spiritual State is the second spike sample: the album is Q482994, the
  // Sufi concept shares the label and must not be offered. One item typed
  // only as Q20853847 studio album is accepted; the film is not.
  const spiritualSearch = { search: [
    searchRow('Q3493569', 'Spiritual State', '2011 posthumous studio album by Nujabes'),
    searchRow('Q3782498', 'Spiritual State', 'spiritual state in Sufi path'),
    searchRow('Q62443214', 'Spiritual State', 'studio album'),
    searchRow('Q755523', 'Spiritual State', '2005 film directed by Andrzej Bartkowiak'),
  ] };
  const spiritualEntities = { entities: {
    Q3493569: {
      claims: { P31: [claim('Q482994')], P577: [time('+2011-12-03T00:00:00Z', 11)] },
      sitelinks: { enwiki: { title: 'Spiritual State' } },
    },
    Q3782498: { claims: { P31: [claim('Q11396486')] } },
    Q62443214: { claims: { P31: [claim('Q20853847')], P577: [time('+2011-12-03T00:00:00Z', 11)] } },
    Q755523: { claims: { P31: [claim('Q11424')] } },
  } };
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok(spiritualSearch)()
    : ok(spiritualEntities)());
  assert.deepEqual(await searchWikidata('Spiritual State', 'album'), [
    { title: 'Spiritual State', artist: '2011 posthumous studio album by Nujabes', year: 2011,
      href: 'https://www.wikidata.org/wiki/Q3493569',
      article: 'https://en.wikipedia.org/wiki/Spiritual_State' },
    { title: 'Spiritual State', artist: 'studio album', year: 2011,
      href: 'https://www.wikidata.org/wiki/Q62443214' },
  ]);
  assert.equal(fetch.mock.callCount(), 2);
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

// Breaking Bad: live wbsearchentities rows and batched read, captured
// 2026-11-24. Q1079 is P31 Q5398426 television series (no P577 year). The
// same query carries an exact-label episode, a season, the El Camino film and
// the franchise item, none of which is a series.
const breakingBadSearch = { searchinfo: { search: 'Breaking Bad' }, search: [
  searchRow('Q1079', 'Breaking Bad', 'American crime drama television series (2008–2013)'),
  searchRow('Q113461786', 'Breaking Bad', 'neo-Western crime drama franchise'),
  searchRow('Q113390660', 'Breaking Bad', 'episode of Better Call Saul (S6 E11)'),
  searchRow('Q1629860', 'Breaking Bad, season 2', 'season of television series'),
  searchRow('Q61741521', 'El Camino: A Breaking Bad Movie', '2019 American film by Vince Gilligan'),
] };
const breakingBadEntities = { entities: {
  Q1079: {
    claims: { P31: [claim('Q5398426')] },
    sitelinks: { enwiki: { title: 'Breaking Bad' } },
  },
  Q113461786: { claims: { P31: [claim('Q196600')] } },
  Q113390660: {
    claims: { P31: [claim('Q21191270')], P577: [time('+2022-08-01T00:00:00Z', 11)] },
    sitelinks: { enwiki: { title: 'Breaking Bad (Better Call Saul)' } },
  },
  Q1629860: { claims: { P31: [claim('Q3464665')] } },
  Q61741521: {
    claims: { P31: [claim('Q11424')], P577: [time('+2019-10-11T00:00:00Z', 11)] },
    sitelinks: { enwiki: { title: 'El Camino: A Breaking Bad Movie' } },
  },
} };

// Chernobyl: live rows and batched read, captured 2026-11-24. Q48741246 is P31
// Q1259759 miniseries; the disaster, city and book share the query.
const chernobylSearch = { searchinfo: { search: 'Chernobyl' }, search: [
  searchRow('Q486', 'Chernobyl disaster', '1986 nuclear accident in the Soviet Union'),
  searchRow('Q129677', 'Chernobyl', 'partially abandoned city in Kyiv Oblast, Ukraine'),
  searchRow('Q48741246', 'Chernobyl', '2019 miniseries about the Chernobyl disaster'),
  searchRow('Q139808178', 'Chernobyl', 'book'),
] };
const chernobylEntities = { entities: {
  Q486: { claims: { P31: [claim('Q15725976')] } },
  Q129677: { claims: { P31: [claim('Q356936')] } },
  Q48741246: {
    claims: { P31: [claim('Q1259759')], P577: [time('+2019-05-06T00:00:00Z', 11)] },
    sitelinks: { enwiki: { title: 'Chernobyl (miniseries)' } },
  },
  Q139808178: { claims: { P31: [claim('Q7725634')] } },
} };

test('the series kind offers a series and a miniseries, never film, episode or season', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://www.wikidata.org');
    assert.equal(init.credentials, 'omit');
    if (url.searchParams.get('action') === 'wbsearchentities') {
      return ok(url.searchParams.get('search') === 'Breaking Bad' ? breakingBadSearch : chernobylSearch)();
    }
    return ok(url.searchParams.get('ids').startsWith('Q1079') ? breakingBadEntities : chernobylEntities)();
  });
  assert.deepEqual(await searchWikidata('Breaking Bad', 'series'), [
    { title: 'Breaking Bad', artist: 'American crime drama television series (2008–2013)',
      href: 'https://www.wikidata.org/wiki/Q1079',
      article: 'https://en.wikipedia.org/wiki/Breaking_Bad' },
  ]);
  assert.deepEqual(await searchWikidata('Chernobyl', 'series'), [
    { title: 'Chernobyl', artist: '2019 miniseries about the Chernobyl disaster', year: 2019,
      href: 'https://www.wikidata.org/wiki/Q48741246',
      article: 'https://en.wikipedia.org/wiki/Chernobyl_(miniseries)' },
  ]);
  // The film kind keeps the film and excludes the series: each exact type
  // stays in its own kind.
  assert.deepEqual(await searchWikidata('Breaking Bad', 'film'), [
    { title: 'El Camino: A Breaking Bad Movie', artist: '2019 American film by Vince Gilligan',
      year: 2019, href: 'https://www.wikidata.org/wiki/Q61741521',
      article: 'https://en.wikipedia.org/wiki/El_Camino%3A_A_Breaking_Bad_Movie' },
  ]);
  assert.equal(fetch.mock.callCount(), 6);
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

// Platform filter sample: every game is P31 Q7889, so only the recorded P400
// IDs can decide. Descriptions and years deliberately mention PC, console or
// neither to prove they never infer a family; mobile-only and unrecorded games
// stay under All.
const platformSearch = { searchinfo: { search: 'Platform' }, search: [
  searchRow('Q9001', 'Codeword', 'cross-platform action game'),
  searchRow('Q9002', 'Quarry', 'PC strategy game, console version cancelled'),
  searchRow('Q9003', 'Ridge Racer', 'console racing game'),
  searchRow('Q9004', 'Pocket Pop', 'mobile puzzle game for PC and console'),
  searchRow('Q9005', 'Blank', 'game with no recorded platform'),
] };
const platformEntities = { entities: {
  Q9001: { claims: { P31: [claim('Q7889')], P577: [time('+2019-01-01T00:00:00Z', 11)],
    P400: [claim('Q1406'), claim('Q5014725')] } },
  Q9002: { claims: { P31: [claim('Q7889')], P400: [claim('Q1406'), claim('Q388')] } },
  Q9003: { claims: { P31: [claim('Q7889')], P400: [claim('Q10683')] } },
  Q9004: { claims: { P31: [claim('Q7889')], P577: [time('+2021-01-01T00:00:00Z', 11)],
    P400: [claim('Q94'), claim('Q48493')] } },
  Q9005: { claims: { P31: [claim('Q7889')], P577: [time('+1999-01-01T00:00:00Z', 11)] } },
} };

test('game filters use recorded PC and console P400 IDs, and All stays the default', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok(platformSearch)()
    : ok(platformEntities)());
  const titles = (picks) => picks.map((pick) => pick.title);
  // All is the unchanged default: mobile-only and unrecorded games stay in.
  const all = await searchWikidata('Platform', 'game');
  assert.deepEqual(titles(all), ['Codeword', 'Quarry', 'Ridge Racer', 'Pocket Pop', 'Blank']);
  // Both families are evidenced by Codeword's own P400 claims.
  assert.deepEqual(titles(await searchWikidata('Platform', 'game', undefined, 'pc')),
    ['Codeword', 'Quarry']);
  assert.deepEqual(titles(await searchWikidata('Platform', 'game', undefined, 'console')),
    ['Codeword', 'Ridge Racer']);
  // The explicit All option matches the default exactly.
  assert.deepEqual(await searchWikidata('Platform', 'game', undefined, 'all'), all);
  assert.equal(fetch.mock.callCount(), 8);
  // The filter never reaches into other kinds: films keep their own search.
  assert.deepEqual(await searchWikidata('Platform', 'film'), []);
  assert.equal(fetch.mock.callCount(), 10);
});

test('a failed or cancelled search stays one request with no retries', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(searchWikidata('Dune', 'film'), /429/);
  assert.equal(fetch.mock.callCount(), 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchWikidata('Dune', 'film', controller.signal), { name: 'AbortError' });
  await assert.rejects(searchWikidata('Modal Soul', 'album', controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
  // A MediaWiki error body reads as a rejected request, not an empty result.
  fetch.mock.mockImplementation(async (url) => url.searchParams.get('action') === 'wbsearchentities'
    ? ok({ error: { code: 'param_invalid', info: 'badvalue' } })()
    : ok(duneEntities)());
  await assert.rejects(searchWikidata('Dune', 'film'), /rejected/);
  // Out-of-bounds queries never reach the network.
  assert.deepEqual(await searchWikidata('  ', 'film'), []);
  assert.deepEqual(await searchWikidata('x'.repeat(101), 'film'), []);
  assert.deepEqual(await searchWikidata('  ', 'album'), []);
  assert.deepEqual(await searchWikidata('x'.repeat(101), 'album'), []);
  assert.equal(fetch.mock.callCount(), 2);
});

// Exact-link fill: one wbgetentities read for the one QID in a pasted item
// link. The two verified samples below use the real current response shape —
// Q60834962 carries only a mul (common-language) label, Q3317763 an en label.
const read = (entities) => ok({ entities });
const filmLink = 'https://www.wikidata.org/wiki/Q60834962?uselang=en';
const albumLink = 'https://www.wikidata.org/wiki/Q3317763';

test('an exact film link fills its common-language label and reliable year in one bounded read', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://www.wikidata.org');
    assert.equal(url.pathname, '/w/api.php');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      action: 'wbgetentities', props: 'labels|claims', languages: 'en|mul',
      ids: 'Q60834962', format: 'json', origin: '*',
    });
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(init.headers['Api-User-Agent'], 'App Composer/1.0 (https://composer.loftwah.com)');
    return read({
      Q60834962: {
        type: 'item', id: 'Q60834962',
        labels: { mul: { language: 'mul', value: 'Dune' } },
        claims: {
          P31: [claim('Q11424')],
          P577: [time('+2021-12-02T00:00:00Z', 11), time('+2021-09-03T00:00:00Z', 11)],
        },
      },
    })();
  });
  assert.equal(await lookupWikidataTitle(filmLink), 'Dune (2021)');
  assert.equal(fetch.mock.callCount(), 1);
});

test('an exact album link prefers the English label and keeps its year', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.searchParams.get('ids'), 'Q3317763');
    assert.equal(url.searchParams.get('languages'), 'en|mul');
    return read({
      Q3317763: {
        type: 'item', id: 'Q3317763',
        labels: { en: { language: 'en', value: 'Modal Soul' }, mul: { language: 'mul', value: 'other' } },
        claims: { P31: [claim('Q482994')], P577: [time('+2005-11-11T00:00:00Z', 11)] },
      },
    })();
  });
  assert.equal(await lookupWikidataTitle(albumLink), 'Modal Soul (2005)');
  assert.equal(fetch.mock.callCount(), 1);
});

test('only the current film, series, game and album instance types fill a title', async (t) => {
  let type = 'Q11424';
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    const qid = url.searchParams.get('ids');
    return read({ [qid]: {
      type: 'item', id: qid,
      labels: { en: { language: 'en', value: 'Known' } },
      claims: { P31: [claim(type)] },
    } })();
  });
  for (type of ['Q11424', 'Q20650540', 'Q5398426', 'Q1259759', 'Q7889', 'Q482994', 'Q20853847']) {
    assert.equal(await lookupWikidataTitle(filmLink), 'Known');
  }
  for (type of ['Q5', 'Q343301', 'Q21191270', 'Q3464665', 'Q277759']) {
    assert.equal(await lookupWikidataTitle(filmLink), null);
  }
  assert.equal(fetch.mock.callCount(), 12);
});

test('a wrong ID, missing label, coarse year or malformed entity keeps the link manual', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => read({ Q999: {
    type: 'item', id: 'Q999',
    labels: { en: { language: 'en', value: 'Wrong' } }, claims: { P31: [claim('Q11424')] },
  } })());
  // The API did not return the requested item.
  assert.equal(await lookupWikidataTitle(filmLink), null);
  // A non-item entity, an ID mismatch, or a label in neither language is not usable.
  fetch.mock.mockImplementation(async () => read({ Q60834962: {
    type: 'property', id: 'Q60834962', labels: { en: { value: 'Dune' } }, claims: { P31: [claim('Q11424')] },
  } })());
  assert.equal(await lookupWikidataTitle(filmLink), null);
  fetch.mock.mockImplementation(async () => read({ Q60834962: {
    type: 'item', id: 'Q6083497', labels: { en: { value: 'Dune' } }, claims: { P31: [claim('Q11424')] },
  } })());
  assert.equal(await lookupWikidataTitle(filmLink), null);
  for (const labels of [{}, { en: { value: '   ' } }, { en: 'Dune', mul: [] }, []]) {
    fetch.mock.mockImplementation(async () => read({ Q60834962: {
      type: 'item', id: 'Q60834962', labels, claims: { P31: [claim('Q11424')] },
    } })());
    assert.equal(await lookupWikidataTitle(filmLink), null);
  }
  // A coarse P577 precision is not a reliable year; the label still applies.
  fetch.mock.mockImplementation(async () => read({ Q60834962: {
    type: 'item', id: 'Q60834962', labels: { en: { value: 'Dune' } },
    claims: { P31: [claim('Q11424')], P577: [time('+2021-00-00T00:00:00Z', 8)] },
  } })());
  assert.equal(await lookupWikidataTitle(filmLink), 'Dune');
  // Malformed bodies never crash or invent a title.
  for (const body of [{ entities: [] }, { entities: 'no' }, { entities: { Q60834962: null } },
    { entities: { Q60834962: { claims: { P31: 'Q11424' }, labels: { en: { value: 'Dune' } } } } }]) {
    fetch.mock.mockImplementation(async () => ok(body)());
    assert.equal(await lookupWikidataTitle(filmLink), null);
  }
});

test('an exact-link lookup never fetches for a non-item or spoofed link', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('a lookup must not run for this link');
  });
  for (const href of [
    'https://www.wikipedia.org/wiki/Q60834962',
    'https://www.wikidata.org.example.test/wiki/Q60834962',
    'https://www.wikidata.org/wiki/Special:Search?search=Dune',
    'https://music.apple.com/us/album/discovery/697194953',
    '', null,
  ]) {
    assert.equal(await lookupWikidataTitle(href), null);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('a failed or cancelled exact-link lookup makes one request with no retries', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(lookupWikidataTitle(filmLink), /429/);
  assert.equal(fetch.mock.callCount(), 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lookupWikidataTitle(filmLink, controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiences,
} from '../src/lib/share-experiences.ts';
import {
  cloudflarePersonaIds, cloudflarePersonaOutcomeFromHash, cloudflarePersonaOutcomes,
  cloudflarePersonaPath, cloudflarePersonaQuestionCount, cloudflarePersonaQuestions,
  cloudflarePersonaResultPath, resolveCloudflarePersona, tallyCloudflarePersona,
} from '../src/lib/cloudflare-persona.ts';

// The first public Cloudflare persona slice: one typed definition, one
// deterministic result per complete run, and an answer-free result address.
// The played journey and mobile layout are inspected by the integrating run.

const read = (path) => new URL(`../${path}`, import.meta.url);

/** Every possible complete run: eight questions with four answers each. */
function* runs(length) {
  const total = 4 ** length;
  for (let n = 0; n < total; n += 1) {
    let rest = n;
    const answers = [];
    for (let index = 0; index < length; index += 1) {
      answers.push(rest % 4);
      rest = Math.floor(rest / 4);
    }
    yield answers;
  }
}

test('eight balanced outcomes and eight questions, with every result strictly reachable', () => {
  assert.equal(cloudflarePersonaQuestionCount, 8);
  assert.equal(cloudflarePersonaQuestions.length, 8);
  assert.equal(cloudflarePersonaIds.length, 8);
  assert.equal(new Set(cloudflarePersonaIds).size, 8, 'outcome ids are unique');
  assert.equal(new Set(cloudflarePersonaQuestions.map(({ id }) => id)).size, 8, 'question ids are unique');
  assert.equal(
    new Set(cloudflarePersonaQuestions.map(({ prompt }) => prompt)).size,
    8,
    'questions are not repeated',
  );

  const primary = Object.fromEntries(cloudflarePersonaIds.map((id) => [id, 0]));
  const secondary = Object.fromEntries(cloudflarePersonaIds.map((id) => [id, 0]));
  for (const question of cloudflarePersonaQuestions) {
    assert.equal(question.options.length, 4, 'each question has four answers');
    for (const option of question.options) {
      assert.ok(option.label.trim().length > 0);
      assert.ok(Object.hasOwn(cloudflarePersonaOutcomes, option.primary));
      assert.ok(Object.hasOwn(cloudflarePersonaOutcomes, option.secondary));
      assert.notEqual(option.primary, option.secondary, 'an option never pairs a service with itself');
      primary[option.primary] += 1;
      secondary[option.secondary] += 1;
    }
  }
  // Four direct and four paired appearances keep the eight outcomes balanced,
  // so no result is a decorative extra that only a tie-break can reach.
  for (const id of cloudflarePersonaIds) {
    assert.equal(primary[id], 4, `${id} is a direct answer four times`);
    assert.equal(secondary[id], 4, `${id} is a paired answer four times`);
  }

  const strict = Object.fromEntries(cloudflarePersonaIds.map((id) => [id, 0]));
  for (const answers of runs(8)) {
    const tallies = tallyCloudflarePersona(answers);
    assert.ok(tallies, `a complete run scores: ${answers.join('')}`);
    const top = tallies[0].score;
    if (tallies.filter(({ score }) => score === top).length === 1) strict[tallies[0].id] += 1;
  }
  for (const id of cloudflarePersonaIds) {
    assert.ok(strict[id] > 0, `${id} wins on score alone in at least one run`);
  }
});

test('complete runs are deterministic and every tie resolves by direct picks then earliest pick', () => {
  let tiedRuns = 0;
  let directTie = null;
  let earliestTie = null;
  let uniqueRuns = 0;

  for (const answers of runs(8)) {
    const tallies = tallyCloudflarePersona(answers);
    const id = resolveCloudflarePersona(answers);
    assert.equal(id, tallies[0].id, 'the resolver returns the ranked leader');
    assert.equal(resolveCloudflarePersona(answers), id, 'replaying the same run is reproducible');

    const top = tallies[0].score;
    const tied = tallies.filter(({ score }) => score === top);
    if (tied.length === 1) {
      uniqueRuns += 1;
      assert.equal(id, tied[0].id, 'a unique top score is never overridden');
      continue;
    }
    tiedRuns += 1;
    assert.ok(tied.some(({ id: candidate }) => candidate === id), 'a tie always resolves inside the tied set');
    assert.equal(id, tallies[0].id);
    assert.equal(tallies[0].score, top);

    const mostDirect = Math.max(...tied.map(({ direct }) => direct));
    assert.equal(tallies[0].direct, mostDirect, 'the tie-break prefers the most direct picks');
    const directLeaders = tied.filter(({ direct }) => direct === mostDirect);
    const earliest = Math.min(...directLeaders.map(({ firstDirect }) => firstDirect));
    assert.equal(tallies[0].firstDirect, earliest, 'then the earliest direct pick');

    if (!directTie && tied.some(({ direct }) => direct !== tied[0].direct)) directTie = answers;
    if (!earliestTie && directLeaders.length > 1
      && directLeaders.some(({ firstDirect }) => firstDirect !== directLeaders[0].firstDirect)) {
      earliestTie = answers;
    }
  }

  assert.ok(tiedRuns > 0, 'tie handling is exercised by real runs');
  assert.ok(uniqueRuns > 0, 'most runs have a unique winner');
  assert.ok(directTie, 'a direct-pick tie is exercised');
  assert.ok(earliestTie, 'an earliest-pick tie is exercised');
});

test('incomplete or malformed runs produce no result', () => {
  assert.equal(tallyCloudflarePersona([0, 0, 0]), null);
  assert.equal(resolveCloudflarePersona(null), null);
  assert.equal(resolveCloudflarePersona([]), null);
  assert.equal(resolveCloudflarePersona([0, 0, 0, 0, 0, 0, 0, 4]), null);
  assert.equal(resolveCloudflarePersona([0, 0, 0, 0, 0, 0, 0, -1]), null);
  assert.equal(resolveCloudflarePersona([0, 0, 0, 0, 0, 0, 0, 0.5]), null);
});

test('the result address carries only one trusted outcome ID and falls back safely', () => {
  assert.equal(cloudflarePersonaPath, '/share/experiences/developer-type');
  for (const id of cloudflarePersonaIds) {
    const path = cloudflarePersonaResultPath(id);
    assert.equal(path, `/share/experiences/developer-type#result=${id}`);
    assert.equal(cloudflarePersonaOutcomeFromHash(`#result=${id}`), id, `${id} round-trips`);
    const url = new URL(path, 'https://composer.example');
    assert.equal(url.search, '');
    assert.deepEqual([...new URLSearchParams(url.hash.slice(1)).keys()], ['result'], 'no answer, byline, skin or score travels');
  }

  for (const search of [
    '', '#result=', '#result', '#result=unknown', '#result=WORKERS',
    '#result=workers&result=workers', '#other=workers', '#result=workers&utm_source=social',
  ]) {
    assert.equal(cloudflarePersonaOutcomeFromHash(search), null, `${search || 'a bare search'} falls back`);
  }
  assert.deepEqual(
    Object.values(cloudflarePersonaOutcomes).map(({ href }) => href),
    [
      'https://developers.cloudflare.com/workers/',
      'https://developers.cloudflare.com/durable-objects/',
      'https://developers.cloudflare.com/r2/',
      'https://developers.cloudflare.com/d1/',
      'https://developers.cloudflare.com/kv/',
      'https://developers.cloudflare.com/queues/',
      'https://developers.cloudflare.com/workflows/',
      'https://developers.cloudflare.com/workers-ai/',
    ],
    'each result points at its official product page',
  );
});

test('the quiz joins the existing Share Experiences registry on owned artwork', () => {
  const experience = experiences['developer-type'];
  assert.equal(experience.title, 'Developer Type Quiz');
  assert.equal(experience.slug, 'which-cloudflare');
  assert.match(experience.description, /eight small situations/i);
  assert.ok(existsSync(read(`public${experienceArt('developer-type')}`)), 'the stage art exists');
  assert.ok(existsSync(read(`public${experienceOg('developer-type')}`)), 'the share card exists');
  assert.ok(existsSync(read(`public${experienceArt('developer-type').replace('.jpg', '-480.webp')}`)));
  assert.ok(existsSync(read('src/components/share-experiences/ShareExperience.astro')));
});

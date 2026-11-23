import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiences,
} from '../src/lib/share-experiences.ts';
import {
  languagePersonaIds, languagePersonaOutcomeFromHash, languagePersonaOutcomes,
  languagePersonaPath, languagePersonaQuestionCount, languagePersonaQuestions,
  languagePersonaResultPath, resolveLanguagePersona, tallyLanguagePersona,
} from '../src/lib/language-persona.ts';
import {
  cloudflarePersonaOutcomeFromHash, cloudflarePersonaOutcomes, cloudflarePersonaIds,
  cloudflarePersonaPath, cloudflarePersonaResultPath,
} from '../src/lib/cloudflare-persona.ts';
import { developerTypeCardCopy, developerTypeCardCredit } from '../src/lib/developer-type-card.ts';
import { languageTypeCardCopy, languageTypeCardCredit } from '../src/lib/language-type-card.ts';
import { developerTypePersona, languageTypePersona, personaFor, personaPacks } from '../src/lib/persona-packs.ts';
import {
  personaCardFormats, personaCardLayout, resultSizes,
} from '../src/browser/share-experience-image.ts';

// The sibling playable Language Type Quiz: the same maintained persona engine,
// scoring, reveal, fragment allow-list and three-format card as the Developer
// Type Quiz, with its own authored pack and route. The played journey, phone
// layout and rendered pixels are inspected by the integrating run.

const read = (path) => new URL(`../${path}`, import.meta.url);
const source = (path) => readFileSync(read('src/' + path), 'utf8');

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

test('eight original language archetypes, eight questions, every result strictly reachable', () => {
  assert.equal(languagePersonaQuestionCount, 8);
  assert.equal(languagePersonaQuestions.length, 8);
  assert.equal(languagePersonaIds.length, 8);
  assert.equal(new Set(languagePersonaIds).size, 8, 'outcome ids are unique');
  assert.equal(new Set(languagePersonaQuestions.map(({ id }) => id)).size, 8, 'question ids are unique');
  assert.equal(new Set(languagePersonaQuestions.map(({ prompt }) => prompt)).size, 8, 'questions are not repeated');

  assert.deepEqual(
    Object.values(languagePersonaOutcomes).map(({ label, archetype }) => [label, archetype]),
    [
      ['Ruby', 'The Expressive Craftsperson'],
      ['Python', 'The Curious Generalist'],
      ['Rust', 'The Careful Engineer'],
      ['TypeScript', 'The Thoughtful Organiser'],
      ['JavaScript', 'The Improviser'],
      ['Go', 'The Focused Minimalist'],
      ['Elixir', 'The Team Synchroniser'],
      ['PHP', 'The Practical Web Builder'],
    ],
    'the exact eight original archetypes, in fixed order',
  );

  assert.deepEqual(
    Object.values(languagePersonaOutcomes).map(({ href }) => href),
    [
      'https://www.ruby-lang.org/en/about/',
      'https://docs.python.org/3/tutorial/index.html',
      'https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html',
      'https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html',
      'https://tc39.es/ecma262/',
      'https://go.dev/doc/',
      'https://elixir-lang.org/docs/',
      'https://www.php.net/intro',
    ],
    'each language detail links to its verified official source',
  );

  const primary = Object.fromEntries(languagePersonaIds.map((id) => [id, 0]));
  const secondary = Object.fromEntries(languagePersonaIds.map((id) => [id, 0]));
  for (const question of languagePersonaQuestions) {
    assert.equal(question.options.length, 4, 'each situation has four answers');
    for (const option of question.options) {
      assert.ok(option.label.trim().length > 0);
      assert.ok(Object.hasOwn(languagePersonaOutcomes, option.primary));
      assert.ok(Object.hasOwn(languagePersonaOutcomes, option.secondary));
      assert.notEqual(option.primary, option.secondary, 'an option never pairs a language with itself');
      primary[option.primary] += 1;
      secondary[option.secondary] += 1;
    }
  }
  for (const id of languagePersonaIds) {
    assert.equal(primary[id], 4, `${id} is a direct answer four times`);
    assert.equal(secondary[id], 4, `${id} is a paired answer four times`);
  }

  const strict = Object.fromEntries(languagePersonaIds.map((id) => [id, 0]));
  for (const answers of runs(8)) {
    const tallies = tallyLanguagePersona(answers);
    assert.ok(tallies, `a complete run scores: ${answers.join('')}`);
    if (tallies.filter(({ score }) => score === tallies[0].score).length === 1) strict[tallies[0].id] += 1;
  }
  for (const id of languagePersonaIds) {
    assert.ok(strict[id] > 0, `${id} wins on score alone in at least one run`);
  }
});

test('the situations never ask for language knowledge', () => {
  const names = Object.values(languagePersonaOutcomes).map(({ label }) => label);
  for (const question of languagePersonaQuestions) {
    const text = [question.prompt, ...question.options.map(({ label }) => label)].join(' ');
    for (const name of names) {
      // Plain capitalised names only: ordinary words such as “go” stay natural.
      assert.ok(!text.includes(name), `“${name}” is never named in a situation or answer`);
    }
  }
  for (const outcome of Object.values(languagePersonaOutcomes)) {
    assert.ok(outcome.tendency.length > 20, `${outcome.label} gets a friendly rationale`);
    assert.ok(outcome.reason.length > 30, `${outcome.label} gets one accurate detail`);
    assert.doesNotMatch(outcome.tendency, /https?:/);
    assert.ok(!/psycholog|diagnos|percent|study proves|smarter|better than/i.test(outcome.tendency + outcome.reason));
  }
});

test('complete runs are deterministic and every tie resolves by direct picks then earliest pick', () => {
  let tiedRuns = 0;
  let uniqueRuns = 0;
  for (const answers of runs(8)) {
    const tallies = tallyLanguagePersona(answers);
    const id = resolveLanguagePersona(answers);
    assert.equal(id, tallies[0].id, 'the resolver returns the ranked leader');
    assert.equal(resolveLanguagePersona(answers), id, 'replaying the same run is reproducible');
    const top = tallies[0].score;
    const tied = tallies.filter(({ score }) => score === top);
    if (tied.length === 1) {
      uniqueRuns += 1;
      assert.equal(id, tied[0].id, 'a unique top score is never overridden');
      continue;
    }
    tiedRuns += 1;
    assert.ok(tied.some(({ id: candidate }) => candidate === id), 'a tie always resolves inside the tied set');
    assert.equal(tallies[0].direct, Math.max(...tied.map(({ direct }) => direct)), 'the tie prefers direct picks');
  }
  assert.ok(tiedRuns > 0, 'tie handling is exercised by real runs');
  assert.ok(uniqueRuns > 0, 'most runs have a unique winner');
});

test('incomplete or malformed runs produce no result', () => {
  assert.equal(tallyLanguagePersona([0, 0, 0]), null);
  assert.equal(resolveLanguagePersona(null), null);
  assert.equal(resolveLanguagePersona([]), null);
  assert.equal(resolveLanguagePersona([0, 0, 0, 0, 0, 0, 0, 4]), null);
  assert.equal(resolveLanguagePersona([0, 0, 0, 0, 0, 0, 0, -1]), null);
  assert.equal(resolveLanguagePersona([0, 0, 0, 0, 0, 0, 0, 0.5]), null);
});

test('the result address carries only one trusted outcome and never an answer', () => {
  assert.equal(languagePersonaPath, '/share/experiences/language-type');
  for (const id of languagePersonaIds) {
    const path = languagePersonaResultPath(id);
    assert.equal(path, `/share/experiences/language-type#result=${id}`);
    assert.equal(languagePersonaOutcomeFromHash(`#result=${id}`), id, `${id} round-trips`);
    const url = new URL(path, 'https://composer.example');
    assert.equal(url.search, '');
    assert.deepEqual([...new URLSearchParams(url.hash.slice(1)).keys()], ['result'], 'no answer, byline, skin or score travels');
  }
  for (const search of [
    '', '#result=', '#result', '#result=unknown', '#result=RUBY',
    '#result=ruby&result=ruby', '#other=ruby', '#result=ruby&utm_source=social',
    '#result=workers',
  ]) {
    assert.equal(languagePersonaOutcomeFromHash(search), null, `${search || 'a bare search'} falls back`);
  }
});

test('the two packs keep strictly disjoint routes and outcome IDs', () => {
  assert.notEqual(languagePersonaPath, cloudflarePersonaPath);
  assert.equal(languagePersonaPath, '/share/experiences/language-type');
  assert.equal(cloudflarePersonaPath, '/share/experiences/developer-type');
  for (const id of languagePersonaIds) {
    assert.ok(!Object.hasOwn(cloudflarePersonaOutcomes, id), `${id} is not a Cloudflare outcome`);
  }
  for (const id of cloudflarePersonaIds) {
    assert.ok(!Object.hasOwn(languagePersonaOutcomes, id), `${id} is not a language outcome`);
  }
  for (const id of languagePersonaIds) {
    assert.equal(cloudflarePersonaOutcomeFromHash(`#result=${id}`), null, `the service quiz refuses ${id}`);
  }
  for (const id of cloudflarePersonaIds) {
    assert.equal(languagePersonaOutcomeFromHash(`#result=${id}`), null, `the language quiz refuses ${id}`);
    assert.equal(cloudflarePersonaResultPath(id), `/share/experiences/developer-type#result=${id}`);
  }
});

test('the sibling quiz joins Share discovery on owned Internet Workshop artwork', () => {
  const experience = experiences['language-type'];
  assert.equal(experience.title, 'Language Type Quiz', 'a neutral App Composer product title');
  assert.equal(experience.slug, 'what-build');
  assert.match(experience.description, /eight ordinary project moments/i);
  assert.ok(existsSync(read(`public${experienceArt('language-type')}`)), 'the stage art exists');
  assert.ok(existsSync(read(`public${experienceOg('language-type')}`)), 'the share card exists');
  assert.ok(existsSync(read(`public${experienceArt('language-type').replace('.jpg', '-480.webp')}`)));
  assert.equal(experienceArt('language-type'), '/campaign/internet-workshop-20261122/what-build-v1.jpg');
  assert.equal(experienceArt('developer-type'), '/campaign/internet-workshop-20261122/which-cloudflare-v1.jpg');
});

test('the shared engine, stage and controller serve both packs', () => {
  assert.deepEqual(Object.keys(personaPacks), ['developer-type', 'language-type']);
  assert.equal(personaFor('language-type'), languageTypePersona);
  assert.equal(personaFor('developer-type'), developerTypePersona);
  assert.equal(personaFor('top-nine'), null);
  assert.equal(languageTypePersona.firstQuestion.prompt, languagePersonaQuestions[0].prompt);
  assert.equal(languageTypePersona.questionCount, 8);
  assert.equal(languageTypePersona.cardLabel, 'LANGUAGE TYPE');

  const controller = source('browser/share-experiences.ts');
  assert.match(controller, /function mountPersona\(root: HTMLElement, update: \(\) => void, pack: PersonaPack\)/);
  assert.match(controller, /: persona \? mountPersona\(root, update, persona\)/);
  assert.doesNotMatch(controller, /mountCloudflarePersona/);

  const stage = source('components/share-experiences/ShareExperience.astro');
  assert.match(stage, /\{persona && <section data-play-panel class="door-stage persona-stage" aria-label=\{persona\.stageLabel\}>/);
  assert.match(stage, /href=\{persona\.path\}/);
  assert.doesNotMatch(stage, /cloudflarePersonaQuestions/);
});

test('the language route reuses the scoped local-image middleware only', () => {
  const middleware = source('middleware.ts');
  assert.ok(middleware.includes('twenty-one-questions|this-or-that|developer-type|language-type'));
  const block = middleware.split('twenty-one-questions')[1]?.split('X-Content-Type-Options')[0];
  assert.ok(block);
  assert.match(block, /^\|this-or-that\|developer-type\|language-type\)\\\/\?\$/);
  assert.ok(block.includes(`csp.replace("img-src 'self'", "img-src 'self' blob:")`));
  assert.doesNotMatch(block, /connect-src|frame-src|script-src/);
});

test('the established three-format card prints the same copy from a result link', () => {
  assert.deepEqual([...personaCardFormats], ['square', 'portrait', 'story']);
  const expected = {
    square: [1080, 1080],
    portrait: [1080, 1350],
    story: [1080, 1920],
  };
  for (const format of personaCardFormats) {
    const layout = personaCardLayout(format);
    assert.deepEqual([layout.width, layout.height], expected[format], `${format} is its exact canvas`);
    assert.deepEqual([layout.width, layout.height], resultSizes[format], `${format} reuses the shared sizes`);
  }

  for (const id of languagePersonaIds) {
    const copy = languageTypeCardCopy(id);
    assert.deepEqual(Object.keys(copy).sort(), ['archetype', 'language', 'reason', 'tendency']);
    const text = Object.values(copy).join(' ');
    assert.ok(!/https?:|#result|\.com|\.org|\.net/i.test(text), `${id} carries no address`);
    const fromLink = languagePersonaOutcomeFromHash(`#result=${id}`);
    assert.deepEqual(languageTypeCardCopy(fromLink), copy, `${id} prints the same copy from a link`);
    assert.deepEqual(languageTypePersona.card(id), {
      archetype: copy.archetype,
      subject: copy.language,
      tendency: copy.tendency,
      reason: copy.reason,
    });
    assert.equal(languageTypePersona.outcome(id).docsText, `Read the official ${copy.language} documentation`);
  }
  assert.ok(!/https?:|#result/i.test(languageTypeCardCredit));
});

test('the original Cloudflare service quiz keeps its exact playable parity', () => {
  for (const id of cloudflarePersonaIds) {
    const outcome = cloudflarePersonaOutcomes[id];
    assert.deepEqual(developerTypePersona.outcome(id), {
      archetype: outcome.archetype,
      subject: outcome.service,
      tendency: outcome.tendency,
      reason: outcome.reason,
      href: outcome.href,
      docsText: `Read the official ${outcome.service} docs`,
      docsAria: `Read the official ${outcome.service} documentation on developers.cloudflare.com, opens in a new tab`,
    });
    const card = developerTypeCardCopy(id);
    assert.deepEqual(developerTypePersona.card(id), {
      archetype: card.archetype,
      subject: card.service,
      tendency: card.tendency,
      reason: card.reason,
    });
    assert.equal(developerTypePersona.resultPath(id), cloudflarePersonaResultPath(id));
    assert.equal(developerTypePersona.outcomeFromHash(`#result=${id}`), id);
  }
  assert.equal(developerTypePersona.path, '/share/experiences/developer-type');
  assert.equal(developerTypePersona.cardLabel, 'DEVELOPER TYPE');
  assert.equal(developerTypePersona.cardCredit, developerTypeCardCredit);
  assert.deepEqual(developerTypePersona.skinLabels, ['Midnight etching', 'Aged amber', 'Night archive']);
  assert.deepEqual(languageTypePersona.skinLabels, ['Canyon dawn', 'Warm paper', 'Night archive']);
});

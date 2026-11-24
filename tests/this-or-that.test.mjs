import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  booksAndMusicQuestions, booksAndMusicResultTitle,
  everydayQuestions, everydayResultTitle,
  filmAndTvQuestions, filmAndTvResultTitle,
  gamesQuestions, gamesResultTitle, sweetOrSpicyQuestions, sweetOrSpicyResultTitle,
  technologyQuestions, technologyResultTitle,
  thisOrThatPacks, thisOrThatQuestions, thisOrThatResultTitle,
  travelQuestions, travelResultTitle,
} from '../src/lib/share-experiences.ts';
import {
  customThisOrThatTitle, moveThisOrThatCustom, pickThisOrThat, restoreThisOrThatLength,
  restoreThisOrThatPack, restoreThisOrThatPicks, thisOrThatComplete, thisOrThatCount,
  thisOrThatLengths, thisOrThatProgress, thisOrThatStart, thisOrThatSummary,
  thisOrThatDraftRowCount, readThisOrThatCustom, undoThisOrThat,
  thisOrThatBlankLink, thisOrThatBlankPath, thisOrThatPackFromQuery,
  compareThisOrThatChoices, readThisOrThatComparisonOffer,
} from '../src/lib/this-or-that.ts';
import { resultColumns } from '../src/browser/share-experience-image.ts';

// The registry is the one source of truth for the selector, blank links and
// shared results. New named packs extend it; the three shipped starters keep
// their exact values and the written five stays outside the registry.
const registryKeys = [
  'maker', 'food', 'games', 'film-tv', 'books-music', 'travel', 'technology', 'everyday',
];

const shippedStarters = {
  maker: [
    ['A free Saturday lands in your lap.', 'Start something brand new', 'Finish the nearly-done thing'],
    ['Your best making hour is…', 'Early morning, first coffee', 'Late night, headphones on'],
    ['The build stops cooperating.', 'Walk away and come back fresh', 'Push through, it’s nearly there'],
    ['A shiny new tool crosses your feed.', 'Try it this weekend', 'Stick with the tools I know'],
    ['It finally works.', 'Write it down while it’s fresh', 'Show someone right away'],
  ],
  food: [
    ['You have one tray left in the oven.', 'Sticky cinnamon buns', 'Harissa roasted cauliflower'],
    ['A friend texts: bring a snack.', 'Honey shortbread', 'Chilli lime cashews'],
    ['It’s your turn to pick the film food.', 'Caramel popcorn', 'Chilli salt popcorn'],
    ['The recipe asks for one bold pinch.', 'Cardamom and orange zest', 'Smoked paprika and chilli'],
    ['There’s one bite left on the shared plate.', 'The honey-glazed one', 'The chilli-dusted one'],
  ],
  games: [
    ['Your perfect setup starts with…', 'A mechanical keyboard and a big monitor', 'A controller and the couch'],
    ['Game night with friends means…', 'A headset and a busy voice chat', 'Pass the controller around the sofa'],
    ['The upgrade you save for is…', 'A faster graphics card', 'A bigger television'],
    ['After a great run, you want to keep…', 'A clip of the last ten seconds', 'A screenshot of the final score'],
    ['When a new game lands, you…', 'Dial in the graphics settings', 'Press start and learn as you go'],
  ],
};

// The #1064 early slice: five friendly explicit choices, thumb or keyboard,
// one-step undo and a real ending that lists the exact selections. These
// checks cover the pure choice state; the played journey is verified in a
// browser by the parent release.

test('the starter is five questions, each with two explicit friendly choices', () => {
  assert.equal(thisOrThatQuestions.length, 5);
  assert.equal(thisOrThatCount, 5);
  for (const [prompt, left, right] of thisOrThatQuestions) {
    assert.match(prompt, /\S/);
    assert.ok(left.trim() === left && left.length > 0, 'choices carry their own wording');
    assert.ok(right.trim() === right && right.length > 0);
    assert.notEqual(left, right);
  }
});

test('a finished run lists exactly the five chosen texts within the shared limit', () => {
  for (const sides of [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [0, 1, 1, 0, 1]]) {
    const summary = thisOrThatSummary(sides);
    const chosen = thisOrThatQuestions.map(([, left, right], index) => (sides[index] === 0 ? left : right));
    assert.equal(summary.subtitle, chosen.join(' · '));
    assert.deepEqual(summary.items, chosen, 'the summary exposes the five exact ordered chosen items');
    assert.equal(summary.title, thisOrThatResultTitle);
    assert.deepEqual(summary.sides, sides);
    assert.ok(summary.subtitle.length <= 240, 'the listing fits the shared result contract');
    assert.equal(thisOrThatComplete(sides), true);
  }
});

test('no result exists until every question has one exact pick', () => {
  assert.equal(thisOrThatSummary(thisOrThatStart()), null);
  assert.equal(thisOrThatSummary([0, 1, null, null, null]), null);
  assert.equal(thisOrThatComplete([0, 1, null, null, null]), false);
  assert.equal(thisOrThatComplete(thisOrThatStart()), false);
});

test('picks advance one question at a time and ignore stale or repeat taps', () => {
  let picks = thisOrThatStart();
  assert.equal(pickThisOrThat(picks, 2, 0), null, 'a later question cannot be answered first');
  assert.equal(pickThisOrThat(picks, -1, 0), null);
  assert.equal(pickThisOrThat(picks, 0, 2), null, 'a side is either this or that');
  picks = pickThisOrThat(picks, 0, 1);
  assert.deepEqual(picks, [1, null, null, null, null]);
  assert.equal(pickThisOrThat(picks, 0, 0), null, 'a repeat tap on an answered question changes nothing');
  assert.equal(pickThisOrThat(picks, 2, 1), null, 'only the next unanswered question accepts a pick');
  picks = pickThisOrThat(picks, 1, 0);
  assert.deepEqual(picks, [1, 0, null, null, null]);
});

test('undo removes exactly the most recent pick, one step at a time', () => {
  assert.equal(undoThisOrThat(thisOrThatStart()), null);
  let picks = thisOrThatStart();
  picks = pickThisOrThat(picks, 0, 0);
  picks = pickThisOrThat(picks, 1, 1);
  picks = undoThisOrThat(picks);
  assert.deepEqual(picks, [0, null, null, null, null]);
  picks = pickThisOrThat(picks, 1, 0);
  assert.deepEqual(picks, [0, 0, null, null, null], 'the undone question accepts a different choice');
  picks = undoThisOrThat(picks);
  picks = undoThisOrThat(picks);
  assert.deepEqual(picks, [null, null, null, null, null]);
  assert.equal(undoThisOrThat(picks), null);
});

test('progress reports the current question out of five', () => {
  assert.deepEqual(thisOrThatProgress(thisOrThatStart()), { question: 1, total: 5 });
  assert.deepEqual(thisOrThatProgress(pickThisOrThat(thisOrThatStart(), 0, 1)), { question: 2, total: 5 });
  assert.deepEqual(thisOrThatProgress([1, 0, 1, 0, 1]), { question: 5, total: 5 });
});

test('a shared result restores only with one pick for every question', () => {
  assert.deepEqual(restoreThisOrThatPicks([0, 1, 0, 1, 0]), [0, 1, 0, 1, 0]);
  const bad = [
    [], [0, 1, 0, 1], [0, 1, 0, 1, 0, 1], [0, 1, 0, 1, null], [0, 1, 0, 1, '1'],
    [null, null, null, null, null], '01010', 5, { 0: 1 },
    // A nine-run's sides never decode as a shared result: the built-in
    // decoder stays five-only, so no crafted link can pose as a nine finish.
    [0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];
  for (const value of bad) assert.equal(restoreThisOrThatPicks(value), null);
});

test('a restored run produces the same exact ending as the original', () => {
  const sides = restoreThisOrThatPicks([1, 1, 0, 0, 1]);
  const summary = thisOrThatSummary(sides);
  const chosen = thisOrThatQuestions.map(([, left, right], index) => (sides[index] === 0 ? left : right));
  assert.equal(summary.subtitle, chosen.join(' · '));
});

// #1064: one optional, local comparison offered only from a validated complete
// built-in shared result. It counts actual shared positions of one exact
// replay, keeps the prior picks in tab memory and never becomes a link value.
test('a local comparison counts one exact complete built-in replay only', async () => {
  const prior = restoreThisOrThatPicks([0, 1, 0, 1, 0]);
  const current = [0, 1, 1, 1, 0];
  const compared = compareThisOrThatChoices(prior, current);
  assert.ok(compared);
  assert.equal(compared.same, 4);
  assert.equal(compared.different, 1);
  assert.equal(compared.total, 5);
  assert.deepEqual(compared.rows.map((row) => row.same), [true, true, false, true, true]);
  const questions = thisOrThatPacks.maker.questions;
  assert.deepEqual(compared.rows.map((row) => row.prompt), questions.map(([prompt]) => prompt),
    'every row is one real question both runs answered');
  assert.equal(compared.rows[2].shared, questions[2][1], 'the shared side is its exact chosen text');
  assert.equal(compared.rows[2].own, questions[2][2], 'the replay side is its exact chosen text');

  // Partial, longer, or different-length runs are never comparable.
  assert.equal(compareThisOrThatChoices(prior, [0, 1, 0, 1]), null);
  assert.equal(compareThisOrThatChoices([0, 1, 0, 1, null], current), null);
  assert.equal(compareThisOrThatChoices(prior, current, nineQuestions), null);
  assert.equal(compareThisOrThatChoices(thisOrThatStart(), current), null);

  // Only a complete, known built-in five offers a comparison.
  assert.deepEqual(
    readThisOrThatComparisonOffer([1, 0, 1, 0, 1], 'food'),
    { pack: 'food', picks: [1, 0, 1, 0, 1] },
  );
  assert.deepEqual(
    readThisOrThatComparisonOffer([0, 1, 0, 1, 0], undefined),
    { pack: 'maker', picks: [0, 1, 0, 1, 0] },
    'an older maker link still offers the same safe comparison',
  );
  for (const pack of ['custom', 'unknown', '', 5, null, {}, ['food']]) {
    assert.equal(readThisOrThatComparisonOffer([0, 1, 0, 1, 0], pack), null, `${JSON.stringify(pack)} is not a built-in pack`);
  }
  for (const marked of [
    [], [0, 1, 0, 1], [0, 1, 0, 1, 0, 1], [0, 1, 0, 1, null],
    [1, 0, 1, 0, 1, 0, 1, 0, 1], '01010',
  ]) {
    assert.equal(readThisOrThatComparisonOffer(marked, 'maker'), null, 'a partial or other-length fragment never qualifies');
  }

  // The action is explicit, hidden until a shared built-in result, and the
  // count is a live status list — not an input, link or saved value.
  const component = await readFile(
    new URL('../src/components/share-experiences/ShareExperience.astro', import.meta.url),
    'utf8',
  );
  assert.match(component, /<button type="button" class="secondary" data-tot-compare>Compare your choices<\/button>/);
  assert.match(component,
    /<h2 tabindex="-1" data-reveal-title><\/h2>\s*<div class="tot-compare" data-tot-compare-panel hidden>[\s\S]*?<\/div>\s*<div class="tot-compare-result" data-tot-compare-result hidden role="status" aria-live="polite">[\s\S]*?<\/div>\s*<div class="tot-result-actions">/,
    'the hidden shared comparison blocks follow the reveal heading and precede result actions',
  );
  const controller = await readFile(
    new URL('../src/browser/share-experiences.ts', import.meta.url),
    'utf8',
  );
  assert.match(controller, /readThisOrThatComparisonOffer\(snapshot\.marked, snapshot\.pack\)/,
    'the offer is decided by the validated shared snapshot only');
  assert.match(controller, /compareThisOrThatChoices\(prior\.picks, picks/);
  assert.match(controller, /dropSharedByline\(\);/, 'the earlier byline is cleared before the replay starts');
  assert.match(controller, /function clearComparison\(\)/);
  assert.match(controller, /restart\.addEventListener\("click", \(\) => \{[\s\S]{0,120}clearComparison\(\);/,
    'a fresh replay drops the comparison');
});

test('the food starter is five original sweet-or-spicy choices from one point of view', () => {
  assert.equal(sweetOrSpicyQuestions.length, 5);
  assert.equal(thisOrThatPacks.food.questions, sweetOrSpicyQuestions);
  assert.equal(thisOrThatPacks.food.title, sweetOrSpicyResultTitle);
  const sweet = /cinnamon|honey|caramel|cardamom|sweet|glaz/i;
  const spicy = /harissa|chilli|paprika|fiery|spicy/i;
  for (const [prompt, left, right] of sweetOrSpicyQuestions) {
    assert.match(prompt, /\S/);
    assert.ok(left.trim() === left && left.length > 0);
    assert.ok(right.trim() === right && right.length > 0);
    assert.notEqual(left, right);
    assert.equal([left, right].filter((text) => sweet.test(text)).length, 1, 'exactly one sweet choice');
    assert.equal([left, right].filter((text) => spicy.test(text)).length, 1, 'exactly one spicy choice');
  }
});

test('the games starter has five complete pairs and its own result', () => {
  assert.equal(gamesQuestions.length, 5);
  assert.equal(thisOrThatPacks.games.questions, gamesQuestions);
  assert.equal(thisOrThatPacks.games.title, gamesResultTitle);
  assert.notEqual(gamesResultTitle, thisOrThatResultTitle);
  assert.notEqual(gamesResultTitle, sweetOrSpicyResultTitle);
  for (const [prompt, left, right] of gamesQuestions) {
    assert.match(prompt, /\S/);
    assert.ok(left.trim() === left && left.length > 0);
    assert.ok(right.trim() === right && right.length > 0);
    assert.notEqual(left, right);
  }
});

test('the registry keeps the three shipped starters and adds five named packs', () => {
  assert.deepEqual(Object.keys(thisOrThatPacks), registryKeys);
  assert.equal(Object.hasOwn(thisOrThatPacks, 'custom'), false, 'the written five is not a registry preset');
  for (const [pack, questions] of Object.entries(shippedStarters)) {
    assert.deepEqual(
      thisOrThatPacks[pack].questions.map((question) => [...question]),
      questions,
      `${pack} keeps its exact shipped questions and choices`,
    );
  }
  assert.equal(thisOrThatPacks.maker.title, thisOrThatResultTitle);
  assert.equal(thisOrThatPacks.food.title, sweetOrSpicyResultTitle);
  assert.equal(thisOrThatPacks.games.title, gamesResultTitle);
});

test('each named pack has five complete, original choices and its own short title', () => {
  const named = [
    ['film-tv', filmAndTvQuestions, filmAndTvResultTitle],
    ['books-music', booksAndMusicQuestions, booksAndMusicResultTitle],
    ['travel', travelQuestions, travelResultTitle],
    ['technology', technologyQuestions, technologyResultTitle],
    ['everyday', everydayQuestions, everydayResultTitle],
  ];
  for (const [pack, questions, title] of named) {
    assert.equal(thisOrThatPacks[pack].questions, questions, `${pack} plays its own five`);
    assert.equal(thisOrThatPacks[pack].title, title, `${pack} keeps its own heading`);
    assert.equal(questions.length, 5);
    assert.ok(title.length > 0 && title.length <= 30, `${pack} heading stays concise`);
    for (const [prompt, left, right] of questions) {
      assert.ok(prompt.trim() === prompt && prompt.length > 0 && prompt.length <= 40, 'prompt fits a phone card');
      assert.ok(left.trim() === left && left.length > 0 && left.length <= 40, 'first label fits a phone card');
      assert.ok(right.trim() === right && right.length > 0 && right.length <= 40, 'second label fits a phone card');
      assert.notEqual(left.toLowerCase(), right.toLowerCase(), 'the two labels are genuinely different');
      assert.ok(!/[\r\n]/.test(`${prompt}${left}${right}`), 'every value is plain single-line text');
    }
  }
  const titles = Object.values(thisOrThatPacks).map(({ title }) => title);
  assert.equal(new Set(titles).size, titles.length, 'every pack has its own result heading');
  assert.ok(titles.every((title) => title.length <= 30), 'every heading stays concise');
});

test('no prompt or choice is duplicated anywhere in the registry', () => {
  const seen = new Map();
  for (const [pack, { questions }] of Object.entries(thisOrThatPacks)) {
    for (const [prompt, left, right] of questions) {
      for (const text of [prompt, left, right]) {
        const folded = text.toLowerCase();
        assert.equal(seen.has(folded), false, `${pack} repeats “${text}” from ${seen.get(folded)}`);
        seen.set(folded, pack);
      }
    }
  }
  assert.equal(seen.size, registryKeys.length * 5 * 3, 'the registry carries only distinct values');
});

test('the native starter selector offers every registry pack plus the written five', async () => {
  const source = await readFile(
    new URL('../src/components/share-experiences/ShareExperience.astro', import.meta.url),
    'utf8',
  );
  const select = source.match(/<select id="tot-pack" data-tot-pack[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, 'the This or That starter selector is present');
  const values = [...select[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(values, [...registryKeys, 'custom']);
});

test('initial This or That controls are disabled in markup until one safe mount entry releases them', async () => {
  const source = await readFile(
    new URL('../src/components/share-experiences/ShareExperience.astro', import.meta.url),
    'utf8',
  );
  assert.match(source, /<select id="tot-pack" data-tot-pack disabled>/);
  assert.match(source, /<button type="button" data-choice="0" disabled>/);
  assert.match(source, /<button type="button" data-choice="1" disabled>/);
  assert.match(source, /<button type="submit" disabled>Play my questions<\/button>/);
  const controller = await readFile(
    new URL('../src/browser/share-experiences.ts', import.meta.url),
    'utf8',
  );
  assert.match(controller, /activate\?\(\): void/);
  assert.match(controller, /packSelect\.disabled = false;/);
  assert.match(controller, /elements<HTMLButtonElement>\(root, "\[data-choice\]"\)[\s\S]{0,120}button\.disabled = false/);
  assert.match(controller, /controller\.activate\?\.\(\);/);
});

test('the reveal has one local Download PNG shortcut on the shared export path', async () => {
  const source = await readFile(
    new URL('../src/components/share-experiences/ShareExperience.astro', import.meta.url),
    'utf8',
  );
  const reveal = source.match(/<section hidden class="door-result tot-result" data-tot-result[\s\S]*?<\/section>/);
  assert.ok(reveal, 'the This-or-That result section is present');
  assert.match(reveal[0], /<div class="tot-result-actions">\s*<div class="tot-reveal-download">\s*<button type="button" data-reveal-download disabled>Download PNG<\/button>/);
  assert.match(reveal[0], /<span class="tot-reveal-download-note" aria-hidden="true" data-reveal-download-note><\/span>/,
    'local feedback is visual only, leaving the existing status as the one live region');
  assert.equal((source.match(/\bdata-reveal-download(?=[\s>])/g) ?? []).length, 1, 'only one shortcut is added');
  assert.ok(source.indexOf('data-export-panel') > source.indexOf('data-tot-result'),
    'the detailed export controls stay further down the page');
  const controller = await readFile(
    new URL('../src/browser/share-experiences.ts', import.meta.url),
    'utf8',
  );
  assert.match(controller, /const runDownload = async \(fromReveal = false\) => \{/);
  assert.match(controller, /download\.addEventListener\("click", \(\) => \{ void runDownload\(\); \}\);/);
  assert.match(controller, /revealDownload\?\.addEventListener\("click", \(\) => \{ void runDownload\(true\); \}\);/);
  assert.match(controller, /if \(revealDownload\) revealDownload\.disabled = download\.disabled;/);
  assert.match(controller, /revealNote\("Preparing PNG…"\)/);
  assert.match(controller, /revealNote\("Your image is ready\."\)/);
  assert.match(controller, /revealNote\("Couldn’t prepare the PNG\. Try again\."\)/);
});

test('a shared starter is explicit and version-safe; old links stay maker', () => {
  for (const value of [undefined, null, '', 'unknown', 5, {}, ['maker']]) {
    assert.equal(restoreThisOrThatPack(value), 'maker', 'absent or invalid packs keep the original starter');
  }
  assert.equal(restoreThisOrThatPack('maker'), 'maker');
  assert.equal(restoreThisOrThatPack('food'), 'food');
  assert.equal(restoreThisOrThatPack('games'), 'games');
  assert.equal(restoreThisOrThatPack('custom'), 'maker', 'the written five is not a linkable preset');
  for (const pack of registryKeys) assert.equal(restoreThisOrThatPack(pack), pack);
  assert.equal(thisOrThatPacks.maker.title, thisOrThatResultTitle);
  assert.equal(thisOrThatPacks.food.title, sweetOrSpicyResultTitle);
});

test('a shared result restores the exact starter and its exact choice texts', () => {
  for (const pack of registryKeys) {
    const selected = thisOrThatPacks[pack];
    const sides = restoreThisOrThatPicks([0, 1, 0, 1, 0]);
    const summary = thisOrThatSummary(sides, selected.questions, selected.title);
    const chosen = selected.questions.map(([, left, right], index) => (sides[index] === 0 ? left : right));
    assert.equal(summary.title, selected.title, `${pack} keeps its own heading`);
    assert.deepEqual(summary.items, chosen, `${pack} keeps the exact chosen texts`);
    assert.equal(summary.subtitle, chosen.join(' · '));
    assert.ok(summary.subtitle.length <= 240);
  }
});

test('the starter survives the exact shared-snapshot encode/decode round trip', () => {
  // Mirrors resultLink (URLSearchParams + JSON.stringify) and sharedResult
  // (URLSearchParams.get + JSON.parse) in src/browser/share-experiences.ts.
  for (const pack of registryKeys) {
    const encoded = new URLSearchParams({ result: JSON.stringify({ game: 'this-or-that', pack }) }).toString();
    const decoded = JSON.parse(new URLSearchParams(encoded).get('result'));
    assert.equal(decoded.game, 'this-or-that');
    assert.equal(decoded.pack, pack, `${pack} is not dropped by the link encode/decode`);
    assert.equal(restoreThisOrThatPack(decoded.pack), pack, `${pack} reopens the same starter`);
  }
  // A result shared before packs existed still restores the maker starter.
  const old = new URLSearchParams({
    result: JSON.stringify({ game: 'this-or-that', title: 'Your maker rhythm' }),
  }).toString();
  const oldResult = JSON.parse(new URLSearchParams(old).get('result'));
  assert.equal(restoreThisOrThatPack(oldResult.pack), 'maker');
});

test('a blank starter link is the canonical path with at most one exact pack and no fragment', () => {
  assert.equal(thisOrThatBlankPath, '/share/experiences/this-or-that');
  assert.equal(thisOrThatBlankLink('maker'), '/share/experiences/this-or-that');
  assert.equal(thisOrThatBlankLink('food'), '/share/experiences/this-or-that?pack=food');
  assert.equal(thisOrThatBlankLink('games'), '/share/experiences/this-or-that?pack=games');
  assert.equal(thisOrThatBlankLink('film-tv'), '/share/experiences/this-or-that?pack=film-tv');
  for (const pack of registryKeys) {
    const link = thisOrThatBlankLink(pack);
    assert.equal(link.includes('#'), false, 'no result fragment travels');
    assert.equal(link.includes('result='), false);
    assert.equal(link.includes('byline'), false);
    assert.equal(link.includes('answer'), false);
    assert.deepEqual(
      [...new URLSearchParams(link.split('?')[1] ?? '').keys()],
      pack === 'maker' ? [] : ['pack'],
      'no query except the exact optional pack',
    );
  }
});

test('a blank link only reopens a starter for exactly one known pack value', () => {
  assert.equal(thisOrThatPackFromQuery(''), 'maker');
  assert.equal(thisOrThatPackFromQuery('?'), 'maker');
  assert.equal(thisOrThatPackFromQuery('?pack=food'), 'food');
  assert.equal(thisOrThatPackFromQuery('?pack=games'), 'games');
  assert.equal(thisOrThatPackFromQuery('pack=maker'), 'maker');
  for (const pack of registryKeys) {
    assert.equal(thisOrThatPackFromQuery(`?pack=${pack}`), pack, `${pack} reopens from one exact hint`);
  }
  // Missing, repeated, custom and malformed hints never invent a preset.
  for (const search of [
    '?pack=', '?pack=unknown', '?pack=custom', '?pack=food&pack=food',
    '?pack=games&pack=games', '?pack=film-tv&pack=film-tv',
    '?pack=travel&pack=everyday', '?pack=food&pack=maker', '?pack[]=food', '?pack[]=games',
    '?pack=Film-TV', '?result=%7B%22game%22%3A%22this-or-that%22%7D',
  ]) {
    assert.equal(thisOrThatPackFromQuery(search), 'maker', `${search || 'empty'} stays Maker`);
  }
  for (const search of [
    '', '?pack=', '?pack=unknown', '?pack=custom', '?pack=food&pack=food',
    '?pack=travel&pack=everyday',
  ]) {
    assert.equal(thisOrThatBlankLink(thisOrThatPackFromQuery(search)), thisOrThatBlankPath,
      'only one known pack hint produces a pack URL');
  }
});

test('a draft row move carries every prompt and option, including half-written text', () => {
  const draft = [
    ['Prompt one', 'Left one', 'Right one'],
    ['Prompt two', 'Left two', 'Right two'],
    ['Half prompt', '', 'Right three'],
    ['', 'Left four', ''],
    ['Prompt five', 'Left five', 'Right five'],
  ];
  const up = moveThisOrThatCustom(draft, 2, -1);
  assert.deepEqual(up[1], ['Half prompt', '', 'Right three'], 'the whole moved row keeps its blank value');
  assert.deepEqual(up[2], ['Prompt two', 'Left two', 'Right two'], 'the displaced row moves down intact');
  assert.deepEqual(draft[2], ['Half prompt', '', 'Right three'], 'the source draft is never mutated');
  assert.deepEqual(moveThisOrThatCustom(draft, 0, -1), draft, 'moving the first row up is a no-op');
  assert.deepEqual(moveThisOrThatCustom(draft, 4, 1), draft, 'moving the last row down is a no-op');

  const moved = moveThisOrThatCustom(draft, 3, -1);
  assert.deepEqual(moved[2], ['', 'Left four', ''], 'a partially entered row moves as typed');
  assert.deepEqual(moveThisOrThatCustom(moved, 2, 1), draft, 'a move can be undone');

  const playable = thisOrThatQuestions.map(([prompt, left, right]) => [prompt, left, right]);
  const reordered = moveThisOrThatCustom(playable, 4, -1);
  assert.deepEqual(reordered[3], playable[4]);
  assert.deepEqual(reordered[4], playable[3]);
  assert.deepEqual(readThisOrThatCustom(reordered).questions?.map((row) => [...row]), reordered,
    'a reordered complete five still validates without changing any text');
});

// The optional authored nine and eleven: private/local lengths beside the
// default five. These checks hold the pure boundaries — the offered lengths,
// full run lifecycles, the five-only share decoder, and the exact chosen texts
// a finished run exposes for the PNG.

const nineQuestions = Array.from({ length: 9 }, (_, index) =>
  [`Question ${index + 1}?`, `Left ${index + 1}`, `Right ${index + 1}`]);
const elevenQuestions = Array.from({ length: 11 }, (_, index) =>
  [`Question ${index + 1}?`, `Left ${index + 1}`, `Right ${index + 1}`]);

test('the authored lengths are exactly five, nine or eleven, and only a known value widens them', () => {
  assert.deepEqual(thisOrThatLengths, [5, 9, 11]);
  assert.equal(thisOrThatDraftRowCount, 11);
  assert.equal(restoreThisOrThatLength('5'), 5);
  assert.equal(restoreThisOrThatLength('9'), 9);
  assert.equal(restoreThisOrThatLength('11'), 11);
  for (const value of [undefined, null, '', '4', '10', '21', 'nine', 5, 9, 11, {}, ['9']]) {
    assert.equal(restoreThisOrThatLength(value), 5, `${JSON.stringify(value)} keeps the default five`);
  }
  assert.deepEqual(thisOrThatStart(9), Array.from({ length: 9 }, () => null));
  assert.equal(thisOrThatStart(9).length, 9);
  assert.deepEqual(thisOrThatStart(11), Array.from({ length: 11 }, () => null));
  assert.equal(thisOrThatStart().length, 5, 'the default run stays the built-in five');
});

test('a nine-question authored run plays, undoes and completes exactly like the five', () => {
  let picks = thisOrThatStart(9);
  assert.deepEqual(thisOrThatProgress(picks), { question: 1, total: 9 });
  assert.equal(pickThisOrThat(picks, 8, 0), null, 'a later question cannot be answered first');
  assert.equal(pickThisOrThat(picks, 0, 2), null, 'a side is either this or that');
  picks = pickThisOrThat(picks, 0, 1);
  assert.deepEqual(picks, [1, null, null, null, null, null, null, null, null]);
  assert.equal(pickThisOrThat(picks, 0, 0), null, 'a repeat tap on an answered question changes nothing');
  picks = undoThisOrThat(picks);
  assert.deepEqual(picks, thisOrThatStart(9), 'undo clears the most recent nine-run pick');
  for (let index = 0; index < 9; index += 1) {
    const next = pickThisOrThat(picks, index, index % 2);
    assert.ok(next, `question ${index + 1} accepts its pick in order`);
    picks = next;
  }
  assert.deepEqual(thisOrThatProgress(picks), { question: 9, total: 9 });
  assert.equal(thisOrThatComplete(picks, 9), true);
  assert.equal(thisOrThatComplete(picks), false, 'a finished nine is not a complete five');
  assert.equal(thisOrThatComplete(picks.slice(0, 5), 9), false, 'five picks cannot finish a nine');
});

test('an eleven-question authored run progresses through every row and lists all eleven choices', () => {
  let picks = thisOrThatStart(11);
  assert.deepEqual(thisOrThatProgress(picks), { question: 1, total: 11 });
  assert.equal(pickThisOrThat(picks, 10, 0), null, 'the eleventh question cannot be answered first');
  for (let index = 0; index < 11; index += 1) {
    const next = pickThisOrThat(picks, index, index % 2);
    assert.ok(next, `question ${index + 1} accepts its pick in order`);
    picks = next;
    assert.deepEqual(thisOrThatProgress(picks), { question: Math.min(index + 2, 11), total: 11 });
  }
  assert.equal(thisOrThatComplete(picks, 11), true);
  assert.equal(thisOrThatComplete(picks), false, 'a finished eleven is not a complete five');
  const summary = thisOrThatSummary(picks, elevenQuestions, customThisOrThatTitle);
  const chosen = elevenQuestions.map(([, left, right], index) => (picks[index] === 0 ? left : right));
  assert.deepEqual(summary.items, chosen, 'all eleven exact ordered choices reach the PNG');
  assert.deepEqual(summary.sides, [...picks]);
  assert.equal(thisOrThatSummary(picks.slice(0, 10), elevenQuestions), null);
  assert.deepEqual(undoThisOrThat(picks), thisOrThatStart(11).map((_, index) => index < 10 ? picks[index] : null),
    'undo reopens the eleventh question');
});

test('a finished nine-run lists nine exact chosen texts for the PNG rows', () => {
  const sides = [0, 1, 0, 1, 0, 1, 0, 1, 0];
  const summary = thisOrThatSummary(sides, nineQuestions, customThisOrThatTitle);
  const chosen = nineQuestions.map(([, left, right], index) => (sides[index] === 0 ? left : right));
  assert.ok(summary);
  assert.equal(summary.title, customThisOrThatTitle);
  assert.deepEqual(summary.items, chosen, 'the summary exposes the nine exact ordered chosen items');
  assert.deepEqual(summary.sides, [...sides]);
  assert.equal(thisOrThatSummary(thisOrThatStart(9), nineQuestions), null);
  assert.equal(thisOrThatSummary([0, 1, 0, 1, 0, 1, 0, 1, null], nineQuestions), null);
  assert.equal(thisOrThatSummary(sides, nineQuestions.slice(0, 5)), null,
    'five questions cannot carry nine picks');
});

test('reading a custom set validates exactly the chosen length; hidden drafts stay out of play', () => {
  const nineRows = nineQuestions.map(([prompt, left, right]) => [prompt, left, right]);
  const readNine = readThisOrThatCustom(nineRows, 9);
  assert.equal(readNine.gap, -1);
  assert.equal(readNine.reason, null);
  assert.deepEqual(readNine.questions?.map((row) => [...row]), nineRows);

  const same = nineRows.map((row) => [...row]);
  same[6][1] = 'Same'; same[6][2] = 'same';
  assert.deepEqual(readThisOrThatCustom(same, 9), { questions: null, gap: 6, reason: 'same' });

  const empty = nineRows.map((row) => [...row]);
  empty[8][0] = '   ';
  assert.deepEqual(readThisOrThatCustom(empty, 9), { questions: null, gap: 8, reason: 'empty' });

  // At five the editor reads only its five rows: typed drafts in the hidden
  // four are neither validated nor lost, whatever they hold.
  const hidden = nineRows.map((row) => [...row]);
  hidden[5] = ['', 'dup', 'dup'];
  hidden[7] = ['  ', '', ''];
  assert.deepEqual(
    readThisOrThatCustom(hidden).questions?.map((row) => [...row]),
    nineRows.slice(0, 5),
    'hidden rows keep their drafts and never reach validation',
  );
  assert.deepEqual(hidden[5], ['', 'dup', 'dup'], 'the untouched draft is still exactly as typed');

  const elevenRows = elevenQuestions.map(([prompt, left, right]) => [prompt, left, right]);
  assert.deepEqual(readThisOrThatCustom(elevenRows, 11).questions?.map((row) => [...row]), elevenRows);
  const eleventhGap = elevenRows.map((row) => [...row]);
  eleventhGap[10][2] = '';
  assert.deepEqual(readThisOrThatCustom(eleventhGap, 11), { questions: null, gap: 10, reason: 'empty' });
  eleventhGap[10][2] = 'Right 11';
  const hiddenTail = [...elevenRows, ['Hidden twelve', 'Left twelve', 'Right twelve']];
  assert.deepEqual(readThisOrThatCustom(hiddenTail, 11).questions?.map((row) => [...row]), elevenRows,
    'a row beyond eleven never reaches validation or play');
});

test('row moves stay inside the edited length and never disturb hidden drafts', () => {
  const draft = nineQuestions.map(([prompt, left, right]) => [prompt, left, right]);
  assert.deepEqual(moveThisOrThatCustom(draft, 4, 1, 5), draft,
    'the last row of a five cannot move into hidden drafts');
  assert.deepEqual(moveThisOrThatCustom(draft, 5, 1, 5), draft, 'a hidden row never moves at five');
  const moved = moveThisOrThatCustom(draft, 4, 1, 9);
  assert.deepEqual(moved[4], draft[5]);
  assert.deepEqual(moved[5], draft[4]);
  for (let index = 0; index < 9; index += 1) {
    if (index !== 4 && index !== 5) assert.deepEqual(moved[index], draft[index]);
  }
  assert.deepEqual(moveThisOrThatCustom(draft, 8, 1, 9), draft, 'the last of nine stays put');
  const eleven = elevenQuestions.map(([prompt, left, right]) => [prompt, left, right]);
  const movedEleven = moveThisOrThatCustom(eleven, 9, 1, 11);
  assert.deepEqual(movedEleven[9], eleven[10]);
  assert.deepEqual(movedEleven[10], eleven[9]);
  assert.deepEqual(moveThisOrThatCustom(eleven, 10, 1, 11), eleven, 'the last of eleven stays put');
  assert.deepEqual(moveThisOrThatCustom(eleven, 10, 1, 9), eleven, 'a hidden eleven-row draft never moves at nine');
});

test('the native length selector offers exactly five, nine and eleven, never twenty-one', async () => {
  const source = await readFile(
    new URL('../src/components/share-experiences/ShareExperience.astro', import.meta.url),
    'utf8',
  );
  const select = source.match(/<select id="tot-length" data-tot-length>([\s\S]*?)<\/select>/);
  assert.ok(select, 'the authored length selector is present');
  assert.deepEqual(
    [...select[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]),
    ['5', '9', '11'],
  );
  assert.equal((source.match(/Array\.from\(\{ length: thisOrThatDraftRowCount \}/g) ?? []).length, 2,
    'the editor and stage each carry all eleven rows');
  assert.match(source, /hidden=\{index >= thisOrThatQuestions\.length\}/,
    'rows past the built-in five start hidden');
  assert.match(source, /disabled=\{index === thisOrThatQuestions\.length - 1 \|\| index === thisOrThatDraftRowCount - 1\}/,
    'the last visible row alone stops moving down');
});

test('a nine-item result reuses the exhibition grid; eleven compacts a fourth row and five keeps its column', () => {
  assert.equal(resultColumns('this-or-that', 5), 1, 'the built-in five keeps its exact drawing');
  assert.equal(resultColumns('this-or-that', 9), 3, 'an authored nine reuses the proven 3 × 3 grid');
  assert.equal(resultColumns('this-or-that', 11), 3, 'an authored eleven uses the same grid with four rows');
  assert.equal(resultColumns('tech-bingo', 25), 5);
  assert.equal(resultColumns('top-nine', 9), 3);
  assert.equal(resultColumns('pick-a-door', 10), 3);
});

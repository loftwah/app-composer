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
  moveThisOrThatCustom, pickThisOrThat, restoreThisOrThatPack, restoreThisOrThatPicks,
  thisOrThatComplete, thisOrThatCount, thisOrThatProgress, thisOrThatStart,
  thisOrThatBlankLink, thisOrThatBlankPath, thisOrThatPackFromQuery,
  thisOrThatSummary, readThisOrThatCustom, undoThisOrThat,
} from '../src/lib/this-or-that.ts';

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
  ];
  for (const value of bad) assert.equal(restoreThisOrThatPicks(value), null);
});

test('a restored run produces the same exact ending as the original', () => {
  const sides = restoreThisOrThatPicks([1, 1, 0, 0, 1]);
  const summary = thisOrThatSummary(sides);
  const chosen = thisOrThatQuestions.map(([, left, right], index) => (sides[index] === 0 ? left : right));
  assert.equal(summary.subtitle, chosen.join(' · '));
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
  const select = source.match(/<select id="tot-pack" data-tot-pack>([\s\S]*?)<\/select>/);
  assert.ok(select, 'the This or That starter selector is present');
  const values = [...select[1].matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(values, [...registryKeys, 'custom']);
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

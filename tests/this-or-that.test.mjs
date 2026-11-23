import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gamesQuestions, gamesResultTitle, sweetOrSpicyQuestions, sweetOrSpicyResultTitle,
  thisOrThatPacks, thisOrThatQuestions, thisOrThatResultTitle,
} from '../src/lib/share-experiences.ts';
import {
  pickThisOrThat, restoreThisOrThatPack, restoreThisOrThatPicks,
  thisOrThatComplete, thisOrThatCount, thisOrThatProgress, thisOrThatStart,
  thisOrThatBlankLink, thisOrThatBlankPath, thisOrThatPackFromQuery,
  thisOrThatSummary, undoThisOrThat,
} from '../src/lib/this-or-that.ts';

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

test('a shared starter is explicit and version-safe; old links stay maker', () => {
  for (const value of [undefined, null, '', 'unknown', 5, {}, ['maker']]) {
    assert.equal(restoreThisOrThatPack(value), 'maker', 'absent or invalid packs keep the original starter');
  }
  assert.equal(restoreThisOrThatPack('maker'), 'maker');
  assert.equal(restoreThisOrThatPack('food'), 'food');
  assert.equal(restoreThisOrThatPack('games'), 'games');
  assert.equal(thisOrThatPacks.maker.title, thisOrThatResultTitle);
  assert.equal(thisOrThatPacks.food.title, sweetOrSpicyResultTitle);
});

test('a shared result restores the exact starter and its exact choice texts', () => {
  for (const pack of ['maker', 'food', 'games']) {
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
  for (const pack of ['maker', 'food', 'games']) {
    const encoded = new URLSearchParams({ result: JSON.stringify({ game: 'this-or-that', pack }) }).toString();
    const decoded = JSON.parse(new URLSearchParams(encoded).get('result'));
    assert.equal(decoded.game, 'this-or-that');
    assert.equal(decoded.pack, pack, `${pack} is not dropped by the link encode/decode`);
    assert.equal(restoreThisOrThatPack(decoded.pack), pack, `${pack} reopens the same starter`);
  }
});

test('a blank starter link is the canonical path with at most one exact pack and no fragment', () => {
  assert.equal(thisOrThatBlankPath, '/share/experiences/this-or-that');
  assert.equal(thisOrThatBlankLink('maker'), '/share/experiences/this-or-that');
  assert.equal(thisOrThatBlankLink('food'), '/share/experiences/this-or-that?pack=food');
  assert.equal(thisOrThatBlankLink('games'), '/share/experiences/this-or-that?pack=games');
  for (const pack of ['maker', 'food', 'games']) {
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
  // Missing, repeated, custom and malformed hints never invent a preset.
  for (const search of [
    '?pack=', '?pack=unknown', '?pack=custom', '?pack=food&pack=food',
    '?pack=games&pack=games', '?pack=food&pack=maker', '?pack[]=food', '?pack[]=games',
    '?result=%7B%22game%22%3A%22this-or-that%22%7D',
  ]) {
    assert.equal(thisOrThatPackFromQuery(search), 'maker', `${search || 'empty'} stays Maker`);
  }
  for (const search of ['', '?pack=', '?pack=unknown', '?pack=custom', '?pack=food&pack=food']) {
    assert.equal(thisOrThatBlankLink(thisOrThatPackFromQuery(search)), thisOrThatBlankPath,
      'only one known pack hint produces a pack URL');
  }
});

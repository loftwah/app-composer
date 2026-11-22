import test from 'node:test';
import assert from 'node:assert/strict';
import { thisOrThatQuestions, thisOrThatResultTitle } from '../src/lib/share-experiences.ts';
import {
  pickThisOrThat, restoreThisOrThatPicks, thisOrThatComplete, thisOrThatCount,
  thisOrThatProgress, thisOrThatStart, thisOrThatSummary, undoThisOrThat,
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

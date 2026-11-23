import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiences, twentyOneQuestions,
  twentyOneResultTitle,
} from '../src/lib/share-experiences.ts';
import {
  moveTwentyOne, setTwentyOneAnswer, skipTwentyOne, splitTwentyOneCards,
  twentyOneAnswerLimit, twentyOneAnswered, twentyOneCount, twentyOnePairs,
  twentyOneProgress, twentyOneStart,
} from '../src/lib/twenty-one-questions.ts';

// The #1064 twenty-one-questions starter: one authored interview about a
// person’s life online, answered one at a time with skip, back and edit, and
// exported as several local 4:5 cards. These checks cover the pure answer
// state and the card split; the played journey and the local-only screen
// behaviour are verified in a browser by the parent release.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the registry entry reuses the owned specimen artwork without new assets', () => {
  const experience = experiences['twenty-one-questions'];
  assert.equal(experience.title, '21 Questions');
  assert.equal(experience.slug, 'internet-specimen');
  assert.equal(experience.theme, 'museum');
  assert.match(experience.description, /twenty-one questions/i);
  // The stage and share art are existing rights-clear campaign files.
  for (const path of [experienceArt('twenty-one-questions'), experienceOg('twenty-one-questions')]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} exists`);
  }
  const webp = experienceArt('twenty-one-questions').replace('.jpg', '-480.webp');
  assert.ok(existsSync(new URL(`../public${webp}`, import.meta.url)), 'the 480w stage art exists');
});

test('the starter is twenty-one authored natural prompts, each usable on a card', () => {
  assert.equal(twentyOneQuestions.length, 21);
  assert.equal(twentyOneCount, 21);
  assert.equal(new Set(twentyOneQuestions).size, 21, 'no question is repeated');
  for (const question of twentyOneQuestions) {
    assert.ok(question.trim() === question && question.length > 0, 'questions carry their own wording');
    assert.ok(question.length <= 72, 'a question fits its card row');
  }
  assert.match(twentyOneResultTitle, /\S/);
  assert.ok(twentyOneResultTitle.length <= 72);
});

test('a run starts empty and records only cleaned, capped answers', () => {
  const answers = twentyOneStart();
  assert.equal(answers.length, 21);
  assert.ok(answers.every((answer) => answer === ''));
  assert.equal(twentyOneAnswered(answers), 0);

  const messy = '  Early   coffee, before\n anyone   is awake.  ';
  const recorded = setTwentyOneAnswer(answers, 2, messy);
  assert.deepEqual(recorded.slice(0, 3), ['', '', 'Early coffee, before anyone is awake.']);
  assert.equal(twentyOneAnswerLimit, 80, 'the shared answer cap');
  const capped = setTwentyOneAnswer(answers, 0, 'x'.repeat(500));
  assert.equal(capped[0].length, 80, 'a pasted answer is capped, not stored whole');
  // Other answers stay exactly as they were.
  assert.equal(capped[1], '');
  assert.equal(setTwentyOneAnswer(answers, -1, 'no'), null, 'an invalid question records nothing');
  assert.equal(setTwentyOneAnswer(answers, 21, 'no'), null);
});

test('skip clears exactly one answer and editing rewrites one question', () => {
  let answers = twentyOneStart();
  answers = setTwentyOneAnswer(answers, 3, 'a rainy window seat');
  answers = setTwentyOneAnswer(answers, 4, 'fourteen, but who is counting');
  const skipped = skipTwentyOne(answers, 3);
  assert.equal(skipped[3], '', 'the skipped answer is cleared');
  assert.equal(skipped[4], 'fourteen, but who is counting', 'other answers are untouched');
  assert.equal(skipTwentyOne(answers, -2), null);
  assert.equal(skipTwentyOne(answers, 99), null);
  const edited = setTwentyOneAnswer(answers, 3, 'the kitchen bench');
  assert.equal(edited[3], 'the kitchen bench', 'an edit replaces the earlier answer');
  assert.equal(twentyOneAnswered(edited), 2);
});

test('movement is one bounded step and progress counts honest answers', () => {
  let answers = twentyOneStart();
  assert.equal(moveTwentyOne(0, -1), 0, 'back from the first question stays put');
  assert.equal(moveTwentyOne(20, 1), 20, 'forward from the last question stays put');
  assert.equal(moveTwentyOne(5, -2), 3);
  assert.equal(moveTwentyOne(4.5, 1), 0, 'only whole questions move');
  assert.deepEqual(twentyOneProgress(0, answers), { question: 1, total: 21, answered: 0 });
  answers = setTwentyOneAnswer(answers, 0, 'six in the morning');
  assert.deepEqual(twentyOneProgress(1, answers), { question: 2, total: 21, answered: 1 });
  assert.deepEqual(twentyOneProgress(21, answers), { question: 21, total: 21, answered: 1 });
});

test('the summary is made of exactly the nonempty answers, in question order', () => {
  const answers = twentyOneStart();
  assert.deepEqual(twentyOnePairs(answers), [], 'a skipped-only run has no summary rows');
  const partial = setTwentyOneAnswer(setTwentyOneAnswer(twentyOneStart(), 5, 'a kettle and one lamp'), 19, 'the first forum I ever joined');
  const pairs = twentyOnePairs(partial);
  assert.deepEqual(pairs.map((pair) => pair.index), [5, 19]);
  assert.equal(pairs[0].question, twentyOneQuestions[5]);
  assert.equal(pairs[0].answer, 'a kettle and one lamp');
  assert.equal(pairs[1].question, twentyOneQuestions[19]);
});

test('the export splits into several readable 4:5 cards in question order', () => {
  const everything = twentyOneQuestions.map((_, index) => `answer ${index + 1}`);
  const pairs = twentyOnePairs(everything);
  const cards = splitTwentyOneCards(pairs);
  assert.deepEqual(cards.map((card) => card.length), [6, 6, 6, 3], 'twenty-one answers become several cards');
  assert.deepEqual(cards.flat().map((pair) => pair.index), Array.from({ length: 21 }, (_, index) => index));
  assert.deepEqual(splitTwentyOneCards(twentyOnePairs(setTwentyOneAnswer(twentyOneStart(), 0, 'one'))).map((card) => card.length), [1]);
  assert.deepEqual(splitTwentyOneCards([]), [], 'nothing answered means no cards');
  assert.deepEqual(splitTwentyOneCards(pairs.slice(0, 7)).map((card) => card.length), [6, 1]);
  assert.deepEqual(splitTwentyOneCards(pairs.slice(0, 5), 0).map((card) => card.length), [5], 'an invalid size falls back to the authored split');
});

test('the browser keeps twenty-one answers local: no link, no stored draft', () => {
  // Mirrors the two boundaries in src/browser/share-experiences.ts: the
  // controller never allows a result link, and a crafted hash never restores.
  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /linksAllowed: \(\) => false/);
  assert.match(controller, /game === "twenty-one-questions"\s*\?\s*\{ snapshot: null[^}]*invalid: false \}\s*:\s*sharedResult\(game\)/);
  assert.doesNotMatch(controller, /draftKey\("twenty-one-questions"\)/, 'no draft storage exists for private answers');
});

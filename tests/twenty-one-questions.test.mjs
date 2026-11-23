import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiences, twentyOneQuestions,
  twentyOneResultTitle,
} from '../src/lib/share-experiences.ts';
import { resultSizes } from '../src/browser/share-experience-image.ts';
import {
  moveTwentyOne, readTwentyOnePrompts, setTwentyOneAnswer, skipTwentyOne, splitTwentyOneCards,
  twentyOneAnswerLimit, twentyOneAnswered, twentyOneBlankPath, twentyOneCount, twentyOnePairs,
  twentyOneProgress, twentyOnePromptLimit, twentyOneStart, twentyOneSquareCardSize,
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
  assert.equal(twentyOneSquareCardSize, 4, 'Square keeps fewer pairs per card');
  assert.deepEqual(splitTwentyOneCards(pairs, twentyOneSquareCardSize).map((card) => card.length), [4, 4, 4, 4, 4, 1]);
  assert.deepEqual(
    splitTwentyOneCards(pairs, twentyOneSquareCardSize).flat().map((pair) => pair.index),
    Array.from({ length: 21 }, (_, index) => index),
    'Square cards keep the same ordered pairs',
  );
});

test('the browser keeps twenty-one answers local: no link, no stored draft', () => {
  // Mirrors the two boundaries in src/browser/share-experiences.ts: the
  // controller never allows a result link, and a crafted hash never restores.
  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /linksAllowed: \(\) => false/);
  assert.match(controller, /game === "twenty-one-questions" \|\| game === "developer-type" \|\| game === "language-type" \|\| game === "tier-list" \|\| game === "one-must-go"\s*\?\s*\{ snapshot: null[^}]*invalid: false \}\s*:\s*sharedResult\(game\)/);
  assert.doesNotMatch(controller, /draftKey\("twenty-one-questions"\)/, 'no draft storage exists for private answers');
});

test('the built-in invite is the bare canonical route, with no answers or result', () => {
  assert.equal(twentyOneBlankPath, '/share/experiences/twenty-one-questions');
  const url = new URL(twentyOneBlankPath, 'https://composer.example');
  assert.equal(url.origin, 'https://composer.example', 'the invite is same-origin');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  for (const word of ['result', 'answer', 'byline', 'question=', 'draft', 'skin', 'game', 'custom']) {
    assert.equal(url.href.toLowerCase().includes(word), false, `no ${word} travels with the invite`);
  }

  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /new URL\(twentyOneBlankPath, location\.origin\)\.href/);
  assert.match(controller, /if \(view !== "summary"\) return;/, 'only the summary offers the invite');
  assert.match(controller, /blankManual\.focus\(\);\s*blankManual\.select\(\);/, 'denied clipboard selects the readonly fallback');
  assert.match(controller, /Your edited questions and answers stay in this tab/, 'an authored set is called out in the status');
  assert.match(controller, /linksAllowed: \(\) => false/, 'private results still have no result link');

  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const block = markup.match(/<div class="tot-blank" data-tq-blank>([\s\S]*?)<\/div>/);
  assert.ok(block, 'one invite block inside the summary');
  assert.equal([...block[1].matchAll(/data-tq-blank-copy/g)].length, 1, 'one labelled action');
  assert.match(block[1], /Copy built-in starter link<\/button>/);
  assert.match(block[1], /readonly aria-label="Built-in starter link" data-tq-blank-manual/);
  assert.match(block[1], /role="status" data-tq-blank-status/);
});

test('private cards offer portrait, Story and Square, with portrait first', () => {
  assert.deepEqual(resultSizes.portrait, [1080, 1350]);
  assert.deepEqual(resultSizes.story, [1080, 1920]);
  assert.deepEqual(resultSizes.square, [1080, 1080]);
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const block = markup.match(/\(isTwentyOne \|\| isCloudflare \|\| isLanguage\) \? <label>Format<select data-format>([\s\S]*?)<\/select><\/label>/);
  assert.ok(block);
  assert.deepEqual([...block[1].matchAll(/<option value="([^"]+)">/g)].map(match => match[1]), ['portrait', 'story', 'square']);
});

test('private card downloads keep portrait and Story names and add Square', () => {
  const controller = read('src/browser/share-experiences.ts');
  assert.ok(controller.includes('const cardFormat = size === "story" || size === "square" ? size : "portrait";'));
  assert.ok(controller.includes('const prefix = cardFormat === "portrait" ? "" : `${cardFormat}-`;'));
  assert.ok(controller.includes('link.download = `${game}-${prefix}card-${index + 1}-of-${cards.length}.png`;'));
});

test('preview and download use the same local card URL', () => {
  const controller = read('src/browser/share-experiences.ts');
  const cards = controller.match(/cards\.forEach\(\(blob, index\) => \{([\s\S]*?)\n        \}\);/);
  assert.ok(cards);
  assert.match(cards[1], /const href = URL\.createObjectURL\(blob\);/);
  assert.match(cards[1], /preview\.src = href;/);
  assert.match(cards[1], /link\.href = href;/);
  assert.match(cards[1], /cardUrls\.push\(href\);/);
});

test('production permits local images on the three quiz card or photo routes only', () => {
  const middleware = read('src/middleware.ts');
  const block = middleware.split('twenty-one-questions')[1]?.split('X-Content-Type-Options')[0];
  assert.ok(block);
  assert.match(block, /^\|this-or-that\|developer-type\|language-type\)\\\/\?\$/);
  assert.ok(block.includes(`csp.replace("img-src 'self'", "img-src 'self' blob:")`));
  assert.doesNotMatch(block, /connect-src|frame-src|script-src/);
});

test('an authored set is exactly 21 bounded, nonempty, distinct cleaned prompts', () => {
  const spaced = twentyOneQuestions.map((question) => `  ${question.replaceAll(' ', '  ')}  `);
  const readPrompts = readTwentyOnePrompts(spaced);
  assert.deepEqual(readPrompts.prompts, [...twentyOneQuestions]);
  assert.equal(readPrompts.gap, -1);
  assert.equal(readPrompts.reason, null);
  assert.equal(readPrompts.count, 21);
  // A closing newline is tolerated; any other blank line is a gap.
  assert.deepEqual(readTwentyOnePrompts([...twentyOneQuestions, '']).prompts, [...twentyOneQuestions]);
  assert.deepEqual(readTwentyOnePrompts([...twentyOneQuestions, '  ', '']).prompts, [...twentyOneQuestions]);

  const short = readTwentyOnePrompts(twentyOneQuestions.slice(0, 20));
  assert.equal(short.prompts, null);
  assert.equal(short.reason, 'count');
  assert.equal(short.count, 20);

  const blank = [...twentyOneQuestions];
  blank[4] = '   ';
  const empty = readTwentyOnePrompts(blank);
  assert.equal(empty.prompts, null);
  assert.equal(empty.reason, 'empty');
  assert.equal(empty.gap, 4);

  const repeated = [...twentyOneQuestions];
  repeated[9] = repeated[8];
  const duplicate = readTwentyOnePrompts(repeated);
  assert.equal(duplicate.prompts, null);
  assert.equal(duplicate.reason, 'duplicate');
  assert.equal(duplicate.gap, 9);

  const long = [...twentyOneQuestions];
  long[0] = 'x'.repeat(twentyOnePromptLimit + 1);
  const over = readTwentyOnePrompts(long);
  assert.equal(over.prompts, null);
  assert.equal(over.reason, 'long');
  assert.equal(over.gap, 0);
  assert.equal(twentyOnePromptLimit, 72);

  const atLimit = [...twentyOneQuestions];
  atLimit[0] = 'y'.repeat(twentyOnePromptLimit);
  assert.equal(readTwentyOnePrompts(atLimit).prompts[0].length, 72);
});

test('duplicate prompts are recognised across case and Unicode spelling', () => {
  const prompts = [...twentyOneQuestions];
  prompts[0] = "How do you take your café?";
  prompts[1] = "HOW DO YOU TAKE YOUR CAFE\u0301?";
  const read = readTwentyOnePrompts(prompts);
  assert.equal(read.reason, 'duplicate');
  assert.equal(read.gap, 1);
});

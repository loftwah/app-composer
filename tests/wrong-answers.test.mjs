import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiencePath, experiences,
} from '../src/lib/share-experiences.ts';
import {
  wrongAnswerCount, wrongAnswerLimit, wrongAnswerPlate, wrongAnswerPrintTitle,
  wrongAnswerPrompts, wrongAnswerStart,
} from '../src/lib/wrong-answers.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// #1074 wrong-answers slice: ten authored questions, one bounded answer field,
// per-question drafts held only in this tab, and one deliberate PNG download.
// The signed-out phone/desktop journey is checked in a browser; these tests
// cover the prompt set, the exact printed plate and the privacy wiring.

test('the registry entry reuses the owned textbook cover without a new asset', () => {
  const experience = experiences['wrong-answers'];
  assert.equal(experience.title, 'Wrong Answers Only');
  assert.equal(experience.slug, 'wrong-answers');
  assert.equal(experience.theme, 'textbook');
  assert.match(experience.description, /ten workshop questions/i);
  assert.match(experience.description, /stay in this tab/i);
  assert.doesNotMatch(experience.description, /vote|ranking|leaderboard|public result|score/i);
  assert.equal(experiencePath('wrong-answers'), '/share/experiences/wrong-answers');
  for (const path of [experienceArt('wrong-answers'), experienceOg('wrong-answers')]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} exists`);
  }
  assert.equal(
    experienceOg('wrong-answers'), experienceArt('wrong-answers'),
    'the 1200 × 630 poster is its own social card',
  );
  const webp = experienceArt('wrong-answers').replace('.jpg', '-480.webp');
  assert.ok(existsSync(new URL(`../public${webp}`, import.meta.url)), 'the 480w stage art exists');
});

test('ten brief original questions open with the poster question', () => {
  assert.equal(wrongAnswerCount, 10);
  assert.equal(wrongAnswerPrompts.length, wrongAnswerCount);
  assert.equal(wrongAnswerPrompts[0].question, 'What happens inside a database?');
  assert.equal(wrongAnswerPrompts[0].tab, 'Database');
  const questions = wrongAnswerPrompts.map((prompt) => prompt.question);
  const tabs = wrongAnswerPrompts.map((prompt) => prompt.tab);
  assert.equal(new Set(questions).size, wrongAnswerCount, 'every question is distinct');
  assert.equal(new Set(tabs).size, wrongAnswerCount, 'every index tab is distinct');
  for (const prompt of wrongAnswerPrompts) {
    assert.match(prompt.question, /\?$/);
    assert.ok(prompt.question.length > 12 && prompt.question.length <= 80);
    assert.match(prompt.tab, /\S/);
    assert.ok(prompt.tab.length <= 20);
    assert.doesNotMatch(prompt.question, /model|provider|algorithm|ranking/i);
  }
});

test('every question starts with an empty answer and no stored value', () => {
  const start = wrongAnswerStart();
  assert.equal(start.length, wrongAnswerCount);
  assert.ok(start.every((answer) => answer === ''));
  const source = read('src/lib/wrong-answers.ts');
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest']) {
    assert.equal(source.includes(forbidden), false, `the sheet does not use ${forbidden}`);
  }
});

test('the printed plate keeps the exact cleaned prompt and answer', () => {
  assert.equal(wrongAnswerPrintTitle, 'Wrong answers only');
  const plate = wrongAnswerPlate('  What happens inside a database?  ', '  The chairs are put away by hand.\n');
  assert.deepEqual(plate, {
    prompt: 'What happens inside a database?',
    answer: 'The chairs are put away by hand.',
    number: 1,
    tab: 'Database',
  });
  assert.equal(wrongAnswerPlate('What happens inside a database?', '  \n  '), null);
  assert.equal(wrongAnswerPlate('  ', 'An answer'), null);
  assert.equal(wrongAnswerPlate('What happens inside a database?', ''), null, 'an empty answer never prints');
});

test('the answer is bounded and preserves every word', () => {
  const long = wrongAnswerPlate('Where do deleted files go?', `  ${'x'.repeat(wrongAnswerLimit + 40)}  `);
  assert.equal(long.answer.length, wrongAnswerLimit);
  assert.equal(long.number, 2);
  assert.equal(long.tab, 'Deleted files');
  const spaced = wrongAnswerPlate('Where do deleted files go?', '  A  small\ncommittee   files them  ');
  assert.equal(spaced.answer, 'A small committee files them');
  const other = wrongAnswerPlate('A question I wrote myself?', 'Because the kettle said so.');
  assert.equal(other.prompt, 'A question I wrote myself?');
  assert.equal(other.answer, 'Because the kettle said so.');
  assert.equal(other.number, 0, 'an unknown prompt prints without a false question number');
  assert.equal(other.tab, '');
});

test('the browser controller keeps every draft in this tab and never builds a link', () => {
  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /game === "wrong-answers" \? mountWrongAnswers/);
  assert.match(controller, /game === "one-must-go" \|\| game === "wrong-answers"/);
  assert.match(controller, /game !== "wrong-answers"/);
  assert.match(controller, /Write a wrong answer to download your plate\./);
  assert.match(controller, /title: wrongAnswerPrintTitle, prompt: plate\.prompt, answer: plate\.answer/);
  assert.match(controller, /prompt\?: string;/);
  assert.match(controller, /answer\?: string;/);

  const start = controller.indexOf('function mountWrongAnswers');
  const end = controller.indexOf('function mountBingo', start);
  assert.ok(start > 0 && end > start);
  const block = controller.slice(start, end);
  assert.match(block, /const refresh = \(\) => \{ if \(ready\) update\(\); \};/);
  assert.match(block, /let ready = false;/);
  assert.match(block, /ready = true;/);
  assert.match(block, /linksAllowed: \(\) => false/);
  // The generic outer update is readable only after the controller exists.
  const withoutRefresh = block.replace('const refresh = () => { if (ready) update(); };', '');
  assert.doesNotMatch(withoutRefresh, /^\s*update\(\)/m, "no unguarded generic update runs while mounting");
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'resultLink', 'draftKey', 'sendBeacon']) {
    assert.equal(block.includes(forbidden), false, `the sheet does not use ${forbidden}`);
  }
});

test('the stage starts every JS-only control disabled until the sheet mounts', () => {
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const start = markup.indexOf('class="wa-stage"');
  const block = markup.slice(start, markup.indexOf('{isThis &&', start));
  assert.ok(start > 0 && block.length > 0, 'the wrong-answer stage exists');
  assert.match(block, /data-wa-question/);
  assert.match(block, /aria-pressed=\{index === 0 \? "true" : "false"\} disabled>/);
  assert.match(block, /aria-controls="wa-question"/);
  assert.match(block, /data-wa-answer disabled/);
  assert.match(block, /data-wa-back disabled/);
  assert.match(block, /data-wa-next disabled/);
  assert.match(block, /data-wa-clear disabled/);
  assert.match(block, /maxlength=\{wrongAnswerLimit\}/);
  assert.match(block, /aria-describedby="wa-local wa-count"/);
  assert.match(block, /wrongAnswerCount/);
  assert.match(block, /stay in this tab/i);
  assert.doesNotMatch(block, /localStorage|sessionStorage|result link/i);
  assert.match(markup, /isWrong \? \["Saffron page", "Faded copy", "Night school"\]/);
  assert.match(markup, /The PNG includes the selected question, your answer and any byline/);
  assert.match(markup, /Your drafts stay in this tab\. Download a PNG to keep your answer/);
  assert.match(markup, /data-download disabled=\{isDoor[^}]*isWrong/);
  assert.match(markup, /data-copy hidden=\{isTwentyOne[^}]*isWrong/);
});

test('the shared PNG draws the question and answer on the owned textbook page', () => {
  const image = read('src/browser/share-experience-image.ts');
  assert.match(image, /"wrong-answers": \[\["#efe0bd", "#3a2412", "#8a4a08"\]/);
  assert.match(image, /result\.game === "wrong-answers"\) return renderWrongAnswers/);
  assert.match(image, /const plate = wrongAnswerPlate\(result\.prompt, result\.answer\)/);
  assert.match(image, /drawPlateCentred\(ctx, plate\.prompt/);
  assert.match(image, /drawPlateText\(\s*ctx, plate\.answer/);
  assert.match(image, /drawWrongStamp/);
  assert.match(image, /signCard\(ctx, mark, width, margin, footer, ink, result\.byline\)/);
  assert.match(image, /prompt\?: string;/);
  assert.match(image, /answer\?: string;/);
});

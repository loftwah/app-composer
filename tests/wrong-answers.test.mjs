import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiencePath, experiences,
} from '../src/lib/share-experiences.ts';
import {
  readWrongAnswerDraftFile, wrongAnswerCount, wrongAnswerDraftFileLimit, wrongAnswerDraftFileName,
  wrongAnswerDraftFileSchema, wrongAnswerLimit, wrongAnswerPlate, wrongAnswerPrintTitle,
  wrongAnswerPrompts, wrongAnswerStart, writeWrongAnswerDraftFile,
} from '../src/lib/wrong-answers.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// #1074 wrong-answers slice: ten authored questions, one bounded answer field,
// per-question drafts plus an explicit local JSON download, and one deliberate
// PNG download. The signed-out phone/desktop journey is checked in a browser;
// these tests cover the draft contract, printed plate and privacy wiring.

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

test('v1 answers drafts round-trip all ten raw rows and the selected prompt', () => {
  const answers = Array.from({ length: wrongAnswerCount }, (_, index) =>
    `  Answer ${index + 1}\nsecond line\t🙂  `);
  answers[3] = '';
  answers[6] = ' \n\t';
  answers[9] = '🙂'.repeat(wrongAnswerLimit / 2);

  for (const prompt of [0, 9]) {
    const text = writeWrongAnswerDraftFile(answers, prompt);
    assert.equal(typeof text, 'string');
    assert.equal(writeWrongAnswerDraftFile(answers, prompt), text, 'the same draft always writes the same bytes');
    assert.ok(Buffer.byteLength(text, 'utf8') <= wrongAnswerDraftFileLimit);
    assert.equal(wrongAnswerDraftFileLimit, 16 * 1024);
    assert.equal(wrongAnswerDraftFileSchema, 'composer.wrong-answers-draft/1');
    assert.equal(wrongAnswerDraftFileName, 'wrong-answers-draft.json');

    const file = JSON.parse(text);
    assert.deepEqual(Object.keys(file), ['schema', 'answers', 'prompt']);
    assert.deepEqual(file.answers, answers, 'newlines, Unicode, whitespace and blank rows stay raw');
    assert.equal(file.prompt, prompt, 'the selected prompt is 0-based');
    assert.deepEqual(readWrongAnswerDraftFile(text), {
      draft: { answers, prompt }, fault: null, gap: -1,
    });
  }

  const blank = wrongAnswerStart();
  assert.deepEqual(readWrongAnswerDraftFile(writeWrongAnswerDraftFile(blank, 0)).draft,
    { answers: blank, prompt: 0 }, 'an entirely blank unfinished draft is saveable');
  assert.equal(wrongAnswerPlate(wrongAnswerPrompts[0].question, answers[0]).answer,
    'Answer 1 second line 🙂', 'only the printed plate cleans the raw draft text');

  const widest = Array.from({ length: wrongAnswerCount }, () => '\u0000'.repeat(wrongAnswerLimit));
  const text = writeWrongAnswerDraftFile(widest, 9);
  assert.ok(text, 'the widest escaped answer set still fits');
  assert.ok(Buffer.byteLength(text, 'utf8') <= wrongAnswerDraftFileLimit);
  assert.deepEqual(readWrongAnswerDraftFile(text).draft, { answers: widest, prompt: 9 });
});

test('malformed, oversized, foreign, wrong-shape and overlong answer drafts return no replacement', () => {
  const valid = JSON.parse(writeWrongAnswerDraftFile(wrongAnswerStart(), 0));
  const check = (value) => readWrongAnswerDraftFile(typeof value === 'string' ? value : JSON.stringify(value));
  const withAnswer = (index, answer) => {
    const answers = [...valid.answers];
    answers[index] = answer;
    return { ...valid, answers };
  };

  for (const value of [null, undefined, 5, {}, [], 'not json']) {
    assert.equal(check(value).draft, null);
  }
  assert.equal(check('not json').fault, 'unreadable');
  assert.equal(check([]).fault, 'unreadable');
  assert.equal(check({}).fault, 'schema');
  assert.equal(check({ ...valid, schema: 'composer.wrong-answers-draft/2' }).fault, 'version');
  assert.equal(check({ ...valid, schema: 'composer.this-or-that-draft/1' }).fault, 'schema');
  assert.equal(check({ ...valid, answers: valid.answers.slice(0, 9) }).fault, 'shape');
  assert.equal(check({ ...valid, answers: [...valid.answers, ''] }).fault, 'shape');
  assert.deepEqual({ fault: check(withAnswer(7, 3)).fault, gap: check(withAnswer(7, 3)).gap },
    { fault: 'shape', gap: 7 });
  assert.deepEqual({ fault: check(withAnswer(8, 'x'.repeat(wrongAnswerLimit + 1))).fault,
    gap: check(withAnswer(8, 'x'.repeat(wrongAnswerLimit + 1))).gap },
  { fault: 'long', gap: 8 });
  for (const prompt of [-1, 10, 1.5, '0', null, true]) {
    assert.equal(check({ ...valid, prompt }).fault, 'prompt');
  }
  for (const field of ['result', 'byline', 'picks', 'photos', 'url', 'storage', 'request']) {
    assert.equal(check({ ...valid, [field]: [] }).fault, 'shape', `${field} is not part of the owned schema`);
  }

  assert.equal(writeWrongAnswerDraftFile(valid.answers.slice(0, 9), 0), null);
  assert.equal(writeWrongAnswerDraftFile([...valid.answers, ''], 0), null);
  assert.equal(writeWrongAnswerDraftFile(withAnswer(0, 3).answers, 0), null);
  assert.equal(writeWrongAnswerDraftFile(withAnswer(0, 'x'.repeat(wrongAnswerLimit + 1)).answers, 0), null);
  for (const prompt of [-1, 10, 1.5]) assert.equal(writeWrongAnswerDraftFile(valid.answers, prompt), null);

  // Bytes, not characters, are bounded before JSON.parse.
  assert.equal(check('é'.repeat(wrongAnswerDraftFileLimit / 2 + 1)).fault, 'oversized');
  assert.equal(check('x'.repeat(wrongAnswerDraftFileLimit + 1)).fault, 'oversized');
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

  assert.match(block, /const attempt = \+\+draftFileAttempt;/);
  assert.match(block, /const revision = draftRevision;/);
  assert.match(block, /function show\([\s\S]*?draftRevision \+= 1;/);
  assert.match(block, /answer\.addEventListener\("input"[\s\S]*?draftRevision \+= 1;/);
  assert.match(block, /draftFileSave\.disabled = false;/);
  assert.match(block, /draftFileInput\.disabled = false;/);
  const handlersStart = block.indexOf('function draftFileProblem');
  const handlersEnd = block.indexOf('draftFileSave.addEventListener', handlersStart);
  assert.ok(handlersStart > 0 && handlersEnd > handlersStart);
  const handlers = block.slice(handlersStart, handlersEnd);
  const sizeGuard = handlers.indexOf('file.size > wrongAnswerDraftFileLimit');
  const fileRead = handlers.indexOf('await file.arrayBuffer()');
  assert.ok(sizeGuard >= 0 && sizeGuard < fileRead, 'the 16 KiB bound is checked before any read');
  assert.ok(handlers.indexOf('readWrongAnswerDraftFile(text)') < handlers.indexOf('window.confirm'),
    'the whole file validates before confirmation or replacement');
  assert.match(handlers, /answers\.some\(\(text\) => text !== ""\) && !window\.confirm\(/);
  assert.match(handlers, /if \(attempt !== draftFileAttempt\) return;/);
  assert.match(handlers, /if \(revision !== draftRevision\)/);
  assert.match(handlers, /answers\.splice\(0, answers\.length, \.\.\.draft\.answers\);/);
  assert.match(handlers, /current = draft\.prompt;[\s\S]*?sync\(\);\s*refresh\(\);/,
    'opening restores the selected prompt through the existing render and export update');
  assert.match(handlers, /writeWrongAnswerDraftFile\(draftAnswers, current\)/);
  assert.match(handlers, /link\.download = wrongAnswerDraftFileName;/);
  assert.match(handlers, /URL\.revokeObjectURL\(url\)/);
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'sendBeacon', 'upload']) {
    assert.equal(handlers.includes(forbidden), false, `the draft file never touches ${forbidden}`);
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
  assert.match(block, /data-wa-draft-file-save disabled>Download answers draft/);
  assert.match(block, /accept="application\/json,\.json" data-wa-draft-file/);
  assert.match(block, /aria-describedby="wa-draft-file-note" disabled/);
  assert.match(block, /role="status" data-wa-draft-file-status/);
  assert.match(block, /wrongAnswerDraftFileName\} contains all ten answers and the selected question/);
  assert.match(block, /Opening it replaces your current answers/);
  assert.match(block, /maxlength=\{wrongAnswerLimit\}/);
  assert.match(block, /aria-describedby="wa-local wa-count"/);
  assert.match(block, /wrongAnswerCount/);
  assert.match(block, /stay in this tab/i);
  assert.doesNotMatch(block, /localStorage|sessionStorage|result link/i);
  assert.match(markup, /isWrong \? \["Saffron page", "Faded copy", "Night school"\]/);
  assert.match(markup, /The PNG includes the selected question, your answer and any byline/);
  assert.match(markup, /Your answers stay in this tab\. Download an answers draft to keep all ten, or a PNG to keep the selected answer/);
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

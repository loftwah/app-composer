import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { twentyOneQuestions } from '../src/lib/share-experiences.ts';
import {
  readTwentyOnePromptFile, readTwentyOnePrompts, twentyOneCount, twentyOnePromptFileLimit,
  twentyOnePromptFileName, twentyOnePromptFileSchema, twentyOnePromptLimit, writeTwentyOnePromptFile,
} from '../src/lib/twenty-one-questions.ts';

// #1064 one explicit, bounded, answer-free prompt file. A written set fills a
// fresh tab's editor; it never starts a run, carries an answer or becomes a
// link. The played journey and the native file controls are checked in a
// browser by the parent release.

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const prompts = () => [...twentyOneQuestions];

test('a valid authored set round-trips through one bounded prompt-only file', () => {
  const read = readTwentyOnePrompts(prompts());
  assert.ok(read.prompts, 'the starter is a valid editor set');
  const text = writeTwentyOnePromptFile(read.prompts);
  assert.equal(typeof text, 'string');
  assert.equal(writeTwentyOnePromptFile(read.prompts), text, 'the same prompts always write the same bytes');
  assert.ok(Buffer.byteLength(text, 'utf8') <= twentyOnePromptFileLimit, 'the file obeys its own bound');

  const file = JSON.parse(text);
  assert.deepEqual(Object.keys(file), ['schema', 'prompts'], 'exactly the schema and the 21 texts');
  assert.equal(file.schema, twentyOnePromptFileSchema);
  assert.equal(twentyOnePromptFileSchema, 'composer.twenty-one-prompts/1');
  assert.equal(twentyOnePromptFileName, 'composer-21-questions-prompts.json');
  assert.equal(file.prompts.length, twentyOneCount);
  for (const word of ['answer', 'result', 'byline', 'link', 'draft', 'url', 'skin']) {
    assert.equal(Object.keys(file).some((key) => key.toLowerCase().includes(word)), false,
      `no ${word} field travels in the file`);
  }

  const opened = readTwentyOnePromptFile(text);
  assert.equal(opened.fault, null);
  assert.deepEqual(opened.prompts, [...twentyOneQuestions], 'a fresh tab gets the exact cleaned prompts');
  // The file's texts are accepted by the very validator Apply uses.
  assert.deepEqual(readTwentyOnePrompts(opened.prompts).prompts, opened.prompts);
});

test('the widest editor set still fits the file byte bound', () => {
  const widest = prompts().map((_, index) => 'é'.repeat(twentyOnePromptLimit - 2) + String(index).padStart(2, '0'));
  const read = readTwentyOnePrompts(widest);
  assert.ok(read.prompts, 'the cleaned set is still valid');
  const text = writeTwentyOnePromptFile(read.prompts);
  assert.ok(Buffer.byteLength(text, 'utf8') <= twentyOnePromptFileLimit,
    'multi-byte prompts at the per-line cap still fit one file');
  assert.deepEqual(readTwentyOnePromptFile(text).prompts, read.prompts);
});

test('malformed, oversized, wrong count/version and answer-bearing files are refused', () => {
  const valid = JSON.parse(writeTwentyOnePromptFile(prompts()));
  const check = (value) => readTwentyOnePromptFile(typeof value === 'string' ? value : JSON.stringify(value));

  assert.equal(check('not json').fault, 'unreadable');
  assert.equal(check(null).fault, 'unreadable');
  assert.equal(check('[]').fault, 'unreadable');
  assert.equal(check({}).fault, 'schema');
  assert.equal(check({ ...valid, schema: 'composer.twenty-one-prompts/2' }).fault, 'version');
  assert.equal(check({ ...valid, schema: 'composer.persona-quiz-draft/1' }).fault, 'schema');
  assert.equal(check({ ...valid, extra: 'x' }).fault, 'shape');
  assert.equal(check({ ...valid, answers: ['private', 'data'] }).fault, 'shape');
  assert.equal(check({ ...valid, participants: [{ name: 'Ada' }] }).fault, 'shape');
  assert.equal(check({ ...valid, prompts: undefined }).fault, 'shape');
  assert.equal(check({ ...valid, prompts: [1, ...valid.prompts.slice(1)] }).fault, 'shape');
  assert.equal(check({ ...valid, prompts: valid.prompts.slice(0, 20) }).fault, 'count');
  assert.equal(check({ ...valid, prompts: [...valid.prompts, 'extra'] }).fault, 'count');
  assert.equal(check({ ...valid, prompts: [...valid.prompts, ''] }).fault, 'count');
  const blank = [...valid.prompts];
  blank[3] = '  ';
  assert.equal(check({ ...valid, prompts: blank }).fault, 'empty');
  const long = [...valid.prompts];
  long[0] = 'x'.repeat(twentyOnePromptLimit + 1);
  assert.equal(check({ ...valid, prompts: long }).fault, 'long');
  const repeated = [...valid.prompts];
  repeated[5] = repeated[4];
  assert.equal(check({ ...valid, prompts: repeated }).fault, 'duplicate');
  for (const value of [
    'not json', '{}', { ...valid, answers: [] }, { ...valid, prompts: [] },
    { ...valid, prompts: blank }, { ...valid, schema: 'composer.twenty-one-prompts/2' },
  ]) {
    assert.equal(check(value).prompts, null, 'every refusal hands back no prompts to fill the editor');
  }

  // Bytes, not characters, are bounded before the browser parses anything.
  assert.equal(check('é'.repeat(twentyOnePromptFileLimit / 2 + 1)).fault, 'oversized');
  assert.equal(check('x'.repeat(twentyOnePromptFileLimit + 1)).fault, 'oversized');
});

test('the prompt file controls are local, bounded and leave play untouched', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  assert.match(stage, /type="button" class="secondary" data-tq-prompts-file-save disabled>Save prompts JSON</);
  assert.match(stage, /accept="application\/json,\.json" data-tq-prompts-file/);
  assert.match(stage, /id="tq-prompts-file-note">The file holds only your 21 prompt texts and a version/);
  assert.match(stage, /role="status" data-tq-prompts-file-status/);
  assert.match(stage, /choose “Apply and start fresh” to use it/);

  const controller = source('src/browser/share-experiences.ts');
  const start = controller.indexOf('function mountTwentyQuestions');
  const end = controller.indexOf('function mountPersona', start);
  assert.ok(start > 0 && end > start, 'the twenty-one controller exists');
  const tq = controller.slice(start, end);
  assert.ok(tq.indexOf('file.size > twentyOnePromptFileLimit') < tq.indexOf('await file.text()'),
    'the byte bound is checked before any read');
  assert.match(tq, /const attempt = \+\+promptFileAttempt;/);
  assert.match(tq, /if \(attempt !== promptFileAttempt\) return;/);
  assert.match(tq, /const revision = promptRevision;/);
  assert.match(tq, /if \(revision !== promptRevision\)/);
  assert.match(tq, /promptRevision \+= 1;/);
  assert.match(tq, /customPrompts\.addEventListener\("input", \(\) => \{ promptRevision \+= 1; \}\);/);
  assert.match(tq, /writeTwentyOnePromptFile\(read\.prompts\)/);
  assert.match(tq, /if \(!readTwentyOnePromptFile\(text\)\.prompts\)/);
  assert.match(tq, /readTwentyOnePromptFile\(text\)/);
  assert.match(tq, /link\.download = twentyOnePromptFileName;/);
  assert.match(tq, /URL\.revokeObjectURL\(url\)/);
  assert.match(tq, /for \(const control of \[promptFileSave, promptFileInput\]\) control\.disabled = false;/);

  const handlersStart = tq.indexOf('function promptFileProblem');
  const handlersEnd = tq.indexOf('showQuestion(0, false);', handlersStart);
  assert.ok(handlersStart > 0 && handlersEnd > handlersStart, 'the file handlers exist');
  const handlers = tq.slice(handlersStart, handlersEnd);
  for (const forbidden of [
    'localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'upload',
    'history.', 'location.', 'activeQuestions =', 'answers =', 'linksAllowed',
  ]) {
    assert.equal(handlers.includes(forbidden), false, `the prompt file never touches ${forbidden}`);
  }
  // Opening fills the editor text alone; Apply remains the only run change.
  const openStart = handlers.indexOf('promptFileInput.addEventListener');
  const openEnd = handlers.indexOf('// Any typed edit after a file was chosen');
  assert.ok(openStart > 0 && openEnd > openStart, 'the open handler exists');
  const open = handlers.slice(openStart, openEnd);
  assert.match(open, /customPrompts\.value = read\.prompts\.join\("\\n"\);/);
  assert.doesNotMatch(open, /applyPrompts|twentyOneStart|showQuestion|customStatus/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  personaDraftOptionLimit, personaDraftPromptLimit, personaDraftTitleLimit,
  readPersonaDraft,
} from '../src/lib/persona-quiz.ts';
import {
  developerTypePersona, languageTypePersona, personaPacks,
} from '../src/lib/persona-packs.ts';
import {
  cloudflarePersonaIds, cloudflarePersonaPath, cloudflarePersonaResultPath,
} from '../src/lib/cloudflare-persona.ts';
import {
  languagePersonaIds, languagePersonaPath, languagePersonaResultPath,
} from '../src/lib/language-persona.ts';

// #1071/#1069/#1068 first editable remix: the two public persona quizzes keep
// one typed engine, one deterministic mapping per option position and one
// trusted outcome set. A local draft retexts the visible labels only. It never
// writes the address, result link, storage, clipboard or result card.

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const packs = [developerTypePersona, languageTypePersona];

function rowsFor(pack) {
  return pack.questions.map((question) => [
    question.prompt,
    ...question.options.map((option) => option.label),
  ]);
}

test('the draft limits are bounded and every starter field fits them', () => {
  assert.ok(personaDraftTitleLimit > 0 && personaDraftTitleLimit <= 60);
  assert.ok(personaDraftPromptLimit >= 69, 'the longest built-in prompt still fits');
  assert.ok(personaDraftOptionLimit >= 45, 'the longest built-in choice still fits');
  for (const pack of packs) {
    assert.ok(`My ${pack.stageLabel} remix`.length <= personaDraftTitleLimit,
      `${pack.game} has a distinct default draft title inside the limit`);
    for (const question of pack.questions) {
      assert.ok(question.prompt.length <= personaDraftPromptLimit);
      assert.equal(question.options.length, 4, 'the editor retexts exactly four choices');
      for (const option of question.options) {
        assert.ok(option.label.length <= personaDraftOptionLimit);
      }
    }
  }
});

test('the pack exposes each choice position with its trusted built-in mapping', () => {
  for (const pack of packs) {
    assert.equal(pack.questions.length, pack.questionCount);
    for (const question of pack.questions) {
      for (const option of question.options) {
        const primary = pack.outcome(option.primary.id);
        const secondary = pack.outcome(option.secondary.id);
        assert.ok(primary && secondary, 'both mapping IDs are real outcomes');
        assert.equal(option.primary.label, primary.subject);
        assert.equal(option.secondary.label, secondary.subject);
        assert.notEqual(option.primary.id, option.secondary.id);
      }
    }
  }
});

test('a complete draft reads back as cleaned, bounded visible text only', () => {
  for (const pack of packs) {
    const read = readPersonaDraft(`  My   ${pack.stageLabel}\n remix `, rowsFor(pack), pack.questionCount);
    assert.equal(read.gap, null);
    assert.ok(read.draft);
    assert.equal(read.draft.title, `My ${pack.stageLabel} remix`);
    assert.equal(read.draft.questions.length, pack.questionCount);
    assert.deepEqual(Object.keys(read.draft).sort(), ['questions', 'title']);
    read.draft.questions.forEach((question, index) => {
      assert.deepEqual(Object.keys(question).sort(), ['options', 'prompt']);
      assert.equal(question.options.length, 4);
      assert.equal(question.prompt, pack.questions[index].prompt);
      assert.deepEqual(
        [...question.options],
        pack.questions[index].options.map((option) => option.label),
        'untouched draft text keeps the starter’s exact option order',
      );
    });
  }
});

test('edited labels stay in their starter positions and never add outcome data', () => {
  const pack = developerTypePersona;
  const rows = rowsFor(pack);
  rows[2][0] = 'Your own situation';
  rows[2][1] = 'Your own first answer';
  rows[2][4] = 'Your own fourth answer';
  const read = readPersonaDraft('Small quiz', rows, pack.questionCount);
  assert.equal(read.gap, null);
  assert.equal(read.draft.questions[2].prompt, 'Your own situation');
  assert.equal(read.draft.questions[2].options[0], 'Your own first answer');
  assert.equal(read.draft.questions[2].options[3], 'Your own fourth answer');
  const text = JSON.stringify(read.draft);
  for (const forbidden of ['primary', 'secondary', 'score', 'outcome', 'href', 'result=']) {
    assert.ok(!text.includes(forbidden), `a draft carries no ${forbidden}`);
  }
});

test('missing, blank and duplicate fields stop the draft at the first honest gap', () => {
  const pack = languageTypePersona;
  const rows = rowsFor(pack);

  assert.deepEqual(readPersonaDraft('   ', rows, pack.questionCount),
    { draft: null, gap: { field: 'title', reason: 'empty' } });

  const noPrompt = rows.map((row) => [...row]);
  noPrompt[3][0] = ' \n ';
  assert.deepEqual(readPersonaDraft('Draft', noPrompt, pack.questionCount),
    { draft: null, gap: { field: 'prompt', question: 3, reason: 'empty' } });

  const noChoice = rows.map((row) => [...row]);
  noChoice[5][2] = '   ';
  assert.deepEqual(readPersonaDraft('Draft', noChoice, pack.questionCount),
    { draft: null, gap: { field: 'option', question: 5, option: 1, reason: 'empty' } });

  const repeated = rows.map((row) => [...row]);
  repeated[1][3] = repeated[1][1].toUpperCase();
  assert.deepEqual(readPersonaDraft('Draft', repeated, pack.questionCount),
    { draft: null, gap: { field: 'option', question: 1, option: 2, reason: 'duplicate' } });

  const short = rows.slice(0, 6);
  assert.deepEqual(readPersonaDraft('Draft', short, pack.questionCount),
    { draft: null, gap: { field: 'prompt', question: 6, reason: 'empty' } });
});

test('overlong visible text is sliced to the same bounds the inputs advertise', () => {
  const pack = developerTypePersona;
  const rows = rowsFor(pack);
  rows[0][0] = 'p'.repeat(personaDraftPromptLimit + 20);
  rows[0][1] = 'a'.repeat(personaDraftOptionLimit + 20);
  const read = readPersonaDraft('t'.repeat(personaDraftTitleLimit + 20), rows, pack.questionCount);
  assert.equal(read.gap, null);
  assert.equal(read.draft.title.length, personaDraftTitleLimit);
  assert.equal(read.draft.questions[0].prompt.length, personaDraftPromptLimit);
  assert.equal(read.draft.questions[0].options[0].length, personaDraftOptionLimit);
});

test('the editor and controls are present once for both packs, with explicit modes', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  assert.match(stage, /isCloudflare \? "Which Cloudflare® service are you\?" : isLanguage \? "Which programming language are you\?" : experience\.title/,
    'the published language headings stay unchanged');
  assert.match(stage, /\{persona && <section data-play-panel class="door-stage persona-stage"/);
  assert.match(stage, /data-persona-draft-title/);
  assert.match(stage, /data-persona-draft-prompt/);
  assert.match(stage, /data-persona-draft-option/);
  assert.match(stage, /Direct: \{option\.primary\.label\} · paired with \{option\.secondary\.label\}/,
    'every choice shows the built-in outcomes it keeps');
  assert.match(stage, /value=\{`My \$\{persona\.stageLabel\} remix`\}/);
  for (const control of ['data-persona-draft-play', 'data-persona-draft-edit', 'data-persona-draft-original']) {
    assert.ok(stage.includes(control), `${control} is an explicit control`);
  }
  assert.match(stage, /data-persona-draft-note hidden>Draft result\./);
  assert.match(stage, /class="persona-link" data-persona-link-panel/);
  assert.match(stage, /data-export-panel/);
});

test('a draft result has no link, hash, storage, network or published card', () => {
  const controller = source('src/browser/share-experiences.ts');
  const start = controller.indexOf('function mountPersona');
  const end = controller.indexOf('function mountBingo', start);
  assert.ok(start > 0 && end > start, 'the persona controller exists');
  const persona = controller.slice(start, end);
  for (const forbidden of [
    'localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'sendBeacon',
    'navigator.share', 'readNineDraft', 'writeNineDraft', 'draftKey',
  ]) {
    assert.ok(!persona.includes(forbidden), `a persona draft never uses ${forbidden}`);
  }
  assert.match(persona, /result: \(\) => \{\n\s+if \(!shown \|\| draft\) return null;/,
    'no generic result snapshot or card while a draft is on stage');
  assert.match(persona, /exportAllowed: \(\) => !draft/);
  assert.match(persona, /linksAllowed: \(\) => false/);
  assert.match(persona, /personaOutcome: \(\) => \(draft \? null : shown\)/);
  assert.match(persona, /if \(!shown \|\| draft\) return;\n\s+const href = new URL\(pack\.resultPath\(shown\)/,
    'the persona Copy result link is inert during a draft');
  assert.match(persona, /linkWrap\.hidden = remixActive/);
  assert.match(persona, /link\.value = remixActive \? "" : new URL\(pack\.resultPath\(id\)/,
    'a draft result never fills the result-link field');
  assert.match(persona, /if \(!draft\) replaceAddress\(pack\.path\)/,
    'a draft run never rewrites the address');
  assert.match(persona, /remix\.hidden = draft !== null;/, 'a draft question hides the editor');
  assert.match(persona, /remix\.hidden = shared \|\| remixActive;/,
    'a shared result stays read-only and cannot start a draft');
  assert.doesNotMatch(persona, /replaceAddress\([^)]*draft/, 'the address never carries draft data');
  assert.doesNotMatch(persona, /history\.(pushState|replaceState)\([^)]*draft/i);
});

test('the shared share bar hides its export while a draft is active', () => {
  const controller = source('src/browser/share-experiences.ts');
  assert.match(controller, /const exportable = controller\.exportAllowed\?\.\(\) \?\? true;/);
  assert.match(controller, /if \(exportPanel\) exportPanel\.hidden = !exportable;/);
  assert.match(controller, /download\.disabled = busy \|\| !canShare \|\| !exportable;/);
  assert.match(controller, /copy\.disabled = !links \|\| !canShare \|\| !exportable;/);
  assert.match(controller, /!snapshot \|\| busy \|\| controller\.exportAllowed\?\.\(\) === false/);
});

test('the original routes, answer-free links and card formats are untouched', () => {
  assert.equal(cloudflarePersonaPath, '/share/experiences/developer-type');
  assert.equal(languagePersonaPath, '/share/experiences/language-type');
  for (const id of cloudflarePersonaIds) {
    assert.equal(cloudflarePersonaResultPath(id), `/share/experiences/developer-type#result=${id}`);
  }
  for (const id of languagePersonaIds) {
    assert.equal(languagePersonaResultPath(id), `/share/experiences/language-type#result=${id}`);
  }
  assert.deepEqual(Object.keys(personaPacks), ['developer-type', 'language-type']);
  for (const pack of packs) {
    const id = pack.questions[0].options[0].primary.id;
    assert.equal(pack.resultPath(id), `${pack.path}#result=${id}`);
  }
});

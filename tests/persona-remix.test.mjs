import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  personaDraftFileLimit, personaDraftFileName, personaDraftFileSchema,
  personaDraftNamedFileSchema, personaDraftOptionLimit, personaDraftOutcomeLimit,
  personaDraftPromptLimit, personaDraftTitleLimit,
  readPersonaDraft, readPersonaDraftFile, writePersonaDraftFile,
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
  assert.ok(personaDraftOutcomeLimit > 0 && personaDraftOutcomeLimit <= 60,
    'the optional result name is a short visible-text field');
  for (const pack of packs) {
    assert.ok(`My ${pack.stageLabel} remix`.length <= personaDraftTitleLimit,
      `${pack.game} has a distinct default draft title inside the limit`);
    for (const outcome of pack.outcomes) {
      assert.ok(outcome.label.length <= personaDraftOutcomeLimit,
        'every original result name fits the editor field');
    }
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

test('a saved draft file carries only the exact pack, version and visible text', () => {
  for (const pack of packs) {
    const read = readPersonaDraft(`My ${pack.stageLabel} remix`, rowsFor(pack), pack.questionCount);
    assert.equal(read.gap, null);
    const text = writePersonaDraftFile(pack.game, read.draft);
    assert.ok(Buffer.byteLength(text, 'utf8') <= personaDraftFileLimit,
      'the exact bytes stay inside the advertised file bound');
    assert.equal(personaDraftFileName(pack.game), `composer-${pack.game}-draft.json`);
    const saved = JSON.parse(text);
    assert.deepEqual(Object.keys(saved), ['schema', 'game', 'title', 'questions']);
    assert.equal(saved.schema, personaDraftFileSchema);
    assert.equal(saved.game, pack.game);
    assert.equal(saved.title, read.draft.title);
    saved.questions.forEach((question, index) => {
      assert.deepEqual(Object.keys(question), ['prompt', 'options']);
      assert.equal(question.prompt, pack.questions[index].prompt);
      assert.deepEqual(question.options, pack.questions[index].options.map((option) => option.label));
    });
    for (const forbidden of ['http', 'workers-kv', 'result=']) {
      assert.ok(!text.toLowerCase().includes(forbidden), `a draft file carries no ${forbidden}`);
    }
    // Every key is one of the visible-text fields; no answer, outcome,
    // identity or link field exists anywhere in the file.
    const keys = new Set();
    const collect = (value) => {
      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) {
          keys.add(key);
          collect(entry);
        }
      }
    };
    collect(saved);
    assert.deepEqual([...keys].sort(), ['game', 'options', 'prompt', 'questions', 'schema', 'title']);
    const reopened = readPersonaDraftFile(pack.game, text, pack.questionCount);
    assert.equal(reopened.fault, null);
    assert.equal(reopened.gap, null);
    assert.deepEqual(reopened.draft, read.draft);
    assert.equal(writePersonaDraftFile(pack.game, reopened.draft), text,
      'the same draft always writes the exact portable bytes');
  }
});

test('every trusted outcome keeps its stable ID and original printed name', () => {
  for (const pack of packs) {
    assert.deepEqual(pack.ids, pack.outcomes.map((outcome) => outcome.id));
    assert.equal(pack.outcomes.length, 8, 'the editor exposes exactly the pack results');
    for (const outcome of pack.outcomes) {
      const original = pack.outcome(outcome.id);
      assert.ok(original, `${pack.game}/${outcome.id} still resolves`);
      assert.equal(outcome.label, original.archetype,
        'a blank name can always fall back to the published headline');
    }
  }
});

test('authored result names are trimmed, bounded and keep their trusted ID', () => {
  for (const pack of packs) {
    const rows = rowsFor(pack);
    const first = pack.ids[0];
    const second = pack.ids[1];
    const read = readPersonaDraft('Named draft', rows, pack.questionCount, [
      { id: first, label: `  My   ${first}  ` },
      { id: second, label: '   ' },
      ...pack.ids.slice(2).map((id) => ({ id, label: `  ${id}  ` })),
    ]);
    assert.equal(read.gap, null);
    assert.equal(read.draft.outcomes[first], `My ${first}`,
      'a typed name is cleaned visible text, not markup');
    assert.ok(!Object.hasOwn(read.draft.outcomes, second),
      'a blank field inherits and is not written');
    assert.equal(read.draft.outcomes[pack.ids[2]], pack.ids[2]);

    const overlong = 'n'.repeat(personaDraftOutcomeLimit + 20);
    const bounded = readPersonaDraft('Named draft', rows, pack.questionCount, {
      [first]: overlong,
    });
    assert.equal(bounded.draft.outcomes[first].length, personaDraftOutcomeLimit);

    const inherited = readPersonaDraft(
      'Named draft', rows, pack.questionCount,
      pack.ids.map((id) => ({ id, label: '   ' })),
    );
    assert.deepEqual(Object.keys(inherited.draft).sort(), ['questions', 'title'],
      'a draft with every name blank keeps the original text-only shape');
  }
});

test('a named draft uses the compatible V2 file while V1 keeps the old bytes', () => {
  const pack = languageTypePersona;
  const rows = rowsFor(pack);
  const first = pack.ids[0];
  const second = pack.ids[1];
  const named = readPersonaDraft('My named remix', rows, pack.questionCount, {
    [first]: 'Ruby, my way',
    [second]: 'Python, my way',
    [pack.ids[2]]: '   ',
  });
  const text = writePersonaDraftFile(pack.game, named.draft);
  const saved = JSON.parse(text);
  assert.equal(saved.schema, personaDraftNamedFileSchema);
  assert.deepEqual(Object.keys(saved), ['schema', 'game', 'title', 'outcomes', 'questions']);
  assert.deepEqual(saved.outcomes, { [first]: 'Ruby, my way', [second]: 'Python, my way' },
    'only authored names are written, keyed by the exact pack IDs');
  assert.ok(Buffer.byteLength(text, 'utf8') <= personaDraftFileLimit);
  const reopened = readPersonaDraftFile(pack.game, text, pack.questionCount, pack.ids);
  assert.equal(reopened.fault, null);
  assert.equal(reopened.gap, null);
  assert.deepEqual(reopened.draft, named.draft);
  assert.equal(writePersonaDraftFile(pack.game, reopened.draft), text);

  const textOnly = readPersonaDraft('Plain remix', rows, pack.questionCount);
  const v1 = writePersonaDraftFile(pack.game, textOnly.draft);
  assert.equal(JSON.parse(v1).schema, personaDraftFileSchema);
  assert.equal(v1, writePersonaDraftFile(pack.game, readPersonaDraftFile(
    pack.game, v1, pack.questionCount).draft),
  'an existing V1 file still reads and writes the same bytes');
});

test('a V2 file rejects an unknown outcome ID or malformed names unchanged', () => {
  const pack = developerTypePersona;
  const rows = rowsFor(pack);
  const named = readPersonaDraft('Named remix', rows, pack.questionCount, {
    [pack.ids[0]]: 'My result',
  });
  const saved = JSON.parse(writePersonaDraftFile(pack.game, named.draft));
  const check = (value) => readPersonaDraftFile(
    pack.game, typeof value === 'string' ? value : JSON.stringify(value), pack.questionCount, pack.ids);

  assert.equal(check({ ...saved, outcomes: { ...saved.outcomes, 'not-a-result': 'Nope' } }).fault,
    'outcome');
  assert.equal(check({ ...saved, outcomes: { [pack.ids[0]]: 7 } }).fault, 'shape');
  assert.equal(check({ ...saved, outcomes: [] }).fault, 'shape');
  assert.equal(check({ ...saved, outcomes: 'names' }).fault, 'shape');
  const missing = { ...saved };
  delete missing.outcomes;
  assert.equal(check(missing).fault, 'shape');
  assert.equal(check({ ...saved, schema: 'composer.persona-quiz-draft/3' }).fault, 'version');
});

test('the optional outcome-name disclosure and its safe result use are wired once', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  assert.match(stage, /data-persona-draft-names>/);
  assert.match(stage, /<summary>Rename results \(optional\)<\/summary>/);
  assert.match(stage, /data-persona-draft-outcome=\{outcome\.id\}/);
  assert.match(stage, /aria-describedby="persona-remix-names-note"/);
  assert.match(stage, /Leave a name blank to keep the original\./);

  const controller = source('src/browser/share-experiences.ts');
  const start = controller.indexOf('function mountPersona');
  const end = controller.indexOf('function mountBingo', start);
  const persona = controller.slice(start, end);
  assert.match(persona, /\[data-persona-draft-outcome\]/);
  assert.match(persona, /const draftOutcomeIds = pack\.ids;/);
  assert.match(persona, /readPersonaDraft\(draftTitle\.value, editorRows\(\), pack\.questions\.length, editorOutcomes\(\)\)/);
  assert.match(persona, /archetype\.textContent = draft\?\.outcomes\?\.\[id\] \|\| outcome\.archetype;/,
    'only the private draft result line takes the authored name');
  assert.match(persona, /service\.textContent = outcome\.subject;/);
  assert.match(persona, /docs\.href = outcome\.href;/);
  assert.match(persona, /docs\.textContent = outcome\.docsText;/);
  assert.match(persona, /personaOutcome: \(\) => \(draft \? null : shown\)/);
  assert.match(persona, /if \(!shown \|\| draft\) return;\n\s+const href = new URL\(pack\.resultPath\(shown\)/);
});

test('a foreign, unknown, wrong-pack or malformed file leaves the editor usable', () => {
  const pack = developerTypePersona;
  const read = readPersonaDraft('Draft', rowsFor(pack), pack.questionCount);
  const saved = JSON.parse(writePersonaDraftFile(pack.game, read.draft));
  const check = (value, game = pack.game) => readPersonaDraftFile(
    game, typeof value === 'string' ? value : JSON.stringify(value), pack.questionCount);

  assert.equal(check('{').fault, 'unreadable');
  assert.equal(check('[]').fault, 'unreadable');
  assert.equal(check({ ...saved, schema: 'composer.other/1' }).fault, 'schema');
  assert.equal(check({ ...saved, schema: 'composer.persona-quiz-draft/3' }).fault, 'version');
  assert.equal(check(saved, languageTypePersona.game).fault, 'pack');
  assert.equal(check({ ...saved, answers: [1, 2] }).fault, 'shape');
  assert.equal(check({ ...saved, questions: saved.questions.slice(1) }).fault, 'shape');
  assert.equal(check({
    ...saved,
    questions: [{ ...saved.questions[0], options: ['a', 'b', 'c'] }, ...saved.questions.slice(1)],
  }).fault, 'shape');
  assert.equal(check({ ...saved, title: '   ' }).fault, 'text');

  const repeated = JSON.parse(JSON.stringify(saved));
  repeated.questions[1].options[1] = repeated.questions[1].options[0];
  const duplicate = check(repeated);
  assert.equal(duplicate.fault, 'text');
  assert.equal(duplicate.gap.reason, 'duplicate');

  assert.equal(check('x'.repeat(personaDraftFileLimit + 1)).fault, 'oversized');
  assert.equal(readPersonaDraftFile(pack.game, null, pack.questionCount).fault, 'unreadable');
});

test('the remix file controls are local, explicit and leave Play draft as the only start', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  assert.match(stage, /type="submit" data-persona-draft-play>Play draft</);
  assert.match(stage, /type="button" class="secondary" data-persona-draft-save>Save draft JSON</);
  assert.match(stage, /accept="application\/json,\.json" data-persona-draft-file/);
  assert.match(stage, /id="persona-remix-file-note">The file saves the title, questions and choices on this device/);
  assert.match(stage, /role="status" data-persona-draft-file-status/);

  const controller = source('src/browser/share-experiences.ts');
  const start = controller.indexOf('function mountPersona');
  const end = controller.indexOf('function mountBingo', start);
  const persona = controller.slice(start, end);
  assert.ok(persona.indexOf('file.size > personaDraftFileLimit') < persona.indexOf('await file.text()'),
    'the byte bound is checked before any read');
  assert.match(persona, /const revision = editorRevision;/);
  assert.match(persona, /if \(revision !== editorRevision\)/);
  assert.match(persona, /readPersonaDraftFile\(pack\.game, text, pack\.questions\.length, draftOutcomeIds\)/);
  assert.match(persona, /fillDraftEditor\(read\.draft\)/);
  assert.match(persona, /writePersonaDraftFile\(pack\.game, read\.draft\)/);
  assert.match(persona, /URL\.revokeObjectURL\(url\)/);

  const fileStart = persona.indexOf('draftFile.addEventListener("change"');
  const fileEnd = persona.indexOf('remixForm.addEventListener("submit"', fileStart);
  assert.ok(fileStart > 0 && fileEnd > fileStart, 'the file import handler exists');
  const importHandler = persona.slice(fileStart, fileEnd);
  for (const forbidden of ['startDraft()', 'showQuestion(', 'draft =', 'replaceAddress(', 'localStorage', 'fetch(']) {
    assert.ok(!importHandler.includes(forbidden),
      `an accepted file only fills the editor, never ${forbidden}`);
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
  assert.match(controller, /download\.disabled = busy \|\| avatarPending \|\| !canShare \|\| !exportable;/);
  assert.match(controller, /copy\.disabled = !links \|\| !canShare \|\| !exportable;/);
  assert.match(controller, /!snapshot \|\| busy \|\| avatarPending \|\| controller\.exportAllowed\?\.\(\) === false/);
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

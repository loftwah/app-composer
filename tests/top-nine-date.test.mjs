import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { topNineDate, topNineDateLabel } from '../src/lib/top-nine-date.ts';
import {
  draftKey, draftVersion, readNineDraft, readNineDraftFile, writeNineDraft, writeNineDraftFile,
} from '../src/lib/share-experience-draft.ts';
import { topNineCaption } from '../src/lib/top-nine-caption.ts';
import { topNineAltText } from '../src/lib/top-nine-alt-text.ts';

// #1063: the optional Top Nine date is one intentional calendar day. It never
// defaults to today, shifts with the device timezone or changes an undated board.
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const blank = () => Array.from({ length: 9 }, () => '');
const nine = ['Kid A', 'Blue', 'Vespertine', 'Homogenic', 'Dummy', 'Mezzanine', 'Aja', 'Innervisions', 'Selected Ambient Works'];
const origin = 'https://composer.loftwah.com';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

test('only real bounded YYYY-MM-DD days are accepted, including Gregorian leap days', () => {
  const labels = new Map([
    ['0001-01-01', '1 January 1'],
    ['1900-02-28', '28 February 1900'],
    ['2000-02-29', '29 February 2000'],
    ['2024-02-29', '29 February 2024'],
    ['9999-12-31', '31 December 9999'],
  ]);
  for (const [value, label] of labels) {
    assert.equal(topNineDate(value), value);
    assert.equal(topNineDateLabel(value), label);
  }
  for (const value of [
    '', '   ', '2023-02-29', '1900-02-29', '2024-02-30', '2024-04-31',
    '2024-13-01', '2024-00-10', '2024-01-00', '0000-01-01', '10000-01-01',
    '2024-1-01', '24-11-2026', '2024-02-29T00:00:00Z', ' 2024-02-29 ',
    null, undefined, 20240229, {},
  ]) {
    assert.equal(topNineDate(value), '', `${String(value)} is not a portable calendar day`);
    assert.equal(topNineDateLabel(value), '');
  }
});

test('the written date is identical in opposite device timezones', () => {
  const moduleUrl = new URL('../src/lib/top-nine-date.ts', import.meta.url).href;
  const script = `import { topNineDateLabel } from ${JSON.stringify(moduleUrl)}; process.stdout.write(topNineDateLabel('2024-02-29'));`;
  for (const timezone of ['Pacific/Kiritimati', 'America/Los_Angeles']) {
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout, '29 February 2024', timezone);
  }
});

test('an intentional date round-trips through local and portable Top Nine drafts', () => {
  const board = { title: 'Nine albums', items: nine, byline: 'Mina', date: '2024-02-29', skin: 0 };
  const local = storage();
  assert.equal(writeNineDraft(local, board), 'saved');
  assert.match(local.values.get(draftKey('top-nine')), /"date":"2024-02-29"/);
  assert.deepEqual(readNineDraft(local), board);

  const text = writeNineDraftFile(board);
  const file = JSON.parse(text);
  assert.deepEqual(Object.keys(file), ['schema', 'title', 'items', 'byline', 'date', 'skin']);
  assert.equal(file.date, '2024-02-29');
  assert.deepEqual(readNineDraftFile(text), { draft: board, fault: null });
});

test('legacy and cleared dates keep the exact old draft and file shapes', () => {
  const legacy = { version: draftVersion, title: 'Nine albums', items: nine, byline: 'Mina', skin: 0 };
  const local = storage({ [draftKey('top-nine')]: JSON.stringify(legacy) });
  const { version: _version, ...restored } = legacy;
  assert.deepEqual(readNineDraft(local), restored);
  assert.equal('date' in readNineDraft(local), false);

  const cleared = storage();
  writeNineDraft(cleared, { ...restored, date: '' });
  assert.equal(cleared.values.get(draftKey('top-nine')), JSON.stringify(legacy));
  const file = JSON.parse(writeNineDraftFile({ ...restored, date: '' }));
  assert.equal('date' in file, false);
  assert.deepEqual(readNineDraftFile(JSON.stringify(file)).draft, restored);

  const invalidLocal = storage({
    [draftKey('top-nine')]: JSON.stringify({ ...legacy, date: '2023-02-29' }),
  });
  assert.equal('date' in readNineDraft(invalidLocal), false);
  const invalidFile = readNineDraftFile(JSON.stringify({ ...file, date: '2023-02-29' }));
  assert.equal(invalidFile.fault, null);
  assert.equal('date' in invalidFile.draft, false);
  assert.equal(readNineDraftFile(JSON.stringify({ ...file, date: 20240229 })).fault, 'shape');
});

test('caption and accessible description carry only a valid intentional date', () => {
  const dated = { title: 'Nine albums', byline: 'Mina', date: '2024-02-29', items: nine };
  assert.equal(topNineCaption(dated, origin), [
    'Nine albums',
    'By Mina',
    '29 February 2024',
    `Make your own Top Nine at ${origin}/share/experiences/top-nine`,
  ].join('\n'));
  const alt = topNineAltText(dated);
  assert.ok(alt.startsWith('Nine albums. By Mina. Dated 29 February 2024. Top row has Kid A, Blue and Vespertine. '));
  assert.ok(alt.includes('Bottom row has Aja, Innervisions and Selected Ambient Works.'));

  const legacy = { title: 'Nine albums', byline: 'Mina', items: nine };
  assert.equal(topNineCaption(legacy, origin), [
    'Nine albums', 'By Mina', `Make your own Top Nine at ${origin}/share/experiences/top-nine`,
  ].join('\n'));
  assert.equal(topNineAltText(legacy).includes('Dated '), false);
  assert.equal(topNineCaption({ ...dated, date: '2023-02-29' }, origin), topNineCaption(legacy, origin));
  assert.equal(topNineAltText({ ...dated, date: '2023-02-29' }), topNineAltText(legacy));
});

test('one native Top Nine date control feeds restore, result, preview, caption and description', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  assert.equal((stage.match(/type="date"/g) ?? []).length, 1);
  assert.match(stage, /\{isNine && <label>Optional date\s*<input type="date" min=\{topNineDateMin\} max=\{topNineDateMax\} autocomplete="off"\s*data-nine-date/);
  assert.doesNotMatch(stage, /type="date"[^>]*value=/, 'the control never defaults to a date');
  assert.match(stage, /<time data-nine-preview-date-value><\/time>/);
  assert.match(stage, /id="nine-date-note">Choose one calendar day/);
  assert.match(stage, /role="status" data-nine-date-status/);

  const controller = source('src/browser/share-experiences.ts');
  assert.match(controller, /dateInput\.value = draft\.date \?\? "";/);
  assert.match(controller, /dateInput\.value = topNineDate\(snapshot\.date\);/);
  assert.match(controller, /date: dateInput\.value,/);
  assert.match(controller, /const date = topNineDate\(dateInput\.value\);/);
  assert.match(controller, /\.\.\.\(date \? \{ date \} : \{\}\),/);
  assert.match(controller, /previewDateValue\.dateTime = value;/);
  assert.match(controller, /date: snapshot\.date, items: snapshot\.items/);
  assert.doesNotMatch(source('src/lib/top-nine-date.ts'), /new Date\(\)|Date\.now|toISOString/, 'no current-date or local-time read');
});

function installDom() {
  const loads = [];
  class StubImage {
    constructor() { this.src = ''; }
    decode() { loads.push(this.src); return Promise.resolve(); }
  }
  const previous = { document: globalThis.document, Image: globalThis.Image };
  globalThis.Image = StubImage;
  globalThis.document = {
    createElement() {
      const ops = [];
      const format = (value) => typeof value === 'string' ? JSON.stringify(value)
        : value && value.src ? `<img ${value.src}>` : String(value);
      const ctx = new Proxy({ measureText(text) { return { width: String(text).length * 8 }; } }, {
        get(object, prop) {
          if (prop in object) return object[prop];
          return (...args) => ops.push(`${String(prop)}(${args.map(format).join(',')})`);
        },
        set(object, prop, value) {
          ops.push(`${String(prop)}=${String(value)}`);
          object[prop] = value;
          return true;
        },
      });
      return {
        width: 0, height: 0,
        getContext() { return ctx; },
        toBlob(callback) { callback(new Blob(['png'], { type: 'image/png' })); },
        ops,
      };
    },
  };
  return { loads, restore() { globalThis.document = previous.document; globalThis.Image = previous.Image; } };
}

const board = () => ({
  game: 'top-nine', title: 'Nine albums', items: nine.slice(), byline: 'Mina', skin: 0, background: '',
});

async function draw(result, showCredit = true) {
  const dom = installDom();
  try {
    const { renderExperienceResult } = await import('../src/browser/share-experience-image.ts');
    let ops = [];
    const originalCreate = globalThis.document.createElement;
    globalThis.document.createElement = () => {
      const made = originalCreate();
      ops = made.ops;
      return made;
    };
    await renderExperienceResult(result, 'portrait', undefined, showCredit);
    return { ops, loads: dom.loads };
  } finally {
    dom.restore();
  }
}

test('undated or invalid-date PNG drawing is unchanged; an attached date uses the existing footer', async () => {
  const undated = await draw(board());
  const invalid = await draw({ ...board(), date: '2023-02-29' });
  assert.deepEqual(invalid, undated, 'an invalid date draws exactly the undated board');
  assert.equal(undated.ops.some((op) => op.includes('29 February 2024')), false);
  assert.ok(undated.ops.includes('fillText("Mina",1008,1262,566)'), 'the legacy one-line byline keeps its exact position');

  const dated = await draw({ ...board(), date: '2024-02-29' });
  const dateOp = dated.ops.find((op) => op.startsWith('fillText("29 February 2024"'));
  assert.ok(dateOp, 'the readable date prints in the actual PNG footer');
  const bounds = dateOp.match(/^fillText\("29 February 2024",(\d+),(\d+),(\d+)\)$/);
  assert.ok(bounds, dateOp);
  assert.ok(Number(bounds[1]) > 540, 'the date stays in the right-hand byline column');
  assert.ok(Number(bounds[2]) < 1350, 'the date baseline stays inside the canvas');
  assert.ok(Number(bounds[3]) >= 400, 'the date has bounded width rather than clipping');
  assert.ok(dated.ops.includes('fillText("Mina",1008,1252,566)'), 'the byline moves to the footer’s first line only when dated');
  assert.ok(dated.ops.includes('font=600 18px system-ui'));

  const noCredit = await draw({ ...board(), date: '2024-02-29' }, false);
  assert.ok(noCredit.ops.some((op) => op.startsWith('fillText("29 February 2024"')), 'date stays independent of the optional product credit');
  assert.equal(noCredit.ops.some((op) => op.includes('Made with App Composer')), false);

  const other = await draw({ ...board(), game: 'this-or-that', items: nine.slice(0, 5), date: '2024-02-29' });
  assert.equal(other.ops.some((op) => op.includes('29 February 2024')), false, 'another game never draws a Top Nine date');
});

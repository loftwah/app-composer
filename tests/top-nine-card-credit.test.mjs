import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// #1067: a Top Nine creator may switch the App Composer signature off for the
// exported PNG only. Checked by default keeps the exact established bytes;
// unchecked drops just the mark and its two lines, leaving byline, board,
// aspect, ranking and covers untouched. The choice is transient and export-only.

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const BYLINE = 'Mina';
const MARK = 'composer-icon-20261022b-96.png';

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
      const target = {
        measureText(text) { return { width: String(text).length * 8 }; },
      };
      const ctx = new Proxy(target, {
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
  return {
    loads,
    restore() {
      globalThis.document = previous.document;
      globalThis.Image = previous.Image;
    },
  };
}

const board = () => ({
  game: 'top-nine', title: 'Nine albums', subtitle: '',
  items: Array.from({ length: 9 }, (_, index) => `Exhibit ${index + 1}`),
  byline: BYLINE, skin: 0, background: '', ranked: true,
});

async function draw(showCredit) {
  const dom = installDom();
  try {
    const { renderExperienceResult } = await import('../src/browser/share-experience-image.ts');
    // Capture the ops the renderer records on its own canvas instance.
    let ops = [];
    const originalCreate = globalThis.document.createElement;
    globalThis.document.createElement = () => {
      const made = originalCreate();
      ops = made.ops;
      return made;
    };
    await renderExperienceResult(board(), 'portrait', undefined, showCredit);
    return { ops, loads: dom.loads };
  } finally {
    dom.restore();
  }
}

test('checked (default) draws the mark and two lines; unchecked removes only those', async () => {
  const checked = await draw(true);
  const unchecked = await draw(false);

  assert.deepEqual(checked.loads, ['/brand/composer-icon-20261022b-96.png'], 'default still fetches the mark');
  assert.deepEqual(unchecked.loads, [], 'an opted-out export never fetches the mark');

  const isCredit = (op) => op.includes('"Made with App Composer"') || op.includes('"composer.loftwah.com"')
    || (op.startsWith('drawImage(') && op.includes(MARK));
  assert.ok(checked.ops.some(isCredit), 'the signed export carries the mark and its two lines');
  assert.ok(!unchecked.ops.some(isCredit), 'the opted-out export carries neither mark nor lines');

  assert.equal(checked.ops.filter((op) => op.includes(JSON.stringify(BYLINE))).length, 1);
  assert.equal(unchecked.ops.filter((op) => op.includes(JSON.stringify(BYLINE))).length, 1, 'byline survives');
  for (let i = 1; i <= 9; i += 1) {
    const caption = JSON.stringify(`Exhibit ${i}`);
    assert.ok(unchecked.ops.some((op) => op.startsWith('fillText(') && op.includes(caption)), `slot ${i} still prints`);
  }

  // The whole board, header and byline produce the identical draw sequence;
  // the only difference is the contiguous credit block before the byline.
  const bylineAt = checked.ops.indexOf('textAlign=right');
  const markAt = checked.ops.findIndex((op) => op.startsWith('drawImage(') && op.includes(MARK));
  assert.ok(markAt >= 0 && bylineAt > markAt, 'the credit block sits just before the byline');
  const withoutCredit = [...checked.ops.slice(0, markAt), ...checked.ops.slice(bylineAt)];
  assert.deepEqual(withoutCredit, unchecked.ops, 'removing the credit changes nothing else in the image');
});

test('the export settings show one checked Top Nine-only checkbox', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  const box = stage.match(/\{isNine && <label class="exhibition-ranked">\s*<input type="checkbox" data-nine-credit checked \/>\s*Show App Composer credit on the PNG\s*<\/label>\}/);
  assert.ok(box, 'one native, checked, visibly labelled checkbox in the export panel');
  const panelStart = stage.indexOf('data-export-panel');
  const panel = stage.slice(panelStart, stage.indexOf('experience-actions', panelStart));
  assert.ok(panel.includes('data-nine-credit'), 'it lives inside the existing export settings');
});

test('all PNG actions read the preference at action time and stay transient', () => {
  const controller = source('src/browser/share-experiences.ts');
  assert.equal([...controller.matchAll(/data-nine-credit/g)].length, 1, 'one control query');
  assert.match(controller, /const nineCredit = root\.querySelector<HTMLInputElement>\("\[data-nine-credit\]"\)/);
  const calls = [...controller.matchAll(/renderExperienceResult\(drawn, size, controller\.exportCovers\?\.\(\) \?\? undefined, nineCredit\?\.checked \?\? true\)/g)];
  assert.equal(calls.length, 3, "Download, copy and native sharing capture the same preference");

  // No persistence or publication surface absorbs the choice.
  for (const forbidden of ['data-nine-credit'] ) {
    assert.ok(!source('src/lib/share-experience-draft.ts').includes(forbidden));
    assert.ok(!source('src/lib/top-nine-caption.ts').includes(forbidden));
    assert.ok(!source('src/lib/top-nine-alt-text.ts').includes(forbidden));
  }
  const resultLink = controller.slice(controller.indexOf('const resultLink ='), controller.indexOf('const offerManualCopy'));
  assert.doesNotMatch(resultLink, /nineCredit/);
  const boardDraft = controller.slice(controller.indexOf('const boardDraft ='), controller.indexOf('saveDraft.addEventListener'));
  assert.doesNotMatch(boardDraft, /nineCredit/);
});

test('the shared sign-off keeps the byline independent of the mark', () => {
  const image = source('src/browser/share-experience-image.ts');
  assert.match(image, /mark: HTMLImageElement \| null/);
  assert.match(image, /ctx\.fillStyle = ink;\n  if \(mark\) \{/);
  assert.match(image, /result\.game !== "top-nine" \|\| showCredit/);
  assert.match(image, /if \(byline\) \{[\s\S]*?ctx\.fillText\(byline/);
  // Every other renderer still passes a real mark, so their sign-off is unchanged.
  assert.equal([...image.matchAll(/signCard\(ctx, mark, /g)].length, 8);
});

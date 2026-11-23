import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  nineListApplied, nineListLimit, nineListSummary, planNineList, planNineListUndo,
} from '../src/lib/top-nine-list.ts';
import {
  nineItemLimit, readNineDraft, writeNineDraft,
} from '../src/lib/share-experience-draft.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
};

test('a pasted list fills only the slots the board is waiting for, in board order', () => {
  const plan = planNineList('Alpha\nBeta', [1, 3, 4]);
  assert.deepEqual(plan.indexes, [1, 3]);
  assert.deepEqual(plan.titles, ['Alpha', 'Beta']);
  assert.deepEqual(plan.overflow, []);
  // Nothing in the plan can address an occupied slot: the caller passes only
  // free ones, and every target came from that list.
  assert.ok(plan.indexes.every((index) => [1, 3, 4].includes(index)));
});

test('blank lines are skipped and every title keeps the editor limit', () => {
  assert.equal(nineItemLimit, 54);
  const long = 'x'.repeat(80);
  const plan = planNineList(`\n  First   thing \n\n\t\n${long}\nΛυρική 🎛️\n`, [0, 1, 2, 3]);
  assert.deepEqual(plan.titles, ['First thing', 'x'.repeat(54), 'Λυρική 🎛️']);
  assert.deepEqual(plan.overflow, []);
  // The same bound the saved draft applies, so a filled title survives a save.
  const saved = storage();
  writeNineDraft(saved, { title: 'Nine', items: [long, '', '', '', '', '', '', '', ''] });
  assert.equal(readNineDraft(saved).items[0].length, 54);
});

test('past the last empty slot the remaining lines stay in the editor, in order', () => {
  const plan = planNineList('A\nB\nC\nD', [0, 2]);
  assert.deepEqual(plan.indexes, [0, 2]);
  assert.deepEqual(plan.titles, ['A', 'B']);
  assert.deepEqual(plan.overflow, ['C', 'D']);
  // A second fill with those lines completes a board that still has room.
  const next = planNineList(plan.overflow.join('\n'), [1, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(next.titles, ['C', 'D']);
  assert.deepEqual(next.overflow, []);
  const long = `  ${'x'.repeat(80)}  `;
  assert.deepEqual(planNineList(`A\n${long}`, [0]).overflow, [long]);
});

test('a full board places nothing and keeps every line for the editor', () => {
  const plan = planNineList('A\nB', []);
  assert.deepEqual(plan.indexes, []);
  assert.deepEqual(plan.titles, []);
  assert.deepEqual(plan.overflow, ['A', 'B']);
  assert.equal(nineListSummary(plan, 0), 'No empty slots are available · 2 lines staying in the editor.');
});

test('a repeated or malformed index cannot take two lines', () => {
  const plan = planNineList('A\nB\nC', [2, 2, -1, 1.5, 0]);
  assert.deepEqual(plan.indexes, [2, 0]);
  assert.deepEqual(plan.titles, ['A', 'B']);
  assert.deepEqual(plan.overflow, ['C']);
});

test('the count beside the paste box names what is ready and what stays', () => {
  assert.equal(nineListSummary(planNineList('', [0, 1]), 2), '2 empty slots in board order.');
  assert.equal(nineListSummary(planNineList('', []), 0), 'No empty slots are available.');
  assert.equal(nineListSummary(planNineList('A\nB', [0, 1, 2, 3, 4, 5]), 6), '6 empty slots · 2 ready.');
  assert.equal(
    nineListSummary(planNineList('A\nB\nC', [0, 1]), 2),
    '2 empty slots · 2 ready · 1 staying in the editor.',
  );
  assert.equal(
    nineListApplied(planNineList('A\nB\nC', [0, 1]), 7),
    'Filled 2 exhibits · 7 empty slots left · 1 line stayed in the editor.',
  );
  assert.equal(nineListApplied(planNineList('A', [0]), 8), 'Filled 1 exhibit · 8 empty slots left.');
  assert.ok(nineListLimit >= 9 * nineItemLimit, 'the paste box holds a full board plus overdue lines');
});

test('one Undo clears the whole fill and leaves earlier and later edits alone', () => {
  const filled = { indexes: [0, 2, 4], titles: ['Alpha', 'Beta', 'Gamma'] };
  // Slot 2 was retitled after the fill; slots 1 and 3 were never part of it.
  const current = ['Alpha', 'Earlier edit', 'Edited later', 'Another earlier edit', 'Gamma', '', '', '', ''];
  const plan = planNineListUndo(filled, current, (index) => index === 4);
  assert.deepEqual(plan.clear, [0]);
  assert.deepEqual(plan.restored, ['Alpha']);
  assert.equal(plan.kept, 2);
  // Every untouched exhibit keeps its exact text: the undo only names slots
  // this fill wrote when they still hold the same title.
  assert.deepEqual(current.slice(1, 4), ['Earlier edit', 'Edited later', 'Another earlier edit']);
});

test('the editor offers one compact paste affordance wired to the normal inputs', () => {
  const component = read('src/components/share-experiences/ShareExperience.astro');
  assert.match(component, /<details class="exhibit-list" data-list-panel>/);
  assert.match(component, /<summary>Paste a list<\/summary>/);
  assert.match(component, /id="exhibit-list"[^>]*maxlength=\{nineListLimit\}[^>]*data-list-text/);
  assert.match(component, /data-list-fill disabled/);
  assert.match(component, /data-list-undo disabled/);
  assert.match(component, /data-list-status/);

  const controller = read('src/browser/share-experiences.ts');
  const start = controller.indexOf('function listSlots()');
  assert.ok(start > 0, 'the fill feature exists in the exhibition editor');
  const block = controller.slice(start, controller.indexOf('cover.target.addEventListener', start));
  // The ordinary input path: no parallel store, no search, no clipboard read.
  assert.match(block, /dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
  assert.match(block, /planNineListUndo\(/);
  assert.doesNotMatch(block, /fetch\(|navigator\.|clipboard|runSearch|fillAlbumTitle/);
  assert.doesNotMatch(read('src/lib/top-nine-list.ts'), /fetch\(|navigator\.|https?:\/\//);
});

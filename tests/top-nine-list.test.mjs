import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  nineListApplied, nineListLimit, nineListSummary, planNineList, planNineListUndo,
} from '../src/lib/top-nine-list.ts';
import { pageLink, pageUrlLimit } from '../src/lib/top-nine-pages.ts';
import {
  draftKey, nineItemLimit, readNineDraft, writeNineDraft,
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

test('a plain one-title-per-line paste stays exactly page-free', () => {
  const plan = planNineList('Alpha\nBeta', [0, 1, 2]);
  assert.deepEqual(plan.lines, ['Alpha', 'Beta']);
  assert.deepEqual(plan.urls, [null, null]);
  assert.deepEqual(plan.rows, ['Alpha', 'Beta']);
  assert.deepEqual(plan.remaining, []);
  assert.deepEqual(plan.invalid, []);
  // A spreadsheet export's trailing tab is still one ordinary title.
  const trailing = planNineList('Title\t', [0]);
  assert.deepEqual(trailing.titles, ['Title']);
  assert.deepEqual(trailing.urls, [null]);
  assert.deepEqual(trailing.invalid, []);
});

test('a second column becomes one exact public page validated by pageLink', () => {
  const safe = 'https://Example.COM/watch?v=one#part';
  assert.equal(pageLink(safe), 'https://example.com/watch?v=one#part');
  const plan = planNineList(`  First   thing \t ${safe} \nSecond`, [0, 1]);
  assert.deepEqual(plan.titles, ['First thing', 'Second']);
  assert.deepEqual(plan.urls, ['https://example.com/watch?v=one#part', null]);
  // The title keeps the existing editor bound; the page keeps the page bound.
  assert.deepEqual(plan.remaining, []);
  const long = 'x'.repeat(80);
  const bounded = planNineList(`${long}\thttps://example.com/${'y'.repeat(280)}`, [0]);
  assert.deepEqual(bounded.titles, ['x'.repeat(nineItemLimit)]);
  assert.equal(bounded.urls[0].length, pageUrlLimit);
});

test('a two-column row that is not title TAB public HTTPS page stays verbatim', () => {
  const good = ['Good\thttps://example.com/good'];
  const bad = [
    'Plain\thttp://example.com/page',
    'Plain\tjavascript:alert(1)',
    'Plain\thttps://localhost/page',
    'Plain\thttps://example.com/a b',
    'Plain\thttps://user:pass@example.com/',
    '\thttps://example.com/no-title',
    'Three\thttps://example.com/one\thttps://example.com/two',
    `Long\thttps://example.com/${'x'.repeat(pageUrlLimit)}`,
  ];
  const plan = planNineList([...good, ...bad].join('\n'), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(plan.indexes, [0]);
  assert.deepEqual(plan.titles, ['Good']);
  assert.deepEqual(plan.urls, ['https://example.com/good']);
  assert.deepEqual(plan.invalid, bad);
  assert.deepEqual(plan.remaining, bad);
  // Never placed, and the count beside the box says how many need fixing.
  assert.equal(plan.overflow.length, 0);
  assert.equal(
    nineListSummary(plan, 9),
    '9 empty slots · 1 ready · 8 staying in the editor · 8 rows not placed, need title TAB public HTTPS page.',
  );
  assert.equal(
    nineListApplied(plan, 8),
    'Filled 1 exhibit · 8 empty slots left · 1 page linked · 8 rows not placed, need title TAB public HTTPS page.',
  );
});

test('blank, unplaced and overflow rows keep their original order beside pages', () => {
  const rows = [
    'One\thttps://example.com/one',
    '',
    'Plain two',
    'Bad\thttp://example.com/bad',
    'Three\thttps://example.com/three',
    'Hero\thttps://example.com/four',
  ];
  const plan = planNineList(`\n${rows.join('\n')}\n`, [3, 1]);
  assert.deepEqual(plan.indexes, [3, 1]);
  assert.deepEqual(plan.titles, ['One', 'Plain two']);
  assert.deepEqual(plan.urls, ['https://example.com/one', null]);
  assert.deepEqual(plan.overflow, [rows[4], rows[5]]);
  assert.deepEqual(plan.invalid, [rows[3]]);
  assert.deepEqual(plan.remaining, [rows[3], rows[4], rows[5]]);
  // A second fill of what is left only claims the slots still waiting.
  const next = planNineList(plan.remaining.join('\n'), [0, 2]);
  assert.deepEqual(next.titles, ['Three', 'Hero']);
  assert.deepEqual(next.urls, ['https://example.com/three', 'https://example.com/four']);
  assert.deepEqual(next.invalid, [rows[3]]);
});

test('a page-filled board saves and an older page-free draft still fills', () => {
  const saved = storage();
  writeNineDraft(saved, { title: 'Older', items: ['Kept', '', '', '', '', '', '', '', ''], byline: '', skin: 0 });
  // A draft saved before pages existed keeps its exact stored shape.
  assert.doesNotMatch(saved.getItem(draftKey("top-nine")), /"pages"/);
  const older = readNineDraft(saved);
  assert.equal(older.pages, undefined);
  const open = older.items.map((item, index) => (item ? -1 : index)).filter((index) => index >= 0);
  const plan = planNineList('Alpha\thttps://example.com/alpha\nBeta', open);
  assert.deepEqual(plan.indexes, [1, 2]);
  assert.deepEqual(plan.urls, ['https://example.com/alpha', null]);
  const items = older.items.slice();
  const pages = older.items.map(() => null);
  plan.indexes.forEach((index, line) => {
    items[index] = plan.titles[line];
    pages[index] = plan.urls[line];
  });
  writeNineDraft(saved, { ...older, items, pages });
  const filled = readNineDraft(saved);
  assert.deepEqual(filled.items, ['Kept', 'Alpha', 'Beta', '', '', '', '', '', '']);
  assert.equal(filled.pages[0], null);
  assert.equal(filled.pages[1], 'https://example.com/alpha');
  assert.equal(filled.pages[2], null);
});

test('Undo clears only the untouched title/page pairs and restores raw rows', () => {
  const filled = {
    indexes: [0, 1, 2, 3],
    titles: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    urls: ['https://example.com/alpha', 'https://example.com/beta', null, 'https://example.com/delta'],
    rows: [
      '  Alpha\t https://example.com/alpha ',
      'Beta\thttps://example.com/beta',
      'Gamma',
      'Delta\thttps://example.com/delta',
    ],
  };
  const current = ['Alpha', 'Beta', 'Gamma retitled', 'Delta'];
  const currentPages = ['https://example.com/alpha', 'https://example.com/replaced', null, 'https://example.com/delta'];
  // Slot 0 is untouched; 1 has a replaced page; 2 was retitled; 3 gained a cover.
  const plan = planNineListUndo(filled, current, (index) => index === 3, currentPages);
  assert.deepEqual(plan.clear, [0]);
  assert.deepEqual(plan.restored, ['  Alpha\t https://example.com/alpha ']);
  assert.equal(plan.pages, 1);
  assert.equal(plan.kept, 3);
  // Removing a filled page is a later change too, so its title is left alone.
  const removed = planNineListUndo(
    { indexes: [5], titles: ['Echo'], urls: ['https://example.com/echo'] },
    ['Echo'], () => false, [null],
  );
  assert.deepEqual(removed.clear, []);
  assert.deepEqual(removed.restored, []);
  assert.equal(removed.kept, 1);
  // A preexisting attachment on a filled slot is never this fill's to remove.
  const attached = planNineListUndo(filled, current, () => true, currentPages);
  assert.deepEqual(attached.clear, []);
  assert.equal(attached.kept, 4);
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

test('the paste box explains the optional page column and holds nine full rows', () => {
  const component = read('src/components/share-experiences/ShareExperience.astro');
  assert.match(component, /add a tab and a public HTTPS page/i);
  assert.match(component, /<label for="exhibit-list">Exhibit titles and optional pages<\/label>/);
  assert.ok(
    nineListLimit >= 9 * (nineItemLimit + 1 + pageUrlLimit),
    'nine bounded titles plus full-length public pages fit in the paste box',
  );

  const controller = read('src/browser/share-experiences.ts');
  const start = controller.indexOf('function listSlots()');
  const block = controller.slice(start, controller.indexOf('cover.target.addEventListener', start));
  // The ordinary local page state, never a provider source, fetch or preview.
  assert.match(block, /plan\.urls\.forEach/);
  assert.match(block, /pageLinks\[index\] = url/);
  assert.match(block, /pageTitles\[index\] = plan\.titles\[line\]/);
  assert.match(block, /plan\.remaining\.join\("\\n"\)/);
  assert.match(block, /hasFillBlocker/);
  assert.doesNotMatch(block, /setLink\(|sourceLink\(|fetch\(|runSearch/);
});

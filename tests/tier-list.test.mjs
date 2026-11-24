import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiences,
} from '../src/lib/share-experiences.ts';
import {
  addTierListEntry, editTierListEntry, emptyTierListBoard, moveTierListEntry,
  moveTierListEntryWithinRow, removeTierListEntry, startTierListBoard, tierListCount, tierListDefaultTitle,
  tierListEntryLimit, tierListEntryTotal, tierListHasRoom, tierListRowEntryLimit,
  tierListRows, tierListSnapshot, tierListStarter, tierListTierCount, tierListTiers,
  tierListTitleLimit,
} from '../src/lib/tier-list.ts';

// #1074 early slice: four authored rows, a bounded set of editable entries,
// explicit row moves, removal and one optional original starter. The board
// starts empty and never becomes a link. These checks cover the pure board;
// the signed-out phone/desktop journey and PNG are verified in a browser.

test('the registry entry reuses the owned tier-list artwork without a new asset', () => {
  const experience = experiences['tier-list'];
  assert.equal(experience.title, 'Tier List');
  assert.equal(experience.slug, 'tier-list');
  assert.equal(experience.theme, 'sorting');
  assert.match(experience.description, /stays in this browser/i);
  assert.doesNotMatch(experience.description, /vote|competition|leaderboard/i);
  for (const path of [experienceArt('tier-list'), experienceOg('tier-list')]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} exists`);
  }
  const webp = experienceArt('tier-list').replace('.jpg', '-480.webp');
  assert.ok(existsSync(new URL(`../public${webp}`, import.meta.url)), 'the 480w stage art exists');
});

test('there are four original named rows, not borrowed grades', () => {
  assert.equal(tierListTierCount, 4);
  assert.equal(tierListTiers.length, 4);
  const labels = tierListTiers.map((tier) => tier.label);
  assert.equal(new Set(labels).size, 4, 'every row has its own name');
  assert.deepEqual(labels, ['Keep close', 'Worth the space', 'Trying it on', 'Not for me']);
  for (const label of labels) {
    assert.match(label, /\S/);
    assert.ok(label.length <= 24, 'a row name stays readable in the label column');
    assert.doesNotMatch(label, /^(S|A|B|C|D|F)$/i);
  }
});

test('the board starts empty and has one bounded, original starter', () => {
  const board = emptyTierListBoard();
  assert.equal(board.length, 4);
  assert.ok(board.every((row) => row.length === 0));
  assert.equal(tierListCount(board), 0);
  assert.equal(tierListSnapshot(tierListDefaultTitle, board), null);

  assert.ok(tierListStarter.length > 0 && tierListStarter.length <= tierListEntryTotal);
  for (const entry of tierListStarter) {
    assert.ok(entry.row >= 0 && entry.row < 4);
    assert.ok(entry.text.trim() === entry.text && entry.text.length > 0);
    assert.ok(entry.text.length <= tierListEntryLimit);
  }

  const starter = startTierListBoard();
  assert.equal(starter.length, 4);
  assert.equal(tierListCount(starter), tierListStarter.length);
  assert.deepEqual(starter.map((row) => row.length), [2, 1, 1, 1]);
  assert.ok(starter.flat().every((text) => tierListStarter.some((entry) => entry.text === text)));
});

test('adding cleans, caps and respects both board and row limits', () => {
  let board = emptyTierListBoard();
  board = addTierListEntry(board, 0, '  A   notebook  ');
  assert.deepEqual(board[0], ['A notebook']);
  assert.equal(tierListCount(board), 1);

  assert.equal(addTierListEntry(board, 0, '   '), null, 'an empty entry is never added');
  assert.equal(addTierListEntry(board, 4, 'outside the rows'), null);
  assert.equal(addTierListEntry(board, -1, 'outside the rows'), null);

  for (let index = 1; index < tierListRowEntryLimit; index += 1) {
    board = addTierListEntry(board, 0, `Entry ${index}`);
  }
  assert.equal(board[0].length, tierListRowEntryLimit);
  assert.equal(tierListHasRoom(board, 0), false);
  assert.equal(addTierListEntry(board, 0, 'one more'), null, 'a full row refuses another entry');

  let total = board;
  for (let index = tierListRowEntryLimit; index < tierListEntryTotal; index += 1) {
    total = addTierListEntry(total, 1, `Entry ${index}`);
  }
  assert.equal(tierListCount(total), tierListEntryTotal);
  assert.equal(tierListHasRoom(total, 2), false, 'a full board accepts nothing');
  assert.equal(addTierListEntry(total, 2, 'thirteenth'), null);
});

test('editing keeps the exact typed value, capped, without trimming', () => {
  const board = addTierListEntry(emptyTierListBoard(), 0, 'First');
  const edited = editTierListEntry(board, 0, 0, 'A longer name ');
  assert.equal(edited[0][0], 'A longer name ', 'a trailing space survives while typing');
  const capped = editTierListEntry(board, 0, 0, 'x'.repeat(tierListEntryLimit + 20));
  assert.equal(capped[0][0].length, tierListEntryLimit);
  assert.equal(edited[0].length, 1);
  assert.equal(editTierListEntry(board, 4, 0, 'no'), null);
  assert.equal(editTierListEntry(board, 0, 1, 'no'), null);
});

test('entries move explicitly to another row and never into a full one', () => {
  let board = addTierListEntry(emptyTierListBoard(), 0, 'Keep me');
  board = addTierListEntry(board, 0, 'Move me');
  const moved = moveTierListEntry(board, 0, 1, 2);
  assert.deepEqual(moved.board.map((row) => row.length), [1, 0, 1, 0]);
  assert.deepEqual(moved.board[0], ['Keep me']);
  assert.deepEqual(moved.board[2], ['Move me']);
  assert.equal(moved.index, 0, 'the moved entry lands at the end of its new row');

  const same = moveTierListEntry(board, 0, 0, 0);
  assert.deepEqual(same.board, board, 'choosing the current row changes nothing');
  assert.equal(same.index, 0);

  let full = emptyTierListBoard();
  for (let index = 0; index < tierListRowEntryLimit; index += 1) full = addTierListEntry(full, 1, `Full ${index}`);
  full = addTierListEntry(full, 0, 'Waiting');
  assert.equal(moveTierListEntry(full, 0, 0, 1), null, 'a full destination refuses the move');
  assert.equal(moveTierListEntry(board, 0, 9, 1), null);
  assert.equal(moveTierListEntry(board, 9, 0, 1), null);
});

test('entries move one place earlier or later without changing other rows', () => {
  const board = [
    ['First', 'Second', 'Third', 'Fourth'],
    ['Other one', 'Other two'],
    [],
    ['Last'],
  ];
  const earlier = moveTierListEntryWithinRow(board, 0, 2, 'earlier');
  assert.deepEqual(earlier.board, [
    ['First', 'Third', 'Second', 'Fourth'],
    ['Other one', 'Other two'],
    [],
    ['Last'],
  ]);
  assert.equal(earlier.index, 1, 'focus can follow the moved entry');
  assert.deepEqual(earlier.board.slice(1), board.slice(1), 'other rows keep their exact order');

  const later = moveTierListEntryWithinRow(earlier.board, 0, 1, 'later');
  assert.deepEqual(later.board, board, 'moving later restores the exact adjacent order');
  assert.equal(later.index, 2);
  assert.deepEqual(later.board.slice(1), board.slice(1), 'other rows stay unchanged');
  assert.deepEqual(board[0], ['First', 'Second', 'Third', 'Fourth'], 'the input board is not mutated');

  const snapshot = tierListSnapshot(tierListDefaultTitle, earlier.board);
  assert.deepEqual(snapshot.items, ['First', 'Third', 'Second', 'Fourth', 'Other one', 'Other two', 'Last']);
  assert.deepEqual(tierListRows(snapshot.items, snapshot.tierSizes), earlier.board, 'result and card rows use the same order');

  assert.equal(moveTierListEntryWithinRow(board, 0, 0, 'earlier'), null, 'the first entry cannot move earlier');
  assert.equal(moveTierListEntryWithinRow(board, 0, 3, 'later'), null, 'the last entry cannot move later');
  assert.equal(moveTierListEntryWithinRow(board, 3, 0, 'earlier'), null, 'a single-entry row has no earlier move');
  assert.equal(moveTierListEntryWithinRow(board, 3, 0, 'later'), null, 'a single-entry row has no later move');
  assert.equal(moveTierListEntryWithinRow(board, 2, 0, 'later'), null, 'an empty row has no entry to move');
  assert.equal(moveTierListEntryWithinRow(board, -1, 0, 'later'), null);
  assert.equal(moveTierListEntryWithinRow(board, tierListTierCount, 0, 'later'), null);
  assert.equal(moveTierListEntryWithinRow(board, 0.5, 1, 'later'), null);
  assert.equal(moveTierListEntryWithinRow(board, 0, -1, 'later'), null);
  assert.equal(moveTierListEntryWithinRow(board, 0, 4, 'earlier'), null);
  assert.equal(moveTierListEntryWithinRow(board, 0, 1.5, 'later'), null);
  assert.equal(moveTierListEntryWithinRow(board, 0, 1, 'sideways'), null);
});

test('removal takes exactly one entry and leaves the rest in place', () => {
  let board = addTierListEntry(emptyTierListBoard(), 0, 'One');
  board = addTierListEntry(board, 0, 'Two');
  board = addTierListEntry(board, 2, 'Three');
  const removed = removeTierListEntry(board, 0, 0);
  assert.deepEqual(removed[0], ['Two']);
  assert.deepEqual(removed[2], ['Three']);
  assert.equal(removeTierListEntry(board, 0, 9), null);
  assert.equal(removeTierListEntry(board, 8, 0), null);
});

test('the export snapshot is row-ordered, omits blanks and needs one entry', () => {
  let board = emptyTierListBoard();
  board = addTierListEntry(board, 0, '  Keep  one ');
  board = addTierListEntry(board, 2, 'Try this');
  board = editTierListEntry(board, 2, 0, '');
  const cleared = tierListSnapshot(tierListDefaultTitle, board);
  assert.deepEqual(cleared.items, ['Keep one'], 'a cleared entry never exports');
  assert.deepEqual(cleared.tierSizes, [1, 0, 0, 0]);
  board = editTierListEntry(board, 0, 0, '');
  assert.equal(tierListSnapshot(tierListDefaultTitle, board), null, 'an all-empty board has no result');

  board = editTierListEntry(board, 0, 0, 'Keep one');
  board = editTierListEntry(board, 2, 0, 'Try this');
  board = addTierListEntry(board, 3, 'Not this');
  const snapshot = tierListSnapshot('  My  list ', board);
  assert.equal(snapshot.title, 'My list');
  assert.deepEqual(snapshot.items, ['Keep one', 'Try this', 'Not this']);
  assert.deepEqual(snapshot.tierSizes, [1, 0, 1, 1]);
  assert.equal(snapshot.tierSizes.reduce((total, size) => total + size, 0), snapshot.items.length);
  assert.equal(snapshot.title.length <= tierListTitleLimit, true);

  const withEntry = addTierListEntry(emptyTierListBoard(), 1, 'Something');
  assert.equal(tierListSnapshot('   ', withEntry).title, tierListDefaultTitle);
});

test('the browser board cannot become a link or a stored draft', () => {
  const controller = readFileSync(new URL('../src/browser/share-experiences.ts', import.meta.url), 'utf8');
  assert.match(controller, /game === "tier-list" \? mountTierList/);
  assert.match(controller, /game === "twenty-one-questions" \|\| game === "developer-type" \|\| game === "language-type" \|\| game === "tier-list"/);
  assert.match(controller, /linksAllowed: \(\) => false/);
  assert.doesNotMatch(controller, /draftKey\("tier-list"\)/, 'no draft storage exists for the board');
  assert.match(controller, /if \(typeof navigator\.share === "function" && game !== "twenty-one-questions" && game !== "tier-list"/);
  const image = readFileSync(new URL('../src/browser/share-experience-image.ts', import.meta.url), 'utf8');
  assert.match(image, /if \(result\.game === "tier-list"\) return renderTierList\(result, format\)/);
});

test('the renderer gets four rows and falls back safely on a malformed size list', () => {
  assert.deepEqual(tierListRows(['A', 'B', 'C'], [1, 1, 1, 0]), [['A'], ['B'], ['C'], []]);
  assert.deepEqual(tierListRows(['A', 'B'], [2, 0, 0, 0]), [['A', 'B'], [], [], []]);
  assert.deepEqual(tierListRows(['A', 'B'], [1, 2, 0, 0]), [['A', 'B'], [], [], []], 'sizes must sum to the entries');
  assert.deepEqual(tierListRows(['A'], [1]), [['A'], [], [], []], 'there are always four rows');
  assert.deepEqual(tierListRows('not an array', [1, 0, 0, 0]), [[], [], [], []]);
});

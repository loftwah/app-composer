import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const controller = read('src/browser/share-experiences.ts');
const component = read('src/components/share-experiences/ShareExperience.astro');
const css = read('src/styles/share-experiences.css');

test('the visible slot heading is the only drag handle and the board is the drop zone', () => {
  assert.match(component, /<div class="exhibition-objects" data-exhibition-objects>/);
  assert.match(component, /class="exhibit-heading" draggable="true" data-drag-slot=\{index\} title="Drag onto another slot to swap exhibits"/);
  assert.match(component, /<span class="exhibit-grip" aria-hidden="true">/);
  assert.match(component, /data-object=\{index\} aria-label=/);
  assert.match(component, /Drag an exhibit heading onto another slot to swap them/);
  // The keyboard and touch paths stay exactly where they were.
  assert.match(component, /data-order-index/);
  assert.match(component, /data-move="-1"/);
  assert.match(component, /data-move="1"/);
  assert.match(component, /data-swap-slots disabled/);
  assert.match(component, /data-undo-move disabled/);
});

test('buttons, selects and drag share one bounded move with one undo', () => {
  assert.equal((controller.match(/function moveExhibit\(/g) ?? []).length, 1);
  const move = controller.slice(controller.indexOf('function moveExhibit('), controller.indexOf('const slotLabels'));
  assert.match(move, /function moveExhibit\(from: number, to: number\)/);
  assert.match(move, /from < 0 \|\| from >= objects\.length \|\| to < 0 \|\| to >= objects\.length \|\| from === to/);
  assert.match(move, /swapExhibits\(from, to\)/);
  assert.match(move, /rememberMove\(from, to\)/);
  assert.match(move, /draftStatus\.textContent = `Exhibit \$\{from \+ 1\} moved to slot \$\{to \+ 1\}/);
  assert.match(move, /moveExhibit\(Number\(order\.value\), Number\(order\.value\) \+ Number\(button\.dataset\.move\)\)/);
  assert.match(move, /moveExhibit\(Number\(order\.value\), Number\(swapTarget\.value\)\)/);

  // The reused swap still carries title, source, exact page, cover, in-flight
  // invalidation, ranked selection and the one undo together.
  const swap = controller.slice(controller.indexOf('function swapExhibits('), controller.indexOf('function rememberMove('));
  for (const part of [
    'clearReplace()', 'cancelLookup(from)', 'cancelLookup(to)',
    '[hrefs[from], hrefs[to]]', '[pageLinks[from], pageLinks[to]]',
    '[pageTitles[from], pageTitles[to]]', '[covers[from], covers[to]]',
    'lastFill.indexes', 'closePreview(false)', 'refreshLinks()',
    'renderCovers()', 'renderPreview()', 'order.value = String(to)', 'update()',
  ]) assert.ok(swap.includes(part), `swapExhibits keeps ${part}`);
});

test('only a current same-board drag from a handle can reach the shared move', () => {
  const drag = controller.slice(controller.indexOf('const slotLabels'), controller.indexOf('/** Slots a pasted list may claim'));
  assert.match(drag, /dragHandles\.forEach\(/);
  assert.match(drag, /handle\.addEventListener\("dragstart"/);
  assert.match(drag, /const from = Number\(handle\.dataset\.dragSlot\)/);
  assert.match(drag, /activeDrag = \{ from, board: boardDragId \}/);
  assert.match(drag, /data\.setData\(dragType, boardDragId\)/);
  assert.equal((drag.match(/data\.types\.includes\(dragType\)/g) ?? []).length, 2);
  assert.match(drag, /activeDrag\.board !== boardDragId/);
  assert.match(drag, /drag\.board !== boardDragId/);
  assert.match(drag, /to === activeDrag\.from/);
  assert.match(drag, /to === drag\.from/);
  assert.match(drag, /moveExhibit\(drag\.from, to\)/);
  // Cancelled, foreign and same-slot drags never reach a state change.
  assert.match(drag, /handle\.addEventListener\("dragend", clearDrag\)/);
  assert.match(drag, /const drag = activeDrag;\s*clearDrag\(\);/);
  assert.equal((drag.match(/event\.preventDefault\(\)/g) ?? []).length, 1);
  for (const listener of ['dragstart', 'dragend', 'dragover', 'dragleave', 'drop']) {
    assert.equal((drag.match(new RegExp(`addEventListener\\("${listener}"`, 'g')) ?? []).length, 1, listener);
  }
  // No payload-derived URLs, text, files or custom pointer/touch path.
  assert.doesNotMatch(drag, /getData\(|text\/plain|text\/uri-list|text\/html|\.files\b|\.items\b/);
  assert.doesNotMatch(drag, /pointerdown|pointermove|pointerup|pointerId|touchstart|touchmove|touchend/);
});

test('the affordance is a visible grip, a grab cursor and a dashed drop slot', () => {
  const block = css.slice(css.indexOf('/* The visible slot heading is the desktop drag handle.'), css.indexOf('.nine-preview-subtitle'));
  assert.match(block, /\[data-drag-slot\] \{/);
  assert.match(block, /cursor: grab;/);
  assert.match(block, /cursor: grabbing;/);
  assert.match(block, /user-select: none;/);
  assert.match(block, /exhibition-objects label\[data-drop-slot\] \{/);
  assert.match(block, /outline: 2px dashed var\(--accent\)/);
  assert.doesNotMatch(block, /touch-action/);
});

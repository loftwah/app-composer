import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession } from '../src/plugins/stacks/editor-session.ts';

test('a delayed save acknowledges only the submitted edit generation', () => {
  const editor = new EditorSession();
  editor.adopt('stack-one', 2);
  editor.edit();
  const submitted = editor.capture();
  editor.edit();
  assert.equal(editor.acknowledge(submitted, 3, true), true);
  assert.equal(editor.revision, 3);
  assert.equal(editor.dirty, true, 'newer edits stay unsaved');
  editor.acknowledge(editor.capture(), 4, true);
  assert.equal(editor.dirty, false, 'exact latest save is clean');
});

test('publication/status acknowledgements update revision without replacing or saving local work', () => {
  const editor = new EditorSession();
  editor.adopt('stack-one', 2);
  for (const action of ['publish', 'unpublish', 'archive', 'restore', 'republish']) {
    const pending = editor.capture();
    editor.edit();
    editor.acknowledge(pending, editor.revision + 1);
    assert.equal(editor.dirty, true, action);
    assert.equal(editor.unchanged(pending), false, 'must not adopt server draft');
  }
});

test('a delayed reload/open/import/create/restore cannot replace edits made during the request', () => {
  const editor = new EditorSession();
  for (const action of ['reload', 'open', 'import', 'create', 'restoreRevision']) {
    editor.adopt('stack-one', 2);
    const pending = editor.capture();
    assert.equal(editor.unchanged(pending), true);
    editor.edit();
    assert.equal(editor.unchanged(pending), false, action);
  }
});

test('old selection and out-of-order responses cannot move the acknowledged revision backwards', () => {
  const editor = new EditorSession();
  editor.adopt('stack-one', 2);
  const old = editor.capture();
  editor.adopt('stack-two', 6);
  editor.edit();
  assert.equal(editor.acknowledge(old, 100, true), false);
  assert.equal(editor.revision, 6);
  assert.equal(editor.acknowledge(editor.capture(), 5, true), false);
  assert.equal(editor.dirty, true);
});

test('conflict, authentication failure and missing acknowledgements retain the last saved revision and dirty draft', () => {
  const editor = new EditorSession();
  editor.adopt('stack-one', 2);
  editor.edit();
  const pending = editor.capture();
  // No server acknowledgement is accepted on any failure path.
  assert.equal(editor.revision, 2);
  assert.equal(editor.dirty, true);
  assert.equal(editor.unchanged(pending), true);
  editor.adopt(undefined);
  assert.equal(editor.acknowledge(pending, 3, true), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {manageStacks} from '../src/lib/stacks-admin.mjs';

// The same real-SQLite shim the lifecycle test uses, so the route boundary is
// exercised against real UNIQUE/CHECK semantics rather than a stub.
import { sqliteD1 } from './helpers/stacks-sqlite.mjs';

const ORIGIN = 'https://composer.loftwah.com';
const admin = { id: 'user-owner-0001', name: 'Owner', email: 'owner@example.test', role: 50, createdAt: '' };
const visitor = { id: 'user-visitor-01', name: 'Visitor', email: 'visitor@example.test', role: 20, createdAt: '' };
const context = (user, input, { method = 'POST', origin = ORIGIN, emdash = '1', path = 'write' } = {}) => ({
  user,
  input,
  request: new Request(ORIGIN + '/_emdash/api/plugins/composer-stacks/' + path, { method, headers: { ...(origin ? { Origin: origin } : {}), ...(emdash ? { 'X-EmDash-Request': emdash } : {}) } }),
});
const runtime = db => ({ PUBLIC_ORIGIN: ORIGIN, DB: db });
const document = { version: 1, name: 'Loftwah front page', description: '', theme: 'midnight', instances: [{ id: 'aaaaaaaa-1111-2222-3333-444444444444', app: 'guestbook', label: 'Guestbook', caption: '', visible: true }] };

test('the stacks route refuses anyone the host did not authenticate as an administrator', async () => {
  const db = sqliteD1();
  try {
    for (const [name, ctx] of [
      ['no user', context(undefined, { action: 'list' })],
      ['non-admin user', context(visitor, { action: 'list' })],
    ]) {
      const result = await manageStacks(ctx, runtime(db));
      assert.equal(result.ok, false, name);
      assert.equal(result.code, 'FORBIDDEN', name);
    }
    // A machine token with no bound user, and a write from another origin.
    assert.equal((await manageStacks(context(admin, { action: 'list' }, { origin: 'https://evil.test' }), runtime(db))).code, 'FORBIDDEN');
    assert.equal((await manageStacks(context(admin, { action: 'create', name: 'x' }, { emdash: '' }), runtime(db))).code, 'FORBIDDEN');
    assert.equal((await manageStacks(context(admin, { action: 'list' }, {}), { PUBLIC_ORIGIN: 'https://app-composer-preview.loftwah.workers.dev', DB: db })).code, 'UNAVAILABLE');
    assert.equal((await manageStacks(context(admin, { action: 'not-a-thing' }, { method: 'GET', path: 'read' }), runtime(db))).code, 'INVALID');
  } finally {
    db.cleanup();
  }
});

test('an owner can run the whole stack lifecycle through the route', async () => {
  const db = sqliteD1();
  try {
    const env = runtime(db);
    const created = await manageStacks(context(admin, { action: 'create', name: 'Loftwah front page' }), env);
    assert.equal(created.ok, true);
    assert.equal(created.workspace.role, 'owner');
    assert.equal(created.stack.slug, 'loftwah-front-page');
    assert.equal(created.stack.revision, 1);

    const saved = await manageStacks(context(admin, { action: 'save', stack: created.stack.id, document, expectedRevision: 1 }), env);
    assert.equal(saved.ok, true);
    assert.equal(saved.stack.revision, 2);
    // A stale revision cannot overwrite the newer draft.
    assert.equal((await manageStacks(context(admin, { action: 'save', stack: created.stack.id, document, expectedRevision: 1 }), env)).code, 'CONFLICT');

    const published = await manageStacks(context(admin, { action: 'publish', stack: created.stack.id, expectedRevision: 2 }), env);
    assert.equal(published.stack.status, 'published');
    assert.equal(published.stack.publishedRevision, 2);

    const read = await manageStacks(context(admin, { action: 'open', stack: created.stack.id }, { method: 'GET', path: 'read' }), env);
    assert.equal(read.ok, true);
    const list = await manageStacks(context(admin, { action: 'list' }, { method: 'GET', path: 'read' }), env);
    assert.equal(list.stacks.length, 1);
    const exported = await manageStacks(context(admin, { action: 'export', stack: created.stack.id }, { method: 'GET', path: 'read' }), env);
    assert.equal(exported.stack.draft.instances[0].app, 'guestbook');

    const duplicated = await manageStacks(context(admin, { action: 'duplicate', stack: created.stack.id, expectedRevision: published.stack.revision }), env);
    assert.equal(duplicated.ok, true);
    const archived = await manageStacks(context(admin, { action: 'archive', stack: created.stack.id, expectedRevision: published.stack.revision }), env);
    assert.equal(archived.stack.status, 'archived');
    const deleted = await manageStacks(context(admin, { action: 'delete', stack: duplicated.stack.id, expectedRevision: duplicated.stack.revision }), env);
    assert.equal(deleted.ok, true);
    assert.equal(deleted.deleted.name, duplicated.stack.name);
  } finally {
    db.cleanup();
  }
});

test('a viewer membership is read-only and a foreign workspace id is refused', async () => {
  const db = sqliteD1();
  try {
    const env = runtime(db);
    const owner = await manageStacks(context(admin, { action: 'create', name: 'Owner stack' }), env);
    // A viewer membership for the same workspace, written as test data.
    await db.prepare('INSERT INTO creator_members (workspace_id, user_id, role) VALUES (?, ?, ?)').bind(owner.workspace.id, 'user-viewer-0003', 'viewer').run();
    const viewer = { ...visitor, id: 'user-viewer-0003', name: 'Viewer', role: 50 };
    const list = await manageStacks(context(viewer, { action: 'list' }, { method: 'GET', path: 'read' }), env);
    assert.equal(list.ok, true);
    assert.equal(list.workspace.role, 'viewer');
    // The workspace role, not the host role, decides what a signed-in creator may do.
    assert.equal((await manageStacks(context(viewer, { action: 'save', stack: owner.stack.id, document, expectedRevision: 1 }), env)).code, 'FORBIDDEN');
    assert.equal((await manageStacks(context(viewer, { action: 'publish', stack: owner.stack.id }), env)).code, 'FORBIDDEN');
    assert.equal((await manageStacks(context(viewer, { action: 'delete', stack: owner.stack.id }), env)).code, 'FORBIDDEN');
    // A viewer may read the workspace's stacks; that is the whole point of the role.
    assert.equal((await manageStacks(context(viewer, { action: 'open', stack: owner.stack.id }, { method: 'GET', path: 'read' }), env)).ok, true);
    // An unrelated admin cannot select the owner's workspace by id.
    assert.equal((await manageStacks(context({ ...admin, id: 'user-other-0004' }, { action: 'list', workspace: owner.workspace.id }, { method: 'GET', path: 'read' }), env)).code, 'FORBIDDEN');
  } finally {
    db.cleanup();
  }
});

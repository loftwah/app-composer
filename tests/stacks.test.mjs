import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  StackError, capabilityFor, requireCapability, normaliseStack, slugify,
  workspaceForUser, resolveWorkspace, listStacks, readStack, createStack,
  saveStack, publishStack, unpublishStack, setArchived, duplicateStack,
  deleteStack, publicStack,
} from '../src/lib/stacks.mjs';

// Real SQLite behind a D1-shaped shim: UNIQUE, CHECK and transaction semantics
// are the database's, not a mock's. The file persists across the calls of one
// test so a lifecycle can actually run.
const fixture = String.raw`import sqlite3,json,sys
p=json.load(sys.stdin)
db=sqlite3.connect(p['path'])
db.executescript(p['schema'])
db.row_factory=sqlite3.Row
try:
    cur=db.execute(p['sql'],p['params'])
    if p['mode']=='run':
        db.commit();print(json.dumps({'success':True,'meta':{'changes':cur.rowcount}}))
    elif p['mode']=='first':
        row=cur.fetchone();print(json.dumps({'row':dict(row) if row else None}))
    else:
        print(json.dumps({'rows':[dict(r) for r in cur.fetchall()]}))
except Exception as e:
    print(json.dumps({'error':str(e)}))
`;
function sqliteD1() {
  const dir = mkdtempSync(join(tmpdir(), 'composer-stacks-'));
  const path = join(dir, 'stacks.db');
  const schema = readFileSync(new URL('../migrations/0003_stacks.sql', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../migrations/0004_stack_publications.sql', import.meta.url), 'utf8');
  const call = (mode, sql, params) => {
    const output = execFileSync('python3', ['-c', fixture], { input: JSON.stringify({ path, schema, sql, params, mode }), encoding: 'utf8' });
    const data = JSON.parse(output);
    if (data.error) throw Error(data.error);
    return data;
  };
  return {
    path,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() { return call('first', sql, params).row ?? null; },
            async all() { return { results: call('all', sql, params).rows }; },
            async run() { return call('run', sql, params); },
          };
        },
      };
    },
  };
}

const alice = { id: 'user-alice-0001', name: 'Alice', role: 50 };
const bob = { id: 'user-bob-0002', name: 'Bob', role: 50 };
const sample = name => ({ version: 1, name, description: 'Two useful apps', theme: 'midnight', instances: [{ id: 'aaaaaaaa-1111-2222-3333-444444444444', app: 'guestbook', label: 'Guestbook', caption: '', visible: true }] });

test('stack documents refuse unknown apps, duplicate ids and unsupported values', () => {
  assert.throws(() => normaliseStack(sample('A').instances.push ? { ...sample('A'), instances: [{ id: 'aaaaaaaa-1111-2222-3333-444444444444', app: 'wordpress', label: 'No', caption: '', visible: true }] } : null), /reviewed app/);
  assert.throws(() => normaliseStack({ ...sample('A'), instances: [sample('A').instances[0], { ...sample('A').instances[0] }] }), /share an identifier/);
  assert.throws(() => normaliseStack({ ...sample('A'), version: 2 }), /version/);
  assert.throws(() => normaliseStack({ ...sample('A'), theme: 'neon' }), /theme/);
  assert.throws(() => normaliseStack({ ...sample('A'), name: '' }), /Name the stack/);
  assert.throws(() => normaliseStack({ ...sample('A'), description: 'x'.repeat(241) }), /under 240/);
  assert.throws(() => normaliseStack({ ...sample('A'), instances: Array.from({ length: 13 }, (_, i) => ({ ...sample('A').instances[0], id: 'instance-' + String(i).padStart(4, '0') })) }), /up to 12/);
  assert.throws(() => normaliseStack({ ...sample('A'), name: 'Bad\u0000name' }), /Name the stack/);
  assert.throws(() => slugify('   '), /letter or number/);
  assert.equal(slugify('Loftwah front page'), 'loftwah-front-page');
});

test('the capability matrix keeps viewers read-only and reserves deletion for owners', () => {
  assert.equal(capabilityFor('viewer', 'save'), false);
  assert.equal(capabilityFor('viewer', 'publish'), false);
  assert.equal(capabilityFor('viewer', 'read'), true);
  assert.equal(capabilityFor('editor', 'publish'), true);
  assert.equal(capabilityFor('editor', 'delete'), false);
  assert.equal(capabilityFor('owner', 'delete'), true);
  assert.throws(() => requireCapability('viewer', 'save'), error => error instanceof StackError && error.status === 403);
  assert.throws(() => requireCapability('editor', 'delete'), /cannot delete/);
});

test('two fictional creators keep independent workspaces, drafts and published revisions', async () => {
  const db = sqliteD1();
  try {
    const aliceSpace = await workspaceForUser(db, alice);
    const bobSpace = await workspaceForUser(db, bob);
    assert.notEqual(aliceSpace.id, bobSpace.id);
    assert.equal(aliceSpace.role, 'owner');
    // Bootstrap is idempotent: a second call reuses the same workspace.
    assert.equal((await workspaceForUser(db, alice)).id, aliceSpace.id);

    const front = await createStack(db, aliceSpace.id, 'Loftwah front page');
    const second = await createStack(db, aliceSpace.id, 'Second stack');
    assert.notEqual(front.id, second.id);
    assert.equal(front.status, 'draft');
    assert.equal(front.revision, 1);
    assert.equal(front.slug, 'loftwah-front-page');
    await assert.rejects(createStack(db, aliceSpace.id, 'Loftwah front page'), /share address/);

    const saved = await saveStack(db, aliceSpace.id, front.id, sample('Loftwah front page'), 1);
    assert.equal(saved.revision, 2);
    assert.equal(saved.draft.instances.length, 1);
    // A stale tab cannot overwrite newer work.
    await assert.rejects(saveStack(db, aliceSpace.id, front.id, sample('Overwritten'), 1), error => error.code === 'CONFLICT');

    const published = await publishStack(db, aliceSpace.id, front.id, saved.revision);
    assert.equal(published.status, 'published');
    assert.equal(published.publishedRevision, 2);
    const live = await publicStack(db, 'loftwah-front-page');
    assert.equal(live.document.instances[0].label, 'Guestbook');

    // Later edits stay private until an explicit publish.
    const edited = await saveStack(db, aliceSpace.id, front.id, { ...sample('Loftwah front page'), description: 'Changed later' }, published.revision);
    assert.equal((await publicStack(db, 'loftwah-front-page')).document.description, 'Two useful apps');
    const republished = await publishStack(db, aliceSpace.id, front.id, edited.revision);
    assert.equal((await publicStack(db, 'loftwah-front-page')).document.description, 'Changed later');
    assert.equal(republished.publishedRevision, 3);

    // Unpublish, archive and restore all keep the draft intact.
    await unpublishStack(db, aliceSpace.id, front.id);
    assert.equal(await publicStack(db, 'loftwah-front-page'), null);
    await setArchived(db, aliceSpace.id, front.id, true);
    await assert.rejects(saveStack(db, aliceSpace.id, front.id, sample('Loftwah front page'), 3), /Restore this stack/);
    const restored = await setArchived(db, aliceSpace.id, front.id, false);
    assert.equal(restored.status, 'draft');
    assert.equal(restored.draft.description, 'Changed later');

    // Duplication copies configuration with fresh instance identities.
    const copy = await duplicateStack(db, aliceSpace.id, front.id);
    assert.notEqual(copy.id, front.id);
    assert.notEqual(copy.draft.instances[0].id, edited.draft.instances[0].id);
    assert.equal(copy.draft.instances[0].app, 'guestbook');

    // Cross-workspace reads are refused, and the client-supplied id is only a
    // selector: Bob cannot resolve Alice's workspace at all.
    await assert.rejects(readStack(db, bobSpace.id, front.id), /not in this workspace/);
    await assert.rejects(resolveWorkspace(db, bob, aliceSpace.id), error => error.status === 403);
    assert.equal((await listStacks(db, bobSpace.id)).length, 0);

    await deleteStack(db, aliceSpace.id, second.id);
    assert.equal((await listStacks(db, aliceSpace.id)).length, 2);
  } finally {
    db.cleanup();
  }
});

test('the public address serves only an exact published slug', async () => {
  const db = sqliteD1();
  try {
    const space = await workspaceForUser(db, alice);
    const stack = await createStack(db, space.id, 'Public test');
    await saveStack(db, space.id, stack.id, sample('Public test'), stack.revision);
    assert.equal(await publicStack(db, 'public-test'), null, 'a draft is never public');
    await publishStack(db, space.id, stack.id, 2);
    assert.ok(await publicStack(db, 'public-test'));
    assert.equal(await publicStack(db, 'PUBLIC-TEST'), null, 'slugs are exact');
    assert.equal(await publicStack(db, '../public-test'), null);
    assert.equal(await publicStack(db, 'public-test-2'), null);
  } finally {
    db.cleanup();
  }
});

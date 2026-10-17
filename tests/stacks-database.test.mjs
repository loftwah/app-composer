import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workspaceForUser, createStack, saveStack, publishStack, publicStack,
  readStack, setArchived,
  unpublishStack, duplicateStack, deleteStack, republishRevision,
  restoreRevisionToDraft, listPublications, resolveWorkspace,
} from '../src/lib/stacks.mjs';
import { sqliteD1, migration } from './helpers/stacks-sqlite.mjs';

const user = { id: 'fictional-creator-0001', name: 'Fictional creator' };
const workspaceId = 'fictional-workspace-0001';
const sample = (name, description = 'Published text') => ({
  version: 1, name, description, theme: 'midnight',
  instances: [{ id: 'fictional-instance-0001', app: 'hello', label: 'Hello' }],
});
async function seededStack(db, name = 'Database example') {
  await db.prepare('INSERT INTO creator_workspaces (id, name) VALUES (?, ?)').bind(workspaceId, 'Fixture workspace').run();
  const stack = await createStack(db, workspaceId, name);
  return saveStack(db, workspaceId, stack.id, sample(name), stack.revision);
}

test('FK-enabled concurrent first visits converge without duplicate workspaces', async () => {
  const db = sqliteD1();
  try {
    assert.equal((await db.prepare('PRAGMA foreign_keys').first()).foreign_keys, 1);
    const [a, b] = await Promise.all([workspaceForUser(db, user), workspaceForUser(db, user)]);
    assert.equal(a.id, b.id);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_workspaces').first()).count, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_members').first()).count, 1);
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  } finally { db.cleanup(); }
});

test('a failed publication-history write preserves the previous public snapshot', async () => {
  const db = sqliteD1();
  try {
    const saved = await seededStack(db);
    const live = await publishStack(db, workspaceId, saved.id, saved.revision);
    const edited = await saveStack(db, workspaceId, saved.id, sample(saved.name, 'Private newer text'), live.revision);
    await db.prepare("CREATE TRIGGER fail_publication BEFORE INSERT ON creator_stack_publications BEGIN SELECT RAISE(ABORT, 'injected publication failure'); END").run();
    await assert.rejects(publishStack(db, workspaceId, saved.id, edited.revision), /injected publication failure/);
    assert.equal((await publicStack(db, saved.slug))?.description, 'Published text');
    assert.equal((await readStack(db, workspaceId, saved.id)).publishedRevision, live.publishedRevision);
  } finally { db.cleanup(); }
});

test('Restore refuses a published stack without changing visibility or revision', async () => {
  const db = sqliteD1();
  try {
    const saved = await seededStack(db);
    const live = await publishStack(db, workspaceId, saved.id, saved.revision);
    await assert.rejects(setArchived(db, workspaceId, saved.id, false, live.revision), error => error.code === 'CONFLICT');
    assert.deepEqual(await readStack(db, workspaceId, saved.id), live);
    assert.ok(await publicStack(db, saved.slug));
  } finally { db.cleanup(); }
});

test('the forward repair backfills a valid pre-0004 publication idempotently', async () => {
  const db = sqliteD1({ schema: migration('0003_stacks.sql') });
  try {
    const saved = await seededStack(db);
    await db.prepare("UPDATE creator_stacks SET status='published', published_revision=revision, published_json=draft_json, published_at='2026-10-17 12:00:00' WHERE id=?").bind(saved.id).run();
    db.migrate(migration('0004_stack_publications.sql'));
    assert.equal(await publicStack(db, saved.slug), null, '0004 omitted the publication');
    const repair = migration('0005_stack_publications_backfill.sql');
    db.migrate(repair);
    const first = await publicStack(db, saved.slug);
    assert.equal(first?.description, 'Published text');
    assert.equal(first.publishedAt, '2026-10-17 12:00:00');
    db.migrate(repair);
    assert.deepEqual(await publicStack(db, saved.slug), first);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_stack_publications').first()).count, 1);
  } finally { db.cleanup(); }
});

test('bootstrap rollback at each write leaves no orphan, and retry completes once', async () => {
  for (const table of ['creator_workspaces', 'creator_personal_workspaces', 'creator_members']) {
    const db = sqliteD1();
    try {
      db.migrate(`CREATE TRIGGER fail_bootstrap BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'interrupted bootstrap'); END;`);
      await assert.rejects(workspaceForUser(db, user), /interrupted bootstrap/);
      for (const name of ['creator_workspaces', 'creator_personal_workspaces', 'creator_members']) {
        assert.equal((await db.prepare(`SELECT COUNT(*) AS count FROM ${name}`).first()).count, 0);
      }
      db.migrate('DROP TRIGGER fail_bootstrap;');
      const workspace = await workspaceForUser(db, user);
      assert.equal((await workspaceForUser(db, user)).id, workspace.id);
      assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
    } finally { db.cleanup(); }
  }
});

test('retry completes an existing personal selection and preserves invited multi-workspace membership', async () => {
  const db = sqliteD1();
  try {
    await db.prepare('INSERT INTO creator_workspaces (id, name) VALUES (?, ?)').bind(workspaceId, 'Partially created').run();
    await db.prepare('INSERT INTO creator_personal_workspaces (user_id, workspace_id) VALUES (?, ?)').bind(user.id, workspaceId).run();
    assert.equal((await workspaceForUser(db, user)).id, workspaceId);
    await db.prepare('INSERT INTO creator_workspaces (id, name) VALUES (?, ?)').bind('invited-workspace-0002', 'Invited').run();
    await db.prepare('INSERT INTO creator_members (workspace_id, user_id, role) VALUES (?, ?, ?)').bind('invited-workspace-0002', user.id, 'editor').run();
    assert.equal((await resolveWorkspace(db, user, 'invited-workspace-0002')).role, 'editor');
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_members WHERE user_id=?').bind(user.id).first()).count, 2);
    const invitedUser = { id: 'invited-user-0003', name: 'Invited only' };
    await db.prepare('INSERT INTO creator_members (workspace_id, user_id, role) VALUES (?, ?, ?)').bind('invited-workspace-0002', invitedUser.id, 'viewer').run();
    assert.equal((await workspaceForUser(db, invitedUser)).role, 'viewer');
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_workspaces').first()).count, 2);
  } finally { db.cleanup(); }
});

test('an invitation that lands during first-visit bootstrap avoids an extra personal workspace', async () => {
  let invited = false;
  const db = sqliteD1({ interleave: async sql => {
    if (!invited && sql.includes('INSERT OR IGNORE INTO creator_workspaces')) {
      invited = true;
      await db.prepare('INSERT INTO creator_workspaces (id, name) VALUES (?, ?)').bind(workspaceId, 'Invitation won').run();
      await db.prepare('INSERT INTO creator_members (workspace_id, user_id, role) VALUES (?, ?, ?)').bind(workspaceId, user.id, 'editor').run();
    }
  } });
  try {
    assert.equal((await workspaceForUser(db, user)).role, 'editor');
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_workspaces').first()).count, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_personal_workspaces').first()).count, 0);
  } finally { db.cleanup(); }
});

test('public readers see the previous publication during both transactional writes', async () => {
  const db = sqliteD1();
  try {
    const saved = await seededStack(db);
    const first = await publishStack(db, workspaceId, saved.id, saved.revision);
    const edited = await saveStack(db, workspaceId, saved.id, sample(saved.name, 'Next public text'), first.revision);
    db.observe = {
      sql: "SELECT p.revision, p.document_json FROM creator_stacks s JOIN creator_stack_publications p ON p.stack_id=s.id AND p.revision=s.published_revision WHERE s.id=? AND s.status='published'",
      params: [saved.id],
    };
    const published = await publishStack(db, workspaceId, saved.id, edited.revision);
    assert.equal(db.observations.length, 2);
    for (const rows of db.observations) {
      assert.equal(rows.length, 1, 'the public view never disappears');
      assert.equal(rows[0].revision, first.publishedRevision);
      assert.equal(JSON.parse(rows[0].document_json).description, 'Published text');
    }
    assert.equal((await publicStack(db, saved.slug)).description, 'Next public text');
    assert.equal(published.revision, edited.revision + 1);
    assert.equal(published.publishedRevision, edited.revision);
  } finally { db.cleanup(); }
});

test('activation failure rolls back the newly inserted history and permits a clean retry', async () => {
  const db = sqliteD1();
  try {
    const saved = await seededStack(db);
    const first = await publishStack(db, workspaceId, saved.id, saved.revision);
    const edited = await saveStack(db, workspaceId, saved.id, sample(saved.name, 'Next public text'), first.revision);
    db.migrate("CREATE TRIGGER fail_activation BEFORE UPDATE OF published_revision ON creator_stacks BEGIN SELECT RAISE(ABORT, 'activation failed'); END;");
    await assert.rejects(publishStack(db, workspaceId, saved.id, edited.revision), /activation failed/);
    assert.deepEqual(await readStack(db, workspaceId, saved.id), edited);
    assert.equal((await listPublications(db, workspaceId, saved.id)).length, 1, 'failed activation creates no history');
    assert.equal((await publicStack(db, saved.slug)).revision, first.publishedRevision);
    db.migrate('DROP TRIGGER fail_activation;');
    const retried = await publishStack(db, workspaceId, saved.id, edited.revision);
    assert.equal(retried.publishedRevision, edited.revision);
    await assert.rejects(publishStack(db, workspaceId, saved.id, edited.revision), error => error.code === 'CONFLICT');
    assert.equal((await listPublications(db, workspaceId, saved.id)).length, 2);
  } finally { db.cleanup(); }
});

test('an existing publication identity is reused only for the exact same snapshot', async () => {
  const db = sqliteD1();
  try {
    const saved = await seededStack(db);
    await db.prepare('INSERT INTO creator_stack_publications (stack_id, revision, document_json) VALUES (?, ?, ?)')
      .bind(saved.id, saved.revision, JSON.stringify(sample('Different historical bytes'))).run();
    await assert.rejects(publishStack(db, workspaceId, saved.id, saved.revision), error => error.code === 'CONFLICT');
    assert.deepEqual(await readStack(db, workspaceId, saved.id), saved);
    assert.equal(await publicStack(db, saved.slug), null);
    assert.equal((await listPublications(db, workspaceId, saved.id))[0].document.name, 'Different historical bytes');
  } finally { db.cleanup(); }
});

test('lost publication acknowledgement reconciles by revision without duplicating history', async () => {
  let loseAcknowledgement = true;
  const db = sqliteD1({ afterBatch: async statements => {
    if (loseAcknowledgement && statements.some(({ sql }) => sql.includes('INSERT OR IGNORE INTO creator_stack_publications'))) {
      loseAcknowledgement = false;
      throw Error('acknowledgement unavailable');
    }
  } });
  try {
    const saved = await seededStack(db);
    await assert.rejects(publishStack(db, workspaceId, saved.id, saved.revision), /acknowledgement unavailable/);
    const reconciled = await readStack(db, workspaceId, saved.id);
    assert.equal(reconciled.publishedRevision, saved.revision);
    assert.equal(reconciled.revision, saved.revision + 1);
    await assert.rejects(publishStack(db, workspaceId, saved.id, saved.revision), error => error.code === 'CONFLICT');
    assert.equal((await listPublications(db, workspaceId, saved.id)).length, 1);
    assert.equal((await publicStack(db, saved.slug)).revision, saved.revision);
  } finally { db.cleanup(); }
});

test('every lifecycle mutation advances the concurrency token and rejects stale or missing guards', async () => {
  const db = sqliteD1();
  try {
    let current = await seededStack(db);
    const stale = current.revision;
    const firstPublication = stale;
    for (const action of [
      s => publishStack(db, workspaceId, s.id, s.revision),
      s => unpublishStack(db, workspaceId, s.id, s.revision),
      s => setArchived(db, workspaceId, s.id, true, s.revision),
      s => setArchived(db, workspaceId, s.id, false, s.revision),
      s => republishRevision(db, workspaceId, s.id, firstPublication, s.revision),
      s => restoreRevisionToDraft(db, workspaceId, s.id, firstPublication, s.revision),
    ]) {
      const next = await action(current);
      assert.equal(next.revision, current.revision + 1);
      current = next;
    }
    const guarded = [
      revision => saveStack(db, workspaceId, current.id, sample(current.name), revision),
      revision => publishStack(db, workspaceId, current.id, revision),
      revision => unpublishStack(db, workspaceId, current.id, revision),
      revision => setArchived(db, workspaceId, current.id, true, revision),
      revision => duplicateStack(db, workspaceId, current.id, revision),
      revision => deleteStack(db, workspaceId, current.id, revision),
      revision => republishRevision(db, workspaceId, current.id, firstPublication, revision),
      revision => restoreRevisionToDraft(db, workspaceId, current.id, firstPublication, revision),
    ];
    for (const action of guarded) {
      await assert.rejects(action(stale), error => error.code === 'CONFLICT');
      for (const guard of [undefined, null, '2', 0, -1, NaN]) {
        await assert.rejects(action(guard), error => error.code === 'INVALID');
      }
    }
    assert.deepEqual(await readStack(db, workspaceId, current.id), current);
  } finally { db.cleanup(); }
});

test('archived stacks cannot be published, unpublished, republished or restored into a draft revision', async () => {
  const db = sqliteD1();
  try {
    const saved = await seededStack(db);
    const published = await publishStack(db, workspaceId, saved.id, saved.revision);
    const archived = await setArchived(db, workspaceId, saved.id, true, published.revision);
    const actions = [
      publishStack(db, workspaceId, saved.id, archived.revision),
      unpublishStack(db, workspaceId, saved.id, archived.revision),
      republishRevision(db, workspaceId, saved.id, saved.revision, archived.revision),
      restoreRevisionToDraft(db, workspaceId, saved.id, saved.revision, archived.revision),
      setArchived(db, workspaceId, saved.id, true, archived.revision),
    ];
    for (const action of actions) await assert.rejects(action, error => error.code === 'CONFLICT');
    assert.deepEqual(await readStack(db, workspaceId, saved.id), archived);
    assert.equal(await publicStack(db, saved.slug), null);
    const restored = await setArchived(db, workspaceId, saved.id, false, archived.revision);
    assert.equal(restored.status, 'draft');
    assert.equal(await publicStack(db, saved.slug), null);
    await assert.rejects(setArchived(db, workspaceId, saved.id, false, restored.revision), error => error.code === 'CONFLICT');
  } finally { db.cleanup(); }
});

test('a competing archive defeats pending save, publish, duplicate and delete without losing data', async () => {
  for (const kind of ['save', 'publish', 'duplicate', 'delete', 'unpublish', 'republish', 'restoreRevision']) {
    let race = false;
    let armed = false;
    let current;
    const db = sqliteD1({ interleave: async sql => {
      const mutation = /^(UPDATE creator_stacks|DELETE FROM creator_stacks|INSERT INTO creator_stacks|INSERT OR IGNORE INTO creator_stack_publications)/.test(sql);
      if (armed && !race && mutation) {
        race = true;
        await setArchived(db, workspaceId, current.id, true, current.revision);
      }
    } });
    try {
      const saved = await seededStack(db);
      current = await publishStack(db, workspaceId, saved.id, saved.revision);
      const actions = {
        save: () => saveStack(db, workspaceId, current.id, sample(current.name, 'Losing edits'), current.revision),
        publish: () => publishStack(db, workspaceId, current.id, current.revision),
        duplicate: () => duplicateStack(db, workspaceId, current.id, current.revision),
        delete: () => deleteStack(db, workspaceId, current.id, current.revision),
        unpublish: () => unpublishStack(db, workspaceId, current.id, current.revision),
        republish: () => republishRevision(db, workspaceId, current.id, saved.revision, current.revision),
        restoreRevision: () => restoreRevisionToDraft(db, workspaceId, current.id, saved.revision, current.revision),
      };
      armed = true;
      await assert.rejects(actions[kind](), error => error.code === 'CONFLICT', kind);
      const after = await readStack(db, workspaceId, current.id);
      assert.equal(after.status, 'archived');
      assert.equal(after.revision, current.revision + 1);
      assert.deepEqual(after.draft, current.draft);
      assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_stacks').first()).count, 1);
      assert.equal((await listPublications(db, workspaceId, current.id)).length, 1);
    } finally { db.cleanup(); }
  }
});

test('a newer publish defeats pending unpublish, archive and delete even though status stays published', async () => {
  for (const kind of ['unpublish', 'archive', 'delete']) {
    let armed = false;
    let current;
    const db = sqliteD1({ interleave: async sql => {
      if (armed && /^(UPDATE creator_stacks|DELETE FROM creator_stacks)/.test(sql)) {
        armed = false;
        await publishStack(db, workspaceId, current.id, current.revision);
      }
    } });
    try {
      const saved = await seededStack(db);
      const first = await publishStack(db, workspaceId, saved.id, saved.revision);
      current = await saveStack(db, workspaceId, saved.id, sample(saved.name, 'Winning publication'), first.revision);
      const actions = {
        unpublish: () => unpublishStack(db, workspaceId, current.id, current.revision),
        archive: () => setArchived(db, workspaceId, current.id, true, current.revision),
        delete: () => deleteStack(db, workspaceId, current.id, current.revision),
      };
      armed = true;
      await assert.rejects(actions[kind](), error => error.code === 'CONFLICT');
      const after = await readStack(db, workspaceId, current.id);
      assert.equal(after.status, 'published');
      assert.equal(after.revision, current.revision + 1);
      assert.equal((await publicStack(db, current.slug)).description, 'Winning publication');
    } finally { db.cleanup(); }
  }
});

test('forward repair preserves draft/archive state and existing history, skipping unusable snapshots', async () => {
  const db = sqliteD1({ schema: migration('0003_stacks.sql') });
  try {
    const first = await seededStack(db, 'Legacy public');
    const entries = [
      ['Legacy draft', 'draft', JSON.stringify(sample('Public draft history'))],
      ['Legacy archive', 'archived', JSON.stringify(sample('Public archive history'))],
      ['Invalid JSON', 'published', '{invalid'],
      ['Invalid shape', 'published', JSON.stringify({ name: 'Missing version and instances' })],
      ['No publication', 'draft', null],
    ];
    await db.prepare("UPDATE creator_stacks SET status='published', published_revision=revision, published_json=draft_json, published_at='2026-10-17 12:00:00' WHERE id=?").bind(first.id).run();
    for (const [name, status, document] of entries) {
      const stack = await createStack(db, workspaceId, name);
      await db.prepare('UPDATE creator_stacks SET status=?, published_json=?, published_revision=? WHERE id=?').bind(status, document, document ? 1 : null, stack.id).run();
    }
    db.migrate(migration('0004_stack_publications.sql'));
    const existingDocument = JSON.stringify(sample('Already recorded publication'));
    await db.prepare('INSERT INTO creator_stack_publications (stack_id, revision, document_json, published_at) VALUES (?, ?, ?, ?)').bind(first.id, first.revision, existingDocument, '2026-10-16 12:00:00').run();
    const before = (await db.prepare('SELECT * FROM creator_stacks ORDER BY id').all()).results;
    db.migrate(migration('0005_stack_publications_backfill.sql'));
    db.migrate(migration('0005_stack_publications_backfill.sql'));
    assert.deepEqual((await db.prepare('SELECT * FROM creator_stacks ORDER BY id').all()).results, before);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_stack_publications').first()).count, 3);
    assert.equal((await publicStack(db, first.slug)).name, 'Already recorded publication');
    assert.equal((await publicStack(db, first.slug)).publishedAt, '2026-10-16 12:00:00');
    for (const [name] of entries) assert.equal(await publicStack(db, name.toLowerCase().replaceAll(' ', '-')), null);
    const removed = await deleteStack(db, workspaceId, first.id, first.revision);
    assert.equal(removed.removedPublications, true);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM creator_stack_publications WHERE stack_id=?').bind(first.id).first()).count, 0, 'FK cascade removes only this stack history');
    assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, []);
  } finally { db.cleanup(); }
});

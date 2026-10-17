// A portable export is only useful if importing it is bounded, validated and
// honest about what it does not contain. These tests run the real SQLite shim so
// the round trip exercises the same constraints the deployed instance does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseStack, workspaceForUser, createStack, saveStack, listStacks, listPublications,
  exportStack, describeImport, importStack,
} from '../src/lib/stacks.mjs';

import { sqliteD1 } from './helpers/stacks-sqlite.mjs';

const alice = { id: 'user-alice-0001', name: 'Alice', role: 50 };
const bob = { id: 'user-bob-0002', name: 'Bob', role: 50 };
const app = id => ({ id: `${id}-instance-0001`, app: id, label: `${id} instance`, caption: '', visible: true, binding: { mode: 'own', shareOf: null }, config: {} });
const document = (instances, name = 'Round trip') => ({ version: 1, name, description: '', theme: 'midnight', instances });

test('an exported stack round-trips into a new draft and states its exact scope', async () => {
  const db = sqliteD1();
  try {
    const space = await workspaceForUser(db, alice);
    const created = await createStack(db, space.id, 'Round trip');
    const base = app('guestbook');
    const shared = { ...app('guestbook'), id: 'guestbook-instance-0002', binding: { mode: 'shared', shareOf: base.id } };
    const saved = await saveStack(db, space.id, created.id, document([
      { ...base, config: { title: 'Trail notes', guestAccess: 'postcards' } },
      shared,
      { ...app('showcase'), config: { handle: 'trailkeeper' } },
    ], 'Round trip'), created.revision);

    const exported = exportStack(saved);
    assert.equal(exported.format, 'app-composer.stack/v1');
    assert.equal(exported.covers.publicationHistory, false);
    assert.equal(exported.covers.appRecords, false);
    assert.equal(exported.covers.credentials, false);
    assert.equal(exported.configuration.length, 3);
    assert.equal(exported.covers.credentials, false);
    // No field carries credential material; the only "credential" in the file is
    // the statement that none is included.
    assert.equal(/"(token|secret|apiKey|bearer|authorization)"/i.test(JSON.stringify(exported)), false);

    // A second creator imports it: a new draft in their own workspace, never a
    // publication, and never a copy of anything the app owns.
    const bobSpace = await workspaceForUser(db, bob);
    const imported = await importStack(db, bobSpace.id, exported);
    assert.equal(imported.status, 'draft');
    assert.equal(imported.publishedRevision, null);
    const guestbook = imported.draft.instances.find(instance => instance.config.title === 'Trail notes');
    assert.equal(guestbook.config.guestAccess, 'postcards');
    const reuse = imported.draft.instances.find(instance => instance.binding.mode === 'shared');
    assert.equal(reuse.binding.shareOf, guestbook.id, 'the reuse relationship survives and points inside the copy');
    assert.equal((await listPublications(db, bobSpace.id, imported.id)).length, 0, 'importing invents no publication history');

    // Re-importing the same file is allowed and gets its own share address.
    const again = await importStack(db, bobSpace.id, exported);
    assert.notEqual(again.slug, imported.slug);
    assert.equal(again.status, 'draft');

    // A renamed import keeps its purpose but not its old address.
    const renamed = await importStack(db, bobSpace.id, exported, { name: 'Restored trail notes' });
    assert.equal(renamed.name, 'Restored trail notes');

    const summary = describeImport(exported);
    assert.equal(summary.instances, 3);
    assert.equal(summary.shared, 1);
    assert.deepEqual(summary.apps.sort(), ['Here / there', 'Linkarooie']);
  } finally {
    db.cleanup();
  }
});

test('a tampered or foreign import file is refused before anything is written', async () => {
  const db = sqliteD1();
  try {
    const space = await workspaceForUser(db, alice);
    const base = app('guestbook');
    const good = exportStack({ slug: 'x', revision: 1, draft: normaliseStack(document([base])) });
    assert.throws(() => describeImport({ ...good, format: 'app-composer.stack/v9' }), /not exported by App Composer/);
    assert.throws(() => describeImport(null), /Choose an exported stack file/);
    // An undeclared setting cannot be smuggled in through an import.
    const tampered = JSON.parse(JSON.stringify(good));
    tampered.document.instances[0].config = { adminToken: 'nope' };
    await assert.rejects(importStack(db, space.id, tampered), error => error.code === 'INVALID');
    // A reuse pointing at nothing is refused rather than creating a broken draft.
    const orphan = JSON.parse(JSON.stringify(good));
    orphan.document.instances = [
      { ...base, binding: { mode: 'shared', shareOf: 'guestbook-instance-9999' } },
    ];
    await assert.rejects(importStack(db, space.id, orphan), /reuse another instance/);
    assert.equal((await listStacks(db, space.id)).length, 0, 'nothing was written by a refused import');
  } finally {
    db.cleanup();
  }
});

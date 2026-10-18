import test from 'node:test';
import assert from 'node:assert/strict';
import { appSettings } from '../src/lib/app-settings.mjs';
import {
  workspaceForUser, saveStack, readStack, publicStack, duplicateStack,
  exportStack, importStack, setArchived,
} from '../src/lib/stacks.mjs';
import {
  applyStackResources, reconcileStackResources, reuseStackResource,
  listStackResources, resourcePublication,
} from '../src/lib/stack-resources.ts';

import { fixture, saved, user, instance, document } from './helpers/resource-fixture.mjs';

test('two stacks and two same-app instances receive distinct app-owned resources and immutable publication references', async () => {
  const f = fixture();
  try {
    const workspace = await workspaceForUser(f.db, user);
    const a = await saved(f, workspace.id, 'Fictional trail', [instance('trail-instance-0001', 'Trail guestbook'), instance('trail-instance-0002', 'Second independent guestbook')]);
    const b = await saved(f, workspace.id, 'Fictional launch', [instance('launch-instance-0001', 'Launch guestbook')]);
    const appliedA = await applyStackResources(f.db, user.id, workspace.id, a.id, a.revision, f.runtime);
    const appliedB = await applyStackResources(f.db, user.id, workspace.id, b.id, b.revision, f.runtime);
    assert.equal(appliedA.outcome, 'applied'); assert.equal(appliedB.outcome, 'applied');
    assert.equal(new Set([...appliedA.resources, ...appliedB.resources].map(row => row.resource)).size, 3);
    assert.ok(appliedA.stack.revision > a.revision);
    const repeated = await applyStackResources(f.db, user.id, workspace.id, a.id, appliedA.stack.revision, f.runtime);
    assert.equal(repeated.outcome, 'unchanged'); assert.equal(repeated.stack.revision, appliedA.stack.revision);
    const published = await f.route({ action: 'publish', workspace: workspace.id, stack: a.id, expectedRevision: repeated.stack.revision });
    assert.equal(published.ok, true, JSON.stringify(published));
    const page = await publicStack(f.db, a.slug);
    assert.equal(page.document.instances[0].resource.id, appliedA.resources[0].resource);
    assert.equal(page.document.instances[0].resource.configurationRevision, 1);
    assert.match(page.document.instances[0].resource.path, /^\/guestbook\/r\/[a-z0-9-]+\/c\/1\/$/);
    const edited = await saveStack(f.db, workspace.id, a.id, document(a.name, [instance('trail-instance-0001', 'PRIVATE NEW TITLE'), instance('trail-instance-0002', 'Second independent guestbook')]), published.stack.revision);
    const blocked = await f.route({ action: 'publish', workspace: workspace.id, stack: a.id, expectedRevision: edited.revision });
    assert.equal(blocked.code, 'CONFLICT');
    assert.equal(JSON.stringify(await publicStack(f.db, a.slug)).includes('PRIVATE NEW TITLE'), false);
    assert.equal((await listStackResources(f.db, workspace.id, b.id))[0].configuration.values.title, 'Launch guestbook');
    assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { f.close(); }
});

test('explicit reuse inherits app-confirmed settings and never applies local overrides to the shared resource', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user);
    const a = await saved(f, space.id, 'Owner stack', [instance('owner-instance-0001', 'Owned title')]);
    const applied = await applyStackResources(f.db, user.id, space.id, a.id, a.revision, f.runtime);
    const b = await saved(f, space.id, 'Shared stack', [instance('shared-instance-0001', 'MUST NOT OVERWRITE')]);
    const before = f.app.writes.length;
    const reused = await reuseStackResource(f.db, user.id, space.id, b.id, b.revision, 'shared-instance-0001', applied.resources[0].resource, f.runtime);
    assert.equal(reused.resources[0].shared, true);
    assert.equal(reused.resources[0].configuration.values.title, 'Owned title');
    assert.equal(reused.stack.draft.instances[0].config.title, 'Owned title', 'future duplicate/export inherits the actual shared configuration');
    const repeated = await applyStackResources(f.db, user.id, space.id, b.id, reused.stack.revision, f.runtime);
    assert.equal(repeated.outcome, 'unchanged'); assert.equal(f.app.writes.length, before);
    const publicDocument = await resourcePublication(f.db, space.id, b.id, repeated.stack.draft);
    assert.equal(publicDocument.instances[0].config.title, 'Owned title'); assert.equal(publicDocument.instances[0].resource.shared, true);
    const foreign = await workspaceForUser(f.db, { id: 'foreign-creator-0002', name: 'Fictional other' });
    const other = await saved(f, foreign.id, 'Other workspace', [instance('foreign-instance-0001', 'Foreign')]);
    await assert.rejects(reuseStackResource(f.db, 'foreign-creator-0002', foreign.id, other.id, other.revision, 'foreign-instance-0001', applied.resources[0].resource, f.runtime), error => error.code === 'FORBIDDEN');
  } finally { f.close(); }
});

test('duplicate and import allocate fresh resources and instance identities while preserving configuration only', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user);
    const a = await saved(f, space.id, 'Original scope', [instance('original-instance-0001', 'Configuration to copy')]);
    const applied = await applyStackResources(f.db, user.id, space.id, a.id, a.revision, f.runtime);
    const copy = await duplicateStack(f.db, space.id, a.id, applied.stack.revision);
    const portable = exportStack(applied.stack);
    portable.document.instances[0].resource = { id: applied.resources[0].resource, configurationRevision: 1, path: 'https://foreign.example.test/' };
    const imported = await importStack(f.db, space.id, portable, { name: 'Imported scope' });
    assert.equal(imported.draft.instances[0].resource, undefined, 'imported public references are data, never resource authority');
    assert.notEqual(copy.draft.instances[0].id, a.draft.instances[0].id);
    assert.notEqual(imported.draft.instances[0].id, a.draft.instances[0].id);
    assert.deepEqual(await listStackResources(f.db, space.id, copy.id), []);
    const copiedApply = await applyStackResources(f.db, user.id, space.id, copy.id, copy.revision, f.runtime);
    const importedApply = await applyStackResources(f.db, user.id, space.id, imported.id, imported.revision, f.runtime);
    assert.equal(new Set([applied.resources[0].resource, copiedApply.resources[0].resource, importedApply.resources[0].resource]).size, 3);
    assert.equal(importedApply.resources[0].configuration.values.title, 'Configuration to copy');
  } finally { f.close(); }
});

test('unknown remote acknowledgement is journalled, reconciled and never allocates a duplicate resource', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user), stack = await saved(f, space.id, 'Unknown acknowledgement', [instance('unknown-instance-0001', 'Keep this')]);
    let once = false;
    f.app.afterWrite(({ command }) => { if (!once && command.action === 'activate') { once = true; throw Error('response lost after activation'); } });
    const result = await applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime);
    assert.equal(result.outcome, 'unknown'); assert.equal(result.resources[0].state, 'unknown');
    assert.equal(f.app.resources.size, 1);
    const attempts = f.app.writes.length;
    f.app.afterWrite(null);
    const reconciled = await reconcileStackResources(f.db, user.id, space.id, stack.id, result.stack.revision, f.runtime);
    assert.equal(reconciled.outcome, 'applied'); assert.equal(reconciled.resources[0].state, 'ready');
    assert.equal(f.app.writes.length, attempts, 'reconciliation reads do not replay a write');
    const repeated = await applyStackResources(f.db, user.id, space.id, stack.id, reconciled.stack.revision, f.runtime);
    assert.equal(repeated.outcome, 'unchanged'); assert.equal(f.app.resources.size, 1);
  } finally { f.close(); }
});

test('source verification refuses the actual apply path and malformed acknowledgements remain unknown', async () => {
  for (const failure of ['source', 'acknowledgement']) {
    const f = fixture();
    try {
      const space = await workspaceForUser(f.db, user), stack = await saved(f, space.id, 'Refuse ' + failure, [instance('refuse-instance-0001', 'Safe')]);
      if (failure === 'source') f.app.badBuild(true); else f.app.malformed(true);
      const result = await applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime);
      assert.equal(result.outcome, failure === 'source' ? 'refused' : 'unknown');
      if (failure === 'source') assert.equal(f.app.writes.length, 0);
      assert.equal(await publicStack(f.db, stack.slug), null);
    } finally { f.close(); }
  }
});

test('a save during a remote operation defeats the final mapping CAS and keeps the exact new draft', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user), stack = await saved(f, space.id, 'Concurrent save', [instance('race-instance-0001', 'Old intent')]);
    let raced = false;
    f.app.afterWrite(async ({ command }) => {
      if (!raced && command.action === 'activate') {
        raced = true;
        const current = await readStack(f.db, space.id, stack.id);
        await saveStack(f.db, space.id, stack.id, document(stack.name, [instance('race-instance-0001', 'New authored work')]), current.revision);
      }
    });
    await assert.rejects(applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime), error => error.code === 'CONFLICT');
    const current = await readStack(f.db, space.id, stack.id);
    assert.equal(current.draft.instances[0].config.title, 'New authored work');
    const pending = f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_resource_operations WHERE state='pending'").get().n;
    assert.equal(pending, 1, 'the unknown acknowledgement remains available for reconciliation');
    f.app.afterWrite(null);
    const reconciled = await reconcileStackResources(f.db, user.id, space.id, stack.id, current.revision, f.runtime);
    assert.equal(reconciled.resources[0].configuration.values.title, 'Old intent');
    assert.equal(reconciled.stack.draft.instances[0].config.title, 'New authored work');
    await assert.rejects(resourcePublication(f.db, space.id, stack.id, reconciled.stack.draft), error => error.code === 'CONFLICT');
  } finally { f.close(); }
});

test('an archive winning the reservation CAS leaves no orphaned local or remote resource', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user), stack = await saved(f, space.id, 'Concurrent archive', [instance('archive-instance-0001', 'Preserved')]);
    let raced = false;
    f.beforeBatch(async statements => {
      if (!raced && statements.some(({ sql }) => sql.includes('INSERT INTO creator_app_resources'))) {
        raced = true;
        await setArchived(f.db, space.id, stack.id, true, stack.revision);
      }
    });
    await assert.rejects(applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime), error => error.code === 'CONFLICT');
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM creator_app_resources').get().n, 0);
    assert.equal(f.app.resources.size, 0);
  } finally { f.close(); }
});

test('an unknown creation is reconciled before the same identity is retried on the next explicit apply', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user), stack = await saved(f, space.id, 'Interrupted creation', [instance('creation-instance-0001', 'Retain identity')]);
    const fetch = f.app.fetch;
    let interrupted = false;
    f.app.fetch = request => {
      if (!interrupted && request.method === 'POST') { interrupted = true; throw Error('connection interrupted before app receipt'); }
      return fetch(request);
    };
    const unknown = await applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime);
    assert.equal(unknown.outcome, 'unknown'); assert.equal(f.app.resources.size, 0);
    const operation = f.sqlite.prepare("SELECT id,resource_id FROM creator_resource_operations WHERE state='unknown'").get();
    const reconciled = await reconcileStackResources(f.db, user.id, space.id, stack.id, unknown.stack.revision, f.runtime);
    assert.equal(reconciled.outcome, 'unknown'); assert.equal(f.app.writes.length, 0);
    const retry = await applyStackResources(f.db, user.id, space.id, stack.id, reconciled.stack.revision, f.runtime);
    assert.equal(retry.outcome, 'applied'); assert.equal(retry.resources[0].resource, operation.resource_id);
    assert.equal(f.app.writes[0].command.operationId, operation.id);
    assert.equal(f.app.resources.size, 1);
  } finally { f.close(); }
});

test('partial apply preserves the previous publication and records the precise unknown resource', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user);
    const initial = await saved(f, space.id, 'Partial example', [instance('partial-instance-0001', 'Original A'), instance('partial-instance-0002', 'Original B')]);
    const first = await applyStackResources(f.db, user.id, space.id, initial.id, initial.revision, f.runtime);
    const published = await f.route({ action: 'publish', workspace: space.id, stack: initial.id, expectedRevision: first.stack.revision });
    const previous = await publicStack(f.db, initial.slug);
    const secondId = first.resources.find(row => row.instance === 'partial-instance-0002').resource;
    const edited = await saveStack(f.db, space.id, initial.id, document(initial.name, [instance('partial-instance-0001', 'New A'), instance('partial-instance-0002', 'New B')]), published.stack.revision);
    f.app.afterWrite(({ id, command }) => { if (id === secondId && command.action === 'activate') throw Error('second acknowledgement lost'); });
    const partial = await applyStackResources(f.db, user.id, space.id, initial.id, edited.revision, f.runtime);
    assert.equal(partial.outcome, 'partial'); assert.deepEqual(partial.completed, ['partial-instance-0001']);
    assert.equal(partial.problems[0].instance, 'partial-instance-0002'); assert.equal(partial.problems[0].outcome, 'unknown');
    assert.deepEqual(await publicStack(f.db, initial.slug), previous);
    assert.equal(partial.stack.draft.instances[1].config.title, 'New B');
  } finally { f.close(); }
});

test('account/environment drift and viewer authority refuse apply before app writes', async () => {
  for (const failure of ['account', 'environment', 'viewer']) {
    const f = fixture();
    try {
      const space = await workspaceForUser(f.db, user), stack = await saved(f, space.id, 'Guard ' + failure, [instance('guarded-instance-0001', 'Preserved')]);
      if (failure === 'account') f.runtime.RESOURCE_ACCOUNT_ID = 'other-account';
      if (failure === 'environment') f.runtime.RESOURCE_ENVIRONMENT = 'preview';
      if (failure === 'viewer') {
        await f.db.prepare("UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?").bind(space.id, user.id).run();
        await assert.rejects(applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime), error => error.code === 'FORBIDDEN');
      } else assert.equal((await applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime)).outcome, 'refused');
      assert.equal(f.app.writes.length, 0);
    } finally { f.close(); }
  }
});

test('explicit reconciliation refreshes app-owned version changes without replacing the draft or publication', async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, user);
    const initial = await saved(f, space.id, 'App-owned moderation', [instance('moderation-instance-0001', 'Published title')]);
    const applied = await applyStackResources(f.db, user.id, space.id, initial.id, initial.revision, f.runtime);
    const published = await f.route({ action: 'publish', workspace: space.id, stack: initial.id, expectedRevision: applied.stack.revision });
    const previous = await publicStack(f.db, initial.slug);
    const edited = await saveStack(f.db, space.id, initial.id, document(initial.name, [instance('moderation-instance-0001', 'Keep authored changes')]), published.stack.revision);
    const actual = f.app.resources.get(applied.resources[0].resource);
    actual.version++; // An app-owned moderation/control write legitimately advances its version.
    const refused = await applyStackResources(f.db, user.id, space.id, initial.id, edited.revision, f.runtime);
    assert.equal(refused.outcome, 'refused'); assert.equal(refused.resources[0].version, 2);
    assert.equal(f.app.writes.at(-1).command.expectedVersion, 2);
    const attempts = f.app.writes.length;
    const beforeJSON = f.sqlite.prepare('SELECT draft_json,published_json FROM creator_stacks WHERE id=?').get(initial.id);
    const reconciled = await reconcileStackResources(f.db, user.id, space.id, initial.id, refused.stack.revision, f.runtime);
    assert.equal(reconciled.outcome, 'applied'); assert.equal(reconciled.resources[0].version, 3);
    assert.equal(reconciled.resources[0].configuration.values.title, 'Published title');
    assert.ok(reconciled.stack.revision > refused.stack.revision);
    assert.deepEqual(reconciled.stack.draft, edited.draft);
    assert.deepEqual(await publicStack(f.db, initial.slug), previous);
    assert.deepEqual(f.sqlite.prepare('SELECT draft_json,published_json FROM creator_stacks WHERE id=?').get(initial.id), beforeJSON);
    assert.equal(f.app.writes.length, attempts, 'explicit reconciliation only reads app state');
    const repeated = await reconcileStackResources(f.db, user.id, space.id, initial.id, reconciled.stack.revision, f.runtime);
    assert.equal(repeated.outcome, 'unchanged'); assert.equal(repeated.stack.revision, reconciled.stack.revision);
    const retry = await applyStackResources(f.db, user.id, space.id, initial.id, repeated.stack.revision, f.runtime);
    assert.equal(retry.outcome, 'applied'); assert.equal(f.app.writes[attempts].command.expectedVersion, 3);
    assert.equal(retry.resources[0].configuration.values.title, 'Keep authored changes');
    assert.deepEqual(await publicStack(f.db, initial.slug), previous);
    assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { f.close(); }
});

for (const action of ['stage', 'activate']) {
  test(`historical ${action} acknowledgement reconciles after a verified source upgrade without replaying the old request`, async () => {
    const f = fixture(), originalSource = appSettings.guestbook.source.commit;
    try {
      const space = await workspaceForUser(f.db, user);
      const stack = await saved(f, space.id, 'Upgrade ' + action, [instance('upgrade-instance-0001', 'Preserve upgrade intent')]);
      f.app.afterWrite(({ command }) => { if (command.action === action) throw Error('committed acknowledgement lost'); });
      const unknown = await applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime);
      assert.equal(unknown.outcome, 'unknown');
      const pending = f.sqlite.prepare("SELECT * FROM creator_resource_operations WHERE state='unknown'").get();
      assert.equal(pending.action, action); assert.equal(pending.source_revision, originalSource);
      const receipt = f.app.operations.get(pending.id), attempts = f.app.writes.length;
      const upgradedSource = originalSource === 'a'.repeat(40) ? 'c'.repeat(40) : 'a'.repeat(40);
      appSettings.guestbook.source.commit = upgradedSource; f.app.source(upgradedSource); f.app.afterWrite(null);
      // A current verified connection cannot replay an unconfirmed old-source operation.
      f.app.operations.delete(pending.id);
      const missing = await applyStackResources(f.db, user.id, space.id, stack.id, unknown.stack.revision, f.runtime);
      assert.equal(missing.outcome, 'unknown'); assert.equal(f.app.writes.length, attempts);
      // A receipt falsely attributed to today's pin cannot settle yesterday's operation.
      f.app.operations.set(pending.id, { ...receipt, configuration: { ...receipt.configuration, source: upgradedSource } });
      const incompatible = await reconcileStackResources(f.db, user.id, space.id, stack.id, missing.stack.revision, f.runtime);
      assert.equal(incompatible.outcome, 'unknown'); assert.equal(f.app.writes.length, attempts);
      f.app.operations.set(pending.id, receipt);
      const reconciled = await reconcileStackResources(f.db, user.id, space.id, stack.id, incompatible.stack.revision, f.runtime);
      assert.equal(reconciled.outcome, 'applied'); assert.equal(f.app.writes.length, attempts);
      assert.equal(f.sqlite.prepare('SELECT state FROM creator_resource_operations WHERE id=?').get(pending.id).state, 'confirmed');
      assert.deepEqual(reconciled.stack.draft, stack.draft);
      assert.equal(await publicStack(f.db, stack.slug), null);
      if (action === 'activate') assert.equal(reconciled.resources[0].configuration.source, originalSource);
      const applied = await applyStackResources(f.db, user.id, space.id, stack.id, reconciled.stack.revision, f.runtime);
      assert.equal(applied.outcome, 'applied'); assert.equal(applied.resources[0].configuration.source, upgradedSource);
      assert.deepEqual(f.app.writes.slice(attempts).map(write => write.command.action), ['stage', 'activate']);
      assert.notEqual(f.app.writes[attempts].command.operationId, pending.id);
    } finally { appSettings.guestbook.source.commit = originalSource; f.close(); }
  });
}

test('resource status refresh verifies the current source and scope and loses to a concurrent draft save', async () => {
  for (const failure of ['source', 'scope', 'save']) {
    const f = fixture();
    try {
      const space = await workspaceForUser(f.db, user);
      const stack = await saved(f, space.id, 'Refresh guard ' + failure, [instance('refresh-instance-0001', 'Original title')]);
      const applied = await applyStackResources(f.db, user.id, space.id, stack.id, stack.revision, f.runtime);
      const published = await f.route({ action: 'publish', workspace: space.id, stack: stack.id, expectedRevision: applied.stack.revision });
      const previous = await publicStack(f.db, stack.slug), attempts = f.app.writes.length;
      f.app.resources.get(applied.resources[0].resource).version++;
      if (failure === 'source') f.app.badBuild(true);
      else {
        const fetch = f.app.fetch;
        f.app.fetch = async request => {
          const response = await fetch(request), url = new URL(request.url);
          if (request.method !== 'GET' || !url.pathname.includes('/api/resources/') || url.search) return response;
          if (failure === 'scope') {
            const reply = await response.json(); reply.resource.workspace = 'foreign-workspace-0001';
            return Response.json(reply);
          }
          await saveStack(f.db, space.id, stack.id, document(stack.name, [instance('refresh-instance-0001', 'Saved during refresh')]), published.stack.revision);
          return response;
        };
      }
      const reconcile = () => reconcileStackResources(f.db, user.id, space.id, stack.id, published.stack.revision, f.runtime);
      if (failure === 'save') await assert.rejects(reconcile(), error => error.code === 'CONFLICT');
      else {
        const result = await reconcile();
        assert.equal(result.outcome, 'unknown'); assert.equal(result.stack.revision, published.stack.revision);
      }
      assert.equal((await listStackResources(f.db, space.id, stack.id))[0].version, 2);
      assert.equal(f.app.writes.length, attempts);
      assert.deepEqual(await publicStack(f.db, stack.slug), previous);
      if (failure === 'save') assert.equal((await readStack(f.db, space.id, stack.id)).draft.instances[0].config.title, 'Saved during refresh');
    } finally { f.close(); }
  }
});

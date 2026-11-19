import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  deletePrivateBenchmarkSuite,
  getPrivateBenchmarkSuite,
  listPrivateBenchmarkSuiteProjects,
  listPrivateBenchmarkSuites,
  savePrivateBenchmarkSuite,
} from '../src/lib/benchmark-private-suites.ts';
import { validateBenchmarkSuite } from '../src/lib/benchmark-suite.mjs';

const project = 'e0779b31-d1a4-442f-963b-a21318aa33d4';
const other = 'd3cb8670-ec5c-451f-8dab-d21b1567f81a';
const scope = { workspaceId: 'fictional-one', projectId: project, ownerId: 'importing-owner' };
const suite = JSON.parse(readFileSync(new URL('../benchmarks/suites/flow-01.json', import.meta.url), 'utf8'));
const definition = { ...suite, id: 'PRIVATE-FLOW-01' };

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const file of ['0003_stacks.sql', '0043_private_benchmark_suites.sql']) {
    sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  }
  sqlite.exec(`
    INSERT INTO creator_workspaces(id,name) VALUES ('fictional-one','Fictional one'), ('fictional-two','Fictional two');
    INSERT INTO creator_members(workspace_id,user_id,role) VALUES
      ('fictional-one','importing-owner','owner'), ('fictional-one','co-owner','owner'),
      ('fictional-one','contributor','editor'), ('fictional-two','importing-owner','owner');
    INSERT INTO creator_stacks(id,workspace_id,slug,name,draft_json) VALUES
      ('${project}','fictional-one','fictional-one','One','{}'), ('${other}','fictional-two','fictional-two','Two','{}');
  `);
  const statement = (sql, args = []) => ({
    bind: (...params) => statement(sql, params),
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
  });
  return { db: { prepare: statement }, sqlite };
}

test('a saved suite keeps its full native shape and a repeat never replaces it', async t => {
  const { db } = fixture(t);
  const saved = await savePrivateBenchmarkSuite(db, scope, definition);
  assert.equal(saved.sha256, createHash('sha256').update(JSON.stringify(definition)).digest('hex'));
  assert.deepEqual(await savePrivateBenchmarkSuite(db, scope, definition), saved);
  assert.equal(await savePrivateBenchmarkSuite(db, scope, { ...definition, name: 'Other settings' }), null);
  assert.deepEqual(await listPrivateBenchmarkSuites(db, scope), [saved]);
  const reopened = await getPrivateBenchmarkSuite(db, scope, saved.id);
  assert.deepEqual(reopened.definition, definition);
  assert.ok(validateBenchmarkSuite(reopened.definition).ok);
});

test('project membership, importing actor and archive status guard every scoped access', async t => {
  const { db, sqlite } = fixture(t);
  const saved = await savePrivateBenchmarkSuite(db, scope, definition);
  assert.deepEqual(await listPrivateBenchmarkSuiteProjects(db, scope.ownerId, scope.workspaceId), [{ id: project, name: 'One' }]);
  for (const wrong of [
    { ...scope, ownerId: 'co-owner' },
    { ...scope, ownerId: 'contributor' },
    { ...scope, projectId: other },
    { ...scope, workspaceId: 'fictional-two' },
  ]) {
    assert.deepEqual(await listPrivateBenchmarkSuites(db, wrong), []);
    assert.equal(await getPrivateBenchmarkSuite(db, wrong, saved.id), null);
    assert.equal(await deletePrivateBenchmarkSuite(db, wrong, saved.id), false);
  }
  assert.equal(await savePrivateBenchmarkSuite(db, { ...scope, ownerId: 'contributor' }, definition), null);
  sqlite.prepare("UPDATE creator_stacks SET status = 'archived' WHERE id = ?").run(project);
  assert.deepEqual(await listPrivateBenchmarkSuiteProjects(db, scope.ownerId, scope.workspaceId), []);
  assert.equal(await getPrivateBenchmarkSuite(db, scope, saved.id), null);
  assert.equal(await savePrivateBenchmarkSuite(db, scope, definition), null);
  sqlite.prepare("UPDATE creator_stacks SET status = 'draft' WHERE id = ?").run(project);
  sqlite.prepare("UPDATE creator_members SET role = 'viewer' WHERE user_id = ? AND workspace_id = ?").run(scope.ownerId, scope.workspaceId);
  assert.equal(await getPrivateBenchmarkSuite(db, scope, saved.id), null);
  assert.equal(await deletePrivateBenchmarkSuite(db, scope, saved.id), false);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM private_benchmark_suites').get().n, 1);
});

test('twenty suites can be kept, retries deduplicate, and exact deletion allows another', async t => {
  const { db } = fixture(t);
  const first = await savePrivateBenchmarkSuite(db, scope, definition);
  for (let i = 1; i < 20; i++)
    assert.ok(await savePrivateBenchmarkSuite(db, scope, { ...definition, id: 'FIXTURE-' + i }));
  const newSuite = { ...definition, id: 'FIXTURE-20' };
  assert.equal(await savePrivateBenchmarkSuite(db, scope, newSuite), null);
  assert.deepEqual(await savePrivateBenchmarkSuite(db, scope, definition), first);
  assert.equal(await deletePrivateBenchmarkSuite(db, scope, first.id), true);
  assert.ok(await savePrivateBenchmarkSuite(db, scope, newSuite));
});

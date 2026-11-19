import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  deletePrivateBenchmarkRun,
  getPrivateBenchmarkRun,
  isPrivateBenchmarkOwner,
  listPrivateBenchmarkRuns,
  listPrivateBenchmarkWorkspaces,
  savePrivateBenchmarkRun,
} from "../src/lib/benchmark-private-runs.ts";

const workspace = "fictional-private-space";
const otherWorkspace = "fictional-other-space";
const owner = "fictional-owner";
const coOwner = "fictional-co-owner";
const editor = "fictional-editor";

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const file of ["0003_stacks.sql", "0008_workspace_access.sql", "0042_private_benchmark_runs.sql"]) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  }
  for (const id of [workspace, otherWorkspace]) {
    sqlite.prepare("INSERT INTO creator_workspaces(id, name) VALUES (?, ?)").run(id, id);
  }
  for (const [space, actor, role] of [
    [workspace, owner, "owner"], [workspace, coOwner, "owner"], [workspace, editor, "editor"],
    [otherWorkspace, editor, "owner"],
  ]) {
    sqlite.prepare("INSERT INTO creator_members(workspace_id, user_id, role) VALUES (?, ?, ?)").run(space, actor, role);
  }
  const statement = (sql, args = []) => ({
    bind: (...params) => statement(sql, params),
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
  });
  return { db: { prepare: statement }, sqlite };
}

function report(n = 0) {
  return {
    source: "a".repeat(40),
    generatedAt: "2026-11-19T00:00:00.000Z",
    suites: [{
      id: "fictional-suite", name: "Fictional suite",
      checks: [{ id: "one", name: "One", status: "pass", detail: `Case ${n}` }],
    }],
    pack: { id: "fictional-pack" },
  };
}

test("explicit imports re-open the canonical native report and retain the original identity", async t => {
  const { db } = fixture(t);
  const source = report();
  const saved = await savePrivateBenchmarkRun(db, owner, workspace, { ...source, totals: { checks: 99 } });
  assert.match(saved.id, /^[a-f0-9-]{36}$/);
  assert.match(saved.sha256, /^[a-f0-9]{64}$/);
  assert.equal(saved.checks, 1);
  assert.equal(saved.packId, source.pack.id);
  assert.deepEqual(await savePrivateBenchmarkRun(db, owner, workspace, source), saved);
  assert.deepEqual(await listPrivateBenchmarkRuns(db, owner, workspace), [saved]);
  assert.deepEqual(await getPrivateBenchmarkRun(db, owner, workspace, saved.id), {
    ...saved, report: source, verification: "owner-imported",
  });
});

test("membership and importing actor must match on every scoped operation", async t => {
  const { db, sqlite } = fixture(t);
  const run = await savePrivateBenchmarkRun(db, owner, workspace, report());
  assert.deepEqual(await listPrivateBenchmarkWorkspaces(db, editor), [{ id: otherWorkspace, name: otherWorkspace }]);
  for (const [actor, space] of [[coOwner, workspace], [editor, workspace], [owner, otherWorkspace]]) {
    assert.deepEqual(await listPrivateBenchmarkRuns(db, actor, space), []);
    assert.equal(await getPrivateBenchmarkRun(db, actor, space, run.id), null);
    assert.equal(await deletePrivateBenchmarkRun(db, actor, space, run.id), false);
  }
  assert.equal(await savePrivateBenchmarkRun(db, editor, workspace, report()), null);
  sqlite.prepare("UPDATE creator_members SET role = 'editor' WHERE workspace_id = ? AND user_id = ?").run(workspace, owner);
  assert.equal(await isPrivateBenchmarkOwner(db, owner, workspace), false);
  assert.equal(await getPrivateBenchmarkRun(db, owner, workspace, run.id), null);
  assert.equal(await deletePrivateBenchmarkRun(db, owner, workspace, run.id), false);
  assert.equal(await savePrivateBenchmarkRun(db, owner, workspace, report(1)), null);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM private_benchmark_runs").get().n, 1);
});

test("a full history preserves previous results and still deduplicates a retry", async t => {
  const { db } = fixture(t);
  const first = await savePrivateBenchmarkRun(db, owner, workspace, report());
  for (let n = 1; n < 20; n++) assert.ok(await savePrivateBenchmarkRun(db, owner, workspace, report(n)));
  assert.equal(await savePrivateBenchmarkRun(db, owner, workspace, report(20)), null);
  assert.deepEqual(await savePrivateBenchmarkRun(db, owner, workspace, report()), first);
  assert.equal((await listPrivateBenchmarkRuns(db, owner, workspace)).length, 20);
  assert.equal(await deletePrivateBenchmarkRun(db, owner, workspace, first.id), true);
  assert.equal(await getPrivateBenchmarkRun(db, owner, workspace, first.id), null);
  assert.ok(await savePrivateBenchmarkRun(db, owner, workspace, report(20)));
});

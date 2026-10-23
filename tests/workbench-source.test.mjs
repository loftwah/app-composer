import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
test("workbench refuses stale adapter bytes and composition pins without evaluating source", (t) => {
  const owned = mkdtempSync(join(tmpdir(), "composer-workbench-source-test-"));
  t.after(() => rmSync(owned, { recursive: true, force: true }));
  const manifest = JSON.parse(
    readFileSync("src/vendor/workbench/sources.json", "utf8"),
  );
  for (const path of [
    "scripts/workbench-source.mjs",
    "composition.lock.json",
    "src/vendor/workbench/sources.json",
    ...manifest.apps.map((app) => app.copy),
  ]) {
    const target = join(owned, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(path, target);
  }
  const run = () =>
    spawnSync(process.execPath, ["scripts/workbench-source.mjs", "--check"], {
      cwd: owned,
      encoding: "utf8",
    });
  assert.equal(run().status, 0);
  const first = join(owned, manifest.apps[0].copy),
    bytes = readFileSync(first);
  writeFileSync(
    first,
    'throw new Error("must never execute adapter during validation")',
  );
  assert.notEqual(run().status, 0);
  assert.match(run().stderr, /differs from its exact pinned source/);
  writeFileSync(first, bytes);
  const lockPath = join(owned, "composition.lock.json"),
    lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.apps[0].commit = "a".repeat(40);
  writeFileSync(lockPath, JSON.stringify(lock));
  assert.notEqual(run().status, 0);
  assert.match(run().stderr, /differs from its exact pinned source/);
});

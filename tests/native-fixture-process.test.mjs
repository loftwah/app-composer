import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { ownedNativeDevPid } from "../scripts/lib/native-fixture-process.mjs";

test("an inherited Astro daemon lock cannot select the source checkout process", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-fixture-process-"));
  const children = [];
  t.after(() => {
    for (const child of children) child.kill("SIGKILL");
    rmSync(root, { recursive: true, force: true });
  });
  const source = join(root, "source"),
    copy = join(root, "copy");
  for (const app of [source, copy])
    mkdirSync(join(app, ".astro"), { recursive: true });
  const child = spawn(
    process.execPath,
    ["-e", 'process.stdout.write("ready\\n");setInterval(()=>{},1000)'],
    { cwd: source, stdio: ["ignore", "pipe", "ignore"] },
  );
  children.push(child);
  await once(child.stdout, "data");
  const lock = JSON.stringify({ pid: child.pid, port: 4321 });
  for (const app of [source, copy])
    writeFileSync(join(app, ".astro/dev.json"), lock);
  assert.equal(ownedNativeDevPid(source), child.pid);
  assert.equal(ownedNativeDevPid(copy), null);
  assert.doesNotThrow(
    () => process.kill(child.pid, 0),
    "Read-only guard leaves the source process alive",
  );
  writeFileSync(join(copy, ".astro/dev.json"), JSON.stringify({ pid: -1 }));
  assert.equal(ownedNativeDevPid(copy), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(
  new URL("fixtures/owned-run-child.mjs", import.meta.url),
);

const waitFor = async (predicate, timeoutMs = 5000) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs)
      throw new Error("Timed out waiting for the controlled fixture.");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

async function runFixture(mode, { signalAfterReady = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "composer-owned-test-"));
  const readyFile = join(root, "ready.json");
  const reportFile = join(root, "report.json");
  const child = spawn(process.execPath, [fixture, mode], {
    env: {
      ...process.env,
      OWNED_READY_FILE: readyFile,
      OWNED_REPORT_FILE: reportFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  if (signalAfterReady) {
    await waitFor(() => existsSync(readyFile));
    child.kill("SIGTERM");
  }
  const [code, signal] = await once(child, "exit");
  return {
    code,
    signal,
    stdout,
    stderr,
    root,
    ready: existsSync(readyFile)
      ? JSON.parse(readFileSync(readyFile, "utf8"))
      : null,
    report: existsSync(reportFile)
      ? JSON.parse(readFileSync(reportFile, "utf8"))
      : null,
  };
}

test("owned runs release success, failure, timeout and cancellation without touching unrelated work", async () => {
  const unrelatedRoot = mkdtempSync(join(tmpdir(), "composer-unrelated-"));
  const unrelatedFile = join(unrelatedRoot, "keep.txt");
  writeFileSync(unrelatedFile, "another task's live resource\n");
  const unrelated = spawn(process.execPath, ["-e", "setTimeout(()=>{}, 60000)"], {
    detached: true,
    stdio: "ignore",
  });
  unrelated.unref();
  try {
    for (const [mode, expected] of [
      ["success", { code: 0, reason: "complete" }],
      ["failure", { code: 1, reason: "failure" }],
      ["timeout", { code: 2, reason: "timeout" }],
      ["signal", { code: 143, reason: "signal" }],
    ]) {
      const result = await runFixture(mode, {
        signalAfterReady: mode === "signal",
      });
      assert.equal(result.code, expected.code, result.stderr || result.stdout);
      assert.ok(result.ready, `${mode}: fixture must report its owned resources`);
      assert.ok(result.report, `${mode}: fixture must leave a bounded report`);
      assert.equal(result.report.status, "clean", `${mode}: ${result.stderr}`);
      assert.equal(result.report.reason, expected.reason);
      assert.deepEqual(result.report.failures, []);
      assert.ok(
        result.report.resources.every((resource) => resource.state === "released"),
        `${mode}: every owned resource must be released`,
      );
      assert.equal(existsSync(result.ready.directory), false);
      await waitFor(() => !alive(result.ready.pid));
      assert.equal(existsSync(unrelatedRoot), true);
      assert.equal(readFileSync(unrelatedFile, "utf8"), "another task's live resource\n");
      assert.equal(alive(unrelated.pid), true);
      rmSync(result.root, { recursive: true, force: true });
    }
  } finally {
    try {
      process.kill(unrelated.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    rmSync(unrelatedRoot, { recursive: true, force: true });
  }
});

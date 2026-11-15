// The runner's own proof: a pass is a pass, a fail is a fail, and a suite that
// throws or hangs is blocked without crashing the run. Fixtures live in a
// temporary root that this file owns and removes.
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { discoverSuites, runBenchmarks, totalsFor } from "../benchmarks/runner.mjs";

const exec = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(repoRoot, "benchmarks", "runner.mjs");

const PASSING = {
  id: "fixture-pass",
  name: "Fixture pass",
  checks: [{ id: "fixture-pass-1", name: "One", status: "pass", detail: "held" }],
};
const FAILING = {
  id: "fixture-fail",
  name: "Fixture fail",
  checks: [
    { id: "fixture-fail-1", name: "One", status: "pass", detail: "held" },
    { id: "fixture-fail-2", name: "Two", status: "fail", detail: "did not hold" },
  ],
};

/** @param {import("node:test").TestContext} t */
async function tempRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "benchmarks-601-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

/**
 * Write one fixture suite and return its directory.
 * @param {string} root
 * @param {string} fileName
 * @param {string} source
 */
async function writeSuite(root, fileName, source) {
  const directory = path.join(root, "suites");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), source, "utf8");
  return directory;
}

function suiteSource(suite) {
  return `export const id = ${JSON.stringify(suite.id)};
export const name = ${JSON.stringify(suite.name)};
export function run() {
  return ${JSON.stringify(suite.checks)};
}
`;
}

/** @param {string[]} args */
async function runCli(args) {
  try {
    const { stdout } = await exec(process.execPath, [runnerPath, ...args], {
      cwd: repoRoot,
      timeout: 20000,
    });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

test("a passing suite exits 0 with pass totals and writes nothing", async (t) => {
  const root = await tempRoot(t);
  const suites = await writeSuite(root, "pass.mjs", suiteSource(PASSING));
  const out = path.join(root, "results", "latest.json");

  const result = await runCli(["--suites", suites, "--out", out]);

  assert.equal(result.code, 0);
  const json = JSON.parse(result.stdout);
  assert.deepEqual(json.totals, { pass: 1, fail: 0, blocked: 0, checks: 1 });
  assert.equal(json.suites[0].status, "pass");
  await assert.rejects(readFile(out, "utf8"), { code: "ENOENT" });
});

test("a failing check exits 1 and is counted", async (t) => {
  const root = await tempRoot(t);
  const suites = await writeSuite(root, "fail.mjs", suiteSource(FAILING));

  const result = await runCli(["--suites", suites]);

  assert.equal(result.code, 1);
  const json = JSON.parse(result.stdout);
  assert.deepEqual(json.totals, { pass: 1, fail: 1, blocked: 0, checks: 2 });
  assert.equal(json.suites[0].status, "fail");
  assert.equal(json.suites[0].checks[1].detail, "did not hold");
});

test("a thrown suite becomes blocked and still exits 0", async (t) => {
  const root = await tempRoot(t);
  const suites = await writeSuite(
    root,
    "throws.mjs",
    `export const id = "fixture-throw";
export const name = "Fixture throw";
export function run() {
  throw new Error("fixture exploded");
}
`,
  );

  const result = await runCli(["--suites", suites]);

  assert.equal(result.code, 0);
  const json = JSON.parse(result.stdout);
  assert.deepEqual(json.totals, { pass: 0, fail: 0, blocked: 1, checks: 1 });
  assert.equal(json.suites[0].status, "blocked");
  assert.match(json.suites[0].checks[0].detail, /fixture exploded/);
});

test("a hung suite is blocked at the timeout instead of hanging the run", async () => {
  const [suite] = await runBenchmarks({
    suites: [{ id: "slow", name: "Slow", run: () => new Promise(() => {}) }],
    timeoutMs: 25,
  });

  assert.equal(suite.status, "blocked");
  assert.match(suite.checks[0].detail, /Timed out after 25ms/);
  assert.deepEqual(totalsFor([suite]), { pass: 0, fail: 0, blocked: 1, checks: 1 });
});

test("discovery runs the real suites in order and skips helpers", async () => {
  const suites = await discoverSuites();

  assert.deepEqual(
    suites.map((suite) => suite.id),
    ["appearance-skin", "blueprint-roundtrip", "live-demo", "sandbox-save-reopen"],
  );
  assert.ok(suites.every((suite) => typeof suite.run === "function"));
});

test("--write records source, generatedAt, totals and suites", async (t) => {
  const root = await tempRoot(t);
  const suites = await writeSuite(root, "pass.mjs", suiteSource(PASSING));
  const out = path.join(root, "results", "latest.json");

  const result = await runCli(["--write", "--suites", suites, "--out", out]);

  assert.equal(result.code, 0);
  const written = JSON.parse(await readFile(out, "utf8"));
  assert.match(written.source, /^([0-9a-f]{40}|unknown)$/);
  assert.ok(!Number.isNaN(Date.parse(written.generatedAt)));
  assert.equal(written.node, process.version);
  assert.match(written.platform, /^\S+ \S+$/);
  assert.deepEqual(written.totals, { pass: 1, fail: 0, blocked: 0, checks: 1 });
  assert.equal(written.suites[0].id, "fixture-pass");
  assert.equal(written.suites[0].checks[0].id, "fixture-pass-1");
  assert.deepEqual(JSON.parse(result.stdout), written);
});

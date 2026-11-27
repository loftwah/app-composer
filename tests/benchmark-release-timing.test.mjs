// Benchmarks Studio: the receipt importer's own proof. Fixtures are public-safe
// release-timing/v1 receipts with the real Composer and Studio shapes; every
// temporary path this file creates is removed at the end.
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  buildReport,
  ingestReceipts,
  loadPack,
  loadReceiptDirectory,
  main,
  parsePack,
  validateReceipt,
} from "../benchmarks/release-timing/report.mjs";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(root, "benchmarks", "release-timing", "fixtures");
const examplePack = path.join(root, "benchmarks", "release-timing", "example-pack.json");
const reportCli = path.join(root, "benchmarks", "release-timing", "report.mjs");
const COVERAGE =
  "measured from before the first required final qualification to exact live identity";

function fixture(name) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"));
}

function rawFixtures() {
  return readdirSync(fixturesDir)
    .filter((name) => /^receipt-.*\.json$/.test(name))
    .sort()
    .map((name) => fixture(name));
}

function validReceipt({
  sha = "a".repeat(40),
  liveRevision = sha,
  totalMs = 60000,
  ...overrides
} = {}) {
  return {
    schema: "release-timing/v1",
    version: 1,
    repo: "loftwah/example",
    project: "example",
    sha,
    runId: "run-11111111-1111-4111-8111-111111111111",
    kind: "worker-production",
    releasePath: "scripts/deploy.mjs",
    targetMs: 180000,
    limitMs: 300000,
    startedAt: "2026-11-16T00:00:00.000Z",
    endedAt: "2026-11-16T00:01:00.000Z",
    totalMs,
    unmeasuredMs: 0,
    stages: [{ name: "required checks", durationMs: totalMs }],
    status: "passed",
    failure: null,
    notes: { liveRevision, coverage: COVERAGE },
    alert: { state: "none", issue: null, fingerprint: null },
    coverage: COVERAGE,
    ...overrides,
  };
}

test("Composer and Studio fixtures keep genuinely different measured durations", () => {
  const entries = loadReceiptDirectory(fixturesDir);
  assert.equal(entries.length, 5);
  const composer = entries.find(
    (entry) => entry.repo === "loftwah/app-composer" && entry.status === "passed",
  );
  const studio = entries.find((entry) => entry.repo === "loftwah/composer-media-studio");
  assert.equal(composer.totalMs, 92500);
  assert.equal(studio.totalMs, 27035);
  assert.equal(composer.slowestStage.name, "required checks (pnpm check)");
  assert.equal(studio.slowestStage.name, "Worker upload");
  assert.equal(composer.coveragePct, 93.3);
  assert.equal(studio.coveragePct, 99.99);
});

test("directory reports finished receipts and discloses unfinished runs", (ctx) => {
  const dir = mkdtempSync(path.join(tmpdir(), "composer-timing-report-"));
  ctx.after(() => rmSync(dir, { recursive: true, force: true }));
  const pending = path.join(dir, "receipt-running.json");
  writeFileSync(pending, JSON.stringify(validReceipt({ status: "running", endedAt: null })));
  assert.throws(() => loadReceiptDirectory(dir), /no finished receipts/);
  assert.throws(() => loadPack(pending), /unsupported status "running"/);
  writeFileSync(path.join(dir, "receipt-verified.json"), JSON.stringify(validReceipt({
    runId: "finished-11111111-1111-4111-8111-111111111111",
  })));
  const stdout = [];
  const stderr = [];
  assert.equal(main(["--dir", dir, "--json"], {
    log: line => stdout.push(line), error: line => stderr.push(line),
  }), 0);
  assert.equal(JSON.parse(stdout[0]).runs, 1);
  assert.deepEqual(stderr, ["release-timing report: skipped 1 unfinished receipt"]);
});

test("the strict 300,000 ms boundary is enforced on the receipt status", () => {
  const passing = validReceipt({ totalMs: 299999, status: "passed" });
  assert.equal(ingestReceipts([passing])[0].status, "passed");

  const breach = validReceipt({ totalMs: 300000, status: "over-budget" });
  assert.equal(ingestReceipts([breach])[0].status, "over-budget");

  const later = validReceipt({ totalMs: 300001, status: "over-budget" });
  assert.equal(ingestReceipts([later])[0].status, "over-budget");

  const forgedGreen = validReceipt({ totalMs: 300000, status: "passed" });
  assert.throws(
    () => ingestReceipts([forgedGreen]),
    /status "passed" does not match the measured total \(300000ms is over-budget\)/,
  );
});

test("a repeated run id is refused instead of counted twice", () => {
  const first = validReceipt();
  const second = validReceipt({ sha: "b".repeat(40) });
  assert.throws(() => ingestReceipts([first, second]), /duplicate run id/);
});

test("forged and missing live revisions are refused", () => {
  const forged = validReceipt({ liveRevision: "b".repeat(40) });
  assert.throws(() => ingestReceipts([forged]), /live revision does not match the source SHA/);

  const forgedTopLevel = validReceipt({ liveRevision: "c".repeat(40) });
  forgedTopLevel.liveRevision = "c".repeat(40);
  assert.throws(() => ingestReceipts([forgedTopLevel]), /live revision does not match/);

  const unchecked = validReceipt({ liveRevision: null });
  assert.throws(
    () => ingestReceipts([unchecked]),
    /does not record the verified live revision/,
  );
});

test("missing, extra and unknown fields are refused", () => {
  const missingTotal = validReceipt();
  delete missingTotal.totalMs;
  assert.throws(() => ingestReceipts([missingTotal]), /total is invalid/);

  const missingStageTotal = validReceipt();
  delete missingStageTotal.stages[0].durationMs;
  assert.throws(() => ingestReceipts([missingStageTotal]), /durationMs is invalid/);

  const missingCoverage = validReceipt();
  delete missingCoverage.coverage;
  delete missingCoverage.notes.coverage;
  assert.throws(() => ingestReceipts([missingCoverage]), /missing field "coverage"/);

  const emptyCoverage = validReceipt({ coverage: " " });
  emptyCoverage.notes.coverage = " ";
  assert.throws(() => ingestReceipts([emptyCoverage]), /coverage is invalid/);

  const extra = validReceipt({ costMicro: 12 });
  assert.throws(() => ingestReceipts([extra]), /unknown field "costMicro"/);

  const wrongVersion = validReceipt({ version: 2 });
  assert.throws(() => ingestReceipts([wrongVersion]), /version must be 1/);

  const wrongSchema = validReceipt({ schema: "release-timing/v2" });
  assert.throws(() => ingestReceipts([wrongSchema]), /schema mismatch/);

  const running = validReceipt({ status: "running" });
  assert.throws(() => ingestReceipts([running]), /unsupported status "running"/);

  const forgedLimit = validReceipt({ limitMs: 600000 });
  assert.throws(() => ingestReceipts([forgedLimit]), /limitMs must be 120000 or 300000/);

  const hiddenGap = validReceipt({
    totalMs: 100000,
    unmeasuredMs: 0,
    stages: [{ name: "required checks", durationMs: 50000 }],
  });
  assert.throws(() => ingestReceipts([hiddenGap]), /unmeasuredMs hides time/);
});

test("secrets, URLs and absolute paths are refused rather than published", () => {
  const urlStage = validReceipt();
  urlStage.stages[0].name = "upload https://private.example.test/artifact";
  assert.throws(() => ingestReceipts([urlStage]), /contains a URL/);

  const urlCoverage = validReceipt();
  urlCoverage.coverage = "see https://private.example.test/run";
  urlCoverage.notes.coverage = urlCoverage.coverage;
  assert.throws(() => ingestReceipts([urlCoverage]), /contains a URL/);

  const absolutePath = validReceipt({ releasePath: "/Users/dean/private/deploy.mjs" });
  assert.throws(() => ingestReceipts([absolutePath]), /contains an absolute path/);

  const secretNote = validReceipt();
  secretNote.notes.token = `ghp_${"a".repeat(30)}`;
  assert.throws(() => ingestReceipts([secretNote]), /secret-shaped data/);

  const secretFailure = validReceipt({ failure: "Bearer abcdefghijklmnopqrst" });
  assert.throws(() => ingestReceipts([secretFailure]), /secret-shaped data/);

  const privateTarget = validReceipt();
  delete privateTarget.notes.deployTarget;
  assert.equal(ingestReceipts([privateTarget])[0].repo, "loftwah/example");
});

test("over-budget, failed and incomplete receipts keep their honest status", () => {
  const overBudget = validateReceipt(fixture("receipt-over-budget.json"));
  const failed = validateReceipt(fixture("receipt-failed.json"));
  const incomplete = validateReceipt(fixture("receipt-incomplete.json"));
  assert.equal(overBudget.status, "over-budget");
  assert.equal(failed.status, "failed");
  assert.equal(incomplete.status, "incomplete");

  const report = buildReport([overBudget, failed, incomplete]);
  assert.deepEqual(report.groups[0].statuses, {
    passed: 0,
    "over-budget": 1,
    failed: 1,
    incomplete: 1,
  });
  assert.equal(report.groups[0].status, "incomplete");
});

test("the comparison is deterministic for reversed input order", () => {
  const forward = buildReport(ingestReceipts(rawFixtures()));
  const reversed = buildReport(ingestReceipts(rawFixtures().reverse()));
  assert.deepEqual(reversed, forward);
  assert.deepEqual(
    forward.groups.map((group) => group.repo),
    ["loftwah/app-composer", "loftwah/composer-media-studio"],
  );
  assert.deepEqual(
    forward.groups[0].history.map((entry) => entry.status),
    ["passed", "over-budget", "failed", "incomplete"],
  );
});

test("the comparison refuses raw receipts that were not validated first", () => {
  assert.throws(
    () => buildReport([fixture("receipt-composer-pass.json")]),
    /report entries must come from validateReceipt/,
  );
});

test("the comparison summary groups by repository and release path without private detail", () => {
  const report = buildReport(
    ingestReceipts([fixture("receipt-composer-pass.json"), fixture("receipt-studio-pass.json")]),
  );
  assert.equal(report.schema, "release-timing-report/v1");
  assert.equal(report.runs, 2);
  assert.equal(report.groups.length, 2);

  const composer = report.groups[0];
  const studio = report.groups[1];
  assert.equal(composer.repo, "loftwah/app-composer");
  assert.equal(studio.repo, "loftwah/composer-media-studio");
  assert.equal(composer.totalMs, 92500);
  assert.equal(studio.totalMs, 27035);
  assert.equal(composer.slowestStage.name, "required checks (pnpm check)");
  assert.equal(studio.slowestStage.name, "Worker upload");
  assert.equal(composer.targetMs, 180000);
  assert.equal(composer.limitMs, 300000);
  assert.equal(composer.coveragePct, 93.3);
  assert.equal(composer.unmeasuredMs, 6200);
  assert.deepEqual(composer.statuses, {
    passed: 1,
    "over-budget": 0,
    failed: 0,
    incomplete: 0,
  });

  const rendered = JSON.stringify(report);
  for (const privateValue of [
    "deployTarget",
    "composer.loftwah.com",
    "media.loftwah.com",
    "different revision",
    '"cost"',
    '"winner"',
    '"rank"',
  ]) {
    assert.equal(rendered.includes(privateValue), false, `${privateValue} leaked into the report`);
  }
});

test("a portable pack is validated and a single receipt is accepted", () => {
  const entries = loadPack(examplePack);
  const report = buildReport(entries);
  assert.equal(entries.length, 2);
  assert.equal(report.groups.length, 2);
  assert.deepEqual(
    parsePack(fixture("receipt-composer-pass.json"), { source: "single" })[0].schema,
    "release-timing/v1",
  );

  assert.throws(
    () => parsePack({ schema: "release-timing-pack/v2", receipts: [] }),
    /unknown schema/,
  );
  assert.throws(
    () => parsePack({ schema: "release-timing-pack/v1", receipts: [], cost: 1 }),
    /unknown pack field "cost"/,
  );
  assert.throws(() => parsePack({ schema: "release-timing-pack/v1", receipts: [] }), /non-empty/);
  assert.throws(
    () =>
      ingestReceipts(
        parsePack({
          schema: "release-timing-pack/v1",
          receipts: [fixture("receipt-composer-pass.json"), fixture("receipt-composer-pass.json")],
        }),
      ),
    /duplicate run id/,
  );
});

test("the CLI prints the same report and refuses bad usage", async () => {
  const { stdout } = await exec(process.execPath, [reportCli, "--pack", examplePack, "--json"], {
    cwd: root,
  });
  const report = JSON.parse(stdout);
  assert.equal(report.schema, "release-timing-report/v1");
  assert.equal(report.groups.length, 2);

  const table = await exec(process.execPath, [reportCli, "--dir", fixturesDir], { cwd: root });
  assert.match(table.stdout, /loftwah\/app-composer/);
  assert.match(table.stdout, /TARGET\/LIMIT/);

  const io = { log() {}, error() {} };
  assert.equal(main(["--pack"], io), 2);
  assert.equal(main(["--dir", path.join(fixturesDir, "missing")], io), 1);
  assert.equal(main(["--help"], io), 0);
});

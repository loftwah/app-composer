import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LIMIT_MS,
  assertReceipt,
  classifyDuration,
  createReleaseRun,
  findStuckRuns,
  isWithinLimit,
  redact,
  reportStuckRun,
  stableFingerprint,
} from "../lib/delivery/release-timing.mjs";

const SHA = "a".repeat(40);

function ownedDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "release-timing-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fakeClock(start = 1_000) {
  let value = start;
  return {
    now: () => value,
    advance(ms) {
      value += ms;
    },
  };
}

function fakeGitHub() {
  const issues = [];
  let next = 1;
  return {
    issues,
    async findOpen(fingerprint) {
      return (
        issues.find((issue) =>
          String(issue.body ?? "").includes(`<!-- delivery-sla:${fingerprint} -->`),
        ) ?? null
      );
    },
    async create({ title, body }) {
      const issue = { number: next++, title, body, comments: [] };
      issues.push(issue);
      return { number: issue.number, url: `https://example.test/issues/${issue.number}` };
    },
    async comment(number, body) {
      const issue = issues.find((item) => item.number === number);
      if (!issue) throw new Error("missing issue");
      issue.comments.push(body);
      return { number };
    },
  };
}

function runFor(dir, clock, github, overrides = {}) {
  return createReleaseRun({
    repo: "loftwah/example",
    project: "example",
    sha: SHA,
    runId: `run-${Math.random().toString(16).slice(2)}`,
    receiptDir: join(dir, "timing"),
    now: clock.now,
    wallClock: () => new Date("2026-11-16T00:00:00.000Z"),
    github,
    logger: { log() {}, error() {} },
    ...overrides,
  });
}

test("the limit is strict: 299,999 passes and 300,000 is already a breach", () => {
  assert.equal(isWithinLimit(299_999), true);
  assert.equal(isWithinLimit(300_000), false);
  assert.equal(isWithinLimit(300_001), false);
  assert.equal(classifyDuration(299_999), "passed");
  assert.equal(classifyDuration(300_000), "over-budget");
  assert.equal(classifyDuration(300_001), "over-budget");
  assert.equal(classifyDuration(10, { failed: true }), "failed");
});

for (const [label, duration, expected, alerts] of [
  ["pass at 299,999ms", 299_999, "passed", 0],
  ["breach at exactly 300,000ms", 300_000, "over-budget", 1],
  ["breach at 300,001ms", 300_001, "over-budget", 1],
]) {
  test(label, async (t) => {
    const dir = ownedDir(t);
    const clock = fakeClock();
    const github = fakeGitHub();
    const run = runFor(dir, clock, github);
    await run.stage("qualification", async () => {
      clock.advance(duration);
    });
    const receipt = await run.finish({ liveRevision: SHA });
    assert.equal(receipt.status, expected);
    assert.equal(github.issues.length, alerts);
    assert.equal(receipt.alert.state, alerts ? "created" : "none");
    assert.equal(assertReceipt(receipt).schema, "release-timing/v1");
  });
}

test("a breach alerts while the run is still running", async (t) => {
  const dir = ownedDir(t);
  const clock = fakeClock();
  const github = fakeGitHub();
  const run = runFor(dir, clock, github);
  await run.stage("upload", async () => {
    clock.advance(LIMIT_MS);
  });
  assert.equal(github.issues.length, 1);
  assert.equal(run.alertState, "created");
  await run.stage("live verification", async () => clock.advance(10));
  await run.finish({ liveRevision: SHA });
  assert.equal(github.issues.length, 1, "one issue per bottleneck");
});

test("the same bottleneck updates one issue; a different bottleneck opens another", async (t) => {
  const dir = ownedDir(t);
  const clock = fakeClock();
  const github = fakeGitHub();

  const first = runFor(dir, clock, github);
  await first.stage("Worker upload", async () => clock.advance(LIMIT_MS));
  await first.finish({ liveRevision: SHA });
  assert.equal(github.issues.length, 1);

  const second = runFor(dir, clock, github);
  await second.stage("Worker upload", async () => clock.advance(LIMIT_MS));
  await second.finish({ liveRevision: SHA });
  assert.equal(github.issues.length, 1);
  assert.equal(github.issues[0].comments.length, 1);
  assert.match(github.issues[0].comments[0], /Worker upload/);

  const third = runFor(dir, clock, github);
  await third.stage("Worker upload", async () => clock.advance(10));
  await third.stage("live verification", async () => clock.advance(LIMIT_MS));
  await third.finish({ liveRevision: SHA });
  assert.equal(github.issues.length, 2);
});

test("a failed run under the limit is failed, not green and not an SLA breach", async (t) => {
  const dir = ownedDir(t);
  const clock = fakeClock();
  const github = fakeGitHub();
  const run = runFor(dir, clock, github);
  await assert.rejects(
    run.stage("required checks", async () => {
      clock.advance(1_000);
      throw new Error("typecheck failed");
    }),
    /typecheck failed/,
  );
  const receipt = await run.fail(new Error("typecheck failed"));
  assert.equal(receipt.status, "failed");
  assert.match(receipt.failure, /typecheck failed/);
  assert.equal(github.issues.length, 0);
});

test("a successful but slow release is deployed and recorded over-budget", async (t) => {
  const dir = ownedDir(t);
  const clock = fakeClock();
  const github = fakeGitHub();
  const run = runFor(dir, clock, github);
  await run.stage("required checks", async () => clock.advance(240_000));
  await run.stage("live verification", async () => clock.advance(70_000));
  const receipt = await run.finish({ status: "passed", liveRevision: SHA });
  assert.equal(receipt.status, "over-budget");
  assert.equal(receipt.notes.liveRevision, SHA);
  assert.equal(github.issues.length, 1);
});

test("a mismatched live revision cannot produce a green receipt", async (t) => {
  const dir = ownedDir(t);
  const clock = fakeClock();
  const github = fakeGitHub();
  const run = runFor(dir, clock, github);
  await run.stage("live verification", async () => clock.advance(1_000));
  const receipt = await run.finish({ liveRevision: "b".repeat(40) });
  assert.equal(receipt.status, "failed");
  assert.match(receipt.failure, /live revision/);
});

test("GitHub failure queues a redacted event and the next run retries it", async (t) => {
  const dir = ownedDir(t);
  const clock = fakeClock();
  const broken = fakeGitHub();
  broken.create = async () => {
    throw new Error("gh: authentication failed for token ghp_abcdefghijklmnopqrstuvwxyz");
  };
  const run = runFor(dir, clock, broken);
  await run.stage("Worker upload", async () => clock.advance(LIMIT_MS));
  const receipt = await run.finish({ liveRevision: SHA });
  assert.equal(receipt.alert.state, "pending");
  const pending = readdirSync(join(dir, "timing", "pending"));
  assert.equal(pending.length, 1);
  const queued = readFileSync(join(dir, "timing", "pending", pending[0]), "utf8");
  assert.doesNotMatch(queued, /ghp_abcdefghijklmnopqrstuvwxyz/);

  const github = fakeGitHub();
  const retry = runFor(dir, fakeClock(), github);
  const flushed = await retry.flushPending();
  assert.equal(flushed.flushed, 1);
  assert.equal(github.issues.length, 1);
  assert.equal(readdirSync(join(dir, "timing", "pending")).length, 0);
});

test("a passing release adds recovery evidence once without closing the issue", async (t) => {
  const dir = ownedDir(t);
  const github = fakeGitHub();
  // Use a dedicated clock for the breach so the boundary is exact.
  const breachClock = fakeClock();
  const breach = runFor(dir, breachClock, github);
  await breach.stage("Worker upload", async () => breachClock.advance(LIMIT_MS));
  await breach.finish({ liveRevision: SHA });
  assert.equal(github.issues.length, 1);

  const pass = runFor(dir, fakeClock(), github);
  await pass.stage("Worker upload", async () => {});
  const receipt = await pass.finish({ liveRevision: SHA });
  assert.equal(receipt.status, "passed");
  assert.equal(github.issues[0].comments.length, 1);
  assert.match(github.issues[0].comments[0], /Measured recovery/);

  const secondPass = runFor(dir, fakeClock(), github);
  await secondPass.stage("Worker upload", async () => {});
  await secondPass.finish({ liveRevision: SHA });
  assert.equal(github.issues[0].comments.length, 1, "recovery evidence is not spammed");
});

test("redaction removes credentials, token query values and secret fields", () => {
  const safe = redact({
    token: "ghp_abcdefghijklmnopqrstuvwxyz",
    url: "https://user:password@example.test/path?token=abc123&ok=1",
    note: "Bearer abcdefghijklmnop.qrstuvwxyz",
  });
  assert.equal(safe.token, "[redacted]");
  assert.doesNotMatch(safe.url, /user|password|abc123/);
  assert.doesNotMatch(safe.note, /abcdefghijklmnop/);
});

test("a stale running receipt is found and reported, never treated as a pass", async (t) => {
  const dir = ownedDir(t);
  const clock = fakeClock();
  const run = runFor(dir, clock, fakeGitHub(), {
    wallClock: () => new Date("2026-11-16T00:00:00.000Z"),
  });
  await run.stage("required checks", async () => clock.advance(1_000));
  assert.equal(run.receipt, null, "an unfinished run has no final receipt");
  const stuck = findStuckRuns({
    receiptDir: join(dir, "timing"),
    now: new Date("2026-11-16T00:06:00.000Z"),
  });
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].sha, SHA);
  const github = fakeGitHub();
  assert.equal(await reportStuckRun({ stuck: stuck[0], github, logger: { error() {} } }), "created");
  assert.equal(github.issues.length, 1);
  assert.match(github.issues[0].title, /did not finish/);
});

test("a forged or tampered receipt is refused", () => {
  const valid = {
    schema: "release-timing/v1",
    sha: SHA,
    runId: "run-12345678",
    stages: [{ name: "checks", durationMs: 1_000 }],
    totalMs: 1_000,
    liveRevision: SHA,
  };
  assert.equal(assertReceipt(valid).sha, SHA);
  assert.throws(() => assertReceipt({ ...valid, liveRevision: "b".repeat(40) }), /live revision/);
  assert.throws(() => assertReceipt({ ...valid, stages: [{ name: "checks", durationMs: 99_999 }] }), /exceed the total/);
  assert.throws(() => assertReceipt({ ...valid, schema: "other" }), /schema/);
});

test("one fingerprint identifies one repo, release path and bottleneck", () => {
  const base = { repo: "loftwah/example", releasePath: "scripts/deploy.mjs", bottleneck: "upload" };
  assert.equal(stableFingerprint(base), stableFingerprint({ ...base }));
  assert.notEqual(stableFingerprint(base), stableFingerprint({ ...base, bottleneck: "checks" }));
  assert.notEqual(stableFingerprint(base), stableFingerprint({ ...base, repo: "loftwah/other" }));
});

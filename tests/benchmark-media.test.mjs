// The matched media comparison's own proof.
//
// 1. The committed pair is genuinely matched: same still bytes, same recorded
//    settings, same prompt digest, different model. The artifact bytes and
//    digests match the record.
// 2. The pre-vote state names no model, provider, configuration or trial, and
//    every clip/poster URL is the opaque pair/side route.
// 3. The preview route resolves only allowlisted files and refuses a changed
//    byte count, an HTML type, a bad range or a missing artifact.
// 4. A failed or missing artifact stays visible as missing; it is not hidden or
//    silently replaced by the other side.
// 5. Sample size, latency, cost and observed failures are stated honestly.
// 6. Export and reopen are the same renderer and the same record.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MEDIA_PREVIEW_ROOT,
  assertMediaBlindViewIsClean,
  canonicalJson,
  forbiddenMediaIdentityTokens,
  mediaBlindView,
  mediaExport,
  mediaExportFilename,
  mediaPair,
  mediaPairs,
  mediaPreviewPath,
  mediaPreferenceCopy,
  mediaResponsePlan,
  mediaRevealPair,
  mediaRunIdFor,
  mediaRunView,
  mediaSideAsset,
  validateMediaRecord,
} from "../src/lib/benchmark-media.mjs";
import {
  appendVote,
  getRunRecord,
  hashReviewerToken,
  isMediaRecord,
  listVotes,
  mediaRunEntry,
  pairsFor,
  revealPair,
  runIdFor,
  validateVote,
} from "../src/lib/benchmark-runs.ts";
import { sqliteD1, migration } from "./helpers/stacks-sqlite.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const record = JSON.parse(
  readFileSync(new URL("../benchmarks/media/run.json", import.meta.url), "utf8"),
);
const source = JSON.parse(
  readFileSync(new URL("../benchmarks/media/configurations.json", import.meta.url), "utf8"),
);
const task = JSON.parse(
  readFileSync(new URL("../benchmarks/media/task.json", import.meta.url), "utf8"),
);
const runId = "animate-a-still-v1-d20cbf5";
const TOKEN = "d4".repeat(32);

function database() {
  const db = sqliteD1({ schema: migration("0033_benchmark_votes.sql") });
  try {
    db.migrate(migration("0036_benchmark_votes_append.sql"));
  } catch (error) {
    db.cleanup();
    throw error;
  }
  return db;
}

function clone(value) {
  return structuredClone(value);
}

test("the committed record is a genuinely matched pair", () => {
  const validation = validateMediaRecord(record, {
    expectedSourceVersion: record.sourceVersion,
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(record.schema, "benchmark-media/v1");
  assert.equal(record.inventory, "studio-media");
  assert.equal(record.configurations.length, 2);
  const [first, second] = record.configurations;
  assert.notEqual(first.model, second.model);
  assert.equal(
    canonicalJson(first.settings),
    canonicalJson(second.settings),
    "the shared settings must be identical",
  );
  assert.equal(first.settings.inputSha256, second.settings.inputSha256);
  assert.equal(first.settings.promptSha256, second.settings.promptSha256);
  assert.equal(first.settings.durationSeconds, task.settings.durationSeconds);
  assert.equal(first.settings.aspect, task.settings.aspect);
  assert.equal(first.trials.length, 1);
  assert.equal(second.trials.length, 1);
  assert.equal(runIdFor(record), runId);
  assert.equal(mediaRunIdFor(record), runId);
  assert.equal(record.pair.id, "p01");
  assert.equal(record.pair.sideA, "take-01");
  assert.equal(record.pair.sideB, "take-02");

  const media = mediaPairs(record);
  const build = pairsFor(record);
  assert.deepEqual(
    media.map((pair) => [pair.id, pair.trialA.id, pair.trialB.id, pair.orderKey]),
    build.map((pair) => [pair.id, pair.trialA.id, pair.trialB.id, pair.orderKey]),
    "the media pair rule must match the vote API's pair rule",
  );
});

test("every committed artifact still matches its recorded bytes and digest", () => {
  for (const configuration of record.configurations) {
    for (const trial of configuration.trials) {
      for (const [label, artifact] of [
        ["clip", trial.artifact],
        ["poster", trial.poster],
      ]) {
        const actual = readFileSync(
          new URL(`../public/benchmarks/media/${artifact.path}`, import.meta.url),
        );
        assert.equal(actual.length, artifact.bytes, `${trial.id} ${label} byte count`);
        assert.equal(
          createHash("sha256").update(actual).digest("hex"),
          artifact.sha256,
          `${trial.id} ${label} sha256`,
        );
      }
    }
  }
  const inputUrl = new URL(`../public/benchmarks/media/${task.input.previewPath}`, import.meta.url);
  const input = readFileSync(inputUrl);
  assert.equal(input.length, task.input.previewBytes);
  assert.equal(
    createHash("sha256").update(input).digest("hex"),
    task.input.previewSha256,
  );
});

test("the ingest runner is current and validates the same record", () => {
  const output = execFileSync(
    process.execPath,
    ["benchmarks/media/ingest.mjs", "--check", "--json"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const result = JSON.parse(output);
  assert.equal(result.ok, true, result.errors?.join("\n"));
  assert.equal(result.runId, runId);
  assert.equal(result.pair.sideA, "take-01");
  assert.equal(result.pair.sideB, "take-02");
  assert.equal(result.artifacts.length, 2);
});

test("the pre-vote state contains no recorded model or direct artifact path", () => {
  const view = mediaBlindView(record);
  const state = JSON.stringify(view).toLowerCase();
  for (const token of forbiddenMediaIdentityTokens(record)) {
    assert.equal(
      state.includes(token.toLowerCase()),
      false,
      `the pre-vote state must not contain ${JSON.stringify(token)}`,
    );
  }
  for (const configuration of record.configurations) {
    for (const value of [
      configuration.id,
      configuration.label,
      configuration.model,
      configuration.resolvedModel,
      configuration.provider,
      configuration.harness,
      configuration.harnessVersion,
      configuration.inventoryEntry,
    ]) {
      if (typeof value === "string" && value.length >= 3) {
        assert.equal(state.includes(value.toLowerCase()), false, `no ${value}`);
      }
    }
    for (const trial of configuration.trials) {
      assert.equal(state.includes(trial.id.toLowerCase()), false, `no ${trial.id}`);
      assert.equal(state.includes(trial.artifact.path.toLowerCase()), false, "no direct artifact path");
    }
  }
  assert.doesNotMatch(state, /\/projects\/|retained\.mp4|gen_[0-9a-f]{8}|prj_[0-9a-f]{8}/);
  for (const pair of view.pairs) {
    for (const side of pair.sides) {
      assert.match(side.clip, /^\/benchmarks\/media\/preview\/[^/]+\/p\d{2}\/[ab]\/clip\.mp4$/);
      assert.match(side.poster, /^\/benchmarks\/media\/preview\/[^/]+\/p\d{2}\/[ab]\/poster\.jpg$/);
      assert.equal(side.clip.startsWith(MEDIA_PREVIEW_ROOT), true);
    }
  }
  assert.equal(view.sample.configurations, 2);
  assert.equal(view.sample.trials, 2);
  assert.equal(view.sample.saved, 2);
  assert.equal(view.sample.pairs, 1);
  assert.equal(view.sample.repeats, 0);
  assert.equal(view.sample.trialsPerConfiguration, 1);
});

test("the blind page and its client do not hardcode a model identity", () => {
  const page = readFileSync(
    new URL("../src/pages/benchmarks/media.astro", import.meta.url),
    "utf8",
  ).toLowerCase();
  const client = readFileSync(
    new URL("../src/browser/benchmark-media.ts", import.meta.url),
    "utf8",
  ).toLowerCase();
  for (const token of ["h3-max-turbo", "kling-standard", "minimax", "kling 2.5"]) {
    assert.equal(page.includes(token), false, `media.astro must not name ${token}`);
    assert.equal(client.includes(token), false, `benchmark-media.ts must not name ${token}`);
  }
  assert.doesNotMatch(page, /\/p01\/[ab]\/(clip\.mp4|poster\.jpg)/);
  assert.match(page, /data-media-review/);
  assert.match(page, /data-media-pair/);
  assert.match(page, /data-media-side/);
  assert.match(page, /<video/);
});

test("a model name injected into the blind view is refused", () => {
  const view = mediaBlindView(record);
  const dirty = clone(view);
  dirty.pairs[0].sides[0].title = record.configurations[0].model;
  assert.throws(() => assertMediaBlindViewIsClean(dirty, record), /names a configuration/);
});

test("the preview route resolves only allowlisted files and enforces the byte count", () => {
  const asset = mediaSideAsset(record, "p01", "a", "clip.mp4");
  assert.ok(asset);
  assert.equal(asset.publicPath, "/benchmarks/media/animate-a-still/p01/a/clip.mp4");
  assert.equal(asset.mime, "video/mp4");
  assert.equal(asset.bytes, 2658207);
  assert.equal(mediaSideAsset(record, "p01", "b", "clip.mp4")?.mime, "video/mp4");

  const poster = mediaSideAsset(record, "p01", "b", "poster.jpg");
  assert.ok(poster);
  assert.equal(poster.mime, "image/jpeg");

  for (const bad of ["index.html", "app.css", "clip.mov", "poster.svg", "../clip.mp4", "clip.mp4?x"]) {
    assert.equal(mediaSideAsset(record, "p01", "a", bad), null, bad);
  }
  assert.equal(mediaSideAsset(record, "p01", "c", "clip.mp4"), null);
  assert.equal(mediaSideAsset(record, "p99", "a", "clip.mp4"), null);

  const full = mediaResponsePlan(
    asset,
    200,
    new Headers({ "content-type": "text/html", "content-length": String(asset.bytes) }),
    "GET",
  );
  assert.equal(full.ok, true);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-type"), "video/mp4");
  assert.equal(full.headers.get("content-length"), String(asset.bytes));
  assert.equal(full.headers.get("accept-ranges"), "bytes");
  assert.equal(full.headers.get("x-content-type-options"), "nosniff");
  assert.equal(full.body, "stream");

  const partial = mediaResponsePlan(
    asset,
    206,
    new Headers({ "content-range": `bytes 0-99/${asset.bytes}` }),
    "GET",
  );
  assert.equal(partial.ok, true);
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("content-range"), `bytes 0-99/${asset.bytes}`);
  assert.equal(partial.headers.get("content-length"), "100");

  const wrongTotal = mediaResponsePlan(
    asset,
    206,
    new Headers({ "content-range": `bytes 0-99/${asset.bytes + 1}` }),
    "GET",
  );
  assert.equal(wrongTotal.ok, false);
  assert.equal(wrongTotal.status, 502);

  const wrongLength = mediaResponsePlan(
    asset,
    200,
    new Headers({ "content-length": "1" }),
    "GET",
  );
  assert.equal(wrongLength.ok, false);
  assert.equal(wrongLength.status, 502);

  const unsatisfied = mediaResponsePlan(
    asset,
    416,
    new Headers({ "content-range": `bytes */${asset.bytes}` }),
    "GET",
  );
  assert.equal(unsatisfied.ok, true);
  assert.equal(unsatisfied.status, 416);
  assert.equal(unsatisfied.headers.get("content-range"), `bytes */${asset.bytes}`);

  const head = mediaResponsePlan(
    asset,
    200,
    new Headers({ "content-length": String(asset.bytes) }),
    "HEAD",
  );
  assert.equal(head.ok, true);
  assert.equal(head.body, null);
  assert.equal(head.headers.get("content-length"), String(asset.bytes));

  const missing = mediaResponsePlan(asset, 404, new Headers(), "GET");
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);

  const notModified = mediaResponsePlan(
    asset,
    304,
    new Headers({ etag: '"abc123"', "last-modified": "Sat, 15 Nov 2026 10:00:00 GMT" }),
    "GET",
  );
  assert.equal(notModified.ok, true);
  assert.equal(notModified.status, 304);
  assert.equal(notModified.body, null);
  assert.equal(notModified.headers.get("etag"), '"abc123"');
  assert.equal(notModified.headers.get("content-length"), null);

  const htmlAsPoster = mediaResponsePlan(
    poster,
    200,
    new Headers({ "content-type": "text/html", "content-length": String(poster.bytes) }),
    "GET",
  );
  assert.equal(htmlAsPoster.headers.get("content-type"), "image/jpeg");
});

test("the preview route uses the allowlist, the opaque record and range forwarding", () => {
  const route = readFileSync(
    new URL("../src/pages/benchmarks/media/preview/[...path].ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /mediaSideAsset/);
  assert.match(route, /mediaResponsePlan/);
  assert.match(route, /getRunRecord/);
  assert.match(route, /range/);
  assert.match(route, /x-content-type-options/i);
  assert.doesNotMatch(route, /source\.headers\.get\(["']content-type/i);
  const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(wrangler, /"binding":\s*"ASSETS"/);
});

test("a missing artifact stays missing and is not replaced by the other side", () => {
  const broken = clone(record);
  const trial = broken.configurations[0].trials[0];
  trial.status = "missing";
  trial.artifact = null;
  trial.poster = null;
  trial.cost = null;
  trial.checks = trial.checks.map((check) => ({
    ...check,
    status: "fail",
    detail: "The saved file is not retained for this take.",
  }));
  trial.failed = trial.checks.map((check) => check.id);

  const validation = validateMediaRecord(broken, {
    expectedSourceVersion: broken.sourceVersion,
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(mediaSideAsset(broken, "p01", "a", "clip.mp4"), null);
  assert.ok(mediaSideAsset(broken, "p01", "b", "clip.mp4"), "the other side is still playable");

  const view = mediaBlindView(broken);
  const sideA = view.pairs[0].sides[0];
  assert.equal(sideA.playable, false);
  assert.equal(sideA.clip, null);
  assert.equal(sideA.poster, null);
  assert.equal(sideA.status, "missing");
  assert.ok(sideA.failed.includes("retained-file"));
  assert.equal(view.sample.saved, 1);
  assert.equal(view.sample.failedArtifacts, 1);

  const page = readFileSync(
    new URL("../src/pages/benchmarks/media.astro", import.meta.url),
    "utf8",
  );
  assert.match(page, /No playable file was retained for this take/);
  assert.match(page, /data-media-playback-error/);
  const client = readFileSync(
    new URL("../src/browser/benchmark-media.ts", import.meta.url),
    "utf8",
  );
  assert.match(client, /wirePlaybackFallbacks/);
});

test("matched-pair validation refuses a fake equivalence", () => {
  const sameModel = clone(record);
  sameModel.configurations[1].model = sameModel.configurations[0].model;
  sameModel.configurations[1].resolvedModel = sameModel.configurations[0].model;
  assert.ok(
    validateMediaRecord(sameModel).errors.some((error) => /model|same model/i.test(error)),
  );

  const differentSetting = clone(record);
  differentSetting.configurations[1].settings.durationSeconds = 6;
  assert.ok(
    validateMediaRecord(differentSetting).errors.some((error) => /settings differ|durationSeconds/i.test(error)),
  );

  const differentInput = clone(record);
  differentInput.configurations[1].settings.inputSha256 = "0".repeat(64);
  assert.ok(
    validateMediaRecord(differentInput).errors.some((error) => /settings differ/i.test(error)),
  );

  const privateField = clone(record);
  privateField.projectId = "prj_00000000000000000000000000000000";
  assert.ok(
    validateMediaRecord(privateField).errors.some((error) => /private field/i.test(error)),
  );

  const missingCheck = clone(record);
  missingCheck.configurations[0].trials[0].checks = missingCheck.configurations[0].trials[0].checks.filter(
    (check) => check.id !== "duration",
  );
  assert.ok(
    validateMediaRecord(missingCheck).errors.some((error) => /missing the duration check/i.test(error)),
  );

  const badFailed = clone(record);
  badFailed.configurations[0].trials[0].failed = [];
  assert.ok(
    validateMediaRecord(badFailed).errors.some((error) => /failed list must match/i.test(error)),
  );

  const badPath = clone(record);
  badPath.configurations[0].trials[0].artifact.path = "animate-a-still/p01/b/clip.mp4";
  assert.ok(
    validateMediaRecord(badPath).errors.some((error) => /matching side path/i.test(error)),
  );

  assert.equal(
    source.configurations.length,
    2,
    "the reviewed source still contains exactly the two configurations",
  );
});

test("sample size, latency and cost are stated, not implied", () => {
  const view = mediaBlindView(record);
  assert.equal(view.sample.repeats, 0);
  assert.equal(view.sample.trialsPerConfiguration, 1);
  assert.match(view.costLabel, /not a provider invoice/i);
  assert.match(view.latencyLabel, /created_at.*completed_at/i);
  for (const pair of view.pairs) {
    for (const side of pair.sides) {
      assert.ok(Number.isFinite(side.latencyMs), `${side.title} latency`);
      assert.ok(Number.isFinite(side.cost.estimateMicro), `${side.title} estimate`);
      assert.match(side.cost.basis, /estimate/i);
      assert.ok(side.checks.some((check) => check.kind === "observed"));
    }
  }
  const a = view.pairs[0].sides[0];
  const b = view.pairs[0].sides[1];
  assert.equal(a.latencyMs, 17129);
  assert.equal(b.latencyMs, 141181);
  assert.equal(a.cost.estimateMicro, 240000);
  assert.equal(b.cost.estimateMicro, 350000);
  assert.equal(a.cost.providerChargedMicro, null, "an absent provider charge is unknown, not US$0.00");
  assert.equal(b.cost.providerChargedMicro, null);
  assert.match(a.cost.basis, /not an invoice/i);
  assert.equal(a.failed.includes("supplied-still-preserved"), true);
  assert.equal(b.failed.length, 0);

  const page = readFileSync(
    new URL("../src/pages/benchmarks/media.astro", import.meta.url),
    "utf8",
  );
  assert.match(page, /no repeated trials/);
  assert.match(page, /not a leaderboard/);
  assert.match(page, /Studio estimate/);
  assert.match(page, /saved-job latency/);
  assert.match(page, /observed/i);

  const unavailable = mediaRunView(record, [], { votesAvailable: false });
  assert.match(unavailable.verdict.detail, /could not be read/);
  assert.doesNotMatch(unavailable.verdict.detail, /No blind vote has been recorded yet/);
  assert.equal(unavailable.votesAvailable, false);
});

test("a media submission reuses benchmark_votes and the existing pair contract", async () => {
  const db = database();
  try {
    const pair = mediaPair(record, "p01");
    assert.ok(pair);
    const body = {
      run: runId,
      task: "animate-a-still",
      pair: "p01",
      choice: "a",
      reason: "A holds the still; B has flicker.",
      chips: ["A: holds the still", "B: flicker or artifacts"],
      blind: true,
      token: TOKEN,
    };
    const valid = validateVote(record, body);
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.value.trialA, pair.trialA.id);
      assert.equal(valid.value.trialB, pair.trialB.id);
      assert.equal(valid.value.blind, true);
      assert.deepEqual(valid.value.reasons, ["A: holds the still", "B: flicker or artifacts"]);
    }
    assert.equal(validateVote(record, { ...body, run: "nope" }).ok, false);
    assert.equal(validateVote(record, { ...body, task: "other" }).ok, false);
    assert.equal(validateVote(record, { ...body, pair: "p99" }).ok, false);
    assert.equal(validateVote(record, { ...body, choice: "winner" }).ok, false);
    assert.equal(validateVote(record, { ...body, reason: "<b>x</b>" }).ok, false);
    assert.equal(validateVote(record, { ...body, token: "nope" }).ok, false);

    assert.ok(valid.ok);
    const first = await appendVote(db, valid.value, new Date("2026-11-16T11:08:09Z"));
    assert.equal(first.appended, true);
    assert.equal(first.vote.blind, true);
    assert.equal(first.vote.reason, "A holds the still; B has flicker.");
    assert.deepEqual(first.vote.reasons, ["A: holds the still", "B: flicker or artifacts"]);

    const second = validateVote(record, {
      ...body,
      choice: "b",
      reason: "B is smoother.",
      chips: ["B: smoother motion"],
    });
    assert.ok(second.ok);
    const stored = await appendVote(db, second.value, new Date("2026-11-16T11:55:35Z"));
    assert.equal(stored.appended, true);
    assert.equal(stored.vote.choice, "b");
    assert.notEqual(stored.vote.submissionId, first.vote.submissionId);
    const rows = await listVotes(db, runId);
    assert.equal(rows.length, 2, "the same token and label append a second row");
    assert.deepEqual(rows.map((row) => row.choice), ["a", "b"]);
    assert.deepEqual(
      rows.map((row) => row.createdAt),
      ["2026-11-16T11:08:09.000Z", "2026-11-16T11:55:35.000Z"],
    );

    const reveal = validateVote(record, { ...body, choice: "revealed", blind: true });
    assert.ok(reveal.ok);
    if (reveal.ok) assert.equal(reveal.value.blind, false);
  } finally {
    db.cleanup();
  }
});

test("export and reopen use the same record and the same media renderer", async () => {
  const db = database();
  try {
    const valid = validateVote(record, {
      run: runId,
      task: "animate-a-still",
      pair: "p01",
      choice: "a",
      reason: "A: holds the still",
      chips: ["A: holds the still"],
      blind: true,
      token: TOKEN,
    });
    assert.ok(valid.ok);
    await appendVote(db, valid.value, new Date("2026-11-16T12:00:00Z"));
    const votes = await listVotes(db, runId);
    const evidence = mediaExport(record, votes, { votesAvailable: true });
    assert.equal(evidence.schema, "composer/benchmark-run-evidence/1");
    assert.equal(evidence.runId, runId);
    assert.deepEqual(evidence.record, record);
    assert.equal(evidence.votes.length, 1);
    assert.equal(evidence.submissions, 1);
    assert.equal(evidence.votesAvailable, true);
    assert.equal(evidence.reopen.blind, `/benchmarks/media?run=${runId}`);
    assert.equal(evidence.reopen.revealed, `/benchmarks/media/runs/${runId}`);
    assert.equal(evidence.reopen.export, `/benchmarks/media/runs/${runId}/export.json`);
    assert.equal(mediaExportFilename(runId), `composer-benchmark-media-${runId}.json`);
    assert.equal(evidence.votes[0].submissionId, votes[0].submissionId);
    assert.equal(evidence.votes[0].reviewerTokenHash, await hashReviewerToken(TOKEN));
    assert.equal(JSON.stringify(evidence).includes(TOKEN), false, "the raw token is not exported");
    assert.equal("reviewerToken" in evidence.votes[0], false);

    const pageView = mediaRunView(evidence.record, evidence.votes, {
      votesAvailable: evidence.votesAvailable,
    });
    const reopened = mediaRunView(
      JSON.parse(JSON.stringify(evidence)).record,
      JSON.parse(JSON.stringify(evidence)).votes,
      { votesAvailable: JSON.parse(JSON.stringify(evidence)).votesAvailable },
    );
    assert.deepEqual(reopened, pageView);
    assert.equal(pageView.sample.recordedPairs, 1);
    assert.equal(pageView.sample.submissions, 1);
    assert.equal(pageView.sample.independentTokens, 1);
    assert.equal(pageView.sample.blindSubmissions, 1);
    assert.equal(pageView.sample.unblindedSubmissions, 0);
    assert.equal(pageView.pairs[0].submissions[0].choice, "a");
    assert.equal(pageView.pairs[0].submissions[0].blind, true);
    assert.deepEqual(pageView.pairs[0].submissions[0].reasons, ["A: holds the still"]);
    assert.ok(pageView.pairs[0].sideA.configurationLabel);
    assert.ok(pageView.pairs[0].sideB.configurationLabel);
    assert.match(pageView.verdict.detail, /1 pair/);
    assert.match(pageView.verdict.detail, /1 independent submission/);
    assert.match(pageView.verdict.detail, /not a model ranking/);
    assert.match(pageView.cost.label, /not a provider invoice/);

    const reveal = revealPair(record, "p01");
    const mediaReveal = mediaRevealPair(record, "p01");
    assert.ok(reveal && mediaReveal);
    assert.deepEqual(
      reveal.sides.map((side) => [side.key, side.model, side.provider, side.artifact?.bytes]),
      mediaReveal.sides.map((side) => [side.key, side.model, side.provider, side.artifact?.bytes]),
      "the vote API reveal and the media reveal must agree",
    );
  } finally {
    db.cleanup();
  }
});

test("an unblinded reveal is not a blind preference", async () => {
  const db = database();
  try {
    const reveal = validateVote(record, {
      run: runId,
      task: "animate-a-still",
      pair: "p01",
      choice: "revealed",
      blind: true,
      token: TOKEN,
    });
    assert.ok(reveal.ok);
    const stored = await appendVote(db, reveal.value, new Date("2026-11-16T13:00:00Z"));
    assert.equal(stored.vote.blind, false);
    const view = mediaRunView(record, await listVotes(db, runId), { votesAvailable: true });
    assert.equal(view.sample.blindSubmissions, 0);
    assert.equal(view.sample.unblindedSubmissions, 1);
    assert.match(view.verdict.detail, /0 blind, 1 unblinded/);
  } finally {
    db.cleanup();
  }
});

test("the registered media run is the one the pages read", () => {
  const entry = mediaRunEntry();
  assert.ok(entry);
  assert.equal(entry.id, runId);
  assert.equal(isMediaRecord(entry.record), true);
  assert.deepEqual(entry.record, record);
  assert.equal(getRunRecord(runId)?.id, runId);
  assert.equal(mediaPreviewPath(runId, "p01", "a", "clip.mp4"), `/benchmarks/media/preview/${runId}/p01/a/clip.mp4`);
});

test("the receipts page no longer claims that no preference exists", () => {
  const page = readFileSync(
    new URL("../src/pages/benchmarks/comparisons.astro", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(page, /No blind human preference between these outputs has been recorded yet/);
  assert.doesNotMatch(page, /No blind human comparison of these outputs has been recorded yet/);
  assert.match(page, /mediaPreferenceCopy/);
  assert.match(page, /mediaPreferenceLine/);
  assert.match(page, /mediaPreferenceLimit/);
  assert.match(page, /href=\{mediaHref\}/);
  assert.match(page, /listVotes/);

  const unreadable = mediaPreferenceCopy({ available: false, choices: 0, reveals: 0, routes: 17 });
  assert.match(unreadable.line, /could not read its vote record/);
  assert.doesNotMatch(unreadable.line, /no recorded submission yet/);
  assert.match(unreadable.limit, /does not claim that no preference exists/);

  const voted = mediaPreferenceCopy({ available: true, choices: 1, blindChoices: 1, reveals: 0, routes: 17 });
  assert.match(voted.line, /1 recorded preference submission/);
  assert.match(voted.line, /1 blind/);
  assert.match(voted.line, /not a quality ranking of these 17 routes/);
  assert.doesNotMatch(voted.line, /no recorded submission yet|does not claim/);
  assert.match(voted.limit, /Rank quality across these routes/);
  assert.match(voted.limit, /not a preference across these 17 routes/);

  const unblinded = mediaPreferenceCopy({ available: true, choices: 2, blindChoices: 0, reveals: 1, routes: 17 });
  assert.match(unblinded.line, /2 recorded preference submissions/);
  assert.match(unblinded.line, /0 blind, 2 unblinded, 1 reveal/);

  const revealedOnly = mediaPreferenceCopy({ available: true, choices: 0, blindChoices: 0, reveals: 1, routes: 17 });
  assert.match(revealedOnly.line, /revealed 1 time without a choice/);
  assert.match(revealedOnly.line, /No blind preference between those two clips is recorded/);

  const none = mediaPreferenceCopy({ available: true, choices: 0, blindChoices: 0, reveals: 0, routes: 17 });
  assert.match(none.line, /has no recorded submission yet/);
  assert.match(none.limit, /open for a blind observation/);

  const evidence = readFileSync(
    new URL("../benchmarks/comparisons/studio-job-receipts.json", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(evidence, /No blind human preference between these outputs has been recorded yet/);
  assert.match(evidence, /aggregate routes/);
  const readme = readFileSync(
    new URL("../benchmarks/comparisons/README.md", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(readme, /No blind comparison of outputs has been recorded yet/);
  assert.match(readme, /benchmarks\/media/);
});

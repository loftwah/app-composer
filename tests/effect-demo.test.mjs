import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { publicPagePaths } from "../src/lib/public-pages.mjs";
import {
  LINKCHECK_COMMIT,
  copyText,
  linkcheckSource,
  outcomeLine,
  progressLine,
} from "../src/lib/effect/linkcheck.mjs";

const root = new URL("..", import.meta.url);
const text = (path) => readFileSync(new URL(path, root), "utf8");
const trace = JSON.parse(text("src/lib/effect/run-trace.json"));
const page = text("src/pages/effect.astro");
const component = text("src/components/EffectRunDemo.tsx");
const scenario = (id) => trace.scenarios.find((entry) => entry.id === id);

test("the page uses the recorded Link Check trace, not invented results", () => {
  assert.equal(trace.contract, 1);
  assert.equal(trace.kind, "effect-batch-trace");
  assert.equal(trace.engine.repository, "https://github.com/loftwah/app-composer-linkcheck");
  assert.equal(trace.engine.effect, "4.0.4");
  assert.equal(trace.engine.synthetic, true);
  assert.match(trace.engine.label, /No network request/);
  assert.deepEqual(
    trace.scenarios.map((entry) => entry.id),
    ["ready", "permission", "duplicate", "timeout", "recovery"],
  );
  assert.match(page, /Every number comes from executing Link Check/);
  assert.match(page, /is not a live inspection/);
  assert.match(component, /Recorded run · synthetic/);
  assert.match(component, /nothing is fetched here/);
  assert.doesNotMatch(page, /guaranteed recovery|zero incidents|always succeeds/i);
});

test("every recorded run keeps consistent phases, reads and totals", () => {
  for (const entry of trace.scenarios) {
    const ids = entry.phases.map((phase) => phase.id);
    assert.equal(new Set(ids).size, ids.length, entry.id);
    for (const phase of entry.phases) {
      assert.ok(["pass", "block", "review"].includes(phase.state), phase.id);
      assert.ok(phase.title.length > 0);
      assert.ok(phase.detail.length > 0);
    }
    if (entry.outcome.kind === "refused") {
      assert.equal(entry.observed.inspectorCalls, 0, entry.id);
      assert.equal(entry.phases.at(-1).state, "block", entry.id);
      continue;
    }
    const report = entry.outcome.report;
    assert.equal(
      report.targets.length,
      report.totals.verified + report.totals.failed + report.totals.uncertain,
      entry.id,
    );
    assert.equal(
      report.totals.attempts,
      report.targets.reduce((sum, target) => sum + target.attempts, 0),
      entry.id,
    );
    assert.equal(report.limits.persisted, false);
  }
  const timeout = scenario("timeout").outcome.report;
  assert.equal(timeout.status, "partial");
  assert.equal(
    timeout.targets.filter((target) => target.status === "uncertain").length,
    1,
  );
  assert.equal(
    scenario("recovery").outcome.report.targets.filter((target) => target.reconciled)
      .length,
    1,
  );
});

test("the demo states outcomes from the recorded scenario, not from counters", () => {
  assert.match(outcomeLine(scenario("permission")), /TargetNotPermitted/);
  assert.match(outcomeLine(scenario("permission")), /0 reads attempted/);
  assert.match(outcomeLine(scenario("duplicate")), /DuplicateTarget/);
  assert.match(outcomeLine(scenario("timeout")), /2 verified, 1 uncertain, 4 attempts/);
  assert.match(outcomeLine(scenario("recovery")), /2 verified, 3 attempts/);
  assert.match(component, /partial: "Partial evidence"/);
  assert.match(component, /complete: "Every page read"/);
  assert.equal(progressLine(scenario("ready"), 0), "Ready to run the recorded check.");
  assert.match(progressLine(scenario("ready"), 1), /Step 1 of 5/);
  assert.match(progressLine(scenario("ready"), 6), /Run complete after 5 steps/);
});

test("a shared summary carries its synthetic label and pinned source links", () => {
  const summary = copyText(scenario("timeout"), trace.engine, trace.limits);
  assert.match(summary, /recorded demo \(synthetic\)/i);
  assert.match(summary, /no network request/i);
  assert.match(summary, new RegExp(LINKCHECK_COMMIT));
  assert.match(summary, /src\/batch\.ts/);
  assert.match(summary, /tests\/batch\.test\.mjs/);
  for (const target of scenario("timeout").outcome.report.targets)
    assert.match(summary, new RegExp(target.status));
  assert.ok(linkcheckSource("src/batch.ts").startsWith(
    "https://github.com/loftwah/app-composer-linkcheck/blob/" + LINKCHECK_COMMIT,
  ));
});

test("the page is indexable, canonical and listed for the sitemap", () => {
  assert.ok(publicPagePaths.includes("/effect"));
  assert.match(page, /canonical="https:\/\/composer\.loftwah\.com\/effect"/);
  assert.match(page, /<Base/);
  assert.match(text("src/layouts/Base.astro"), /href="\/effect"/);
  const image = text("src/pages/effect.astro").match(/effect-batch-20261024\.png/);
  assert.ok(image, "the page declares its own share card");
});

test("the share card is a real 1200 × 630 PNG with the synthetic label", () => {
  const bytes = readFileSync(new URL("public/brand/effect/effect-batch-20261024.png", root));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert.equal(width, 1200);
  assert.equal(height, 630);
  assert.ok(bytes.byteLength > 20_000, "the card is a rendered image, not a placeholder");
  assert.ok(statSync(new URL(".artwork/effect/run-card.html", root)).size > 1000);
  const card = text(".artwork/effect/run-card.html");
  assert.match(card, /Recorded demo · synthetic/);
  assert.match(card, /composer\.loftwah\.com\/effect/);
});

test("Composer does not add Effect as a dependency or fetch at runtime", () => {
  const manifest = JSON.parse(text("package.json"));
  assert.equal(manifest.dependencies.effect, undefined);
  assert.equal(manifest.devDependencies.effect, undefined);
  assert.doesNotMatch(component, /\bfetch\(/);
  assert.doesNotMatch(component, /from "effect"/);
  assert.doesNotMatch(page, /from "effect"/);
  assert.match(component, /import traceJson from "\.\.\/lib\/effect\/run-trace\.json"/);
  assert.match(page, /<EffectRunDemo client:visible \/>/);
});

test("the demo keeps a no-JavaScript result table and keyboard-native controls", () => {
  assert.match(page, /All five recorded results, without JavaScript/);
  assert.match(page, /<table>/);
  assert.match(component, /type="radio"/);
  assert.match(component, /role="status"/);
  assert.match(component, /aria-live="polite"/);
  assert.doesNotMatch(component, /onKeyDown|tabIndex=\{?-?1\}/);
  assert.match(component, /Start over/);
});

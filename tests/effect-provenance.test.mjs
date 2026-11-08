import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LINKCHECK_COMMIT,
  LINKCHECK_REPOSITORY,
  linkcheckSource,
  outcomeLine,
} from "../src/lib/effect/linkcheck.mjs";

const trace = JSON.parse(
  readFileSync(
    new URL("../src/lib/effect/run-trace.json", import.meta.url),
    "utf8",
  ),
);

test("the recorded Effect trace names the current Link Check source and library", () => {
  assert.equal(trace.contract, 1);
  assert.equal(trace.kind, "effect-batch-trace");
  assert.equal(trace.engine.repository, LINKCHECK_REPOSITORY);
  assert.match(LINKCHECK_COMMIT, /^[a-f0-9]{40}$/);
  // This is the version that actually produced the committed trace. Link Check
  // upgrades must regenerate the trace before this page can claim the new one.
  assert.equal(trace.engine.effect, "4.1.2");
  assert.equal(trace.engine.synthetic, true);
  assert.equal(trace.engine.module, "src/batch.ts");
  assert.equal(trace.engine.tests, "tests/batch.test.mjs");
  assert.equal(
    linkcheckSource(trace.engine.module),
    `${LINKCHECK_REPOSITORY}/blob/${LINKCHECK_COMMIT}/${trace.engine.module}`,
  );
});

test("every recorded scenario keeps bounded evidence and a readable outcome", () => {
  assert.equal(trace.scenarios.length, 5);
  for (const scenario of trace.scenarios) {
    assert.ok(scenario.phases.length > 0, scenario.id);
    assert.ok(scenario.observed.inspectorCalls >= 0, scenario.id);
    assert.ok(outcomeLine(scenario).length > 0, scenario.id);
  }
  assert.deepEqual(
    trace.scenarios.map((scenario) => scenario.id),
    ["ready", "permission", "duplicate", "timeout", "recovery"],
  );
});

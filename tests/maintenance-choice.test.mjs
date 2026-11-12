import test from "node:test";
import assert from "node:assert/strict";
import { handoff, validateSpec } from "../src/lib/spec.mjs";
import { selectedSources } from "../src/lib/app-settings.mjs";

const valid = (patch = {}) => ({
  version: 2,
  preset: "composition",
  sources: selectedSources(["guestbook", "showcase"]),
  config: {
    title: "A fictional corner",
    intro: "Only synthetic fixtures",
    theme: "daylight",
    layout: "grid",
  },
  privacy: "review-first",
  cards: [],
  deployment: { mode: "preview", hostname: "" },
  decisions: {},
  ...patch,
});

test("older specifications without a maintenance choice stay valid and unchanged", () => {
  const spec = validateSpec(valid());
  assert.equal(Object.hasOwn(spec, "maintenance"), false);
  assert.doesNotMatch(handoff(spec), /Optional maintenance task/);
});

test("a chosen task keeps its stable id, revision and assessment scope", () => {
  const spec = validateSpec(
    valid({ maintenance: { task: "health", scope: "assess", revision: 1 } }),
  );
  assert.deepEqual(spec.maintenance, {
    task: "health",
    scope: "assess",
    revision: 1,
  });
  const text = handoff(spec);
  assert.match(text, /Check my app for problems/);
  assert.match(text, /task `health`, revision 1, scope assess and report only/);
  assert.match(text, /https:\/\/composer\.loftwah\.com\/prompts#health/);
  assert.match(text, /A saved choice is not an execution/);
  // The scope default is assessment; no edit or schedule authority is inferred.
  assert.doesNotMatch(text, /automatically (edit|deploy|schedule)/i);
});

test("unknown tasks, scopes and revisions are refused rather than guessed", () => {
  for (const maintenance of [
    { task: "deploy-everything", scope: "assess", revision: 1 },
    { task: "health", scope: "auto-merge", revision: 1 },
    { task: "health", scope: "assess", revision: 2 },
    { task: "health", scope: "assess", revision: 1, owner: "someone" },
    { task: "health", scope: "assess", revision: 1, schedule: "weekly" },
  ])
    assert.throws(() => validateSpec(valid({ maintenance })));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  promptModule,
  promptModules,
  renderPrompt,
} from "../src/lib/prompt-library.ts";

test("the delivery prompt is published with its own job fields", () => {
  const item = promptModule("delivery");
  assert.ok(item);
  assert.equal(item.category, "Operations");
  assert.equal(item.title, "Ship a routine change in five minutes");
  assert.deepEqual(
    item.fields.map((field) => field.key),
    ["project", "goal", "check", "release"],
  );
  assert.equal(item.fields.find((field) => field.key === "goal").required, true);
  assert.ok(promptModules.filter((entry) => entry.id === "delivery").length === 1);
});

test("the rendered prompt keeps the classification, budget and stop rules", () => {
  const text = renderPrompt("delivery", {}, { template: true }).text;
  for (const clause of [
    "five minutes",
    "ROUTINE",
    "NOT ROUTINE",
    "one focused check",
    "single guarded release",
    "Stop at five minutes",
    "Never skip a security, privacy, data-integrity or release gate",
    "fix its selector or scope",
    "Never split one coherent change",
    "Do not add schedulers, GitHub Actions",
  ])
    assert.ok(text.includes(clause), `missing: ${clause}`);
  assert.ok(text.length < 7000);
  assert.doesNotMatch(text, /discord(?:app)?\.com\/api\/webhooks/);
});

test("the completed prompt carries the actual change without secrets", () => {
  const result = renderPrompt("delivery", {
    project: "the selected repository",
    goal: "Fix one broken link on the existing resources page",
    check: "pnpm check:fast -- tests/public-pages.test.mjs",
    release: "pnpm deploy",
  });
  assert.deepEqual(result.missing, []);
  assert.match(result.text, /Fix one broken link/);
  assert.match(result.text, /pnpm check:fast -- tests\/public-pages\.test\.mjs/);
  assert.match(result.text, /pnpm deploy/);
  assert.doesNotMatch(result.text, /password|api[_-]?key|bearer/i);
});

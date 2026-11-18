import test from "node:test";
import assert from "node:assert/strict";
import { focusedTargets } from "../scripts/check-fast.mjs";

test("focused checks require explicit existing test files under tests", () => {
  assert.throws(() => focusedTargets([]), /Name at least one test file/);
  assert.throws(() => focusedTargets(["--"]), /Name at least one test file/);
  assert.throws(() => focusedTargets(["--all"]), /no other options/);
  assert.throws(() => focusedTargets(["tests/helpers/fixture.mjs"]), /Not a test file/);
  assert.throws(() => focusedTargets(["src/example.test.mjs"]), /under tests\//);
  assert.throws(() => focusedTargets(["tests/missing.test.mjs"]), /Missing test file/);
});

test("focused checks deduplicate and order the named test files", () => {
  const targets = focusedTargets([
    "--",
    "tests/core.test.mjs",
    "tests/access-boundary.test.mjs",
    "tests/core.test.mjs",
  ]);
  assert.deepEqual(targets, ["tests/access-boundary.test.mjs", "tests/core.test.mjs"]);
});

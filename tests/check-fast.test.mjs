import test from "node:test";
import assert from "node:assert/strict";
import { focusedStages, focusedTargets, runFocused } from "../scripts/check-fast.mjs";

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
    "tests/page-share.test.mjs",
    "tests/access-boundary.test.mjs",
    "tests/page-share.test.mjs",
  ]);
  assert.deepEqual(targets, ["tests/access-boundary.test.mjs", "tests/page-share.test.mjs"]);
});

test("focused checks keep the full type/source gate ahead of named tests", () => {
  const stages = focusedStages(["tests/page-share.test.mjs"]);
  assert.deepEqual(
    stages.map((stage) => [stage.command, stage.args.join(" ")]),
    [
      ["pnpm", "check:types"],
      ["pnpm", "lint"],
      ["pnpm", "format:check"],
      [process.execPath, "--test tests/page-share.test.mjs"],
    ],
  );
  assert.throws(() => focusedStages([]), /No focused test files/);
});

test("focused run reports each stage and stops at the first failure", () => {
  const calls = [];
  const lines = [];
  let now = 0;
  const stages = [
    { name: "types", command: "pnpm", args: ["check:types"] },
    { name: "tests", command: "node", args: ["--test"] },
    { name: "after", command: "pnpm", args: ["unrelated"] },
  ];
  const failure = new Error("fictional failure");
  const result = runFocused({
    targets: ["tests/example.test.mjs"],
    stages,
    run: (command, args, options) => {
      calls.push([command, ...args]);
      assert.ok(options.cwd.endsWith("/"));
      if (command === "node") throw failure;
      now += 1000;
    },
    log: (line) => lines.push(line),
    now: () => now,
  });
  assert.equal(result.ok, false);
  assert.equal(result.failed, "tests");
  assert.equal(result.error, failure);
  assert.deepEqual(calls, [
    ["pnpm", "check:types"],
    ["node", "--test"],
  ]);
  assert.deepEqual(lines, ["PASS types (1.0s)", "FAIL tests (0.0s)"]);
});

test("a passing focused run reports every stage and no release claim", () => {
  const lines = [];
  let now = 0;
  const result = runFocused({
    targets: ["tests/example.test.mjs"],
    stages: [{ name: "types", command: "pnpm", args: ["check:types"] }],
    run: () => {
      now += 2500;
    },
    log: (line) => lines.push(line),
    now: () => now,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(lines, ["PASS types (2.5s)"]);
  assert.doesNotMatch(lines.join("\n"), /release gate passed/i);
});

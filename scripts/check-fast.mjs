#!/usr/bin/env node
// Focused iteration checks. Runs the same generated-source/type, semantic lint
// and format gates as `pnpm check`, then only the explicitly named test files.
// This is not the release gate: scripts/deploy.mjs runs `pnpm check` and
// `pnpm build` on the exact clean pushed commit before it uploads anything.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../", import.meta.url));

export function focusedTargets(args, directory = workspace) {
  const selectedArgs = args[0] === "--" ? args.slice(1) : args;
  if (!selectedArgs.length)
    throw Error(
      "Name at least one test file, for example: pnpm check:fast -- tests/page-share.test.mjs",
    );
  const tests = resolve(directory, "tests") + sep;
  const selected = new Set();
  for (const argument of selectedArgs) {
    if (argument.startsWith("-"))
      throw Error(
        "check:fast takes test file paths only; it has no other options.",
      );
    const path = resolve(directory, argument);
    if (!path.endsWith(".test.mjs"))
      throw Error("Not a test file: " + argument);
    if (!path.startsWith(tests))
      throw Error("Select a test file under tests/: " + argument);
    if (!existsSync(path) || !statSync(path).isFile())
      throw Error("Missing test file: " + argument);
    selected.add(relative(directory, path));
  }
  return [...selected].sort();
}

export function focusedStages(targets) {
  if (!targets.length) throw Error("No focused test files were selected.");
  return [
    { name: "types and generated source", command: "pnpm", args: ["check:types"] },
    { name: "semantic lint", command: "pnpm", args: ["lint"] },
    { name: "format", command: "pnpm", args: ["format:check"] },
    { name: "focused tests", command: process.execPath, args: ["--test", ...targets] },
  ];
}

function runCommand(command, args, { cwd }) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

export function runFocused({
  targets,
  stages = focusedStages(targets),
  run = runCommand,
  log = console.log,
  now = Date.now,
}) {
  const results = [];
  for (const stage of stages) {
    const started = now();
    try {
      run(stage.command, stage.args, { cwd: workspace });
    } catch (error) {
      results.push({ name: stage.name, state: "failed", durationMs: now() - started });
      for (const result of results) log(summary(result));
      return { ok: false, results, failed: stage.name, error };
    }
    results.push({ name: stage.name, state: "passed", durationMs: now() - started });
  }
  for (const result of results) log(summary(result));
  return { ok: true, results };
}

const summary = ({ name, state, durationMs }) =>
  `${state === "passed" ? "PASS" : "FAIL"} ${name} (${(durationMs / 1000).toFixed(1)}s)`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const targets = focusedTargets(process.argv.slice(2));
    console.log(
      `Focused checks: ${targets.length} test file(s); the full type/source, lint and format gates still run.`,
    );
    const result = runFocused({ targets });
    if (!result.ok) {
      console.error(
        `Focused checks stopped at ${result.failed}. The release gate was not run.`,
      );
      process.exitCode = 1;
    } else
      console.log(
        "Focused checks passed. This is not the release gate: run `pnpm check` and `pnpm build` before release.",
      );
  } catch (error) {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  }
}

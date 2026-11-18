#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../", import.meta.url));

export function focusedTargets(args, directory = workspace) {
  const selectedArgs = args[0] === "--" ? args.slice(1) : args;
  if (!selectedArgs.length)
    throw Error(
      "Name at least one test file, for example: pnpm check:fast -- tests/core.test.mjs",
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const targets = focusedTargets(process.argv.slice(2));
    execFileSync(process.execPath, ["--test", ...targets], {
      cwd: workspace,
      stdio: "inherit",
    });
  } catch (error) {
    if (typeof error.status !== "number") console.error(error.message);
    process.exitCode = error.status || 1;
  }
}

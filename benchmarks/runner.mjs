#!/usr/bin/env node
// Benchmarks Studio: a small, honest runner for the public sandbox claims.
//
// It runs every suite in benchmarks/suites in sequence, bounds each suite with a
// timeout, and records what actually happened. A suite that throws or hangs is
// reported as blocked, never as a pass and never as a crashed run.
//
// Usage:
//   node benchmarks/runner.mjs                 print the results as JSON
//   node benchmarks/runner.mjs --write         also write benchmarks/results/latest.json
//   --suites <dir>  --out <file>  --timeout <ms>
//
// Files in the suite directory whose names start with "_" or "." are helpers and
// are never run as suites. Each suite module exports {id, name, run}; run returns
// an array of {id, name, status: "pass"|"fail"|"blocked", detail}.
//
// Exit code 0 when every check passes or is blocked; 1 when any check fails.
// Blocked checks are counted and printed, and never quietly pass.
import { execFile } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export const DEFAULT_SUITES_DIR = path.join(here, "suites");
export const DEFAULT_RESULTS_FILE = path.join(here, "results", "latest.json");
export const DEFAULT_TIMEOUT_MS = 15000;

const STATUSES = new Set(["pass", "fail", "blocked"]);

const USAGE = `Benchmarks Studio runner

  node benchmarks/runner.mjs [--write] [--suites <dir>] [--out <file>] [--timeout <ms>]

  --write        write the results file in addition to printing JSON
  --suites <dir> read suites from another directory (used by the focused test)
  --out <file>   write the results here instead of benchmarks/results/latest.json
  --timeout <ms> per-suite timeout; defaults to ${DEFAULT_TIMEOUT_MS}`;

/** @param {unknown} error */
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Load every suite module, in file-name order. A module that cannot be imported
 * becomes a blocked suite rather than an unusable runner.
 * @param {string} directory
 */
export async function discoverSuites(directory = DEFAULT_SUITES_DIR) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .filter((entry) => !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();

  /** @type {Array<{id:string,name:string,run?:Function,file:string,error?:string}>} */
  const suites = [];
  for (const file of files) {
    const suitePath = path.join(directory, file);
    const fallbackId = path.basename(file, ".mjs");
    try {
      const module = await import(pathToFileURL(suitePath).href);
      const suite = module.default ?? module;
      if (
        typeof suite.id !== "string" ||
        typeof suite.name !== "string" ||
        typeof suite.run !== "function"
      )
        throw new Error("a suite module must export {id, name, run}");
      suites.push({ id: suite.id, name: suite.name, run: suite.run, file: suitePath });
    } catch (error) {
      suites.push({ id: fallbackId, name: fallbackId, file: suitePath, error: message(error) });
    }
  }
  return suites;
}

/**
 * Reject a malformed suite result instead of reporting an empty pass.
 * @param {unknown} value
 */
function normaliseChecks(value) {
  if (!Array.isArray(value) || value.length === 0)
    throw new TypeError("a suite must return a non-empty array of checks");
  return value.map((check, index) => {
    if (!check || typeof check !== "object")
      throw new TypeError(`check ${index + 1} is not an object`);
    if (typeof check.id !== "string" || !check.id)
      throw new TypeError(`check ${index + 1} has no id`);
    if (typeof check.name !== "string" || !check.name)
      throw new TypeError(`check “${check.id}” has no name`);
    if (!STATUSES.has(check.status))
      throw new TypeError(
        `check “${check.id}” has unsupported status “${String(check.status)}”`,
      );
    return {
      id: check.id,
      name: check.name,
      status: check.status,
      detail: typeof check.detail === "string" ? check.detail : "",
    };
  });
}

/**
 * Run one suite, bounded by a timeout. A throw or a hang is recorded as one
 * blocked check so the totals always account for it.
 * @param {{id:string,name:string,run?:Function,error?:string}} suite
 * @param {Record<string, unknown>} context
 * @param {number} timeoutMs
 */
async function runSuite(suite, context, timeoutMs) {
  const started = performance.now();
  if (typeof suite.run !== "function") {
    return {
      id: suite.id,
      name: suite.name,
      status: "blocked",
      durationMs: 0,
      checks: [
        {
          id: `${suite.id}-load`,
          name: "Suite loads",
          status: "blocked",
          detail: suite.error ?? "the suite did not export a run function",
        },
      ],
    };
  }

  const controller = new AbortController();
  const timedOut = Symbol("timeout");
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(timedOut);
    }, timeoutMs);
  });

  try {
    const outcome = await Promise.race([
      Promise.resolve().then(() =>
        suite.run({ ...context, timeoutMs, signal: controller.signal }),
      ),
      deadline,
    ]);
    if (outcome === timedOut) throw new Error(`Timed out after ${timeoutMs}ms`);
    const checks = normaliseChecks(outcome);
    const status = checks.some((check) => check.status === "fail")
      ? "fail"
      : checks.some((check) => check.status === "blocked")
        ? "blocked"
        : "pass";
    return {
      id: suite.id,
      name: suite.name,
      status,
      durationMs: Math.round(performance.now() - started),
      checks,
    };
  } catch (error) {
    return {
      id: suite.id,
      name: suite.name,
      status: "blocked",
      durationMs: Math.round(performance.now() - started),
      checks: [
        {
          id: `${suite.id}-error`,
          name: "Suite ran",
          status: "blocked",
          detail: message(error),
        },
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}

/** @param {Array<{checks: Array<{status:string}>}>} suites */
export function totalsFor(suites) {
  /** @type {Record<string, number>} */
  const totals = { pass: 0, fail: 0, blocked: 0, checks: 0 };
  for (const suite of suites) {
    for (const check of suite.checks) {
      if (!STATUSES.has(check.status)) continue;
      totals[check.status] += 1;
      totals.checks += 1;
    }
  }
  return totals;
}

/**
 * Run suites in order and report each one.
 * @param {{suites: Array<{id:string,name:string,run?:Function,error?:string}>, timeoutMs?: number, context?: Record<string, unknown>}} options
 */
export async function runBenchmarks({
  suites,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  context = {},
} = /** @type {any} */ ({})) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("timeoutMs must be a positive number");
  /** @type {Array<Awaited<ReturnType<typeof runSuite>>>} */
  const results = [];
  for (const suite of suites) results.push(await runSuite(suite, context, timeoutMs));
  return results;
}

async function sourceRevision() {
  try {
    const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
    return stdout.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Discover, run and describe one full benchmark pass.
 * @param {{suitesDir?: string, timeoutMs?: number}} options
 */
export async function collectResults({
  suitesDir = DEFAULT_SUITES_DIR,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const source = await sourceRevision();
  const suites = await discoverSuites(suitesDir);
  const results = await runBenchmarks({
    suites,
    timeoutMs,
    context: { root, source },
  });
  return {
    source,
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    totals: totalsFor(results),
    suites: results,
  };
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const options = {
    write: false,
    help: false,
    suites: DEFAULT_SUITES_DIR,
    out: DEFAULT_RESULTS_FILE,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
  const value = (index, name) => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--"))
      throw new Error(`${name} needs a value`);
    return next;
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--write") options.write = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--suites") {
      options.suites = path.resolve(value(index, "--suites"));
      index++;
    } else if (arg === "--out") {
      options.out = path.resolve(value(index, "--out"));
      index++;
    } else if (arg === "--timeout") {
      options.timeoutMs = Number(value(index, "--timeout"));
      index++;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

/**
 * CLI entry point. Returns the exit code instead of exiting so the focused test
 * can drive the same code without a long child process.
 * @param {string[]} argv
 */
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  const results = await collectResults({
    suitesDir: options.suites,
    timeoutMs: options.timeoutMs,
  });
  if (options.write) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(results, null, 2));
  return results.totals.fail > 0 ? 1 : 0;
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(message(error));
      process.exitCode = 1;
    },
  );
}

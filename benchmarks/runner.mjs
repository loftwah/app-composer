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
//   node benchmarks/runner.mjs --suite FLOW-01 run one versioned JSON pack
//   --suites <dir>  --out <file>  --timeout <ms>
//
// Files in the suite directory whose names start with "_" or "." are helpers and
// are never run as suites. Each suite module exports {id, name, run}; run returns
// an array of {id, name, status: "pass"|"fail"|"blocked", detail}.
//
// A *.json file in the same directory is a versioned suite pack. It names
// deterministic checks from those modules and is validated by
// src/lib/benchmark-suite.mjs before anything runs. `--suite <id>` runs only the
// checks that pack names; the existing .mjs discovery is unchanged.
//
// Exit code 0 when every check passes or is blocked; 1 when any check fails.
// Blocked checks are counted and printed, and never quietly pass.
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { validateBenchmarkSuite } from "../src/lib/benchmark-suite.mjs";

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export const DEFAULT_SUITES_DIR = path.join(here, "suites");
export const DEFAULT_RESULTS_FILE = path.join(here, "results", "latest.json");
export const DEFAULT_TIMEOUT_MS = 15000;

const STATUSES = new Set(["pass", "fail", "blocked"]);

const USAGE = `Benchmarks Studio runner

  node benchmarks/runner.mjs [--write] [--suite <id>] [--suites <dir>] [--out <file>] [--timeout <ms>]

  --write        write the results file in addition to printing JSON
  --suite <id>   run one versioned JSON pack from --suites (for example FLOW-01)
  --suites <dir> read suites and JSON packs from another directory
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
 * Load and validate every versioned JSON pack. A malformed pack is reported, not
 * silently skipped; `--suite` then refuses to run it.
 * @param {string} directory
 */
export async function discoverSuiteSpecs(directory = DEFAULT_SUITES_DIR) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  /** @type {Array<{file:string,spec:any,summary:any,error?:string}>} */
  const packs = [];
  for (const file of files) {
    const filePath = path.join(directory, file);
    try {
      const spec = JSON.parse(await readFile(filePath, "utf8"));
      const validation = validateBenchmarkSuite(spec);
      packs.push({
        file: filePath,
        spec,
        summary: validation.summary,
        error: validation.ok
          ? undefined
          : validation.issues.map((issue) => `${issue.code}: ${issue.detail}`).join("; "),
      });
    } catch (error) {
      packs.push({ file: filePath, spec: null, summary: null, error: message(error) });
    }
  }
  return packs;
}

/**
 * Resolve one pack by its declared id or file stem. The id is the stable
 * interface; the stem is accepted for a local convenience only.
 * @param {string} id
 * @param {string} directory
 */
export async function findSuiteSpec(id, directory = DEFAULT_SUITES_DIR) {
  const wanted = String(id).trim();
  if (!wanted) throw new Error("--suite needs a pack id");
  const packs = await discoverSuiteSpecs(directory);
  const match = packs.find((pack) => {
    const stem = path.basename(pack.file, ".json");
    return (
      pack.summary?.id?.toLowerCase() === wanted.toLowerCase() ||
      stem.toLowerCase() === wanted.toLowerCase()
    );
  });
  if (!match) {
    const known = packs
      .map((pack) => pack.summary?.id ?? path.basename(pack.file, ".json"))
      .join(", ");
    throw new Error(`Unknown suite pack: ${wanted}. Known: ${known || "none"}`);
  }
  if (match.error) throw new Error(`Suite pack ${wanted} is invalid: ${match.error}`);
  return match;
}

/**
 * Run only the checks a pack names. Every module is imported from the same
 * suite directory, so a pack cannot point at arbitrary code. A missing check or
 * a module that throws is a fail/blocked result, never a silent pass.
 * @param {{spec:any, summary:any}} pack
 * @param {{directory?:string, timeoutMs?:number, context?:Record<string, unknown>}} options
 */
export async function runSuitePack(pack, options = {}) {
  const directory = options.directory ?? DEFAULT_SUITES_DIR;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const context = options.context ?? {};
  const groups = new Map();
  for (const check of pack.summary.checks) {
    const list = groups.get(check.module) ?? [];
    list.push(check.id);
    groups.set(check.module, list);
  }
  const results = [];
  for (const [moduleName, ids] of groups) {
    let loaded = null;
    try {
      loaded = await import(pathToFileURL(path.join(directory, `${moduleName}.mjs`)).href);
    } catch (error) {
      loaded = { error: message(error) };
    }
    const suite = loaded?.default ?? loaded;
    if (!suite || typeof suite.run !== "function") {
      results.push(
        await runSuite(
          {
            id: moduleName,
            name: moduleName,
            error: suite?.error ?? "the pack module did not export a run function",
          },
          context,
          timeoutMs,
        ),
      );
      continue;
    }
    results.push(
      await runSuite(
        {
          id: moduleName,
          name: suite.name ?? moduleName,
          run: async (suiteContext) => {
            const checks = await suite.run(suiteContext);
            const byId = new Map(
              (Array.isArray(checks) ? checks : []).map((check) => [check?.id, check]),
            );
            return ids.map(
              (id) =>
                byId.get(id) ?? {
                  id,
                  name: `Check ${id} exists`,
                  status: "fail",
                  detail: `${moduleName} did not return the check ${id} named by the pack.`,
                },
            );
          },
        },
        context,
        timeoutMs,
      ),
    );
  }
  const checks = results.flatMap((result) => result.checks);
  const status = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "blocked")
      ? "blocked"
      : "pass";
  return {
    id: pack.summary.id,
    name: pack.summary.name,
    status,
    durationMs: results.reduce((total, result) => total + (result.durationMs ?? 0), 0),
    checks,
  };
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
 * Discover, run and describe one full benchmark pass. With `suiteId`, only that
 * validated JSON pack runs; without it, the existing .mjs discovery is exactly
 * as before.
 * @param {{suitesDir?: string, timeoutMs?: number, suiteId?: string}} options
 */
export async function collectResults({
  suitesDir = DEFAULT_SUITES_DIR,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  suiteId = "",
} = {}) {
  const source = await sourceRevision();
  let results;
  let pack = null;
  if (suiteId) {
    pack = await findSuiteSpec(suiteId, suitesDir);
    results = [
      await runSuitePack(pack, {
        directory: suitesDir,
        timeoutMs,
        context: { root, source },
      }),
    ];
  } else {
    const suites = await discoverSuites(suitesDir);
    results = await runBenchmarks({
      suites,
      timeoutMs,
      context: { root, source },
    });
  }
  return {
    source,
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    totals: totalsFor(results),
    suites: results,
    ...(pack
      ? {
          pack: {
            id: pack.summary.id,
            schema: pack.spec.schema,
            providerFree: pack.summary.providerFree,
            evidence: pack.summary.evidence,
          },
        }
      : {}),
  };
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const options = {
    write: false,
    help: false,
    suite: "",
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
    else if (arg === "--suite") {
      options.suite = value(index, "--suite");
      index++;
    } else if (arg === "--suites") {
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
  if (options.suite && options.write && options.out === DEFAULT_RESULTS_FILE)
    throw new Error(
      "--suite needs --out when --write is used; a single pack must not replace the full benchmark record.",
    );
  const results = await collectResults({
    suitesDir: options.suites,
    timeoutMs: options.timeoutMs,
    suiteId: options.suite,
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

#!/usr/bin/env node
// Benchmarks Studio comparison track.
//
// Runs the same frozen brief through more than one agent configuration, judges
// every trial from the bytes it produced, and records the result so the site can
// show a comparison instead of a claim. Two runners are supported:
//
//   codex    the local Codex CLI, one isolated directory per trial
//   ingest   a directory of files produced by another harness (for example an
//            agent working through a different tool); nothing is executed here
//
// Usage:
//   node benchmarks/compare/run.mjs --configurations gpt-5.6-sol,gpt-5.6-terra
//   node benchmarks/compare/run.mjs --configurations opencode-deepseek --ingest-root <dir>
//   node benchmarks/compare/run.mjs --merge          merge compare.json files from a directory
//
// Every trial is written under public/benchmarks/trials so the comparison page can
// open the real page a configuration produced. A trial that cannot start, times
// out or leaves unusable files is recorded as blocked or failed, never as passed.
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { evaluateTrial, REQUIRED_FILES } from "../../src/lib/benchmark-compare.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const taskFile = path.join(here, "task.json");
const configurationsFile = path.join(here, "configurations.json");
const defaultOut = path.join(root, "benchmarks/results/compare.json");
const defaultTrialsRoot = path.join(root, "public/benchmarks/trials");
const defaultTimeoutMs = 240_000;

const USAGE = `Benchmarks Studio comparison runner

  node benchmarks/compare/run.mjs --configurations <ids> [options]
  node benchmarks/compare/run.mjs --agent-search [--out=directory]

  --configurations   comma-separated configuration ids from configurations.json
  --trials <n>       trials per configuration; defaults to the configured count
  --ingest-root <d>  for a runner of kind "ingest", the directory holding t1..tN
  --out <file>       results file; defaults to benchmarks/results/compare.json
  --trials-root <d>  where produced pages are published; defaults to public/benchmarks/trials
  --timeout <ms>     per-trial wall-clock bound; defaults to ${defaultTimeoutMs}
  --merge <files>    merge several compare.json files into one comparison
  --dry-run          print the plan without running anything`;

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const args = { trials: "", merge: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "dry-run") {
      args[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

/** @param {string} file */
async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

/** @param {string} value */
export function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** @param {string} value */
function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Run a command with stdin closed straight away. Some agent CLIs read standard
 * input until end-of-file and will otherwise wait forever, so closing it is part
 * of running them unattended rather than an incidental detail.
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd: string, timeoutMs: number, env?: Record<string,string|undefined>}} options
 */
export function runCommand(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const bound = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      if (stdout.length < 24 * 1024 * 1024) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4 * 1024 * 1024) stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(bound);
      resolve({ stdout, stderr: `${stderr}${error.message}`, timedOut, code: null });
    });
    child.on("close", (code) => {
      clearTimeout(bound);
      resolve({ stdout, stderr, timedOut, code });
    });
    child.stdin.end();
  });
}

/**
 * Read the three brief files out of a directory. Anything else is ignored here
 * and reported by the evaluation as an extra file.
 * @param {string} directory
 */
async function collectArtifacts(directory) {
  /** @type {Record<string,string>} */
  const files = {};
  /** @type {Record<string,string>} */
  const hashes = {};
  for (const name of REQUIRED_FILES) {
    const file = path.join(directory, name);
    if (!existsSync(file)) continue;
    const body = await readFile(file, "utf8");
    files[name] = body;
    hashes[name] = sha256(body);
  }
  return { files, hashes };
}

/**
 * A rate card is operator input, never a guess. When a model has no entry the
 * estimate is null and the page says unknown rather than printing a made-up
 * number.
 * @param {{rateCard?: Record<string, {inputPerMillion?: number, outputPerMillion?: number, basis?: string}>}} configuration
 * @param {{input_tokens?: number, output_tokens?: number} | null} usage
 */
export function estimateCostMicro(configuration, usage) {
  const rates = configuration?.rateCard ?? null;
  if (!rates || !usage) return { estimateMicro: null, basis: "No recorded rate card." };
  const input = Number(usage.input_tokens ?? NaN);
  const output = Number(usage.output_tokens ?? NaN);
  if (!Number.isFinite(input) || !Number.isFinite(output)) {
    return { estimateMicro: null, basis: "Usage was reported without token counts." };
  }
  if (!Number.isFinite(rates.inputPerMillion) || !Number.isFinite(rates.outputPerMillion)) {
    return { estimateMicro: null, basis: rates.basis ?? "No token prices recorded for this model." };
  }
  const micro = (input / 1_000_000) * rates.inputPerMillion * 1_000_000 + (output / 1_000_000) * rates.outputPerMillion * 1_000_000;
  return {
    estimateMicro: Math.round(micro),
    basis: rates.basis ?? "Estimated from the recorded rate card and reported token usage.",
  };
}

/**
 * Pull the last usage block out of a Codex JSON event stream. The CLI reports
 * tokens; it does not report an invoice, so providerChargedMicro stays null.
 * @param {string} output
 */
export function parseCodexUsage(output) {
  let usage = null;
  for (const line of String(output).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes('"usage"')) continue;
    try {
      const event = JSON.parse(trimmed);
      const candidate = event?.usage ?? event?.msg?.usage ?? event?.message?.usage ?? null;
      if (candidate && Number.isFinite(Number(candidate.input_tokens))) usage = candidate;
    } catch {
      const match = trimmed.match(/"usage":\s*(\{[^}]*\})/);
      if (!match) continue;
      try {
        usage = JSON.parse(match[1]);
      } catch {
        /* ignore an unparsable fragment */
      }
    }
  }
  return usage;
}

/**
 * Run one trial of one configuration. The directory is disposable and owned by
 * this process.
 * @param {any} configuration
 * @param {number} index
 * @param {{task: any, timeoutMs: number, trialsRoot: string}} options
 */
async function runTrial(configuration, index, options) {
  const { task, timeoutMs, trialsRoot } = options;
  const startedAt = new Date().toISOString();
  const started = Date.now();
  if (configuration.runner?.kind === "ingest") {
    const dir = path.join(configuration.runner.ingestRoot, `t${index}`);
    const artifacts = await collectArtifacts(dir);
    const evaluation = evaluateTrial({ files: artifacts.files });
    const published = await publishTrial({ configuration, index, artifacts, trialsRoot, startedAt, host: "" });
    return {
      id: `${configuration.id}-t${index}`,
      index,
      status: artifacts.files["index.html"] ? evaluation.status : "blocked",
      startedAt,
      durationMs: null,
      checks: evaluation.checks,
      failed: evaluation.failed,
      artifacts: artifacts.hashes,
      previewUrl: published.previewUrl,
      usage: null,
      cost: {
        estimateMicro: null,
        providerChargedMicro: null,
        chargeSource: "not reported",
        basis: "Ingested output. No usage was reported by the producing harness.",
      },
      note: artifacts.files["index.html"] ? undefined : `No files were produced in ${dir}.`,
    };
  }

  const directory = await mkdtemp(path.join(tmpdir(), `compare-${slug(configuration.id)}-`));
  try {
    const { stdout, stderr, timedOut } = await runCommand(
      configuration.runner.command,
      [...(configuration.runner.args ?? []), task.brief],
      { cwd: directory, timeoutMs, env: { ...process.env, ...(configuration.runner.env ?? {}) } },
    );
    const durationMs = Date.now() - started;
    const artifacts = await collectArtifacts(directory);
    const produced = Object.keys(artifacts.files).length > 0;
    const evaluation = evaluateTrial({ files: artifacts.files });
    const usage = parseCodexUsage(stdout);
    const cost = estimateCostMicro(configuration, usage);
    const published = await publishTrial({ configuration, index, artifacts, trialsRoot, startedAt, host: configuration.runner.previewHost ?? "" });
    const status = !produced ? "blocked" : timedOut ? "fail" : evaluation.status;
    const note = !produced
      ? timedOut
        ? `The run hit the ${timeoutMs}ms bound without writing a page.`
        : `The harness exited without producing the brief files. ${stderr.trim().split("\n").slice(-3).join(" ")}`.trim()
      : timedOut
        ? `The run wrote files but was still working when the ${timeoutMs}ms bound ended.`
        : undefined;
    return {
      id: `${configuration.id}-t${index}`,
      index,
      status,
      startedAt,
      durationMs,
      checks: evaluation.checks,
      failed: evaluation.failed,
      artifacts: artifacts.hashes,
      previewUrl: published.previewUrl,
      usage: usage
        ? {
            inputTokens: Number(usage.input_tokens ?? 0) || null,
            outputTokens: Number(usage.output_tokens ?? 0) || null,
            cachedInputTokens: Number(usage.cached_input_tokens ?? 0) || null,
          }
        : null,
      cost: {
        estimateMicro: cost.estimateMicro,
        providerChargedMicro: null,
        chargeSource: cost.estimateMicro === null ? "not reported" : "estimate only",
        basis: `${cost.basis} The CLI reports tokens, not an invoice, so no provider charge is recorded.`,
      },
      note,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Copy a trial's page into the site so the comparison is playable rather than a
 * screenshot. Inline style and script are stripped defensively; the evaluation
 * already fails a trial that contains them, and this keeps a failing trial's page
 * from becoming an injection route on the public site.
 * @param {{configuration: any, index: number, artifacts: {files: Record<string,string>}, trialsRoot: string, startedAt: string, host: string}} input
 */
async function publishTrial(input) {
  const { configuration, index, artifacts, trialsRoot, startedAt, host } = input;
  const dir = path.join(trialsRoot, slug(configuration.id), `t${index}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const clean = (value) =>
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\sstyle\s*=\s*"[^"]*"/gi, "")
      .replace(/\sstyle\s*=\s*'[^']*'/gi, "");
  for (const [name, body] of Object.entries(artifacts.files)) {
    const target = path.join(dir, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, name.endsWith(".html") ? clean(body) : body, "utf8");
  }
  await writeFile(
    path.join(dir, "trial.json"),
    JSON.stringify({ configuration: configuration.id, trial: index, publishedAt: startedAt }, null, 2),
    "utf8",
  );
  const previewUrl = host
    ? `${host.replace(/\/$/, "")}/benchmarks/trials/${slug(configuration.id)}/t${index}/index.html`
    : `/benchmarks/trials/${slug(configuration.id)}/t${index}/index.html`;
  return { previewUrl, dir };
}

/**
 * Run every requested configuration and return the record the page reads.
 * @param {{configurations: any[], task: any, trials?: number, timeoutMs?: number, trialsRoot?: string}} options
 */
export async function runComparison(options) {
  const { configurations, task } = options;
  const trials = Number(options.trials) || 0;
  const timeoutMs = Number(options.timeoutMs) || defaultTimeoutMs;
  const trialsRoot = options.trialsRoot ?? defaultTrialsRoot;
  const recorded = [];
  for (const configuration of configurations) {
    const count = trials || Number(configuration.trials) || 3;
    const rows = [];
    for (let index = 1; index <= count; index += 1) {
      rows.push(await runTrial(configuration, index, { task, timeoutMs, trialsRoot }));
    }
    recorded.push({
      id: configuration.id,
      label: configuration.label ?? configuration.id,
      model: configuration.model ?? configuration.runner?.model ?? "unknown",
      resolvedModel: configuration.resolvedModel ?? configuration.model ?? "unknown",
      harness: configuration.harness ?? "unknown",
      harnessVersion: configuration.harnessVersion ?? "unknown",
      settings: configuration.settings ?? {},
      runnerKind: configuration.runner?.kind ?? "unknown",
      trials: rows,
    });
  }
  return {
    schema: "benchmark-compare/v1",
    task: {
      id: task.id,
      version: task.version,
      title: task.title,
      category: task.category,
      capability: task.capability,
      briefSha256: sha256(task.brief),
      assertions: task.assertions,
    },
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    configurations: recorded,
  };
}

/**
 * Merge comparison files that were produced in different places: for example one
 * harness on this machine and another on a separate runner.
 * @param {string[]} files
 */
export async function mergeComparisons(files) {
  const loaded = [];
  for (const file of files) loaded.push(await readJson(file));
  if (loaded.length === 0) throw new Error("merge needs at least one comparison file.");
  const [first] = loaded;
  const configurations = loaded.flatMap((entry) => entry.configurations ?? []);
  const ids = new Set();
  for (const configuration of configurations) {
    if (ids.has(configuration.id)) throw new Error(`Duplicate configuration id: ${configuration.id}`);
    ids.add(configuration.id);
  }
  return {
    ...first,
    generatedAt: new Date().toISOString(),
    mergedFrom: loaded.map((entry) => entry.sourceVersion ?? "unknown"),
    configurations,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (typeof args.merge === "string" && args.merge) {
    const merged = await mergeComparisons(args.merge.split(",").map((value) => path.resolve(value.trim())));
    const out = typeof args.out === "string" ? args.out : defaultOut;
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(
      out,
      JSON.stringify({ ...merged, sourceVersion: process.env.COMPARE_SOURCE_VERSION ?? undefined }, null, 2),
      "utf8",
    );
    console.log(`merged ${merged.configurations.length} configurations → ${out}`);
    return;
  }

  const task = await readJson(taskFile);
  const catalogue = await readJson(configurationsFile);
  const requested = typeof args.configurations === "string" ? args.configurations.split(",").map((id) => id.trim()).filter(Boolean) : [];
  if (requested.length === 0) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const configurations = requested.map((id) => {
    const found = (catalogue.configurations ?? []).find((entry) => entry.id === id);
    if (!found) throw new Error(`Unknown configuration: ${id}. Known: ${(catalogue.configurations ?? []).map((entry) => entry.id).join(", ")}`);
    return {
      ...found,
      runner: {
        ...found.runner,
        ...(typeof args["ingest-root"] === "string" && found.runner?.kind === "ingest" ? { ingestRoot: path.resolve(args["ingest-root"]) } : {}),
      },
    };
  });
  if (args["dry-run"]) {
    console.log(JSON.stringify({ task: task.id, trials: Number(args.trials) || null, configurations }, null, 2));
    return;
  }
  const result = await runComparison({
    configurations,
    task,
    trials: typeof args.trials === "string" ? Number(args.trials) : 0,
    timeoutMs: typeof args.timeout === "string" ? Number(args.timeout) : defaultTimeoutMs,
    trialsRoot: typeof args["trials-root"] === "string" ? path.resolve(args["trials-root"]) : defaultTrialsRoot,
  });
  const out = typeof args.out === "string" ? path.resolve(args.out) : defaultOut;
  await mkdir(path.dirname(out), { recursive: true });
  const withSource = { ...result, sourceVersion: process.env.COMPARE_SOURCE_VERSION ?? undefined };
  await writeFile(out, JSON.stringify(withSource, null, 2), "utf8");
  const failed = result.configurations.flatMap((configuration) => configuration.trials).filter((trial) => trial.status === "fail").length;
  const blocked = result.configurations.flatMap((configuration) => configuration.trials).filter((trial) => trial.status === "blocked").length;
  console.log(`recorded ${result.configurations.length} configurations → ${out}`);
  console.log(`${failed} failed, ${blocked} blocked`);
  process.exitCode = failed > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURLSafe(process.argv[1])) {
  if (process.argv[2] === "--agent-search") {
    const { runAgentSearch } = await import("../agent-search/experiment.mjs");
    await runAgentSearch(process.argv.slice(3), { runCommand, parseCodexUsage });
  } else {
    await main();
  }
}

/** @param {string|undefined} value */
function pathToFileURLSafe(value) {
  if (!value) return "";
  try {
    return new URL(`file://${path.resolve(value)}`).href;
  } catch {
    return "";
  }
}

export { collectArtifacts, publishTrial, main, cp };

// Benchmarks Studio: deterministic ingestion for release-timing/v1 receipts.
//
// A receipt is private release evidence. It stays in the releasing repository's
// ignored .release/timing directory; this module validates it, reduces it to the
// fields that are safe to compare, and refuses anything it cannot publish
// honestly. It never executes a receipt, calls a provider, invents a cost or
// names a winner.
//
// Canonical receipt contract: loftwah/app-composer#624.
// Portable ingest notes: benchmarks/release-timing/README.md

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  RECEIPT_SCHEMA,
  assertReceipt,
  classifyDuration,
  COMPOSER_LIMIT_MS,
  LIMIT_MS,
  redact,
} from "../../lib/delivery/release-timing.mjs";

export const PACK_SCHEMA = "release-timing-pack/v1";
export const REPORT_SCHEMA = "release-timing-report/v1";
export const STATUSES = ["passed", "over-budget", "failed", "incomplete"];

const REQUIRED_FIELDS = [
  "schema",
  "version",
  "repo",
  "project",
  "sha",
  "runId",
  "kind",
  "releasePath",
  "targetMs",
  "limitMs",
  "startedAt",
  "endedAt",
  "totalMs",
  "stages",
  "status",
  "failure",
  "notes",
  "alert",
  "coverage",
];
const OPTIONAL_FIELDS = ["unmeasuredMs", "liveRevision"];
const KNOWN_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
const KNOWN_STAGE_FIELDS = new Set(["name", "durationMs"]);
const KNOWN_ALERT_FIELDS = new Set(["state", "issue", "fingerprint"]);
const KNOWN_PACK_FIELDS = new Set(["schema", "note", "receipts"]);
const ALERT_STATES = new Set(["none", "created", "updated", "pending"]);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const OWNER_NAME = /^[^/\s]+\/[^/\s]+$/;
const URL = /(?:https?:\/\/|www\.)/i;
const ABSOLUTE_PATH = /(?:^|[\s"'(])(?:\/(?:Users|home|private|var|tmp)\/|[A-Za-z]:[\\/]|\\\\)/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertText(value, field, where) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${where} ${field} is invalid`);
  }
  return value;
}

function assertPublishable(value, field, where) {
  if (URL.test(value)) {
    throw new Error(`${where} ${field} contains a URL; only repository-relative evidence is compared`);
  }
  if (ABSOLUTE_PATH.test(value)) {
    throw new Error(`${where} ${field} contains an absolute path; only repository-relative evidence is compared`);
  }
}

function assertIso(value, field, where) {
  if (typeof value !== "string" || !ISO_UTC.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${where} ${field} is not an ISO UTC timestamp`);
  }
  return value;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function slowestStage(stages) {
  let slowest = null;
  for (const stage of stages) {
    if (
      !slowest ||
      stage.durationMs > slowest.durationMs ||
      (stage.durationMs === slowest.durationMs && compare(stage.name, slowest.name) < 0)
    ) {
      slowest = stage;
    }
  }
  return { name: slowest.name, durationMs: slowest.durationMs };
}

/**
 * Validate one finished release-timing/v1 receipt and reduce it to the fields
 * that may leave the private receipt directory.
 * @param {unknown} receipt
 * @param {{source?: string}} [options]
 */
export function validateReceipt(receipt, { source = "receipt" } = {}) {
  const where = `${source}:`;
  if (!isObject(receipt)) throw new Error(`${where} receipt is not an object`);

  try {
    assertReceipt(receipt);
  } catch (error) {
    throw new Error(`${where} ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const key of Object.keys(receipt)) {
    if (!KNOWN_FIELDS.has(key)) throw new Error(`${where} unknown field "${key}"`);
  }
  for (const key of REQUIRED_FIELDS) {
    if (!(key in receipt)) throw new Error(`${where} missing field "${key}"`);
  }
  if (receipt.version !== 1) throw new Error(`${where} version must be 1`);

  const repo = assertText(receipt.repo, "repo", where);
  if (!OWNER_NAME.test(repo)) throw new Error(`${where} repo is not an owner/name repository`);
  const project = assertText(receipt.project, "project", where);
  const kind = assertText(receipt.kind, "kind", where);
  const releasePath = assertText(receipt.releasePath, "releasePath", where);
  const runId = assertText(receipt.runId, "runId", where);
  const status = assertText(receipt.status, "status", where);

  if (!STATUSES.includes(status)) {
    const running = status === "running" ? " (a run in progress is not finished evidence)" : "";
    throw new Error(`${where} unsupported status "${status}"${running}`);
  }

  if (!Number.isFinite(receipt.targetMs) || receipt.targetMs <= 0) {
    throw new Error(`${where} targetMs is invalid`);
  }
  if (![COMPOSER_LIMIT_MS, LIMIT_MS].includes(receipt.limitMs)) {
    throw new Error(`${where} limitMs must be ${COMPOSER_LIMIT_MS} or ${LIMIT_MS}`);
  }
  if (receipt.targetMs > receipt.limitMs) {
    throw new Error(`${where} targetMs is above the strict limit`);
  }

  const startedAt = assertIso(receipt.startedAt, "startedAt", where);
  const endedAt = assertIso(receipt.endedAt, "endedAt", where);
  if (Date.parse(endedAt) < Date.parse(startedAt)) {
    throw new Error(`${where} endedAt is before startedAt`);
  }

  if (!Array.isArray(receipt.stages) || receipt.stages.length === 0) {
    throw new Error(`${where} stages are missing`);
  }
  for (const [index, stage] of receipt.stages.entries()) {
    const at = `${where} stage ${index + 1}`;
    if (!isObject(stage)) throw new Error(`${at} is not an object`);
    for (const key of Object.keys(stage)) {
      if (!KNOWN_STAGE_FIELDS.has(key)) throw new Error(`${at} has unknown field "${key}"`);
    }
    assertText(stage.name, "name", at);
    if (!Number.isFinite(stage.durationMs) || stage.durationMs < 0) {
      throw new Error(`${at} durationMs is invalid`);
    }
  }

  const measuredMs = receipt.stages.reduce((total, stage) => total + stage.durationMs, 0);
  const unmeasuredMs =
    receipt.unmeasuredMs === undefined
      ? Math.max(0, receipt.totalMs - measuredMs)
      : receipt.unmeasuredMs;
  if (!Number.isFinite(unmeasuredMs) || unmeasuredMs < 0 || unmeasuredMs > receipt.totalMs) {
    throw new Error(`${where} unmeasuredMs is invalid`);
  }
  const impliedUnmeasured = Math.max(0, receipt.totalMs - measuredMs);
  if (unmeasuredMs + Math.max(2, receipt.stages.length) < impliedUnmeasured) {
    throw new Error(`${where} unmeasuredMs hides time the stages do not account for`);
  }

  const expected = classifyDuration(receipt.totalMs, { limitMs: receipt.limitMs });
  if ((status === "passed" || status === "over-budget") && status !== expected) {
    throw new Error(
      `${where} status "${status}" does not match the measured total (${receipt.totalMs}ms is ${expected})`,
    );
  }

  if (!isObject(receipt.notes)) throw new Error(`${where} notes are invalid`);
  const liveRevision = receipt.notes.liveRevision ?? receipt.liveRevision ?? null;
  if (liveRevision !== null) {
    if (typeof liveRevision !== "string" || !/^[0-9a-f]{40}$/.test(liveRevision)) {
      throw new Error(`${where} live revision is invalid`);
    }
    if (liveRevision !== receipt.sha) {
      throw new Error(`${where} live revision does not match the source SHA`);
    }
  }
  if ((status === "passed" || status === "over-budget") && liveRevision === null) {
    throw new Error(`${where} receipt does not record the verified live revision`);
  }

  const coverage = receipt.notes.coverage ?? receipt.coverage;
  assertText(coverage, "coverage", where);
  if (
    typeof receipt.notes.coverage === "string" &&
    typeof receipt.coverage === "string" &&
    receipt.notes.coverage !== receipt.coverage
  ) {
    throw new Error(`${where} coverage labels disagree`);
  }

  if (receipt.failure !== null && typeof receipt.failure !== "string") {
    throw new Error(`${where} failure is invalid`);
  }

  if (!isObject(receipt.alert)) throw new Error(`${where} alert is invalid`);
  for (const key of Object.keys(receipt.alert)) {
    if (!KNOWN_ALERT_FIELDS.has(key)) throw new Error(`${where} alert has unknown field "${key}"`);
  }
  if (!ALERT_STATES.has(receipt.alert.state)) throw new Error(`${where} alert state is invalid`);
  if (
    receipt.alert.issue !== null &&
    (!Number.isInteger(receipt.alert.issue) || receipt.alert.issue <= 0)
  ) {
    throw new Error(`${where} alert issue is invalid`);
  }
  if (
    receipt.alert.fingerprint !== null &&
    (typeof receipt.alert.fingerprint !== "string" || !/^[0-9a-f]{16}$/.test(receipt.alert.fingerprint))
  ) {
    throw new Error(`${where} alert fingerprint is invalid`);
  }

  // A receipt that redact() would change is carrying a credential, a signed URL
  // or an oversized blob. Refuse it rather than quietly publishing a partial
  // copy, because the caller cannot tell which value was removed.
  if (JSON.stringify(redact(receipt)) !== JSON.stringify(receipt)) {
    throw new Error(`${where} receipt contains secret-shaped data; redact it before sharing`);
  }

  for (const [field, value] of [
    ["repo", repo],
    ["project", project],
    ["kind", kind],
    ["releasePath", releasePath],
    ["runId", runId],
    ["status", status],
    ["coverage", coverage],
    ...receipt.stages.map((stage, index) => [`stage ${index + 1} name`, stage.name]),
  ]) {
    assertPublishable(value, field, where);
  }

  return {
    repo,
    project,
    sha: receipt.sha,
    runId,
    kind,
    releasePath,
    startedAt,
    endedAt,
    totalMs: receipt.totalMs,
    status,
    targetMs: receipt.targetMs,
    limitMs: receipt.limitMs,
    slowestStage: slowestStage(receipt.stages),
    measuredMs,
    unmeasuredMs,
    coveragePct:
      receipt.totalMs === 0
        ? 100
        : round2((Math.min(measuredMs, receipt.totalMs) / receipt.totalMs) * 100),
    coverage,
    alertState: receipt.alert.state,
  };
}

/**
 * Validate receipts in one batch and refuse a repeated run id. A duplicate run
 * id would make the comparison count the same release twice.
 * @param {unknown[]} receipts
 * @param {{source?: string}} [options]
 */
export function ingestReceipts(receipts, { source = "pack" } = {}) {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    throw new Error(`${source}: receipts must be a non-empty array`);
  }
  const entries = [];
  const seen = new Map();
  for (const [index, receipt] of receipts.entries()) {
    const entry = validateReceipt(receipt, { source: `${source}[${index + 1}]` });
    if (seen.has(entry.runId)) {
      throw new Error(
        `${source}[${index + 1}]: duplicate run id "${entry.runId}" (already in ${seen.get(entry.runId)})`,
      );
    }
    seen.set(entry.runId, `${source}[${index + 1}]`);
    entries.push(entry);
  }
  return entries;
}

/**
 * Read a portable pack, or a single receipt, without executing anything.
 * @param {unknown} document
 * @param {{source?: string}} [options]
 */
export function parsePack(document, { source = "pack" } = {}) {
  if (!isObject(document)) throw new Error(`${source}: pack is not an object`);
  if (document.schema === RECEIPT_SCHEMA) return [document];
  if (document.schema !== PACK_SCHEMA) {
    throw new Error(`${source}: unknown schema "${String(document.schema)}"`);
  }
  for (const key of Object.keys(document)) {
    if (!KNOWN_PACK_FIELDS.has(key)) throw new Error(`${source}: unknown pack field "${key}"`);
  }
  if (document.note !== undefined) {
    if (typeof document.note !== "string") throw new Error(`${source}: note is invalid`);
    if (redact(document.note) !== document.note) {
      throw new Error(`${source}: note contains secret-shaped data`);
    }
  }
  if (!Array.isArray(document.receipts) || document.receipts.length === 0) {
    throw new Error(`${source}: receipts must be a non-empty array`);
  }
  return document.receipts;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** @param {string} file */
export function loadPack(file) {
  return ingestReceipts(parsePack(readJson(file), { source: file }), { source: file });
}

/**
 * @param {string} directory
 * @param {{onUnfinished?: () => void}} [options]
 */
export function loadReceiptDirectory(directory, { onUnfinished } = {}) {
  if (!existsSync(directory)) throw new Error(`receipt directory not found: ${directory}`);
  const names = readdirSync(directory)
    .filter((name) => /^receipt-.*\.json$/.test(name))
    .sort(compare);
  if (names.length === 0) throw new Error(`no receipt-*.json files in ${directory}`);
  const entries = [];
  const seen = new Map();
  for (const name of names) {
    const source = join(directory, name);
    const receipt = readJson(source);
    if (receipt?.schema === RECEIPT_SCHEMA && receipt.status === "running") {
      try {
        assertReceipt(receipt);
      } catch (error) {
        throw new Error(`${source}: ${error instanceof Error ? error.message : String(error)}`);
      }
      onUnfinished?.();
      continue;
    }
    const entry = validateReceipt(receipt, { source });
    if (seen.has(entry.runId)) {
      throw new Error(`${source}: duplicate run id "${entry.runId}" (already in ${seen.get(entry.runId)})`);
    }
    seen.set(entry.runId, source);
    entries.push(entry);
  }
  if (entries.length === 0) throw new Error(`no finished receipts in ${directory}`);
  return entries;
}

function compareEntries(left, right) {
  return compare(left.endedAt, right.endedAt) || compare(left.runId, right.runId);
}

/**
 * Group safe receipt summaries by repository and release path.
 * @param {ReturnType<typeof validateReceipt>[]} entries
 */
export function buildReport(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("report needs at least one validated receipt");
  }
  const groups = new Map();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.repo !== "string" ||
      typeof entry.releasePath !== "string" ||
      !STATUSES.includes(entry.status) ||
      typeof entry.slowestStage?.name !== "string" ||
      !Number.isFinite(entry.totalMs) ||
      !Number.isFinite(entry.coveragePct)
    ) {
      throw new Error("report entries must come from validateReceipt");
    }
    const key = `${entry.repo}\n${entry.releasePath}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const report = {
    schema: REPORT_SCHEMA,
    runs: entries.length,
    groups: [],
  };
  for (const groupEntries of groups.values()) {
    const history = groupEntries.slice().sort(compareEntries);
    const latest = history[history.length - 1];
    const statuses = { passed: 0, "over-budget": 0, failed: 0, incomplete: 0 };
    for (const entry of history) statuses[entry.status] += 1;
    report.groups.push({
      repo: latest.repo,
      releasePath: latest.releasePath,
      runs: history.length,
      status: latest.status,
      statuses,
      targetMs: latest.targetMs,
      limitMs: latest.limitMs,
      totalMs: latest.totalMs,
      slowestStage: latest.slowestStage,
      measuredMs: latest.measuredMs,
      unmeasuredMs: latest.unmeasuredMs,
      coveragePct: latest.coveragePct,
      latest,
      history,
    });
  }
  report.groups.sort(
    (left, right) =>
      compare(left.repo, right.repo) || compare(left.releasePath, right.releasePath),
  );
  return report;
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** @param {ReturnType<typeof buildReport>} report */
export function renderTable(report) {
  const header = [
    "REPOSITORY",
    "RELEASE PATH",
    "RUNS",
    "STATUS",
    "TOTAL",
    "SLOWEST STAGE",
    "COVERAGE",
    "TARGET/LIMIT",
  ];
  const rows = report.groups.map((group) => [
    group.repo,
    group.releasePath,
    String(group.runs),
    group.status,
    seconds(group.totalMs),
    `${group.slowestStage.name} ${seconds(group.slowestStage.durationMs)}`,
    `${group.coveragePct.toFixed(2)}%`,
    `${seconds(group.targetMs)} / ${seconds(group.limitMs)}`,
  ]);
  const widths = header.map((title, index) =>
    Math.max(title.length, ...rows.map((row) => row[index].length)),
  );
  const line = (row) =>
    row.map((value, index) => value.padEnd(widths[index])).join("  ").trimEnd();
  return [
    line(header),
    line(widths.map((width) => "-".repeat(width))),
    ...rows.map(line),
    "",
    "Over-budget is a recording of a timing SLO breach, not a deployment failure.",
    "This report omits deploy targets, failure text and private notes; read those only in the receipt's own repository.",
  ].join("\n");
}

const USAGE = `Benchmarks Studio release-timing report

  node benchmarks/release-timing/report.mjs --dir <receipt-dir> [--json]
  node benchmarks/release-timing/report.mjs --pack <pack.json> [--json]

  --dir   compare finished receipt-*.json files and report any unfinished rows
  --pack  read a release-timing-pack/v1 file, or one release-timing/v1 receipt
  --json  print the deterministic comparison report instead of a table

Exit codes: 0 for a valid report, 1 for an invalid receipt or pack, 2 for usage.`;

/** @param {string[]} argv */
export function parseArgs(argv) {
  const options = { json: false, help: false, pack: null, dir: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--pack" || arg === "--dir") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      options[arg.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  if (!options.help && Boolean(options.pack) === Boolean(options.dir)) {
    throw new Error("choose exactly one of --dir <receipt-dir> or --pack <pack.json>");
  }
  return options;
}

/**
 * CLI entry point. Returns the exit code so tests can drive it directly.
 * @param {string[]} argv
 * @param {{log?: (line: string) => void, error?: (line: string) => void}} [io]
 */
export function main(argv = process.argv.slice(2), io = console) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    io.error(`release-timing report: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  if (options.help) {
    io.log(USAGE);
    return 0;
  }
  try {
    let unfinished = 0;
    const entries = options.pack ? loadPack(options.pack) :
      loadReceiptDirectory(options.dir, { onUnfinished: () => { unfinished++; } });
    if (unfinished) io.error(`release-timing report: skipped ${unfinished} unfinished ${unfinished === 1 ? "receipt" : "receipts"}`);
    const report = buildReport(entries);
    io.log(options.json ? JSON.stringify(report, null, 2) : renderTable(report));
    return 0;
  } catch (error) {
    io.error(`release-timing report: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  process.exitCode = main();
}

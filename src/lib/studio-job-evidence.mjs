// MIT. The Benchmarks Studio job-receipt contract.
//
// #601 already has three dated inventories. This module adds one narrower
// thing: what the Media Studio's production job table recorded per model and
// kind. It deliberately belongs to the studio-media inventory only. A build
// agent's availability and a Worker binding's presence are not job receipts,
// so mixing them into this file is refused rather than averaged.
//
// The file carries aggregates and a few settings examples. It never carries a
// prompt, project id, asset id, media key or provider request id, and the SQL
// that produced it must not select them. A page that cannot validate the file
// refuses to render instead of showing a stale or undated comparison.

import { freshness, parseInstant } from "./model-inventory.mjs";

export const JOB_EVIDENCE_SCHEMA = "composer/studio-job-evidence/1";
export const JOB_EVIDENCE_INVENTORY = "studio-media";
export const JOB_KINDS = ["image", "video", "audio"];
export const COST_ESTIMATE_LABEL = "estimate recorded by Studio, not an invoice";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PRIVATE_KEY_PATTERN = /prompt|asset|project|clientrequest|providerrequest|outputasset|retained|secret|token|email|sha256/i;

/** Exact SQL is evidence, so a query that could return private columns is refused. */
const FORBIDDEN_SQL = [
  [/\bselect\s+\*/i, "select-star", "use named columns, never SELECT *"],
  [/\bprompt\b/i, "prompt-column", "prompt text must never be read by this check"],
  [/\basset_id\b/i, "asset-id", "asset ids are private media references"],
  [/\bproject_id\b/i, "project-id", "project ids are private"],
  [/\bclient_request_id\b/i, "client-request-id", "client request ids are private"],
  [/\bprovider_request_id\b/i, "provider-request-id", "provider request ids are private"],
  [/\boutput_asset_id\b/i, "output-asset-id", "output asset ids are private media references"],
  [/\bretained_key\b/i, "retained-key", "retained media keys are private"],
  [/\berror_detail\b/i, "error-detail", "provider error text is not needed for an aggregate"],
];

const TOP_KEYS = new Set([
  "schema",
  "inventory",
  "id",
  "title",
  "question",
  "checkedAt",
  "staleAfterDays",
  "source",
  "scope",
  "timing",
  "cost",
  "totals",
  "groups",
  "examplesNote",
  "examples",
  "limits",
]);
const SOURCE_KEYS = new Set([
  "kind",
  "database",
  "databaseId",
  "environment",
  "access",
  "schemaCommand",
  "command",
  "sql",
  "examplesCommand",
  "examplesSql",
  "readAt",
  "examplesReadAt",
  "window",
]);
const SCOPE_KEYS = new Set(["rows", "deletedRowsExcluded", "deletedReason"]);
const TIMING_KEYS = new Set(["saved", "failedOrUnknown", "cancelled", "clock"]);
const COST_KEYS = new Set(["field", "label", "unit", "providerChargeRows", "note"]);
const TOTALS_KEYS = new Set([
  "jobs",
  "saved",
  "failed",
  "unknown",
  "cancelled",
  "costEstimateMicroSum",
  "providerChargeRows",
]);
const GROUP_KEYS = new Set([
  "model",
  "kind",
  "inventoryEntry",
  "inventoryNote",
  "jobs",
  "saved",
  "failed",
  "unknown",
  "cancelled",
  "withoutTerminal",
  "savedLatencyMs",
  "costEstimateMicro",
  "providerChargeRows",
]);
const LATENCY_KEYS = new Set(["samples", "median", "p90"]);
const GROUP_COST_KEYS = new Set(["samples", "sum", "median"]);
const EXAMPLE_KEYS = new Set(["model", "kind", "aspect", "durationSeconds", "aspectRatio", "outputWidth", "outputHeight"]);

/** @param {unknown} value */
function nonEmpty(value, minimum = 1) {
  return typeof value === "string" && value.trim().length >= minimum;
}

/** @param {unknown} value */
function count(value) {
  return Number.isInteger(value) && Number(value) >= 0;
}

/** @param {unknown} value */
function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** @param {unknown} value */
function unknownKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !allowed.has(key));
}

/**
 * Walk the data-bearing parts of the file and refuse any key that names a
 * private record. The aggregate query already cannot return one; this catches
 * a human pasting a row back into the file by mistake.
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} found
 */
function privateKeyPaths(value, path, found) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) privateKeyPaths(item, `${path}[${index}]`, found);
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    const where = path ? `${path}.${key}` : key;
    if (PRIVATE_KEY_PATTERN.test(key.replaceAll("_", ""))) found.push(where);
    privateKeyPaths(child, where, found);
  }
  return found;
}

/**
 * @param {any} file
 * @param {{now?: number, inventoryEntries?: Map<string, any> | any[] | Record<string, any>}} [options]
 */
export function validateJobEvidence(file, options = {}) {
  const now = typeof options.now === "number" ? options.now : Date.now();
  const rawEntries = options.inventoryEntries;
  const entries =
    rawEntries instanceof Map
      ? rawEntries
      : Array.isArray(rawEntries)
        ? new Map(rawEntries.map((entry) => [entry?.id, entry]))
        : rawEntries && typeof rawEntries === "object"
          ? new Map(Object.entries(rawEntries))
          : null;
  /** @type {{code: string, detail: string}[]} */
  const issues = [];
  const add = (code, detail) => issues.push({ code, detail });

  if (!file || typeof file !== "object" || Array.isArray(file)) {
    add("file-shape", "The job evidence must be an object");
    return { ok: false, issues, summary: null };
  }

  if (file.schema !== JOB_EVIDENCE_SCHEMA) add("schema", `schema must be ${JOB_EVIDENCE_SCHEMA}`);
  if (file.inventory !== JOB_EVIDENCE_INVENTORY)
    add("inventory-mixed", `inventory must be ${JOB_EVIDENCE_INVENTORY}; job receipts never belong to another inventory`);
  if (!nonEmpty(file.id) || !SLUG_PATTERN.test(String(file.id))) add("id", "id must be a lowercase slug");
  if (!nonEmpty(file.title, 3)) add("title", "title is required");
  if (!nonEmpty(file.question, 20)) add("question", "question must say what the receipts answer");

  const checked = parseInstant(file.checkedAt);
  if (checked === null) add("checked-at", "checkedAt must be an ISO timestamp");
  else if (checked > now + 86_400_000) add("checked-at-future", "checkedAt cannot be later than this check");
  if (!Number.isInteger(file.staleAfterDays) || file.staleAfterDays < 1 || file.staleAfterDays > 365)
    add("stale-after", "staleAfterDays must be an integer from 1 to 365");

  for (const key of unknownKeys(file, TOP_KEYS)) add("unknown-field", `${key} is not part of the job evidence`);
  for (const path of privateKeyPaths(file, "", [])) add("private-field", `${path} names a private record`);

  const source = file.source ?? {};
  for (const key of unknownKeys(source, SOURCE_KEYS)) add("source-field", `source.${key} is not part of this contract`);
  if (source.database !== "media-studio") add("source-database", "source.database must be media-studio");
  if (!nonEmpty(source.environment, 3)) add("source-environment", "source.environment must name where the query ran");
  if (!nonEmpty(source.access, 10)) add("source-access", "source.access must say the read was read-only");
  if (parseInstant(source.readAt) === null) add("source-read-at", "source.readAt must be an ISO timestamp");
  if (parseInstant(source.examplesReadAt) === null) add("source-examples-read-at", "source.examplesReadAt must be an ISO timestamp");

  const windowStart = parseInstant(source.window?.firstCreatedAt);
  const windowEnd = parseInstant(source.window?.lastCreatedAt);
  if (windowStart === null) add("window-start", "source.window.firstCreatedAt must be an ISO timestamp");
  if (windowEnd === null) add("window-end", "source.window.lastCreatedAt must be an ISO timestamp");
  if (windowStart !== null && windowEnd !== null && windowEnd < windowStart)
    add("window-order", "the job window cannot end before it starts");

  for (const field of ["sql", "examplesSql"]) {
    const sql = source[field];
    if (!nonEmpty(sql, 40)) {
      add(`sql-${field}`, `source.${field} must hold the exact query that was run`);
      continue;
    }
    if (!/\bfrom\s+generations\b/i.test(sql)) add(`sql-${field}-source`, `source.${field} must read the generations table`);
    for (const [pattern, code, detail] of FORBIDDEN_SQL) {
      if (pattern.test(sql)) add(`sql-${code}`, `source.${field}: ${detail}`);
    }
  }
  if (!nonEmpty(source.schemaCommand, 20)) add("schema-command", "source.schemaCommand must name the schema read");

  const scope = file.scope ?? {};
  for (const key of unknownKeys(scope, SCOPE_KEYS)) add("scope-field", `scope.${key} is not part of this contract`);
  if (!count(scope.deletedRowsExcluded)) add("scope-deleted", "scope.deletedRowsExcluded must be a count");

  const timing = file.timing ?? {};
  for (const key of unknownKeys(timing, TIMING_KEYS)) add("timing-field", `timing.${key} is not part of this contract`);
  for (const field of ["saved", "failedOrUnknown", "clock"]) {
    if (!nonEmpty(timing[field], 10)) add(`timing-${field}`, `timing.${field} must explain what was measured`);
  }

  const cost = file.cost ?? {};
  for (const key of unknownKeys(cost, COST_KEYS)) add("cost-field", `cost.${key} is not part of this contract`);
  if (cost.field !== "cost_estimate_micro") add("cost-field-name", "cost.field must be cost_estimate_micro");
  if (cost.label !== COST_ESTIMATE_LABEL) add("cost-label", `cost.label must be exactly "${COST_ESTIMATE_LABEL}"`);
  if (!nonEmpty(cost.unit, 5)) add("cost-unit", "cost.unit must explain the micro-dollar unit");
  if (!nonEmpty(cost.note, 20)) add("cost-note", "cost.note must say what is not claimed");

  const totals = file.totals ?? {};
  for (const key of unknownKeys(totals, TOTALS_KEYS)) add("totals-field", `totals.${key} is not part of this contract`);
  for (const field of ["jobs", "saved", "failed", "unknown", "cancelled"]) {
    if (!count(totals[field])) add(`totals-${field}`, `totals.${field} must be a whole count`);
  }
  if (!nonNegativeNumber(totals.costEstimateMicroSum)) add("totals-cost", "totals.costEstimateMicroSum must be a non-negative number");
  if (!count(totals.providerChargeRows)) add("totals-charges", "totals.providerChargeRows must be a count");

  const groups = Array.isArray(file.groups) ? file.groups : [];
  if (groups.length === 0) add("groups", "job evidence with no models answers nothing");
  const seen = new Set();
  let groupJobs = 0;
  let groupSaved = 0;
  let groupFailed = 0;
  let groupUnknown = 0;
  let groupCancelled = 0;
  let costSum = 0;
  let groupCharges = 0;

  for (const [index, group] of groups.entries()) {
    const where = nonEmpty(group?.model) ? `${group.model}/${group?.kind ?? "?"}` : `groups[${index}]`;
    for (const key of unknownKeys(group, GROUP_KEYS)) add("group-field", `${where}: ${key} is not part of a job group`);
    if (!nonEmpty(group?.model, 1)) add("group-model", `${where} needs the recorded model key`);
    if (seen.has(`${group?.model}/${group?.kind}`)) add("group-duplicate", `${where} appears twice`);
    seen.add(`${group?.model}/${group?.kind}`);
    if (!JOB_KINDS.includes(group?.kind)) add("group-kind", `${where} kind must be one of ${JOB_KINDS.join(", ")}`);

    if (entries) {
      const mapped = group?.inventoryEntry ? entries.get(group.inventoryEntry) : null;
      if (group?.inventoryEntry && (!mapped || mapped.kind !== "media-model"))
        add("inventory-entry", `${where} names ${group.inventoryEntry}, which is not a media model in the studio-media inventory`);
      if (!group?.inventoryEntry && !nonEmpty(group?.inventoryNote, 40))
        add("inventory-unmapped-note", `${where} is not in the inventory and must say so rather than imply a row exists`);
      if (group?.inventoryEntry && group.model !== group.inventoryEntry && !nonEmpty(group?.inventoryNote, 20))
        add("inventory-mapping-note", `${where} maps to ${group.inventoryEntry} and must explain the different key`);
    } else {
      add("inventory-entries", "the studio-media inventory rows are required to check model mapping");
    }

    if (!count(group?.jobs) || group.jobs === 0) add("group-jobs", `${where} needs a positive job count`);
    for (const field of ["saved", "failed", "unknown", "cancelled"]) {
      if (!count(group?.[field])) add(`group-${field}`, `${where} ${field} must be a whole count`);
    }
    if (count(group?.jobs) && count(group?.saved) && count(group?.failed) && count(group?.unknown) && count(group?.cancelled)) {
      const sum = group.saved + group.failed + group.unknown + group.cancelled;
      if (sum !== group.jobs) add("group-counts", `${where}: saved + failed + unknown + cancelled is ${sum}, not ${group.jobs}`);
      if (group.withoutTerminal !== group.failed + group.unknown)
        add("group-terminal", `${where}: withoutTerminal must equal failed + unknown`);
      groupJobs += group.jobs;
      groupSaved += group.saved;
      groupFailed += group.failed;
      groupUnknown += group.unknown;
      groupCancelled += group.cancelled;
    }
    if (!count(group?.withoutTerminal)) add("group-terminal-count", `${where} withoutTerminal must be a whole count`);

    const latency = group?.savedLatencyMs;
    if (group?.saved === 0) {
      if (latency !== null) add("latency-empty", `${where} has no saved job and must record null latency`);
    } else if (!latency || typeof latency !== "object") {
      add("latency", `${where} needs saved-job latency`);
    } else {
      for (const key of unknownKeys(latency, LATENCY_KEYS)) add("latency-field", `${where}: latency.${key} is not part of this contract`);
      if (latency.samples !== group.saved) add("latency-samples", `${where}: latency samples must equal saved jobs`);
      if (!nonNegativeNumber(latency.median)) add("latency-median", `${where}: median latency must be finite and non-negative`);
      if (!nonNegativeNumber(latency.p90)) add("latency-p90", `${where}: p90 latency must be finite and non-negative`);
      if (nonNegativeNumber(latency.median) && nonNegativeNumber(latency.p90) && latency.p90 < latency.median)
        add("latency-order", `${where}: p90 cannot be lower than the median`);
    }

    const costBlock = group?.costEstimateMicro;
    if (!costBlock || typeof costBlock !== "object") {
      add("cost-group", `${where} needs the recorded cost estimate`);
    } else {
      for (const key of unknownKeys(costBlock, GROUP_COST_KEYS)) add("cost-group-field", `${where}: cost.${key} is not part of this contract`);
      if (costBlock.samples !== group?.jobs) add("cost-samples", `${where}: cost samples must equal all jobs`);
      if (!nonNegativeNumber(costBlock.sum)) add("cost-sum", `${where}: cost sum must be finite and non-negative`);
      if (!nonNegativeNumber(costBlock.median)) add("cost-median", `${where}: cost median must be finite and non-negative`);
      if (nonNegativeNumber(costBlock.sum)) costSum += costBlock.sum;
    }
    if (!count(group?.providerChargeRows)) add("group-charges", `${where} providerChargeRows must be a count`);
    else {
      if (count(group?.jobs) && group.providerChargeRows > group.jobs)
        add("group-charges-over", `${where}: provider charges cannot exceed jobs`);
      groupCharges += group.providerChargeRows;
    }
  }

  if (count(totals.jobs) && totals.jobs === 0) add("zero-jobs", "a job comparison with zero jobs must not render");
  if (groupJobs !== totals.jobs) add("totals-jobs-mismatch", `groups hold ${groupJobs} jobs, totals claim ${totals.jobs}`);
  if (groupSaved !== totals.saved) add("totals-saved-mismatch", `groups hold ${groupSaved} saved jobs, totals claim ${totals.saved}`);
  if (groupFailed !== totals.failed) add("totals-failed-mismatch", `groups hold ${groupFailed} failed jobs, totals claim ${totals.failed}`);
  if (groupUnknown !== totals.unknown) add("totals-unknown-mismatch", `groups hold ${groupUnknown} unknown jobs, totals claim ${totals.unknown}`);
  if (groupCancelled !== totals.cancelled) add("totals-cancelled-mismatch", `groups hold ${groupCancelled} cancelled jobs, totals claim ${totals.cancelled}`);
  if (costSum !== totals.costEstimateMicroSum)
    add("totals-cost-mismatch", `groups sum to ${costSum} micro, totals claim ${totals.costEstimateMicroSum}`);
  if (groupCharges !== totals.providerChargeRows)
    add("totals-charges-mismatch", `groups record ${groupCharges} provider charges, totals claim ${totals.providerChargeRows}`);
  if (totals.saved + totals.failed + totals.unknown + totals.cancelled !== totals.jobs)
    add("totals-counts", "saved + failed + unknown + cancelled must equal total jobs");
  if (count(scope.rows) && scope.rows !== totals.jobs) add("scope-rows", "scope.rows must equal total jobs");

  const examples = Array.isArray(file.examples) ? file.examples : [];
  if (examples.length < 2 || examples.length > 3) add("examples-count", "show two or three exact settings examples, no more");
  if (!nonEmpty(file.examplesNote, 20)) add("examples-note", "examplesNote must say how the examples were chosen");
  const modelKinds = new Set(groups.map((group) => `${group?.model}/${group?.kind}`));
  const exampleKinds = new Set();
  for (const [index, example] of examples.entries()) {
    const where = `examples[${index}]`;
    for (const key of unknownKeys(example, EXAMPLE_KEYS)) add("example-field", `${where}: ${key} is not a permitted setting`);
    if (!modelKinds.has(`${example?.model}/${example?.kind}`))
      add("example-model", `${where} must name a model and kind that appears in the groups`);
    if (!JOB_KINDS.includes(example?.kind)) add("example-kind", `${where} kind must be one of ${JOB_KINDS.join(", ")}`);
    exampleKinds.add(example?.kind);
    if (example?.aspect !== undefined && !nonEmpty(example.aspect, 2)) add("example-aspect", `${where} aspect must be a name`);
    if (example?.aspectRatio !== undefined && !nonEmpty(example.aspectRatio, 2)) add("example-ratio", `${where} aspectRatio must be a name`);
    if (example?.durationSeconds !== undefined && !nonNegativeNumber(example.durationSeconds))
      add("example-duration", `${where} durationSeconds must be finite and non-negative`);
    for (const field of ["outputWidth", "outputHeight"]) {
      if (example?.[field] !== undefined && (!Number.isInteger(example[field]) || example[field] < 1))
        add(`example-${field}`, `${where} ${field} must be a positive whole number`);
    }
  }
  if (examples.length >= 2 && exampleKinds.size < 2) add("examples-kinds", "examples must cover more than one kind");

  const limits = Array.isArray(file.limits) ? file.limits : [];
  if (limits.length === 0) add("limits", "job evidence must state what it still cannot prove");
  for (const [index, limit] of limits.entries()) {
    if (!nonEmpty(limit, 15)) add("limit-text", `limits[${index}] must be a readable limit`);
  }

  return { ok: issues.length === 0, issues, summary: summariseJobEvidence(file, { now }) };
}

/**
 * The shape the page renders. A saved rate is derived from the counts, never
 * stored, so prose cannot claim a rate the rows do not support.
 * @param {any} file
 * @param {{now?: number}} [options]
 */
export function summariseJobEvidence(file, options = {}) {
  const totals = file?.totals ?? {};
  const age = freshness({ checkedAt: file?.checkedAt, staleAfterDays: file?.staleAfterDays, now: options.now });
  const groups = Array.isArray(file?.groups) ? file.groups : [];
  return {
    id: file?.id ?? "unknown",
    inventory: file?.inventory ?? "unknown",
    title: file?.title ?? "Untitled job evidence",
    question: file?.question ?? "",
    checkedAt: file?.checkedAt ?? null,
    checked: parseInstant(file?.checkedAt),
    ageDays: age.ageDays,
    stale: age.stale,
    staleAfterDays: age.staleAfterDays,
    source: file?.source ?? null,
    scope: file?.scope ?? null,
    timing: file?.timing ?? null,
    cost: file?.cost ?? null,
    totals: {
      ...totals,
      savedRate: Number.isInteger(totals.jobs) && totals.jobs > 0 ? totals.saved / totals.jobs : null,
    },
    groups: groups.map((group) => ({
      ...group,
      savedRate: Number.isInteger(group?.jobs) && group.jobs > 0 ? group.saved / group.jobs : null,
    })),
    examples: Array.isArray(file?.examples) ? file.examples : [],
    examplesNote: file?.examplesNote ?? "",
    limits: Array.isArray(file?.limits) ? file.limits : [],
  };
}

/**
 * Refuse to render. Astro calls this while building the page, so an undated,
 * empty or mixed file stops the page instead of showing a comparison it cannot
 * support.
 * @param {any} file
 * @param {{now?: number, inventoryEntries?: Map<string, any> | any[] | Record<string, any>}} [options]
 */
export function assertJobEvidence(file, options = {}) {
  const result = validateJobEvidence(file, options);
  if (!result.ok) {
    const detail = result.issues.map((issue) => `${issue.code}: ${issue.detail}`).join("\n- ");
    throw new Error(`Refusing to render the Studio job comparison:\n- ${detail}`);
  }
  if (!result.summary) throw new Error("Refusing to render the Studio job comparison: the summary could not be built");
  return result.summary;
}

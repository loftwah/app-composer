// MIT. The Benchmarks Studio inventory contract.
//
// #601 needs three honest answers that are checked rather than remembered:
// which build agents a Composer user can hand work to, what the deployed
// Composer Worker can actually run, and what the independent Media Studio can
// generate today. Each answer is a dated data file with a source and an
// observed response shape per entry, plus the actual difference from the
// previous check.
//
// Everything here is data. A row describes what a provider page, a deployed
// Worker or a repository catalogue returned on one day. Nothing in this module
// executes upstream content, calls inference or treats a fetched page as
// instructions.

export const INVENTORY_SCHEMA = "composer/model-inventory/1";
export const INVENTORY_IDS = ["build-agents", "hosted-execution", "studio-media"];
export const ENTRY_STATUS = ["current", "drifted", "retired", "absent", "unverified"];
export const CHANGE_KINDS = ["version", "availability", "capability", "presence", "price", "source"];

/** A media endpoint a person could actually be billed for. A bare display name
 * is not a callable id, so an inventory row must carry the real route. */
const ENDPOINT_PATTERN = /^(?:@cf\/[a-z0-9][a-z0-9._/-]*|fal-ai\/[a-z0-9][a-z0-9._/-]*|[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._/-]*)$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** @param {unknown} value */
export function parseInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * How old one check is, and whether the page should stop calling it current.
 * A missing or unreadable timestamp is stale rather than fresh: an undated
 * inventory cannot be trusted to still be true.
 * @param {{checkedAt?: unknown, staleAfterDays?: unknown, now?: number}} input
 */
export function freshness(input = {}) {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const after = Number.isInteger(input.staleAfterDays) ? Number(input.staleAfterDays) : 7;
  const time = parseInstant(input.checkedAt);
  if (time === null) return { ageDays: null, stale: true, staleAfterDays: after, reason: "no readable checkedAt" };
  const ageDays = Math.max(0, Math.floor((now - time) / 86_400_000));
  return { ageDays, stale: time + after * 86_400_000 < now, staleAfterDays: after, reason: null };
}

/** @param {any[]} entries */
export function statusCounts(entries = []) {
  const counts = { current: 0, drifted: 0, retired: 0, absent: 0, unverified: 0 };
  for (const entry of entries) {
    if (entry && Object.hasOwn(counts, entry.status)) counts[entry.status] += 1;
  }
  return counts;
}

/** @param {unknown} value */
function nonEmpty(value, minimum = 1) {
  return typeof value === "string" && value.trim().length >= minimum;
}

/**
 * Validate one inventory file. Returns every problem, not the first, so a
 * broken data file is diagnosable in one run.
 * @param {any} file
 * @param {{now?: number, expectedId?: string, exists?: ((path: string) => boolean) | null}} [options]
 */
export function validateInventory(file, options = {}) {
  const now = typeof options.now === "number" ? options.now : Date.now();
  const exists = typeof options.exists === "function" ? options.exists : null;
  /** @type {{code: string, detail: string}[]} */
  const issues = [];
  const add = (code, detail) => issues.push({ code, detail });

  if (!file || typeof file !== "object" || Array.isArray(file)) {
    add("file-shape", "The inventory must be an object");
    return { ok: false, issues, summary: null };
  }
  if (file.schema !== INVENTORY_SCHEMA) add("schema", `schema must be ${INVENTORY_SCHEMA}`);
  if (!nonEmpty(file.id) || !SLUG_PATTERN.test(String(file.id))) add("id", "id must be a lowercase slug");
  if (options.expectedId && file.id !== options.expectedId) add("id-mismatch", `id must be ${options.expectedId}`);
  if (!INVENTORY_IDS.includes(file.id)) add("id-unknown", `id must be one of ${INVENTORY_IDS.join(", ")}`);
  if (!nonEmpty(file.title, 3)) add("title", "title is required");
  if (!nonEmpty(file.question, 20)) add("question", "question must say what the inventory answers");

  const checked = parseInstant(file.checkedAt);
  if (checked === null) add("checked-at", "checkedAt must be an ISO timestamp");
  else if (checked > now + 86_400_000) add("checked-at-future", "checkedAt cannot be later than this check");

  if (!Number.isInteger(file.staleAfterDays) || file.staleAfterDays < 1 || file.staleAfterDays > 365)
    add("stale-after", "staleAfterDays must be an integer from 1 to 365");

  if (file.previousCheck !== null && file.previousCheck !== undefined) {
    const previous = parseInstant(file.previousCheck?.checkedAt);
    if (previous === null) add("previous-check", "previousCheck.checkedAt must be an ISO timestamp");
    else if (checked !== null && previous > checked) add("previous-check-order", "the previous check cannot be later than this one");
    if (!nonEmpty(file.previousCheck?.source, 3)) add("previous-check-source", "previousCheck.source is required");
  }

  const entries = Array.isArray(file.entries) ? file.entries : [];
  if (entries.length === 0) add("entries", "an inventory with no entries answers nothing");
  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    const where = nonEmpty(entry?.id) ? entry.id : `entry[${index}]`;
    if (!nonEmpty(entry?.id) || !SLUG_PATTERN.test(String(entry?.id))) add("entry-id", `${where} needs a lowercase slug id`);
    if (seen.has(entry?.id)) add("entry-duplicate", `${where} appears twice`);
    seen.add(entry?.id);
    if (!nonEmpty(entry?.label, 2)) add("entry-label", `${where} needs a label`);
    if (!ENTRY_STATUS.includes(entry?.status)) add("entry-status", `${where} status must be one of ${ENTRY_STATUS.join(", ")}`);
    if (!nonEmpty(entry?.source, 10)) add("entry-source", `${where} needs the exact source that was read`);
    if (!nonEmpty(entry?.observed, 3)) add("entry-observed", `${where} needs what the source actually returned`);
    const entryChecked = parseInstant(entry?.checkedAt);
    if (entryChecked === null) add("entry-checked-at", `${where} needs an ISO checkedAt`);
    else if (checked !== null && entryChecked > checked) add("entry-checked-later", `${where} was checked after the file claims`);
    if (entry?.status === "unverified" && !nonEmpty(entry?.reason, 20))
      add("entry-unverified-reason", `${where} is unverified and must say why`);
    if (entry?.status === "unverified" && entry?.live === true)
      add("entry-unverified-live", `${where} cannot be unverified and live at the same time`);
    if (entry?.status === "retired" && !nonEmpty(entry?.retiredAt) && !nonEmpty(entry?.reason, 20))
      add("entry-retired-date", `${where} is retired and needs a date or a reason`);
    if (entry?.kind === "media-model" && !ENDPOINT_PATTERN.test(String(entry?.endpoint ?? "")))
      add("entry-endpoint", `${where} needs the exact callable endpoint, not a display name`);
  }

  const changes = Array.isArray(file.changes) ? file.changes : [];
  for (const [index, change] of changes.entries()) {
    const where = nonEmpty(change?.entry) ? change.entry : `changes[${index}]`;
    if (!seen.has(change?.entry)) add("change-entry", `${where} names an entry that does not exist`);
    if (!CHANGE_KINDS.includes(change?.kind)) add("change-kind", `${where} kind must be one of ${CHANGE_KINDS.join(", ")}`);
    if (JSON.stringify(change?.previous) === JSON.stringify(change?.current))
      add("change-empty", `${where} records a change whose previous and current values are identical`);
    if (!nonEmpty(change?.note, 10)) add("change-note", `${where} needs a short explanation`);
  }

  const sources = Array.isArray(file.sources) ? file.sources : [];
  if (sources.length === 0) add("sources", "a check without listed sources is not reproducible");
  const sourceIds = new Set();
  for (const source of sources) {
    if (!nonEmpty(source?.id) || !SLUG_PATTERN.test(String(source?.id))) add("source-id", "every source needs a slug id");
    if (sourceIds.has(source?.id)) add("source-duplicate", `source ${source?.id} appears twice`);
    sourceIds.add(source?.id);
    if (typeof source?.url !== "string" || !/^(?:https?:\/\/|file:)/.test(source.url)) add("source-url", `${source?.id ?? "source"} needs an http(s) or file: source`);
    if (parseInstant(source?.readAt) === null) add("source-read-at", `${source?.id ?? "source"} needs an ISO readAt`);
  }

  const pinned = Array.isArray(file.pinnedRuns) ? file.pinnedRuns : [];
  for (const run of pinned) {
    const where = String(run?.id ?? "pinned run");
    if (!nonEmpty(run?.id)) add("pinned-id", "every pinned run needs an id");
    if (typeof run?.where !== "string" || !/^(?:file|url):/.test(run.where))
      add("pinned-where", `${where} must point at file: or url:`);
    else if (run.where.startsWith("file:") && exists && !exists(run.where.slice(5)))
      add("pinned-missing", `${where} points at a missing file`);
    if (!nonEmpty(run?.recordedAt, 10)) add("pinned-recorded", `${where} needs recordedAt`);
  }

  if (!Array.isArray(file.limits) || file.limits.length === 0) add("limits", "an inventory must state what it still cannot prove");
  for (const [index, limit] of (file.limits ?? []).entries()) {
    if (!nonEmpty(limit, 15)) add("limit-text", `limits[${index}] must be a readable limit`);
  }

  return { ok: issues.length === 0, issues, summary: summariseInventory(file, { now }) };
}

/**
 * The shape the page renders. Counts come from the entries themselves, so a
 * status cannot be claimed in prose while the rows say something else.
 * @param {any} file
 * @param {{now?: number}} [options]
 */
export function summariseInventory(file, options = {}) {
  const entries = Array.isArray(file?.entries) ? file.entries : [];
  const counts = statusCounts(entries);
  const age = freshness({ checkedAt: file?.checkedAt, staleAfterDays: file?.staleAfterDays, now: options.now });
  return {
    id: file?.id ?? "unknown",
    title: file?.title ?? "Untitled inventory",
    question: file?.question ?? "",
    checkedAt: file?.checkedAt ?? null,
    previousCheck: file?.previousCheck ?? null,
    counts,
    total: entries.length,
    changes: Array.isArray(file?.changes) ? file.changes.length : 0,
    ageDays: age.ageDays,
    stale: age.stale,
    staleAfterDays: age.staleAfterDays,
    limits: Array.isArray(file?.limits) ? file.limits : [],
    entries,
  };
}

/** Validate every inventory file in one pass. */
export function validateInventories(files, options = {}) {
  const list = Array.isArray(files) ? files : [];
  const expected = new Set(INVENTORY_IDS);
  const results = list.map((file) => ({
    id: file?.id ?? "unknown",
    ...validateInventory(file, { ...options, expectedId: file?.id }),
  }));
  for (const id of expected) {
    if (!list.some((file) => file?.id === id)) results.push({ id, ok: false, issues: [{ code: "missing", detail: `${id} inventory is missing` }], summary: null });
  }
  return results;
}

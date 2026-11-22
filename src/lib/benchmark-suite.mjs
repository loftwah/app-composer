// MIT. The Benchmarks Studio versioned suite spec.
//
// A suite pack is data, not code: it names deterministic checks that already
// exist in benchmarks/suites/*.mjs and says which committed results file is its
// evidence. The validator refuses a pack that asks for a provider, a credential
// or spend, or that claims a recorded result the file does not contain.
//
// Schema: benchmarks/suites/README.md
export const BENCHMARK_SUITE_SCHEMA = "benchmark-suite/v1";

/** @typedef {{module: string, id: string}} BenchmarkSuiteCheck */

/** @typedef {{network?: unknown, credentials?: unknown, spendMicro?: unknown}} SuiteRequirements */
/** @typedef {{status?: unknown, file?: unknown, source?: unknown, recordedAt?: unknown, note?: unknown}} SuiteEvidence */

/**
 * @typedef {Object} BenchmarkSuiteSummary
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} kind
 * @property {boolean} providerFree
 * @property {SuiteRequirements | null} requirements
 * @property {BenchmarkSuiteCheck[]} checks
 * @property {SuiteEvidence | null} evidence
 * @property {string} evidenceState
 * @property {string | null} evidenceNote
 * @property {unknown[]} limits
 */

/** @typedef {{code: string, detail: string}} BenchmarkSuiteIssue */
/** @typedef {BenchmarkSuiteSummary & {limits: string[]}} ValidBenchmarkSuiteSummary */

const TOP_KEYS = new Set([
  "schema",
  "id",
  "name",
  "description",
  "kind",
  "providerFree",
  "requirements",
  "checks",
  "evidence",
  "limits",
]);
const REQUIREMENT_KEYS = new Set(["network", "credentials", "spendMicro"]);
const CHECK_KEYS = new Set(["module", "id"]);
const EVIDENCE_KEYS = new Set(["status", "file", "source", "recordedAt", "note"]);

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SUITE_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

/** @param {unknown} value */
function text(value) {
  return typeof value === "string" ? value : "";
}

/** @param {unknown} value */
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/** @param {unknown} value */
function unknownKeys(value, allowed) {
  const record = object(value);
  if (!record) return [];
  return Object.keys(record).filter((key) => !allowed.has(key));
}

/** @param {unknown} value */
function instant(value) {
  const raw = text(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * @param {any} spec
 * @param {{results?: any, now?: number}} [options]
 * @returns {{ok: boolean, issues: BenchmarkSuiteIssue[], summary: BenchmarkSuiteSummary | null}}
 */
export function validateBenchmarkSuite(spec, options = {}) {
  /** @type {{code: string, detail: string}[]} */
  const issues = [];
  const add = (code, detail) => issues.push({ code, detail });

  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return {
      ok: false,
      issues: [{ code: "file-shape", detail: "A suite spec must be an object." }],
      summary: null,
    };
  }

  if (spec.schema !== BENCHMARK_SUITE_SCHEMA)
    add("schema", `schema must be ${BENCHMARK_SUITE_SCHEMA}`);
  if (!SUITE_ID.test(text(spec.id)) || text(spec.id).length > 32)
    add("id", "id must be an uppercase pack id such as FLOW-01");
  if (text(spec.name).trim().length < 3 || text(spec.name).length > 80)
    add("name", "name must be 3 to 80 characters");
  if (text(spec.description).trim().length < 20 || text(spec.description).length > 400)
    add("description", "description must say what the pack measures in 20 to 400 characters");
  if (spec.kind !== "deterministic")
    add("kind", "kind must be deterministic; a provider run is a different record");
  if (spec.providerFree !== true)
    add("provider-free", "providerFree must be true; this repository does not run a paid pack here");

  for (const key of unknownKeys(spec, TOP_KEYS))
    add("unknown-field", `${key} is not part of a suite spec`);

  const requirements = /** @type {SuiteRequirements | null} */ (object(spec.requirements));
  if (!requirements) add("requirements", "requirements must be an object");
  for (const key of unknownKeys(requirements, REQUIREMENT_KEYS))
    add("requirement-field", `requirements.${key} is not part of this contract`);
  if (requirements?.network !== false)
    add("requirement-network", "requirements.network must be false");
  if (!Array.isArray(requirements?.credentials) || requirements.credentials.length > 0)
    add("requirement-credentials", "requirements.credentials must be an empty array");
  if (requirements?.spendMicro !== 0)
    add("requirement-spend", "requirements.spendMicro must be 0");

  const checks = Array.isArray(spec.checks) ? spec.checks : [];
  if (checks.length === 0) add("checks", "a pack needs at least one deterministic check");
  const seen = new Set();
  for (const [index, check] of checks.entries()) {
    const where = `checks[${index}]`;
    for (const key of unknownKeys(check, CHECK_KEYS))
      add("check-field", `${where}.${key} is not part of a check reference`);
    if (!SLUG.test(text(check?.module)))
      add("check-module", `${where}.module must be a suite module name`);
    if (!SLUG.test(text(check?.id)))
      add("check-id", `${where}.id must be a check id`);
    const key = `${text(check?.module)}::${text(check?.id)}`;
    if (seen.has(key)) add("check-duplicate", `${key} appears twice`);
    seen.add(key);
  }

  const evidence = /** @type {SuiteEvidence | null} */ (object(spec.evidence));
  if (!evidence) add("evidence", "evidence must be an object");
  for (const key of unknownKeys(evidence, EVIDENCE_KEYS))
    add("evidence-field", `evidence.${key} is not part of this contract`);
  const status = text(evidence?.status);
  if (!["recorded", "not-run"].includes(status))
    add("evidence-status", "evidence.status must be recorded or not-run");
  if (status === "recorded") {
    if (!text(evidence?.file).startsWith("benchmarks/results/") || !text(evidence?.file).endsWith(".json"))
      add("evidence-file", "evidence.file must name a committed benchmarks/results/*.json file");
    if (!/^[0-9a-f]{40}$/i.test(text(evidence?.source)))
      add("evidence-source", "evidence.source must be the exact committed source revision");
    if (instant(evidence?.recordedAt) === null)
      add("evidence-recorded-at", "evidence.recordedAt must be an ISO timestamp");
  }
  if (status === "not-run" && text(evidence?.note).trim().length < 20)
    add("evidence-note", "a not-run pack must say why no evidence exists yet (20+ characters)");

  const limits = Array.isArray(spec.limits) ? spec.limits : [];
  if (limits.length === 0) add("limits", "a pack must state what it does not prove");
  for (const [index, limit] of limits.entries()) {
    if (text(limit).trim().length < 15)
      add("limit-text", `limits[${index}] must be a readable limit`);
  }

  // Evidence cross-checks are a rendered state, not a build gate. A stale
  // results file must not stop the whole site building; it must stop the pack
  // from claiming a current pass. Shape errors above still refuse the pack.
  let evidenceState = status === "recorded" ? "recorded" : "not-run";
  let evidenceNote = null;
  const results = options.results;
  if (status === "recorded" && results) {
    const suites = Array.isArray(results.suites) ? results.suites : [];
    for (const check of checks) {
      const suite = suites.find((entry) => entry?.id === check?.module);
      const found = Array.isArray(suite?.checks)
        ? suite.checks.find((entry) => entry?.id === check?.id)
        : null;
      if (!found) {
        evidenceState = "not-run";
        evidenceNote = `${check?.module}::${check?.id} is not in the committed results file, so this pack is not run.`;
      } else if (found.status !== "pass") {
        evidenceState = "not-run";
        evidenceNote = `${check?.module}::${check?.id} is ${found.status} in the committed results file, so this pack is not a pass.`;
      }
    }
    if (evidenceState === "recorded") {
      const sourceDiffers =
        /^[0-9a-f]{40}$/i.test(text(evidence?.source)) &&
        text(results.source) !== text(evidence.source);
      const timeDiffers = instant(evidence?.recordedAt) !== instant(results.generatedAt);
      if (sourceDiffers || timeDiffers) {
        evidenceState = "stale";
        evidenceNote = `The pack records ${text(evidence?.source).slice(0, 7) || "an unknown source"} at ${text(evidence?.recordedAt) || "an unknown time"}; the committed file says ${text(results.source).slice(0, 7) || "an unknown source"} at ${text(results.generatedAt) || "an unknown time"}. The named checks still pass, but the pack needs its evidence refreshed before it is a current claim.`;
      }
    }
  } else if (status === "recorded") {
    // The shape is valid but there is no results object to cross-check. The
    // page and the test pass the real file; a shape-only caller gets an
    // unverified state rather than a false pass or a false refusal.
    evidenceState = "unverified";
    evidenceNote = "The committed results file was not supplied, so this pack is not proven.";
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      id: text(spec.id) || "unknown",
      name: text(spec.name) || "Untitled suite",
      description: text(spec.description),
      kind: text(spec.kind) || "unknown",
      providerFree: spec.providerFree === true,
      requirements: requirements ?? null,
      checks: checks.map((check) => ({
        module: text(check?.module),
        id: text(check?.id),
      })),
      evidence: evidence ?? null,
      evidenceState,
      evidenceNote,
      limits: Array.isArray(limits) ? limits : [],
    },
  };
}

/**
 * @param {any} spec
 * @param {{results?: any, now?: number}} [options]
 * @returns {ValidBenchmarkSuiteSummary}
 */
export function assertBenchmarkSuite(spec, options = {}) {
  const result = validateBenchmarkSuite(spec, options);
  if (!result.ok) {
    const detail = result.issues.map((issue) => `${issue.code}: ${issue.detail}`).join("\n- ");
    throw new Error(`Refusing to publish a benchmark suite pack:\n- ${detail}`);
  }
  if (!result.summary) throw new Error("Refusing to publish a benchmark suite pack: no summary");
  // An accepted suite has a readable string at every limit position.
  return /** @type {ValidBenchmarkSuiteSummary} */ (result.summary);
}

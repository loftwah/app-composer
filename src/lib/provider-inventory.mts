// Read-only Cloudflare inventory for Composer's owner experience.
//
// This module performs bounded GET reads against an explicit path allowlist and
// normalises the answers into observations. It never writes a provider value,
// never logs a credential and never turns an unread field into a clean result.
// Cost is always unknown here: these endpoints do not expose a per-resource
// charge, and an unknown cost is not zero.
export const PROVIDER_INVENTORY_VERSION = "composer.provider-inventory/1";
// Version 2 separates declared/undeclared and recorded/unrecorded identity so
// a name-only convention cannot be counted as a verified resource.
export const PROVIDER_CHECK_VERSION = "composer.provider-check/2";

export const DEFAULT_MAX_PAGES = 3;
export const DEFAULT_PER_PAGE = 50;
export const DEFAULT_MAX_REQUESTS = 48;
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_DEADLINE_MS = 20000;
export const MAX_RESPONSE_BYTES = 2_000_000;
export const MAX_DETAIL_WORKERS = 16;
/** Bounded parallel detail reads. Requests are still GET-only and counted. */
export const DETAIL_CONCURRENCY = 4;
/** A provider observation older than this is shown as stale, not current. */
export const STALE_AFTER_HOURS = 24;

export type ProviderKind = "worker" | "d1" | "r2" | "kv" | "service";
export type ProviderEnvironment = "production" | "preview" | "unverified";
export type ObservationState =
  "verified" | "inaccessible" | "unread" | "missing" | "unverified" | "stale";
/** Whether a list endpoint was actually read, refused, or never attempted. */
export type CoverageState = "read" | "refused" | "unread";
export type ComparisonState =
  | "match"
  | "drift"
  | "missing"
  | "unverified"
  | "inaccessible"
  | "stale"
  | "untracked";

export interface ProviderTag {
  key: string;
  value: string;
}
export interface CostUnknown {
  state: "unknown";
  note: string;
}
export const COST_UNKNOWN: CostUnknown = Object.freeze({
  state: "unknown" as const,
  note: "Cloudflare's read endpoints used here do not expose a per-resource charge. Cost is unknown, not zero.",
});

export interface ProviderBindingFact {
  type: string;
  name: string;
  service?: string;
  environment?: string;
  entrypoint?: string;
  databaseId?: string;
  bucketName?: string;
  namespaceId?: string;
}
export interface WorkerFacts {
  scriptTag: string | null;
  versionId: string | null;
  deploymentId: string | null;
  deploymentMessage: string | null;
  deploymentRead: boolean;
  compatibilityDate: string | null;
  compatibilityFlags: string[];
  tags: ProviderTag[] | null;
  tagState: ObservationState;
  routes: string[];
  domains: string[];
  domainsRead: boolean;
  bindings: ProviderBindingFact[];
  schedules: string[];
  schedulesRead: boolean;
  cpuMs: number | null;
  observabilityEnabled: boolean | null;
  observabilitySampling: number | null;
  settingsRead: boolean;
}
export interface DatabaseFacts {
  tables: number | null;
  listTables: number | null;
  fileSize: number | null;
  region: string | null;
  jurisdiction: string | null;
}
export interface BucketFacts {
  location: string | null;
}
export interface NamespaceFacts {
  supportsUrlEncoding: boolean | null;
}

export interface ObservedResource {
  kind: ProviderKind;
  id: string;
  name: string;
  environment: ProviderEnvironment;
  state: ObservationState;
  createdOn: string | null;
  modifiedOn: string | null;
  observedAt: string;
  tags: ProviderTag[] | null;
  tagState: ObservationState;
  facts: WorkerFacts | DatabaseFacts | BucketFacts | NamespaceFacts | null;
  cost: CostUnknown;
}
export interface ProviderEndpoint {
  path: string;
  method: "GET";
  state: ObservationState;
  status: number | null;
  message: string | null;
  at: string;
}
export interface ProviderSnapshot {
  version: typeof PROVIDER_INVENTORY_VERSION;
  readOnly: true;
  scope: "composer" | "account";
  account: string;
  observedAt: string;
  observation: { utc: string; melbourne: string };
  state: "verified" | "partial" | "inaccessible";
  endpoints: ProviderEndpoint[];
  resources: ObservedResource[];
  workersAtLimit: boolean;
  unrelatedResources: number;
  /** Per-resource-type list coverage. Unread is not refused and not absent. */
  lists: Partial<Record<"worker" | "d1" | "r2" | "kv", CoverageState>>;
  /** Per-Worker detail reads: asked, read, refused and never attempted. */
  detail: {
    requested: number;
    read: number;
    refused: number;
    unread: number;
  };
  limitations: string[];
  redactions: number;
  cost: CostUnknown;
}

export interface ExpectedCheck {
  field: string;
  expected: string | number | boolean | string[];
  source: string;
  /** `prefix` compares the start of a string instead of the whole value. */
  mode?: "equals" | "prefix";
}
export interface ExpectedResource {
  kind: ProviderKind;
  name: string;
  id: string | null;
  environment: ProviderEnvironment;
  source: string;
  identityRecorded: boolean;
  tags: ProviderTag[];
  checks: ExpectedCheck[];
  note: string | null;
}
/**
 * The committed evidence Composer records for one first-party app Worker.
 * This is a declaration, not provider truth: the bounded check compares it
 * with the account and leaves it unknown when the signal was not read.
 */
export interface AppWorkerIdentityRecord {
  app: string;
  worker: string;
  repo: string;
  manifest: string;
  environment: ProviderEnvironment;
  /** The app's documented production hostname, when it has a custom domain. */
  domain: string | null;
  /** The app's own deployment annotation prefix, when its deploy sets one. */
  annotationPrefix: string | null;
  /** Recorded release evidence; a receipt can be older than the live version. */
  receipt: {
    reference: string;
    versionId: string | null;
    commit: string | null;
  };
  nextAction: string;
}
export interface ExpectedInventory {
  account: string;
  resources: ExpectedResource[];
  identities: AppWorkerIdentityRecord[];
  composition: {
    id: string;
    annotation: string;
    apps: {
      id: string;
      commit: string;
      service: string;
      route: string;
      url: string;
    }[];
  };
  workerHints: Record<string, ProviderEnvironment>;
  databaseHints?: Record<string, ProviderEnvironment>;
  databaseIds?: string[];
  workerNames?: string[];
  settingsFor?: string[];
  schedulesFor?: string[];
  revision: string | null;
  sources: string[];
}

export interface ResourceChange {
  field: string;
  expected: string;
  observed: string;
}
export interface TagComparison {
  state: "match" | "partial" | "mismatch" | "unverified";
  expected: ProviderTag[];
  observed: ProviderTag[] | null;
  missing: string[];
  unexpected: string[];
}
export interface ResourceComparison {
  kind: ProviderKind;
  name: string;
  environment: ProviderEnvironment;
  expectedSource: string;
  expectedId: string | null;
  observedId: string | null;
  state: ComparisonState;
  detail: string;
  changes: ResourceChange[];
  tags: TagComparison;
  cost: CostUnknown;
  stale: boolean;
}
export interface ProviderComparison {
  comparisons: ResourceComparison[];
  /** In-scope observations that no declaration covers, by kind. */
  undeclared: {
    total: number;
    workers: {
      earlierCompositions: string[];
      otherComposerWorkers: string[];
    };
    storage: {
      d1: string[];
      r2: string[];
      kv: string[];
    };
    unrelatedResources: number;
  };
  counts: {
    expected: number;
    declaredObserved: number;
    observed: number;
    match: number;
    drift: number;
    missing: number;
    unverified: number;
    inaccessible: number;
    undeclared: number;
    undeclaredWorkers: number;
    undeclaredEarlier: number;
    undeclaredOther: number;
    undeclaredStorage: number;
    unrelated: number;
  };
  limitations: string[];
}

export interface ProviderReadOptions {
  token: string;
  account: string;
  request?: typeof fetch;
  now?: () => number;
  maxPages?: number;
  perPage?: number;
  maxRequests?: number;
  timeoutMs?: number;
  deadlineMs?: number;
  workerHints?: Record<string, ProviderEnvironment>;
  databaseHints?: Record<string, ProviderEnvironment>;
  workerNames?: string[];
  databaseIds?: string[];
  settingsFor?: string[];
  schedulesFor?: string[];
  scope?: "composer" | "account";
}

interface RequestBudget {
  used: number;
  max: number;
}
export interface RawResult {
  status: number;
  result: unknown;
}

const accountPattern = /^[a-zA-Z0-9-]{1,80}$/;
const workerNamePattern = "[a-z0-9][a-z0-9_-]{0,62}";
const workerSpecific = new RegExp(
  `^/accounts/[a-zA-Z0-9-]{1,80}/workers/scripts/${workerNamePattern}/(?:tags|deployments|versions|settings|schedules)$`,
);

/**
 * The complete provider surface this module may read. Anything else is refused
 * before a request is built, including script content, secrets, tag writes and
 * deployment or deletion endpoints.
 */
export function allowedProviderPath(path: string): boolean {
  if (path.includes("..") || path.includes("//") || /[?#]/.test(path))
    return false;
  return (
    /^\/accounts\/[a-zA-Z0-9-]{1,80}\/workers\/scripts$/.test(path) ||
    workerSpecific.test(path) ||
    /^\/accounts\/[a-zA-Z0-9-]{1,80}\/workers\/domains$/.test(path) ||
    /^\/accounts\/[a-zA-Z0-9-]{1,80}\/workers\/subdomain$/.test(path) ||
    /^\/accounts\/[a-zA-Z0-9-]{1,80}\/d1\/database$/.test(path) ||
    /^\/accounts\/[a-zA-Z0-9-]{1,80}\/d1\/database\/[a-f0-9-]{36}$/.test(
      path,
    ) ||
    /^\/accounts\/[a-zA-Z0-9-]{1,80}\/r2\/buckets$/.test(path) ||
    /^\/accounts\/[a-zA-Z0-9-]{1,80}\/storage\/kv\/namespaces$/.test(path)
  );
}

/** Build a bounded list path. Detail paths never carry a query string. */
export function providerListPath(
  account: string,
  suffix: string,
  page: number,
  perPage: number,
): string {
  if (!accountPattern.test(account))
    throw new ProviderBoundaryError("Unsupported provider account.");
  if (!Number.isSafeInteger(page) || page < 1 || page > 10)
    throw new ProviderBoundaryError("Unsupported provider page.");
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 50)
    throw new ProviderBoundaryError("Unsupported provider page size.");
  const path = `/accounts/${account}${suffix}`;
  if (!allowedProviderPath(path))
    throw new ProviderBoundaryError("Provider path is not allowlisted.");
  return path + "?per_page=" + perPage + "&page=" + page;
}

export function providerDetailPath(account: string, suffix: string): string {
  if (!accountPattern.test(account))
    throw new ProviderBoundaryError("Unsupported provider account.");
  const path = `/accounts/${account}${suffix}`;
  if (!allowedProviderPath(path))
    throw new ProviderBoundaryError("Provider path is not allowlisted.");
  return path;
}

export class ProviderBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderBoundaryError";
  }
}

/**
 * Reject a non-GET request before a URL is built. The production caller never
 * supplies a method; this guard is the contract test's refusal path.
 */
export function assertProviderGet(method: string): void {
  if (method !== "GET")
    throw new ProviderBoundaryError(
      "The provider inventory boundary only permits GET.",
    );
}

/** Redact credential-like text from any provider error shown to an owner. */
export function redactProviderText(value: unknown, maximum = 240): string {
  let text =
    typeof value === "string" && value.trim()
      ? value
      : "The provider response could not be read.";
  text = text
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(
      /\b(?:token|secret|key|authorization|password)\s*[=:]\s*[^&\s,;]+/gi,
      (match) => match.split(/[=:]/)[0] + "=[redacted]",
    )
    .replace(/\b[a-f0-9]{32,}\b/gi, "[id]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[token]")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) text = "The provider response could not be read.";
  return text.slice(0, maximum);
}

export function redactProviderMessage(value: unknown): {
  text: string;
  redacted: boolean;
} {
  const text = redactProviderText(value);
  const original =
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return { text, redacted: original !== text };
}

/** Translate an instant into labelled UTC and Australia/Melbourne display. */
export function observationLabel(at: string): {
  utc: string;
  melbourne: string;
} {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime()))
    return { utc: "Unknown UTC", melbourne: "Unknown Melbourne time" };
  const parts = (timeZone: string) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-AU", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    );
  const utcParts = parts("UTC");
  const localParts = parts("Australia/Melbourne");
  const zone =
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "Melbourne";
  return {
    utc: `${utcParts.year}/${utcParts.month}/${utcParts.day} ${utcParts.hour}:${utcParts.minute} UTC`,
    melbourne: `${localParts.year}/${localParts.month}/${localParts.day} ${localParts.hour}:${localParts.minute} ${zone}`,
  };
}

/** Stable, bounded tag values. Labels are not authority, only display metadata. */
export function normaliseTagValue(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function composerTags(input: {
  app: string;
  service: string;
  environment: string;
  lifecycle: string;
  owner: string;
}): ProviderTag[] {
  return [
    { key: "composer:app", value: normaliseTagValue(input.app) },
    { key: "composer:service", value: normaliseTagValue(input.service) },
    { key: "environment", value: normaliseTagValue(input.environment) },
    { key: "managed-by", value: "composer" },
    { key: "lifecycle", value: normaliseTagValue(input.lifecycle) },
    { key: "owner", value: normaliseTagValue(input.owner) },
  ].sort((left, right) => left.key.localeCompare(right.key));
}

/** Cloudflare returns tags as `key=value` strings; parse them without guessing. */
export function normaliseTags(value: unknown): ProviderTag[] | null {
  if (!Array.isArray(value)) return null;
  const tags: ProviderTag[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const index = entry.indexOf("=");
      const key = (index === -1 ? entry : entry.slice(0, index)).trim();
      const tagValue = index === -1 ? "" : entry.slice(index + 1).trim();
      if (key)
        tags.push({ key: key.slice(0, 80), value: tagValue.slice(0, 120) });
      continue;
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      if (typeof record.key === "string" && record.key.trim())
        tags.push({
          key: record.key.trim().slice(0, 80),
          value:
            typeof record.value === "string" ? record.value.slice(0, 120) : "",
        });
    }
  }
  const unique = new Map(
    tags.map((tag) => [tag.key + "\u0000" + tag.value, tag]),
  );
  return [...unique.values()].sort(
    (left, right) =>
      left.key.localeCompare(right.key) ||
      left.value.localeCompare(right.value),
  );
}

export function compareTags(
  expected: ProviderTag[],
  observed: ProviderTag[] | null,
): TagComparison {
  if (observed === null)
    return {
      state: "unverified",
      expected,
      observed: null,
      missing: [],
      unexpected: [],
    };
  const actual = new Map(observed.map((tag) => [tag.key, tag.value]));
  const wanted = new Map(expected.map((tag) => [tag.key, tag.value]));
  const missing = expected
    .filter((tag) => !actual.has(tag.key))
    .map((tag) => tag.key);
  const unexpected = observed
    .filter((tag) => !wanted.has(tag.key))
    .map((tag) => tag.key);
  const differing = expected.filter(
    (tag) => actual.has(tag.key) && actual.get(tag.key) !== tag.value,
  );
  const agreeing = expected.filter(
    (tag) => actual.has(tag.key) && actual.get(tag.key) === tag.value,
  );
  return {
    state:
      missing.length === 0 && unexpected.length === 0 && differing.length === 0
        ? "match"
        : agreeing.length > 0
          ? "partial"
          : "mismatch",
    expected,
    observed,
    missing,
    unexpected: [...unexpected, ...differing.map((tag) => tag.key)],
  };
}

export function formatCost(cost: CostUnknown | null | undefined): string {
  if (!cost || cost.state !== "unknown") return "Unknown";
  return "Unknown";
}

function iso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value))
    return value.filter((item): item is Record<string, unknown> =>
      record(item),
    );
  if (record(value) && Array.isArray(value.items))
    return value.items.filter((item): item is Record<string, unknown> =>
      record(item),
    );
  return [];
}

export async function readProviderJson(
  request: typeof fetch,
  url: string,
  token: string,
  timeoutMs: number,
  method: string = "GET",
): Promise<RawResult> {
  assertProviderGet(method);
  if (typeof token !== "string" || !token.trim())
    throw new ProviderBoundaryError(
      "No provider read credential is available.",
    );
  const response = await request(url, {
    method: "GET",
    redirect: "error",
    headers: {
      Authorization: "Bearer " + token.trim(),
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (AppComposer read-only inventory)",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES)
    throw new ProviderBoundaryError(
      "Provider response exceeded the read limit.",
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProviderBoundaryError(
      "Provider response was not valid JSON at status " + response.status + ".",
    );
  }
  if (!response.ok || (record(parsed) && parsed.success === false)) {
    const errors = record(parsed) ? parsed.errors : null;
    const message =
      Array.isArray(errors) && record(errors[0])
        ? String(errors[0].message ?? "Provider refused the read.")
        : "Provider refused the read.";
    throw new ProviderRefusal(response.status, message);
  }
  return {
    status: response.status,
    result: record(parsed) ? parsed.result : null,
  };
}

export class ProviderRefusal extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(redactProviderText(message));
    this.name = "ProviderRefusal";
    this.status = status;
  }
}

function endpointState(status: number | null): ObservationState {
  if (status === 404) return "missing";
  if (status === 401 || status === 403) return "inaccessible";
  return "inaccessible";
}

function normaliseWorker(
  row: Record<string, unknown>,
  environment: ProviderEnvironment,
  at: string,
): ObservedResource | null {
  const name = stringOrNull(row.id);
  if (!name) return null;
  const tags = normaliseTags(row.tags);
  const facts: WorkerFacts = {
    scriptTag: stringOrNull(row.tag),
    versionId: null,
    deploymentId: stringOrNull(row.deployment_id),
    deploymentMessage: null,
    deploymentRead: false,
    compatibilityDate: stringOrNull(row.compatibility_date),
    compatibilityFlags: stringArray(row.compatibility_flags),
    tags,
    tagState: tags === null ? "unverified" : "verified",
    routes: Array.isArray(row.routes)
      ? row.routes
          .map((route) =>
            typeof route === "string"
              ? route
              : record(route)
                ? stringOrNull(route.pattern)
                : null,
          )
          .filter((route): route is string => Boolean(route))
      : [],
    domains: [],
    domainsRead: false,
    bindings: [],
    schedules: [],
    schedulesRead: false,
    cpuMs: null,
    observabilityEnabled: null,
    observabilitySampling: null,
    settingsRead: false,
  };
  return {
    kind: "worker",
    id: name,
    name,
    environment,
    state: "verified",
    createdOn: iso(row.created_on),
    modifiedOn: iso(row.modified_on),
    observedAt: at,
    tags,
    tagState: facts.tagState,
    facts,
    cost: COST_UNKNOWN,
  };
}

function workerFacts(resource: ObservedResource): WorkerFacts | null {
  return resource.kind === "worker" ? (resource.facts as WorkerFacts) : null;
}

function databaseFacts(resource: ObservedResource): DatabaseFacts | null {
  return resource.kind === "d1" ? (resource.facts as DatabaseFacts) : null;
}

function applyWorkerTags(
  resource: ObservedResource,
  value: unknown,
  at: string,
): void {
  const facts = workerFacts(resource);
  if (!facts) return;
  const tags = normaliseTags(value);
  if (tags === null) {
    facts.tagState = "unverified";
    return;
  }
  facts.tags = tags;
  facts.tagState = "verified";
  resource.tags = tags;
  resource.tagState = "verified";
  resource.observedAt = at;
}

function applyWorkerDeployment(
  resource: ObservedResource,
  value: unknown,
  at: string,
): void {
  const facts = workerFacts(resource);
  if (!facts) return;
  facts.deploymentRead = true;
  const deployments = record(value) ? rows(value.deployments) : [];
  const latest = deployments[0];
  if (!latest) return;
  facts.deploymentId = stringOrNull(latest.id);
  const annotations = record(latest.annotations) ? latest.annotations : {};
  const message = annotations["workers/message"];
  facts.deploymentMessage = typeof message === "string" ? message : null;
  const versions = rows(latest.versions);
  facts.versionId = versions.length
    ? stringOrNull(versions[0].version_id)
    : null;
  resource.state = "verified";
  resource.observedAt = at;
}

function applyWorkerSettings(
  resource: ObservedResource,
  value: unknown,
  at: string,
): void {
  const facts = workerFacts(resource);
  if (!record(value) || !facts) return;
  facts.settingsRead = true;
  facts.compatibilityDate =
    stringOrNull(value.compatibility_date) ?? facts.compatibilityDate;
  facts.compatibilityFlags = stringArray(value.compatibility_flags).length
    ? stringArray(value.compatibility_flags)
    : facts.compatibilityFlags;
  const limits = record(value.limits) ? value.limits : {};
  facts.cpuMs = numberOrNull(limits.cpu_ms);
  const observability = record(value.observability) ? value.observability : {};
  facts.observabilityEnabled =
    typeof observability.enabled === "boolean" ? observability.enabled : null;
  facts.observabilitySampling = numberOrNull(observability.head_sampling_rate);
  if (Array.isArray(value.tags)) applyWorkerTags(resource, value.tags, at);
  facts.bindings = Array.isArray(value.bindings)
    ? value.bindings.filter(record).map((binding) => ({
        type: stringOrNull(binding.type) ?? "unknown",
        name: stringOrNull(binding.name) ?? "unknown",
        ...(stringOrNull(binding.service)
          ? { service: stringOrNull(binding.service)! }
          : {}),
        ...(stringOrNull(binding.environment)
          ? { environment: stringOrNull(binding.environment)! }
          : {}),
        ...(stringOrNull(binding.entrypoint)
          ? { entrypoint: stringOrNull(binding.entrypoint)! }
          : {}),
        ...(stringOrNull(binding.database_id)
          ? { databaseId: stringOrNull(binding.database_id)! }
          : {}),
        ...(stringOrNull(binding.bucket_name)
          ? { bucketName: stringOrNull(binding.bucket_name)! }
          : {}),
        ...(stringOrNull(binding.namespace_id)
          ? { namespaceId: stringOrNull(binding.namespace_id)! }
          : {}),
      }))
    : [];
  resource.observedAt = at;
}

function applySchedules(
  resource: ObservedResource,
  value: unknown,
  at: string,
): void {
  const facts = workerFacts(resource);
  if (!facts) return;
  facts.schedulesRead = true;
  const values = record(value) ? rows(value.schedules) : [];
  facts.schedules = values
    .map((schedule) => stringOrNull(schedule.cron))
    .filter((cron): cron is string => Boolean(cron));
  resource.observedAt = at;
}

function applyDomains(
  resources: ObservedResource[],
  value: unknown,
  at: string,
): void {
  const domains = rows(value);
  const byService = new Map<string, string[]>();
  for (const domain of domains) {
    const hostname = stringOrNull(domain.hostname);
    const service = stringOrNull(domain.service);
    if (!hostname || !service) continue;
    const list = byService.get(service) ?? [];
    list.push(hostname);
    byService.set(service, list);
  }
  for (const resource of resources) {
    if (resource.kind !== "worker") continue;
    const facts = workerFacts(resource);
    if (!facts) continue;
    facts.domains = (byService.get(resource.name) ?? []).sort();
    facts.domainsRead = true;
    resource.observedAt = at;
  }
}

function normaliseDatabase(
  row: Record<string, unknown>,
  environment: ProviderEnvironment,
  at: string,
): ObservedResource | null {
  const id = stringOrNull(row.uuid) ?? stringOrNull(row.id);
  const name = stringOrNull(row.name);
  if (!id || !name) return null;
  return {
    kind: "d1",
    id,
    name,
    environment,
    state: "unverified",
    createdOn: iso(row.created_at),
    modifiedOn: null,
    observedAt: at,
    tags: null,
    tagState: "unverified",
    facts: {
      tables: null,
      listTables: numberOrNull(row.num_tables),
      fileSize: numberOrNull(row.file_size),
      region: stringOrNull(row.running_in_region),
      jurisdiction: stringOrNull(row.jurisdiction),
    },
    cost: COST_UNKNOWN,
  };
}

function applyDatabaseDetail(
  resource: ObservedResource,
  value: unknown,
  at: string,
): void {
  if (!record(value)) return;
  const facts = databaseFacts(resource);
  if (!facts) return;
  facts.listTables = facts.listTables ?? numberOrNull(value.num_tables);
  facts.tables = numberOrNull(value.num_tables);
  facts.fileSize = numberOrNull(value.file_size) ?? facts.fileSize;
  facts.region = stringOrNull(value.running_in_region) ?? facts.region;
  facts.jurisdiction = stringOrNull(value.jurisdiction);
  resource.state = "verified";
  resource.observedAt = at;
}

function normaliseBucket(
  row: Record<string, unknown>,
  environment: ProviderEnvironment,
  at: string,
): ObservedResource | null {
  const name = stringOrNull(row.name);
  if (!name) return null;
  return {
    kind: "r2",
    id: name,
    name,
    environment,
    state: "verified",
    createdOn: iso(row.creation_date),
    modifiedOn: null,
    observedAt: at,
    tags: null,
    tagState: "unverified",
    facts: {
      location: stringOrNull(row.location),
    },
    cost: COST_UNKNOWN,
  };
}

function normaliseNamespace(
  row: Record<string, unknown>,
  environment: ProviderEnvironment,
  at: string,
): ObservedResource | null {
  const id = stringOrNull(row.id);
  if (!id) return null;
  return {
    kind: "kv",
    id,
    name: stringOrNull(row.title) ?? id,
    environment,
    state: "verified",
    createdOn: null,
    modifiedOn: null,
    observedAt: at,
    tags: null,
    tagState: "unverified",
    facts: {
      supportsUrlEncoding:
        typeof row.supports_url_encoding === "boolean"
          ? row.supports_url_encoding
          : null,
    },
    cost: COST_UNKNOWN,
  };
}

function workerEnvironment(
  name: string,
  hints: Record<string, ProviderEnvironment>,
): ProviderEnvironment {
  return hints[name] ?? "unverified";
}

function databaseEnvironment(
  row: { id: string; name: string },
  hints: Record<string, ProviderEnvironment>,
): ProviderEnvironment {
  return hints[row.id] ?? "unverified";
}

export async function readProviderInventory(
  options: ProviderReadOptions,
): Promise<ProviderSnapshot> {
  const account = options.account;
  if (!accountPattern.test(account))
    throw new ProviderBoundaryError("Unsupported provider account.");
  if (typeof options.token !== "string" || !options.token.trim())
    throw new ProviderBoundaryError(
      "No read-only Cloudflare credential is configured for this deployment.",
    );
  const request = options.request ?? fetch;
  const now = options.now ?? Date.now;
  const maxPages = Math.max(
    1,
    Math.min(options.maxPages ?? DEFAULT_MAX_PAGES, 5),
  );
  const perPage = Math.max(
    1,
    Math.min(options.perPage ?? DEFAULT_PER_PAGE, 50),
  );
  const timeoutMs = Math.max(
    1000,
    Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 30000),
  );
  const deadlineMs = Math.max(
    1000,
    Math.min(options.deadlineMs ?? DEFAULT_DEADLINE_MS, 60000),
  );
  const wallStart = Date.now();
  const budget: RequestBudget = {
    used: 0,
    max: Math.max(1, Math.min(options.maxRequests ?? DEFAULT_MAX_REQUESTS, 80)),
  };
  const hints = options.workerHints ?? {};
  const databaseIds = options.databaseIds ?? [];
  const scope = options.scope ?? "composer";
  const inScope = (name: string) =>
    scope === "account" || /^(app-composer(?:$|-)|composer-)/.test(name);
  let unrelatedResources = 0;
  const observedAt = new Date(now()).toISOString();
  const endpoints: ProviderEndpoint[] = [];
  const limitations = new Set<string>([
    "Every provider request in this check is a GET from the explicit allowlist. No resource, tag, setting, secret or deployment was written.",
    "Per-resource cost is not exposed by these reads, so it is unknown rather than zero.",
  ]);
  let redactions = 0;

  const recordEndpoint = (
    path: string,
    state: ObservationState,
    status: number | null,
    message: string | null,
  ) => {
    const redacted = message ? redactProviderMessage(message) : null;
    if (redacted?.redacted) redactions++;
    endpoints.push({
      path,
      method: "GET",
      state,
      status,
      message: redacted?.text ?? null,
      at: new Date(now()).toISOString(),
    });
  };

  const SKIPPED = Symbol("not-attempted");
  let skippedReads = 0;
  async function get(
    path: string,
  ): Promise<{ result: unknown; status: number } | null | typeof SKIPPED> {
    if (budget.used >= budget.max) {
      skippedReads++;
      return SKIPPED;
    }
    if (Date.now() - wallStart > deadlineMs) {
      skippedReads++;
      return SKIPPED;
    }
    budget.used++;
    try {
      const response = await readProviderJson(
        request,
        "https://api.cloudflare.com/client/v4" + path,
        options.token as string,
        timeoutMs,
      );
      recordEndpoint(path, "verified", response.status, null);
      return response;
    } catch (cause) {
      const refusal = cause instanceof ProviderRefusal ? cause : null;
      const status = refusal?.status ?? null;
      const message =
        refusal?.message ??
        (cause instanceof Error
          ? cause.message
          : "The provider read did not complete.");
      recordEndpoint(path, endpointState(status), status, message);
      return null;
    }
  }

  async function getMany(
    paths: string[],
  ): Promise<({ result: unknown; status: number } | null | typeof SKIPPED)[]> {
    const results: (
      | {
          result: unknown;
          status: number;
        }
      | null
      | typeof SKIPPED
    )[] = new Array(paths.length);
    let next = 0;
    const lanes = Math.min(DETAIL_CONCURRENCY, paths.length);
    await Promise.all(
      Array.from({ length: lanes }, async () => {
        while (true) {
          const index = next++;
          if (index >= paths.length) return;
          results[index] = await get(paths[index]);
        }
      }),
    );
    return results;
  }

  const resources: ObservedResource[] = [];
  const listState = new Map<ProviderKind, ObservationState>();
  let workersAtLimit = false;

  const workerRows: Record<string, unknown>[] = [];
  const seenWorkers = new Set<string>();
  let workersRead = true;
  for (let page = 1; page <= maxPages; page++) {
    const path = providerListPath(account, "/workers/scripts", page, perPage);
    const response = await get(path);
    if (response === SKIPPED) {
      workersRead = false;
      listState.set("worker", "unread");
      break;
    }
    if (!response) {
      workersRead = false;
      listState.set("worker", "inaccessible");
      break;
    }
    const pageRows = rows(response.result);
    const fresh = pageRows.filter((row) => {
      const name = stringOrNull(row.id);
      if (!name || seenWorkers.has(name)) return false;
      seenWorkers.add(name);
      return true;
    });
    workerRows.push(...fresh);
    if (fresh.length === 0) break;
    if (pageRows.length < perPage) break;
    if (page === maxPages) {
      workersAtLimit = true;
      limitations.add(
        "The Worker list reached its page limit. Later scripts were not read; the scan is partial.",
      );
    }
  }
  if (workersRead) listState.set("worker", "verified");
  for (const row of workerRows) {
    const name = String(row.id ?? "");
    if (!inScope(name)) {
      unrelatedResources++;
      continue;
    }
    const worker = normaliseWorker(
      row,
      workerEnvironment(name, hints),
      observedAt,
    );
    if (worker) resources.push(worker);
  }
  if (!workersRead)
    limitations.add(
      "The Worker list could not be read. Worker presence is unknown, not empty.",
    );

  const domainsResponse = await get(
    providerDetailPath(account, "/workers/domains"),
  );
  if (domainsResponse && domainsResponse !== SKIPPED)
    applyDomains(
      resources,
      domainsResponse.result,
      new Date(now()).toISOString(),
    );
  else if (domainsResponse === SKIPPED) listState.set("service", "unread");
  else listState.set("service", "inaccessible");

  const d1Response = await get(
    providerListPath(account, "/d1/database", 1, perPage),
  );
  if (d1Response && d1Response !== SKIPPED) {
    listState.set("d1", "verified");
    for (const row of rows(d1Response.result)) {
      if (!inScope(String(row.name ?? ""))) {
        unrelatedResources++;
        continue;
      }
      const database = normaliseDatabase(
        row,
        databaseEnvironment(
          { id: String(row.uuid ?? ""), name: String(row.name ?? "") },
          options.databaseHints ?? {},
        ),
        observedAt,
      );
      if (database) resources.push(database);
    }
  } else {
    listState.set("d1", d1Response === SKIPPED ? "unread" : "inaccessible");
    limitations.add(
      d1Response === SKIPPED
        ? "D1 databases were not read because the request or time bound was reached. Database presence is unknown, not empty."
        : "D1 databases could not be listed. Database presence is unknown, not empty.",
    );
  }

  const r2Response = await get(providerDetailPath(account, "/r2/buckets"));
  if (r2Response && r2Response !== SKIPPED) {
    listState.set("r2", "verified");
    const buckets = record(r2Response.result)
      ? rows(r2Response.result.buckets)
      : rows(r2Response.result);
    for (const row of buckets) {
      if (!inScope(String(row.name ?? ""))) {
        unrelatedResources++;
        continue;
      }
      const bucket = normaliseBucket(
        row,
        workerEnvironment(String(row.name ?? ""), hints),
        observedAt,
      );
      if (bucket) resources.push(bucket);
    }
  } else {
    listState.set("r2", r2Response === SKIPPED ? "unread" : "inaccessible");
    limitations.add(
      r2Response === SKIPPED
        ? "R2 buckets were not read because the request or time bound was reached. Bucket presence is unknown, not empty."
        : "R2 buckets could not be listed. Bucket presence is unknown, not empty.",
    );
  }

  const kvResponse = await get(
    providerListPath(account, "/storage/kv/namespaces", 1, perPage),
  );
  if (kvResponse && kvResponse !== SKIPPED) {
    listState.set("kv", "verified");
    for (const row of rows(kvResponse.result)) {
      if (!inScope(String(row.title ?? row.id ?? ""))) {
        unrelatedResources++;
        continue;
      }
      const namespace = normaliseNamespace(
        row,
        workerEnvironment(String(row.title ?? row.id ?? ""), hints),
        observedAt,
      );
      if (namespace) resources.push(namespace);
    }
  } else {
    listState.set("kv", kvResponse === SKIPPED ? "unread" : "inaccessible");
    limitations.add(
      kvResponse === SKIPPED
        ? "KV namespaces were not read because the request or time bound was reached. Namespace presence is unknown, not empty."
        : "KV namespaces could not be listed. Namespace presence is unknown, not empty.",
    );
  }

  for (const databaseId of databaseIds.slice(0, 4)) {
    const resource = resources.find(
      (item) => item.kind === "d1" && item.id === databaseId,
    );
    if (!resource) continue;
    const path = providerDetailPath(account, "/d1/database/" + databaseId);
    const response = await get(path);
    if (response === SKIPPED) {
      resource.state = "unread";
      limitations.add(
        "A declared D1 database detail was not read because a bound was reached. Its table count is unknown.",
      );
      continue;
    }
    if (!response) {
      resource.state = "inaccessible";
      limitations.add(
        "A declared D1 database detail could not be read. Its table count is unverified.",
      );
      continue;
    }
    applyDatabaseDetail(
      resource,
      response.result,
      new Date(now()).toISOString(),
    );
    const facts = databaseFacts(resource);
    if (
      facts &&
      facts.listTables !== null &&
      facts.tables !== null &&
      facts.listTables !== facts.tables
    )
      limitations.add(
        "The D1 list endpoint reported " +
          facts.listTables +
          " table(s) for " +
          resource.name +
          " while its per-database read reported " +
          facts.tables +
          ". The list count is not used as fact.",
      );
  }

  const allDetailNames = [
    ...new Set([
      ...(options.workerNames ?? []),
      ...resources
        .filter(
          (resource) =>
            resource.kind === "worker" &&
            (resource.environment !== "unverified" ||
              Boolean(hints[resource.name])),
        )
        .map((resource) => resource.name),
    ]),
  ].filter((name) => new RegExp(`^${workerNamePattern}$`).test(name));
  const detailNames = allDetailNames.slice(0, MAX_DETAIL_WORKERS);
  if (allDetailNames.length > detailNames.length)
    limitations.add(
      "Only the first " +
        MAX_DETAIL_WORKERS +
        " declared Workers received per-Worker detail reads. The remaining " +
        (allDetailNames.length - detailNames.length) +
        " stay unverified.",
    );

  // Identity evidence first: read each declared Worker's latest deployment and
  // tags before any optional setting. A small, fixed concurrency keeps a normal
  // account inside the wall-clock deadline; a bound that is still reached is
  // recorded as not-read, never as a provider refusal.
  const detailTargets = detailNames
    .map((name) =>
      resources.find((item) => item.kind === "worker" && item.name === name),
    )
    .filter((resource): resource is ObservedResource => Boolean(resource));
  const identityRequests = detailTargets.flatMap((resource) => {
    const suffix = "/workers/scripts/" + resource.name;
    return [
      {
        resource,
        field: "deployments" as const,
        path:
          providerDetailPath(account, suffix + "/deployments") + "?per_page=1",
      },
      {
        resource,
        field: "tags" as const,
        path: providerDetailPath(account, suffix + "/tags"),
      },
    ];
  });
  const detail = { requested: 0, read: 0, refused: 0, unread: 0 };
  const settle = (
    response: { result: unknown; status: number } | null | typeof SKIPPED,
  ) => {
    if (response === SKIPPED) {
      detail.unread++;
      return "unread" as const;
    }
    if (!response) {
      detail.refused++;
      return "refused" as const;
    }
    detail.read++;
    return "read" as const;
  };
  const identityResults = await getMany(
    identityRequests.map((request) => request.path),
  );
  detail.requested += identityRequests.length;
  identityResults.forEach((response, index) => {
    const request = identityRequests[index];
    const facts = workerFacts(request.resource);
    if (!facts) return;
    const outcome = settle(response);
    if (request.field === "deployments") {
      if (response && response !== SKIPPED && outcome === "read")
        applyWorkerDeployment(
          request.resource,
          response.result,
          new Date(now()).toISOString(),
        );
      return;
    }
    if (outcome === "read" && response && response !== SKIPPED)
      applyWorkerTags(
        request.resource,
        response.result,
        new Date(now()).toISOString(),
      );
    else {
      const state =
        outcome === "refused"
          ? "inaccessible"
          : outcome === "unread"
            ? "unread"
            : "unverified";
      facts.tagState = state;
      request.resource.tagState = state;
    }
  });
  const extraRequests = detailTargets.flatMap((resource) => {
    const suffix = "/workers/scripts/" + resource.name;
    const requests: {
      resource: ObservedResource;
      field: "settings" | "schedules";
      path: string;
    }[] = [];
    if (options.settingsFor?.includes(resource.name))
      requests.push({
        resource,
        field: "settings",
        path: providerDetailPath(account, suffix + "/settings"),
      });
    if (options.schedulesFor?.includes(resource.name))
      requests.push({
        resource,
        field: "schedules",
        path: providerDetailPath(account, suffix + "/schedules"),
      });
    return requests;
  });
  const extraResults = await getMany(
    extraRequests.map((request) => request.path),
  );
  detail.requested += extraRequests.length;
  extraResults.forEach((response, index) => {
    const request = extraRequests[index];
    settle(response);
    if (!response || response === SKIPPED) return;
    if (request.field === "settings")
      applyWorkerSettings(
        request.resource,
        response.result,
        new Date(now()).toISOString(),
      );
    else
      applySchedules(
        request.resource,
        response.result,
        new Date(now()).toISOString(),
      );
  });

  const kinds: ProviderKind[] = ["worker", "d1", "r2", "kv"];
  const inaccessibleKinds = kinds.filter(
    (kind) => listState.get(kind) === "inaccessible",
  );
  const unreadKinds = kinds.filter((kind) => listState.get(kind) === "unread");
  const verifiedKinds = kinds.filter(
    (kind) => listState.get(kind) === "verified",
  );
  const uniqueResources = [
    ...new Map(
      resources.map((resource) => [
        resource.kind + "\u0000" + resource.id,
        resource,
      ]),
    ).values(),
  ];
  const state: ProviderSnapshot["state"] =
    inaccessibleKinds.length === kinds.length ||
    (verifiedKinds.length === 0 && inaccessibleKinds.length > 0)
      ? "inaccessible"
      : inaccessibleKinds.length > 0 ||
          unreadKinds.length > 0 ||
          workersAtLimit ||
          detail.unread > 0
        ? "partial"
        : verifiedKinds.length === 0
          ? "inaccessible"
          : "verified";
  if (skippedReads > 0)
    limitations.add(
      skippedReads +
        " allowlisted read(s) were not attempted because the request or overall time bound was reached. Not-read values are unverified, not refused and not absent.",
    );
  if (workersAtLimit && state === "verified")
    limitations.add("The Worker scan is partial because it reached a bound.");
  if (unrelatedResources > 0)
    limitations.add(
      unrelatedResources +
        " unrelated account resource(s) were observed but excluded from this bounded Composer view. They are not represented in any comparison.",
    );
  const lists: ProviderSnapshot["lists"] = {};
  for (const kind of ["worker", "d1", "r2", "kv"] as const) {
    const value = listState.get(kind);
    if (value === "verified") lists[kind] = "read";
    else if (value === "unread") lists[kind] = "unread";
    else if (value === "inaccessible") lists[kind] = "refused";
  }

  return {
    version: PROVIDER_INVENTORY_VERSION,
    readOnly: true,
    scope,
    account,
    observedAt,
    observation: observationLabel(observedAt),
    state,
    endpoints,
    resources: uniqueResources,
    workersAtLimit,
    unrelatedResources,
    lists,
    detail,
    limitations: [...limitations].slice(0, 8),
    redactions,
    cost: COST_UNKNOWN,
  };
}

function observedValue(
  resource: ObservedResource,
  field: string,
  snapshot: ProviderSnapshot,
): string | number | boolean | string[] | null {
  if (field === "account") return snapshot.account;
  if (resource.kind === "worker") {
    const facts = workerFacts(resource);
    if (!facts) return null;
    if (field === "name") return resource.name;
    if (field === "environment") return resource.environment;
    if (field === "customDomains")
      return facts.domainsRead ? facts.domains : null;
    if (field === "cron") return facts.schedulesRead ? facts.schedules : null;
    if (field === "compatibilityDate")
      return facts.settingsRead ? facts.compatibilityDate : null;
    if (field === "compatibilityFlags")
      return facts.settingsRead ? facts.compatibilityFlags : null;
    if (field === "observabilityEnabled")
      return facts.settingsRead ? facts.observabilityEnabled : null;
    if (field === "cpuMs") return facts.settingsRead ? facts.cpuMs : null;
    if (field === "deploymentMessage")
      return facts.deploymentRead ? (facts.deploymentMessage ?? "") : null;
    if (field === "deploymentAnnotation")
      return facts.deploymentRead ? facts.deploymentMessage : null;
    if (field.startsWith("binding:")) {
      const name = field.slice("binding:".length);
      const binding = facts.bindings.find((item) => item.name === name);
      if (!binding) return facts.settingsRead ? "absent" : null;
      const parts: string[] = [
        binding.service ??
          binding.databaseId ??
          binding.bucketName ??
          binding.namespaceId ??
          binding.type,
      ];
      if (binding.environment) parts.push(binding.environment);
      if (binding.entrypoint) parts.push(binding.entrypoint);
      return parts.filter(Boolean).join("|");
    }
    return null;
  }
  if (resource.kind === "d1") {
    const facts = databaseFacts(resource);
    if (field === "name") return resource.name;
    if (field === "id") return resource.id;
    if (field === "environment") return resource.environment;
    if (field === "tables") return facts?.tables ?? null;
    return null;
  }
  if (field === "name") return resource.name;
  if (field === "id") return resource.id;
  if (field === "environment") return resource.environment;
  return null;
}

function expectedValue(value: ExpectedCheck["expected"]): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function observedText(
  value: string | number | boolean | string[] | null,
): string {
  if (value === null || value === undefined) return "Not read";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function sameValue(
  expected: ExpectedCheck["expected"],
  observed: string | number | boolean | string[] | null,
  mode: ExpectedCheck["mode"] = "equals",
): boolean {
  if (observed === null) return false;
  if (Array.isArray(expected)) {
    if (!Array.isArray(observed)) return false;
    const left = [...expected].sort().join("\u0000");
    const right = [...observed].sort().join("\u0000");
    return left === right;
  }
  if (mode === "prefix")
    return (
      typeof expected === "string" &&
      typeof observed === "string" &&
      observed.startsWith(expected)
    );
  return expected === observed;
}

/**
 * Compare Composer's declared expectations with one bounded observation.
 * Names and annotations are evidence for a comparison; they never grant
 * ownership, permission or billing authority.
 */
export function compareProviderInventory(
  expected: ExpectedInventory,
  snapshot: ProviderSnapshot,
  now: number = Date.now(),
): ProviderComparison {
  const comparisons: ResourceComparison[] = [];
  const observedByKey = new Map<string, ObservedResource>();
  for (const resource of snapshot.resources)
    observedByKey.set(resource.kind + "\u0000" + resource.name, resource);
  const listKind = (kind: ProviderKind): "worker" | "d1" | "r2" | "kv" =>
    kind === "worker" || kind === "service" ? "worker" : kind;
  const listCoverage = (kind: ProviderKind): CoverageState => {
    const recorded = snapshot.lists?.[listKind(kind)];
    if (recorded) return recorded;
    // Snapshots from before list coverage was recorded fall back to their
    // endpoint outcomes. Anything short of a full verified scan is unread:
    // absence is only established by an actual successful list read.
    if (snapshot.state === "inaccessible") return "refused";
    const fragment =
      listKind(kind) === "worker"
        ? "/workers/scripts"
        : listKind(kind) === "d1"
          ? "/d1/database"
          : listKind(kind) === "r2"
            ? "/r2/buckets"
            : "/storage/kv/namespaces";
    return snapshot.endpoints.some(
      (endpoint) =>
        endpoint.state === "inaccessible" && endpoint.path.includes(fragment),
    )
      ? "refused"
      : snapshot.state === "verified"
        ? "read"
        : "unread";
  };

  for (const item of expected.resources) {
    const observed =
      item.kind === "service"
        ? snapshot.resources.find(
            (resource) =>
              resource.kind === "worker" && resource.name === item.name,
          )
        : ((item.id
            ? snapshot.resources.find(
                (resource) =>
                  resource.kind === item.kind && resource.id === item.id,
              )
            : undefined) ??
          observedByKey.get(item.kind + "\u0000" + item.name));
    const tags = compareTags(item.tags, observed?.tags ?? null);
    if (!observed) {
      const coverage = listCoverage(item.kind);
      const refused = coverage === "refused";
      const storagePaginationUnknown =
        item.kind !== "worker" && item.kind !== "service";
      comparisons.push({
        kind: item.kind,
        name: item.name,
        environment: item.environment,
        expectedSource: item.source,
        expectedId: item.id,
        observedId: null,
        state: refused
          ? "inaccessible"
          : coverage === "unread" || storagePaginationUnknown
            ? "unverified"
            : "missing",
        detail: refused
          ? "The provider list for this resource type was refused or failed. Presence is unknown, not absent."
          : coverage === "unread"
            ? "The provider list for this resource type was not read because a bound was reached. Presence is unknown, not absent."
            : storagePaginationUnknown
              ? "A storage list page was read, but pagination or cursor completeness is not recorded. Presence is unknown, not absent."
              : "The declared resource was not present in the verified provider list.",
        changes: [],
        tags,
        cost: COST_UNKNOWN,
        stale: false,
      });
      continue;
    }
    const changes: ResourceChange[] = [];
    const unread: string[] = [];
    for (const check of item.checks) {
      const value = observedValue(observed, check.field, snapshot);
      if (value === null) {
        unread.push(check.field);
        continue;
      }
      if (!sameValue(check.expected, value, check.mode))
        changes.push({
          field: check.field,
          expected: expectedValue(check.expected),
          observed: observedText(value),
        });
    }
    const stale =
      (now - Date.parse(observed.observedAt)) / 3600000 > STALE_AFTER_HOURS;
    const state: ComparisonState = changes.length
      ? "drift"
      : !item.identityRecorded
        ? "unverified"
        : unread.length
          ? "unverified"
          : stale
            ? "stale"
            : "match";
    const detail = changes.length
      ? changes
          .slice(0, 3)
          .map(
            (change) =>
              `${change.field} expected ${change.expected}; observed ${change.observed}`,
          )
          .join(". ")
          .slice(0, 500)
      : !item.identityRecorded
        ? (item.note ??
          "Composer records no provider identity for this resource, so the matching name is a convention rather than a confirmed identity.")
        : unread.length
          ? "These fields could not be read: " + unread.join(", ") + "."
          : stale
            ? `The observation is older than ${STALE_AFTER_HOURS} hours; re-run the check before relying on it.`
            : "The observed values match Composer's declared expectations.";
    comparisons.push({
      kind: item.kind,
      name: item.name,
      environment: item.environment,
      expectedSource: item.source,
      expectedId: item.id,
      observedId: observed.id,
      state,
      detail,
      changes,
      tags,
      cost: COST_UNKNOWN,
      stale,
    });
  }

  const undeclared = {
    total: 0,
    workers: {
      earlierCompositions: [] as string[],
      otherComposerWorkers: [] as string[],
    },
    storage: {
      d1: [] as string[],
      r2: [] as string[],
      kv: [] as string[],
    },
    unrelatedResources: snapshot.unrelatedResources,
  };
  const declaredObserved = new Set(
    comparisons
      .filter((comparison) => comparison.observedId !== null)
      .map((comparison) => comparison.kind + "\u0000" + comparison.name),
  );
  const declaredObservedIds = new Set(
    expected.resources
      .filter((item) => item.id)
      .map((item) => item.kind + "\u0000" + item.id),
  );
  for (const resource of snapshot.resources) {
    const declared =
      declaredObserved.has(resource.kind + "\u0000" + resource.name) ||
      declaredObserved.has("service\u0000" + resource.name) ||
      declaredObservedIds.has(resource.kind + "\u0000" + resource.id);
    if (declared) continue;
    if (resource.kind === "worker") {
      if (/^composer-(?:guestbook|showcase)-[a-f0-9]{16}$/.test(resource.name))
        undeclared.workers.earlierCompositions.push(resource.name);
      else undeclared.workers.otherComposerWorkers.push(resource.name);
    } else if (resource.kind === "d1")
      undeclared.storage.d1.push(resource.name);
    else if (resource.kind === "r2") undeclared.storage.r2.push(resource.name);
    else if (resource.kind === "kv") undeclared.storage.kv.push(resource.name);
  }
  const undeclaredWorkers =
    undeclared.workers.earlierCompositions.length +
    undeclared.workers.otherComposerWorkers.length;
  const undeclaredStorage =
    undeclared.storage.d1.length +
    undeclared.storage.r2.length +
    undeclared.storage.kv.length;
  undeclared.total = undeclaredWorkers + undeclaredStorage;

  const counts = {
    expected: comparisons.length,
    declaredObserved: declaredObserved.size,
    observed: snapshot.resources.length,
    match: 0,
    drift: 0,
    missing: 0,
    unverified: 0,
    inaccessible: 0,
    undeclared: undeclared.total,
    undeclaredWorkers,
    undeclaredEarlier: undeclared.workers.earlierCompositions.length,
    undeclaredOther: undeclared.workers.otherComposerWorkers.length,
    undeclaredStorage,
    unrelated: snapshot.unrelatedResources,
  };
  for (const comparison of comparisons) {
    if (comparison.state === "match") counts.match++;
    else if (comparison.state === "drift") counts.drift++;
    else if (comparison.state === "missing") counts.missing++;
    else if (comparison.state === "unverified" || comparison.state === "stale")
      counts.unverified++;
    else if (comparison.state === "inaccessible") counts.inaccessible++;
  }

  if (counts.declaredObserved + counts.undeclared !== counts.observed)
    throw new Error(
      "Provider comparison is not reconciled: " +
        counts.declaredObserved +
        " declared observations + " +
        counts.undeclared +
        " undeclared does not equal " +
        counts.observed +
        " observed resources.",
    );
  if (
    counts.match +
      counts.drift +
      counts.missing +
      counts.unverified +
      counts.inaccessible !==
    counts.expected
  )
    throw new Error(
      "Provider comparison is not reconciled: comparison states do not add up to the declared total.",
    );

  return {
    comparisons,
    undeclared,
    counts,
    limitations: snapshot.limitations,
  };
}

/** A deterministic, bounded summary line for a human report or PR receipt. */
export function providerCountsLine(comparison: ProviderComparison): string {
  const counts = comparison.counts;
  return [
    `${counts.expected} declared`,
    `${counts.observed} observed in scope`,
    `${counts.match} match`,
    `${counts.drift} drift`,
    `${counts.missing} missing`,
    `${counts.unverified} unverified`,
    `${counts.inaccessible} inaccessible`,
    `${counts.undeclared} not declared (${counts.undeclaredWorkers} Worker script(s), ${counts.undeclaredStorage} storage)`,
  ].join(" · ");
}

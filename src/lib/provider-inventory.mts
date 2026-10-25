// Read-only Cloudflare inventory for Composer's owner experience.
//
// This module performs bounded GET reads against an explicit path allowlist and
// normalises the answers into observations. It never writes a provider value,
// never logs a credential and never turns an unread field into a clean result.
// Cost is always unknown here: these endpoints do not expose a per-resource
// charge, and an unknown cost is not zero.
export const PROVIDER_INVENTORY_VERSION = "composer.provider-inventory/1";
export const PROVIDER_CHECK_VERSION = "composer.provider-check/1";

export const DEFAULT_MAX_PAGES = 3;
export const DEFAULT_PER_PAGE = 50;
export const DEFAULT_MAX_REQUESTS = 48;
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_DEADLINE_MS = 20000;
export const MAX_RESPONSE_BYTES = 2_000_000;
export const MAX_DETAIL_WORKERS = 12;
/** A provider observation older than this is shown as stale, not current. */
export const STALE_AFTER_HOURS = 24;

export type ProviderKind = "worker" | "d1" | "r2" | "kv" | "service";
export type ProviderEnvironment = "production" | "preview" | "unverified";
export type ObservationState =
  "verified" | "inaccessible" | "missing" | "unverified" | "stale";
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
  limitations: string[];
  redactions: number;
  cost: CostUnknown;
}

export interface ExpectedCheck {
  field: string;
  expected: string | number | boolean | string[];
  source: string;
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
export interface ExpectedInventory {
  account: string;
  resources: ExpectedResource[];
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
  untrackedWorkers: {
    earlierCompositions: string[];
    otherComposerWorkers: string[];
    unrelatedWorkers: number;
  };
  counts: {
    expected: number;
    observed: number;
    match: number;
    drift: number;
    missing: number;
    unverified: number;
    inaccessible: number;
    untracked: number;
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

  async function get(
    path: string,
  ): Promise<{ result: unknown; status: number } | null> {
    if (budget.used >= budget.max) {
      limitations.add(
        "The request limit was reached. Unread resources are unverified, not absent.",
      );
      return null;
    }
    if (Date.now() - wallStart > deadlineMs) {
      limitations.add(
        "The overall read deadline was reached. Unread resources are unverified, not absent.",
      );
      return null;
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

  const resources: ObservedResource[] = [];
  const listState = new Map<ProviderKind, ObservationState>();
  let workersAtLimit = false;

  const workerRows: Record<string, unknown>[] = [];
  const seenWorkers = new Set<string>();
  let workersRead = true;
  for (let page = 1; page <= maxPages; page++) {
    const path = providerListPath(account, "/workers/scripts", page, perPage);
    const response = await get(path);
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
  if (domainsResponse)
    applyDomains(
      resources,
      domainsResponse.result,
      new Date(now()).toISOString(),
    );
  else listState.set("service", "inaccessible");

  const d1Response = await get(
    providerListPath(account, "/d1/database", 1, perPage),
  );
  if (d1Response) {
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
    listState.set("d1", "inaccessible");
    limitations.add(
      "D1 databases could not be listed. Database presence is unknown, not empty.",
    );
  }

  const r2Response = await get(providerDetailPath(account, "/r2/buckets"));
  if (r2Response) {
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
    listState.set("r2", "inaccessible");
    limitations.add(
      "R2 buckets could not be listed. Bucket presence is unknown, not empty.",
    );
  }

  const kvResponse = await get(
    providerListPath(account, "/storage/kv/namespaces", 1, perPage),
  );
  if (kvResponse) {
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
    listState.set("kv", "inaccessible");
    limitations.add(
      "KV namespaces could not be listed. Namespace presence is unknown, not empty.",
    );
  }

  for (const databaseId of databaseIds.slice(0, 4)) {
    const resource = resources.find(
      (item) => item.kind === "d1" && item.id === databaseId,
    );
    if (!resource) continue;
    const path = providerDetailPath(account, "/d1/database/" + databaseId);
    const response = await get(path);
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

  const detailNames = [
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
  ]
    .filter((name) => new RegExp(`^${workerNamePattern}$`).test(name))
    .slice(0, MAX_DETAIL_WORKERS);

  for (const name of detailNames) {
    const resource = resources.find(
      (item) => item.kind === "worker" && item.name === name,
    );
    if (!resource) continue;
    const facts = workerFacts(resource);
    if (!facts) continue;
    const suffix = "/workers/scripts/" + name;
    const deployments = await get(
      providerDetailPath(account, suffix + "/deployments") + "?per_page=1",
    );
    if (deployments)
      applyWorkerDeployment(
        resource,
        deployments.result,
        new Date(now()).toISOString(),
      );
    const tags = await get(providerDetailPath(account, suffix + "/tags"));
    if (tags) {
      applyWorkerTags(resource, tags.result, new Date(now()).toISOString());
    } else {
      facts.tagState = "inaccessible";
      resource.tagState = "inaccessible";
    }
    if (options.settingsFor?.includes(name)) {
      const settings = await get(
        providerDetailPath(account, suffix + "/settings"),
      );
      if (settings)
        applyWorkerSettings(
          resource,
          settings.result,
          new Date(now()).toISOString(),
        );
    }
    if (options.schedulesFor?.includes(name)) {
      const schedules = await get(
        providerDetailPath(account, suffix + "/schedules"),
      );
      if (schedules)
        applySchedules(
          resource,
          schedules.result,
          new Date(now()).toISOString(),
        );
    }
  }

  const kinds: ProviderKind[] = ["worker", "d1", "r2", "kv"];
  const inaccessibleKinds = kinds.filter(
    (kind) => listState.get(kind) === "inaccessible",
  );
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
    inaccessibleKinds.length === kinds.length
      ? "inaccessible"
      : inaccessibleKinds.length > 0 || workersAtLimit
        ? "partial"
        : verifiedKinds.length === 0
          ? "inaccessible"
          : "verified";
  if (workersAtLimit && state === "verified")
    limitations.add("The Worker scan is partial because it reached a bound.");
  if (unrelatedResources > 0)
    limitations.add(
      unrelatedResources +
        " unrelated account resource(s) were observed but excluded from this bounded Composer view. They are not represented in any comparison.",
    );

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
): boolean {
  if (observed === null) return false;
  if (Array.isArray(expected)) {
    if (!Array.isArray(observed)) return false;
    const left = [...expected].sort().join("\u0000");
    const right = [...observed].sort().join("\u0000");
    return left === right;
  }
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
      const listUnavailable =
        snapshot.state === "inaccessible" ||
        snapshot.endpoints.some(
          (endpoint) =>
            endpoint.state === "inaccessible" &&
            endpoint.path.includes(
              item.kind === "worker" || item.kind === "service"
                ? "/workers/scripts"
                : item.kind === "d1"
                  ? "/d1/database"
                  : item.kind === "r2"
                    ? "/r2/buckets"
                    : "/storage/kv/namespaces",
            ),
        );
      comparisons.push({
        kind: item.kind,
        name: item.name,
        environment: item.environment,
        expectedSource: item.source,
        expectedId: item.id,
        observedId: null,
        state: listUnavailable ? "inaccessible" : "missing",
        detail: listUnavailable
          ? "The provider list for this resource type could not be read. Presence is unknown, not absent."
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
      if (!sameValue(check.expected, value))
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

  const expectedWorkerNames = new Set(
    expected.resources
      .filter((item) => item.kind === "worker" || item.kind === "service")
      .map((item) => item.name),
  );
  const earlierCompositions: string[] = [];
  const otherComposerWorkers: string[] = [];
  for (const resource of snapshot.resources) {
    if (resource.kind !== "worker") continue;
    if (expectedWorkerNames.has(resource.name)) continue;
    if (/^composer-(?:guestbook|showcase)-[a-f0-9]{16}$/.test(resource.name))
      earlierCompositions.push(resource.name);
    else if (resource.name.startsWith("composer-"))
      otherComposerWorkers.push(resource.name);
  }

  const counts = {
    expected: comparisons.length,
    observed: snapshot.resources.length,
    match: 0,
    drift: 0,
    missing: 0,
    unverified: 0,
    inaccessible: 0,
    untracked: earlierCompositions.length + otherComposerWorkers.length,
  };
  for (const comparison of comparisons) {
    if (comparison.state === "match") counts.match++;
    else if (comparison.state === "drift") counts.drift++;
    else if (comparison.state === "missing") counts.missing++;
    else if (comparison.state === "unverified" || comparison.state === "stale")
      counts.unverified++;
    else if (comparison.state === "inaccessible") counts.inaccessible++;
    else counts.untracked++;
  }

  return {
    comparisons,
    untrackedWorkers: {
      earlierCompositions,
      otherComposerWorkers,
      unrelatedWorkers: snapshot.unrelatedResources,
    },
    counts,
    limitations: snapshot.limitations,
  };
}

/** A deterministic, bounded summary line for a human report or PR receipt. */
export function providerCountsLine(comparison: ProviderComparison): string {
  const counts = comparison.counts;
  return [
    `${counts.expected} expected`,
    `${counts.observed} observed`,
    `${counts.match} match`,
    `${counts.drift} drift`,
    `${counts.missing} missing`,
    `${counts.unverified} unverified`,
    `${counts.inaccessible} inaccessible`,
    `${counts.untracked} undeclared Worker script(s)`,
  ].join(" · ");
}

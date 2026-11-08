// Deterministic, credential-free models.dev intelligence adapter.
//
// This module is the first executable slice of #19. It performs one bounded
// conditional read of the public models.dev catalogue, validates the payload in
// isolation, keeps the last known-good snapshot, classifies actual changes and
// records a deduplicated incident/action ledger. It has no scheduler, no model
// call, no GitHub write and no credential. "Unchanged" advances checked-at
// only: it never advances changed-at, recipe-tested-at or writes an incident.
//
// Source text and links are untrusted data. Nothing here executes upstream
// content, and a catalogue entry never means a recipe, credential or account is
// supported.

export const MODELS_DEV_URL = "https://models.dev/api.json";
export const MODELS_DEV_SOURCE = "models.dev";
export const MODELS_DEV_INTEGRATION = "models-dev-api";
export const MODELS_DEV_ADAPTER = "models-dev-adapter/1";
export const MODELS_DEV_SCHEMA = "composer.models-dev-snapshot/1";
export const MODELS_DEV_STATE = "composer.models-dev-state/1";
export const MODELS_DEV_SUMMARY = "composer.models-dev-summary/1";
// Starting limits from #19. They are validated by fixtures and are not a claim
// about any upstream SLA.
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 20_000;
export const MAX_ATTEMPTS = 3;
export const FRESH_FOR_MS = 48 * 60 * 60 * 1000;
export const BASE_BACKOFF_MS = 15 * 60 * 1000;
export const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
export const MAX_PROVIDERS = 512;
export const MAX_MODELS_PER_PROVIDER = 2000;
export const MAX_INCIDENTS = 50;
export const MAX_ACTIONS = 20;
export const MAX_CHANGE_SAMPLES = 20;
export const MAX_SELECTED_MODELS = 200;

const providerIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const modelIdPattern = /^[A-Za-z0-9~@][A-Za-z0-9._:/+@~-]{0,99}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type FailureSignature =
  | "http-429"
  | "http-client-error"
  | "http-server-error"
  | "timeout"
  | "network"
  | "oversized"
  | "schema-invalid"
  | "state-invalid";

export type AttemptOutcome =
  | "changed"
  | "unchanged"
  | "deferred"
  | FailureSignature;

export interface ModelsDevRecipe {
  id: string;
  version: number;
}

export interface ModelsDevCost {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
}

export interface ModelsDevModel {
  id: string;
  name: string;
  status: "alpha" | "beta" | "deprecated" | "stable";
  releaseDate: string | null;
  lastUpdated: string | null;
  context: number | null;
  outputLimit: number | null;
  cost: ModelsDevCost | null;
  toolCall: boolean | null;
  reasoning: boolean | null;
  attachment: boolean | null;
  modalities: { input: string[]; output: string[] } | null;
}

export interface ModelsDevProvider {
  id: string;
  name: string;
  models: Record<string, ModelsDevModel>;
}

export interface ModelsDevSnapshot {
  version: typeof MODELS_DEV_SCHEMA;
  adapter: typeof MODELS_DEV_ADAPTER;
  providers: Record<string, ModelsDevProvider>;
  providerCount: number;
  modelCount: number;
}

export interface AttemptRecord {
  at: string;
  outcome: AttemptOutcome;
  status: number | null;
  durationMs: number;
  bytes: number;
  attempts: number;
  detail: string | null;
}

export interface SuccessRecord {
  at: string;
  status: 200 | 304;
  etag: string | null;
  lastModified: string | null;
  contentHash: string;
  bytes: number;
  providers: number;
  models: number;
}

export interface FieldChange {
  provider: string;
  model: string;
  fields: string[];
}

export interface ChangeRecord {
  at: string;
  fromHash: string;
  toHash: string;
  addedProviders: string[];
  removedProviders: string[];
  addedModels: FieldChange[];
  removedModels: FieldChange[];
  material: FieldChange[];
  cosmetic: FieldChange[];
  counts: {
    addedProviders: number;
    removedProviders: number;
    addedModels: number;
    removedModels: number;
    material: number;
    cosmetic: number;
  };
}

export interface IncidentRecord {
  fingerprint: string;
  source: string;
  integration: string;
  recipe: ModelsDevRecipe;
  signature: FailureSignature;
  state: "open" | "recovered";
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  detail: string;
  resolution: {
    at: string;
    requirement: "fetch-and-validate";
    check: string;
  } | null;
}

export interface ActionRecord {
  fingerprint: string;
  source: string;
  integration: string;
  recipe: ModelsDevRecipe;
  kind: "material-change";
  issue: number;
  state: "proposed";
  firstSeen: string;
  lastSeen: string;
  observations: number;
  latestDigest: string;
}

export interface OutageRecord {
  failures: number;
  signature: FailureSignature;
  lastFailureAt: string;
  nextAttemptAt: string;
}

export interface ModelsDevState {
  version: typeof MODELS_DEV_STATE;
  source: {
    id: string;
    url: string;
    adapter: string;
    schema: string;
  };
  recipe: ModelsDevRecipe;
  lastAttempt: AttemptRecord | null;
  lastSuccess: SuccessRecord | null;
  lastChange: ChangeRecord | null;
  lastMaterialChange: ChangeRecord | null;
  upstream: {
    etag: string | null;
    lastModified: string | null;
    contentHash: string;
    bytes: number;
    providers: number;
    models: number;
  } | null;
  outage: OutageRecord | null;
  incidents: IncidentRecord[];
  actions: ActionRecord[];
  // Recorded so a reader can verify the contract rather than infer it.
  modelCalls: 0;
  issuesWritten: 0;
}

export interface Freshness {
  state: "never-checked" | "fresh" | "stale" | "degraded";
  checkedAt: string | null;
  changedAt: string | null;
  materialChangedAt: string | null;
  ageHours: number | null;
  retained: boolean;
  note: string;
}

export function emptyState(recipe: ModelsDevRecipe): ModelsDevState {
  return {
    version: MODELS_DEV_STATE,
    source: {
      id: MODELS_DEV_SOURCE,
      url: MODELS_DEV_URL,
      adapter: MODELS_DEV_ADAPTER,
      schema: MODELS_DEV_SCHEMA,
    },
    recipe: { id: recipe.id, version: recipe.version },
    lastAttempt: null,
    lastSuccess: null,
    lastChange: null,
    lastMaterialChange: null,
    upstream: null,
    outage: null,
    incidents: [],
    actions: [],
    modelCalls: 0,
    issuesWritten: 0,
  };
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
};

const finite = (value: unknown, max = Number.MAX_SAFE_INTEGER): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
    ? value
    : null;

const bool = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

function normalizeModel(
  raw: Record<string, unknown>,
  id: string,
): ModelsDevModel {
  const status =
    raw.status === "alpha" ||
    raw.status === "beta" ||
    raw.status === "deprecated"
      ? raw.status
      : "stable";
  const cost =
    raw.cost && typeof raw.cost === "object" && !Array.isArray(raw.cost)
      ? {
          input: finite((raw.cost as Record<string, unknown>).input),
          output: finite((raw.cost as Record<string, unknown>).output),
          cacheRead: finite((raw.cost as Record<string, unknown>).cache_read),
        }
      : null;
  const limit =
    raw.limit && typeof raw.limit === "object" && !Array.isArray(raw.limit)
      ? (raw.limit as Record<string, unknown>)
      : null;
  const modalities =
    raw.modalities &&
    typeof raw.modalities === "object" &&
    !Array.isArray(raw.modalities)
      ? (raw.modalities as Record<string, unknown>)
      : null;
  const list = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, 16)
      : [];
  return {
    id,
    name: text(raw.name, 160) ?? id,
    status,
    releaseDate:
      typeof raw.release_date === "string" && datePattern.test(raw.release_date)
        ? raw.release_date
        : null,
    lastUpdated:
      typeof raw.last_updated === "string" && datePattern.test(raw.last_updated)
        ? raw.last_updated
        : null,
    context: limit ? finite(limit.context, 1_000_000_000) : null,
    outputLimit: limit ? finite(limit.output, 1_000_000_000) : null,
    cost,
    toolCall: bool(raw.tool_call),
    reasoning: bool(raw.reasoning),
    attachment: bool(raw.attachment),
    modalities: modalities
      ? { input: list(modalities.input), output: list(modalities.output) }
      : null,
  };
}

export type ValidationResult =
  | { ok: true; snapshot: ModelsDevSnapshot }
  | { ok: false; signature: FailureSignature; detail: string };

/**
 * Validate a candidate payload without touching the retained snapshot. A
 * malformed, partial or oversized catalogue is refused as a whole; this
 * function never accumulates the valid half of a bad response.
 */
export function validateModelsDev(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ok: false, signature: "schema-invalid", detail: "Catalogue root is not an object." };
  const providers: Record<string, ModelsDevProvider> = Object.create(null);
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0)
    return { ok: false, signature: "schema-invalid", detail: "Catalogue has no providers." };
  if (entries.length > MAX_PROVIDERS)
    return {
      ok: false,
      signature: "oversized",
      detail: `Catalogue has ${entries.length} providers, above the ${MAX_PROVIDERS} bound.`,
    };
  let modelCount = 0;
  for (const [providerId, rawProvider] of entries) {
    if (!providerIdPattern.test(providerId))
      return {
        ok: false,
        signature: "schema-invalid",
        detail: `Provider id "${providerId.slice(0, 40)}" is not a stable identifier.`,
      };
    if (!rawProvider || typeof rawProvider !== "object" || Array.isArray(rawProvider))
      return {
        ok: false,
        signature: "schema-invalid",
        detail: `Provider "${providerId}" is not an object.`,
      };
    const provider = rawProvider as Record<string, unknown>;
    const declaredId = text(provider.id, 100);
    if (declaredId !== providerId)
      return {
        ok: false,
        signature: "schema-invalid",
        detail: `Provider "${providerId}" carries a missing or mismatched id.`,
      };
    const name = text(provider.name, 120);
    if (!name)
      return {
        ok: false,
        signature: "schema-invalid",
        detail: `Provider "${providerId}" has no usable name.`,
      };
    if (
      !provider.models ||
      typeof provider.models !== "object" ||
      Array.isArray(provider.models)
    )
      return {
        ok: false,
        signature: "schema-invalid",
        detail: `Provider "${providerId}" has no model catalogue.`,
      };
    const rawModels = Object.entries(provider.models as Record<string, unknown>);
    if (rawModels.length === 0)
      return {
        ok: false,
        signature: "schema-invalid",
        detail: `Provider "${providerId}" has an empty model catalogue.`,
      };
    if (rawModels.length > MAX_MODELS_PER_PROVIDER)
      return {
        ok: false,
        signature: "oversized",
        detail: `Provider "${providerId}" has ${rawModels.length} models, above the ${MAX_MODELS_PER_PROVIDER} bound.`,
      };
    const models: Record<string, ModelsDevModel> = Object.create(null);
    for (const [modelId, rawModel] of rawModels) {
      if (!modelIdPattern.test(modelId))
        return {
          ok: false,
          signature: "schema-invalid",
          detail: `Model id "${modelId.slice(0, 40)}" in "${providerId}" is not a stable identifier.`,
        };
      if (!rawModel || typeof rawModel !== "object" || Array.isArray(rawModel))
        return {
          ok: false,
          signature: "schema-invalid",
          detail: `Model "${providerId}/${modelId}" is not an object.`,
        };
      const model = rawModel as Record<string, unknown>;
      if (text(model.id, 100) !== modelId)
        return {
          ok: false,
          signature: "schema-invalid",
          detail: `Model "${providerId}/${modelId}" carries a missing or mismatched id.`,
        };
      if (!text(model.name, 160))
        return {
          ok: false,
          signature: "schema-invalid",
          detail: `Model "${providerId}/${modelId}" has no usable name.`,
        };
      models[modelId] = normalizeModel(model, modelId);
      modelCount++;
    }
    providers[providerId] = { id: providerId, name, models };
  }
  return {
    ok: true,
    snapshot: {
      version: MODELS_DEV_SCHEMA,
      adapter: MODELS_DEV_ADAPTER,
      providers,
      providerCount: entries.length,
      modelCount,
    },
  };
}

export interface ChangeReport {
  addedProviders: string[];
  removedProviders: string[];
  addedModels: FieldChange[];
  removedModels: FieldChange[];
  material: FieldChange[];
  cosmetic: FieldChange[];
  counts: ChangeRecord["counts"];
}

const MATERIAL_FIELDS = [
  "status",
  "context",
  "outputLimit",
  "cost",
  "toolCall",
  "reasoning",
  "attachment",
  "modalities",
] as const;
const COSMETIC_FIELDS = ["name", "releaseDate", "lastUpdated"] as const;

const equal = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Compare two validated snapshots. An added model is informational: it never
 * produces an owner action. A removal, deprecation or changed price/limit/
 * capability is material, and is reported as a candidate to investigate — not
 * as permission to delete history or to keep recommending an unavailable model.
 */
export function classifyChanges(
  previous: ModelsDevSnapshot | null,
  next: ModelsDevSnapshot,
): ChangeReport {
  const addedProviders: string[] = [];
  const removedProviders: string[] = [];
  const addedModels: FieldChange[] = [];
  const removedModels: FieldChange[] = [];
  const material: FieldChange[] = [];
  const cosmetic: FieldChange[] = [];
  let addedModelCount = 0;
  const before = previous?.providers ?? {};
  for (const providerId of Object.keys(before))
    if (!next.providers[providerId])
      removedProviders.push(providerId);
  for (const [providerId, provider] of Object.entries(next.providers)) {
    const prior = before[providerId];
    if (!prior) {
      addedProviders.push(providerId);
      addedModelCount += Object.keys(provider.models).length;
      continue;
    }
    for (const [modelId, model] of Object.entries(provider.models)) {
      const old = prior?.models[modelId];
      if (!old) {
        addedModels.push({ provider: providerId, model: modelId, fields: [] });
        addedModelCount++;
        continue;
      }
      const changedMaterial = MATERIAL_FIELDS.filter(
        (field) => !equal(old[field], model[field]),
      );
      const changedCosmetic = COSMETIC_FIELDS.filter(
        (field) => !equal(old[field], model[field]),
      );
      if (changedMaterial.length)
        material.push({ provider: providerId, model: modelId, fields: [...changedMaterial] });
      if (changedCosmetic.length)
        cosmetic.push({ provider: providerId, model: modelId, fields: [...changedCosmetic] });
    }
    for (const modelId of Object.keys(prior?.models ?? {}))
      if (!provider.models[modelId])
        removedModels.push({ provider: providerId, model: modelId, fields: ["removed"] });
  }
  // A removed provider is one material retirement, represented by one entry so
  // its per-model removals do not flood the retained change record.
  return {
    addedProviders,
    removedProviders,
    addedModels: addedModels.slice(0, MAX_CHANGE_SAMPLES),
    removedModels: removedModels.slice(0, MAX_CHANGE_SAMPLES),
    material: [
      ...removedProviders.map((provider) => ({
        provider,
        model: "*",
        fields: ["provider-removed"],
      })),
      ...removedModels,
      ...material,
    ].slice(0, MAX_CHANGE_SAMPLES),
    cosmetic: cosmetic.slice(0, MAX_CHANGE_SAMPLES),
    counts: {
      addedProviders: addedProviders.length,
      removedProviders: removedProviders.length,
      addedModels: addedModelCount,
      removedModels: removedModels.length,
      material: removedProviders.length + removedModels.length + material.length,
      cosmetic: cosmetic.length,
    },
  };
}

export function changeIsMaterial(report: ChangeReport): boolean {
  return report.counts.material > 0;
}

export function hasContentChange(report: ChangeReport): boolean {
  return (
    report.counts.addedProviders > 0 ||
    report.counts.removedProviders > 0 ||
    report.counts.addedModels > 0 ||
    report.counts.removedModels > 0 ||
    report.counts.material > 0 ||
    report.counts.cosmetic > 0
  );
}

export function freshness(state: ModelsDevState, now = Date.now()): Freshness {
  const checked = state.lastSuccess?.at ?? null;
  const changed = state.lastChange?.at ?? null;
  const material = state.lastMaterialChange?.at ?? null;
  const retained = Boolean(changed || checked);
  const ageMs = checked ? now - Date.parse(checked) : null;
  const ageHours = ageMs === null ? null : Math.round(ageMs / 360000) / 10;
  if (!state.lastAttempt && !checked) {
    return {
      state: "never-checked",
      checkedAt: null,
      changedAt: changed,
      materialChangedAt: material,
      ageHours: null,
      retained: false,
      note: "This source has never been checked. Never checked is not fresh, healthy or empty.",
    };
  }
  const failed = state.lastAttempt
    ? !["changed", "unchanged", "deferred"].includes(state.lastAttempt.outcome)
    : false;
  if (failed) {
    return {
      state: "degraded",
      checkedAt: checked,
      changedAt: changed,
      materialChangedAt: material,
      ageHours,
      retained,
      note: retained
        ? `The latest attempt failed (${state.lastAttempt?.outcome}). The retained catalogue is last-known-good, not current.`
        : "The latest attempt failed and no validated catalogue is retained.",
    };
  }
  if (!checked) {
    return {
      state: "never-checked",
      checkedAt: null,
      changedAt: changed,
      materialChangedAt: material,
      ageHours: null,
      retained: false,
      note: "No successful check is recorded. A deferred run is not a successful check.",
    };
  }
  if (ageMs !== null && ageMs > FRESH_FOR_MS) {
    return {
      state: "stale",
      checkedAt: checked,
      changedAt: changed,
      materialChangedAt: material,
      ageHours,
      retained,
      note: `The last successful check is older than ${FRESH_FOR_MS / 3600000} hours. The retained catalogue may be out of date.`,
    };
  }
  return {
    state: "fresh",
    checkedAt: checked,
    changedAt: changed,
    materialChangedAt: material,
    ageHours,
    retained,
    note:
      changed === null
        ? "The source was checked and no content change was recorded."
        : `The source was checked; the last recorded content change was ${changed}.`,
  };
}

export function incidentFingerprint(
  source: string,
  integration: string,
  recipe: ModelsDevRecipe,
  signature: FailureSignature,
): string {
  return `${source}|${integration}|${recipe.id}@${recipe.version}|${signature}`;
}

// A stable, readable fingerprint. It is not a security boundary; the caller's
// issue mapping uses it only to avoid duplicate records for one failure class.
export function digest(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

export function actionFingerprint(
  source: string,
  integration: string,
  recipe: ModelsDevRecipe,
): string {
  return digest(`${source}|${integration}|${recipe.id}@${recipe.version}|material-change`);
}

const atIso = (at: number) => new Date(at).toISOString();

function backoffFor(failures: number, retryAfterMs: number | null): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, failures - 1), MAX_BACKOFF_MS);
  if (retryAfterMs === null) return exponential;
  return Math.min(Math.max(retryAfterMs, 60000), MAX_BACKOFF_MS);
}

export function retryAfterMs(response: Response, now: number): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.min(Math.max(at - now, 0), MAX_BACKOFF_MS) : null;
}

export interface FetchedBody {
  status: number;
  etag: string | null;
  lastModified: string | null;
  bytes: Uint8Array;
  retryAfter: number | null;
}

/** Read a response body with a hard byte cap. A truncated read is refused. */
export async function boundedBody(response: Response): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_RESPONSE_BYTES)
    throw new BoundedReadError("oversized", "Response declares more than 16 MiB.");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let complete = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      length += value.byteLength;
      if (length > MAX_RESPONSE_BYTES)
        throw new BoundedReadError("oversized", "Response exceeded 16 MiB.");
      chunks.push(value);
    }
  } finally {
    if (!complete) void reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export class BoundedReadError extends Error {
  signature: FailureSignature;
  constructor(signature: FailureSignature, message: string) {
    super(message);
    this.name = "BoundedReadError";
    this.signature = signature;
  }
}

export async function digestBytes(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export interface RefreshOptions {
  state: ModelsDevState;
  // The retained validated catalogue, when the caller has one. It is kept
  // outside the compact state record and is required for a real diff.
  previous?: ModelsDevSnapshot | null;
  fetcher?: typeof fetch;
  now?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  attempts?: number;
  url?: string;
}

export interface RefreshResult {
  state: ModelsDevState;
  snapshot: ModelsDevSnapshot | null;
  outcome: AttemptOutcome;
  fetched: boolean;
  changes: ChangeReport | null;
  freshness: Freshness;
  detail: string | null;
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function failureSignatureOf(error: unknown): FailureSignature {
  if (error instanceof BoundedReadError) return error.signature;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    return "timeout";
  return "network";
}

function recordFailure(
  state: ModelsDevState,
  at: number,
  signature: FailureSignature,
  detail: string,
  retryAfter: number | null,
): ModelsDevState {
  const fingerprint = incidentFingerprint(
    MODELS_DEV_SOURCE,
    MODELS_DEV_INTEGRATION,
    state.recipe,
    signature,
  );
  const incidents = [...state.incidents];
  const existing = incidents.findIndex((incident) => incident.fingerprint === fingerprint);
  if (existing >= 0) {
    const prior = incidents[existing]!;
    incidents[existing] = {
      ...prior,
      state: "open",
      lastSeen: atIso(at),
      occurrences: prior.occurrences + 1,
      detail: detail.slice(0, 300),
      resolution: null,
    };
  } else {
    incidents.unshift({
      fingerprint,
      source: MODELS_DEV_SOURCE,
      integration: MODELS_DEV_INTEGRATION,
      recipe: state.recipe,
      signature,
      state: "open",
      firstSeen: atIso(at),
      lastSeen: atIso(at),
      occurrences: 1,
      detail: detail.slice(0, 300),
      resolution: null,
    });
  }
  incidents.sort((left, right) => right.lastSeen.localeCompare(left.lastSeen));
  const failures = (state.outage?.failures ?? 0) + 1;
  return {
    ...state,
    incidents: incidents.slice(0, MAX_INCIDENTS),
    outage: {
      failures,
      signature,
      lastFailureAt: atIso(at),
      nextAttemptAt: atIso(at + backoffFor(failures, retryAfter)),
    },
  };
}

function recordSuccess(
  state: ModelsDevState,
  at: number,
  success: SuccessRecord,
): ModelsDevState {
  return {
    ...state,
    lastSuccess: success,
    upstream: {
      etag: success.etag,
      lastModified: success.lastModified,
      contentHash: success.contentHash,
      bytes: success.bytes,
      providers: success.providers,
      models: success.models,
    },
    outage: null,
    incidents: state.incidents.map((incident) =>
      incident.state === "open" &&
      incident.source === MODELS_DEV_SOURCE &&
      incident.integration === MODELS_DEV_INTEGRATION &&
      incident.recipe.id === state.recipe.id &&
      incident.recipe.version === state.recipe.version
        ? {
            ...incident,
            state: "recovered" as const,
            resolution: {
              at: atIso(at),
              requirement: "fetch-and-validate" as const,
              check: "models.dev returned a validated catalogue",
            },
          }
        : incident,
    ),
  };
}

function proposeAction(state: ModelsDevState, at: number, report: ChangeReport): ModelsDevState {
  if (!changeIsMaterial(report)) return state;
  const fingerprint = actionFingerprint(
    MODELS_DEV_SOURCE,
    MODELS_DEV_INTEGRATION,
    state.recipe,
  );
  const digestValue = digest(JSON.stringify(report));
  const actions = [...state.actions];
  const existing = actions.findIndex((action) => action.fingerprint === fingerprint);
  if (existing >= 0) {
    const prior = actions[existing]!;
    actions[existing] = {
      ...prior,
      lastSeen: atIso(at),
      observations: prior.observations + 1,
      latestDigest: digestValue,
    };
  } else {
    actions.unshift({
      fingerprint,
      source: MODELS_DEV_SOURCE,
      integration: MODELS_DEV_INTEGRATION,
      recipe: state.recipe,
      kind: "material-change",
      issue: 19,
      state: "proposed",
      firstSeen: atIso(at),
      lastSeen: atIso(at),
      observations: 1,
      latestDigest: digestValue,
    });
  }
  return { ...state, actions: actions.slice(0, MAX_ACTIONS) };
}

/**
 * One bounded conditional read. When the retained outage backoff is still
 * active no request is made, so repeated failures cannot spam the source or the
 * issue ledger. A 304 or an identical content hash is `unchanged`: it advances
 * checked-at only and writes no incident or action.
 */
export async function refreshModelsDev(
  options: RefreshOptions,
): Promise<RefreshResult> {
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = Math.max(1, Math.min(options.attempts ?? MAX_ATTEMPTS, MAX_ATTEMPTS));
  const url = options.url ?? MODELS_DEV_URL;
  const state = options.state;
  if (state.outage && Date.parse(state.outage.nextAttemptAt) > now) {
    const deferred: ModelsDevState = {
      ...state,
      lastAttempt: {
        at: atIso(now),
        outcome: "deferred",
        status: null,
        durationMs: 0,
        bytes: 0,
        attempts: 0,
        detail: `Backoff until ${state.outage.nextAttemptAt} after ${state.outage.failures} consecutive failure(s).`,
      },
    };
    return {
      state: deferred,
      snapshot: null,
      outcome: "deferred",
      fetched: false,
      changes: null,
      freshness: freshness({ ...state, lastAttempt: deferred.lastAttempt }, now),
      detail: deferred.lastAttempt!.detail,
    };
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "app-composer-models-intelligence/1 (+https://composer.loftwah.com)",
  };
  if (state.upstream?.etag) headers["If-None-Match"] = state.upstream.etag;
  if (state.upstream?.lastModified) headers["If-Modified-Since"] = state.upstream.lastModified;
  const startedAt = Date.now();
  let attempts = 0;
  let lastError: { signature: FailureSignature; detail: string; retryAfter: number | null } | null =
    null;
  for (; attempts < maxAttempts; attempts++) {
    try {
      const response = await fetcher(url, {
        method: "GET",
        redirect: "error",
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 304) {
        const at = now;
        const success: SuccessRecord = {
          at: atIso(at),
          status: 304,
          etag: state.upstream?.etag ?? null,
          lastModified: state.upstream?.lastModified ?? null,
          contentHash: state.upstream?.contentHash ?? "",
          bytes: 0,
          providers: state.upstream?.providers ?? 0,
          models: state.upstream?.models ?? 0,
        };
        const next = recordSuccess(
          {
            ...state,
            lastAttempt: {
              at: atIso(at),
              outcome: "unchanged",
              status: 304,
              durationMs: Date.now() - startedAt,
              bytes: 0,
              attempts: attempts + 1,
              detail: null,
            },
          },
          at,
          success,
        );
        return {
          state: next,
          snapshot: null,
          outcome: "unchanged",
          fetched: true,
          changes: null,
          freshness: freshness(next, at),
          detail: "Not modified. Checked-at advanced; changed-at and the recipe revision did not.",
        };
      }
      if (response.status === 429) {
        lastError = {
          signature: "http-429",
          detail: "Upstream rate limited the conditional read.",
          retryAfter: retryAfterMs(response, now),
        };
        break;
      }
      if (!response.ok) {
        lastError = {
          signature: response.status >= 500 ? "http-server-error" : "http-client-error",
          detail: `Upstream answered HTTP ${response.status}.`,
          retryAfter: retryAfterMs(response, now),
        };
        if (response.status >= 500 && attempts + 1 < maxAttempts) {
          await sleep(Math.min(250 * 2 ** attempts, 2000));
          continue;
        }
        break;
      }
      const bytes = await boundedBody(response);
      const contentHash = await digestBytes(bytes);
      const at = now;
      if (state.upstream?.contentHash === contentHash) {
        const success: SuccessRecord = {
          at: atIso(at),
          status: 200,
          etag: response.headers.get("etag") ?? state.upstream.etag,
          lastModified: response.headers.get("last-modified") ?? state.upstream.lastModified,
          contentHash,
          bytes: bytes.byteLength,
          providers: state.upstream.providers,
          models: state.upstream.models,
        };
        const next = recordSuccess(
          {
            ...state,
            lastAttempt: {
              at: atIso(at),
              outcome: "unchanged",
              status: 200,
              durationMs: Date.now() - startedAt,
              bytes: bytes.byteLength,
              attempts: attempts + 1,
              detail: null,
            },
          },
          at,
          success,
        );
        return {
          state: next,
          snapshot: null,
          outcome: "unchanged",
          fetched: true,
          changes: null,
          freshness: freshness(next, at),
          detail: "The content hash is unchanged. No incident or action was written.",
        };
      }
      let payload: unknown;
      try {
        payload = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        lastError = {
          signature: "schema-invalid",
          detail: "Response is not valid JSON.",
          retryAfter: null,
        };
        break;
      }
      const validation = validateModelsDev(payload);
      if (!validation.ok) {
        lastError = {
          signature: validation.signature,
          detail: validation.detail,
          retryAfter: null,
        };
        break;
      }
      const report = classifyChanges(options.previous ?? null, validation.snapshot);
      const changed = hasContentChange(report);
      const success: SuccessRecord = {
        at: atIso(at),
        status: 200,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        contentHash,
        bytes: bytes.byteLength,
        providers: validation.snapshot.providerCount,
        models: validation.snapshot.modelCount,
      };
      let next = recordSuccess(state, at, success);
      next = {
        ...next,
        lastAttempt: {
          at: atIso(at),
          outcome: "changed",
          status: 200,
          durationMs: Date.now() - startedAt,
          bytes: bytes.byteLength,
          attempts: attempts + 1,
          detail: changed
            ? `Validated ${validation.snapshot.providerCount} providers and ${validation.snapshot.modelCount} models.`
            : "Validated content. Only the retained snapshot's provider order or metadata changed.",
        },
      };
      const change: ChangeRecord = {
        at: atIso(at),
        fromHash: state.upstream?.contentHash ?? "",
        toHash: contentHash,
        addedProviders: report.addedProviders.slice(0, MAX_CHANGE_SAMPLES),
        removedProviders: report.removedProviders.slice(0, MAX_CHANGE_SAMPLES),
        addedModels: report.addedModels,
        removedModels: report.removedModels,
        material: report.material,
        cosmetic: report.cosmetic,
        counts: report.counts,
      };
      next = { ...next, lastChange: change };
      if (changeIsMaterial(report)) next = { ...next, lastMaterialChange: change };
      next = proposeAction(next, at, report);
      return {
        state: next,
        snapshot: validation.snapshot,
        outcome: "changed",
        fetched: true,
        changes: report,
        freshness: freshness(next, at),
        detail: changed
          ? `Added ${report.counts.addedModels} model(s); ${report.counts.material} material change(s).`
          : "A validated catalogue was fetched.",
      };
    } catch (error) {
      const signature = failureSignatureOf(error);
      lastError = {
        signature,
        detail: error instanceof Error ? error.message.slice(0, 200) : "Request failed.",
        retryAfter: null,
      };
      if ((signature === "timeout" || signature === "network") && attempts + 1 < maxAttempts) {
        await sleep(Math.min(250 * 2 ** attempts, 2000));
        continue;
      }
      break;
    }
  }
  const at = now;
  const signature = lastError?.signature ?? "network";
  const detail = lastError?.detail ?? "Conditional read failed.";
  let next = recordFailure(state, at, signature, detail, lastError?.retryAfter ?? null);
  next = {
    ...next,
    lastAttempt: {
      at: atIso(at),
      outcome: signature,
      status: null,
      durationMs: Date.now() - startedAt,
      bytes: 0,
      attempts: attempts || 1,
      detail,
    },
  };
  return {
    state: next,
    snapshot: null,
    outcome: signature,
    fetched: true,
    changes: null,
    freshness: freshness(next, at),
    detail,
  };
}

// Persistence contract: the compact state record and the validated catalogue
// are written together and read together. The state never pretends the
// catalogue is embedded; an unreadable or mismatched store fails closed.
export function parseState(value: unknown): ModelsDevState {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Models.dev state is not an object.");
  const state = value as Partial<ModelsDevState>;
  if (state.version !== MODELS_DEV_STATE)
    throw new Error(`Unsupported models.dev state version: ${String(state.version)}`);
  if (!state.recipe || typeof state.recipe.id !== "string" || !Number.isInteger(state.recipe.version))
    throw new Error("Models.dev state has no recipe revision.");
  if (!Array.isArray(state.incidents) || !Array.isArray(state.actions))
    throw new Error("Models.dev state has no incident ledger.");
  return {
    ...emptyState(state.recipe),
    ...state,
    recipe: { id: state.recipe.id, version: state.recipe.version },
    modelCalls: 0,
    issuesWritten: 0,
  };
}

export function parseSnapshot(value: unknown): ModelsDevSnapshot {
  const result = validateModelsDev(rawCatalogue(value));
  if (!result.ok) throw new Error(`Retained models.dev catalogue is invalid: ${result.detail}`);
  return result.snapshot;
}

// Rebuild a raw-shaped catalogue from the normalized retained snapshot so the
// same validator guards both a fresh response and a stored last-known-good.
function rawCatalogue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Retained catalogue is not an object.");
  const snapshot = value as Partial<ModelsDevSnapshot>;
  if (snapshot.version !== MODELS_DEV_SCHEMA)
    throw new Error(`Unsupported models.dev snapshot version: ${String(snapshot.version)}`);
  if (!snapshot.providers || typeof snapshot.providers !== "object")
    throw new Error("Retained catalogue has no providers.");
  return Object.fromEntries(
    Object.entries(snapshot.providers).map(([id, provider]) => [
      id,
      {
        id: provider.id,
        name: provider.name,
        models: Object.fromEntries(
          Object.entries(provider.models ?? {}).map(([modelId, model]) => [
            modelId,
            {
              id: model.id,
              name: model.name,
              status: model.status,
              release_date: model.releaseDate,
              last_updated: model.lastUpdated,
              limit: { context: model.context, output: model.outputLimit },
              cost: model.cost
                ? {
                    input: model.cost.input,
                    output: model.cost.output,
                    cache_read: model.cost.cacheRead,
                  }
                : null,
              tool_call: model.toolCall,
              reasoning: model.reasoning,
              attachment: model.attachment,
              modalities: model.modalities,
            },
          ]),
        ),
      },
    ]),
  );
}

export interface ModelsDevSummary {
  version: typeof MODELS_DEV_SUMMARY;
  source: ModelsDevState["source"];
  recipe: ModelsDevRecipe;
  freshness: Freshness;
  upstream: ModelsDevState["upstream"];
  lastAttempt: AttemptRecord | null;
  lastChange: ChangeRecord | null;
  lastMaterialChange: ChangeRecord | null;
  selected: Array<{
    id: string;
    name: string;
    modelCount: number;
    atLimit: boolean;
    models: Array<
      Pick<
        ModelsDevModel,
        | "id"
        | "name"
        | "status"
        | "releaseDate"
        | "context"
        | "outputLimit"
        | "cost"
        | "toolCall"
        | "reasoning"
      >
    >;
  }>;
  incidents: {
    open: number;
    recovered: number;
    latest: IncidentRecord[];
  };
  actions: ActionRecord[];
  modelCalls: 0;
  issuesWritten: 0;
  note: string;
}

/**
 * The independently consumable contract. It exposes only selected providers
 * and bounded fields, keeps freshness explicit and never turns a missing
 * provider into a supported one.
 */
export function modelsDevSummary(
  state: ModelsDevState,
  snapshot: ModelsDevSnapshot | null,
  selectedProviders: readonly string[],
  now = Date.now(),
): ModelsDevSummary {
  const selected = [...new Set(selectedProviders)].map((id) => {
    const provider = snapshot?.providers[id];
    const models = provider ? Object.values(provider.models) : [];
    const ordered = [...models].sort((left, right) => left.id.localeCompare(right.id));
    return {
      id,
      name: provider?.name ?? "",
      modelCount: models.length,
      atLimit: models.length > MAX_SELECTED_MODELS,
      models: ordered.slice(0, MAX_SELECTED_MODELS).map((model) => ({
        id: model.id,
        name: model.name,
        status: model.status,
        releaseDate: model.releaseDate,
        context: model.context,
        outputLimit: model.outputLimit,
        cost: model.cost,
        toolCall: model.toolCall,
        reasoning: model.reasoning,
      })),
    };
  });
  return {
    version: MODELS_DEV_SUMMARY,
    source: state.source,
    recipe: state.recipe,
    freshness: freshness(state, now),
    upstream: state.upstream,
    lastAttempt: state.lastAttempt,
    lastChange: state.lastChange,
    lastMaterialChange: state.lastMaterialChange,
    selected,
    incidents: {
      open: state.incidents.filter((incident) => incident.state === "open").length,
      recovered: state.incidents.filter((incident) => incident.state === "recovered").length,
      latest: state.incidents.slice(0, 5),
    },
    actions: state.actions,
    modelCalls: 0,
    issuesWritten: 0,
    note: "Upstream catalogue metadata only. A listed model or provider is not a supported Composer recipe, tested credential, account entitlement or readiness claim. Freshness is checked-at, not changed-at.",
  };
}

// MIT. The Benchmarks Studio media comparison: one matched pair of saved outputs.
//
// This module is the single place that knows which saved Studio output belongs
// to which blind side. The page may show a clip, its latency, its recorded cost
// estimate and its observed failures before a vote, but it must not name the
// model, provider, configuration or trial behind either side. The preview route
// resolves the opaque pair/side address on the server; the browser never gets a
// path that names a model.
//
// Pair order and side assignment are derived exactly as the text comparison
// derives them (same hash, same run id), so /api/benchmark-votes can resolve a
// media vote with the existing table and contract. A test asserts the two pair
// implementations agree.
export const MEDIA_RECORD_SCHEMA = "benchmark-media/v1";
export const MEDIA_TASK_SCHEMA = "benchmark-media-task/v1";
export const MEDIA_CONFIG_SCHEMA = "benchmark-media-configurations/v1";
export const MEDIA_INVENTORY = "studio-media";
export const MEDIA_PREVIEW_ROOT = "/benchmarks/media/preview";
export const MEDIA_ASSET_ROOT = "/benchmarks/media";
export const MEDIA_ASSET_NAMES = ["clip.mp4", "poster.jpg"];
export const MEDIA_COST_LABEL =
  "Studio estimate written on the saved job row. It is not a provider invoice, and no provider charge is claimed when the row records none.";
export const MEDIA_LATENCY_LABEL =
  "Saved-job latency: the gap between the Studio row's created_at and completed_at. It is queue plus provider time, not the clip's own duration.";

const PRIVATE_KEYS = new Set([
  "project_id",
  "projectId",
  "composition_id",
  "compositionId",
  "client_request_id",
  "clientRequestId",
  "provider_request_id",
  "providerRequestId",
  "retained_key",
  "retainedKey",
  "output_asset_id",
  "outputAssetId",
  "generation_id",
  "generationId",
  "asset_id",
  "assetId",
  "request_json",
  "requestJson",
  "provider_status_url",
  "providerStatusUrl",
  "provider_response_url",
  "providerResponseUrl",
  "error_detail",
  "errorDetail",
]);

const PRIVATE_VALUE_PATTERNS = [
  /\b(?:gen|prj|asset)_[0-9a-f]{8,}\b/i,
  /\/projects\//i,
  /retained\.(?:mp4|json|png|jpg|webp)/i,
];

const GENERIC = new Set(["unknown", "unrecorded", "not reported", "n/a", "none", "media-studio"]);

/** @param {unknown} value */
function text(value) {
  return typeof value === "string" ? value : "";
}

/** @param {unknown} value */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/** @param {unknown} value */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** @param {string} value */
function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Deterministic non-cryptographic order key. It hides order, not secrets. */
function orderHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sourceShort(value) {
  const source = text(value);
  return /^[0-9a-f]{7,40}$/i.test(source) ? source.slice(0, 7) : "unrecorded";
}

/** Stable key order, so the source digest does not change with formatting. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The run id shape is shared with the text comparison: task-v<version>-<source>. */
export function mediaRunIdFor(record) {
  const task = asRecord(record?.task);
  const taskId = slug(text(task.id) || "unknown") || "unknown";
  const version = Number.isInteger(task.version) ? String(task.version) : "unknown";
  return `${taskId}-v${version}-${sourceShort(record?.sourceVersion)}`;
}

export function configurationsOfMedia(record) {
  return asArray(record?.configurations).map((entry) => {
    const configuration = asRecord(entry);
    return {
      ...configuration,
      id: text(configuration.id) || "unknown",
      label: text(configuration.label) || text(configuration.id) || "unknown",
      model: text(configuration.model) || text(configuration.resolvedModel) || "unknown",
      resolvedModel: text(configuration.resolvedModel) || "unknown",
      provider: text(configuration.provider) || "unknown",
      harness: text(configuration.harness) || "unknown",
      harnessVersion: text(configuration.harnessVersion) || "unknown",
      inventoryEntry: text(configuration.inventoryEntry) || null,
      settings: asRecord(configuration.settings),
      trials: asArray(configuration.trials).map(normaliseTrial),
    };
  });
}

function normaliseTrial(raw) {
  const trial = asRecord(raw);
  return {
    ...trial,
    id: text(trial.id) || "unknown",
    index: Number.isInteger(trial.index) ? Number(trial.index) : 0,
    status: text(trial.status) || "unknown",
    createdAt: text(trial.createdAt) || null,
    completedAt: text(trial.completedAt) || null,
    durationMs: numberOrNull(trial.durationMs),
    artifact: trial.artifact ? normaliseArtifact(trial.artifact) : null,
    poster: trial.poster ? normaliseArtifact(trial.poster) : null,
    cost: trial.cost ? normaliseCost(trial.cost) : null,
    checks: asArray(trial.checks).map((check) => {
      const row = asRecord(check);
      return {
        id: text(row.id) || "unknown",
        name: text(row.name) || "unknown",
        kind: text(row.kind) || "unknown",
        status: text(row.status) || "unknown",
        detail: text(row.detail) || "not recorded",
      };
    }),
    failed: asArray(trial.failed).map((id) => text(id)).filter(Boolean),
  };
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseArtifact(raw) {
  const artifact = asRecord(raw);
  return {
    ...artifact,
    path: text(artifact.path),
    mime: text(artifact.mime),
    bytes: numberOrNull(artifact.bytes),
    width: numberOrNull(artifact.width),
    height: numberOrNull(artifact.height),
    durationMs: numberOrNull(artifact.durationMs),
    sha256: text(artifact.sha256),
    videoCodec: text(artifact.videoCodec) || null,
    frameRate: text(artifact.frameRate) || null,
    audio: artifact.audio ? asRecord(artifact.audio) : null,
  };
}

function normaliseCost(raw) {
  const cost = asRecord(raw);
  return {
    estimateMicro: numberOrNull(cost.estimateMicro),
    providerChargedMicro: numberOrNull(cost.providerChargedMicro),
    basis: text(cost.basis) || MEDIA_COST_LABEL,
  };
}

/**
 * The same pairing rule the text comparison uses: every configuration against
 * every other at the same trial index, ordered and side-swapped by a hash of the
 * run and trial ids. With one trial each there is one pair.
 */
export function mediaPairs(record) {
  const runId = mediaRunIdFor(record);
  const configurations = configurationsOfMedia(record).filter(
    (configuration) => configuration.trials.length > 0,
  );
  const candidates = [];
  for (let left = 0; left < configurations.length; left += 1) {
    for (let right = left + 1; right < configurations.length; right += 1) {
      const first = configurations[left];
      const second = configurations[right];
      const count = Math.min(first.trials.length, second.trials.length);
      for (let index = 0; index < count; index += 1) {
        const trialA = trialWithConfiguration(first, first.trials[index]);
        const trialB = trialWithConfiguration(second, second.trials[index]);
        if (trialA && trialB) candidates.push({ trialA, trialB });
      }
    }
  }
  const ordered = candidates
    .map((candidate) => ({
      ...candidate,
      orderKey: orderHash(`${runId}|${candidate.trialA.id}|${candidate.trialB.id}|order`),
    }))
    .sort((left, right) => left.orderKey.localeCompare(right.orderKey));
  return ordered.map((candidate, index) => {
    const swap =
      Number.parseInt(
        orderHash(`${runId}|${candidate.trialA.id}|${candidate.trialB.id}|side`),
        16,
      ) %
        2 ===
      1;
    return {
      id: `p${String(index + 1).padStart(2, "0")}`,
      ordinal: index + 1,
      trialA: swap ? candidate.trialB : candidate.trialA,
      trialB: swap ? candidate.trialA : candidate.trialB,
      orderKey: candidate.orderKey,
    };
  });
}

function trialWithConfiguration(configuration, trial) {
  if (!trial || !trial.id || trial.id === "unknown") return null;
  return { ...trial, configuration };
}

export function mediaPair(record, pairId) {
  return mediaPairs(record).find((pair) => pair.id === pairId) ?? null;
}

/** The opaque URL a browser may fetch before a vote. */
export function mediaPreviewPath(runId, pairId, side, asset) {
  return `${MEDIA_PREVIEW_ROOT}/${encodeURIComponent(runId)}/${pairId}/${side}/${asset}`;
}

/**
 * Resolve one opaque media address to a committed artifact. Only the three
 * allowlisted names are accepted, and only a saved trial's own artifact is
 * returned. A failed or missing artifact resolves to null.
 */
export function mediaSideAsset(record, pairId, side, asset) {
  if (side !== "a" && side !== "b") return null;
  if (!MEDIA_ASSET_NAMES.includes(asset)) return null;
  const pair = mediaPair(record, pairId);
  if (!pair) return null;
  const trial = side === "a" ? pair.trialA : pair.trialB;
  if (!trial || trial.status !== "saved") return null;
  const source = asset === "clip.mp4" ? trial.artifact : trial.poster;
  if (!source || !source.path) return null;
  if (!assetPathAllowed(source.path, pair.id, side)) return null;
  if (source.mime !== (asset === "clip.mp4" ? "video/mp4" : "image/jpeg")) return null;
  if (!Number.isFinite(source.bytes) || source.bytes <= 0) return null;
  return {
    publicPath: `${MEDIA_ASSET_ROOT}/${source.path}`,
    mime: source.mime,
    bytes: source.bytes,
    sha256: source.sha256,
    name: asset,
  };
}

function assetPathAllowed(path, pairId, side) {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) return false;
  return new RegExp(`^[a-z0-9-]+/${pairId}/${side}/(clip\\.mp4|poster\\.jpg)$`).test(path);
}

/**
 * The response plan for one media address. It trusts the committed byte count,
 * not the asset host: a 200 with a different length and a 206 whose total does
 * not match the record are refused. The content type is always the allowlisted
 * type for the requested file, so an HTML or SVG body can never be served as a
 * preview even if an asset changed on disk.
 */
export function mediaResponsePlan(asset, sourceStatus, sourceHeaders, method = "GET") {
  const headers = new Headers({
    "Content-Type": asset.mime,
    "Cache-Control": "public, max-age=86400",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  for (const name of ["etag", "last-modified"]) {
    const value = sourceHeaders?.get?.(name);
    if (value) headers.set(name, value);
  }
  const total = asset.bytes;
  if (sourceStatus === 304) {
    headers.delete("Content-Length");
    return { ok: true, status: 304, headers, body: null };
  }
  if (sourceStatus === 416) {
    const contentRange = sourceHeaders?.get?.("content-range") ?? `bytes */${total}`;
    if (contentRange !== `bytes */${total}`) return { ok: false, status: 502 };
    headers.set("Content-Range", contentRange);
    return { ok: true, status: 416, headers, body: null };
  }
  if (sourceStatus === 206) {
    const contentRange = sourceHeaders?.get?.("content-range") ?? "";
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
    if (
      !match ||
      Number(match[3]) !== total ||
      Number(match[1]) > Number(match[2]) ||
      Number(match[2]) >= total
    ) {
      return { ok: false, status: 502 };
    }
    headers.set("Content-Range", contentRange);
    headers.set("Content-Length", String(Number(match[2]) - Number(match[1]) + 1));
    return { ok: true, status: 206, headers, body: "stream" };
  }
  if (sourceStatus !== 200) {
    return { ok: false, status: sourceStatus === 404 ? 404 : 502 };
  }
  const sourceLength = sourceHeaders?.get?.("content-length");
  if (
    sourceLength !== null &&
    sourceLength !== undefined &&
    Number(sourceLength) !== total
  ) {
    return { ok: false, status: 502 };
  }
  headers.set("Content-Length", String(total));
  if (method === "HEAD") return { ok: true, status: 200, headers, body: null };
  return { ok: true, status: 200, headers, body: "stream" };
}

function sideView(record, pairId, trial, key) {
  const runId = mediaRunIdFor(record);
  const playable = Boolean(trial && trial.status === "saved" && trial.artifact);
  return {
    key,
    title: key === "a" ? "Take A" : "Take B",
    playable,
    status: trial?.status ?? "missing",
    clip: playable ? mediaPreviewPath(runId, pairId, key, "clip.mp4") : null,
    poster: playable ? mediaPreviewPath(runId, pairId, key, "poster.jpg") : null,
    mime: trial?.artifact?.mime ?? null,
    clipDurationMs: trial?.artifact?.durationMs ?? null,
    latencyMs: trial?.durationMs ?? null,
    cost: trial?.cost ?? null,
    checks: trial?.checks ?? [],
    failed: trial?.failed ?? [],
  };
}

/**
 * The complete pre-vote state. It contains no model, provider, configuration,
 * trial or committed artifact path. Latency, cost and observed failures are
 * deliberately present: the reviewer is judging a real recorded result.
 */
export function mediaBlindView(record) {
  const runId = mediaRunIdFor(record);
  const task = asRecord(record?.task);
  const input = asRecord(task.input);
  const prompt = asRecord(task.prompt);
  const pairs = mediaPairs(record);
  const configurations = configurationsOfMedia(record);
  const trials = configurations.flatMap((configuration) => configuration.trials);
  const view = {
    runId,
    inventory: text(record?.inventory) || "unknown",
    recordedAt: parseInstant(record?.generatedAt),
    sourceVersion: /^[0-9a-f]{7,40}$/i.test(text(record?.sourceVersion))
      ? text(record?.sourceVersion)
      : null,
    task: {
      id: text(task.id) || "unknown",
      version: Number.isInteger(task.version) ? task.version : null,
      title: text(task.title) || "unknown",
      category: text(task.category) || "unknown",
      capability: text(task.capability) || "unknown",
      kind: text(task.kind) || "unknown",
      summary: text(task.summary) || "not recorded",
      input: {
        kind: text(input.kind) || "unknown",
        title: text(input.title) || "unknown",
        mime: text(input.mime) || "unknown",
        bytes: numberOrNull(input.bytes),
        width: numberOrNull(input.width),
        height: numberOrNull(input.height),
        sha256: text(input.sha256) || "unknown",
        credit: text(input.credit) || "not recorded",
        visibility: text(input.visibility) || "unknown",
        reviewedAt: text(input.reviewedAt) || "not recorded",
        publicUrl: text(input.publicUrl) || null,
        previewUrl: text(input.previewPath)
          ? `${MEDIA_ASSET_ROOT}/${text(input.previewPath)}`
          : null,
        note: text(input.note) || "",
      },
      settings: asRecord(task.settings),
      prompt: {
        published: prompt.published === true,
        sha256: text(prompt.sha256) || "unknown",
        summary: text(prompt.summary) || "not recorded",
        note: text(prompt.note) || "",
      },
      observations: asArray(task.observations).map((entry) => {
        const observation = asRecord(entry);
        return {
          id: text(observation.id) || "unknown",
          name: text(observation.name) || "unknown",
          kind: text(observation.kind) || "unknown",
          method: text(observation.method) || "not recorded",
          detail: text(observation.detail) || "",
        };
      }),
      notComparable: asArray(task.notComparable).map((line) => text(line)).filter(Boolean),
    },
    sample: {
      configurations: configurations.length,
      trials: trials.length,
      pairs: pairs.length,
      saved: trials.filter((trial) => trial.status === "saved" && trial.artifact).length,
      failedArtifacts: trials.filter(
        (trial) => trial.status !== "saved" || !trial.artifact,
      ).length,
      trialsPerConfiguration:
        configurations.length === 0 ? 0 : Math.round(trials.length / configurations.length),
      repeats:
        configurations.length === 0
          ? 0
          : Math.max(0, Math.min(...configurations.map((configuration) => configuration.trials.length)) - 1),
    },
    costLabel: MEDIA_COST_LABEL,
    latencyLabel: MEDIA_LATENCY_LABEL,
    pairs: pairs.map((pair) => ({
      id: pair.id,
      label: `Pair ${pair.ordinal}`,
      sides: [
        sideView(record, pair.id, pair.trialA, "a"),
        sideView(record, pair.id, pair.trialB, "b"),
      ],
    })),
  };
  assertMediaBlindViewIsClean(view, record);
  return view;
}

/** Every recorded identity token the pre-vote state must not contain. */
export function forbiddenMediaIdentityTokens(record) {
  const tokens = new Set();
  for (const configuration of configurationsOfMedia(record)) {
    for (const value of [
      configuration.id,
      configuration.label,
      configuration.model,
      configuration.resolvedModel,
      configuration.provider,
      configuration.harness,
      configuration.harnessVersion,
      configuration.inventoryEntry,
    ]) {
      if (typeof value === "string" && value.trim().length >= 3 && !GENERIC.has(value.trim().toLowerCase()))
        tokens.add(value.trim());
    }
    for (const trial of configuration.trials) {
      if (trial.id && trial.id.length >= 3 && !GENERIC.has(trial.id.toLowerCase()))
        tokens.add(trial.id);
      for (const artifact of [trial.artifact, trial.poster]) {
        if (artifact?.path) {
          tokens.add(artifact.path);
          tokens.add(`${MEDIA_ASSET_ROOT}/${artifact.path}`);
        }
      }
    }
  }
  return [...tokens].filter((token) => !/[<>]/.test(token));
}

/** Throw rather than ship a blind page that names a model or a direct asset path. */
export function assertMediaBlindViewIsClean(view, record) {
  const serialised = JSON.stringify(view).toLowerCase();
  const found = forbiddenMediaIdentityTokens(record).filter((token) =>
    serialised.includes(token.toLowerCase()),
  );
  if (found.length > 0) {
    throw new Error(
      `Refusing to render a blind media comparison that names a configuration: ${found.join(", ")}`,
    );
  }
  const forbiddenKeys = [
    "configurationid",
    "configurationlabel",
    "trialid",
    "resolvedmodel",
    "provider",
    "harness",
    "model",
  ];
  const keys = new Set();
  walkKeys(view, keys);
  for (const key of keys) {
    if (forbiddenKeys.includes(key)) {
      throw new Error(`Refusing to render a blind media comparison with a ${key} field.`);
    }
  }
  for (const pair of view.pairs) {
    for (const side of pair.sides) {
      for (const url of [side.clip, side.poster]) {
        if (url !== null && !url.startsWith(`${MEDIA_PREVIEW_ROOT}/`)) {
          throw new Error("Refusing to render a media preview that is not behind the opaque route.");
        }
      }
      if (side.clip !== null && !side.clip.endsWith("/clip.mp4")) {
        throw new Error("A media clip URL must name the allowlisted clip file.");
      }
      if (side.poster !== null && !side.poster.endsWith("/poster.jpg")) {
        throw new Error("A media poster URL must name the allowlisted poster file.");
      }
    }
  }
  if (/\/projects\/|retained\.mp4|gen_[0-9a-f]{8}/i.test(serialised)) {
    throw new Error("Refusing to render a blind media comparison with a private Studio path.");
  }
}

function walkKeys(value, keys) {
  if (Array.isArray(value)) {
    for (const entry of value) walkKeys(entry, keys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    keys.add(key.toLowerCase());
    walkKeys(entry, keys);
  }
}

/** The post-vote reveal for one pair, including the exact recorded facts. */
export function mediaRevealPair(record, pairId) {
  const pair = mediaPair(record, pairId);
  if (!pair) return null;
  return {
    pairId: pair.id,
    label: `Pair ${pair.ordinal}`,
    sides: [
      revealSide(pair.trialA, "a") ?? unknownRevealSide("a"),
      revealSide(pair.trialB, "b") ?? unknownRevealSide("b"),
    ],
  };
}

function revealSide(trial, key) {
  if (!trial) return null;
  const configuration = trial.configuration;
  return {
    key,
    title: key === "a" ? "Take A" : "Take B",
    configurationId: configuration.id,
    configurationLabel: configuration.label,
    model: configuration.model,
    resolvedModel: configuration.resolvedModel,
    provider: configuration.provider,
    harness: configuration.harness,
    harnessVersion: configuration.harnessVersion,
    inventoryEntry: configuration.inventoryEntry,
    trialId: trial.id,
    status: trial.status,
    latencyMs: trial.durationMs,
    createdAt: trial.createdAt,
    completedAt: trial.completedAt,
    artifact: trial.artifact
      ? {
          mime: trial.artifact.mime,
          bytes: trial.artifact.bytes,
          width: trial.artifact.width,
          height: trial.artifact.height,
          durationMs: trial.artifact.durationMs,
          sha256: trial.artifact.sha256,
          videoCodec: trial.artifact.videoCodec,
          frameRate: trial.artifact.frameRate,
          audio: trial.artifact.audio,
        }
      : null,
    poster: trial.poster
      ? {
          mime: trial.poster.mime,
          bytes: trial.poster.bytes,
          sha256: trial.poster.sha256,
        }
      : null,
    cost: trial.cost,
    checks: trial.checks,
    failed: trial.failed,
    settings: configuration.settings,
  };
}

function unknownRevealSide(key) {
  return {
    key,
    title: key === "a" ? "Take A" : "Take B",
    configurationId: "unknown",
    configurationLabel: "unknown",
    model: "unknown",
    resolvedModel: "unknown",
    provider: "unknown",
    harness: "unknown",
    harnessVersion: "unknown",
    inventoryEntry: null,
    trialId: "unknown",
    status: "missing",
    latencyMs: null,
    createdAt: null,
    completedAt: null,
    artifact: null,
    poster: null,
    cost: null,
    checks: [],
    failed: [],
    settings: {},
  };
}

/**
 * The revealed run view. It is built from the committed record plus the D1
 * votes, so the export and the run page share one renderer.
 */
export function mediaRunView(record, votes = [], options = {}) {
  const runId = mediaRunIdFor(record);
  const configurations = configurationsOfMedia(record);
  const pairs = mediaPairs(record);
  const knownPairs = new Set(pairs.map((pair) => pair.id));
  const votesByPair = new Map();
  for (const vote of asArray(votes)) {
    const list = votesByPair.get(vote.pairId) ?? [];
    list.push(vote);
    votesByPair.set(vote.pairId, list);
  }
  const trials = configurations.flatMap((configuration) => configuration.trials);
  const saved = trials.filter((trial) => trial.status === "saved" && trial.artifact).length;
  const failedChecks = [...new Set(trials.flatMap((trial) => trial.failed))];
  const recordedVotes = asArray(votes).filter((vote) => knownPairs.has(vote.pairId));
  return {
    schema: MEDIA_RECORD_SCHEMA,
    runId,
    inventory: text(record.inventory) || "unknown",
    task: {
      id: text(record.task?.id) || "unknown",
      version: Number.isInteger(record.task?.version) ? record.task.version : null,
      title: text(record.task?.title) || "unknown",
      category: text(record.task?.category) || "unknown",
      capability: text(record.task?.capability) || "unknown",
      kind: text(record.task?.kind) || "unknown",
      summary: text(record.task?.summary) || "not recorded",
      settings: asRecord(record.task?.settings),
      input: asRecord(record.task?.input),
      prompt: {
        published: record.task?.prompt?.published === true,
        sha256: text(record.task?.prompt?.sha256) || "unknown",
        summary: text(record.task?.prompt?.summary) || "not recorded",
        note: text(record.task?.prompt?.note) || "",
      },
      observations: asArray(record.task?.observations),
      notComparable: asArray(record.task?.notComparable).map((line) => text(line)).filter(Boolean),
    },
    recordedAt: parseInstant(record.generatedAt),
    sourceVersion: /^[0-9a-f]{7,40}$/i.test(text(record.sourceVersion))
      ? text(record.sourceVersion)
      : null,
    source: asRecord(record.source),
    sample: {
      configurations: configurations.length,
      trials: trials.length,
      saved,
      failedArtifacts: trials.length - saved,
      pairs: pairs.length,
      trialsPerConfiguration:
        configurations.length === 0 ? 0 : Math.round(trials.length / configurations.length),
      repeats:
        configurations.length === 0
          ? 0
          : Math.max(0, Math.min(...configurations.map((configuration) => configuration.trials.length)) - 1),
      recordedPairs: new Set(recordedVotes.map((vote) => vote.pairId)).size,
      blindVotes: recordedVotes.filter((vote) => vote.blind).length,
      unblindedVotes: recordedVotes.filter((vote) => !vote.blind).length,
    },
    cost: {
      estimateMicro: trials.reduce(
        (total, trial) => total + (Number.isFinite(trial.cost?.estimateMicro) ? trial.cost.estimateMicro : 0),
        0,
      ),
      providerChargeRows: trials.filter((trial) =>
        Number.isFinite(trial.cost?.providerChargedMicro),
      ).length,
      label: MEDIA_COST_LABEL,
    },
    configurations: configurations.map((configuration) => ({
      id: configuration.id,
      label: configuration.label,
      model: configuration.model,
      resolvedModel: configuration.resolvedModel,
      provider: configuration.provider,
      harness: configuration.harness,
      harnessVersion: configuration.harnessVersion,
      inventoryEntry: configuration.inventoryEntry,
      settings: configuration.settings,
      trials: configuration.trials.map((trial) => ({
        id: trial.id,
        index: trial.index,
        status: trial.status,
        durationMs: trial.durationMs,
        createdAt: trial.createdAt,
        completedAt: trial.completedAt,
        artifact: trial.artifact,
        poster: trial.poster,
        cost: trial.cost,
        checks: trial.checks,
        failed: trial.failed,
      })),
    })),
    pairs: pairs.map((pair) => ({
      id: pair.id,
      label: `Pair ${pair.ordinal}`,
      sideA: revealSide(pair.trialA, "a") ?? unknownRevealSide("a"),
      sideB: revealSide(pair.trialB, "b") ?? unknownRevealSide("b"),
      votes: votesByPair.get(pair.id) ?? [],
      revealAvailable: true,
    })),
    unmatchedVotes: asArray(votes).filter((vote) => !knownPairs.has(vote.pairId)),
    failures: failedChecks.map((id) => ({
      assertion: id,
      owner: "#601 Benchmarks Studio",
    })),
    verdict: mediaVerdict(pairs, recordedVotes, failedChecks, options.votesAvailable !== false),
    provenance: {
      runner: "benchmarks/media/ingest.mjs",
      recordFile: "benchmarks/media/run.json",
      sourceFile: "benchmarks/media/configurations.json",
      inventory: MEDIA_INVENTORY,
      sourceVersion: /^[0-9a-f]{7,40}$/i.test(text(record.sourceVersion))
        ? text(record.sourceVersion)
        : null,
      recordedAt: parseInstant(record.generatedAt),
      node: text(record.node) || "unknown",
      platform: text(record.platform) || "unknown",
    },
    votesAvailable: options.votesAvailable !== false,
  };
}

function mediaVerdict(pairs, votes, failedChecks, votesAvailable = true) {
  const blind = votes.filter((vote) => vote.blind).length;
  const unblinded = votes.length - blind;
  const pairLine = `${pairs.length} pair${pairs.length === 1 ? "" : "s"} in the record`;
  const voteLine = !votesAvailable
    ? "The vote record could not be read here, so this page does not claim that no preference exists."
    : votes.length === 0
      ? "No blind vote has been recorded yet."
      : `${blind} blind and ${unblinded} unblinded vote${votes.length === 1 ? "" : "s"} recorded; the labels are unauthenticated.`;
  const failureLine =
    failedChecks.length > 0
      ? `Observed failures: ${failedChecks.join(", ")}. They are task observations, not a quality score.`
      : "No observed failure is recorded for these takes.";
  return {
    comparable: pairs.length > 0,
    headline:
      pairs.length === 0
        ? "No matched pair is recorded"
        : "One matched pair, one saved output per model",
    detail: `${pairLine}. ${failureLine} ${voteLine} This is not a model ranking.`,
  };
}

/** Export and reopen share this object; the page builder reads the same shape. */
export function mediaExport(record, votes = [], options = {}) {
  const runId = mediaRunIdFor(record);
  return {
    schema: "composer/benchmark-run-evidence/1",
    runId,
    record,
    votes: asArray(votes),
    votesAvailable: options.votesAvailable !== false,
    reopen: {
      blind: `/benchmarks/media?run=${encodeURIComponent(runId)}`,
      revealed: `/benchmarks/media/runs/${encodeURIComponent(runId)}`,
      export: `/benchmarks/media/runs/${encodeURIComponent(runId)}/export.json`,
    },
  };
}

export function mediaExportFilename(runId) {
  return `composer-benchmark-media-${runId}.json`;
}

/**
 * The receipts page's honesty copy. The aggregate table never becomes a
 * preference; this function only describes the separate matched-still vote so
 * the page cannot keep claiming "no preference" after one exists.
 */
export function mediaPreferenceCopy({
  available = true,
  choices = 0,
  blindChoices = 0,
  reveals = 0,
  routes = 0,
} = {}) {
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const routeLine = `${plural(routes, "route", "routes")}`;
  if (!available) {
    return {
      line:
        "The separate matched-still comparison could not read its vote record here, so this page does not claim that no preference exists.",
      limit:
        "Claim a preference across these routes. The matched pair vote record is unavailable here, so this page does not claim that no preference exists.",
    };
  }
  if (choices > 0) {
    const votes = plural(choices, "recorded preference vote", "recorded preference votes");
    const interpretation =
      choices === 1
        ? "That is one unauthenticated label's preference between two saved clips"
        : `Those are ${choices} unauthenticated label preferences between two saved clips`;
    return {
      line: `The separate matched-still comparison has ${votes} (${blindChoices} blind, ${choices - blindChoices} unblinded, ${plural(reveals, "reveal", "reveals")} without choosing). ${interpretation}, not a quality ranking of these ${routeLine}.`,
      limit: `Rank quality across these routes. ${votes} on one matched pair is one unauthenticated comparison, not a preference across these ${routeLine}.`,
    };
  }
  if (reveals > 0) {
    return {
      line: `The separate matched-still comparison has been revealed ${plural(reveals, "time", "times")} without a choice. No blind preference between those two clips is recorded.`,
      limit:
        "Claim a preference. The aggregate routes have no blind human comparison; the matched pair has been revealed without a choice, not voted on.",
    };
  }
  return {
    line:
      "The separate matched-still comparison has no recorded vote yet. This table still does not turn a saved job into a preference.",
    limit:
      "Claim a preference. The aggregate routes have no blind human comparison; the separate matched-still pair is open for a blind vote.",
  };
}

/**
 * Structural and matched-pair validation. File bytes are checked by the ingest
 * runner, which has filesystem access; this function stays usable in the Worker
 * and in tests.
 */
export function validateMediaRecord(record, options = {}) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (asRecord(record).schema !== MEDIA_RECORD_SCHEMA) {
    fail(`record.schema must be ${MEDIA_RECORD_SCHEMA}`);
  }
  if (text(record?.inventory) !== MEDIA_INVENTORY) {
    fail(`record.inventory must be ${MEDIA_INVENTORY}`);
  }
  const sourceVersion = text(record?.sourceVersion);
  if (!/^[0-9a-f]{40}$/i.test(sourceVersion)) {
    fail("record.sourceVersion must be the 40-character source digest");
  }
  if (options.expectedSourceVersion && sourceVersion !== options.expectedSourceVersion) {
    fail("record.sourceVersion does not match the committed source digest");
  }
  const task = asRecord(record?.task);
  for (const key of ["id", "title", "category", "capability", "kind"]) {
    if (!text(task[key])) fail(`task.${key} is required`);
  }
  if (!Number.isInteger(task.version)) fail("task.version must be an integer");
  if (asRecord(task.input).visibility !== "public") {
    fail("task.input.visibility must be public: only public-safe inputs are published");
  }
  if (!/^[0-9a-f]{64}$/i.test(text(asRecord(task.input).sha256))) {
    fail("task.input.sha256 must be a sha256 digest");
  }
  if (asRecord(task.prompt).published !== false) {
    fail("task.prompt.published must be false: the exact prompt is not published");
  }
  if (!/^[0-9a-f]{64}$/i.test(text(asRecord(task.prompt).sha256))) {
    fail("task.prompt.sha256 must be a sha256 digest");
  }
  const observations = asArray(task.observations).map((entry) => asRecord(entry));
  if (observations.length === 0) fail("task.observations must not be empty");
  const observationIds = new Set(observations.map((entry) => text(entry.id)));
  if (observationIds.size !== observations.length) fail("task.observations ids must be unique");

  const configurations = configurationsOfMedia(record);
  if (configurations.length < 2) fail("at least two configurations are required");
  const seenModels = new Set();
  for (const configuration of configurations) {
    if (configuration.model === "unknown") fail(`${configuration.id} has no model`);
    if (seenModels.has(configuration.model)) {
      fail(`model ${configuration.model} appears more than once; the model must differ`);
    }
    seenModels.add(configuration.model);
    if (configuration.trials.length === 0) fail(`${configuration.id} has no trial`);
    for (const trial of configuration.trials) {
      if (!/^take-\d{2}$/.test(trial.id)) fail(`${configuration.id} trial id must be opaque (take-NN)`);
      if (!["saved", "failed", "missing"].includes(trial.status)) {
        fail(`${trial.id} has an unknown status`);
      }
      if (trial.status === "saved") {
        validateArtifact(trial.artifact, trial.id, fail);
        validatePoster(trial.poster, trial.id, fail);
        validateCost(trial.cost, trial.id, fail);
      }
      const checkIds = new Set(trial.checks.map((check) => check.id));
      for (const id of observationIds) {
        if (!checkIds.has(id)) fail(`${trial.id} is missing the ${id} check`);
      }
      for (const id of checkIds) {
        if (!observationIds.has(id)) fail(`${trial.id} has an unrecorded check ${id}`);
      }
      const failedIds = trial.checks.filter((check) => check.status === "fail").map((check) => check.id);
      if (JSON.stringify(failedIds.sort()) !== JSON.stringify([...trial.failed].sort())) {
        fail(`${trial.id} failed list must match the failed checks`);
      }
    }
  }

  const settings = configurations.map((configuration) => canonicalJson(configuration.settings));
  if (new Set(settings).size > 1) {
    fail("shared settings differ between configurations; the pair is not matched");
  }
  for (const configuration of configurations) {
    const settingsRecord = configuration.settings;
    for (const [key, value] of Object.entries(asRecord(task.settings))) {
      if (canonicalJson(settingsRecord[key] ?? null) !== canonicalJson(value ?? null)) {
        fail(`${configuration.id} setting ${key} does not match the task`);
      }
    }
  }

  const pairs = mediaPairs(record);
  if (pairs.length === 0) fail("no pair can be built from the configurations");
  for (const pair of pairs) {
    const a = pair.trialA;
    const b = pair.trialB;
    if (a.configuration.id === b.configuration.id) fail(`${pair.id} pairs a configuration with itself`);
    if (a.configuration.model === b.configuration.model) fail(`${pair.id} uses the same model on both sides`);
    if (canonicalJson(a.configuration.settings) !== canonicalJson(b.configuration.settings)) {
      fail(`${pair.id} settings are not matched`);
    }
    for (const [side, trial] of [
      ["a", a],
      ["b", b],
    ]) {
      for (const artifact of [trial.artifact, trial.poster]) {
        if (artifact?.path && !assetPathAllowed(artifact.path, pair.id, side)) {
          fail(`${pair.id}/${side} artifact path is not the matching side path: ${artifact.path}`);
        }
      }
    }
  }
  if (record.pair) {
    const stored = asRecord(record.pair);
    const computed = pairs[0];
    if (!computed) fail("record.pair exists but no pair was computed");
    else {
      if (text(stored.id) !== computed.id) fail("record.pair id does not match the computed pair");
      if (text(stored.sideA) !== computed.trialA.id) fail("record.pair sideA does not match the computed pair");
      if (text(stored.sideB) !== computed.trialB.id) fail("record.pair sideB does not match the computed pair");
      if (text(stored.orderKey) !== computed.orderKey) fail("record.pair orderKey does not match the computed pair");
    }
  }
  for (const message of privateFieldErrors(record)) fail(message);
  return { ok: errors.length === 0, errors };
}

function validateArtifact(artifact, trialId, fail) {
  if (!artifact) {
    fail(`${trialId} is saved but has no artifact`);
    return;
  }
  if (artifact.mime !== "video/mp4") fail(`${trialId} artifact must be video/mp4`);
  if (!Number.isFinite(artifact.bytes) || artifact.bytes <= 0) fail(`${trialId} artifact bytes must be positive`);
  if (!Number.isFinite(artifact.width) || artifact.width <= 0) fail(`${trialId} artifact width is missing`);
  if (!Number.isFinite(artifact.height) || artifact.height <= 0) fail(`${trialId} artifact height is missing`);
  if (!Number.isFinite(artifact.durationMs) || artifact.durationMs <= 0) fail(`${trialId} artifact duration is missing`);
  if (!/^[0-9a-f]{64}$/i.test(artifact.sha256)) fail(`${trialId} artifact sha256 is invalid`);
}

function validatePoster(poster, trialId, fail) {
  if (!poster) {
    fail(`${trialId} is saved but has no poster`);
    return;
  }
  if (poster.mime !== "image/jpeg") fail(`${trialId} poster must be image/jpeg`);
  if (!Number.isFinite(poster.bytes) || poster.bytes <= 0) fail(`${trialId} poster bytes must be positive`);
  if (!/^[0-9a-f]{64}$/i.test(poster.sha256)) fail(`${trialId} poster sha256 is invalid`);
}

function validateCost(cost, trialId, fail) {
  if (!cost) {
    fail(`${trialId} is saved but has no cost record`);
    return;
  }
  if (!Number.isFinite(cost.estimateMicro) || cost.estimateMicro < 0) {
    fail(`${trialId} cost estimate must be a non-negative number`);
  }
}

function privateFieldErrors(value, path = "record") {
  const errors = [];
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      errors.push(...privateFieldErrors(entry, `${path}[${index}]`));
    }
    return errors;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      for (const pattern of PRIVATE_VALUE_PATTERNS) {
        if (pattern.test(value)) errors.push(`${path} looks like a private Studio field`);
      }
    }
    return errors;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (PRIVATE_KEYS.has(key)) errors.push(`${path}.${key} is a private field`);
    errors.push(...privateFieldErrors(entry, `${path}.${key}`));
  }
  return errors;
}

export function parseInstant(value) {
  const raw = text(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function mediaChoiceLabel(choice) {
  switch (choice) {
    case "a":
      return "A is better";
    case "b":
      return "B is better";
    case "tie":
      return "Tie";
    case "cant-tell":
      return "Can't tell";
    case "revealed":
      return "Revealed without choosing";
    default:
      return "unknown";
  }
}

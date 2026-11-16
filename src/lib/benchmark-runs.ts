// MIT. One recorded Benchmarks Studio comparison, made reopenable and blind.
//
// The comparison page must not leak which configuration produced which take
// before the reviewer records a choice. That is harder than hiding a label: a
// trial id, a preview path, a DOM attribute or the order of the cards can all
// name the configuration. This module is the single place that knows the
// mapping from an opaque pair/side to a recorded trial, and it refuses to build
// a blind view that contains any recorded configuration identity.
//
// It also owns the durable submission contract used by /api/benchmark-votes.
// Runs are committed JSON records, not D1 rows: the evidence is reviewable in
// the repository, and D1 stores the public observations. A submission is
// append-only. The same browser token or label may submit again; that creates a
// new row and never rewrites or deletes an earlier observation. The browser
// token is random, not an identity, and only its SHA-256 hash is published.
import type { D1Database } from "@cloudflare/workers-types";
import recordFile from "../../benchmarks/results/compare.json" with { type: "json" };
import mediaRecordFile from "../../benchmarks/media/run.json" with { type: "json" };
import {
  routeFailures,
  summariseConfiguration,
  verdictFor,
} from "./benchmark-compare.mjs";

export const RUN_EVIDENCE_SCHEMA = "composer/benchmark-run-evidence/1";
export const COMPARE_SCHEMA = "benchmark-compare/v1";
export const VOTE_CHOICES = ["a", "b", "tie", "cant-tell", "revealed"] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];
export const VOTE_TABLE = "benchmark_votes";
export const REASON_MAX = 240;
export const REVIEWER_MAX = 32;
export const REASONS_MAX = 8;
export const REASON_CHIP_MAX = 48;
export const DEFAULT_REVIEWER_LABEL = "visitor";
export const REVIEWER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;
// 32 or 64 lowercase hex characters. The 32-character form comes from the
// migration's existing rows; browsers generate 32 random bytes (64 hex).
export const REVIEWER_TOKEN_PATTERN = /^[0-9a-f]{32,64}$/;
export const REVIEWER_TOKEN_HEADER = "x-benchmark-reviewer-token";
export const JUDGE_LABEL =
  "Deterministic evaluator in src/lib/benchmark-compare.mjs: nine assertions read the bytes each trial produced. No model self-report is trusted.";
export const RUNNER_LABEL =
  "benchmarks/compare/run.mjs. This record is reopened from committed files; no provider is called and nothing is spent.";

type Check = {
  id: string;
  name: string;
  status: string;
  detail: string;
};

export type RecordedTrial = {
  id: string;
  index: number;
  status: string;
  durationMs: number | null;
  checks: Check[];
  failed?: string[];
  artifacts?: Record<string, string>;
  artifact?: Record<string, unknown> | null;
  poster?: Record<string, unknown> | null;
  previewUrl: string;
  note?: string;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
  } | null;
  cost?: {
    estimateMicro: number | null;
    providerChargedMicro: number | null;
    basis?: string;
  } | null;
  configurationId: string;
  configurationLabel: string;
  model: string;
  harness: string;
};

export type RecordedConfiguration = {
  id: string;
  label?: string;
  model?: string;
  resolvedModel?: string;
  provider?: string;
  harness?: string;
  harnessVersion?: string;
  inventoryEntry?: string | null;
  settings?: Record<string, unknown>;
  runnerKind?: string;
  trials?: RecordTrial[];
};

type RecordTrial = Omit<RecordedTrial, "configurationId" | "configurationLabel" | "model" | "harness">;

export type RunRecord = {
  schema?: string;
  sourceVersion?: string;
  generatedAt?: string;
  node?: string;
  platform?: string;
  task?: {
    id?: string;
    version?: number;
    title?: string;
    category?: string;
    capability?: string;
    briefSha256?: string;
    assertions?: { id: string; name: string }[];
  };
  configurations?: RecordedConfiguration[];
};

export type Pair = {
  id: string;
  ordinal: number;
  trialA: RecordedTrial;
  trialB: RecordedTrial;
  orderKey: string;
};

export type BlindSide = {
  key: "a" | "b";
  title: string;
  previewHtml: string;
  previewCss: string;
};

export type BlindPair = {
  id: string;
  label: string;
  sides: [BlindSide, BlindSide];
};

export type BlindView = {
  runId: string;
  taskTitle: string;
  recordedAt: string | null;
  sourceVersion: string | null;
  sample: {
    configurations: number;
    trials: number;
    pairs: number;
  };
  pairs: BlindPair[];
};

export type RevealSide = {
  key: "a" | "b";
  title: string;
  configurationId: string;
  configurationLabel: string;
  trialId: string;
  model: string;
  resolvedModel: string;
  provider: string;
  harness: string;
  harnessVersion: string;
  status: string;
  durationMs: number | null;
  latencyMs: number | null;
  failed: string[];
  checks: Check[];
  settings: Record<string, unknown>;
  artifact: {
    mime: string;
    bytes: number | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    sha256: string;
    videoCodec: string | null;
    frameRate: string | null;
    audio: Record<string, unknown> | null;
  } | null;
  poster: {
    mime: string;
    bytes: number | null;
    sha256: string;
  } | null;
  cost: {
    estimateMicro: number | null;
    providerChargedMicro: number | null;
    basis: string;
  } | null;
};

export type RevealPair = {
  pairId: string;
  label: string;
  sides: [RevealSide, RevealSide];
};

export type VoteRecord = {
  submissionId: string;
  runId: string;
  taskId: string;
  pairId: string;
  trialA: string;
  trialB: string;
  choice: VoteChoice;
  reason: string;
  reasons: string[];
  blind: boolean;
  reviewerLabel: string;
  reviewerTokenHash: string;
  createdAt: string;
  updatedAt: string;
};

export type VoteInput = {
  run?: unknown;
  task?: unknown;
  pair?: unknown;
  choice?: unknown;
  reason?: unknown;
  reasons?: unknown;
  chips?: unknown;
  blind?: unknown;
  reviewer?: unknown;
  token?: unknown;
};

export type ValidatedVote = {
  runId: string;
  taskId: string;
  pairId: string;
  trialA: string;
  trialB: string;
  choice: VoteChoice;
  reason: string;
  reasons: string[];
  blind: boolean;
  reviewerLabel: string;
  reviewerToken: string;
};

const VOTE_INPUT_KEYS = new Set([
  "run",
  "task",
  "pair",
  "choice",
  "reason",
  "reasons",
  "chips",
  "blind",
  "reviewer",
  "token",
]);

/** What a blind page may see about a pair before its own submission: counts
 * and choices, never a label, token, reason or model identity. */
export type PairTally = {
  pairId: string;
  submissions: {
    submissionId: string;
    choice: VoteChoice;
    blind: boolean;
    createdAt: string;
  }[];
};

export type ValidationFailure = { status: number; error: string; code: string };
export type ValidationResult =
  | { ok: true; value: ValidatedVote }
  | { ok: false; failure: ValidationFailure };

/** The exact committed records this deployment can reopen. */
const committedRecords: RunRecord[] = [
  recordFile as unknown as RunRecord,
  mediaRecordFile as unknown as RunRecord,
];

/** @param {unknown} value */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** @param {unknown} value */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** @param {unknown} value */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** @param {string} value */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A deterministic non-cryptographic order key. It hides configuration order,
 * not secrets; the server alone owns the mapping. */
function orderHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sourceShort(value: unknown): string {
  const source = text(value);
  return /^[0-9a-f]{7,40}$/i.test(source) ? source.slice(0, 7) : "unrecorded";
}

/** Stable, human-readable id derived only from recorded task/source fields. */
export function runIdFor(record: RunRecord | null | undefined): string {
  const task = asRecord(record?.task);
  const taskId = slug(text(task.id) || "unknown") || "unknown";
  const version = Number.isInteger(task.version) ? String(task.version) : "unknown";
  return `${taskId}-v${version}-${sourceShort(record?.sourceVersion)}`;
}

export function listRecordedRuns(): { id: string; record: RunRecord }[] {
  return committedRecords.map((record) => ({ id: runIdFor(record), record }));
}

export function getRunRecord(id?: string | null): { id: string; record: RunRecord } | null {
  if (id === undefined || id === null) return listRecordedRuns()[0] ?? null;
  return listRecordedRuns().find((entry) => entry.id === id) ?? null;
}

/** A media record is a committed Studio comparison, not a build-agent run. */
export function isMediaRecord(record: RunRecord | null | undefined): boolean {
  return record?.schema === "benchmark-media/v1";
}

/** The committed media run, if one is registered. */
export function mediaRunEntry(): { id: string; record: RunRecord } | null {
  return listRecordedRuns().find((entry) => isMediaRecord(entry.record)) ?? null;
}

/** Flatten a committed configuration into its trials, keeping only fields the
 * record actually contains. Missing fields are filled with explicit unknown
 * labels at render time, not guessed here. */
export function configurationsOf(record: RunRecord): RecordedConfiguration[] {
  return asArray(record.configurations).map((entry) => {
    const configuration = asRecord(entry);
    return {
      ...configuration,
      id: text(configuration.id) || "unknown",
      label: text(configuration.label) || undefined,
      model: text(configuration.model) || undefined,
      resolvedModel: text(configuration.resolvedModel) || undefined,
      harness: text(configuration.harness) || undefined,
      harnessVersion: text(configuration.harnessVersion) || undefined,
      settings: asRecord(configuration.settings) as Record<string, unknown>,
      runnerKind: text(configuration.runnerKind) || undefined,
      trials: asArray(configuration.trials) as RecordTrial[],
    } as RecordedConfiguration;
  });
}

/** @param {RunRecord} record */
export function trialsOf(record: RunRecord): RecordedTrial[] {
  return configurationsOf(record).flatMap((configuration) =>
    asArray(configuration.trials).map((raw) => {
      const trial = asRecord(raw);
      return {
        ...trial,
        id: text(trial.id) || "unknown",
        index: Number.isInteger(trial.index) ? Number(trial.index) : 0,
        status: text(trial.status) || "unknown",
        durationMs:
          trial.durationMs === null || trial.durationMs === undefined
            ? null
            : Number(trial.durationMs),
        checks: asArray(trial.checks) as Check[],
        failed: Array.isArray(trial.failed) ? (trial.failed as string[]) : [],
        previewUrl: text(trial.previewUrl),
        configurationId: configuration.id,
        configurationLabel: configuration.label ?? configuration.id,
        model: configuration.model ?? configuration.resolvedModel ?? "unknown",
        harness: configuration.harness ?? "unknown",
      } as RecordedTrial;
    }),
  );
}

/** Pair every configuration against every other one at the same trial index.
 * Pair order and side assignment are hash-derived so neither follows
 * configuration order. */
export function pairsFor(record: RunRecord): Pair[] {
  const runId = runIdFor(record);
  const configurations = configurationsOf(record).filter(
    (configuration) => asArray(configuration.trials).length > 0,
  );
  const candidates: { a: RecordedTrial; b: RecordedTrial }[] = [];
  for (let left = 0; left < configurations.length; left += 1) {
    for (let right = left + 1; right < configurations.length; right += 1) {
      const first = configurations[left];
      const second = configurations[right];
      const firstTrials = asArray(first.trials) as RecordTrial[];
      const secondTrials = asArray(second.trials) as RecordTrial[];
      const count = Math.min(firstTrials.length, secondTrials.length);
      for (let index = 0; index < count; index += 1) {
        const a = trialWithConfiguration(first, firstTrials[index]);
        const b = trialWithConfiguration(second, secondTrials[index]);
        if (a && b) candidates.push({ a, b });
      }
    }
  }
  const ordered = candidates
    .map((candidate) => ({
      ...candidate,
      orderKey: orderHash(`${runId}|${candidate.a.id}|${candidate.b.id}|order`),
    }))
    .sort((left, right) => left.orderKey.localeCompare(right.orderKey));
  return ordered.map((candidate, index) => {
    const swap = Number.parseInt(orderHash(`${runId}|${candidate.a.id}|${candidate.b.id}|side`), 16) % 2 === 1;
    return {
      id: `p${String(index + 1).padStart(2, "0")}`,
      ordinal: index + 1,
      trialA: swap ? candidate.b : candidate.a,
      trialB: swap ? candidate.a : candidate.b,
      orderKey: candidate.orderKey,
    };
  });
}

function trialWithConfiguration(
  configuration: RecordedConfiguration,
  raw: unknown,
): RecordedTrial | null {
  const trial = asRecord(raw);
  const id = text(trial.id);
  if (!id) return null;
  return {
    ...trial,
    id,
    index: Number.isInteger(trial.index) ? Number(trial.index) : 0,
    status: text(trial.status) || "unknown",
    durationMs:
      trial.durationMs === null || trial.durationMs === undefined
        ? null
        : Number(trial.durationMs),
    checks: asArray(trial.checks) as Check[],
    failed: Array.isArray(trial.failed) ? (trial.failed as string[]) : [],
    previewUrl: text(trial.previewUrl),
    configurationId: configuration.id,
    configurationLabel: configuration.label ?? configuration.id,
    model: configuration.model ?? configuration.resolvedModel ?? "unknown",
    harness: configuration.harness ?? "unknown",
  } as RecordedTrial;
}

export function pairFor(record: RunRecord, pairId: string): Pair | null {
  return pairsFor(record).find((pair) => pair.id === pairId) ?? null;
}

/** The opaque URL the browser fetches. It names the run and the pair, never a
 * configuration or trial. The route maps it back on the server. */
export function previewPath(runId: string, pairId: string, side: "a" | "b"): string {
  return `/benchmarks/preview/${encodeURIComponent(runId)}/${pairId}/${side}/index.html`;
}

export function cssPathFor(previewHtml: string): string {
  return previewHtml.replace(/index\.html$/, "app.css");
}

/** The complete pre-vote state. It must contain no configuration identity. */
export function blindView(record: RunRecord): BlindView {
  const runId = runIdFor(record);
  const pairs = pairsFor(record);
  const view: BlindView = {
    runId,
    taskTitle: text(record.task?.title) || "unknown",
    recordedAt: parseInstant(record.generatedAt),
    sourceVersion: /^[0-9a-f]{7,40}$/i.test(text(record.sourceVersion))
      ? text(record.sourceVersion)
      : null,
    sample: {
      configurations: configurationsOf(record).length,
      trials: trialsOf(record).length,
      pairs: pairs.length,
    },
    pairs: pairs.map((pair) => ({
      id: pair.id,
      label: `Pair ${pair.ordinal}`,
      sides: [
        {
          key: "a",
          title: "Take A",
          previewHtml: previewPath(runId, pair.id, "a"),
          previewCss: cssPathFor(previewPath(runId, pair.id, "a")),
        },
        {
          key: "b",
          title: "Take B",
          previewHtml: previewPath(runId, pair.id, "b"),
          previewCss: cssPathFor(previewPath(runId, pair.id, "b")),
        },
      ],
    })),
  };
  assertBlindViewIsClean(view, record);
  return view;
}

/** The server-rendered pre-vote cards. This is a pure function so the blind
 * regression test can render the exact markup the page ships and scan it for
 * every recorded configuration identity. */
export function renderBlindPairGrid(view: BlindView): string {
  const escape = escapeHtml;
  const cards = view.pairs
    .map((pair) => {
      const sides = pair.sides
        .map(
          (side) => `<figure class="cmp-pair-side" data-pair-side="${escape(side.key)}">
  <div class="cmp-browser" data-recorded-preview data-html="${escape(side.previewHtml)}" data-css="${escape(side.previewCss)}">
    <div class="cmp-browser-bar" aria-hidden="true"><span></span><span></span><span></span><code>${escape(side.title)}</code></div>
    <p class="cmp-preview-status small" data-preview-status>Loading the recorded page…</p>
    <div class="cmp-preview" data-preview-canvas></div>
  </div>
  <figcaption><strong>${escape(side.title)}</strong><span class="small">Labels and judge results stay hidden until you record a choice.</span></figcaption>
</figure>`,
        )
        .join("\n");
      return `<article class="cmp-pair" data-pair="${escape(pair.id)}" aria-labelledby="pair-${escape(pair.id)}-title">
  <header class="cmp-pair-head">
    <div>
      <h3 id="pair-${escape(pair.id)}-title">${escape(pair.label)}</h3>
      <p class="small">Two recorded takes. Judge the work, not the name.</p>
    </div>
    <span class="cmp-pair-count">${escape(pair.id.replace(/^p0*/, "Pair "))}</span>
  </header>
  <div class="cmp-pair-sides">${sides}</div>
  <div class="cmp-choice" role="group" aria-label="${escape(pair.label)} choice">
    <button type="button" data-choice="a" aria-pressed="false">A is better</button>
    <button type="button" data-choice="b" aria-pressed="false">B is better</button>
    <button type="button" data-choice="tie" aria-pressed="false">Tie</button>
    <button type="button" data-choice="cant-tell" aria-pressed="false">Can't tell</button>
    <button type="button" class="secondary" data-choice="revealed" aria-pressed="false">Reveal without choosing</button>
  </div>
  <label class="cmp-pair-reason">
    <span class="small">Why, or where it breaks (optional, ${REASON_MAX} characters)</span>
    <input type="text" data-pair-reason maxlength="${REASON_MAX}" placeholder="Short reason" autocomplete="off" />
  </label>
  <p class="cmp-pair-status small" data-pair-status role="status" aria-live="polite"></p>
  <div class="cmp-pair-reveal" data-pair-reveal hidden></div>
</article>`;
    })
    .join("\n");
  return `<div class="cmp-pair-grid" data-pair-grid>${cards}</div>`;
}

/** @param {string} value */
export function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Every recorded identity token the blind state must not contain. */
export function forbiddenIdentityTokens(record: RunRecord): string[] {
  const tokens = new Set<string>();
  const generic = new Set(["unknown", "unrecorded", "not reported", "n/a", "none"]);
  for (const configuration of configurationsOf(record)) {
    for (const value of [
      configuration.id,
      configuration.label,
      configuration.model,
      configuration.resolvedModel,
      configuration.harness,
      configuration.harnessVersion,
    ]) {
      if (typeof value === "string" && value.trim().length >= 3 && !generic.has(value.trim().toLowerCase()))
        tokens.add(value.trim());
    }
    for (const trial of asArray(configuration.trials)) {
      const id = text(asRecord(trial).id);
      if (id.length >= 3 && !generic.has(id.toLowerCase())) tokens.add(id);
    }
  }
  for (const trial of trialsOf(record)) {
    if (trial.previewUrl) tokens.add(trial.previewUrl);
    if (trial.previewUrl) tokens.add(trial.previewUrl.replace(/^https?:\/\/[^/]+/i, ""));
  }
  return [...tokens].filter((token) => !/[<>]/.test(token));
}

/** Throw rather than ship a blind page that names a configuration. */
export function assertBlindViewIsClean(view: BlindView, record: RunRecord): void {
  const serialised = JSON.stringify(view).toLowerCase();
  const found = forbiddenIdentityTokens(record).filter((token) =>
    serialised.includes(token.toLowerCase()),
  );
  if (found.length > 0) {
    throw new Error(`Refusing to render a blind comparison that names a configuration: ${found.join(", ")}`);
  }
  for (const pair of view.pairs) {
    for (const side of pair.sides) {
      if (!side.previewHtml.startsWith("/benchmarks/preview/")) {
        throw new Error("Refusing to render a preview that is not behind the opaque route.");
      }
    }
  }
}

/** The post-vote reveal for one pair, computed from the committed record. */
export function revealPair(record: RunRecord, pairId: string): RevealPair | null {
  const pair = pairFor(record, pairId);
  if (!pair) return null;
  return {
    pairId: pair.id,
    label: `Pair ${pair.ordinal}`,
    sides: [revealSide(record, pair.trialA, "a"), revealSide(record, pair.trialB, "b")],
  };
}

function revealSide(record: RunRecord, trial: RecordedTrial, key: "a" | "b"): RevealSide {
  const configuration = configurationsOf(record).find(
    (entry) => entry.id === trial.configurationId,
  );
  const latencyMs =
    trial.durationMs === null || trial.durationMs === undefined
      ? null
      : Number.isFinite(Number(trial.durationMs))
        ? Number(trial.durationMs)
        : null;
  return {
    key,
    title: key === "a" ? "Take A" : "Take B",
    configurationId: trial.configurationId,
    configurationLabel: trial.configurationLabel,
    trialId: trial.id,
    model: trial.model || "unknown",
    resolvedModel: configuration?.resolvedModel ?? trial.model ?? "unknown",
    provider: configuration?.provider ?? "unknown",
    harness: trial.harness || "unknown",
    harnessVersion: configuration?.harnessVersion ?? "unknown",
    status: trial.status || "unknown",
    durationMs: latencyMs,
    latencyMs,
    failed: Array.isArray(trial.failed) ? trial.failed : [],
    checks: Array.isArray(trial.checks) ? trial.checks : [],
    settings: configuration?.settings ?? {},
    artifact: artifactView(trial.artifact),
    poster: posterView(trial.poster),
    cost: costView(trial.cost),
  };
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function artifactView(raw: unknown): RevealSide["artifact"] {
  if (!raw || typeof raw !== "object") return null;
  const artifact = asRecord(raw);
  if (Object.keys(artifact).length === 0) return null;
  return {
    mime: text(artifact.mime) || "unknown",
    bytes: numberOrNull(artifact.bytes),
    width: numberOrNull(artifact.width),
    height: numberOrNull(artifact.height),
    durationMs: numberOrNull(artifact.durationMs),
    sha256: text(artifact.sha256) || "unknown",
    videoCodec: text(artifact.videoCodec) || null,
    frameRate: text(artifact.frameRate) || null,
    audio: artifact.audio && typeof artifact.audio === "object" ? asRecord(artifact.audio) : null,
  };
}

function posterView(raw: unknown): RevealSide["poster"] {
  if (!raw || typeof raw !== "object") return null;
  const poster = asRecord(raw);
  if (Object.keys(poster).length === 0) return null;
  return {
    mime: text(poster.mime) || "unknown",
    bytes: numberOrNull(poster.bytes),
    sha256: text(poster.sha256) || "unknown",
  };
}

function costView(raw: unknown): RevealSide["cost"] {
  if (!raw || typeof raw !== "object") return null;
  const cost = asRecord(raw);
  if (Object.keys(cost).length === 0) return null;
  return {
    estimateMicro: numberOrNull(cost.estimateMicro),
    providerChargedMicro: numberOrNull(cost.providerChargedMicro),
    basis: text(cost.basis) || "not recorded",
  };
}

/** Read every submission for one run, oldest first. The row's raw browser
 * token never leaves this module: the mapped record carries only its hash. */
export async function listVotes(db: D1Database, runId: string): Promise<VoteRecord[]> {
  const result = await db
    .prepare(
      `SELECT submission_id, run_id, task_id, pair_id, trial_a, trial_b, choice, reason,
              reasons_json, blind, reviewer_label, reviewer_token_hash, created_at, updated_at
       FROM ${VOTE_TABLE}
       WHERE run_id = ?
       ORDER BY created_at ASC, submission_id ASC`,
    )
    .bind(runId)
    .all();
  return (result.results ?? []).map(mapVoteRow);
}

/** Read only the submissions this browser token made, for restoring its own
 * recorded votes. Other browsers' rows are not returned to the blind page. */
export async function listVotesForToken(
  db: D1Database,
  runId: string,
  token: string,
): Promise<VoteRecord[]> {
  const tokenHash = await hashReviewerToken(token);
  const result = await db
    .prepare(
      `SELECT submission_id, run_id, task_id, pair_id, trial_a, trial_b, choice, reason,
              reasons_json, blind, reviewer_label, reviewer_token_hash, created_at, updated_at
       FROM ${VOTE_TABLE}
       WHERE run_id = ? AND reviewer_token_hash = ?
       ORDER BY created_at ASC, submission_id ASC`,
    )
    .bind(runId, tokenHash)
    .all();
  return (result.results ?? []).map(mapVoteRow);
}

function mapVoteRow(row: Record<string, unknown>): VoteRecord {
  return {
    submissionId: text(row.submission_id),
    runId: text(row.run_id),
    taskId: text(row.task_id),
    pairId: text(row.pair_id),
    trialA: text(row.trial_a),
    trialB: text(row.trial_b),
    choice: (VOTE_CHOICES as readonly string[]).includes(text(row.choice))
      ? (text(row.choice) as VoteChoice)
      : "cant-tell",
    reason: text(row.reason),
    reasons: parseReasons(row.reasons_json),
    blind: Number(row.blind) === 1,
    reviewerLabel: text(row.reviewer_label) || "unknown",
    reviewerTokenHash: text(row.reviewer_token_hash),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function parseReasons(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

/** A one-way SHA-256 digest of the browser token. The export, the page and the
 * API publish this hash, never the token itself. */
export async function hashReviewerToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(`composer-benchmark-reviewer-token/v1:${token}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Counts a blind page may see without learning a label or model: one entry
 * per independent submission, oldest first. */
export function pairTallies(votes: VoteRecord[]): PairTally[] {
  const byPair = new Map<string, PairTally>();
  for (const vote of votes) {
    const tally = byPair.get(vote.pairId) ?? { pairId: vote.pairId, submissions: [] };
    tally.submissions.push({
      submissionId: vote.submissionId,
      choice: vote.choice,
      blind: vote.blind,
      createdAt: vote.createdAt,
    });
    byPair.set(vote.pairId, tally);
  }
  for (const tally of byPair.values()) {
    tally.submissions.sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.submissionId.localeCompare(right.submissionId),
    );
  }
  return [...byPair.values()];
}

export function independentTokenCount(votes: VoteRecord[]): number {
  return new Set(votes.map((vote) => vote.reviewerTokenHash).filter(Boolean)).size;
}

/**
 * A vote write must come from the page's own origin. A missing Origin header is
 * a refusal, not an anonymous pass: the only intended writer is the comparison
 * page, and an absent header cannot prove that.
 */
export function voteOriginAllowed(
  suppliedOrigin: string | null | undefined,
  expectedOrigin: string,
): boolean {
  return (
    typeof suppliedOrigin === "string" &&
    suppliedOrigin.length > 0 &&
    suppliedOrigin === expectedOrigin
  );
}

/** Validate untrusted vote input against the committed run and its pairs. */
export function validateVote(record: RunRecord, input: VoteInput): ValidationResult {
  const unknown = Object.keys(input).filter((key) => !VOTE_INPUT_KEYS.has(key));
  if (unknown.length > 0)
    return {
      ok: false,
      failure: {
        status: 400,
        code: "unknown-field",
        error: `Unknown vote field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`,
      },
    };
  const runId = runIdFor(record);
  if (text(input.run) !== runId)
    return { ok: false, failure: { status: 404, code: "unknown-run", error: "That run is not recorded." } };
  const taskId = text(record.task?.id);
  if (!taskId || text(input.task) !== taskId)
    return { ok: false, failure: { status: 400, code: "unknown-task", error: "That task does not belong to the recorded run." } };
  const pairId = text(input.pair);
  const pair = pairFor(record, pairId);
  if (!pair)
    return { ok: false, failure: { status: 400, code: "unknown-pair", error: "That pair is not part of the recorded run." } };
  const choice = text(input.choice);
  if (!(VOTE_CHOICES as readonly string[]).includes(choice))
    return {
      ok: false,
      failure: {
        status: 400,
        code: "invalid-choice",
        error: `Choice must be one of ${VOTE_CHOICES.join(", ")}.`,
      },
    };
  if (input.blind !== undefined && typeof input.blind !== "boolean")
    return {
      ok: false,
      failure: { status: 400, code: "invalid-blind", error: "blind must be a boolean." },
    };
  const reason = normaliseReason(input.reason);
  if (!reason.ok) return { ok: false, failure: reason.failure };
  const reasons = normaliseReasons(input.chips ?? input.reasons);
  if (!reasons.ok) return { ok: false, failure: reasons.failure };
  const reviewer = normaliseReviewer(input.reviewer);
  if (!reviewer.ok) return { ok: false, failure: reviewer.failure };
  const token = normaliseToken(input.token);
  if (!token.ok) return { ok: false, failure: token.failure };
  const blind = choice === "revealed" ? false : input.blind === false ? false : true;
  return {
    ok: true,
    value: {
      runId,
      taskId,
      pairId,
      trialA: pair.trialA.id,
      trialB: pair.trialB.id,
      choice: choice as VoteChoice,
      reason: reason.value,
      reasons: reasons.value,
      blind,
      reviewerLabel: reviewer.value,
      reviewerToken: token.value,
    },
  };
}

function normaliseReason(
  value: unknown,
): { ok: true; value: string } | { ok: false; failure: ValidationFailure } {
  if (value === undefined || value === null) return { ok: true, value: "" };
  if (typeof value !== "string")
    return { ok: false, failure: { status: 400, code: "invalid-reason", error: "Reason must be text." } };
  const reason = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (/[<>]/.test(reason))
    return { ok: false, failure: { status: 400, code: "html-reason", error: "Reason cannot contain HTML." } };
  if (reason.length > REASON_MAX)
    return {
      ok: false,
      failure: { status: 400, code: "long-reason", error: `Reason is longer than ${REASON_MAX} characters.` },
    };
  return { ok: true, value: reason };
}

function normaliseReasons(
  value: unknown,
): { ok: true; value: string[] } | { ok: false; failure: ValidationFailure } {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value))
    return {
      ok: false,
      failure: { status: 400, code: "invalid-reasons", error: "Reason chips must be an array of short strings." },
    };
  if (value.length > REASONS_MAX)
    return {
      ok: false,
      failure: {
        status: 400,
        code: "too-many-reasons",
        error: `At most ${REASONS_MAX} reason chips may be recorded.`,
      },
    };
  const reasons: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string")
      return {
        ok: false,
        failure: { status: 400, code: "invalid-reasons", error: "Every reason chip must be text." },
      };
    const chip = entry
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!chip || chip.length > REASON_CHIP_MAX)
      return {
        ok: false,
        failure: {
          status: 400,
          code: "invalid-reasons",
          error: `Every reason chip must be 1-${REASON_CHIP_MAX} characters.`,
        },
      };
    if (/[<>,]/.test(chip))
      return {
        ok: false,
        failure: {
          status: 400,
          code: "invalid-reasons",
          error: "Reason chips are separate JSON strings: no HTML or commas.",
        },
      };
    if (!reasons.includes(chip)) reasons.push(chip);
  }
  return { ok: true, value: reasons };
}

function normaliseToken(
  value: unknown,
): { ok: true; value: string } | { ok: false; failure: ValidationFailure } {
  if (typeof value !== "string")
    return {
      ok: false,
      failure: {
        status: 400,
        code: "invalid-token",
        error: "A reviewer token is required.",
      },
    };
  const token = value.trim().toLowerCase();
  if (!REVIEWER_TOKEN_PATTERN.test(token))
    return {
      ok: false,
      failure: {
        status: 400,
        code: "invalid-token",
        error: "Reviewer token must be 32-64 hexadecimal characters.",
      },
    };
  return { ok: true, value: token };
}

function normaliseReviewer(
  value: unknown,
): { ok: true; value: string } | { ok: false; failure: ValidationFailure } {
  if (value === undefined || value === null) return { ok: true, value: DEFAULT_REVIEWER_LABEL };
  if (typeof value !== "string")
    return { ok: false, failure: { status: 400, code: "invalid-reviewer", error: "Reviewer label must be text." } };
  const reviewer = value.trim();
  if (!reviewer) return { ok: true, value: DEFAULT_REVIEWER_LABEL };
  if (!REVIEWER_PATTERN.test(reviewer) || reviewer.length > REVIEWER_MAX)
    return {
      ok: false,
      failure: {
        status: 400,
        code: "invalid-reviewer",
        error: `Reviewer label must be 1-${REVIEWER_MAX} letters, numbers, spaces, dots, underscores or hyphens.`,
      },
    };
  if (/[<>]/.test(reviewer))
    return { ok: false, failure: { status: 400, code: "html-reviewer", error: "Reviewer label cannot contain HTML." } };
  return { ok: true, value: reviewer };
}

/**
 * Append one submission. There is no UPDATE and no DELETE: an earlier row, by
 * this browser or any other, is never rewritten. A later submission for a pair
 * this token already revealed is recorded as unblinded, because the labels are
 * already known; it is still a new row.
 */
export async function appendVote(
  db: D1Database,
  vote: ValidatedVote,
  now = new Date(),
): Promise<{ vote: VoteRecord; appended: true }> {
  const tokenHash = await hashReviewerToken(vote.reviewerToken);
  const priorReveal = await db
    .prepare(
      `SELECT 1 AS seen FROM ${VOTE_TABLE}
       WHERE run_id = ? AND pair_id = ? AND reviewer_token_hash = ?
         AND (blind = 0 OR choice = 'revealed')
       LIMIT 1`,
    )
    .bind(vote.runId, vote.pairId, tokenHash)
    .first();
  const blind = vote.choice === "revealed" ? 0 : vote.blind && !priorReveal ? 1 : 0;
  const timestamp = now.toISOString();
  const submissionId = globalThis.crypto.randomUUID();
  const row = await db
    .prepare(
      `INSERT INTO ${VOTE_TABLE}
         (submission_id, run_id, task_id, pair_id, trial_a, trial_b, choice, reason,
          reasons_json, blind, reviewer_label, reviewer_token, reviewer_token_hash,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING submission_id, run_id, task_id, pair_id, trial_a, trial_b, choice,
                 reason, reasons_json, blind, reviewer_label, reviewer_token_hash,
                 created_at, updated_at`,
    )
    .bind(
      submissionId,
      vote.runId,
      vote.taskId,
      vote.pairId,
      vote.trialA,
      vote.trialB,
      vote.choice,
      vote.reason,
      JSON.stringify(vote.reasons),
      blind,
      vote.reviewerLabel,
      vote.reviewerToken,
      tokenHash,
      timestamp,
      timestamp,
    )
    .first();
  if (!row) throw new Error("The benchmark submission was not returned after the insert.");
  return { vote: mapVoteRow(asRecord(row)), appended: true };
}

export type RunEvidence = {
  schema: typeof RUN_EVIDENCE_SCHEMA;
  runId: string;
  record: RunRecord;
  votes: VoteRecord[];
  votesAvailable: boolean;
};

export function buildRunEvidence(
  record: RunRecord,
  votes: VoteRecord[],
  options: { votesAvailable?: boolean } = {},
): RunEvidence {
  return {
    schema: RUN_EVIDENCE_SCHEMA,
    runId: runIdFor(record),
    record,
    votes: sortSubmissions(votes).map(publicVoteRecord),
    votesAvailable: options.votesAvailable !== false,
  };
}

/** Whitelist the published submission fields. This is the boundary that keeps
 * a raw browser token out of an export even if a caller passes a database row. */
export function publicVoteRecord(vote: VoteRecord): VoteRecord {
  const row = vote as VoteRecord & Record<string, unknown>;
  return {
    submissionId: text(row.submissionId) || text(row.submission_id),
    runId: text(row.runId) || text(row.run_id),
    taskId: text(row.taskId) || text(row.task_id),
    pairId: text(row.pairId) || text(row.pair_id),
    trialA: text(row.trialA) || text(row.trial_a),
    trialB: text(row.trialB) || text(row.trial_b),
    choice: (VOTE_CHOICES as readonly string[]).includes(text(row.choice))
      ? (text(row.choice) as VoteChoice)
      : "cant-tell",
    reason: text(row.reason),
    reasons: parseReasons(row.reasons ?? row.reasons_json),
    blind: row.blind === true || Number(row.blind) === 1,
    reviewerLabel: text(row.reviewerLabel) || text(row.reviewer_label) || "unknown",
    reviewerTokenHash: text(row.reviewerTokenHash) || text(row.reviewer_token_hash),
    createdAt: text(row.createdAt) || text(row.created_at),
    updatedAt: text(row.updatedAt) || text(row.updated_at),
  };
}

/** Exports and pages always list submissions oldest first. */
export function sortSubmissions(votes: VoteRecord[]): VoteRecord[] {
  return [...votes].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.submissionId.localeCompare(right.submissionId),
  );
}

export type RunView = {
  runId: string;
  task: {
    id: string;
    title: string;
    version: string;
    category: string;
    capability: string;
    briefSha256: string;
    assertions: { id: string; name: string }[];
  };
  recordedAt: string | null;
  sourceVersion: string | null;
  node: string;
  platform: string;
  sample: {
    configurations: number;
    trials: number;
    usable: number;
    pairs: number;
    recordedPairs: number;
    submissions: number;
    independentTokens: number;
    blindSubmissions: number;
    unblindedSubmissions: number;
  };
  verdict: ReturnType<typeof verdictFor>;
  configurations: {
    id: string;
    label: string;
    model: string;
    resolvedModel: string;
    harness: string;
    harnessVersion: string;
    runnerKind: string;
    settings: Record<string, unknown>;
    summary: ReturnType<typeof summariseConfiguration>;
  }[];
  pairs: {
    id: string;
    label: string;
    sideA: RevealSide;
    sideB: RevealSide;
    submissions: VoteRecord[];
    revealAvailable: boolean;
  }[];
  unmatchedVotes: VoteRecord[];
  failures: { assertion: string; owner: string | null }[];
  provenance: {
    judge: string;
    runner: string;
    recordFile: string;
    sourceVersion: string | null;
    recordedAt: string | null;
    node: string;
    platform: string;
  };
};

const ASSERTION_OWNERS: Record<string, string> = {
  "files-present": "#601 Benchmarks Studio",
  "manifest-schema": "#601 Benchmarks Studio",
  "manifest-content": "#601 Benchmarks Studio",
  "page-shows-brief": "#601 Benchmarks Studio",
  "stylesheet-linked": "#601 Benchmarks Studio",
  "csp-compatible": "#605 Cross-app layout and policy",
  "no-external": "#601 Benchmarks Studio",
  "document-basics": "#605 Cross-app layout and policy",
  "sections-present": "#601 Benchmarks Studio",
};

export function runView(evidence: RunEvidence): RunView {
  const record = evidence.record;
  const configurations = configurationsOf(record);
  const pairs = pairsFor(record);
  const votesByPair = new Map<string, VoteRecord[]>();
  for (const vote of evidence.votes) {
    const list = votesByPair.get(vote.pairId) ?? [];
    list.push(vote);
    votesByPair.set(vote.pairId, list);
  }
  const pairRows = pairs.map((pair) => ({
    id: pair.id,
    label: `Pair ${pair.ordinal}`,
    sideA: revealSide(record, pair.trialA, "a"),
    sideB: revealSide(record, pair.trialB, "b"),
    submissions: (votesByPair.get(pair.id) ?? []).sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.submissionId.localeCompare(right.submissionId),
    ),
    revealAvailable: Boolean(revealPair(record, pair.id)),
  }));
  const knownPairs = new Set(pairs.map((pair) => pair.id));
  const recordedPairSet = new Set(
    evidence.votes.filter((vote) => knownPairs.has(vote.pairId)).map((vote) => vote.pairId),
  );
  const usable = trialsOf(record).filter((trial) => {
    const checks = Array.isArray(trial.checks) ? trial.checks : [];
    return trial.status === "pass" && checks.length > 0 && checks.every((check) => check.status === "pass");
  }).length;
  return {
    runId: runIdFor(record),
    task: {
      id: text(record.task?.id) || "unknown",
      title: text(record.task?.title) || "unknown",
      version: Number.isInteger(record.task?.version) ? String(record.task?.version) : "unknown",
      category: text(record.task?.category) || "unknown",
      capability: text(record.task?.capability) || "unknown",
      briefSha256: text(record.task?.briefSha256) || "unknown",
      assertions: asArray(record.task?.assertions) as { id: string; name: string }[],
    },
    recordedAt: parseInstant(record.generatedAt),
    sourceVersion: /^[0-9a-f]{7,40}$/i.test(text(record.sourceVersion))
      ? text(record.sourceVersion)
      : null,
    node: text(record.node) || "unknown",
    platform: text(record.platform) || "unknown",
    sample: {
      configurations: configurations.length,
      trials: trialsOf(record).length,
      usable,
      pairs: pairs.length,
      recordedPairs: recordedPairSet.size,
      submissions: evidence.votes.filter((vote) => knownPairs.has(vote.pairId)).length,
      independentTokens: independentTokenCount(
        evidence.votes.filter((vote) => knownPairs.has(vote.pairId)),
      ),
      blindSubmissions: evidence.votes.filter((vote) => knownPairs.has(vote.pairId) && vote.blind).length,
      unblindedSubmissions: evidence.votes.filter((vote) => knownPairs.has(vote.pairId) && !vote.blind).length,
    },
    verdict: verdictFor(configurations),
    configurations: configurations.map((configuration) => ({
      id: configuration.id,
      label: configuration.label ?? configuration.id,
      model: configuration.model ?? "unknown",
      resolvedModel: configuration.resolvedModel ?? "unknown",
      harness: configuration.harness ?? "unknown",
      harnessVersion: configuration.harnessVersion ?? "unknown",
      runnerKind: configuration.runnerKind ?? "unknown",
      settings: configuration.settings ?? {},
      summary: summariseConfiguration(configuration),
    })),
    pairs: pairRows,
    unmatchedVotes: evidence.votes.filter((vote) => !knownPairs.has(vote.pairId)),
    failures: routeFailures(configurations, ASSERTION_OWNERS),
    provenance: {
      judge: JUDGE_LABEL,
      runner: RUNNER_LABEL,
      recordFile: "benchmarks/results/compare.json",
      sourceVersion: /^[0-9a-f]{7,40}$/i.test(text(record.sourceVersion))
        ? text(record.sourceVersion)
        : null,
      recordedAt: parseInstant(record.generatedAt),
      node: text(record.node) || "unknown",
      platform: text(record.platform) || "unknown",
    },
  };
}

export function parseInstant(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function choiceLabel(choice: string): string {
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

/** Stable download name for the evidence file. */
export function exportFilename(runId: string): string {
  return `composer-benchmark-run-${runId}.json`;
}

/** Render every side of the mapping without letting a caller ask for an
 * unrecorded trial. Used by the opaque preview route. */
export function previewTrial(
  runId: string,
  pairId: string,
  side: string,
): { trial: RecordedTrial; assetBase: string } | null {
  const found = getRunRecord(runId);
  if (!found) return null;
  const pair = pairFor(found.record, pairId);
  if (!pair) return null;
  const trial = side === "a" ? pair.trialA : side === "b" ? pair.trialB : null;
  if (!trial || !trial.previewUrl) return null;
  return { trial, assetBase: trial.previewUrl };
}

#!/usr/bin/env node
// Bounded, credential-free models.dev intelligence maintenance (#19).
//
// One conditional read per invocation. The command writes a compact state
// record, a retained last-known-good catalogue and an independently
// consumable summary under the chosen directories. It never schedules itself,
// calls a model, writes a GitHub issue or reads a credential.
//
// Exit codes:
//   0  a check ran, was deferred by backoff, or an outage was recorded
//   1  the command's own input or persisted state is unusable
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recipe } from "../lib/get-ready/inspect.mjs";
import {
  MAX_ATTEMPTS,
  MAX_RESPONSE_BYTES,
  MODELS_DEV_URL,
  emptyState,
  freshness,
  modelsDevSummary,
  parseSnapshot,
  parseState,
  refreshModelsDev,
} from "../src/lib/models-dev-adapter.ts";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const configPath = resolve(workspace, "config/models-dev.json");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function flag(name) {
  return process.argv.includes(name);
}
function fail(message) {
  console.error(`models-intelligence: ${message}`);
  process.exit(1);
}
function readJson(path, optional = false) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (optional && error && error.code === "ENOENT") return null;
    throw error;
  }
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n");
  renameSync(temporary, path);
}

const config = readJson(configPath);
if (
  !config ||
  config.contract !== 1 ||
  !Array.isArray(config.selectedProviders) ||
  config.selectedProviders.some(
    (id) => typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id),
  )
)
  fail("config/models-dev.json is missing or invalid.");
if (config.source?.url !== MODELS_DEV_URL)
  fail(`The configured source must stay ${MODELS_DEV_URL}.`);

const output = resolve(workspace, "output/models-dev-intelligence");
const statePath = resolve(argument("--state") ?? `${output}/state.json`);
const snapshotPath = resolve(argument("--snapshot") ?? `${output}/last-known-good.json`);
const summaryPath = resolve(argument("--publish") ?? `${output}/summary.json`);
const fixture = argument("--fixture");
const reset = flag("--reset");
const nowArgument = argument("--now");
const now = nowArgument === undefined ? undefined : Date.parse(nowArgument);
if (now !== undefined && !Number.isFinite(now))
  fail("--now must be an ISO timestamp, for a deterministic controlled drill.");
const selected = argument("--providers")
  ? argument("--providers").split(",").map((id) => id.trim()).filter(Boolean)
  : config.selectedProviders;

let state;
let snapshot;
try {
  state = reset ? emptyState(recipe) : parseState(readJson(statePath, true) ?? emptyState(recipe));
  const retained = reset ? null : readJson(snapshotPath, true);
  snapshot = retained ? parseSnapshot(retained) : null;
} catch (error) {
  fail(
    `The retained store could not be used: ${error instanceof Error ? error.message : error}. Refusing to overwrite it. Inspect the files or start a new store with --reset.`,
  );
}

const fetcher = fixture
  ? async () => {
      const body = readFileSync(resolve(fixture));
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": String(body.byteLength),
        },
      });
    }
  : undefined;

const result = await refreshModelsDev({
  state,
  previous: snapshot,
  ...(fetcher ? { fetcher } : {}),
  ...(now === undefined ? {} : { now }),
  attempts: Math.max(1, Math.min(Number(argument("--attempts") ?? MAX_ATTEMPTS) || MAX_ATTEMPTS, MAX_ATTEMPTS)),
});
writeJson(statePath, result.state);
if (result.snapshot) {
  snapshot = result.snapshot;
  writeJson(snapshotPath, result.snapshot);
}
const summary = modelsDevSummary(result.state, snapshot, selected);
writeJson(summaryPath, summary);

const report = {
  mode: fixture ? "fixture" : "live",
  outcome: result.outcome,
  fetched: result.fetched,
  detail: result.detail,
  freshness: freshness(result.state),
  checkedAt: result.state.lastSuccess?.at ?? null,
  changedAt: result.state.lastChange?.at ?? null,
  materialChangedAt: result.state.lastMaterialChange?.at ?? null,
  upstream: result.state.upstream,
  changes: result.changes?.counts ?? null,
  openIncidents: result.state.incidents.filter((incident) => incident.state === "open").length,
  proposedActions: result.state.actions.length,
  backoffUntil: result.state.outage?.nextAttemptAt ?? null,
  modelCalls: 0,
  issuesWritten: 0,
  statePath,
  snapshotPath,
  summaryPath,
  limits: { bytes: MAX_RESPONSE_BYTES, attempts: MAX_ATTEMPTS },
  recipe: result.state.recipe,
};
console.log(JSON.stringify(report, null, 2));

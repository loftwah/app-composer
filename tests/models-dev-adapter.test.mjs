import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MAX_INCIDENTS,
  MODELS_DEV_URL,
  classifyChanges,
  digest,
  emptyState,
  freshness,
  incidentFingerprint,
  modelsDevSummary,
  parseSnapshot,
  parseState,
  refreshModelsDev,
  validateModelsDev,
} from "../src/lib/models-dev-adapter.ts";

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`./fixtures/models-dev/${name}.json`, import.meta.url)),
      "utf8",
    ),
  );
const recipe = { id: "codex-github-cloudflare-hello-v2", version: 2 };
const T0 = Date.parse("2026-11-08T00:00:00.000Z");
const at = (milliseconds) => new Date(milliseconds).toISOString();

function jsonResponse(value, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function recording(response) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return typeof response === "function" ? response(url, init) : response;
  };
  return { calls, fetcher };
}

const snapshotV1 = () => {
  const result = validateModelsDev(fixture("catalogue-v1"));
  assert.equal(result.ok, true);
  return result.snapshot;
};

async function seeded(now = T0) {
  const body = fixture("catalogue-v1");
  const { fetcher } = recording(
    jsonResponse(body, { headers: { etag: '"fixture-v1"', "last-modified": "Sun, 08 Nov 2026 00:00:00 GMT" } }),
  );
  const result = await refreshModelsDev({
    state: emptyState(recipe),
    previous: null,
    fetcher,
    now,
    attempts: 1,
  });
  assert.equal(result.outcome, "changed");
  assert.ok(result.snapshot);
  return result;
}

test("validates the reviewed catalogue shape and normalizes bounded fields", () => {
  const result = validateModelsDev(fixture("catalogue-v1"));
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.providerCount, 2);
  assert.equal(result.snapshot.modelCount, 3);
  const large = result.snapshot.providers.openai.models["gpt-fixture-large"];
  assert.equal(large.name, "GPT Fixture Large");
  assert.equal(large.status, "stable");
  assert.equal(large.context, 400000);
  assert.equal(large.outputLimit, 128000);
  assert.deepEqual(large.cost, { input: 1.25, output: 10, cacheRead: 0.125 });
  assert.deepEqual(large.modalities, { input: ["text", "image"], output: ["text"] });
});

test("the first validated read retains last-known-good without inventing a material change", async () => {
  const result = await seeded();
  assert.equal(result.state.lastSuccess.status, 200);
  assert.equal(result.state.upstream.etag, '"fixture-v1"');
  assert.equal(result.state.upstream.providers, 2);
  assert.equal(result.state.upstream.models, 3);
  assert.equal(result.state.lastChange.counts.addedModels, 3);
  assert.equal(result.state.lastMaterialChange, null);
  assert.equal(result.state.actions.length, 0);
  assert.equal(result.state.modelCalls, 0);
  assert.equal(result.state.issuesWritten, 0);
  assert.equal(freshness(result.state, T0).state, "fresh");
});

test("a 304 advances checked-at only, sends conditional headers and writes nothing", async () => {
  const first = await seeded();
  const { calls, fetcher } = recording(new Response(null, { status: 304 }));
  const later = T0 + 6 * 60 * 60 * 1000;
  const result = await refreshModelsDev({
    state: first.state,
    previous: first.snapshot,
    fetcher,
    now: later,
    attempts: 1,
  });
  assert.equal(result.outcome, "unchanged");
  assert.equal(result.changes, null);
  assert.equal(result.state.lastSuccess.at, at(later));
  assert.equal(result.state.lastChange.at, at(T0));
  assert.equal(result.state.lastMaterialChange, null);
  assert.equal(result.state.incidents.length, 0);
  assert.equal(result.state.actions.length, 0);
  assert.equal(result.state.issuesWritten, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["If-None-Match"], '"fixture-v1"');
  assert.equal(calls[0].init.headers["If-Modified-Since"], "Sun, 08 Nov 2026 00:00:00 GMT");
  assert.equal(calls[0].init.redirect, "error");
  assert.ok(calls[0].init.signal);
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(freshness(result.state, later).state, "fresh");
});

test("an identical 200 body is unchanged and does not rewrite change history", async () => {
  const first = await seeded();
  const { fetcher } = recording(
    jsonResponse(fixture("catalogue-v1"), { headers: { etag: '"fixture-v1b"' } }),
  );
  const later = T0 + 60 * 60 * 1000;
  const result = await refreshModelsDev({
    state: first.state,
    previous: first.snapshot,
    fetcher,
    now: later,
    attempts: 1,
  });
  assert.equal(result.outcome, "unchanged");
  assert.equal(result.state.lastChange.at, at(T0));
  assert.equal(result.state.lastSuccess.at, at(later));
  assert.equal(result.state.lastSuccess.status, 200);
});

test("an added model is informational and produces no owner action", async () => {
  const first = await seeded();
  const { fetcher } = recording(jsonResponse(fixture("catalogue-added")));
  const result = await refreshModelsDev({
    state: first.state,
    previous: first.snapshot,
    fetcher,
    now: T0 + 24 * 60 * 60 * 1000,
    attempts: 1,
  });
  assert.equal(result.changes.counts.addedModels, 1);
  assert.equal(result.changes.counts.material, 0);
  assert.equal(result.state.lastMaterialChange, null);
  assert.equal(result.state.actions.length, 0);
  assert.equal(result.state.incidents.length, 0);
});

test("changed price, changed limit and a removed model are material and dedupe to one action", async () => {
  const first = await seeded();
  const { fetcher } = recording(jsonResponse(fixture("catalogue-material")));
  const later = T0 + 24 * 60 * 60 * 1000;
  const result = await refreshModelsDev({
    state: first.state,
    previous: first.snapshot,
    fetcher,
    now: later,
    attempts: 1,
  });
  assert.equal(result.changes.counts.material, 2);
  const changed = result.changes.material.find((entry) => entry.model === "gpt-fixture-large");
  assert.deepEqual(changed.fields, ["context", "cost"]);
  assert.equal(result.changes.removedModels[0].model, "gpt-fixture-mini");
  assert.equal(result.state.lastMaterialChange.at, at(later));
  assert.equal(result.state.actions.length, 1);
  assert.equal(result.state.actions[0].issue, 19);
  assert.equal(result.state.actions[0].state, "proposed");
  const fingerprint = result.state.actions[0].fingerprint;

  const second = await refreshModelsDev({
    state: result.state,
    previous: result.snapshot,
    fetcher: async () => jsonResponse(fixture("catalogue-material")),
    now: later + 24 * 60 * 60 * 1000,
    attempts: 1,
  });
  // The content hash is unchanged, so the second read is honestly unchanged.
  assert.equal(second.outcome, "unchanged");
  assert.equal(second.state.actions.length, 1);
  assert.equal(second.state.actions[0].fingerprint, fingerprint);
});

test("a cosmetic rename records a change but no material action", () => {
  const raw = fixture("catalogue-v1");
  raw.openai.models["gpt-fixture-mini"].name = "GPT Fixture mini renamed";
  const next = validateModelsDev(raw);
  assert.equal(next.ok, true);
  const report = classifyChanges(snapshotV1(), next.snapshot);
  assert.equal(report.counts.material, 0);
  assert.equal(report.counts.cosmetic, 1);
  assert.deepEqual(report.cosmetic[0].fields, ["name"]);
});

test("malformed, partial and missing-field payloads are refused whole and keep last-known-good", async () => {
  const first = await seeded();
  for (const name of [
    "catalogue-partial",
    "catalogue-missing-field",
    "catalogue-schema-changed",
    "catalogue-not-object",
  ]) {
    const { fetcher } = recording(jsonResponse(fixture(name)));
    const result = await refreshModelsDev({
      state: { ...first.state, outage: null },
      previous: first.snapshot,
      fetcher,
      now: T0 + 60 * 60 * 1000,
      attempts: 1,
    });
    assert.equal(result.outcome, "schema-invalid", name);
    assert.equal(result.snapshot, null, name);
    assert.equal(result.state.lastSuccess.at, at(T0), name);
    assert.equal(result.state.lastChange.at, at(T0), name);
    assert.equal(result.state.incidents.length, 1, name);
    assert.equal(result.state.incidents[0].state, "open", name);
    assert.equal(result.state.incidents[0].fingerprint.length > 0, true, name);
    const fresh = freshness(result.state, T0 + 60 * 60 * 1000);
    assert.equal(fresh.state, "degraded", name);
    assert.equal(fresh.retained, true, name);
    assert.match(fresh.note, /last-known-good/);
  }
});

test("repeated failures dedupe by source, integration, recipe and signature and back off", async () => {
  const first = await seeded();
  const failure = async (state, now) =>
    refreshModelsDev({
      state,
      previous: first.snapshot,
      fetcher: async () => jsonResponse(fixture("catalogue-partial")),
      now,
      attempts: 1,
    });
  const one = await failure(first.state, T0 + 60 * 60 * 1000);
  const two = await failure(one.state, T0 + 2 * 60 * 60 * 1000);
  assert.equal(one.state.incidents.length, 1);
  assert.equal(two.state.incidents.length, 1);
  assert.equal(two.state.incidents[0].occurrences, 2);
  assert.equal(
    two.state.incidents[0].fingerprint,
    incidentFingerprint("models.dev", "models-dev-api", recipe, "schema-invalid"),
  );
  assert.equal(two.state.outage.failures, 2);
  assert.ok(Date.parse(two.state.outage.nextAttemptAt) > T0 + 2 * 60 * 60 * 1000);

  let requested = false;
  const deferred = await refreshModelsDev({
    state: two.state,
    previous: first.snapshot,
    fetcher: async () => {
      requested = true;
      return jsonResponse(fixture("catalogue-v1"));
    },
    now: T0 + 2 * 60 * 60 * 1000 + 60_000,
    attempts: 1,
  });
  assert.equal(deferred.outcome, "deferred");
  assert.equal(deferred.fetched, false);
  assert.equal(requested, false);
  assert.equal(deferred.state.lastAttempt.outcome, "deferred");
  assert.equal(deferred.state.incidents[0].occurrences, 2);
});

test("oversized declared and streamed bodies are refused before validation", async () => {
  const first = await seeded();
  const declared = new Response("{}", {
    status: 200,
    headers: { "content-length": String(16 * 1024 * 1024 + 1) },
  });
  const one = await refreshModelsDev({
    state: { ...first.state, outage: null },
    previous: first.snapshot,
    fetcher: async () => declared,
    now: T0 + 60 * 60 * 1000,
    attempts: 1,
  });
  assert.equal(one.outcome, "oversized");
  assert.equal(one.state.lastSuccess.at, at(T0));

  const chunks = Array.from({ length: 5 }, () => new Uint8Array(4 * 1024 * 1024));
  const streamed = new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { status: 200 },
  );
  const two = await refreshModelsDev({
    state: { ...first.state, outage: null },
    previous: first.snapshot,
    fetcher: async () => streamed,
    now: T0 + 2 * 60 * 60 * 1000,
    attempts: 1,
  });
  assert.equal(two.outcome, "oversized");
});

test("a timeout is classified, backed off and never reported as a successful check", async () => {
  const first = await seeded();
  const timeout = Object.assign(new Error("The operation timed out."), { name: "TimeoutError" });
  const result = await refreshModelsDev({
    state: { ...first.state, outage: null },
    previous: first.snapshot,
    fetcher: async () => {
      throw timeout;
    },
    now: T0 + 60 * 60 * 1000,
    attempts: 1,
  });
  assert.equal(result.outcome, "timeout");
  assert.equal(result.state.lastSuccess.at, at(T0));
  assert.equal(result.state.incidents[0].signature, "timeout");
  assert.ok(Date.parse(result.state.outage.nextAttemptAt) > T0 + 60 * 60 * 1000);
  const fresh = freshness(result.state, T0 + 60 * 60 * 1000);
  assert.equal(fresh.state, "degraded");
  assert.equal(fresh.checkedAt, at(T0));
});

test("429 honours Retry-After and a later valid read recovers the open incident", async () => {
  const first = await seeded();
  const limited = await refreshModelsDev({
    state: { ...first.state, outage: null },
    previous: first.snapshot,
    fetcher: async () =>
      new Response("slow down", { status: 429, headers: { "retry-after": "120" } }),
    now: T0 + 60 * 60 * 1000,
    attempts: 1,
  });
  assert.equal(limited.outcome, "http-429");
  assert.equal(limited.state.incidents[0].state, "open");
  assert.equal(limited.state.outage.nextAttemptAt, at(T0 + 60 * 60 * 1000 + 120_000));

  const recovered = await refreshModelsDev({
    state: limited.state,
    previous: first.snapshot,
    fetcher: async () => new Response(null, { status: 304 }),
    now: T0 + 60 * 60 * 1000 + 121_000,
    attempts: 1,
  });
  assert.equal(recovered.outcome, "unchanged");
  assert.equal(recovered.state.incidents[0].state, "recovered");
  assert.equal(recovered.state.incidents[0].resolution.requirement, "fetch-and-validate");
  assert.equal(recovered.state.outage, null);
  assert.equal(freshness(recovered.state, T0 + 60 * 60 * 1000 + 121_000).state, "fresh");
});

test("state and retained snapshot round-trip; corrupt state fails closed", async () => {
  const first = await seeded();
  const state = parseState(JSON.parse(JSON.stringify(first.state)));
  assert.deepEqual(state, first.state);
  const snapshot = parseSnapshot(JSON.parse(JSON.stringify(first.snapshot)));
  assert.equal(snapshot.providerCount, 2);
  assert.throws(() => parseState({ version: "composer.models-dev-state/0" }), /Unsupported/);
  assert.throws(() => parseState({ version: "composer.models-dev-state/1" }), /recipe/);
  assert.throws(() => parseSnapshot({ version: "x" }), /Unsupported/);
});

test("the published summary exposes selected providers, bounded fields and honest gaps", async () => {
  const first = await seeded();
  const summary = modelsDevSummary(first.state, first.snapshot, ["openai", "missing-provider"], T0);
  assert.equal(summary.version, "composer.models-dev-summary/1");
  assert.equal(summary.freshness.state, "fresh");
  assert.equal(summary.selected[0].id, "openai");
  assert.equal(summary.selected[0].modelCount, 2);
  assert.equal(summary.selected[0].models[0].cost.input, 1.25);
  assert.equal(summary.selected[0].models.length <= 200, true);
  assert.equal(summary.selected[1].modelCount, 0);
  assert.equal(summary.selected[1].name, "");
  assert.match(summary.note, /not a supported Composer recipe/);
  assert.equal(summary.modelCalls, 0);
  assert.equal(summary.issuesWritten, 0);
  assert.equal(summary.recipe.version, 2);
});

test("an empty state with an active backoff is deferred and never called fresh", async () => {
  const state = emptyState(recipe);
  state.outage = {
    failures: 1,
    signature: "unavailable",
    lastFailureAt: at(T0),
    nextAttemptAt: at(T0 + 15 * 60 * 1000),
  };
  let requested = false;
  const result = await refreshModelsDev({
    state,
    fetcher: async () => {
      requested = true;
      return new Response(null, { status: 304 });
    },
    now: T0 + 60_000,
    attempts: 1,
  });
  assert.equal(result.outcome, "deferred");
  assert.equal(requested, false);
  const fresh = freshness(result.state, T0 + 60_000);
  assert.equal(fresh.state, "never-checked");
  assert.equal(fresh.retained, false);
});

test("the incident ledger is bounded and stable keys do not embed untrusted detail", () => {
  const key = incidentFingerprint("models.dev", "models-dev-api", recipe, "schema-invalid");
  assert.equal(key.includes("http"), false);
  assert.equal(digest(key), digest(key));
  assert.match(key, /^models\.dev\|models-dev-api\|codex-github-cloudflare-hello-v2@2\|schema-invalid$/);
  assert.ok(MAX_INCIDENTS >= 20);
  assert.equal(MODELS_DEV_URL, "https://models.dev/api.json");
});

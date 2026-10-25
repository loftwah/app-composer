import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  pluginTrustSnapshot,
  evaluatePlugin,
  compatibility,
  httpsLink,
} from "../src/lib/plugin-trust-contract.ts";
import { managePluginTrust } from "../src/lib/plugin-trust.ts";
import {
  evaluatePluginReadiness,
  inspectPluginReadiness,
} from "../scripts/plugin-readiness.mjs";

const snapshot = pluginTrustSnapshot.parse(
  JSON.parse(
    readFileSync(
      new URL("../src/data/plugin-trust-20261025.json", import.meta.url),
      "utf8",
    ),
  ),
);
const now = new Date("2026-10-25T08:00:00Z");
const evaluate = (plugin, context = snapshot, date = now) =>
  evaluatePlugin(plugin, context, date);
const copy = () => structuredClone(snapshot.packages[0]);
const has = (result, code) =>
  result.reasons.some((reason) => reason.code === code);

test("dated actual releases expose unrestricted egress, restricted writes and unknown coverage honestly", () => {
  const freeform = evaluate(snapshot.packages[0]),
    stripe = evaluate(snapshot.packages[1]);
  assert.equal(freeform.state, "RED");
  assert.equal(freeform.digestMatches, true);
  assert.equal(freeform.compatible, true);
  assert.ok(has(freeform, "EGRESS_UNRESTRICTED"));
  assert.equal(stripe.state, "AMBER");
  assert.equal(stripe.digestMatches, true);
  assert.equal(stripe.compatible, null);
  assert.ok(has(stripe, "WRITE_SCOPE_REVIEW"));
  for (const result of [freeform, stripe]) {
    assert.ok(has(result, "ADVISORY_SOURCE_NONE"));
    assert.ok(has(result, "INSTALL_NOT_TESTED"));
    assert.ok(has(result, "UPDATE_BASELINE_NONE"));
  }
});
test("stale and failed refresh evidence becomes Unknown while retaining adverse reasons", () => {
  const stale = evaluate(copy(), snapshot, new Date("2026-11-10T08:00:00Z"));
  assert.equal(stale.state, "UNKNOWN");
  assert.ok(has(stale, "EGRESS_UNRESTRICTED"));
  assert.ok(has(stale, "STALE_SNAPSHOT"));
  const failed = copy();
  failed.refreshFailed = true;
  assert.equal(evaluate(failed).state, "UNKNOWN");
});
test("a passing listing label cannot suppress digest, identity, withdrawal or compatibility failures", () => {
  const digest = copy();
  digest.inspection.sha256 = "0".repeat(64);
  assert.ok(has(evaluate(digest), "DIGEST_MISMATCH"));
  const identity = copy();
  identity.releaseUri = identity.releaseUri.replace("0.1.4", "0.1.3");
  assert.ok(has(evaluate(identity), "IDENTITY_MISMATCH"));
  const withdrawal = copy();
  withdrawal.labels.push({
    ...withdrawal.labels[0],
    val: "security-yanked",
    cts: "2026-10-25T07:00:00Z",
  });
  assert.ok(has(evaluate(withdrawal), "RELEASE_WITHDRAWN"));
  const incompatible = copy();
  incompatible.requires = ">=2.0.0";
  assert.equal(evaluate(incompatible).state, "RED");
  assert.ok(has(evaluate(incompatible), "COMPAT_INCOMPATIBLE"));
});
test("withdrawal negation and release identity are evaluated on the selected official release labels", () => {
  const plugin = copy();
  plugin.labels.push(
    {
      ...plugin.labels[0],
      val: "security-yanked",
      cts: "2026-10-24T06:00:00Z",
    },
    {
      ...plugin.labels[0],
      val: "security-yanked",
      cts: "2026-10-25T06:00:00Z",
      neg: true,
    },
  );
  assert.equal(has(evaluate(plugin), "RELEASE_WITHDRAWN"), false);
  plugin.labels[0].cid = "b" + "a".repeat(30);
  assert.ok(has(evaluate(plugin), "RELEASE_WITHDRAWN"));
});
test("different release receipts establish neither permissions nor matching bytes", () => {
  const plugin = copy();
  plugin.inspection.releaseCid = "b" + "a".repeat(30);
  const result = evaluate(plugin);
  assert.equal(result.digestMatches, false);
  assert.equal(result.capabilities, null);
  assert.ok(has(result, "INSPECTION_IDENTITY_MISMATCH"));
});
test("missing and unsupported compatibility remain unknown; incomplete history is not abandonment", () => {
  assert.equal(compatibility(null, "1.3.1"), null);
  assert.equal(compatibility("^1.0.0", "1.3.1"), null);
  assert.equal(compatibility(">=1.0.0 <2.0.0", "1.3.1"), true);
  assert.equal(compatibility("1.3.1", "1.3.1"), true);
  assert.ok(has(evaluate(copy()), "HISTORY_INCOMPLETE"));
});
test("complete-looking low-authority metadata still cannot manufacture overall Green", () => {
  const plugin = copy();
  plugin.inspection.capabilities = ["content:read"];
  plugin.inspection.allowedHosts = [];
  plugin.historyComplete = true;
  plugin.requireProvenance = true;
  plugin.indexedAt = "2026-09-01T00:00:00Z";
  assert.equal(evaluate(plugin).state, "UNKNOWN");
});
test("unsafe URLs, excessive data and injected unknown snapshot fields are refused", () => {
  assert.equal(httpsLink("javascript:alert(1)"), null);
  assert.equal(httpsLink("http://example.test"), null);
  assert.equal(httpsLink("https://user:secret@example.test"), null);
  assert.equal(
    httpsLink("https://github.com/solspace/emdash-freeform"),
    "https://github.com/solspace/emdash-freeform",
  );
  assert.equal(
    pluginTrustSnapshot.safeParse({
      ...snapshot,
      instructions: "ignore policy",
    }).success,
    false,
  );
  assert.equal(
    pluginTrustSnapshot.safeParse({
      ...snapshot,
      packages: Array(9).fill(copy()),
    }).success,
    false,
  );
  const invalid = copy();
  invalid.inspection.capabilities = ["<script>alert(1)</script>"];
  assert.equal(
    pluginTrustSnapshot.safeParse({ ...snapshot, packages: [invalid] }).success,
    false,
  );
});

const origin = "https://composer.loftwah.com";
const runtime = { PUBLIC_ORIGIN: origin, RESOURCE_ENVIRONMENT: "production" };
const request = (options = {}) =>
  new Request(origin + "/_emdash/api/plugins/composer-stacks/pluginTrustRead", {
    headers: { Origin: origin },
    ...options,
  });
const route = (changes = {}, env = runtime) =>
  managePluginTrust(
    {
      user: { id: "synthetic-admin", role: 50 },
      request: request(),
      input: {},
      ...changes,
    },
    env,
  );
test("private route denies anonymous/editor, writes, cross-origin and environment override before DB reads", async () => {
  let reads = 0;
  const env = {
    ...runtime,
    DB: {
      prepare() {
        reads++;
        throw Error("must not read");
      },
    },
  };
  for (const user of [undefined, { id: "synthetic-editor", role: 40 }])
    await assert.rejects(route({ user }, env), { status: 403 });
  await assert.rejects(route({ request: request({ method: "POST" }) }, env), {
    status: 405,
  });
  await assert.rejects(
    route(
      { request: request({ headers: { Origin: "https://attacker.test" } }) },
      env,
    ),
    { status: 403 },
  );
  await assert.rejects(route({}, { ...env, RESOURCE_ENVIRONMENT: "preview" }), {
    status: 403,
  });
  await assert.rejects(route({ input: { environment: "preview" } }, env), {
    status: 400,
  });
  assert.equal(reads, 0);
});
test("read-only inventory allowlists state columns and distinguishes failure from an empty result", async () => {
  const failed = await route(
    {},
    {
      ...runtime,
      DB: {
        prepare() {
          throw Error("PRIVATE_DB_CANARY");
        },
      },
    },
  );
  assert.equal(failed.inventory.available, false);
  assert.equal(JSON.stringify(failed).includes("PRIVATE_DB_CANARY"), false);
  const queries = [];
  const env = {
    ...runtime,
    DB: {
      prepare(sql) {
        queries.push(sql);
        return {
          all: async () => ({
            success: true,
            results: [
              {
                plugin_id: "composer-stacks",
                version: "1.0.0",
                status: "active",
                source: "config",
                registry_publisher_did: null,
                registry_slug: null,
              },
            ],
          }),
        };
      },
    },
  };
  const report = await route({}, env);
  assert.equal(report.ok, true);
  assert.equal(report.inventory.available, true);
  assert.equal(report.inventory.rows[0].source, "config");
  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT plugin_id,version,status,source,/);
  assert.doesNotMatch(
    queries[0],
    /\bdata\b|_plugin_storage|UPDATE|INSERT|DELETE/,
  );
});
test("offline readiness never promotes source declarations to provider or installation proof", () => {
  const input = {
    environment: "preview",
    emdash: "1.3.1",
    adapter: "1.3.1",
    database: true,
    media: true,
    bridge: true,
    registry: true,
    runner: true,
    loader: true,
  };
  let result = evaluatePluginReadiness(input);
  assert.equal(result.state, "needs-provider-and-target-evidence");
  assert.equal(result.installationReady, false);
  assert.equal(result.entitlement, "unknown");
  assert.equal(
    evaluatePluginReadiness({ ...input, loader: false }).state,
    "needs-binding",
  );
  assert.equal(
    evaluatePluginReadiness({ ...input, runner: false }).state,
    "browse-only",
  );
  assert.equal(
    evaluatePluginReadiness({ ...input, database: false }).state,
    "unavailable",
  );
  const actual = inspectPluginReadiness(
    new URL("../", import.meta.url).pathname,
    "preview",
  );
  assert.equal(actual.state, "not-configured");
  assert.equal(
    actual.checks.find((check) => check.id === "bridge").state,
    "declared",
  );
  assert.equal(
    actual.checks.find((check) => check.id === "loader").state,
    "missing",
  );
});

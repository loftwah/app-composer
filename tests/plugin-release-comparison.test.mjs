import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  pluginTrustSnapshot,
  evaluatePlugin,
} from "../src/lib/plugin-trust-contract.ts";
import {
  compareReleaseVersions,
  compareInstalledPlugin,
  comparePluginReleases,
} from "../src/lib/plugin-release-comparison.ts";
const snapshot = pluginTrustSnapshot.parse(
  JSON.parse(
    readFileSync(
      new URL("../src/data/plugin-trust-20261025.json", import.meta.url),
      "utf8",
    ),
  ),
);
const now = new Date("2026-10-25T12:00:00Z");
const plugin = snapshot.packages[0];
const installed = (changes = {}) => ({
  plugin_id: "opaque-registry-id",
  version: "0.1.3",
  status: "active",
  source: "registry",
  registry_publisher_did: plugin.did,
  registry_slug: plugin.slug,
  ...changes,
});

test("canonical numeric comparison is numeric and unsupported releases remain unknown", () => {
  assert.equal(compareReleaseVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareReleaseVersions("1.3.1", "1.3.1"), 0);
  assert.equal(compareReleaseVersions("1.3.1", "2.0.0"), -1);
  for (const invalid of [
    "01.0.0",
    "1.0.0-beta",
    "1.0",
    "9007199254740993.0.0",
    "1.0.0\n",
    "=1.0.0",
  ])
    assert.equal(compareReleaseVersions(invalid, "1.0.0"), null);
});

test("installed source and exact publisher identity govern comparison, never display names", () => {
  assert.equal(
    compareInstalledPlugin(installed({ source: "config" }), snapshot, now)
      .state,
    "native",
  );
  assert.equal(
    compareInstalledPlugin(
      installed({ source: "future-source" }),
      snapshot,
      now,
    ).state,
    "unknown",
  );
  for (const changes of [
    { registry_publisher_did: "did:web:other.test" },
    { registry_slug: "lookalike" },
    { registry_publisher_did: null },
  ]) {
    const result = compareInstalledPlugin(installed(changes), snapshot, now);
    assert.equal(result.state, "unknown");
    assert.equal(result.candidate, null);
  }
  assert.equal(
    compareInstalledPlugin(
      installed(),
      { ...snapshot, packages: [plugin, plugin] },
      now,
    ).state,
    "unknown",
  );
});

test("observed newer release is no automatic update or evidence against the installed release", () => {
  const result = compareInstalledPlugin(installed(), snapshot, now);
  assert.equal(result.state, "newer-observed");
  assert.equal(result.candidate.version, "0.1.4");
  assert.equal(result.candidate.rating, "RED");
  assert.match(
    result.action,
    /do not infer that the installed release is affected/,
  );
  assert.equal(
    compareInstalledPlugin(installed({ version: "0.1.4" }), snapshot, now)
      .state,
    "same-version",
  );
  const ahead = compareInstalledPlugin(
    installed({ version: "0.2.0" }),
    snapshot,
    now,
  );
  assert.equal(ahead.state, "installed-ahead");
  assert.match(ahead.action, /Do not downgrade/);
});

test("stale and failed observations cannot suggest an upgrade", () => {
  assert.equal(
    compareInstalledPlugin(
      installed(),
      snapshot,
      new Date("2026-12-01T00:00:00Z"),
    ).state,
    "stale",
  );
  const failed = structuredClone(snapshot);
  failed.packages[0].refreshFailed = true;
  assert.equal(compareInstalledPlugin(installed(), failed, now).state, "stale");
});

test("manifest and host increases require fresh exact identity and artifact evidence", () => {
  const before = structuredClone(plugin),
    after = structuredClone(plugin);
  before.inspection.capabilities = ["content:read"];
  before.inspection.allowedHosts = ["api.example.test"];
  after.inspection.capabilities = ["content:read", "email:send", "email:send"];
  after.inspection.allowedHosts = ["api.example.test", "other.example.test"];
  assert.deepEqual(comparePluginReleases(before, after, snapshot, now), {
    state: "review-required",
    addedCapabilities: ["email:send"],
    addedHosts: ["other.example.test"],
  });
  const unchanged = comparePluginReleases(before, before, snapshot, now);
  assert.equal(unchanged.state, "no-observed-increase");
  assert.deepEqual(unchanged.addedHosts, []);
  after.did = "did:web:impostor.test";
  assert.equal(
    comparePluginReleases(before, after, snapshot, now).state,
    "identity-mismatch",
  );
  after.did = before.did;
  after.inspection.releaseCid = "b" + "a".repeat(30);
  assert.equal(
    comparePluginReleases(before, after, snapshot, now).state,
    "unknown",
  );
  assert.equal(
    comparePluginReleases(
      before,
      before,
      snapshot,
      new Date("2026-12-01T00:00:00Z"),
    ).state,
    "unknown",
  );
});

test("security and maintenance remain distinct and missing advisories never become green", () => {
  const result = evaluatePlugin(plugin, snapshot, now);
  assert.equal(result.security, "RED");
  assert.equal(result.maintenance, "AMBER");
  assert.equal(result.freshness, "dated");
  const stale = evaluatePlugin(
    plugin,
    snapshot,
    new Date("2026-12-01T00:00:00Z"),
  );
  assert.equal(stale.state, "UNKNOWN");
  assert.equal(stale.security, "RED");
  assert.equal(stale.freshness, "stale");
});

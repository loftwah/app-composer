import test from "node:test";
import assert from "node:assert/strict";
import {
  advisoryOff,
  advisorySignature,
  advisoryUnavailable,
  readAdvisory,
} from "../src/lib/plugin-trust-advisory.ts";
import {
  evaluatePlugin,
  pluginTrustSnapshot,
} from "../src/lib/plugin-trust-contract.ts";
import { diffObservation, reviewItems } from "../src/lib/plugin-trust-watch.ts";

const cid = "b" + "a".repeat(30);
const label = (uri, val, neg = false) => ({
  ver: 1,
  src: "did:web:labels.emdashcms.com",
  uri,
  val,
  cts: "2026-10-20T14:14:34.597Z",
  cid,
  neg,
});
const plugin = (overrides = {}) => ({
  name: "Freeform",
  did: "did:plc:tsp7az5h6qsqjzqsgz37wonx",
  slug: "freeform",
  handle: "solspace.com",
  profileCid: cid,
  profileUri:
    "at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.profile/freeform",
  releaseCid: cid,
  releaseUri:
    "at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.release/freeform:1.0.0",
  version: "1.0.0",
  indexedAt: "2026-10-20T14:14:25.959Z",
  checksum: cid,
  requires: ">=1.0.0",
  historyComplete: true,
  license: "MIT",
  repository: "https://github.com/solspace/emdash-freeform",
  securityContact: true,
  requireProvenance: true,
  labels: [
    label(
      "at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.release/freeform:1.0.0",
      "listing-passed",
    ),
  ],
  refreshFailed: false,
  inspection: {
    observedAt: "2026-10-20T14:14:25.959Z",
    did: "did:plc:tsp7az5h6qsqjzqsgz37wonx",
    slug: "freeform",
    version: "1.0.0",
    releaseCid: cid,
    sha256: "a".repeat(64),
    capabilities: ["content:read"],
    allowedHosts: [],
  },
  ...overrides,
});
const snapshot = (observedAt, packages) =>
  pluginTrustSnapshot.parse({
    schemaVersion: 1,
    policy: "2026-10-25.1",
    observedAt,
    host: { emdash: "1.4.0", cloudflare: "1.4.0", astro: "7.4.7" },
    packages,
  });
const previous = () =>
  snapshot("2026-10-25T06:09:28.960Z", [plugin()]);

const adapter = (result) => ({
  id: "fixture-advisory",
  read: async () => result,
});
const checked = (findings) => ({
  source: "checked",
  adapter: "fixture-advisory",
  checkedAt: "2026-11-08T00:00:00.000Z",
  findings,
  note: "Fixture advisory source.",
});

test("no advisory source is recorded as NONE and never as clean", async () => {
  assert.deepEqual(await readAdvisory(null, { did: "did:plc:x", slug: "freeform", version: "1.0.0" }), advisoryOff);
  const current = previous();
  const evaluated = evaluatePlugin(current.packages[0], current, new Date("2026-11-08T01:00:00Z"));
  assert.ok(evaluated.reasons.some((reason) => reason.code === "ADVISORY_SOURCE_NONE" && reason.state === "UNKNOWN"));
  assert.equal(evaluated.security, "UNKNOWN");
  assert.notEqual(evaluated.state, "GREEN");
});

test("a failed or malformed adapter is UNKNOWN, never clean", async () => {
  const failed = await readAdvisory(
    { id: "fixture-advisory", read: async () => { throw Error("offline"); } },
    { did: "did:plc:x", slug: "freeform", version: "1.0.0" },
    new Date("2026-11-08T00:00:00Z"),
  );
  assert.equal(failed.source, "unknown");
  assert.equal(failed.adapter, "fixture-advisory");
  const malformed = await readAdvisory(
    adapter({...checked([]), extra: "field"}),
    { did: "did:plc:x", slug: "freeform", version: "1.0.0" },
  );
  assert.equal(malformed.source, "unknown");
  const wrongIdentity = await readAdvisory(
    adapter({...checked([]), adapter: "another-source"}),
    { did: "did:plc:x", slug: "freeform", version: "1.0.0" },
  );
  assert.equal(wrongIdentity.source, "unknown");
  const current = snapshot("2026-11-08T00:00:00.000Z", [plugin({ advisory: failed })]);
  const evaluated = evaluatePlugin(current.packages[0], current, new Date("2026-11-08T01:00:00Z"));
  assert.ok(evaluated.reasons.some((reason) => reason.code === "ADVISORY_SOURCE_UNKNOWN" && reason.state === "UNKNOWN"));
  assert.notEqual(evaluated.state, "GREEN");
});

test("a real advisory finding changes the security state by severity", async () => {
  const critical = checked([
    {
      id: "GHSA-aaaa-bbbb-cccc",
      severity: "critical",
      summary: "Fictional critical advisory",
      url: "https://example.test/advisories/GHSA-aaaa-bbbb-cccc",
    },
  ]);
  const current = snapshot("2026-11-08T00:00:00.000Z", [plugin({ advisory: critical })]);
  const evaluated = evaluatePlugin(current.packages[0], current, new Date("2026-11-08T01:00:00Z"));
  assert.ok(evaluated.reasons.some((reason) => reason.code === "ADVISORY_FINDING" && reason.state === "RED"));
  assert.equal(evaluated.security, "RED");
  const moderate = checked([
    {
      id: "GHSA-dddd-eeee-ffff",
      severity: "moderate",
      summary: "Fictional moderate advisory",
      url: null,
    },
  ]);
  const moderateSnapshot = snapshot("2026-11-08T00:00:00.000Z", [plugin({ advisory: moderate })]);
  const moderateEvaluated = evaluatePlugin(moderateSnapshot.packages[0], moderateSnapshot, new Date("2026-11-08T01:00:00Z"));
  assert.ok(moderateEvaluated.reasons.some((reason) => reason.code === "ADVISORY_FINDING" && reason.state === "AMBER"));
});

test("an advisory-state change raises one deduplicated review item", () => {
  const before = previous();
  const unknown = snapshot("2026-11-08T00:00:00.000Z", [
    plugin({
      advisory: advisoryUnavailable("fixture-advisory", "2026-11-08T00:00:00.000Z"),
    }),
  ]);
  const changes = diffObservation(before, unknown)[0].changes.filter(
    (change) => change.code === "ADVISORY_STATE_CHANGED",
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].severity, "review");
  const items = reviewItems(before, unknown);
  assert.equal(items.length, 1);
  assert.equal(items[0].code, "ADVISORY_STATE_CHANGED");
  assert.match(items[0].key, /ADVISORY_STATE_CHANGED:1\.0\.0$/);
  assert.deepEqual(reviewItems(before, unknown).map((item) => item.key), [items[0].key]);

  const findings = checked([
    { id: "GHSA-1", severity: "high", summary: "Fictional", url: null },
    { id: "GHSA-2", severity: "low", summary: "Fictional", url: null },
  ]);
  const changed = snapshot("2026-11-08T00:00:00.000Z", [plugin({ advisory: findings })]);
  const findingItems = reviewItems(before, changed);
  assert.equal(findingItems.length, 1);
  assert.equal(findingItems[0].severity, "block");
  assert.match(findingItems[0].detail, /GHSA-1: high/);
});

test("a checked source with no findings is informational and absent/none are equal", () => {
  assert.equal(advisorySignature({}), "none");
  assert.equal(advisorySignature({ advisory: advisoryOff }), "none");
  const before = previous();
  const clean = snapshot("2026-11-08T00:00:00.000Z", [
    plugin({ advisory: checked([]) }),
  ]);
  const changes = diffObservation(before, clean)[0].changes.filter(
    (change) => change.code === "ADVISORY_STATE_CHANGED",
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].severity, "info");
  assert.deepEqual(reviewItems(before, clean), []);
});

test("the snapshot accepts an explicit advisory state and refuses extra fields", () => {
  const value = plugin({ advisory: advisoryOff });
  assert.doesNotThrow(() => snapshot("2026-11-08T00:00:00.000Z", [value]));
  assert.throws(() =>
    snapshot("2026-11-08T00:00:00.000Z", [
      {...value, advisory: {...advisoryOff, extra: true}},
    ]),
  );
  assert.throws(() =>
    snapshot("2026-11-08T00:00:00.000Z", [
      {...value, advisory: {...advisoryOff, source: "clean"}},
    ]),
  );
});

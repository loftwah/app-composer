import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateDeviceSupport,
  readDeviceSupport,
  deviceAssessment,
  deviceSummary,
  deviceFilterTokens,
  releaseDeviceSupport,
} from "../src/lib/device-support.mjs";
import { validateManifest } from "../scripts/contracts.mjs";
import { validateSpec, handoff } from "../src/lib/spec.mjs";
import { recommendationSpec } from "../src/lib/init-recommendations.mjs";
const evidence = () => ({
  revision: "a".repeat(40),
  checked: "2026-10-24",
  method: "browser-emulation",
  journey: "Open, edit text, export and reopen the fictional drawing.",
});
const checked = () => ({ status: "supported", evidence: evidence() });
const split = () => ({
  version: 1,
  target: "both",
  activities: {
    core: {
      desktop: checked(),
      phone: {
        status: "limited",
        note: "Viewing only; use desktop for edits.",
        evidence: evidence(),
      },
    },
    view: { phone: checked() },
    edit: {
      desktop: checked(),
      phone: { status: "unsupported", note: "Use a desktop to edit." },
    },
  },
});
const old = () => ({
  version: 1,
  preset: "composition",
  config: {
    title: "Fictional corner",
    intro: "Synthetic only",
    theme: "daylight",
    layout: "grid",
  },
  privacy: "review-first",
  cards: [],
  deployment: { mode: "preview" },
  decisions: {},
});
test("old and malformed declarations stay unknown, never become compatible", () => {
  for (const input of [
    undefined,
    null,
    [],
    { version: 2 },
    {
      version: 1,
      target: "both",
      activities: { core: { phone: { status: "supported" } } },
    },
  ]) {
    const support = readDeviceSupport(input);
    assert.equal(deviceSummary(support), "Device support not checked yet");
    assert.equal(deviceFilterTokens(support), "unknown");
    assert.equal(deviceAssessment(support, "tablet").status, "unknown");
  }
});
test("creator intention is independent from source-bound per-device activity checks", () => {
  for (const target of ["desktop", "mobile", "both"]) {
    const support = validateDeviceSupport({
      version: 1,
      target,
      activities: {},
    });
    assert.equal(support.target, target);
    assert.equal(deviceFilterTokens(support), "unknown");
  }
  const support = validateDeviceSupport(split());
  assert.equal(deviceSummary(support), "View on mobile. Edit on desktop.");
  assert.equal(deviceFilterTokens(support), "desktop limited");
  assert.equal(deviceAssessment(support, "tablet", "edit").status, "unknown");
  assert.equal(
    deviceAssessment(support, "phone", "view").evidence.method,
    "browser-emulation",
  );
  assert.equal(
    deviceFilterTokens(readDeviceSupport(split(), "b".repeat(40))),
    "unknown",
  );
  assert.equal(readDeviceSupport(split(), "a".repeat(40)).target, "both");
});
test("strict contract rejects unbounded unsupported and invented positive metadata", () => {
  const badPhone = [
    { status: "supported" },
    { status: "limited", evidence: evidence() },
    { status: "unsupported", note: "" },
    { ...checked(), requirements: ["javascript:run()"] },
    { ...checked(), requirements: ["touch", "touch"] },
    { ...checked(), note: "bad\u0000text" },
    { ...checked(), note: "x".repeat(241) },
    { ...checked(), evidence: { ...evidence(), checked: "2026-02-30" } },
    { ...checked(), evidence: { ...evidence(), method: "screenshot" } },
    { status: "unknown", evidence: evidence() },
  ];
  const invalid = [
    null,
    [],
    { version: 2, target: "both" },
    { version: 1, target: "all", activities: {} },
    { version: 1, target: "both", activities: { execute: {} } },
    { version: 1, target: "both", activities: { core: { watch: checked() } } },
    ...badPhone.map((phone) => ({
      version: 1,
      target: "both",
      activities: { core: { phone } },
    })),
  ];
  const manifest = {
    contract: 1,
    id: "drawing",
    runtime: "static-assets",
    dataVersion: 1,
    routes: ["/drawing"],
    capabilities: [],
  };
  assert.equal(validateManifest(manifest), manifest);
  for (const value of invalid)
    assert.throws(() =>
      validateManifest({ ...manifest, deviceSupport: value }),
    );
  assert.equal(
    validateManifest({ ...manifest, deviceSupport: split() }).deviceSupport
      .target,
    "both",
  );
});
test("portable specs saved roundtrips recommendation changes and handoffs retain device choice", () => {
  assert.equal(validateSpec(old()).deviceTarget, "unknown");
  for (const deviceTarget of ["desktop", "mobile", "both"]) {
    const spec = validateSpec({ ...old(), deviceTarget });
    assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(spec))), spec);
    assert.equal(
      recommendationSpec(spec, "showcase").deviceTarget,
      deviceTarget,
    );
    assert.ok(handoff(spec).includes('"deviceTarget": "' + deviceTarget + '"'));
    assert.match(
      handoff(spec),
      /implementation requirement, not verified support/,
    );
  }
  for (const deviceTarget of [null, {}, "everywhere", "mobile;rm -rf /"])
    assert.throws(() => validateSpec({ ...old(), deviceTarget }));
});
test("discovery and form expose the shared declaration through native controls", () => {
  const apps = readFileSync(
    new URL("../src/pages/apps.astro", import.meta.url),
    "utf8",
  );
  assert.match(apps, /id="app-device"/);
  assert.match(apps, /deviceFilterTokens\(appDeviceSupport\(app.id\)\)/);
  assert.match(apps, /<DeviceSupport support=\{appDeviceSupport\(app.id\)\}/);
  assert.match(
    readFileSync(new URL("../src/pages/init.astro", import.meta.url), "utf8"),
    /name="deviceTarget"/,
  );
  const client = readFileSync(
    new URL("../src/lib/init-client.ts", import.meta.url),
    "utf8",
  );
  assert.match(client, /deviceTarget:value\('deviceTarget'\)/);
  assert.match(client, /deviceTarget:s.deviceTarget/);
  for (const path of [
    "../src/pages/catalogue.astro",
    "../src/pages/catalogue/[slug].astro",
  ])
    assert.match(
      readFileSync(new URL(path, import.meta.url), "utf8"),
      /<DeviceSupport/,
    );
});

test("external release assessments avoid self hashes and reject duplicate, stale and conflicting records", () => {
  const id = "drawing",
    revision = "a".repeat(40),
    support = split(),
    manifest = { version: 1, target: "both", activities: {} };
  const records = { version: 1, releases: [{ id, revision, support }] };
  assert.equal(
    deviceSummary(releaseDeviceSupport(id, revision, manifest, records)),
    "View on mobile. Edit on desktop.",
  );
  for (const input of [
    undefined,
    { version: 2, releases: records.releases },
    { version: 1, releases: [...records.releases, ...records.releases] },
  ]) {
    assert.equal(
      deviceFilterTokens(releaseDeviceSupport(id, revision, manifest, input)),
      "unknown",
    );
  }
  assert.equal(
    deviceFilterTokens(
      releaseDeviceSupport(id, "b".repeat(40), manifest, records),
    ),
    "unknown",
  );
  assert.equal(
    deviceFilterTokens(
      releaseDeviceSupport(
        id,
        revision,
        { ...manifest, target: "desktop" },
        records,
      ),
    ),
    "unknown",
  );
});

test("summary never calls limited support unchecked or hides a separately checked tablet", () => {
  const phone = {
    version: 1,
    target: "both",
    activities: {
      core: {
        desktop: checked(),
        phone: {
          status: "limited",
          note: "Export needs desktop.",
          evidence: evidence(),
        },
      },
    },
  };
  assert.equal(
    deviceSummary(validateDeviceSupport(phone)),
    "Desktop supported · Phone limited",
  );
  const tablet = {
    version: 1,
    target: "mobile",
    activities: { core: { tablet: checked() } },
  };
  assert.equal(
    deviceSummary(validateDeviceSupport(tablet)),
    "Tablet supported",
  );
  assert.equal(deviceFilterTokens(validateDeviceSupport(tablet)), "tablet");
});

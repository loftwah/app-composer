import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COST_UNKNOWN,
  STALE_AFTER_HOURS,
  allowedProviderPath,
  assertProviderGet,
  compareProviderInventory,
  compareTags,
  formatCost,
  normaliseTags,
  observationLabel,
  providerListPath,
  providerCountsLine,
  readProviderInventory,
  readProviderJson,
  redactProviderMessage,
  redactProviderText,
} from "../src/lib/provider-inventory.mjs";
import {
  EXPECTED_ACCOUNT,
  FIRST_PARTY_WORKERS,
  expectedProviderInventory,
} from "../src/lib/provider-expected.ts";
import { buildProviderCheck } from "../src/lib/provider-inventory-check.ts";
import { providerCheck } from "../src/lib/provider-inventory-contract.ts";
import { manageProviderInventory } from "../src/lib/provider-read.ts";
import { fixture, origin, user } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";

const ACCOUNT = EXPECTED_ACCOUNT;
const NOW = Date.parse("2026-10-25T05:00:00.000Z");
const REVISION = "a".repeat(40);
const PREVIEW_REVISION = "b".repeat(40);
const expected = expectedProviderInventory({ revision: REVISION });
const pinnedGuestbook =
  "composer-guestbook-" + expected.composition.id.slice(0, 16);
const pinnedShowcase =
  "composer-showcase-" + expected.composition.id.slice(0, 16);

const json = (result, status = 200) =>
  new Response(
    JSON.stringify({ success: true, result, errors: [], messages: [] }),
    { status, headers: { "Content-Type": "application/json" } },
  );
const denied = (status = 403, message = "Authentication error") =>
  new Response(
    JSON.stringify({
      success: false,
      result: null,
      errors: [{ code: 1000, message }],
      messages: [],
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );

const workerRow = (id, tags = [], modified = "2026-10-24T16:23:20.000Z") => ({
  id,
  tag: "tag-" + id.slice(0, 8),
  tags,
  created_on: "2026-10-13T04:20:07.000Z",
  modified_on: modified,
  deployment_id: "",
  compatibility_date: "2026-10-13",
  routes: [],
});

const workers = [
  workerRow("app-composer", ["cf:service=app-composer"]),
  workerRow("app-composer-preview", []),
  workerRow(pinnedGuestbook, []),
  workerRow(pinnedShowcase, []),
  ...FIRST_PARTY_WORKERS.map((worker) => workerRow(worker.name, [])),
  workerRow("composer-guestbook-deadbeefdeadbeef", []),
  workerRow("composer-showcase-deadbeefdeadbeef", []),
  workerRow("composer-owned-reference", []),
  workerRow("asset-hunter", []),
];

const settings = {
  placement: {},
  compatibility_date: "2026-10-13",
  compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
  tags: ["cf:service=app-composer"],
  limits: { cpu_ms: 1000 },
  observability: { enabled: true, head_sampling_rate: 0.1 },
  bindings: [
    {
      name: "DB",
      type: "d1",
      database_id: "1b2b29c8-4109-4a5f-901a-befc91173bc5",
    },
    { name: "MEDIA", type: "r2_bucket", bucket_name: "app-composer-media" },
    {
      name: "SESSION",
      type: "kv_namespace",
      namespace_id: "3a76800194064e498949fd7c251af7e3",
    },
    {
      name: "GUESTBOOK",
      type: "service",
      service: pinnedGuestbook,
      environment: "production",
    },
    {
      name: "GUESTBOOK_MEMBERS",
      type: "service",
      service: pinnedGuestbook,
      environment: "production",
      entrypoint: "GuestbookMemberService",
    },
    {
      name: "SHOWCASE",
      type: "service",
      service: pinnedShowcase,
      environment: "production",
    },
  ],
};
const previewSettings = {
  placement: {},
  compatibility_date: "2026-10-13",
  compatibility_flags: ["nodejs_compat"],
  tags: [],
  limits: { cpu_ms: 1000 },
  observability: { enabled: true, head_sampling_rate: 0.1 },
  bindings: [],
};

function deployment(message, version = "version-" + message.slice(0, 6)) {
  return {
    deployments: [
      {
        id: "deployment-" + message.slice(0, 6),
        created_on: "2026-10-24T16:23:18.000Z",
        annotations: { "workers/message": message },
        versions: [{ version_id: version, percentage: 100 }],
      },
    ],
  };
}

function providerFetch(calls = { n: 0 }) {
  return async (url) => {
    calls.n++;
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/client\/v4/, "");
    if (path === `/accounts/${ACCOUNT}/workers/scripts`) return json(workers);
    if (path === `/accounts/${ACCOUNT}/workers/domains`)
      return json([
        {
          hostname: "composer.loftwah.com",
          service: "app-composer",
          environment: "production",
          enabled: true,
          previews_enabled: false,
        },
        {
          hostname: "guestbook.loftwah.com",
          service: "composer-guestbook",
          environment: "production",
          enabled: true,
          previews_enabled: false,
        },
        {
          hostname: "showcase.loftwah.com",
          service: "composer-showcase",
          environment: "production",
          enabled: true,
          previews_enabled: false,
        },
        ...["ready", "ai", "share", "ldraw", "paperwork"].map((hostname) => ({
          hostname: hostname + ".loftwah.com",
          service:
            hostname === "ready"
              ? "composer-hello"
              : hostname === "ai"
                ? "composer-state"
                : hostname === "share"
                  ? "composer-linkcheck"
                  : hostname === "ldraw"
                    ? "composer-ldraw"
                    : "composer-paperwork",
          environment: "production",
          enabled: true,
          previews_enabled: false,
        })),
      ]);
    if (path === `/accounts/${ACCOUNT}/d1/database`)
      return json([
        {
          uuid: "1b2b29c8-4109-4a5f-901a-befc91173bc5",
          name: "app-composer-emdash",
          num_tables: 0,
          file_size: 2203648,
        },
        {
          uuid: "bdbbe1c4-e1ff-43d3-a89d-d7dd76d13c0a",
          name: "app-composer-emdash-preview",
          num_tables: 0,
          file_size: 1429504,
        },
        {
          uuid: "1b7862f8-35ca-46cc-a37d-e21142f81e21",
          name: "composer-guestbook",
          num_tables: 0,
          file_size: 204800,
        },
        {
          uuid: "c366203f-d880-4afc-a78e-d3e607146469",
          name: "composer-showcase",
          num_tables: 0,
          file_size: 90112,
        },
      ]);
    if (path === `/accounts/${ACCOUNT}/r2/buckets`)
      return json({
        buckets: [
          {
            name: "app-composer-media",
            creation_date: "2026-10-13T03:46:01.886Z",
          },
          {
            name: "app-composer-media-preview",
            creation_date: "2026-10-13T03:46:04.585Z",
          },
          {
            name: "composer-guestbook-photos",
            creation_date: "2026-10-13T03:59:26.000Z",
          },
        ],
      });
    if (path === `/accounts/${ACCOUNT}/storage/kv/namespaces`)
      return json([
        {
          id: "3a76800194064e498949fd7c251af7e3",
          title: "app-composer-sessions",
          supports_url_encoding: true,
        },
        {
          id: "2e7ac1e5417f4425be41d60d99a35de1",
          title: "app-composer-preview-sessions",
          supports_url_encoding: true,
        },
      ]);
    if (
      path ===
      `/accounts/${ACCOUNT}/d1/database/1b2b29c8-4109-4a5f-901a-befc91173bc5`
    )
      return json({
        uuid: "1b2b29c8-4109-4a5f-901a-befc91173bc5",
        name: "app-composer-emdash",
        num_tables: 103,
        file_size: 2203648,
        running_in_region: "OC",
      });
    if (
      path ===
      `/accounts/${ACCOUNT}/d1/database/bdbbe1c4-e1ff-43d3-a89d-d7dd76d13c0a`
    )
      return json({
        uuid: "bdbbe1c4-e1ff-43d3-a89d-d7dd76d13c0a",
        name: "app-composer-emdash-preview",
        num_tables: 75,
        file_size: 1429504,
        running_in_region: "OC",
      });
    const workerMatch =
      /\/workers\/scripts\/([^/]+)\/(tags|deployments|settings|schedules)$/.exec(
        path,
      );
    if (workerMatch) {
      const name = decodeURIComponent(workerMatch[1]);
      const action = workerMatch[2];
      if (action === "tags") {
        const row = workers.find((worker) => worker.id === name);
        return json(row?.tags ?? []);
      }
      if (action === "deployments") {
        if (name === "app-composer")
          return json(deployment("App Composer " + REVISION, "version-root"));
        if (name === "app-composer-preview")
          return json(
            deployment(
              "Secret-publication preview " + PREVIEW_REVISION,
              "version-preview",
            ),
          );
        if (name === pinnedGuestbook || name === pinnedShowcase)
          return json(
            deployment(
              "Pinned composition " + expected.composition.id,
              "version-pinned-" + name.slice(0, 10),
            ),
          );
        const annotation = {
          "composer-linkcheck": "Link Check ",
          "composer-ldraw": "LDraw ",
          "composer-paperwork": "Paperwork ",
          "composer-launch-kit": "Launch Kit ",
        }[name];
        return json(
          deployment(
            annotation ? annotation + "a".repeat(40) : "First-party " + name,
            "version-" + name,
          ),
        );
      }
      if (action === "settings")
        return json(name === "app-composer" ? settings : previewSettings);
      if (action === "schedules")
        return json({
          schedules:
            name === "app-composer"
              ? [{ cron: "* * * * *", created_on: "2026-10-13T04:28:47Z" }]
              : [],
        });
    }
    return new Response(null, { status: 404 });
  };
}

const readOptions = (request) => ({
  token: "fixture-read-token",
  account: ACCOUNT,
  request,
  now: () => NOW,
  workerHints: expected.workerHints,
  databaseHints: expected.databaseHints,
  workerNames: expected.workerNames,
  databaseIds: expected.databaseIds,
  settingsFor: expected.settingsFor,
  schedulesFor: expected.schedulesFor,
});

const matches = (comparison, name) =>
  comparison.comparisons.find((item) => item.name === name);

test("only explicit GET paths are permitted and a non-GET request is refused before fetch", async () => {
  assert.equal(
    allowedProviderPath(`/accounts/${ACCOUNT}/workers/scripts`),
    true,
  );
  assert.equal(
    allowedProviderPath(
      `/accounts/${ACCOUNT}/workers/scripts/app-composer/tags`,
    ),
    true,
  );
  assert.equal(
    allowedProviderPath(
      `/accounts/${ACCOUNT}/workers/scripts/app-composer/content`,
    ),
    false,
  );
  assert.equal(allowedProviderPath(`/accounts/${ACCOUNT}/tags`), false);
  assert.equal(
    allowedProviderPath(`/accounts/${ACCOUNT}/workers/scripts/../../tags`),
    false,
  );
  assert.throws(
    () => providerListPath(ACCOUNT, "/workers/scripts", 0, 50),
    /page/i,
  );
  assert.throws(
    () => providerListPath(ACCOUNT, "/workers/scripts", 1, 500),
    /page size/i,
  );
  assert.throws(() => assertProviderGet("POST"), /only permits GET/i);
  let calls = 0;
  await assert.rejects(
    () =>
      readProviderJson(
        async () => {
          calls++;
          return json([]);
        },
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts`,
        "fixture-token",
        1000,
        "POST",
      ),
    /only permits GET/i,
  );
  assert.equal(calls, 0);

  await assert.rejects(
    () =>
      readProviderJson(
        async () =>
          new Response("x".repeat(2_000_001), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts`,
        "fixture-token",
        1000,
      ),
    /read limit/i,
  );
  await assert.rejects(
    () =>
      readProviderJson(
        async () =>
          new Response("not json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts`,
        "fixture-token",
        1000,
      ),
    /not valid JSON/i,
  );
});

test("provider text is redacted, times are labelled and an unknown cost is never zero", () => {
  const redacted = redactProviderText(
    "Bearer abc.def token=sekret owner@example.com " + ACCOUNT,
  );
  assert.doesNotMatch(redacted, /abc\.def|sekret|owner@example\.com/);
  assert.match(redacted, /\[redacted\]/);
  assert.match(redacted, /\[email\]/);
  assert.match(redacted, /\[id\]/);
  assert.equal(redactProviderMessage("a".repeat(64)).redacted, true);
  assert.deepEqual(observationLabel("2026-10-25T06:12:00.000Z"), {
    utc: "2026/10/25 06:12 UTC",
    melbourne: "2026/10/25 17:12 AEDT",
  });
  assert.equal(formatCost(COST_UNKNOWN), "Unknown");
  assert.equal(formatCost(null), "Unknown");
  assert.notEqual(formatCost(COST_UNKNOWN), "0");
  assert.deepEqual(normaliseTags(["cf:service=app-composer"]), [
    { key: "cf:service", value: "app-composer" },
  ]);
  assert.equal(normaliseTags("not-an-array"), null);
});

test("the read normalises Worker, D1, R2 and KV observations with honest states", async () => {
  const calls = { n: 0 };
  const snapshot = await readProviderInventory(
    readOptions(providerFetch(calls)),
  );
  assert.equal(snapshot.state, "verified");
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.account, ACCOUNT);
  assert.equal(snapshot.scope, "composer");
  assert.equal(snapshot.unrelatedResources, 1);
  assert.equal(snapshot.resources.length, 24);
  assert.equal(new Set(snapshot.resources.map((item) => item.id)).size, 24);
  assert.ok(
    !snapshot.resources.some((resource) => resource.name === "asset-hunter"),
  );
  assert.equal(snapshot.observation.utc, "2026/10/25 05:00 UTC");
  assert.equal(snapshot.observation.melbourne, "2026/10/25 16:00 AEDT");
  assert.equal(snapshot.cost, COST_UNKNOWN);
  assert.equal(snapshot.redactions, 0);
  assert.ok(snapshot.endpoints.length > 10 && snapshot.endpoints.length <= 48);
  assert.ok(snapshot.endpoints.every((endpoint) => endpoint.method === "GET"));

  const root = snapshot.resources.find(
    (resource) => resource.name === "app-composer",
  );
  assert.equal(root.kind, "worker");
  assert.equal(root.facts.versionId, "version-root");
  assert.equal(root.facts.deploymentMessage, "App Composer " + REVISION);
  assert.deepEqual(root.facts.schedules, ["* * * * *"]);
  assert.deepEqual(root.facts.domains, ["composer.loftwah.com"]);
  assert.equal(root.facts.bindings.length, 6);
  assert.equal(root.facts.cpuMs, 1000);
  assert.equal(root.facts.observabilityEnabled, true);
  assert.equal(root.facts.observabilitySampling, 0.1);
  assert.deepEqual(root.tags, [{ key: "cf:service", value: "app-composer" }]);

  const database = snapshot.resources.find(
    (resource) => resource.name === "app-composer-emdash",
  );
  assert.equal(database.facts.tables, 103);
  assert.equal(database.facts.listTables, 0);
  assert.ok(
    snapshot.limitations.some((line) =>
      line.includes("D1 list endpoint reported 0 table(s)"),
    ),
  );
  assert.equal(
    snapshot.resources.find(
      (resource) => resource.name === "app-composer-media",
    ).facts.location,
    null,
  );
  assert.equal(
    snapshot.resources.find(
      (resource) => resource.name === "app-composer-preview-sessions",
    ).environment,
    "preview",
  );
});

test("drift comparison distinguishes match, drift, missing, unverified, stale and inaccessible", async () => {
  const snapshot = await readProviderInventory(readOptions(providerFetch()));
  const comparison = compareProviderInventory(expected, snapshot, NOW);
  assert.equal(matches(comparison, "app-composer").state, "match");
  assert.equal(matches(comparison, pinnedGuestbook).state, "match");
  assert.equal(matches(comparison, "composer-hello").state, "match");
  assert.equal(comparison.counts.match, 21);
  assert.equal(comparison.counts.unverified, 0);
  assert.equal(comparison.counts.declaredObserved, 21);
  assert.equal(comparison.counts.untracked, undefined);
  assert.equal(comparison.counts.undeclared, 3);
  assert.equal(comparison.counts.undeclaredWorkers, 3);
  assert.equal(comparison.counts.undeclaredEarlier, 2);
  assert.equal(comparison.counts.undeclaredOther, 1);
  assert.equal(comparison.counts.undeclaredStorage, 0);
  assert.equal(comparison.undeclared.workers.earlierCompositions.length, 2);
  assert.equal(comparison.undeclared.workers.otherComposerWorkers.length, 1);
  assert.equal(comparison.undeclared.unrelatedResources, 1);
  assert.equal(comparison.counts.unrelated, 1);

  const drift = structuredClone(snapshot);
  drift.resources.find(
    (resource) => resource.name === "app-composer",
  ).facts.compatibilityDate = "2026-01-01";
  const drifted = compareProviderInventory(expected, drift, NOW);
  assert.equal(matches(drifted, "app-composer").state, "drift");
  assert.equal(
    matches(drifted, "app-composer").changes[0].field,
    "compatibilityDate",
  );

  const missing = structuredClone(snapshot);
  missing.resources = missing.resources.filter(
    (resource) => resource.name !== "app-composer-preview-sessions",
  );
  assert.equal(
    matches(
      compareProviderInventory(expected, missing, NOW),
      "app-composer-preview-sessions",
    ).state,
    "unverified",
  );

  const unverified = structuredClone(snapshot);
  unverified.resources.find(
    (resource) => resource.name === "app-composer",
  ).facts.deploymentRead = false;
  assert.equal(
    matches(compareProviderInventory(expected, unverified, NOW), "app-composer")
      .state,
    "unverified",
  );

  const stale = structuredClone(snapshot);
  stale.resources.find(
    (resource) => resource.name === "app-composer",
  ).observedAt = new Date(
    NOW - (STALE_AFTER_HOURS + 1) * 3600000,
  ).toISOString();
  assert.equal(
    matches(compareProviderInventory(expected, stale, NOW), "app-composer")
      .state,
    "stale",
  );

  const inaccessible = structuredClone(snapshot);
  inaccessible.resources = inaccessible.resources.filter(
    (resource) => resource.name !== "composer-hello",
  );
  inaccessible.endpoints.push({
    path: `/accounts/${ACCOUNT}/workers/scripts?per_page=50&page=1`,
    method: "GET",
    state: "inaccessible",
    status: 403,
    message: "denied",
    at: new Date(NOW).toISOString(),
  });
  inaccessible.lists.worker = "refused";
  assert.equal(
    matches(
      compareProviderInventory(expected, inaccessible, NOW),
      "composer-hello",
    ).state,
    "inaccessible",
  );
});

test("the summary reconciles declared, observed and undeclared resources without hiding storage", async () => {
  const snapshot = await readProviderInventory(readOptions(providerFetch()));
  const comparison = compareProviderInventory(expected, snapshot, NOW);
  const counts = comparison.counts;
  assert.equal(
    counts.declaredObserved + counts.undeclared,
    counts.observed,
    "declared observations and undeclared resources must partition the in-scope observations",
  );
  assert.equal(
    counts.match +
      counts.drift +
      counts.missing +
      counts.unverified +
      counts.inaccessible,
    counts.expected,
    "comparison states must partition the declared resources",
  );
  assert.equal(
    counts.undeclared,
    counts.undeclaredWorkers + counts.undeclaredStorage,
  );
  assert.equal(
    counts.undeclaredWorkers,
    counts.undeclaredEarlier + counts.undeclaredOther,
  );
  assert.equal(comparison.undeclared.unrelatedResources, 1);
  assert.equal(counts.unrelated, 1);

  const withStorage = structuredClone(snapshot);
  withStorage.resources.push(
    {
      kind: "d1",
      id: "00000000-0000-4000-8000-000000000001",
      name: "composer-extra-db",
      environment: "unverified",
      state: "unverified",
      createdOn: null,
      modifiedOn: null,
      observedAt: new Date(NOW).toISOString(),
      tags: null,
      tagState: "unverified",
      facts: {},
      cost: COST_UNKNOWN,
    },
    {
      kind: "r2",
      id: "composer-extra-media",
      name: "composer-extra-media",
      environment: "unverified",
      state: "verified",
      createdOn: null,
      modifiedOn: null,
      observedAt: new Date(NOW).toISOString(),
      tags: null,
      tagState: "unverified",
      facts: {},
      cost: COST_UNKNOWN,
    },
  );
  const storage = compareProviderInventory(expected, withStorage, NOW);
  assert.equal(storage.counts.undeclaredStorage, 2);
  assert.equal(storage.counts.undeclaredWorkers, 3);
  assert.equal(storage.counts.undeclared, 5);
  assert.deepEqual(storage.undeclared.storage.d1, ["composer-extra-db"]);
  assert.deepEqual(storage.undeclared.storage.r2, ["composer-extra-media"]);
  assert.equal(
    storage.counts.declaredObserved + storage.counts.undeclared,
    storage.counts.observed,
  );
  assert.match(providerCountsLine(comparison), /not declared \(3 Worker/);
});

test("first-party identity needs a recorded provider signal, never a name alone", async () => {
  const snapshot = await readProviderInventory(readOptions(providerFetch()));
  const full = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    }),
  );
  assert.equal(full.counts.identityVerified, 8);
  assert.equal(full.counts.identityUnknown, 0);
  const guestbook = full.identities.find(
    (identity) => identity.worker === "composer-guestbook",
  );
  assert.equal(guestbook.status, "verified");
  assert.ok(
    guestbook.evidence.some(
      (item) =>
        item.kind === "committed-manifest" &&
        item.source.endsWith("/wrangler.jsonc"),
    ),
  );
  assert.ok(guestbook.evidence.some((item) => item.kind === "release-receipt"));

  const noRoute = structuredClone(snapshot);
  for (const resource of noRoute.resources) {
    if (resource.kind !== "worker" || !resource.facts) continue;
    resource.facts.domainsRead = false;
    resource.facts.domains = [];
  }
  const unread = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot: noRoute,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    }),
  );
  assert.equal(unread.counts.identityUnknown, 4);
  assert.equal(unread.counts.identityVerified, 4);
  assert.equal(
    unread.identities.find((item) => item.worker === "composer-guestbook")
      .status,
    "unknown",
  );
  assert.match(
    unread.identities.find((item) => item.worker === "composer-guestbook")
      .statusNote,
    /name or tag alone is not identity/i,
  );
  assert.ok(
    unread.findings.some((finding) => finding.code === "identity-unverified"),
  );

  const noAnnotation = structuredClone(noRoute);
  for (const resource of noAnnotation.resources) {
    if (resource.kind !== "worker" || !resource.facts) continue;
    resource.facts.deploymentRead = true;
    resource.facts.deploymentMessage = null;
  }
  const namesOnly = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot: noAnnotation,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    }),
  );
  assert.equal(namesOnly.counts.identityVerified, 0);
  assert.equal(namesOnly.counts.identityUnknown, 8);

  const drift = structuredClone(snapshot);
  drift.resources.find(
    (resource) => resource.name === "composer-hello",
  ).facts.domains = ["elsewhere.example.com"];
  const drifted = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot: drift,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    }),
  );
  assert.equal(drifted.counts.drift, 1);
  assert.equal(drifted.counts.identityDrift, 1);
  assert.equal(
    drifted.identities.find((item) => item.worker === "composer-hello").status,
    "drift",
  );
  assert.ok(
    drifted.findings.some((finding) => finding.code === "expected-drift"),
  );
});

test("a detail read that a bound skipped is unread, not refused", async () => {
  const snapshot = await readProviderInventory({
    ...readOptions(providerFetch()),
    maxRequests: 7,
  });
  assert.equal(snapshot.state, "partial");
  assert.equal(snapshot.lists.worker, "read");
  assert.equal(snapshot.detail.refused, 0);
  assert.ok(snapshot.detail.unread > 0);
  assert.equal(
    snapshot.detail.read + snapshot.detail.refused + snapshot.detail.unread,
    snapshot.detail.requested,
  );
  const tags = snapshot.resources.filter(
    (resource) => resource.kind === "worker" && resource.tagState === "unread",
  );
  assert.equal(tags.length, 12);
  assert.equal(
    snapshot.resources.some((resource) => resource.tagState === "inaccessible"),
    false,
  );
  assert.ok(
    snapshot.limitations.some((line) =>
      /not attempted because the request or overall time bound/i.test(line),
    ),
  );
  const check = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    }),
  );
  // The route read still confirms seven first-party identities. Only the
  // launch kit, whose evidence is its deployment annotation, stays unknown.
  assert.equal(check.counts.identityVerified, 7);
  assert.equal(check.counts.identityUnknown, 1);
  assert.equal(
    check.identities.find((item) => item.worker === "composer-launch-kit")
      .status,
    "unknown",
  );
  assert.equal(
    check.comparisons.filter((item) => item.state === "drift").length,
    0,
  );
});

test("page and request bounds stop the read and keep unread resources unverified", async () => {
  const pageFetch = async (url) => {
    const parsed = new URL(url);
    if (
      parsed.pathname.replace(/^\/client\/v4/, "") ===
      `/accounts/${ACCOUNT}/workers/scripts`
    ) {
      const page = Number(parsed.searchParams.get("page") ?? "1");
      return json([
        workerRow("composer-page-worker-" + page + "a", []),
        workerRow("composer-page-worker-" + page + "b", []),
      ]);
    }
    if (path.endsWith("/d1/database")) return json([]);
    if (path.endsWith("/r2/buckets")) return json({ buckets: [] });
    if (path.endsWith("/storage/kv/namespaces")) return json([]);
    return new Response(null, { status: 404 });
  };
  const bounded = await readProviderInventory({
    ...readOptions(pageFetch),
    maxPages: 2,
    perPage: 2,
  });
  assert.equal(bounded.workersAtLimit, true);
  assert.equal(bounded.state, "partial");
  assert.equal(
    bounded.endpoints.filter((endpoint) =>
      endpoint.path.includes("/workers/scripts"),
    ).length,
    2,
  );
  assert.equal(
    bounded.resources.filter((item) => item.kind === "worker").length,
    4,
  );

  const requests = await readProviderInventory({
    ...readOptions(providerFetch()),
    maxRequests: 1,
  });
  assert.equal(requests.endpoints.length, 1);
  assert.ok(
    requests.limitations.some((line) =>
      /request or overall time bound|request or time bound/i.test(line),
    ),
  );
  assert.equal(requests.detail.unread > 0, true);
  assert.equal(requests.lists.worker, "read");
  assert.equal(requests.lists.d1, "unread");
  assert.equal(requests.lists.r2, "unread");
  assert.equal(requests.lists.kv, "unread");
  assert.equal(requests.state, "partial");

  const timeout = await readProviderInventory({
    ...readOptions(async () => {
      throw new Error("The operation was aborted due to timeout");
    }),
    maxRequests: 1,
  });
  assert.equal(timeout.state, "inaccessible");
  assert.equal(timeout.resources.length, 0);
  assert.match(timeout.endpoints[0].message, /timeout/i);
  assert.doesNotMatch(timeout.endpoints[0].message, /fixture-read-token/);
});

test("an inaccessible provider is an explicit failure, not a clean scan", async () => {
  const snapshot = await readProviderInventory(
    readOptions(async () => denied(403, "Authentication error token=sekret")),
  );
  assert.equal(snapshot.state, "inaccessible");
  assert.equal(snapshot.resources.length, 0);
  assert.ok(
    snapshot.endpoints.every((endpoint) => endpoint.state === "inaccessible"),
  );
  assert.doesNotMatch(snapshot.endpoints[0].message, /sekret/);

  const check = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    }),
  );
  assert.equal(check.state, "inaccessible");
  assert.equal(check.findings[0].code, "provider-inaccessible");
  assert.equal(check.counts.inaccessible, expected.resources.length);
  assert.equal(check.counts.observed, 0);
  assert.equal(check.cost.state, "unknown");
  assert.ok(
    check.comparisons.every(
      (item) => item.state === "inaccessible" && item.cost.state === "unknown",
    ),
  );
});

test("the check surfaces undeclared Workers, absent tags and the D1 count limitation without authority", async () => {
  const snapshot = await readProviderInventory(readOptions(providerFetch()));
  const check = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    }),
  );
  const primary = check.findings.find(
    (finding) => finding.severity === "attention",
  );
  assert.equal(primary.code, "untracked-resources");
  assert.match(primary.title, /3 observed resources/);
  assert.match(primary.detail, /2 from 1 earlier composition id/);
  assert.match(primary.detail, /does not mark them safe to delete/);
  assert.doesNotMatch(
    primary.detail,
    /they are safe to delete|can be deleted|is deletable/i,
  );
  assert.equal(check.counts.undeclared, 3);
  assert.equal(check.counts.undeclaredWorkers, 3);
  assert.equal(check.counts.undeclaredStorage, 0);
  assert.equal(check.counts.identityVerified, 8);
  assert.equal(check.counts.identityUnknown, 0);
  assert.equal(check.counts.attention >= 1, true);

  const tags = check.findings.find(
    (finding) => finding.code === "provider-tags-absent",
  );
  assert.ok(tags);
  assert.match(tags.detail, /not ownership, access or billing authority/);
  assert.ok(
    check.findings.some(
      (finding) => finding.code === "d1-list-counts-untrusted",
    ),
  );
  assert.equal(
    check.findings.some((finding) => finding.code === "identity-unrecorded"),
    false,
  );
  assert.equal(check.identities.length, 8);
  assert.ok(check.identities.every((view) => view.status === "verified"));
  assert.ok(
    check.findings.some((finding) => finding.code === "domain-service-split"),
  );
  assert.ok(
    check.findings.some(
      (finding) => finding.code === "preview-revision-differs",
    ),
  );
  const root = check.comparisons.find((item) => item.name === "app-composer");
  assert.equal(root.tags.state, "mismatch");
  assert.ok(root.tags.missing.includes("composer:app"));
  assert.ok(root.tags.unexpected.includes("cf:service"));
  assert.equal(root.cost.state, "unknown");
  assert.equal(formatCost(root.cost), "Unknown");
  assert.throws(
    () =>
      providerCheck.parse({
        ...check,
        cost: { state: "known", note: "0" },
      }),
    /invalid|literal/i,
  );

  const tagsOnly = compareTags(
    [{ key: "composer:app", value: "app-composer" }],
    [{ key: "cf:service", value: "app-composer" }],
  );
  assert.equal(tagsOnly.state, "mismatch");
  assert.deepEqual(tagsOnly.missing, ["composer:app"]);
  assert.deepEqual(tagsOnly.unexpected, ["cf:service"]);
});

test("the unconfigured route makes no provider request and returns one honest attention entry", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);
  assert.ok(workspace.id);
  let calls = 0;
  const unconfigured = await manageProviderInventory(
    {
      user,
      input: { action: "check", workspace: workspace.id },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/providerRead?action=check",
        { method: "GET", headers: { Origin: origin } },
      ),
    },
    { ...f.runtime, DB: f.db, PUBLIC_ORIGIN: origin },
    {
      request: async () => {
        calls++;
        return json([]);
      },
      now: () => NOW,
      revision: REVISION,
    },
  );
  assert.equal(unconfigured.ok, true);
  assert.equal(unconfigured.state, "unconfigured");
  assert.equal(unconfigured.counts.observed, 0);
  assert.equal(unconfigured.counts.unverified, expected.resources.length);
  assert.equal(unconfigured.counts.attention, 1);
  assert.equal(unconfigured.findings[0].code, "provider-unconfigured");
  assert.match(unconfigured.findings[0].detail, /no provider request/i);
  assert.equal(unconfigured.cost.state, "unknown");
  assert.equal(calls, 0);

  const post = await manageProviderInventory(
    {
      user,
      input: { action: "check", workspace: workspace.id },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/providerRead?action=check",
        { method: "POST", headers: { Origin: origin } },
      ),
    },
    { ...f.runtime, DB: f.db, PUBLIC_ORIGIN: origin },
  );
  assert.equal(post.ok, false);
  assert.equal(post.code, "FORBIDDEN");

  const wrongAccount = await manageProviderInventory(
    {
      user,
      input: { action: "check", workspace: workspace.id },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/providerRead?action=check",
        { method: "GET", headers: { Origin: origin } },
      ),
    },
    {
      ...f.runtime,
      DB: f.db,
      PUBLIC_ORIGIN: origin,
      PROVIDER_READ_ENABLED: "1",
      PROVIDER_READ_TOKEN: "fixture-read-token",
      PROVIDER_READ_ACCOUNT_ID: "ffffffffffffffffffffffffffffffff",
    },
    { request: async () => json([]), now: () => NOW },
  );
  assert.equal(wrongAccount.ok, false);
  assert.equal(wrongAccount.code, "FORBIDDEN");
  assert.match(wrongAccount.message, /did not read another account/);
});

test("the configured route reads only GET paths and validates its own summary", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);
  const calls = { n: 0 };
  const result = await manageProviderInventory(
    {
      user,
      input: { action: "check", workspace: workspace.id },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/providerRead?action=check",
        { method: "GET", headers: { Origin: origin } },
      ),
    },
    {
      ...f.runtime,
      DB: f.db,
      PUBLIC_ORIGIN: origin,
      PROVIDER_READ_ENABLED: "1",
      PROVIDER_READ_TOKEN: "fixture-read-token",
      PROVIDER_READ_ACCOUNT_ID: ACCOUNT,
    },
    {
      request: providerFetch(calls),
      now: () => NOW,
      revision: REVISION,
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.state, "verified");
  assert.equal(result.expectedRevision, REVISION);
  assert.equal(result.counts.match, 21);
  assert.equal(result.counts.unverified, 0);
  assert.equal(result.counts.undeclared, 3);
  assert.equal(result.counts.identityVerified, 8);
  assert.ok(calls.n > 0);
  assert.ok(result.endpoints.every((endpoint) => endpoint.method === "GET"));
  assert.equal(result.cost.state, "unknown");
  assert.doesNotMatch(JSON.stringify(result), /fixture-read-token/);
  providerCheck.parse(result);
});

test("the native panel is explicit, keyboard reachable and offers no destructive control", async () => {
  await mkdir(new URL("../.private/", import.meta.url), { recursive: true });
  const directory = await mkdtemp(
    new URL("../.private/provider-ui-", import.meta.url),
  );
  try {
    const panel = await readFile(
      new URL("../src/plugins/provider-check-panel.tsx", import.meta.url),
      "utf8",
    );
    const compiled = ts.transpileModule(panel, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const target = directory + "/panel.mjs";
    await writeFile(target, compiled.outputText);
    const { ProviderCheckPanel } = await import(pathToFileURL(target));
    const snapshot = await readProviderInventory(readOptions(providerFetch()));
    const check = buildProviderCheck({
      expected,
      snapshot,
      source: "local-cli",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    });
    const html = renderToStaticMarkup(
      React.createElement(ProviderCheckPanel, {
        check,
        busy: false,
        error: "",
        imported: true,
        disabled: false,
        onCheck() {},
        onImport() {},
      }),
    );
    assert.match(html, /Cloudflare check/);
    assert.match(html, /<button type="button">Check Cloudflare now<\/button>/);
    assert.match(html, /Import a local check/);
    assert.match(html, /<input type="file"/);
    assert.match(html, /Imported local check · not a live read from this page/);
    assert.match(html, /Needs attention/);
    assert.match(html, /First-party app identity/);
    assert.match(html, /What these categories mean/);
    assert.match(html, /Declared 21 = 21 match/);
    assert.match(
      html,
      /Recorded identity comes from each app’s committed Wrangler manifest/,
    );
    assert.match(
      html,
      /href="https:\/\/github.com\/loftwah\/app-composer-guestbook"/,
    );
    assert.match(html, /aria-label="First-party app identity"/);
    assert.match(html, /<th scope="row">app-composer/);
    assert.match(html, /<td>Unknown<\/td>/);
    assert.match(html, /tabindex="0"/);
    assert.match(html, /role="status"/);
    assert.match(
      html,
      /aria-label="Cloudflare expected and observed resources"/,
    );
    assert.doesNotMatch(
      html,
      /<button[^>]*>(?:Delete|Retire|Apply tag|Deploy)/i,
    );
    assert.doesNotMatch(html, /<a[^>]*>(?:Delete|Retire|Apply tag|Deploy)/i);

    const unconfigured = buildProviderCheck({
      expected,
      snapshot: null,
      source: "local-cli",
      state: "unconfigured",
      reason: "No read-only credential is configured.",
      checkedAt: new Date(NOW).toISOString(),
      now: NOW,
    });
    const empty = renderToStaticMarkup(
      React.createElement(ProviderCheckPanel, {
        check: undefined,
        busy: false,
        error: "",
        imported: false,
        disabled: false,
        onCheck() {},
        onImport() {},
      }),
    );
    assert.match(empty, /Nothing has been read/);
    const notConfigured = renderToStaticMarkup(
      React.createElement(ProviderCheckPanel, {
        check: unconfigured,
        busy: false,
        error: "",
        imported: false,
        disabled: false,
        onCheck() {},
        onImport() {},
      }),
    );
    assert.match(notConfigured, /Not configured/);
    assert.match(notConfigured, /Cloudflare state is not checked/);
    assert.match(notConfigured, /No provider request was made/);
    assert.match(
      notConfigured,
      /Composer route response · no provider request/,
    );
    assert.doesNotMatch(notConfigured, /Live read from this deployment/);

    const css = await readFile(
      new URL("../src/plugins/resource-inventory-page.css", import.meta.url),
      "utf8",
    );
    assert.match(css, /\.ri-cloud \{/);
    assert.match(css, /@media \(max-width: 640px\)/);
    assert.match(css, /\.ri-cloud-actions \{\s*flex-direction: column;/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the declared expectations match wrangler.jsonc, composition.lock.json and the promotion boundary", async () => {
  const wrangler = JSON.parse(
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );
  assert.equal(wrangler.account_id, ACCOUNT);
  assert.equal(wrangler.name, "app-composer");
  assert.equal(wrangler.env.preview.name, "app-composer-preview");
  assert.equal(wrangler.compatibility_date, "2026-10-13");
  assert.deepEqual(wrangler.compatibility_flags, [
    "nodejs_compat",
    "global_fetch_strictly_public",
  ]);
  assert.equal(wrangler.routes[0].pattern, "composer.loftwah.com");
  assert.equal(wrangler.routes[0].custom_domain, true);
  assert.equal(
    wrangler.d1_databases[0].database_id,
    "1b2b29c8-4109-4a5f-901a-befc91173bc5",
  );
  assert.equal(
    wrangler.env.preview.d1_databases[0].database_id,
    "bdbbe1c4-e1ff-43d3-a89d-d7dd76d13c0a",
  );
  assert.equal(wrangler.r2_buckets[0].bucket_name, "app-composer-media");
  assert.equal(
    wrangler.env.preview.r2_buckets[0].bucket_name,
    "app-composer-media-preview",
  );
  assert.equal(
    wrangler.kv_namespaces[0].id,
    "3a76800194064e498949fd7c251af7e3",
  );
  assert.equal(
    wrangler.env.preview.kv_namespaces[0].id,
    "2e7ac1e5417f4425be41d60d99a35de1",
  );
  assert.equal(wrangler.triggers.crons[0], "* * * * *");
  assert.equal(wrangler.env.preview.triggers.crons.length, 0);
  assert.deepEqual(wrangler.env.preview.services, []);
  const serviceNames = wrangler.services.map((service) => service.service);
  assert.ok(serviceNames.includes(pinnedGuestbook));
  assert.ok(serviceNames.includes(pinnedShowcase));
  const lock = JSON.parse(
    await readFile(
      new URL("../composition.lock.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(expected.composition.id, lock.id);
  assert.equal(
    expected.composition.annotation,
    "Pinned composition " + lock.id,
  );
  assert.equal(expected.composition.apps[0].commit, lock.apps[0].commit);
  assert.equal(expected.composition.apps[1].commit, lock.apps[1].commit);

  // The first-party identity table cites each app's committed manifest and a
  // recorded receipt. A name without that evidence is not an identity claim.
  assert.equal(expected.identities.length, 8);
  assert.deepEqual(
    expected.identities.map((identity) => identity.worker).sort(),
    FIRST_PARTY_WORKERS.map((worker) => worker.name).sort(),
  );
  assert.equal(
    new Set(expected.identities.map((identity) => identity.worker)).size,
    8,
  );
  const release = JSON.parse(
    await readFile(new URL("../src/lib/release.json", import.meta.url), "utf8"),
  );
  for (const identity of expected.identities) {
    assert.match(identity.worker, /^composer-[a-z-]+$/);
    assert.equal(identity.environment, "production");
    assert.match(identity.manifest, /^wrangler\.jsonc?$/);
    assert.match(identity.repo, /^https:\/\/github.com\/loftwah\//);
    assert.ok(identity.receipt.reference.length > 0);
    assert.ok(identity.receipt.versionId || identity.receipt.commit);
    assert.ok(identity.nextAction.length > 0);
    const source = release.sources.find(
      (candidate) => candidate.name === identity.app,
    );
    if (source) assert.equal(identity.repo, source.url.replace(/\.git$/, ""));
    if (identity.annotationPrefix)
      assert.ok(identity.annotationPrefix.endsWith(" "));
    if (identity.domain) assert.equal(identity.domain.includes("/"), false);
  }
  const launchKit = expected.identities.find(
    (identity) => identity.app === "launch-kit",
  );
  assert.equal(launchKit.domain, null);
  assert.equal(launchKit.annotationPrefix, "Launch Kit ");
  for (const identity of expected.identities) {
    const resource = expected.resources.find(
      (item) => item.kind === "worker" && item.name === identity.worker,
    );
    assert.equal(resource.identityRecorded, true);
    assert.ok(
      resource.checks.some((check) => check.field === "name"),
      identity.worker + " must check its declared name",
    );
    assert.ok(
      resource.checks.some(
        (check) =>
          check.field === "customDomains" ||
          check.field === "deploymentAnnotation",
      ),
      identity.worker + " must check a provider identity signal",
    );
  }
});

test("declared storage absent from a successful page stays unverified while present resources and Worker absence retain their meanings", async () => {
  const snapshot = await readProviderInventory(readOptions(providerFetch()));
  for (const kind of ["d1", "r2", "kv"]) {
    const selected = expected.resources.find(
      (resource) => resource.kind === kind,
    );
    const bounded = structuredClone(snapshot);
    bounded.resources = bounded.resources.filter(
      (resource) =>
        !(
          resource.kind === kind &&
          (selected.id
            ? resource.id === selected.id
            : resource.name === selected.name)
        ),
    );
    assert.equal(bounded.lists[kind], "read");
    const row = compareProviderInventory(
      expected,
      bounded,
      NOW,
    ).comparisons.find(
      (resource) => resource.kind === kind && resource.name === selected.name,
    );
    assert.equal(row.state, "unverified");
    assert.match(row.detail, /pagination or cursor completeness/);
    assert.equal(
      compareProviderInventory(expected, snapshot, NOW).comparisons.find(
        (resource) => resource.kind === kind && resource.name === selected.name,
      ).state,
      "match",
    );
  }
  const bounded = structuredClone(snapshot);
  bounded.resources = bounded.resources.filter(
    (resource) => resource.name !== "composer-hello",
  );
  assert.equal(
    compareProviderInventory(expected, bounded, NOW).comparisons.find(
      (resource) => resource.name === "composer-hello",
    ).state,
    "missing",
  );
});

test("a real-shaped paginated D1 response with the declared database on an unread second page cannot report it missing", async () => {
  const request = providerFetch();
  const selected = expected.resources.find(
    (resource) => resource.kind === "d1",
  );
  const snapshot = await readProviderInventory(
    readOptions(async (url, init) => {
      if (new URL(url).pathname.endsWith("/d1/database"))
        return new Response(
          JSON.stringify({
            success: true,
            result: Array.from({ length: 50 }, (_, index) => ({
              uuid: "other-database-" + index,
              name: "unrelated-database-" + index,
              num_tables: 0,
            })),
            result_info: {
              page: 1,
              per_page: 50,
              total_pages: 2,
              total_count: 51,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      return request(url, init);
    }),
  );
  assert.equal(snapshot.lists.d1, "read");
  assert.equal(snapshot.state, "verified");
  assert.equal(
    snapshot.resources.some(
      (resource) => resource.kind === "d1" && resource.id === selected.id,
    ),
    false,
  );
  const result = compareProviderInventory(
    expected,
    snapshot,
    NOW,
  ).comparisons.find(
    (resource) => resource.kind === "d1" && resource.name === selected.name,
  );
  assert.equal(result.state, "unverified");
  assert.match(result.detail, /pagination or cursor completeness/);
});

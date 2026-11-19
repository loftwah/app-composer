// CF-COMPOSE-01 is a local foundation, not a Cloudflare account qualification.
// Reuse the existing product checks and exercise the actual read-only provider
// operations projection with fictional observations. No provider reader runs.
import assert from "node:assert/strict";
import {
  id as sandboxId,
  run as runSandbox,
} from "../suites/sandbox-save-reopen.mjs";
import {
  id as blueprintId,
  run as runBlueprint,
} from "../suites/blueprint-roundtrip.mjs";
import { check } from "../suites/_checks.mjs";
import { providerOperations } from "../../src/lib/provider-operations.ts";
import { COST_UNKNOWN } from "../../src/lib/provider-inventory.mjs";

export const id = "foundation";
export const name = "Cloudflare composition: local evidence foundation";

const ACCOUNT = "cf-compose-fixture-account";
const EARLIER = "2026-11-19T00:00:00.000Z";
const LATER = "2026-11-19T00:01:00.000Z";

function expectedInventory() {
  return {
    account: ACCOUNT,
    resources: [
      {
        kind: "worker",
        name: "fixture-composer",
        id: null,
        environment: "preview",
        source: "fictional-fixture-declaration",
        tags: [{ key: "owner", value: "fixture-owner" }],
      },
    ],
  };
}

function worker(name, bindings = []) {
  return {
    kind: "worker",
    id: name,
    name,
    environment: "unverified",
    facts: {
      settingsRead: true,
      bindings,
      deploymentRead: true,
      versionId: "fixture-version-a",
      domainsRead: true,
      domains: [],
      schedulesRead: true,
      schedules: [],
    },
  };
}

function storage(kind, resourceId) {
  return {
    kind,
    id: resourceId,
    name: resourceId,
    environment: "unverified",
    facts: null,
  };
}

function snapshot(resources, observedAt = EARLIER) {
  return {
    version: "composer.provider-inventory/1",
    account: ACCOUNT,
    scope: "cf-compose-fictional-preview",
    state: "verified",
    observedAt,
    resources,
    lists: { worker: "read", d1: "read", r2: "read", kv: "read" },
    workersAtLimit: false,
  };
}

function inheritedChecks(suiteId, results) {
  return results.map((result) => ({
    ...result,
    id: `${suiteId}-${result.id}`,
    detail: `Reused ${suiteId}: ${result.detail}`,
  }));
}

export function run(context = {}) {
  return [
    ...inheritedChecks(sandboxId, runSandbox(context)),
    ...inheritedChecks(blueprintId, runBlueprint(context)),
    check(
      "provider-scope-mismatch-refused",
      "Account or observation-scope mismatches cannot form a comparison",
      () => {
        const expected = expectedInventory();
        const previous = snapshot([worker("fixture-composer")]);
        const current = snapshot([worker("fixture-composer")], LATER);
        const before = structuredClone({ expected, previous, current });

        assert.equal(providerOperations(expected, current, previous).readOnly, true);
        assert.throws(
          () => providerOperations(expected, { ...current, account: "fixture-other-account" }),
          /matching account and scope/,
        );
        assert.throws(
          () => providerOperations(expected, current, { ...previous, account: "fixture-other-account" }),
          /matching account and scope/,
        );
        assert.throws(
          () => providerOperations(expected, current, { ...previous, scope: "fixture-other-scope" }),
          /matching account and scope/,
        );
        assert.deepEqual({ expected, previous, current }, before);
        return "A matching fictional baseline was accepted read-only; three account/scope mismatches were refused without mutating the observations.";
      },
    ),
    check(
      "provider-incomplete-observations-stay-unknown",
      "Incomplete lists and unread settings cannot establish removal",
      () => {
        const expected = expectedInventory();
        const previous = snapshot([worker("fixture-retained")]);
        for (const incomplete of [
          { state: "partial" },
          { workersAtLimit: true },
          { lists: { worker: "refused", d1: "read", r2: "read", kv: "read" } },
        ]) {
          const current = { ...snapshot([], LATER), ...incomplete };
          const result = providerOperations(expected, current, previous);
          assert.equal(result.changes.length, 1);
          assert.equal(result.changes[0].state, "current-unread");
        }

        // A successful storage page is still not proof of pagination completion.
        for (const kind of ["d1", "r2", "kv"]) {
          const before = snapshot([storage(kind, "fixture-retained")]);
          const after = snapshot([storage(kind, "fixture-other")], LATER);
          const changes = providerOperations(expected, after, before).changes;
          assert.equal(changes.find((row) => row.id === "fixture-retained")?.state, "current-unread");
          assert.equal(changes.find((row) => row.id === "fixture-other")?.state, "baseline-unread");
        }

        const beforeSettings = snapshot([
          worker("fixture-composer", [{ name: "DB", type: "d1", databaseId: "fixture-db" }]),
        ]);
        const afterSettings = structuredClone(beforeSettings);
        afterSettings.observedAt = LATER;
        afterSettings.resources[0].facts.settingsRead = false;
        afterSettings.resources[0].facts.bindings = [];
        const settings = providerOperations(expected, afterSettings, beforeSettings);
        assert.equal(settings.resources[0].dependencyCoverage, "unread");
        assert.equal(settings.dependencyCoverage.settingsRead, 0);
        assert.equal(settings.changes.find((row) => row.id === "fixture-composer")?.state, "dependency-unverified");
        assert.equal(settings.changes.some((row) => row.fields.includes("dependency-bindings")), false);
        return "Partial, truncated and refused Worker lists stayed unknown; D1/R2/KV pages proved no absence or newness; unread settings were not interpreted as deleted bindings.";
      },
    ),
    check(
      "provider-explicit-dependencies-preserved",
      "Observed binding targets, service environment and entrypoint remain explicit",
      () => {
        const expected = expectedInventory();
        const previous = snapshot([
          worker("fixture-composer", [
            { name: "APP", type: "service", service: "fixture-child", environment: "preview", entrypoint: "Member" },
            { name: "DB", type: "d1", databaseId: "fixture-db" },
            { name: "MEDIA", type: "r2_bucket", bucketName: "fixture-assets" },
            { name: "SESSION", type: "kv_namespace", namespaceId: "fixture-kv" },
          ]),
          worker("fixture-child"),
          storage("d1", "fixture-db"),
          storage("r2", "fixture-assets"),
          storage("kv", "fixture-kv"),
        ]);
        const result = providerOperations(expected, previous);
        assert.deepEqual(result.resources[0].dependencies, [
          { binding: "APP", kind: "worker", id: "fixture-child", environment: "preview", entrypoint: "Member" },
          { binding: "DB", kind: "d1", id: "fixture-db", environment: null, entrypoint: null },
          { binding: "MEDIA", kind: "r2", id: "fixture-assets", environment: null, entrypoint: null },
          { binding: "SESSION", kind: "kv", id: "fixture-kv", environment: null, entrypoint: null },
        ]);
        for (const [resourceId, binding] of [
          ["fixture-child", "APP"],
          ["fixture-db", "DB"],
          ["fixture-assets", "MEDIA"],
          ["fixture-kv", "SESSION"],
        ]) {
          assert.deepEqual(result.resources.find((row) => row.id === resourceId)?.dependents, [
            { worker: "fixture-composer", binding },
          ]);
        }

        const current = structuredClone(previous);
        current.observedAt = LATER;
        current.resources[0].facts.bindings.reverse();
        assert.deepEqual(providerOperations(expected, current, previous).changes, []);
        current.resources[0].facts.bindings.find((binding) => binding.name === "APP").environment = "production";
        const changed = providerOperations(expected, current, previous);
        assert.deepEqual(changed.changes[0].fields, ["dependency-bindings"]);
        assert.equal(changed.resources[0].dependencies[0].environment, "production");
        assert.equal(changed.dependencyCoverage.reverseReferencesComplete, false);
        return "Service/D1/R2/KV targets and known dependents survived; reordering made no change; a service target's environment change was exposed. This does not establish preview isolation.";
      },
    ),
    check(
      "provider-unknown-cost-no-retirement-authority",
      "Owner declarations and absent observed dependents grant no retirement authority or known charge",
      () => {
        const previous = snapshot([worker("fixture-no-longer-listed")]);
        const current = snapshot([
          worker("fixture-composer"),
          worker("fixture-unassigned"),
          storage("r2", "fixture-unreferenced-bucket"),
        ], LATER);
        const result = providerOperations(expectedInventory(), current, previous);
        assert.equal(result.readOnly, true);
        assert.equal(COST_UNKNOWN.state, "unknown");
        assert.deepEqual(result.cost, COST_UNKNOWN);
        assert.equal(result.resources[0].declaredOwner, "fixture-owner");
        assert.equal(result.resources[1].declaredOwner, null);
        assert.equal(result.resources[1].declared, false);
        assert.equal(result.dependencyCoverage.reverseReferencesComplete, false);
        for (const resource of result.resources) {
          assert.equal(resource.retirement, "not-authorised");
          assert.equal(resource.cost.state, "unknown");
          assert.deepEqual(resource.cost, COST_UNKNOWN);
        }
        assert.deepEqual(result.resources[2].dependents, []);
        assert.equal(result.changes.find((row) => row.id === "fixture-no-longer-listed")?.state, "no-longer-observed");
        return "Declared, undeclared and unreferenced fixture resources all retained unknown costs and no retirement authority; a complete-list absence remained an observation only.";
      },
    ),
  ];
}

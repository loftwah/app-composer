import test from "node:test";
import assert from "node:assert/strict";
import { providerOperations } from "../src/lib/provider-operations.ts";
const account = "fictional-account";
const expected = {
  account,
  resources: [
    {
      kind: "worker",
      name: "app-composer",
      id: null,
      environment: "production",
      source: "wrangler.jsonc",
      tags: [{ key: "owner", value: "fictional-owner" }],
    },
  ],
};
const facts = (bindings = []) => ({
  settingsRead: true,
  bindings,
  deploymentRead: true,
  versionId: "version-a",
  domainsRead: true,
  domains: ["composer.example.test"],
  schedulesRead: true,
  schedules: [],
});
const worker = (name, bindings = []) => ({
  kind: "worker",
  id: name,
  name,
  environment: "unverified",
  facts: facts(bindings),
});
const storage = (id) => ({
  kind: "d1",
  id,
  name: id,
  environment: "unverified",
  facts: null,
});
const snapshot = (resources, date = "2026-10-25T01:00:00Z") => ({
  version: "composer.provider-inventory/1",
  account,
  scope: "composer",
  state: "verified",
  observedAt: date,
  resources,
  lists: { worker: "read", d1: "read", r2: "read", kv: "read" },
  workersAtLimit: false,
});

test("actual observed references retain declared owner separately and never authorise unknown resource retirement", () => {
  const current = snapshot([
    worker("app-composer", [
      { name: "DB", type: "d1", databaseId: "retained-db" },
    ]),
    worker("composer-legacy"),
    storage("retained-db"),
  ]);
  const result = providerOperations(expected, current);
  assert.equal(result.resources[0].declaredOwner, "fictional-owner");
  assert.equal(result.resources[0].environment, "production");
  assert.equal(result.resources[1].declaredOwner, null);
  assert.deepEqual(result.resources[2].dependents, [
    { worker: "app-composer", binding: "DB" },
  ]);
  assert.ok(
    result.resources.every(
      (row) =>
        row.retirement === "not-authorised" && row.cost.state === "unknown",
    ),
  );
  assert.equal(result.dependencyCoverage.reverseReferencesComplete, false);
  assert.equal(result.baselineAt, null);
});

test("selected before/after observations expose version, schedule and binding changes without interpreting absent fields as removals", () => {
  const previous = snapshot([
    worker("app-composer", [{ name: "DB", type: "d1", databaseId: "old-db" }]),
    worker("composer-unread"),
  ]);
  const current = structuredClone(previous);
  current.observedAt = "2026-10-25T02:00:00Z";
  current.resources[0].facts.bindings[0].databaseId = "new-db";
  current.resources[0].facts.versionId = "version-b";
  current.resources[0].facts.schedules = ["0 * * * *"];
  current.resources[1].facts.settingsRead = false;
  current.resources[1].facts.bindings = [];
  const result = providerOperations(expected, current, previous);
  assert.deepEqual(
    result.changes.find((c) => c.name === "app-composer").fields,
    ["active-version", "dependency-bindings", "schedules"],
  );
  assert.equal(
    result.changes.find((c) => c.name === "composer-unread").state,
    "dependency-unverified",
  );
  assert.equal(result.resources[1].dependencyCoverage, "unread");
});

test("missing resources remain unverified under partial or truncated reads and no temporal baseline is fabricated", () => {
  const previous = snapshot([worker("composer-retained")]);
  for (const partial of [
    { state: "partial" },
    { workersAtLimit: true },
    { lists: { worker: "refused" } },
  ]) {
    const current = { ...snapshot([], "2026-10-25T02:00:00Z"), ...partial };
    assert.equal(
      providerOperations(expected, current, previous).changes[0].state,
      "current-unread",
    );
  }
  const current = snapshot([], "2026-10-25T02:00:00Z");
  assert.equal(
    providerOperations(expected, current, previous).changes[0].state,
    "no-longer-observed",
  );
  assert.throws(
    () =>
      providerOperations(expected, current, { ...previous, account: "other" }),
    /matching account/,
  );
  assert.throws(
    () => providerOperations(expected, previous, current),
    /earlier/,
  );
  assert.deepEqual(providerOperations(expected, current).changes, []);
});

test("binding order is irrelevant while service entrypoint changes remain actionable", () => {
  const previous = snapshot([
    worker("app-composer", [
      {
        name: "A",
        type: "service",
        service: "child",
        environment: "production",
        entrypoint: "Member",
      },
      { name: "B", type: "d1", databaseId: "db" },
    ]),
  ]);
  const current = structuredClone(previous);
  current.observedAt = "2026-10-25T02:00:00Z";
  current.resources[0].facts.bindings.reverse();
  assert.equal(
    providerOperations(expected, current, previous).changes.length,
    0,
  );
  current.resources[0].facts.bindings[1].entrypoint = "Other";
  assert.deepEqual(
    providerOperations(expected, current, previous).changes[0].fields,
    ["dependency-bindings"],
  );
});

test("duplicate identities and invalid dates cannot manufacture a temporal comparison", () => {
  const current = snapshot([worker("app-composer"), worker("app-composer")]);
  assert.throws(() => providerOperations(expected, current), /Duplicate/);
  assert.throws(
    () =>
      providerOperations(expected, {
        ...snapshot([]),
        observedAt: "not-a-date",
      }),
    /dated/,
  );
});

test("a pinned service declaration accounts for its real Worker without relabelling it undeclared", () => {
  const declaration = {
    ...expected,
    resources: [
      {
        ...expected.resources[0],
        kind: "service",
        name: "composer-guestbook-pin",
        source: "composition.lock.json",
      },
    ],
  };
  const result = providerOperations(
    declaration,
    snapshot([worker("composer-guestbook-pin"), worker("composer-legacy")]),
  );
  assert.equal(result.resources[0].declared, true);
  assert.equal(result.resources[0].declaredOwner, "fictional-owner");
  assert.equal(result.resources.filter((r) => !r.declared).length, 1);
});

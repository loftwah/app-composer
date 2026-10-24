import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  saved,
  instance,
  user,
  account,
  origin,
} from "./helpers/resource-fixture.mjs";
import { readStack, saveStack, workspaceForUser } from "../src/lib/stacks.mjs";
import { manageResourceInventory } from "../src/lib/resource-inventory.ts";
import {
  classifyResource,
  compareProviderTags,
  configurationDifferences,
  countStatuses,
  expectedProviderTags,
  normaliseLabel,
  STALE_AFTER_DAYS,
} from "../src/lib/resource-inventory-model.ts";
import {
  resourceInventory,
  inventoryResource,
} from "../src/lib/resource-inventory-contract.ts";
import { fictionalResourceInventory } from "../src/lib/resource-inventory-example.ts";

const NOW = Date.parse("2026-10-24T05:00:00.000Z");
const observation = (patch = {}) => ({
  id: "resource-fixture-0001",
  state: "ready",
  configuration: {
    revision: 2,
    digest: "a".repeat(64),
    source: "b".repeat(40),
    values: { title: "Fictional visitor book", theme: "midnight" },
  },
  expected: {
    available: true,
    basis: "saved-draft",
    values: { title: "Fictional visitor book", theme: "midnight" },
    digest: "a".repeat(64),
    source: "b".repeat(40),
    note: null,
  },
  targetMatches: true,
  bindings: 1,
  unfinished: null,
  lastConfirmedAt: "2026-10-20T00:00:00.000Z",
  published: { pinned: [2], current: 2 },
  providerTags: compareProviderTags(
    expectedProviderTags({
      workspace: "Fictional workspace",
      app: "guestbook",
      environment: "production",
      resource: "resource-fixture-0001",
    }),
    null,
  ),
  actionHref:
    "/_emdash/admin/plugins/composer-stacks/stacks?workspace=fictional-workspace",
  ...patch,
});

test("labels normalise to a stable, bounded provider-tag value", () => {
  assert.equal(
    normaliseLabel("Fictional Trail Notes"),
    "fictional-trail-notes",
  );
  assert.equal(normaliseLabel("  Trail   Notes!!  "), "trail-notes");
  assert.equal(normaliseLabel(""), "");
  assert.equal(normaliseLabel("---"), "");
  assert.equal(normaliseLabel("Café & Co"), "cafe-co");
  const long = normaliseLabel("a".repeat(60) + "-" + "b".repeat(60));
  assert.equal(long.length, 40);
  assert.ok(!long.endsWith("-"));
});

test("expected tags are namespaced, deterministic and independent of order", () => {
  const labels = {
    workspace: "Fictional Club workspace",
    app: "guestbook",
    environment: "production",
    resource: "fictional-guestbook-trail",
  };
  const first = expectedProviderTags(labels);
  const second = expectedProviderTags({ ...labels });
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((tag) => tag.key),
    [...first.map((tag) => tag.key)].sort(),
  );
  assert.ok(first.every((tag) => tag.key.startsWith("composer:")));
  assert.ok(!first.some((tag) => tag.key.startsWith("owner:")));
});

test("provider tag comparison separates unverified, match, partial and mismatch", () => {
  const expected = [
    { key: "composer:app", value: "guestbook" },
    { key: "composer:environment", value: "production" },
  ];
  assert.equal(compareProviderTags(expected, null).state, "unverified");
  assert.deepEqual(compareProviderTags(expected, null).recorded, null);
  assert.equal(compareProviderTags(expected, [...expected]).state, "match");
  // A verified read that found no tags is not the same as no read.
  const empty = compareProviderTags(expected, []);
  assert.equal(empty.state, "mismatch");
  assert.deepEqual(empty.missing, ["composer:app", "composer:environment"]);
  const partial = compareProviderTags(expected, [
    expected[0],
    { key: "owner:team", value: "fictional" },
  ]);
  assert.equal(partial.state, "partial");
  assert.deepEqual(partial.missing, ["composer:environment"]);
  // An unrelated tag is reported, never treated as a Composer-owned key.
  assert.deepEqual(partial.unexpected, ["owner:team"]);
  const wrong = compareProviderTags(expected, [
    { key: "composer:app", value: "showcase" },
    { key: "composer:environment", value: "staging" },
  ]);
  assert.equal(wrong.state, "mismatch");
  assert.deepEqual(wrong.unexpected, ["composer:app", "composer:environment"]);
});

test("configuration differences are field-level and bounded", () => {
  assert.deepEqual(configurationDifferences({ a: "1", b: "2" }, { a: "1" }), [
    { field: "b", current: "2", expected: null },
  ]);
  assert.deepEqual(configurationDifferences(null, { a: "1" }), [
    { field: "a", current: null, expected: "1" },
  ]);
  assert.deepEqual(configurationDifferences({ a: "1" }, null), []);
});

test("classifyResource states drift, unknown, stale, unbound and in-step honestly", () => {
  const clean = classifyResource(observation(), NOW);
  assert.equal(clean.status, "in-step");
  assert.deepEqual(clean.findings, []);

  const drift = classifyResource(
    observation({
      configuration: {
        ...observation().configuration,
        digest: "c".repeat(64),
        values: { title: "Older title", theme: "midnight" },
      },
    }),
    NOW,
  );
  assert.equal(drift.status, "attention");
  assert.ok(drift.findings.some((f) => f.code === "unapplied-settings"));

  // The reconciliation journey: applying the saved settings updates only the
  // recorded configuration, and the same read then reports in-step.
  const reconciled = classifyResource(
    observation({
      configuration: {
        revision: 3,
        digest: "a".repeat(64),
        source: "b".repeat(40),
        values: { title: "Fictional visitor book", theme: "midnight" },
      },
      published: { pinned: [3], current: 3 },
    }),
    NOW,
  );
  assert.equal(reconciled.status, "in-step");

  const unfinished = classifyResource(
    observation({
      unfinished: {
        action: "stage",
        state: "unknown",
        at: "2026-10-23T00:00:00.000Z",
      },
    }),
    NOW,
  );
  assert.equal(unfinished.status, "unknown");
  assert.ok(unfinished.findings.some((f) => f.code === "unfinished-operation"));

  const staleAt = new Date(
    NOW - (STALE_AFTER_DAYS + 5) * 86400000,
  ).toISOString();
  const stale = classifyResource(
    observation({ lastConfirmedAt: staleAt }),
    NOW,
  );
  assert.equal(stale.status, "stale");
  assert.ok(stale.findings.some((f) => f.code === "stale-check"));
  // Exactly at the boundary is still current.
  const boundary = new Date(NOW - STALE_AFTER_DAYS * 86400000).toISOString();
  assert.equal(
    classifyResource(observation({ lastConfirmedAt: boundary }), NOW).status,
    "in-step",
  );

  const unbound = classifyResource(observation({ bindings: 0 }), NOW);
  assert.equal(unbound.status, "unbound");
  assert.ok(unbound.findings.some((f) => f.code === "no-binding"));

  const otherTarget = classifyResource(
    observation({ targetMatches: false }),
    NOW,
  );
  assert.equal(otherTarget.status, "attention");
  assert.ok(otherTarget.findings.some((f) => f.code === "target-mismatch"));

  const sourceDrift = classifyResource(
    observation({
      configuration: {
        ...observation().configuration,
        source: "d".repeat(40),
      },
    }),
    NOW,
  );
  assert.equal(sourceDrift.status, "attention");
  assert.ok(sourceDrift.findings.some((f) => f.code === "source-drift"));

  const publishedBehind = classifyResource(
    observation({ published: { pinned: [1], current: 2 } }),
    NOW,
  );
  assert.equal(publishedBehind.status, "attention");
  assert.ok(
    publishedBehind.findings.some(
      (f) => f.code === "published-configuration-drift",
    ),
  );

  const tagDrift = classifyResource(
    observation({
      providerTags: compareProviderTags(
        expectedProviderTags({
          workspace: "Fictional workspace",
          app: "guestbook",
          environment: "production",
          resource: "resource-fixture-0001",
        }),
        [],
      ),
    }),
    NOW,
  );
  assert.equal(tagDrift.status, "attention");
  assert.ok(tagDrift.findings.some((f) => f.code === "provider-tag-drift"));

  const inherited = classifyResource(
    observation({
      expected: {
        available: false,
        basis: "inherited",
        values: null,
        digest: null,
        source: null,
        note: "Shared reference.",
      },
    }),
    NOW,
  );
  assert.equal(inherited.status, "in-step");
});

test("status counts cover every row once", () => {
  const rows = [
    { status: "in-step" },
    { status: "stale" },
    { status: "attention" },
    { status: "unknown" },
    { status: "unbound" },
  ].map((row) => ({ ...row }));
  const counts = countStatuses(rows);
  assert.deepEqual(counts, {
    inStep: 1,
    stale: 1,
    attention: 1,
    unknown: 1,
    unbound: 1,
  });
});

test("the fictional walkthrough is valid, labelled and covers the journey", async () => {
  const example = resourceInventory.parse(await fictionalResourceInventory());
  assert.equal(example.synthetic, true);
  assert.equal(example.provider.state, "recorded");
  assert.match(example.provider.note, /Fictional walkthrough only/);
  assert.deepEqual(example.counts, {
    inStep: 1,
    stale: 1,
    attention: 1,
    unknown: 1,
    unbound: 1,
  });
  const attention = example.resources.find((row) => row.status === "attention");
  assert.ok(attention);
  assert.ok(
    attention.findings.some((finding) => finding.code === "unapplied-settings"),
  );
  assert.equal(attention.providerTags.state, "partial");
  const match = example.resources.find(
    (row) => row.providerTags.state === "match",
  );
  assert.ok(match);
  assert.equal(match.status, "in-step");
  assert.ok(
    example.resources.every((row) => inventoryResource.safeParse(row).success),
  );
});

const reader =
  (
    f,
    caller = user,
    url = origin + "/_emdash/api/plugins/composer-stacks/resourcesRead",
  ) =>
  (input = { action: "list" }) =>
    manageResourceInventory(
      {
        user: caller,
        input,
        request: new Request(url, { headers: { Origin: origin } }),
      },
      f.runtime,
    );

const countsOf = (f) => ({
  resources: f.sqlite
    .prepare("SELECT COUNT(*) AS n FROM creator_app_resources")
    .get().n,
  bindings: f.sqlite
    .prepare("SELECT COUNT(*) AS n FROM creator_stack_resource_bindings")
    .get().n,
  operations: f.sqlite
    .prepare("SELECT COUNT(*) AS n FROM creator_resource_operations")
    .get().n,
  writes: f.app.writes.length,
  stacks: f.sqlite
    .prepare("SELECT id,revision,draft_json FROM creator_stacks ORDER BY id")
    .all(),
});

test("the native read reports stored resources and writes nothing", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);
  const stack = await saved(f, workspace.id, "Fictional Trail Notes", [
    instance("fictional-instance-0001", "Trail postcards"),
  ]);
  const applied = await f.route({
    action: "applyResources",
    stack: stack.id,
    expectedRevision: stack.revision,
  });
  assert.equal(applied.ok, true, applied.message);

  const before = countsOf(f);
  const snapshot = resourceInventory.parse(await reader(f)());
  assert.deepEqual(countsOf(f), before);
  assert.equal(snapshot.synthetic, false);
  assert.equal(snapshot.workspace.id, workspace.id);
  assert.equal(snapshot.installation.service, "GUESTBOOK");
  assert.equal(snapshot.installation.bindingAvailable, true);
  assert.equal(snapshot.provider.state, "unverified");
  assert.match(snapshot.provider.note, /no provider read/i);
  assert.equal(snapshot.resources.length, 1);
  const resource = snapshot.resources[0];
  assert.equal(resource.status, "in-step");
  assert.equal(resource.state, "ready");
  assert.equal(resource.configuration.revision, 1);
  assert.equal(resource.expected.basis, "saved-draft");
  assert.equal(resource.expected.stackName, "Fictional Trail Notes");
  assert.equal(resource.expected.instanceLabel, "Trail postcards");
  assert.equal(resource.bindings.length, 1);
  assert.equal(resource.bindings[0].mode, "own");
  assert.equal(resource.providerTags.state, "unverified");
  assert.equal(resource.providerTags.recorded, null);
  assert.ok(
    resource.providerTags.expected.some(
      (tag) =>
        tag.key === "composer:workspace" && tag.value === "fictional-creator",
    ),
  );
  // One apply records create, stage and activate in the same stored second;
  // the most recently inserted receipt is the one shown.
  assert.equal(resource.lastConfirmedOperation.action, "activate");
  assert.deepEqual(snapshot.counts, {
    inStep: 1,
    stale: 0,
    attention: 0,
    unknown: 0,
    unbound: 0,
  });
});

test("saved-setting drift, reconciliation and unknown states are read from records only", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);
  const stack = await saved(f, workspace.id, "Fictional Club", [
    instance("fictional-instance-0002", "Club photo wall"),
  ]);
  await f.route({
    action: "applyResources",
    stack: stack.id,
    expectedRevision: stack.revision,
  });
  const latest = await readStack(f.db, workspace.id, stack.id);
  const resaved = await saveStack(
    f.db,
    workspace.id,
    stack.id,
    {
      version: 1,
      name: "Fictional Club",
      description: "",
      theme: "midnight",
      instances: [
        instance("fictional-instance-0002", "Club photo wall, second edition"),
      ],
    },
    latest.revision,
  );

  const before = countsOf(f);
  const drift = resourceInventory.parse(await reader(f)());
  assert.deepEqual(countsOf(f), before);
  const drifted = drift.resources[0];
  assert.equal(drifted.status, "attention");
  assert.ok(
    drifted.findings.some((finding) => finding.code === "unapplied-settings"),
  );
  assert.ok(
    drifted.differences.some(
      (difference) =>
        difference.field === "title" &&
        difference.expected === "Club photo wall, second edition",
    ),
  );
  assert.match(
    drifted.findings.find((finding) => finding.code === "unapplied-settings")
      .action.href,
    /^\/_emdash\/admin\/plugins\/composer-stacks\/stacks\?workspace=/,
  );

  // Reconciling through the existing supported operation makes the same read
  // in-step. The inventory itself never applies anything.
  const reconciled = await f.route({
    action: "applyResources",
    stack: stack.id,
    expectedRevision: resaved.revision,
  });
  assert.equal(reconciled.ok, true, reconciled.message);
  const after = resourceInventory.parse(await reader(f)());
  assert.equal(after.resources[0].status, "in-step");
  assert.deepEqual(after.resources[0].differences, []);

  const resourceId = after.resources[0].id;
  f.sqlite
    .prepare("UPDATE creator_app_resources SET state='unknown' WHERE id=?")
    .run(resourceId);
  f.sqlite
    .prepare(
      "INSERT INTO creator_resource_operations(id,resource_id,stack_id,instance_id,action,state,source_revision,request_json) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      "fictional-operation-0001",
      resourceId,
      stack.id,
      "fictional-instance-0002",
      "stage",
      "pending",
      "e".repeat(40),
      "{}",
    );
  const uncertain = resourceInventory.parse(await reader(f)());
  const unknown = uncertain.resources[0];
  assert.equal(unknown.status, "unknown");
  assert.equal(unknown.unfinishedOperation.state, "pending");
  assert.ok(
    unknown.findings.some((finding) => finding.code === "unfinished-operation"),
  );
  assert.equal(uncertain.counts.unknown, 1);

  f.sqlite
    .prepare(
      "UPDATE creator_app_resources SET account_id='another-account' WHERE id=?",
    )
    .run(resourceId);
  const mismatch = resourceInventory.parse(await reader(f)());
  assert.ok(
    mismatch.resources[0].findings.some(
      (finding) => finding.code === "target-mismatch",
    ),
  );
});

test("unbound records and an empty workspace stay explicit", async (t) => {
  const empty = fixture();
  t.after(() => empty.close());
  const emptyWorkspace = await workspaceForUser(empty.db, user);
  const blank = resourceInventory.parse(await reader(empty)());
  assert.deepEqual(blank.resources, []);
  assert.deepEqual(blank.counts, {
    inStep: 0,
    stale: 0,
    attention: 0,
    unknown: 0,
    unbound: 0,
  });
  assert.equal(blank.atLimit, false);
  assert.equal(blank.workspace.id, emptyWorkspace.id);

  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);
  f.sqlite
    .prepare(
      "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,version,state,configuration_revision,configuration_digest,configuration_source,configuration_json) VALUES(?,?,'guestbook',?,?,?,1,'ready',1,?,?,?)",
    )
    .run(
      "fictional-unbound-0001",
      workspace.id,
      account,
      "production",
      origin + "/guestbook",
      "f".repeat(64),
      "a".repeat(40),
      JSON.stringify({
        title: "Fictional unused book",
        intro: "",
        theme: "midnight",
        layout: "grid",
        guestAccess: "closed",
      }),
    );
  const unbound = resourceInventory.parse(await reader(f)());
  assert.equal(unbound.resources.length, 1);
  assert.equal(unbound.resources[0].status, "unbound");
  assert.equal(unbound.resources[0].expected.basis, "unavailable");
  assert.ok(
    unbound.resources[0].findings.some(
      (finding) => finding.code === "no-binding",
    ),
  );
  assert.equal(unbound.counts.unbound, 1);
});

test("the read refuses unknown environments, other origins and closed selectors", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);

  const wrongOrigin = await manageResourceInventory(
    {
      user,
      input: { action: "list" },
      request: new Request(
        origin + "/_emdash/api/plugins/composer-stacks/resourcesRead",
        {
          headers: { Origin: "https://elsewhere.example" },
        },
      ),
    },
    f.runtime,
  );
  assert.equal(wrongOrigin.ok, false);
  assert.equal(wrongOrigin.code, "FORBIDDEN");

  const wrongEnvironment = await manageResourceInventory(
    {
      user,
      input: { action: "list" },
      request: new Request(
        origin + "/_emdash/api/plugins/composer-stacks/resourcesRead",
        {
          headers: { Origin: origin },
        },
      ),
    },
    { ...f.runtime, PUBLIC_ORIGIN: "https://preview.example" },
  );
  assert.equal(wrongEnvironment.ok, false);
  assert.equal(wrongEnvironment.code, "UNAVAILABLE");

  const missingDatabase = await manageResourceInventory(
    {
      user,
      input: { action: "list" },
      request: new Request(
        origin + "/_emdash/api/plugins/composer-stacks/resourcesRead",
        {
          headers: { Origin: origin },
        },
      ),
    },
    { ...f.runtime, DB: undefined },
  );
  assert.equal(missingDatabase.ok, false);
  assert.equal(missingDatabase.code, "UNAVAILABLE");

  const stranger = { id: "fictional-stranger-0001", role: 50 };
  const outside = await reader(
    f,
    stranger,
  )({
    action: "list",
    workspace: workspace.id,
  });
  assert.equal(outside.ok, false);
  assert.equal(outside.code, "FORBIDDEN");

  const nonCreator = await reader(f, { ...user, role: 10 })({ action: "list" });
  assert.equal(nonCreator.ok, false);
  assert.equal(nonCreator.code, "FORBIDDEN");

  const duplicate = await reader(
    f,
    user,
    origin +
      "/_emdash/api/plugins/composer-stacks/resourcesRead?workspace=aaaaaaaa&workspace=bbbbbbbb",
  )({ action: "list", workspace: workspace.id });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "INVALID");
});

test("a viewer can read the same recorded inventory", async (t) => {
  const f = fixture();
  t.after(() => f.close());
  const workspace = await workspaceForUser(f.db, user);
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(workspace.id, user.id);
  const snapshot = resourceInventory.parse(
    await reader(f)({ action: "list", workspace: workspace.id }),
  );
  assert.equal(snapshot.workspace.role, "viewer");
  assert.deepEqual(snapshot.resources, []);
});

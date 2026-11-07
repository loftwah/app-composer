import test from "node:test";
import assert from "node:assert/strict";
import { workflowSnapshot } from "../src/lib/workflow-contract.ts";
import {
  workflowLead,
  workflowIsoTime,
} from "../src/lib/workflow-lead.ts";

const IDs = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];

function run(overrides) {
  return {
    id: IDs[0],
    recipe: "release-summary",
    event: "stack.published/1:stack-fixture:3",
    source: "stack-fixture",
    sourceRevision: 3,
    recipeRevision: 2,
    synthetic: false,
    state: "finished",
    revision: 1,
    attempts: 1,
    steps: ["observed", "source-checked", "draft-prepared"],
    result: {
      title: "Fictional stack · revision 3",
      body: "Prepared from the exact stored public revision 3.",
      href: "/s/fictional-stack",
    },
    message: "The current immutable publication was checked.",
    createdAt: "2026-11-06 23:00:00",
    retryable: false,
    ...overrides,
  };
}

function snapshot({ recipes = {}, runs = [] } = {}) {
  return workflowSnapshot.parse({
    ok: true,
    version: "composer.workflow/1",
    workspace: {
      id: "workspace-fixture",
      name: "Fictional studio",
      role: "owner",
    },
    target: { account: "1000000000000000", environment: "production" },
    recipes: [
      {
        id: "release-summary",
        name: "A summary after publication",
        revision: 2,
        enabled: true,
        scopeMatches: true,
        ...recipes["release-summary"],
      },
      {
        id: "operation-attention",
        name: "A failed task needs attention",
        revision: 2,
        enabled: true,
        scopeMatches: true,
        ...recipes["operation-attention"],
      },
    ],
    runs,
    limit: 500,
    runner: "on-demand-native",
  });
}

test("a retryable needs-attention run leads even when a newer run finished", () => {
  const attention = run({
    id: IDs[0],
    recipe: "operation-attention",
    event: "platform.needs-attention/1:request-fixture:1",
    source: "request-fixture",
    sourceRevision: 1,
    state: "needs-attention",
    steps: ["observed"],
    result: null,
    message: "The source is still failing.",
    retryable: true,
    createdAt: "2026-11-06 20:00:00",
  });
  const finished = run({ id: IDs[1], createdAt: "2026-11-06 23:00:00" });
  const lead = workflowLead(snapshot({ runs: [finished, attention] }));
  assert.equal(lead.kind, "attention");
  assert.equal(lead.run.id, IDs[0]);
  assert.equal(lead.recipe.id, "operation-attention");
  assert.equal(lead.run.event, "platform.needs-attention/1:request-fixture:1");
  assert.equal(lead.run.retryable, true);
});

test("a retryable run whose recipe is paused is not led with an unsupported retry", () => {
  const lead = workflowLead(
    snapshot({
      recipes: { "operation-attention": { enabled: false } },
      runs: [
        run({
          recipe: "operation-attention",
          state: "needs-attention",
          result: null,
          retryable: true,
        }),
      ],
    }),
  );
  assert.equal(lead.kind, "waiting");
  assert.equal(lead.recipe.id, "release-summary");
});

test("the latest finished run leads with its result and existing scan option", () => {
  const lead = workflowLead(
    snapshot({
      runs: [
        run({ id: IDs[1], createdAt: "2026-11-06 21:00:00" }),
        run({ id: IDs[2], createdAt: "2026-11-06 22:00:00" }),
      ],
    }),
  );
  assert.equal(lead.kind, "finished");
  assert.equal(lead.run.id, IDs[2]);
  assert.equal(lead.run.result.href, "/s/fictional-stack");
  assert.equal(lead.scanAvailable, true);
});

test("a finished run without a result leads only when its recipe can scan", () => {
  const paused = workflowLead(
    snapshot({
      recipes: {
        "release-summary": { enabled: false },
        "operation-attention": { enabled: false },
      },
      runs: [run({ result: null, message: "No result was prepared." })],
    }),
  );
  assert.equal(paused.kind, "paused");
  assert.equal(paused.recipe.id, "release-summary");

  const scannable = workflowLead(
    snapshot({
      recipes: { "operation-attention": { enabled: false } },
      runs: [run({ result: null, message: "No result was prepared." })],
    }),
  );
  assert.equal(scannable.kind, "finished");
  assert.equal(scannable.scanAvailable, true);
});

test("sample runs stay in history and never become the page lead", () => {
  const real = run({ id: IDs[1], createdAt: "2026-11-06 21:00:00" });
  const sample = run({
    id: IDs[2],
    recipe: "operation-attention",
    synthetic: true,
    state: "needs-attention",
    result: null,
    retryable: true,
    createdAt: "2026-11-06 22:00:00",
  });
  const withReal = workflowLead(snapshot({ runs: [sample, real] }));
  assert.equal(withReal.kind, "finished");
  assert.equal(withReal.run.id, IDs[1]);

  const sampleOnly = workflowLead(
    snapshot({
      recipes: {
        "release-summary": { enabled: false },
        "operation-attention": { enabled: false },
      },
      runs: [sample],
    }),
  );
  assert.equal(sampleOnly.kind, "paused");
  assert.equal(sampleOnly.recipe.id, "release-summary");
});

test("an enabled recipe waiting for events leads when no run is retained", () => {
  const lead = workflowLead(
    snapshot({
      recipes: { "operation-attention": { enabled: false } },
    }),
  );
  assert.equal(lead.kind, "waiting");
  assert.equal(lead.recipe.id, "release-summary");
});

test("a paused recipe is the final lead and offers the existing enable action", () => {
  const lead = workflowLead(
    snapshot({
      recipes: {
        "release-summary": { enabled: false },
        "operation-attention": { enabled: false },
      },
    }),
  );
  assert.equal(lead.kind, "paused");
  assert.equal(lead.recipe.id, "release-summary");
});

test("stored UTC timestamps normalise before owner formatting", () => {
  assert.equal(
    workflowIsoTime("2026-11-06 23:00:00"),
    "2026-11-06T23:00:00.000Z",
  );
  assert.equal(
    workflowIsoTime("2026-11-06T23:00:00.000Z"),
    "2026-11-06T23:00:00.000Z",
  );
  assert.equal(workflowIsoTime("not a time"), "not a time");
});

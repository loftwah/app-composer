import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fixture,
  saved,
  user,
  instance,
  origin,
} from "./helpers/resource-fixture.mjs";
import { workspaceForUser, publishStack } from "../src/lib/stacks.mjs";
import { manageWorkflows } from "../src/lib/workflows.ts";
import {
  exportWorkflow,
  workflowExport,
  workflowSnapshot,
} from "../src/lib/workflow-contract.ts";

async function prepared(t) {
  const f = fixture();
  t.after(() => f.close());
  f.sqlite.exec(
    readFileSync(
      new URL("../migrations/0012_workflows.sql", import.meta.url),
      "utf8",
    ),
  );
  const workspace = await workspaceForUser(f.db, user);
  const route = (input, reading = false, caller = user, headers = {}) =>
    manageWorkflows(
      {
        input,
        user: caller,
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/workflows",
          {
            method: reading ? "GET" : "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1", ...headers },
          },
        ),
      },
      f.runtime,
    );
  const activate = async (recipe) => {
    const reply = await route({
      action: "save",
      workspace: workspace.id,
      recipe,
      expectedRevision: 0,
      name: "Fictional useful recipe",
      enabled: true,
    });
    assert.equal(reply.ok, true, JSON.stringify(reply));
    return reply;
  };
  return { ...f, workspace, route, activate };
}

test("native recipes persist sample success, visible failure and a bounded safe recovery", async (t) => {
  const f = await prepared(t);
  for (const recipe of ["release-summary", "operation-attention"]) {
    const operation = crypto.randomUUID();
    const command = {
      action: "sample",
      workspace: f.workspace.id,
      recipe,
      operation,
      fail: true,
    };
    const failed = await f.route(command);
    assert.equal(failed.ok, true, JSON.stringify(failed));
    const run = failed.runs.find((run) => run.recipe === recipe);
    assert.equal(run.state, "needs-attention");
    assert.deepEqual(run.steps, ["observed"]);
    const duplicate = await f.route(command);
    assert.equal(
      duplicate.runs.filter((run) => run.recipe === recipe).length,
      1,
    );
    const retry = await f.route({
      action: "retry",
      workspace: f.workspace.id,
      run: run.id,
      expectedRevision: run.revision,
    });
    const recovered = retry.runs.find((next) => next.id === run.id);
    assert.equal(recovered.state, "finished");
    assert.equal(recovered.attempts, 2);
    assert.deepEqual(recovered.steps, [
      "observed",
      "source-checked",
      "draft-prepared",
    ]);
    assert.equal(recovered.synthetic, true);
    assert.match(recovered.result.body, /fictional/);
    const stale = await f.route({
      action: "retry",
      workspace: f.workspace.id,
      run: run.id,
      expectedRevision: run.revision,
    });
    assert.equal(stale.code, "CONFLICT");
  }
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_stacks").get().n,
    0,
  );
});

test("published stack recipe uses the immutable publication, deduplicates and respects pause", async (t) => {
  const f = await prepared(t);
  const draft = await saved(f, f.workspace.id, "Fictional published title", [
    instance("fictional-workflow-instance", "A fictional visitor book"),
  ]);
  const published = await publishStack(
    f.db,
    f.workspace.id,
    draft.id,
    draft.revision,
    draft.draft,
    user.id,
  );
  await f.activate("release-summary");
  f.sqlite
    .prepare("UPDATE creator_stacks SET name=? WHERE id=?")
    .run("Private draft name", draft.id);
  const command = {
    action: "scan",
    workspace: f.workspace.id,
    recipe: "release-summary",
    expectedRevision: 1,
  };
  const first = await f.route(command);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.runs.length, 1);
  assert.equal(first.runs[0].state, "finished");
  assert.match(first.runs[0].result.title, /Fictional published title/);
  assert.doesNotMatch(first.runs[0].result.title, /Private draft/);
  assert.equal(first.runs[0].sourceRevision, published.publishedRevision);
  assert.equal((await f.route(command)).runs.length, 1);
  const paused = await f.route({
    action: "save",
    workspace: f.workspace.id,
    recipe: "release-summary",
    expectedRevision: 1,
    name: "Paused recipe",
    enabled: false,
  });
  assert.equal(
    paused.recipes.find((recipe) => recipe.id === "release-summary").enabled,
    false,
  );
  assert.equal((await f.route(command)).code, "CONFLICT");
  const reopened = await f.route(
    { action: "list", workspace: f.workspace.id },
    true,
  );
  assert.equal(reopened.runs.length, 1);
  assert.equal(reopened.recipes[0].name, "Paused recipe");
});

async function failedRequest(f, id = "fictional-platform-failure") {
  await f.db
    .prepare(
      "INSERT INTO creator_platform_requests (id,workspace_id,actor_id,submission_key,request_json,plan_json,plan_digest,policy_revision,decision_json,status,reason) VALUES (?,?,?,?,?,?,?,?,?,'needs-attention',?)",
    )
    .bind(
      id,
      f.workspace.id,
      user.id,
      crypto.randomUUID(),
      "{}",
      JSON.stringify({
        target: {
          account: f.runtime.RESOURCE_ACCOUNT_ID,
          environment: f.runtime.RESOURCE_ENVIRONMENT,
          url: origin + "/guestbook",
        },
      }),
      "a".repeat(64),
      1,
      "{}",
      "Private provider diagnostic must not enter the draft",
    )
    .run();
  return id;
}
test("failed operation recipe creates one actionable result and never executes remediation", async (t) => {
  const f = await prepared(t),
    request = await failedRequest(f);
  await f.activate("operation-attention");
  const reply = await f.route({
    action: "scan",
    workspace: f.workspace.id,
    recipe: "operation-attention",
    expectedRevision: 1,
  });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(reply.runs.length, 1);
  assert.equal(reply.runs[0].source, request);
  assert.equal(reply.runs[0].state, "finished");
  assert.match(reply.runs[0].result.body, /authorises no remediation/);
  assert.equal(
    reply.runs[0].result.href,
    `/_emdash/admin/plugins/composer-stacks/platform?workspace=${f.workspace.id}`,
  );
  assert.doesNotMatch(
    JSON.stringify(reply.runs),
    /Private provider diagnostic/,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT status FROM creator_platform_requests WHERE id=?")
      .get(request).status,
    "needs-attention",
  );
});

test("wrong workspace, revoked membership, CSRF, malformed events and viewer writes are rejected", async (t) => {
  const f = await prepared(t),
    operation = crypto.randomUUID();
  const sample = {
    action: "sample",
    workspace: f.workspace.id,
    recipe: "release-summary",
    operation,
    fail: false,
  };
  assert.equal(
    (await f.route({ ...sample, workspace: "another-workspace" })).code,
    "FORBIDDEN",
  );
  assert.equal(
    (await f.route({ ...sample, event: { execute: "untrusted" } })).code,
    "INVALID",
  );
  assert.equal(
    (await f.route(sample, false, user, { Origin: "https://example.test" }))
      .code,
    "FORBIDDEN",
  );
  assert.equal(
    (await f.route(sample, false, user, { "X-EmDash-Request": "" })).code,
    "FORBIDDEN",
  );
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  assert.equal((await f.route(sample)).code, "FORBIDDEN");
  assert.equal(
    (await f.route({ action: "list", workspace: f.workspace.id }, true)).ok,
    true,
  );
  // Keep another workspace membership so this models revoked selected access,
  // rather than the existing first-person personal-workspace bootstrap.
  f.sqlite
    .prepare("INSERT INTO creator_workspaces(id,name) VALUES (?,?)")
    .run("another-owned-space", "Another fictional workspace");
  f.sqlite
    .prepare(
      "INSERT INTO creator_members(workspace_id,user_id,role) VALUES (?,?,'viewer')",
    )
    .run("another-owned-space", user.id);
  f.sqlite
    .prepare("DELETE FROM creator_members WHERE workspace_id=? AND user_id=?")
    .run(f.workspace.id, user.id);
  assert.equal(
    (await f.route({ action: "list", workspace: f.workspace.id }, true)).code,
    "FORBIDDEN",
  );
});

test("revocation or pause between observation and persistence prevents the new result", async (t) => {
  const f = await prepared(t);
  await failedRequest(f);
  await f.activate("operation-attention");
  const prepare = f.db.prepare.bind(f.db);
  let revoke = true;
  f.db.prepare = (sql) => {
    if (
      revoke &&
      sql.startsWith("INSERT OR IGNORE INTO creator_workflow_runs")
    ) {
      revoke = false;
      f.sqlite
        .prepare(
          "UPDATE creator_workflow_recipes SET enabled=0 WHERE workspace_id=?",
        )
        .run(f.workspace.id);
    }
    return prepare(sql);
  };
  const reply = await f.route({
    action: "scan",
    workspace: f.workspace.id,
    recipe: "operation-attention",
    expectedRevision: 1,
  });
  assert.equal(reply.code, "CONFLICT");
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    0,
  );
});

test("changed environment hides old receipts and stops activation and retries", async (t) => {
  const f = await prepared(t);
  await f.activate("release-summary");
  const sample = await f.route({
    action: "sample",
    workspace: f.workspace.id,
    recipe: "release-summary",
    operation: crypto.randomUUID(),
    fail: true,
  });
  f.runtime.RESOURCE_ENVIRONMENT = "different-environment";
  const reopened = await f.route(
    { action: "list", workspace: f.workspace.id },
    true,
  );
  assert.equal(reopened.runs.length, 0);
  assert.equal(reopened.recipes[0].scopeMatches, false);
  assert.equal(reopened.recipes[0].enabled, false);
  assert.equal(
    (
      await f.route({
        action: "scan",
        workspace: f.workspace.id,
        recipe: "release-summary",
        expectedRevision: 1,
      })
    ).code,
    "CONFLICT",
  );
  assert.equal(
    (
      await f.route({
        action: "retry",
        workspace: f.workspace.id,
        run: sample.runs[0].id,
        expectedRevision: 1,
      })
    ).code,
    "CONFLICT",
  );
});

test("explicitly enabling a recipe for a new environment does not adopt a historical frozen plan", async (t) => {
  const f = await prepared(t);
  await failedRequest(f);
  await f.activate("operation-attention");
  const frozen = f.sqlite
    .prepare("SELECT plan_json,plan_digest FROM creator_platform_requests")
    .get();
  const scan = {
    action: "scan",
    workspace: f.workspace.id,
    recipe: "operation-attention",
    expectedRevision: 1,
  };
  const first = await f.route(scan);
  assert.equal(first.runs.length, 1);
  f.runtime.RESOURCE_ENVIRONMENT = "different-environment";
  assert.equal((await f.route(scan)).code, "CONFLICT");
  const saved = await f.route({
    action: "save",
    workspace: f.workspace.id,
    recipe: "operation-attention",
    expectedRevision: 1,
    name: "Explicit new environment",
    enabled: true,
  });
  assert.equal(saved.ok, true);
  const second = await f.route({ ...scan, expectedRevision: 2 });
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.runs.length, 0);
  assert.deepEqual(
    f.sqlite
      .prepare("SELECT plan_json,plan_digest FROM creator_platform_requests")
      .get(),
    frozen,
  );
  await failedRequest(f, "fictional-new-environment-failure");
  const matched = await f.route({ ...scan, expectedRevision: 2 });
  assert.equal(matched.runs.length, 1);
  assert.notEqual(matched.runs[0].id, first.runs[0].id);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    2,
  );
});

test("foreign account environment origin and malformed frozen targets are ineligible for scans", async (t) => {
  const f = await prepared(t);
  await f.activate("operation-attention");
  for (const [index, plan] of [
    {
      target: {
        account: "other-account",
        environment: f.runtime.RESOURCE_ENVIRONMENT,
        url: origin + "/guestbook",
      },
    },
    {
      target: {
        account: f.runtime.RESOURCE_ACCOUNT_ID,
        environment: "other-environment",
        url: origin + "/guestbook",
      },
    },
    {
      target: {
        account: f.runtime.RESOURCE_ACCOUNT_ID,
        environment: f.runtime.RESOURCE_ENVIRONMENT,
        url: "https://example.test/guestbook",
      },
    },
    "invalid JSON",
    {},
  ].entries()) {
    const id = await failedRequest(f, "fictional-wrong-plan-" + index);
    f.sqlite
      .prepare("UPDATE creator_platform_requests SET plan_json=? WHERE id=?")
      .run(typeof plan === "string" ? plan : JSON.stringify(plan), id);
  }
  const reply = await f.route({
    action: "scan",
    workspace: f.workspace.id,
    recipe: "operation-attention",
    expectedRevision: 1,
  });
  assert.equal(reply.ok, true);
  assert.equal(reply.runs.length, 0);
});

test("a frozen target changing at the final insert cannot create a receipt in the previous environment", async (t) => {
  const f = await prepared(t),
    request = await failedRequest(f);
  await f.activate("operation-attention");
  const prepare = f.db.prepare.bind(f.db);
  let changed = false;
  f.db.prepare = (sql) => {
    if (
      !changed &&
      sql.startsWith("INSERT OR IGNORE INTO creator_workflow_runs")
    ) {
      changed = true;
      f.sqlite
        .prepare("UPDATE creator_platform_requests SET plan_json=? WHERE id=?")
        .run(
          JSON.stringify({
            target: {
              account: f.runtime.RESOURCE_ACCOUNT_ID,
              environment: "changed-environment",
              url: origin + "/guestbook",
            },
          }),
          request,
        );
    }
    return prepare(sql);
  };
  const reply = await f.route({
    action: "scan",
    workspace: f.workspace.id,
    recipe: "operation-attention",
    expectedRevision: 1,
  });
  assert.equal(reply.code, "CONFLICT");
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    0,
  );
});

test("a source recovering during scan cannot create an obsolete attention result", async (t) => {
  const f = await prepared(t),
    request = await failedRequest(f);
  await f.activate("operation-attention");
  const prepare = f.db.prepare.bind(f.db);
  let recovered = false;
  f.db.prepare = (sql) => {
    if (
      !recovered &&
      sql.startsWith("INSERT OR IGNORE INTO creator_workflow_runs")
    ) {
      recovered = true;
      f.sqlite
        .prepare(
          "UPDATE creator_platform_requests SET status='complete',revision=revision+1 WHERE id=?",
        )
        .run(request);
    }
    return prepare(sql);
  };
  const reply = await f.route({
    action: "scan",
    workspace: f.workspace.id,
    recipe: "operation-attention",
    expectedRevision: 1,
  });
  assert.equal(reply.code, "CONFLICT");
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    0,
  );
});

test("revoked selected membership during history read cannot expose a snapshot", async (t) => {
  const f = await prepared(t);
  await f.route({
    action: "sample",
    workspace: f.workspace.id,
    recipe: "release-summary",
    operation: crypto.randomUUID(),
    fail: false,
  });
  const prepare = f.db.prepare.bind(f.db);
  let revoked = false;
  f.db.prepare = (sql) => {
    if (
      !revoked &&
      sql.startsWith("SELECT * FROM creator_workflow_runs WHERE workspace_id=")
    ) {
      revoked = true;
      f.sqlite
        .prepare(
          "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .run(f.workspace.id, user.id);
    }
    return prepare(sql);
  };
  const reply = await f.route(
    { action: "list", workspace: f.workspace.id },
    true,
  );
  assert.equal(reply.code, "FORBIDDEN");
  assert.equal("runs" in reply, false);
});

test("export/import preserves identity, rejects executable fields, mismatched actions and secrets", () => {
  const exported = exportWorkflow("release-summary", "A useful recipe");
  assert.deepEqual(
    workflowExport.parse(JSON.parse(JSON.stringify(exported))),
    exported,
  );
  for (const value of [
    { ...exported, command: "execute" },
    { ...exported, action: "prepare-attention" },
    { ...exported, connectionReferences: ["secret-value"] },
    { ...exported, recipe: "constructor" },
    { ...exported, token: "private" },
  ])
    assert.equal(workflowExport.safeParse(value).success, false);
  assert.equal(
    workflowSnapshot.safeParse({ ok: true, workspace: { id: "other-scope" } })
      .success,
    false,
  );
});

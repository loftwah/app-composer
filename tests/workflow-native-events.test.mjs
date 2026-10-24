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
import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { applyStackResources } from "../src/lib/stack-resources.ts";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";
import { afterNativeWorkflowWrite } from "../src/lib/workflow-events.ts";

// Exercise the installed EmDash dispatcher and the actual native declarations,
// not a second route registry or direct caller-supplied workflow events.
const runtimeEntry = new URL(
  import.meta.resolve("emdash/internal/plugin-test-runtime"),
);
const dispatcherImport = readFileSync(runtimeEntry, "utf8").match(
  /import \{[^}]*?([A-Za-z]+) as dispatchPluginApiRequest[^}]*?\} from "([^"]+)"/,
);
assert.ok(dispatcherImport);
const dispatch = (await import(new URL(dispatcherImport[2], runtimeEntry)))[
  dispatcherImport[1]
];

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
  f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
  const source = f.runtime.GUESTBOOK;
  f.runtime.GUESTBOOK = {
    fetch(request) {
      if (
        /^\/guestbook\/r\/[a-z0-9-]+\/c\/\d+\/$/.test(
          new URL(request.url).pathname,
        )
      )
        return Promise.resolve(
          new Response("<!doctype html><title>Fictional guestbook</title>", {
            headers: { "Content-Type": "text/html" },
          }),
        );
      return source.fetch(request);
    },
  };
  const plugin = creatorPlugin("fictional-native-admin", f.runtime);
  const transport = {
    getPluginRouteMeta(pluginID, path) {
      assert.equal(pluginID, "composer-stacks");
      return plugin.routes[path.slice(1)];
    },
    async handlePluginApiRoute(pluginID, method, path, request, actor) {
      assert.equal(pluginID, "composer-stacks");
      return {
        success: true,
        data: await plugin.routes[path.slice(1)].handler({
          request,
          user: actor,
          input:
            method === "GET"
              ? Object.fromEntries(new URL(request.url).searchParams)
              : await request.json(),
        }),
      };
    },
  };
  const call = async (route, input, reading = false, actor = user) => {
    const url =
      origin +
      "/_emdash/api/plugins/composer-stacks/" +
      route +
      (reading ? "?" + new URLSearchParams(input) : "");
    const response = await dispatch({
      runtime: transport,
      pluginId: "composer-stacks",
      path: "/" + route,
      user: actor,
      request: new Request(url, {
        method: reading ? "GET" : "POST",
        headers: {
          Origin: origin,
          "X-EmDash-Request": "1",
          "Content-Type": "application/json",
        },
        ...(reading ? {} : { body: JSON.stringify(input) }),
      }),
    });
    const envelope = await response.json();
    return {
      status: response.status,
      body:
        envelope.success === true && Object.hasOwn(envelope, "data")
          ? envelope.data
          : envelope,
    };
  };
  const activate = async (recipe) => {
    const response = await call("workflowsWrite", {
      action: "save",
      workspace: workspace.id,
      recipe,
      expectedRevision: 0,
      name: "Fictional event recipe",
      enabled: true,
    });
    assert.equal(response.body.ok, true, JSON.stringify(response.body));
  };
  const readyStack = async () => {
    const draft = await saved(f, workspace.id, "Fictional native event page", [
      instance("fictional-native-event-instance", "Fictional book"),
    ]);
    const applied = await applyStackResources(
      f.db,
      user.id,
      workspace.id,
      draft.id,
      draft.revision,
      f.runtime,
    );
    return applied.stack;
  };
  return { ...f, workspace, plugin, call, activate, readyStack };
}
const profile = {
  enabled: true,
  reviewRequired: false,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
};
const appRequest = {
  version: 1,
  name: "Fictional native workflow service",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
};

test("native publish and republish declarations automatically prepare one draft per exact publication", async (t) => {
  const f = await prepared(t);
  await f.activate("release-summary");
  const stack = await f.readyStack();
  const published = await f.call("write", {
    action: "publish",
    workspace: f.workspace.id,
    stack: stack.id,
    expectedRevision: stack.revision,
  });
  assert.equal(published.body.ok, true, JSON.stringify(published.body));
  assert.equal(published.body.stack.status, "published");
  const run = f.sqlite.prepare("SELECT * FROM creator_workflow_runs").get();
  assert.ok(
    run,
    "The actual publish route must invoke its registered follow-up",
  );
  assert.equal(run.recipe, "release-summary");
  assert.equal(run.state, "finished");
  assert.equal(run.synthetic, 0);
  assert.match(
    JSON.parse(run.result_json).title,
    /Fictional native event page/,
  );
  const republished = await f.call("write", {
    action: "republish",
    workspace: f.workspace.id,
    stack: stack.id,
    revision: published.body.stack.publishedRevision,
    expectedRevision: published.body.stack.revision,
  });
  assert.equal(republished.body.ok, true, JSON.stringify(republished.body));
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    1,
  );
  assert.equal(
    republished.body.stack.publishedRevision,
    published.body.stack.publishedRevision,
  );
});

test("an actual failed native platform write automatically becomes a scoped attention draft without changing its frozen plan", async (t) => {
  const f = await prepared(t);
  await f.activate("operation-attention");
  assert.equal(
    (
      await f.call("platformWrite", {
        action: "configure",
        workspace: f.workspace.id,
        expectedRevision: 0,
        profile,
      })
    ).body.ok,
    true,
  );
  f.app.badBuild(true);
  const key = crypto.randomUUID();
  const command = {
    action: "submit",
    workspace: f.workspace.id,
    key,
    request: appRequest,
  };
  const failed = await f.call("platformWrite", command);
  assert.equal(failed.body.ok, true, JSON.stringify(failed.body));
  assert.equal(failed.body.requests[0].status, "needs-attention");
  const request = f.sqlite
    .prepare("SELECT * FROM creator_platform_requests WHERE submission_key=?")
    .get(key);
  const run = f.sqlite.prepare("SELECT * FROM creator_workflow_runs").get();
  assert.ok(
    run,
    "The actual failed-operation route must invoke its registered follow-up",
  );
  assert.equal(run.recipe, "operation-attention");
  assert.equal(run.source_id, request.id);
  assert.equal(run.source_revision, request.revision);
  assert.equal(run.state, "finished");
  const immutable = {
    plan_json: request.plan_json,
    plan_digest: request.plan_digest,
  };
  const duplicate = await f.call("platformWrite", command);
  assert.equal(duplicate.body.ok, true);
  assert.deepEqual(
    f.sqlite
      .prepare(
        "SELECT plan_json,plan_digest FROM creator_platform_requests WHERE id=?",
      )
      .get(request.id),
    Object.assign(Object.create(null), immutable),
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    1,
  );
  assert.doesNotMatch(
    run.result_json,
    /plan_json|GUESTBOOK_OWNER_TOKEN|Authorization/,
  );
});

test("a successful native platform publication also reaches the same summary recipe", async (t) => {
  const f = await prepared(t);
  await f.activate("release-summary");
  await f.call("platformWrite", {
    action: "configure",
    workspace: f.workspace.id,
    expectedRevision: 0,
    profile,
  });
  const response = await f.call("platformWrite", {
    action: "submit",
    workspace: f.workspace.id,
    key: crypto.randomUUID(),
    request: appRequest,
  });
  assert.equal(response.body.ok, true, JSON.stringify(response.body));
  assert.equal(
    response.body.requests[0].status,
    "complete",
    JSON.stringify(response.body),
  );
  const run = f.sqlite.prepare("SELECT * FROM creator_workflow_runs").get();
  assert.ok(run);
  assert.equal(run.recipe, "release-summary");
  assert.equal(run.source_id, response.body.requests[0].stackId);
  assert.equal(run.state, "finished");
});

test("platform revision or target drift at the final capture predicate cannot inherit the earlier observation", async (t) => {
  for (const drift of [
    "revision",
    "account",
    "environment",
    "origin",
    "malformed",
  ]) {
    const f = await prepared(t);
    await f.activate("operation-attention");
    await f.call("platformWrite", {
      action: "configure",
      workspace: f.workspace.id,
      expectedRevision: 0,
      profile,
    });
    f.app.badBuild(true);
    const prepare = f.db.prepare.bind(f.db);
    let changed = false,
      prior;
    t.mock.method(console, "warn", () => {});
    f.db.prepare = (sql) => {
      if (
        !changed &&
        sql.startsWith("INSERT OR IGNORE INTO creator_workflow_runs")
      ) {
        changed = true;
        prior = f.sqlite
          .prepare(
            "SELECT id,plan_json,plan_digest,revision FROM creator_platform_requests",
          )
          .get();
        if (drift === "revision")
          f.sqlite
            .prepare(
              "UPDATE creator_platform_requests SET revision=revision+1 WHERE id=?",
            )
            .run(prior.id);
        else {
          const plan = JSON.parse(prior.plan_json);
          if (drift === "account") plan.target.account = "other-account";
          if (drift === "environment")
            plan.target.environment = "other-environment";
          if (drift === "origin")
            plan.target.url = "https://example.test/guestbook";
          f.sqlite
            .prepare(
              "UPDATE creator_platform_requests SET plan_json=? WHERE id=?",
            )
            .run(
              drift === "malformed" ? "invalid JSON" : JSON.stringify(plan),
              prior.id,
            );
        }
      }
      return prepare(sql);
    };
    const response = await f.call("platformWrite", {
      action: "submit",
      workspace: f.workspace.id,
      key: crypto.randomUUID(),
      request: appRequest,
    });
    assert.equal(response.body.ok, true);
    assert.equal(changed, true);
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get()
        .n,
      0,
    );
    const retained = f.sqlite
      .prepare(
        "SELECT status,plan_json,plan_digest FROM creator_platform_requests",
      )
      .get();
    assert.equal(retained.status, "needs-attention");
    assert.equal(
      retained.plan_digest,
      prior.plan_digest,
      "The hook never rewrites the frozen digest",
    );
    if (drift === "revision") {
      assert.equal(retained.plan_json, prior.plan_json);
      f.db.prepare = prepare;
      const recovered = await f.call("workflowsWrite", {
        action: "scan",
        workspace: f.workspace.id,
        recipe: "operation-attention",
        expectedRevision: 1,
      });
      assert.equal(recovered.body.ok, true);
      assert.equal(recovered.body.runs.length, 1);
      assert.equal(recovered.body.runs[0].sourceRevision, prior.revision + 1);
    }
  }
});

test("pause, read-only routes and denied source writes create no automatic effects", async (t) => {
  const f = await prepared(t);
  await f.activate("release-summary");
  await f.call("workflowsWrite", {
    action: "save",
    workspace: f.workspace.id,
    recipe: "release-summary",
    expectedRevision: 1,
    name: "Paused recipe",
    enabled: false,
  });
  const stack = await f.readyStack();
  const published = await f.call("write", {
    action: "publish",
    workspace: f.workspace.id,
    stack: stack.id,
    expectedRevision: stack.revision,
  });
  assert.equal(published.body.ok, true);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    0,
  );
  await f.call("workflowsWrite", {
    action: "save",
    workspace: f.workspace.id,
    recipe: "release-summary",
    expectedRevision: 2,
    name: "Enabled recipe",
    enabled: true,
  });
  await f.call("read", { action: "list", workspace: f.workspace.id }, true);
  await f.call(
    "platformRead",
    { action: "list", workspace: f.workspace.id },
    true,
  );
  await f.call(
    "workflowsRead",
    { action: "list", workspace: f.workspace.id },
    true,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    0,
    "GET never repairs missed events",
  );
  const denied = await f.call("write", {
    action: "publish",
    workspace: f.workspace.id,
    stack: stack.id,
    expectedRevision: stack.revision,
  });
  assert.equal(denied.body.ok, false);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    0,
  );
  const recovered = await f.call("workflowsWrite", {
    action: "scan",
    workspace: f.workspace.id,
    recipe: "release-summary",
    expectedRevision: 3,
  });
  assert.equal(recovered.body.ok, true);
  assert.equal(recovered.body.runs.length, 1);
});

test("post-hook failure retains the confirmed source response and explicit Scan recovers without republishing", async (t) => {
  const f = await prepared(t);
  await f.activate("release-summary");
  const stack = await f.readyStack(),
    prepare = f.db.prepare.bind(f.db);
  const warnings = [];
  t.mock.method(console, "warn", (value) => warnings.push(value));
  f.db.prepare = (sql) => {
    if (sql.startsWith("INSERT OR IGNORE INTO creator_workflow_runs"))
      throw Error("CANARY_PRIVATE_POSTHOOK_ERROR");
    return prepare(sql);
  };
  const published = await f.call("write", {
    action: "publish",
    workspace: f.workspace.id,
    stack: stack.id,
    expectedRevision: stack.revision,
  });
  assert.equal(published.body.ok, true, JSON.stringify(published.body));
  const source = f.sqlite
    .prepare(
      "SELECT revision,published_revision,published_json FROM creator_stacks WHERE id=?",
    )
    .get(stack.id);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get().n,
    0,
  );
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(JSON.stringify(warnings), /CANARY_PRIVATE/);
  f.db.prepare = prepare;
  const recovered = await f.call("workflowsWrite", {
    action: "scan",
    workspace: f.workspace.id,
    recipe: "release-summary",
    expectedRevision: 1,
  });
  assert.equal(recovered.body.ok, true);
  assert.equal(recovered.body.runs.length, 1);
  assert.deepEqual(
    f.sqlite
      .prepare(
        "SELECT revision,published_revision,published_json FROM creator_stacks WHERE id=?",
      )
      .get(stack.id),
    source,
  );
  const success = published.body;
  assert.equal(
    await afterNativeWorkflowWrite(
      "stacks",
      {
        user,
        input: { action: "publish" },
        request: new Request(origin, {
          method: "POST",
          headers: { Origin: origin, "X-EmDash-Request": "1" },
        }),
      },
      f.runtime,
      success,
    ),
    success,
    "An authorised successful response keeps its exact object identity",
  );
  const response = {
    ok: false,
    code: "UNAVAILABLE",
    marker: { retained: true },
  };
  assert.equal(
    await afterNativeWorkflowWrite(
      "stacks",
      {
        user,
        input: { action: "publish" },
        request: new Request(origin, {
          method: "POST",
          headers: { Origin: origin, "X-EmDash-Request": "1" },
        }),
      },
      f.runtime,
      response,
    ),
    response,
  );
});

test("revocation or pause at the persisted follow-up boundary cannot create a draft after a confirmed publication", async (t) => {
  for (const change of ["revoke", "pause"]) {
    const f = await prepared(t);
    await f.activate("release-summary");
    const stack = await f.readyStack();
    const prepare = f.db.prepare.bind(f.db);
    let changed = false;
    t.mock.method(console, "warn", () => {});
    f.db.prepare = (sql) => {
      if (
        !changed &&
        sql.startsWith("INSERT OR IGNORE INTO creator_workflow_runs")
      ) {
        changed = true;
        if (change === "revoke")
          f.sqlite
            .prepare(
              "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
            )
            .run(f.workspace.id, user.id);
        else
          f.sqlite
            .prepare(
              "UPDATE creator_workflow_recipes SET enabled=0 WHERE workspace_id=?",
            )
            .run(f.workspace.id);
      }
      return prepare(sql);
    };
    const published = await f.call("write", {
      action: "publish",
      workspace: f.workspace.id,
      stack: stack.id,
      expectedRevision: stack.revision,
    });
    assert.equal(published.body.ok, change === "pause");
    if (change === "revoke") {
      assert.equal(published.body.code, "FORBIDDEN");
      assert.match(published.body.message, /may already have completed/);
      assert.match(published.body.message, /Do not replay/);
      assert.equal(published.body.stack, undefined);
    }
    assert.equal(
      f.sqlite
        .prepare("SELECT status FROM creator_stacks WHERE id=?")
        .get(stack.id).status,
      "published",
    );
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get()
        .n,
      0,
    );
  }
});

test("final response access is checked after capture and its read failure cannot return the old private snapshot", async (t) => {
  for (const failure of ["revoked", "unavailable"]) {
    const f = await prepared(t);
    await f.activate("release-summary");
    const stack = await f.readyStack();
    const prepare = f.db.prepare.bind(f.db);
    let captured = false,
      checked = false;
    f.db.prepare = (sql) => {
      if (sql.startsWith("INSERT OR IGNORE INTO creator_workflow_runs"))
        captured = true;
      if (
        captured &&
        !checked &&
        sql.includes("SELECT role FROM creator_members")
      ) {
        checked = true;
        if (failure === "unavailable")
          throw Error("CANARY_PRIVATE_MEMBERSHIP_ERROR");
        f.sqlite
          .prepare(
            "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
          )
          .run(f.workspace.id, user.id);
      }
      return prepare(sql);
    };
    const response = await f.call("write", {
      action: "publish",
      workspace: f.workspace.id,
      stack: stack.id,
      expectedRevision: stack.revision,
    });
    assert.equal(checked, true);
    assert.equal(response.body.ok, false);
    assert.equal(
      response.body.code,
      failure === "revoked" ? "FORBIDDEN" : "UNAVAILABLE",
    );
    assert.match(response.body.message, /Do not replay/);
    assert.equal(response.body.stack, undefined);
    assert.doesNotMatch(JSON.stringify(response.body), /CANARY_PRIVATE/);
    assert.equal(
      f.sqlite
        .prepare("SELECT status FROM creator_stacks WHERE id=?")
        .get(stack.id).status,
      "published",
    );
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_workflow_runs").get()
        .n,
      1,
      "The effect completed under valid authority before final response access changed",
    );
  }
});

test("unrelated successful actions and existing error responses retain their contracts without a new membership read", async () => {
  const response = {
    ok: true,
    workspace: { id: "fictional-workspace" },
    sentinel: { unchanged: true },
  };
  const error = {
    ok: false,
    code: "CONFLICT",
    message: "Existing source failure",
  };
  const runtime = {
    DB: {
      prepare() {
        throw Error("No follow-up should run");
      },
    },
    PUBLIC_ORIGIN: origin,
  };
  const ctx = {
    user,
    input: { action: "save" },
    request: new Request(origin, {
      method: "POST",
      headers: { Origin: origin, "X-EmDash-Request": "1" },
    }),
  };
  assert.equal(
    await afterNativeWorkflowWrite("stacks", ctx, runtime, response),
    response,
  );
  assert.equal(
    await afterNativeWorkflowWrite(
      "platform",
      { ...ctx, input: { action: "run" } },
      runtime,
      error,
    ),
    error,
  );
});

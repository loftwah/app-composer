import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, user, account, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { manageOverview } from "../src/lib/overview.ts";
import { overviewSnapshot } from "../src/lib/overview-contract.ts";
async function prepared(t, extra = true) {
  const f = fixture();
  t.after(() => f.close());
  if (extra)
    for (const file of ["0012_workflows.sql", "0013_enquiry_notifications.sql"])
      f.sqlite.exec(
        readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
      );
  const workspace = await workspaceForUser(f.db, user);
  const route = (
    input = { action: "list", workspace: workspace.id },
    runtime = f.runtime,
    caller = user,
  ) =>
    manageOverview(
      {
        input,
        user: caller,
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/overviewRead",
          { headers: { Origin: origin } },
        ),
      },
      runtime,
    );
  const now = "2026-10-24 05:00:00";
  const platform = (
    id,
    scope = workspace.id,
    targetAccount = account,
    targetEnvironment = "production",
  ) =>
    f.sqlite
      .prepare(
        "INSERT INTO creator_platform_requests(id,workspace_id,actor_id,submission_key,request_json,plan_json,plan_digest,policy_revision,decision_json,status,reason,created_at,updated_at) VALUES(?,?,?,?,'{}',?,'fixture-digest',1,'{}','needs-attention','Private error text',?,?)",
      )
      .run(
        id,
        scope,
        user.id,
        id,
        JSON.stringify({
          target: { account: targetAccount, environment: targetEnvironment },
        }),
        now,
        now,
      );
  const workflow = (
    id,
    source = "fictional-source-0001",
    environment = "production",
    synthetic = 0,
  ) =>
    f.sqlite
      .prepare(
        "INSERT INTO creator_workflow_runs(id,workspace_id,recipe,event_id,source_id,source_revision,account_id,environment,recipe_revision,synthetic,state,steps_json,message,created_at,updated_at) VALUES(?,?,'operation-attention',?,?,1,?,?,1,?,'needs-attention','[]','Private workflow message',?,?)",
      )
      .run(
        id,
        workspace.id,
        id,
        source,
        account,
        environment,
        synthetic,
        now,
        now,
      );
  const resource = "fictional-attention-resource";
  const notification = (id, state = "failed") => {
    f.sqlite
      .prepare(
        "INSERT OR IGNORE INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,'production','https://guestbook.loftwah.com','ready')",
      )
      .run(resource, workspace.id, account);
    f.sqlite
      .prepare(
        "INSERT INTO creator_enquiry_notification_outbox(id,workspace_id,resource_id,event_id,account_id,environment,target,owner_id,state,reason,created_at,updated_at) VALUES(?,?,?,?,?,'production','https://guestbook.loftwah.com',?,?,'Private provider payload',?,?)",
      )
      .run(id, workspace.id, resource, id, account, user.id, state, now, now);
  };
  return { ...f, workspace, route, platform, workflow, notification, resource };
}

test("overview groups actual retained problems with exact scope links and no private message copies", async (t) => {
  const f = await prepared(t);
  f.platform("fictional-platform-0001");
  f.workflow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
  f.workflow("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2");
  f.notification("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
  f.notification("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", "uncertain");
  const reply = overviewSnapshot.parse(await f.route());
  assert.equal(reply.items.length, 3);
  assert.equal(reply.sources.find((s) => s.id === "workflows").count, 2);
  assert.equal(reply.sources.find((s) => s.id === "notifications").count, 2);
  assert.match(
    reply.items.find((i) => i.source === "notifications").href,
    new RegExp(
      "workspace=" +
        f.workspace.id +
        "&resource=" +
        f.resource +
        "&item=" +
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" +
        "#notification-",
    ),
  );
  assert.equal(reply.items.find((i) => i.source === "workflows").count, 2);
  assert.equal(reply.items[0].firstObserved, "2026-10-24T05:00:00.000Z");
  assert.doesNotMatch(
    JSON.stringify(reply),
    /Private error|Private workflow|Private provider/,
  );
});
test("other account environment workspace and synthetic runs never become current problems", async (t) => {
  const f = await prepared(t);
  f.platform("fictional-other-account", f.workspace.id, "another-account");
  f.platform("fictional-other-environment", f.workspace.id, account, "preview");
  f.workflow(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "fictional-source-0001",
    "preview",
  );
  f.workflow(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    "fictional-source-0001",
    "production",
    1,
  );
  const reply = overviewSnapshot.parse(await f.route());
  assert.equal(reply.items.length, 0);
  assert.ok(reply.sources.every((source) => source.count === 0));
  const other = await workspaceForUser(f.db, {
    ...user,
    id: "fictional-other-user",
  });
  const denied = await f.route({ action: "list", workspace: other.id });
  assert.equal(denied.ok, false);
  assert.equal(denied.items, undefined);
});
test("missing source capability is unavailable rather than zero and corrupt targets stay unknown", async (t) => {
  const f = await prepared(t, false);
  const reply = overviewSnapshot.parse(await f.route());
  assert.equal(
    reply.sources.find((source) => source.id === "notifications").status,
    "unavailable",
  );
  assert.equal(
    reply.sources.find((source) => source.id === "notifications").count,
    null,
  );
  f.platform("fictional-invalid-plan");
  f.sqlite
    .prepare(
      "UPDATE creator_platform_requests SET plan_json='broken JSON' WHERE id='fictional-invalid-plan'",
    )
    .run();
  const corrupt = overviewSnapshot.parse(await f.route());
  assert.equal(
    corrupt.sources.find((source) => source.id === "platform").status,
    "unavailable",
  );
  assert.equal(
    corrupt.sources.find((source) => source.id === "platform").count,
    null,
  );
});
test("viewer sees restricted Inbox signals and reads never send or modify rows", async (t) => {
  const f = await prepared(t);
  f.notification("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  const before = f.sqlite
    .prepare("SELECT * FROM creator_enquiry_notification_outbox")
    .all();
  const reply = overviewSnapshot.parse(await f.route());
  assert.equal(
    reply.sources.find((source) => source.id === "notifications").status,
    "restricted",
  );
  assert.equal(reply.items.length, 0);
  assert.deepEqual(
    f.sqlite.prepare("SELECT * FROM creator_enquiry_notification_outbox").all(),
    before,
  );
});
test("revocation during a source read never returns an overview snapshot", async (t) => {
  const f = await prepared(t);
  f.notification("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
  let revoked = false;
  const original = f.db.prepare.bind(f.db);
  f.db.prepare = (sql) => {
    if (
      !revoked &&
      sql.includes("FROM creator_enquiry_notification_outbox n")
    ) {
      revoked = true;
      f.sqlite
        .prepare(
          "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .run(f.workspace.id, user.id);
    }
    return original(sql);
  };
  const reply = await f.route();
  assert.equal(reply.ok, false);
  assert.equal(reply.code, "FORBIDDEN");
  assert.equal(reply.items, undefined);
});
test("bounded source window is qualified and malformed selectors or targets are refused", async (t) => {
  const f = await prepared(t);
  for (let i = 0; i < 101; i++)
    f.platform("fictional-platform-" + String(i).padStart(4, "0"));
  const reply = overviewSnapshot.parse(await f.route());
  assert.equal(
    reply.sources.find((source) => source.id === "platform").count,
    50,
  );
  assert.equal(
    reply.sources.find((source) => source.id === "platform").atLimit,
    true,
  );
  assert.equal(
    (
      await f.route({
        action: "list",
        workspace: f.workspace.id,
        account: "foreign",
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await f.route(undefined, {
        ...f.runtime,
        RESOURCE_ENVIRONMENT: undefined,
      })
    ).ok,
    false,
  );
});

test("overview links only to records retained in the owning screen’s visible window", async (t) => {
  const f = await prepared(t);
  for (let index = 0; index < 60; index++) {
    const suffix = String(index).padStart(12, "0");
    f.workflow(`aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`);
    if (index >= 10)
      f.sqlite
        .prepare("UPDATE creator_workflow_runs SET state='finished' WHERE id=?")
        .run(`aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`);
  }
  for (let index = 0; index < 35; index++) {
    f.notification(
      `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`,
      index < 30 ? "accepted" : "failed",
    );
  }
  const reply = overviewSnapshot.parse(await f.route());
  // Workflow history uses created_at DESC,id DESC; notification history uses
  // created_at DESC,id, matching the existing owning screens exactly.
  assert.equal(
    reply.sources.find((source) => source.id === "workflows").count,
    0,
  );
  assert.equal(
    reply.sources.find((source) => source.id === "notifications").count,
    0,
  );
  assert.match(
    reply.sources.find((source) => source.id === "workflows").note,
    /latest 50 records shown/,
  );
  assert.match(
    reply.sources.find((source) => source.id === "notifications").note,
    /latest 30 notification records/,
  );
});

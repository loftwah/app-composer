import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, user, account, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { resourceConnection } from "../src/lib/resource-client.ts";
import {
  manageEnquiryNotifications,
  queueEnquiryNotification,
  sendEnquiryNotification,
} from "../src/lib/enquiry-notifications.ts";

async function prepared() {
  const f = fixture();
  f.sqlite.exec(
    readFileSync(
      new URL("../migrations/0013_enquiry_notifications.sql", import.meta.url),
      "utf8",
    ),
  );
  const workspace = await workspaceForUser(f.db, user),
    resource = "fictional-notification-resource",
    runtime = { ...f.runtime, DB: f.db };
  const app = resourceConnection(runtime, workspace.id);
  f.sqlite
    .prepare(
      "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,?,?,'ready')",
    )
    .run(resource, workspace.id, app.account, app.environment, app.target);
  const owner = { ...user, role: 20, email: "owner@example.test" };
  const call = (
    input,
    reading = false,
    caller = owner,
    selectedRuntime = runtime,
  ) =>
    manageEnquiryNotifications(
      {
        user: caller,
        input: { workspace: workspace.id, resource, ...input },
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/enquiries" +
            (reading ? "Read" : "Write"),
          {
            method: reading ? "GET" : "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1" },
          },
        ),
      },
      selectedRuntime,
    );
  const scope = {
    workspace: workspace.id,
    resource,
    account: app.account,
    environment: app.environment,
    target: app.target,
  };
  const rows = () =>
    f.sqlite.prepare("SELECT * FROM creator_enquiry_notification_outbox").all();
  const enabled = () =>
    call({
      action: "notificationPreference",
      enabled: true,
      expectedRevision: 0,
    });
  const event = () => crypto.randomUUID();
  return {
    ...f,
    runtime,
    workspace,
    resource,
    call,
    scope,
    rows,
    enabled,
    event,
  };
}
const mailRuntime = (f) => ({
  ...f.runtime,
  ENQUIRY_NOTIFICATIONS_ENABLED: "true",
  ENQUIRY_NOTIFICATION_RECIPIENT: "owner@example.test",
  RESEND_API_KEY: "fictional-key",
  RESEND_FROM_ADDRESS: "composer@example.test",
  RESEND_ALLOWED_RECIPIENTS: "owner@example.test",
});
const send = (f, transport, runtime = mailRuntime(f)) =>
  sendEnquiryNotification(
    f.db,
    runtime,
    f.workspace.id,
    f.resource,
    f.rows()[0].id,
    transport,
  );

test("preferences start off; status sends nothing and duplicate confirmed receipts queue once without bodies", async () => {
  const f = await prepared();
  try {
    const status = await f.call({ action: "notificationStatus" }, true);
    assert.equal(status.ok, true);
    assert.equal(status.preference.enabled, false);
    assert.equal(status.connection.ready, false);
    await queueEnquiryNotification(f.db, f.scope, f.event());
    assert.equal(f.rows().length, 0);
    assert.equal((await f.enabled()).ok, true);
    const event = f.event();
    await Promise.all([
      queueEnquiryNotification(f.db, f.scope, event),
      queueEnquiryNotification(f.db, f.scope, event),
    ]);
    assert.equal(f.rows().length, 1);
    assert.equal(f.rows()[0].state, "queued");
    assert.doesNotMatch(JSON.stringify(f.rows()), /brief|goal|fictional-key/);
    assert.equal(
      (
        await f.call({
          action: "notificationPreference",
          enabled: false,
          expectedRevision: 0,
        })
      ).code,
      "CONFLICT",
    );
    assert.equal(
      (
        await f.call({
          action: "notificationPreference",
          enabled: false,
          expectedRevision: 1,
        })
      ).ok,
      true,
    );
    await queueEnquiryNotification(f.db, f.scope, f.event());
    assert.equal(f.rows().length, 1);
  } finally {
    f.close();
  }
});
test("missing mail connection is visible while confirmed enquiry identity stays intact", async () => {
  const f = await prepared();
  try {
    await f.enabled();
    await queueEnquiryNotification(f.db, f.scope, f.event());
    let sends = 0;
    await send(
      f,
      async () => {
        sends++;
        return Response.json({ id: crypto.randomUUID() });
      },
      f.runtime,
    );
    assert.equal(sends, 0);
    assert.equal(f.rows()[0].state, "blocked");
    assert.match(f.rows()[0].reason, /not enabled or configured/);
    assert.equal(f.rows()[0].attempts, 0);
  } finally {
    f.close();
  }
});
test("atomic claim plus durable accepted identity prevents concurrent and later duplicate sends", async () => {
  const f = await prepared();
  try {
    await f.enabled();
    await queueEnquiryNotification(f.db, f.scope, f.event());
    let sends = 0,
      actual;
    const provider = async (url, options) => {
      sends++;
      actual = { url, options };
      await new Promise((r) => setTimeout(r, 10));
      return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    };
    await Promise.all([send(f, provider), send(f, provider)]);
    await send(f, provider);
    assert.equal(sends, 1);
    assert.equal(f.rows()[0].state, "accepted");
    assert.equal(
      f.rows()[0].provider_id,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    assert.equal(
      actual.options.headers["Idempotency-Key"],
      "composer-enquiry-v1/" + f.rows()[0].id,
    );
    assert.doesNotMatch(
      actual.options.body,
      /submitted goal|event_id|fictional-key/,
    );
    assert.match(
      f.rows()[0].reason,
      /Delivery and reading have not been verified/,
    );
  } finally {
    f.close();
  }
});
test("provider timeout and missing message identity stay uncertain with no blind replay", async () => {
  for (const provider of [
    async () => {
      throw Error("private raw failure");
    },
    async () => Response.json({}),
  ]) {
    const f = await prepared();
    try {
      await f.enabled();
      await queueEnquiryNotification(f.db, f.scope, f.event());
      let sends = 0;
      const transport = async (...args) => {
        sends++;
        return provider(...args);
      };
      await send(f, transport);
      await send(f, transport);
      assert.equal(f.rows()[0].state, "uncertain");
      assert.equal(sends, 1);
      assert.doesNotMatch(f.rows()[0].reason, /private raw failure/);
    } finally {
      f.close();
    }
  }
});
test("definite rejection can retry same message key with bounded attempts and truthful acceptance", async () => {
  const f = await prepared();
  try {
    await f.enabled();
    await queueEnquiryNotification(f.db, f.scope, f.event());
    const keys = [];
    const provider = async (_, options) => {
      keys.push(options.headers["Idempotency-Key"]);
      return new Response("{}", { status: 429 });
    };
    for (let i = 0; i < 3; i++) await send(f, provider);
    assert.equal(f.rows()[0].state, "failed");
    assert.equal(f.rows()[0].attempts, 3);
    assert.equal(new Set(keys).size, 1);
    await assert.rejects(send(f, provider), /Three attempts/);
    assert.equal(keys.length, 3);
  } finally {
    f.close();
  }
});
test("wrong workspace, connection, role, destination and revoked membership never send", async () => {
  const f = await prepared();
  try {
    await f.enabled();
    await queueEnquiryNotification(f.db, f.scope, f.event());
    let sends = 0;
    const provider = async () => {
      sends++;
      return Response.json({ id: crypto.randomUUID() });
    };
    await assert.rejects(
      queueEnquiryNotification(
        f.db,
        { ...f.scope, workspace: "another-workspace" },
        f.event(),
      ),
      /another or unavailable/,
    );
    await assert.rejects(
      send(f, provider, {
        ...mailRuntime(f),
        ENQUIRY_NOTIFICATION_RECIPIENT: "another@example.test",
        RESEND_ALLOWED_RECIPIENTS: "another@example.test",
      }),
      /not the owner/,
    );
    await assert.rejects(
      sendEnquiryNotification(
        f.db,
        mailRuntime(f),
        "another-workspace",
        f.resource,
        f.rows()[0].id,
        provider,
      ),
      /no such notification/,
    );
    const editor = "fictional-editor";
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'editor')",
      )
      .run(f.workspace.id, editor);
    const denied = await f.call(
      { action: "notificationPreference", enabled: true, expectedRevision: 1 },
      false,
      { ...user, id: editor, role: 20, email: "editor@example.test" },
    );
    assert.equal(denied.code, "FORBIDDEN");
    f.sqlite
      .prepare("DELETE FROM creator_members WHERE workspace_id=? AND user_id=?")
      .run(f.workspace.id, user.id);
    await assert.rejects(send(f, provider), /revoked/);
    assert.equal(sends, 0);
  } finally {
    f.close();
  }
});

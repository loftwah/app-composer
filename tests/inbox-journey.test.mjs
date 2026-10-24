import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, user, account, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { appSettings } from "../src/lib/app-settings.mjs";
import { resourceConnection } from "../src/lib/resource-client.ts";
import {
  linkEnquiryEvent,
  manageInboxJourney,
  recordEnquiryEvent,
} from "../src/lib/inbox-journey.ts";
import { queueEnquiryNotification } from "../src/lib/enquiry-notifications.ts";

const source = appSettings.guestbook.source.commit;
const owner = {
  ...user,
  id: "fictional-journey-owner",
  role: 20,
  email: "owner@example.test",
};
const editor = {
  ...user,
  id: "fictional-journey-editor",
  role: 20,
  email: "editor@example.test",
};
const recipient = "owner@example.test";
const digest = async (value) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

function enquiry(id, status = "pending", patch = {}) {
  return {
    id,
    scope_key: "c".repeat(64),
    configuration_revision: 1,
    provenance: {
      kind: "standalone",
      resource: "fictional-journey-resource",
      configuration: 1,
    },
    model_version: 1,
    producer_source: source,
    values: {
      title: "A fictional reading-club page",
      goal: "A private goal that must stay in the app-owned Inbox.",
      starting_point: "New idea",
      deliverables: [{ item: "A fictional events page", detail: "One page" }],
    },
    consent_version: 1,
    consent_at: "2026-10-24 09:00:00",
    status,
    revision: 1,
    created_at: "2026-10-24 09:00:00",
    expires_at: "2026-11-23 09:00:00",
    ...patch,
  };
}

async function prepared(t, options = {}) {
  const f = fixture();
  t.after(() => f.close());
  for (const file of [
    "0013_enquiry_notifications.sql",
    "0017_inbox_journey.sql",
  ])
    f.sqlite.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  const workspace = await workspaceForUser(f.db, owner);
  f.sqlite
    .prepare(
      "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'editor')",
    )
    .run(workspace.id, editor.id);
  const resource = "fictional-journey-resource";
  const base = {
    ...f.runtime,
    DB: f.db,
    RESOURCE_ACCOUNT_ID: account,
    RESOURCE_ENVIRONMENT: "production",
    ENQUIRY_NOTIFICATIONS_ENABLED: "true",
    ENQUIRY_NOTIFICATION_RECIPIENT: recipient,
    RESEND_API_KEY: "fictional-key",
    RESEND_FROM_ADDRESS: "composer@example.test",
    RESEND_ALLOWED_RECIPIENTS: recipient,
  };
  const app = resourceConnection(base, workspace.id);
  f.sqlite
    .prepare(
      "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,?,?,'ready')",
    )
    .run(resource, workspace.id, app.account, app.environment, app.target);
  const state = {
    items: [
      enquiry(
        options.item ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        options.status,
      ),
    ],
  };
  let handler = async (request) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/build.json"))
      return Response.json({
        app: "guestbook",
        revision: source,
        dataVersion: 1,
        resourceContract: 1,
        resourcesEnabled: true,
        resourceAccount: account,
        resourceEnvironment: "production",
      });
    if (url.pathname.includes("/enquiries/export"))
      return Response.json({
        contract: 1,
        format: "guestbook.private-enquiries/v1",
        source,
        resource: {
          id: resource,
          workspace_id: workspace.id,
          account_id: account,
          environment: "production",
          target: origin + "/guestbook",
          version: 2,
          active_revision: 1,
        },
        retentionDays: 30,
        items: state.items,
        covers: {
          privateBodies: true,
          consent: true,
          provenance: true,
          notifications: false,
          credentials: false,
        },
        scope: "current-resource-only",
      });
    return new Response(null, { status: 404 });
  };
  f.runtime.GUESTBOOK = { fetch: handler };
  const runtime = {
    ...base,
    GUESTBOOK: { fetch: (request) => handler(request) },
  };
  const mail = runtime;
  const call = (
    input,
    { reading = false, caller = owner, selected = runtime, transport } = {},
  ) =>
    manageInboxJourney(
      {
        user: caller,
        input: { workspace: workspace.id, resource, ...input },
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/journey" +
            (reading ? "Read?action=journey" : "Write"),
          {
            method: reading ? "GET" : "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1" },
          },
        ),
      },
      selected,
      transport,
    );
  const item = () => state.items[0];
  const journey = (itemId = item().id, selected = runtime) =>
    call({ action: "journey", item: itemId }, { reading: true, selected });
  const enable = async (recipientValue = recipient) => {
    f.sqlite
      .prepare(
        "INSERT INTO creator_enquiry_notification_preferences(workspace_id,resource_id,owner_id,enabled,destination_digest,revision,updated_at) VALUES(?,?,?,1,?,1,?)",
      )
      .run(
        workspace.id,
        resource,
        owner.id,
        await digest(recipientValue),
        "2026-10-24T09:00:00.000Z",
      );
  };
  const scope = {
    workspace: workspace.id,
    resource,
    account: app.account,
    environment: app.environment,
    target: app.target,
  };
  const link = (itemId = state.items[0].id) => {
    f.sqlite
      .prepare(
        "UPDATE creator_enquiry_workflow_runs SET item_id=? WHERE workspace_id=?",
      )
      .run(itemId, workspace.id);
    f.sqlite
      .prepare(
        "UPDATE creator_enquiry_notification_outbox SET item_id=? WHERE workspace_id=?",
      )
      .run(itemId, workspace.id);
  };
  return {
    ...f,
    workspace,
    resource,
    runtime,
    mail,
    call,
    journey,
    enable,
    link,
    scope,
    state,
    item,
    handler(value) {
      handler = value;
    },
  };
}

async function process(f, item = f.item().id, selected = f.runtime) {
  return f.call({ action: "process", item }, { selected });
}
async function send(f, transport, item = f.item().id) {
  return f.call({ action: "send", item }, { selected: f.mail, transport });
}
async function reconcile(f, item = f.item().id) {
  return f.call({ action: "reconcile", item }, { selected: f.mail });
}
const accepted = () =>
  Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });

test("new enquiry starts queued with unconfigured delivery and a single next action", async (t) => {
  const f = await prepared(t);
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  const read = await f.journey();
  assert.equal(read.ok, true, read.message);
  assert.equal(read.version, "composer.inbox-journey/1");
  assert.equal(read.enquiry.status, "new");
  assert.equal(read.workflow.state, "queued");
  assert.equal(read.workflow.attempts, 0);
  assert.equal(read.delivery.state, "unconfigured");
  assert.match(read.delivery.reason, /notifications are off/i);
  assert.equal(read.next.kind, "process");
  assert.equal(read.next.enabled, true);
  assert.equal(read.notificationPreference.enabled, false);
  assert.equal(read.scope.environment, "production");
  assert.equal(read.timezone, "UTC");
});

test("processing with notifications off finishes without a notice, provider or retry loop", async (t) => {
  const f = await prepared(t);
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  const processed = await process(f);
  assert.equal(processed.ok, true, processed.message);
  assert.equal(processed.workflow.state, "finished");
  assert.equal(processed.workflow.attempts, 1);
  assert.equal(processed.workflow.actor.kind, "member");
  assert.equal(processed.workflow.actor.id, owner.id);
  assert.match(processed.workflow.reason, /notifications are off/i);
  assert.equal(processed.delivery.state, "unconfigured");
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_notification_outbox")
      .get().n,
    0,
  );
  // A duplicate processing request does not repeat or increment the recorded run.
  const duplicate = await process(f);
  assert.equal(duplicate.workflow.attempts, 1);
  assert.equal(duplicate.workflow.revision, processed.workflow.revision);
  assert.equal(duplicate.next.kind, "review");
});

test("a prepared notice with owner mail unavailable stays unconfigured and offers no send", async (t) => {
  const f = await prepared(t, { status: "reviewed" });
  await f.enable();
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  const noMail = { ...f.runtime, RESEND_API_KEY: undefined };
  const processed = await process(f, f.item().id, noMail);
  assert.equal(processed.ok, true, processed.message);
  assert.equal(processed.workflow.state, "finished");
  assert.equal(processed.delivery.state, "unconfigured");
  assert.match(processed.delivery.reason, /mail is not enabled or configured/i);
  assert.equal(processed.delivery.destination.configured, false);
  assert.equal(processed.next.kind, "none");
  assert.match(processed.next.detail, /No supported action/);
  const refused = await f.call(
    { action: "send", item: f.item().id },
    { selected: noMail, transport: async () => ({}) },
  );
  assert.equal(refused.ok, true, refused.message);
  assert.equal(refused.delivery.state, "unconfigured");
  assert.match(refused.delivery.reason, /not enabled or configured/i);
  assert.equal(
    f.sqlite
      .prepare("SELECT state FROM creator_enquiry_notification_outbox")
      .get().state,
    "blocked",
  );
});

test("duplicate events keep one run and one outbox row; processing prepares a ready notice", async (t) => {
  const f = await prepared(t);
  await f.enable();
  const event = f.item().id;
  await Promise.all([
    recordEnquiryEvent(f.db, f.scope, event),
    recordEnquiryEvent(f.db, f.scope, event),
    queueEnquiryNotification(f.db, f.scope, event),
    queueEnquiryNotification(f.db, f.scope, event),
  ]);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_workflow_runs")
      .get().n,
    1,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_notification_outbox")
      .get().n,
    1,
  );
  f.link();
  const processed = await process(f);
  assert.equal(processed.ok, true, processed.message);
  assert.equal(processed.workflow.state, "finished");
  assert.match(processed.workflow.reason, /notice is prepared/i);
  assert.equal(processed.delivery.state, "ready");
  assert.equal(processed.delivery.attempts, 0);
  assert.equal(processed.next.kind, "send");
  assert.equal(processed.delivery.destination.configured, true);
  assert.equal(processed.delivery.destination.verified, true);
  assert.equal(
    processed.delivery.destination.fingerprint,
    (await digest(recipient)).slice(0, 12),
  );
  assert.doesNotMatch(
    JSON.stringify(processed),
    new RegExp(recipient.replace(".", "\\.") + "|fictional-key"),
  );
});

test("attempted to accepted records provider identity once and refuses every later resend", async (t) => {
  const f = await prepared(t, { status: "reviewed" });
  await f.enable();
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  await process(f);
  let sends = 0;
  const keys = [];
  const transport = async (_url, options) => {
    sends++;
    keys.push(options.headers["Idempotency-Key"]);
    return accepted();
  };
  const sent = await send(f, transport);
  assert.equal(sent.ok, true, sent.message);
  assert.equal(sent.delivery.state, "accepted");
  assert.equal(sent.delivery.attempts, 1);
  assert.equal(
    sent.delivery.providerReference,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  assert.match(
    sent.delivery.reason,
    /Delivery and reading have not been verified/,
  );
  assert.equal(sent.next.kind, "none");
  assert.match(sent.next.detail, /No supported action/);
  const row = f.sqlite
    .prepare(
      "SELECT id,state,attempts FROM creator_enquiry_notification_outbox",
    )
    .get();
  assert.equal(row.state, "accepted");
  assert.equal(keys[0], "composer-enquiry-v1/" + row.id);
  const refused = await send(f, transport);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "CONFLICT");
  assert.match(refused.message, /already accepted/i);
  assert.equal(sends, 1);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_notification_outbox")
      .get().n,
    1,
  );
});

test("timeout stays uncertain, reconciliation cannot promote it and no resend is offered", async (t) => {
  const f = await prepared(t);
  await f.enable();
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  await process(f);
  let sends = 0;
  const transport = async () => {
    sends++;
    throw Error("fictional raw provider detail owner@example.test");
  };
  const failed = await send(f, transport);
  assert.equal(failed.ok, true, failed.message);
  assert.equal(failed.delivery.state, "uncertain");
  assert.equal(failed.next.kind, "reconcile");
  assert.doesNotMatch(JSON.stringify(failed), /raw provider detail/);
  const reconciled = await reconcile(f);
  assert.equal(reconciled.ok, true, reconciled.message);
  assert.equal(reconciled.delivery.state, "uncertain");
  assert.equal(reconciled.delivery.reconciliations, 1);
  assert.ok(reconciled.delivery.reconciledAt);
  const refused = await send(f, transport);
  assert.equal(refused.code, "CONFLICT");
  assert.match(refused.message, /uncertain/i);
  assert.equal(sends, 1);
  const row = f.sqlite
    .prepare("SELECT state,attempts FROM creator_enquiry_notification_outbox")
    .get();
  assert.equal(row.state, "uncertain");
  assert.equal(row.attempts, 1);
});

test("an in-flight attempt is visible as attempted, refuses a resend and keeps its claim on reconcile", async (t) => {
  const f = await prepared(t, { status: "reviewed" });
  await f.enable();
  f.sqlite
    .prepare(
      "INSERT INTO creator_enquiry_workflow_runs(id,workspace_id,resource_id,event_id,account_id,environment,target,actor_kind,actor_id,state,stage,attempts,reason,revision,item_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'member',?,'finished','notice-prepared',1,'The owner notice is prepared.',2,?,?,?)",
    )
    .run(
      "fictional-inflight-run",
      f.workspace.id,
      f.resource,
      f.item().id,
      f.scope.account,
      f.scope.environment,
      f.scope.target,
      owner.id,
      f.item().id,
      "2026-10-24T09:00:00.000Z",
      "2026-10-24T09:00:00.000Z",
    );
  f.sqlite
    .prepare(
      "INSERT INTO creator_enquiry_notification_outbox(id,workspace_id,resource_id,event_id,account_id,environment,target,owner_id,state,attempts,destination_digest,reason,item_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'sending',1,?,?,?,?,?)",
    )
    .run(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      f.workspace.id,
      f.resource,
      f.item().id,
      f.scope.account,
      f.scope.environment,
      f.scope.target,
      owner.id,
      await digest(recipient),
      "",
      f.item().id,
      "2026-10-24T09:00:00.000Z",
      "2026-10-24T09:00:00.000Z",
    );
  const read = await f.journey();
  assert.equal(read.delivery.state, "attempted");
  assert.equal(read.next.kind, "reconcile");
  let sends = 0;
  const refused = await send(f, async () => {
    sends++;
    return accepted();
  });
  assert.equal(refused.code, "CONFLICT");
  assert.match(refused.message, /already in progress/i);
  assert.equal(sends, 0);
  const reconciled = await reconcile(f);
  assert.equal(reconciled.delivery.state, "attempted");
  assert.equal(reconciled.delivery.reconciliations, 1);
  assert.equal(
    f.sqlite
      .prepare("SELECT state,attempts FROM creator_enquiry_notification_outbox")
      .get().state,
    "sending",
  );
});

test("definite rejection retries with the same message identity and stops at three", async (t) => {
  const f = await prepared(t);
  await f.enable();
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  await process(f);
  const keys = [];
  let mode = "reject";
  const transport = async (_url, options) => {
    keys.push(options.headers["Idempotency-Key"]);
    return mode === "reject" ? new Response("{}", { status: 429 }) : accepted();
  };
  const rejected = await send(f, transport);
  assert.equal(rejected.delivery.state, "failed");
  assert.equal(rejected.delivery.attempts, 1);
  assert.match(rejected.delivery.reason, /429/);
  assert.equal(rejected.next.kind, "send");
  mode = "accept";
  const retried = await send(f, transport);
  assert.equal(retried.delivery.state, "accepted");
  assert.equal(retried.delivery.attempts, 2);
  assert.equal(new Set(keys).size, 1);
  assert.equal((await send(f, transport)).code, "CONFLICT");
  assert.equal(keys.length, 2);
});

test("processing failure names the cause, retries safely and stops after three attempts", async (t) => {
  const f = await prepared(t);
  f.sqlite
    .prepare(
      "INSERT INTO creator_enquiry_notification_preferences(workspace_id,resource_id,owner_id,enabled,destination_digest,revision,updated_at) VALUES(?,?,?,1,?,1,?)",
    )
    .run(
      f.workspace.id,
      f.resource,
      "fictional-former-owner",
      await digest(recipient),
      "2026-10-24T09:00:00.000Z",
    );
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  const failed = await process(f);
  assert.equal(failed.workflow.state, "failed");
  assert.equal(failed.workflow.attempts, 1);
  assert.match(failed.workflow.reason, /no longer has owner access/i);
  assert.equal(failed.next.kind, "process");
  assert.equal(failed.next.label, "Retry processing");
  // Repair the recorded owner, then retry the same event.
  f.sqlite
    .prepare(
      "UPDATE creator_enquiry_notification_preferences SET owner_id=? WHERE workspace_id=?",
    )
    .run(owner.id, f.workspace.id);
  const recovered = await process(f);
  assert.equal(recovered.workflow.state, "finished");
  assert.equal(recovered.workflow.attempts, 2);
  assert.equal(recovered.delivery.state, "ready");
  // A fresh failed run is bounded at three explicit attempts.
  f.sqlite
    .prepare(
      "UPDATE creator_enquiry_notification_preferences SET owner_id='fictional-former-owner',enabled=1 WHERE workspace_id=?",
    )
    .run(f.workspace.id);
  f.sqlite
    .prepare(
      "UPDATE creator_enquiry_workflow_runs SET state='failed',attempts=2,reason='Fictional bounded failure' WHERE workspace_id=?",
    )
    .run(f.workspace.id);
  const third = await process(f);
  assert.equal(third.workflow.state, "failed");
  assert.equal(third.workflow.attempts, 3);
  const bounded = await process(f);
  assert.equal(bounded.code, "CONFLICT");
  assert.match(bounded.message, /Three processing attempts/);
  const exhausted = await f.journey();
  assert.equal(exhausted.next.kind, "none");
  assert.match(exhausted.next.detail, /Three processing attempts/);
});

test("an interrupted running run is re-checked without duplicating the notice", async (t) => {
  const f = await prepared(t);
  await f.enable();
  f.sqlite
    .prepare(
      "INSERT INTO creator_enquiry_workflow_runs(id,workspace_id,resource_id,event_id,account_id,environment,target,actor_kind,actor_id,state,stage,attempts,reason,revision,item_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'system','receipt','running','observed',1,'',2,?,?,?)",
    )
    .run(
      "fictional-interrupted-run",
      f.workspace.id,
      f.resource,
      f.item().id,
      f.scope.account,
      f.scope.environment,
      f.scope.target,
      f.item().id,
      "2026-10-24T09:00:00.000Z",
      "2026-10-24T09:00:00.000Z",
    );
  const running = await f.journey();
  assert.equal(running.workflow.state, "running");
  assert.equal(running.next.kind, "process");
  assert.equal(running.next.label, "Re-check processing");
  assert.match(running.next.detail, /safe/i);
  const recovered = await process(f);
  assert.equal(recovered.workflow.state, "finished");
  assert.equal(recovered.workflow.attempts, 2);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_notification_outbox")
      .get().n,
    1,
  );
});

test("an unlinked brief is explicit and offers no processing or delivery action", async (t) => {
  const f = await prepared(t);
  const unlinked = await f.journey();
  assert.equal(unlinked.workflow.state, "unlinked");
  assert.equal(unlinked.workflow.attempts, 0);
  assert.equal(unlinked.next.kind, "none");
  assert.match(unlinked.next.detail, /No exact workflow link/);
  const refused = await process(f);
  assert.equal(refused.code, "CONFLICT");
  assert.match(refused.message, /No exact workflow event/);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_workflow_runs")
      .get().n,
    0,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_notification_outbox")
      .get().n,
    0,
  );
});

test("an exact unique export match links the receipt; ambiguity or different values stay unlinked", async (t) => {
  const f = await prepared(t);
  await f.enable();
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  await queueEnquiryNotification(f.db, f.scope, f.item().id);
  const connection = resourceConnection(f.runtime, f.workspace.id);
  const linked = await linkEnquiryEvent(
    f.db,
    connection,
    f.scope,
    f.item().id,
    f.item().values,
    f.item().provenance,
  );
  assert.equal(linked, "linked");
  assert.equal(
    f.sqlite.prepare("SELECT item_id FROM creator_enquiry_workflow_runs").get()
      .item_id,
    f.item().id,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT item_id FROM creator_enquiry_notification_outbox")
      .get().item_id,
    f.item().id,
  );
  const read = await f.journey();
  assert.equal(read.workflow.state, "queued");
  assert.equal(read.delivery.state, "ready");

  const other = await prepared(t);
  await other.enable();
  other.state.items.push({
    ...other.item(),
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
  });
  await recordEnquiryEvent(other.db, other.scope, other.item().id);
  await queueEnquiryNotification(other.db, other.scope, other.item().id);
  const ambiguous = await linkEnquiryEvent(
    other.db,
    resourceConnection(other.runtime, other.workspace.id),
    other.scope,
    other.item().id,
    other.item().values,
    other.item().provenance,
  );
  assert.equal(ambiguous, "unlinked");
  assert.equal(
    other.sqlite
      .prepare("SELECT item_id FROM creator_enquiry_workflow_runs")
      .get().item_id,
    null,
  );

  const different = await prepared(t);
  different.state.items[0].values.goal = "A different fictional goal.";
  await recordEnquiryEvent(different.db, different.scope, different.item().id);
  const unmatched = await linkEnquiryEvent(
    different.db,
    resourceConnection(different.runtime, different.workspace.id),
    different.scope,
    different.item().id,
    "A goal that is not in the export.",
    different.item().provenance,
  );
  assert.equal(unmatched, "unlinked");
});

test("wrong workspace, foreign resource and mismatched item are refused before any local write", async (t) => {
  const f = await prepared(t);
  const other = await workspaceForUser(f.db, {
    ...user,
    id: "fictional-other-owner",
    role: 20,
  });
  f.sqlite
    .prepare(
      "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,?,?,'ready')",
    )
    .run(
      "fictional-foreign-resource",
      other.id,
      f.scope.account,
      f.scope.environment,
      f.scope.target,
    );
  const denied = await f.call(
    { action: "journey", item: f.item().id, workspace: other.id },
    { reading: true },
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "FORBIDDEN");
  const foreign = await manageInboxJourney(
    {
      user: owner,
      input: {
        action: "journey",
        workspace: f.workspace.id,
        resource: "fictional-foreign-resource",
        item: f.item().id,
      },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/journeyRead?action=journey",
        { method: "GET", headers: { Origin: origin } },
      ),
    },
    f.runtime,
  );
  assert.equal(foreign.code, "NOT_FOUND");
  const missing = await f.journey("fictional-absent-enquiry-99");
  assert.equal(missing.code, "NOT_FOUND");
  await assert.rejects(
    recordEnquiryEvent(f.db, { ...f.scope, workspace: other.id }, f.item().id),
    /another or unavailable/,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_workflow_runs")
      .get().n,
    0,
  );
});

test("viewer, editor send, CSRF and duplicate filters are refused with readable reasons", async (t) => {
  const f = await prepared(t);
  await f.enable();
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  await process(f);
  const viewer = await f.call(
    { action: "journey", item: f.item().id },
    { reading: true, caller: { ...owner, id: "fictional-viewer", role: 20 } },
  );
  assert.equal(viewer.code, "FORBIDDEN");
  // A real editor can read and process, but only the owner may send.
  const editorRead = await f.call(
    { action: "journey", item: f.item().id },
    { reading: true, caller: editor },
  );
  assert.equal(editorRead.ok, true, editorRead.message);
  const editorSend = await f.call(
    { action: "send", item: f.item().id },
    { selected: f.mail, caller: editor, transport: accepted },
  );
  assert.equal(editorSend.code, "FORBIDDEN");
  const crossOrigin = await manageInboxJourney(
    {
      user: owner,
      input: {
        action: "send",
        workspace: f.workspace.id,
        resource: f.resource,
        item: f.item().id,
      },
      request: new Request(
        origin + "/_emdash/api/plugins/composer-stacks/journeyWrite",
        {
          method: "POST",
          headers: { Origin: "https://example.test", "X-EmDash-Request": "1" },
        },
      ),
    },
    f.mail,
    accepted,
  );
  assert.equal(crossOrigin.code, "FORBIDDEN");
  const duplicated = await manageInboxJourney(
    {
      user: owner,
      input: {
        action: "journey",
        workspace: f.workspace.id,
        resource: f.resource,
        item: f.item().id,
      },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/journeyRead?action=journey&item=" +
          f.item().id +
          "&item=" +
          f.item().id,
        { method: "GET", headers: { Origin: origin } },
      ),
    },
    f.runtime,
  );
  assert.equal(duplicated.code, "INVALID");
  const outbox = f.sqlite
    .prepare("SELECT state,attempts FROM creator_enquiry_notification_outbox")
    .get();
  assert.equal(outbox.state, "queued");
  assert.equal(outbox.attempts, 0);
});

test("enquiry states map from the actual app export and rejected briefs stay readable", async (t) => {
  const f = await prepared(t);
  for (const [status, expected] of [
    ["pending", "new"],
    ["reviewed", "reviewed"],
    ["rejected", "rejected"],
  ]) {
    f.state.items[0].status = status;
    const read = await f.journey();
    assert.equal(read.ok, true, read.message);
    assert.equal(read.enquiry.status, expected);
    assert.equal(read.enquiry.title, "A fictional reading-club page");
    assert.equal(read.enquiry.deliverables.length, 1);
  }
  // The journey never copies the brief goal into Composer's own run record.
  const runs = f.sqlite
    .prepare("SELECT * FROM creator_enquiry_workflow_runs")
    .all();
  assert.doesNotMatch(JSON.stringify(runs), /private goal/i);
});

test("notification preference is reported without a recipient and a changed connection stops actions", async (t) => {
  const f = await prepared(t);
  await f.enable();
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  await process(f);
  const read = await f.journey();
  assert.equal(read.notificationPreference.enabled, true);
  assert.equal(read.delivery.destination.configured, true);
  assert.doesNotMatch(JSON.stringify(read), /owner@example\.test/);
  assert.match(read.delivery.destination.fingerprint, /^[a-f0-9]{12}$/);
  const changed = await f.journey(f.item().id, {
    ...f.mail,
    RESOURCE_ENVIRONMENT: "another-environment",
  });
  assert.equal(changed.ok, false);
  assert.equal(changed.code, "UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(changed), /owner@example\.test/);
});

test("normal preparation path returns one bounded journey with no provider call", async (t) => {
  const f = await prepared(t);
  await f.enable();
  let providerCalls = 0;
  const transport = async () => {
    providerCalls++;
    return accepted();
  };
  await recordEnquiryEvent(f.db, f.scope, f.item().id);
  f.link();
  const result = await f.call(
    { action: "process", item: f.item().id },
    { selected: f.mail, transport },
  );
  assert.equal(result.ok, true, result.message);
  assert.equal(providerCalls, 0);
  assert.equal(result.workflow.attempts, 1);
  assert.equal(result.workflow.maxAttempts, 3);
  assert.equal(result.delivery.maxAttempts, 3);
  assert.equal(result.delivery.destination.verified, true);
});

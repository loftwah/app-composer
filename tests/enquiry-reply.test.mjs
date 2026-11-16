import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, user, account, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { appSettings } from "../src/lib/app-settings.mjs";
import {
  linkEnquiryEvent,
  manageInboxJourney,
} from "../src/lib/inbox-journey.ts";
import { resourceConnection } from "../src/lib/resource-client.ts";
import { enquiryExport, enquiryItem } from "../src/lib/enquiry-protocol.ts";
import {
  replyBodyValue,
  replyCommand,
  replySubject,
} from "../src/lib/enquiry-reply-contract.ts";
import { normaliseReplyBody } from "../src/lib/enquiry-reply.ts";

const source = appSettings.guestbook.source.commit;
const resource = "fictional-reply-resource";
const owner = {
  ...user,
  id: "fictional-reply-owner",
  role: 20,
  email: "owner@example.test",
};
const editor = {
  ...user,
  id: "fictional-reply-editor",
  role: 20,
  email: "editor@example.test",
};
const viewer = {
  ...user,
  id: "fictional-reply-viewer",
  role: 20,
  email: "viewer@example.test",
};
const now = Date.now();
const body = [
  "Hello, and thank you for the fictional reading-club enquiry.",
  "",
  "You asked about a private events page. I can prepare one page with the",
  "reading dates and a short sign-up note. This reply is fictional test text.",
].join("\n");

function consent(patch = {}) {
  return {
    version: 2,
    consented_at: new Date(now - 60 * 60 * 1000).toISOString(),
    expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recipient: "visitor@example.test",
    ...patch,
  };
}

function enquiryItemFixture(patch = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    scope_key: "c".repeat(64),
    configuration_revision: 1,
    provenance: {
      kind: "standalone",
      resource,
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
    reply: consent(),
    status: "pending",
    revision: 1,
    created_at: "2026-10-24 09:00:00",
    expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...patch,
  };
}

async function prepared(t, options = {}) {
  const f = fixture();
  t.after(() => f.close());
  for (const file of [
    "0013_enquiry_notifications.sql",
    "0017_inbox_journey.sql",
    "0030_enquiry_reply_jobs.sql",
  ])
    f.sqlite.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  const workspace = await workspaceForUser(f.db, owner);
  for (const [member, role] of [
    [editor, "editor"],
    [viewer, "viewer"],
  ])
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,?)",
      )
      .run(workspace.id, member.id, role);
  const runtime = {
    ...f.runtime,
    DB: f.db,
    RESOURCE_ACCOUNT_ID: account,
    RESOURCE_ENVIRONMENT: "production",
  };
  f.sqlite
    .prepare(
      "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,?,?,'ready')",
    )
    .run(resource, workspace.id, account, "production", origin + "/guestbook");
  const state = {
    format:
      options.form === "v1"
        ? "guestbook.private-enquiries/v1"
        : "guestbook.private-enquiries/v2",
    items: [
      options.form === "v1"
        ? (() => {
            const { reply, ...item } = enquiryItemFixture();
            return item;
          })()
        : enquiryItemFixture(options.item),
    ],
  };
  const handler = async (request) => {
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
        format: state.format,
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
  runtime.GUESTBOOK = { fetch: handler };
  const call = (
    input,
    { reading = false, caller = owner, selected = runtime } = {},
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
    );
  const journey = (selected = runtime, caller = owner) =>
    call(
      { action: "journey", item: state.items[0].id },
      { reading: true, selected, caller },
    );
  const item = () => state.items[0];
  const job = () =>
    f.sqlite.prepare("SELECT * FROM creator_enquiry_reply_jobs").get();
  const eventRows = () =>
    f.sqlite
      .prepare(
        "SELECT kind,approval_id,draft_revision FROM creator_enquiry_reply_events ORDER BY at,rowid",
      )
      .all();
  return {
    ...f,
    workspace,
    runtime,
    state,
    call,
    journey,
    item,
    job,
    eventRows,
    scope: {
      workspace: workspace.id,
      resource,
      account,
      environment: "production",
      target: origin + "/guestbook",
    },
  };
}

async function draft(f, patch = {}) {
  const current = await f.journey();
  return f.call(
    {
      action: "replyDraft",
      item: f.item().id,
      expectedRevision: current.reply.draft?.revision ?? 0,
      body,
      generator: "agent",
      generatorId: "composer-agent/reading-club",
      ...patch,
    },
    { selected: f.runtime },
  );
}
async function approve(f, journey) {
  return f.call(
    {
      action: "replyApprove",
      item: f.item().id,
      expectedRevision: journey.reply.draft.revision,
      expectedDigest: journey.reply.draft.digest,
    },
    { selected: f.runtime },
  );
}
async function exportNow(f, journey) {
  return f.call(
    {
      action: "replyExport",
      item: f.item().id,
      expectedApproval: journey.reply.approval.id,
      expectedDigest: journey.reply.draft.digest,
    },
    { selected: f.runtime },
  );
}

test("one linked consented brief creates one empty reply job; a replay cannot create a second", async (t) => {
  const f = await prepared(t);
  const connection = resourceConnection(f.runtime, f.workspace.id);
  const event = crypto.randomUUID();
  const linked = await linkEnquiryEvent(
    f.db,
    connection,
    f.scope,
    event,
    f.item().values,
    f.item().provenance,
  );
  assert.equal(linked, "linked");
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_reply_jobs")
      .get().n,
    1,
  );
  const job = f.job();
  assert.equal(job.draft_revision, 0);
  assert.equal(job.draft_body, "");
  assert.equal(job.generator, "owner");
  assert.equal(job.actor_id, "receipt");
  const read = await f.journey();
  assert.equal(read.ok, true, read.message);
  assert.equal(read.reply.state, "draft");
  assert.equal(read.reply.draft, null);
  assert.equal(read.reply.source.itemRevision, 1);
  assert.match(read.reply.reason, /reply job is ready/i);
  assert.equal(read.reply.next.kind, "draft");
  await linkEnquiryEvent(
    f.db,
    connection,
    f.scope,
    event,
    f.item().values,
    f.item().provenance,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_reply_jobs")
      .get().n,
    1,
  );
  const drafted = await draft(f);
  assert.equal(drafted.ok, true, drafted.message);
  assert.equal(drafted.reply.draft.revision, 1);
  assert.equal(drafted.reply.source.itemRevision, 1);
});

test("a v1 no-contact enquiry never offers or creates a reply job", async (t) => {
  const f = await prepared(t, { form: "v1" });
  const read = await f.journey();
  assert.equal(read.ok, true, read.message);
  assert.equal(read.reply.eligible, false);
  assert.equal(read.reply.state, "unavailable");
  assert.match(read.reply.reason, /did not ask for consent to send a reply/i);
  assert.equal(read.reply.consent, null);
  assert.equal(read.reply.next.kind, "none");
  const refused = await draft(f);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "FORBIDDEN");
  assert.match(refused.message, /consent/i);
  assert.equal(f.job(), undefined);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_enquiry_reply_jobs")
      .get().n,
    0,
  );
});

test("enquiry and reply validation keeps HTML inert and refuses header and control injection", () => {
  // The production item schema rejects missing, oversized and unknown fields.
  const missing = enquiryItemFixture();
  delete missing.values.title;
  assert.equal(enquiryItem.safeParse(missing).success, false);
  assert.equal(
    enquiryItem.safeParse(
      enquiryItemFixture({
        values: { ...enquiryItemFixture().values, title: "x".repeat(121) },
      }),
    ).success,
    false,
  );
  assert.equal(
    enquiryItem.safeParse({
      ...enquiryItemFixture(),
      values: { ...enquiryItemFixture().values, workspace: "foreign" },
    }).success,
    false,
  );
  assert.equal(
    enquiryItem.safeParse(
      enquiryItemFixture({ reply: consent({ recipient: "not-an-address" }) }),
    ).success,
    false,
  );
  // HTML in an untrusted brief stays literal text. It is never interpreted and
  // the derived subject cannot carry a newline or an extra mail header.
  const hostile = enquiryItemFixture({
    values: {
      ...enquiryItemFixture().values,
      title: "Fictional <script>alert(1)</script>\r\nBcc: victim@example.test",
    },
  });
  assert.equal(enquiryItem.safeParse(hostile).success, true);
  const subject = replySubject(hostile.values.title);
  assert.doesNotMatch(subject, /[\r\n]/);
  assert.match(
    subject,
    /<script>alert\(1\)<\/script> Bcc: victim@example\.test/,
  );
  assert.ok(subject.length <= 120);
  assert.equal(
    replySubject("Fictional\r\nBcc: victim@example.test"),
    "Re: Fictional Bcc: victim@example.test",
  );

  // The reply body is plain text. CRLF is accepted and normalised; NUL and a
  // lone carriage return are refused.
  assert.equal(replyBodyValue.safeParse("Line one\r\nLine two").success, true);
  assert.equal(
    normaliseReplyBody("  Line one\r\nLine two  "),
    "Line one\nLine two",
  );
  assert.equal(replyBodyValue.safeParse("bad\rline").success, false);
  assert.equal(replyBodyValue.safeParse("bad\u0000line").success, false);
  assert.equal(
    replyCommand.safeParse({
      action: "replyDraft",
      resource,
      item: enquiryItemFixture().id,
      expectedRevision: 0,
      body: "x".repeat(4001),
      generator: "owner",
    }).success,
    false,
  );
  assert.equal(
    replyCommand.safeParse({
      action: "replyDraft",
      resource,
      item: enquiryItemFixture().id,
      expectedRevision: 0,
      body: "A valid fictional reply.",
      generator: "agent",
    }).success,
    false,
  );
  // A public or native write cannot select a recipient; the app-owned consent
  // record is the only source.
  assert.equal(
    replyCommand.safeParse({
      action: "replyExport",
      resource,
      item: enquiryItemFixture().id,
      expectedApproval: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expectedDigest: "a".repeat(64),
      recipient: "attacker@example.test",
    }).success,
    false,
  );
  // Reply consent belongs only to the versioned consented export.
  const exported = {
    contract: 1,
    format: "guestbook.private-enquiries/v1",
    source,
    resource: {
      id: resource,
      workspace_id: "fictional-reply-workspace",
      account_id: account,
      environment: "production",
      target: origin + "/guestbook",
      version: 2,
      active_revision: 1,
    },
    retentionDays: 30,
    items: [enquiryItemFixture()],
    covers: {
      privateBodies: true,
      consent: true,
      provenance: true,
      notifications: false,
      credentials: false,
    },
    scope: "current-resource-only",
  };
  assert.equal(enquiryExport.safeParse(exported).success, false);
  assert.equal(
    enquiryExport.safeParse({
      ...exported,
      format: "guestbook.private-enquiries/v2",
    }).success,
    true,
  );
});

test("an agent draft is scoped to the exact brief and owner approval binds the exact body", async (t) => {
  const f = await prepared(t);
  const initial = await f.journey();
  assert.equal(initial.reply.eligible, true);
  assert.equal(initial.reply.state, "draft");
  assert.equal(initial.reply.next.kind, "draft");
  const drafted = await draft(f);
  assert.equal(drafted.ok, true, drafted.message);
  assert.equal(drafted.reply.state, "draft");
  assert.equal(drafted.reply.draft.revision, 1);
  assert.equal(drafted.reply.draft.body, body);
  assert.match(drafted.reply.draft.digest, /^[a-f0-9]{64}$/);
  assert.equal(drafted.reply.draft.generator, "agent");
  assert.equal(drafted.reply.draft.generatorId, "composer-agent/reading-club");
  assert.equal(drafted.reply.source.itemRevision, f.item().revision);
  assert.equal(drafted.reply.approval, null);
  assert.deepEqual(
    drafted.reply.timeline.map((event) => event.kind),
    ["draft"],
  );
  assert.equal(drafted.reply.next.kind, "approve");
  const approved = await approve(f, drafted);
  assert.equal(approved.ok, true, approved.message);
  assert.equal(approved.reply.state, "approved");
  assert.match(approved.reply.approval.id, /^[a-f0-9-]{36}$/);
  assert.match(approved.reply.approval.digest, /^[a-f0-9]{64}$/);
  assert.equal(approved.reply.approval.approvedBy, owner.id);
  assert.equal(approved.reply.receipt, null);
  assert.equal(approved.reply.next.kind, "export");
  assert.deepEqual(
    approved.reply.timeline.map((event) => event.kind),
    ["draft", "approved"],
  );
  // Nothing in this state claims a send or a provider identity.
  assert.doesNotMatch(
    JSON.stringify(approved),
    /resend|provider message|sent\s*:\s*true/i,
  );
});

test("the same approval and export replay into one recorded handoff", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const approved = await approve(f, drafted);
  const approvalId = approved.reply.approval.id;
  const approvalEvents = () =>
    f.eventRows().filter((event) => event.kind === "approved").length;
  assert.equal(approvalEvents(), 1);
  const repeated = await approve(f, approved);
  assert.equal(repeated.ok, true, repeated.message);
  assert.equal(repeated.reply.approval.id, approvalId);
  assert.equal(repeated.reply.draft.revision, 1);
  assert.equal(approvalEvents(), 1);
  assert.equal(f.job().revision, approved.reply.draft.revision + 1);

  const exported = await exportNow(f, approved);
  assert.equal(exported.ok, true, exported.message);
  assert.equal(exported.reply.state, "exported");
  assert.equal(exported.reply.receipt.id, approvalId);
  assert.equal(exported.reply.receipt.sent, false);
  assert.equal(exported.manualExport.id, approvalId);
  assert.equal(exported.manualExport.sent, false);
  assert.equal(exported.manualExport.method, "manual-export");
  assert.equal(exported.manualExport.recipient, "visitor@example.test");
  assert.equal(exported.manualExport.body, body);
  assert.match(exported.manualExport.approvedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(exported.manualExport.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(exported.manualExport.approvalDigest, /^[a-f0-9]{64}$/);
  assert.match(
    exported.manualExport.subject,
    /^Re: A fictional reading-club page$/,
  );
  assert.match(exported.manualExport.receipt, /Sent by Composer: no/);
  assert.ok(exported.manualExport.receipt.includes(body));
  assert.match(exported.manualExport.receipt, /Approval: /);
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    1,
  );
  const jobRevision = f.job().revision;

  const replayed = await exportNow(f, exported);
  assert.equal(replayed.ok, true, replayed.message);
  assert.equal(replayed.reply.state, "exported");
  assert.equal(replayed.reply.receipt.id, approvalId);
  assert.equal(replayed.manualExport.idempotent, true);
  assert.equal(replayed.manualExport.sent, false);
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    1,
  );
  assert.equal(f.job().revision, jobRevision);
  const reloaded = await f.journey();
  assert.equal(reloaded.reply.state, "exported");
  assert.equal(reloaded.reply.receipt.id, approvalId);
  assert.equal(
    reloaded.reply.receipt.exportedAt,
    exported.reply.receipt.exportedAt,
  );
  assert.equal(reloaded.reply.next.kind, "none");
  // A historical receipt never presents a changed address as the one used.
  f.state.items[0].reply = consent({ recipient: "other@example.test" });
  const historical = await exportNow(f, exported);
  assert.equal(historical.ok, true, historical.message);
  assert.equal(historical.manualExport.recipient, null);
  assert.match(historical.manualExport.receipt, /do not send/i);
  const afterChange = await f.journey();
  assert.equal(afterChange.reply.state, "exported");
  assert.match(afterChange.reply.reason, /address has changed since export/i);
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    1,
  );
  assert.equal(f.job().revision, jobRevision);
});

test("one changed character after approval refuses export and requires a new approval", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const approved = await approve(f, drafted);
  const approvalId = approved.reply.approval.id;
  const tampered = body.replace("reading-club enquiry", "reading-clup enquiry");
  f.sqlite
    .prepare("UPDATE creator_enquiry_reply_jobs SET draft_body=? WHERE id=?")
    .run(tampered, f.job().id);
  const refused = await exportNow(f, approved);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "STALE_APPROVAL");
  assert.match(refused.message, /digest|no longer matches/i);
  assert.equal(f.job().state, "invalidated");
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    0,
  );
  assert.equal(
    f.eventRows().filter((event) => event.kind === "invalidated").length,
    1,
  );
  // The tampered text cannot be approved against the old digest. Saving the
  // current text again records a new revision that can be approved.
  const saved = await draft(f, { body: tampered });
  assert.equal(saved.ok, true, saved.message);
  assert.equal(saved.reply.draft.revision, 2);
  assert.notEqual(saved.reply.draft.digest, approved.reply.approval.digest);
  const reapproved = await approve(f, saved);
  assert.equal(reapproved.ok, true, reapproved.message);
  assert.notEqual(reapproved.reply.approval.id, approvalId);
  const exported = await exportNow(f, reapproved);
  assert.equal(exported.ok, true, exported.message);
  assert.equal(exported.manualExport.body, tampered);
  assert.ok(exported.manualExport.receipt.includes(tampered));
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    1,
  );
  assert.equal(exported.reply.receipt.id, reapproved.reply.approval.id);
});

test("editing the draft through the inbox voids the approval before export", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const approved = await approve(f, drafted);
  const edited = await draft(f, { body: body + "\n\nA changed sentence." });
  assert.equal(edited.ok, true, edited.message);
  assert.equal(edited.reply.state, "draft");
  assert.equal(edited.reply.draft.revision, 2);
  assert.equal(edited.reply.approval, null);
  const refused = await exportNow(f, approved);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "CONFLICT");
  assert.match(refused.message, /approved before export/i);
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    0,
  );
  const reapproved = await approve(f, edited);
  assert.equal(reapproved.ok, true, reapproved.message);
  const exported = await exportNow(f, reapproved);
  assert.equal(exported.ok, true, exported.message);
  assert.ok(exported.manualExport.body.endsWith("A changed sentence."));
});

test("expired consent, a changed recipient and a changed brief each invalidate the approval", async (t) => {
  for (const scenario of ["expired", "recipient", "brief"]) {
    const f = await prepared(t);
    const drafted = await draft(f);
    const approved = await approve(f, drafted);
    if (scenario === "expired")
      f.state.items[0].reply = consent({
        expires_at: new Date(now - 60 * 1000).toISOString(),
      });
    if (scenario === "recipient")
      f.state.items[0].reply = consent({ recipient: "other@example.test" });
    if (scenario === "brief") f.state.items[0].revision = 2;
    const refused = await exportNow(f, approved);
    assert.equal(refused.ok, false, scenario);
    assert.equal(refused.code, "STALE_APPROVAL", scenario);
    assert.match(refused.message, /nothing was sent|nothing was exported/i);
    assert.equal(f.job().state, "invalidated", scenario);
    assert.equal(
      f.eventRows().filter((event) => event.kind === "exported").length,
      0,
      scenario,
    );
  }
});

test("a changed consented address requires a new draft and approval before a new export", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const approved = await approve(f, drafted);
  f.state.items[0].reply = consent({ recipient: "other@example.test" });
  const refused = await exportNow(f, approved);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "STALE_APPROVAL");
  const saved = await draft(f, { body });
  assert.equal(saved.ok, true, saved.message);
  assert.equal(saved.reply.draft.revision, 2);
  assert.equal(saved.reply.state, "draft");
  const reapproved = await approve(f, saved);
  assert.equal(reapproved.ok, true, reapproved.message);
  assert.notEqual(reapproved.reply.approval.id, approved.reply.approval.id);
  const exported = await exportNow(f, reapproved);
  assert.equal(exported.ok, true, exported.message);
  assert.equal(exported.manualExport.recipient, "other@example.test");
  assert.ok(exported.manualExport.receipt.includes("To: other@example.test"));
  assert.equal(exported.manualExport.sent, false);
});

test("an expired approval is refused and cannot be replayed", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const approved = await approve(f, drafted);
  f.sqlite
    .prepare(
      "UPDATE creator_enquiry_reply_jobs SET approval_expires_at=? WHERE id=?",
    )
    .run(new Date(now - 60 * 1000).toISOString(), f.job().id);
  const read = await f.journey();
  assert.equal(read.reply.state, "invalidated");
  assert.match(read.reply.reason, /approval expired/i);
  const refused = await exportNow(f, approved);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "STALE_APPROVAL");
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    0,
  );
});

test("editors may prepare; only the owner may approve, export or decline; viewers cannot read", async (t) => {
  const f = await prepared(t);
  const editorDraft = await f.call(
    {
      action: "replyDraft",
      item: f.item().id,
      expectedRevision: 0,
      body,
      generator: "owner",
    },
    { caller: editor },
  );
  assert.equal(editorDraft.ok, true, editorDraft.message);
  assert.equal(editorDraft.reply.draft.generator, "owner");
  const editorApprove = await f.call(
    {
      action: "replyApprove",
      item: f.item().id,
      expectedRevision: editorDraft.reply.draft.revision,
      expectedDigest: editorDraft.reply.draft.digest,
    },
    { caller: editor },
  );
  assert.equal(editorApprove.ok, false);
  assert.equal(editorApprove.code, "FORBIDDEN");
  const editorExport = await f.call(
    {
      action: "replyExport",
      item: f.item().id,
      expectedApproval: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expectedDigest: editorDraft.reply.draft.digest,
    },
    { caller: editor },
  );
  assert.equal(editorExport.ok, false);
  assert.equal(editorExport.code, "FORBIDDEN");
  const viewerRead = await f.journey(f.runtime, viewer);
  assert.equal(viewerRead.ok, false);
  assert.equal(viewerRead.code, "FORBIDDEN");
  const ownerApproved = await approve(f, editorDraft);
  assert.equal(ownerApproved.ok, true, ownerApproved.message);
});

test("revoked owner access and a changed app connection refuse export without losing the approval", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const approved = await approve(f, drafted);
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, owner.id);
  const revoked = await exportNow(f, approved);
  assert.equal(revoked.ok, false);
  assert.equal(revoked.code, "FORBIDDEN");
  assert.equal(f.job().state, "approved");
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    0,
  );
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='owner' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, owner.id);
  const changedConnection = await f.call(
    {
      action: "replyExport",
      item: f.item().id,
      expectedApproval: approved.reply.approval.id,
      expectedDigest: approved.reply.draft.digest,
    },
    {
      selected: { ...f.runtime, RESOURCE_ENVIRONMENT: "preview" },
    },
  );
  assert.equal(changedConnection.ok, false);
  assert.equal(f.job().state, "approved");
  const exported = await exportNow(f, approved);
  assert.equal(exported.ok, true, exported.message);
  assert.equal(exported.manualExport.sent, false);
});

test("a declined reply stays declined and never creates an export receipt", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const declined = await f.call(
    {
      action: "replyDecline",
      item: f.item().id,
      expectedRevision: drafted.reply.draft.revision,
      reason: "The owner decided not to reply to this fictional brief.",
    },
    { selected: f.runtime },
  );
  assert.equal(declined.ok, true, declined.message);
  assert.equal(declined.reply.state, "declined");
  assert.match(declined.reply.reason, /decided not to reply/i);
  assert.equal(declined.reply.next.kind, "none");
  const repeated = await f.call(
    {
      action: "replyDecline",
      item: f.item().id,
      expectedRevision: drafted.reply.draft.revision,
    },
    { selected: f.runtime },
  );
  assert.equal(repeated.ok, true, repeated.message);
  assert.equal(
    f.eventRows().filter((event) => event.kind === "declined").length,
    1,
  );
  const refused = await f.call(
    {
      action: "replyExport",
      item: f.item().id,
      expectedApproval: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expectedDigest: drafted.reply.draft.digest,
    },
    { selected: f.runtime },
  );
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "CONFLICT");
  assert.match(refused.message, /declined/i);
  assert.equal(
    f.eventRows().filter((event) => event.kind === "exported").length,
    0,
  );
});

test("a save with unchanged text keeps a valid approval, and a stale brief revision requires a new draft", async (t) => {
  const f = await prepared(t);
  const drafted = await draft(f);
  const approved = await approve(f, drafted);
  const unchanged = await draft(f, { body });
  assert.equal(unchanged.ok, true, unchanged.message);
  assert.equal(unchanged.reply.state, "approved");
  assert.equal(unchanged.reply.approval.id, approved.reply.approval.id);
  // A new brief revision with the same text is a new source binding.
  f.state.items[0].revision = 2;
  const read = await f.journey();
  assert.equal(read.reply.state, "invalidated");
  assert.match(read.reply.reason, /brief changed/i);
  const refused = await exportNow(f, approved);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "STALE_APPROVAL");
  const saved = await draft(f, { body });
  assert.equal(saved.ok, true, saved.message);
  assert.equal(saved.reply.draft.revision, 2);
  assert.equal(saved.reply.source.itemRevision, 2);
  const reapproved = await approve(f, saved);
  assert.equal(reapproved.ok, true, reapproved.message);
  const exported = await exportNow(f, reapproved);
  assert.equal(exported.ok, true, exported.message);
  assert.equal(exported.manualExport.itemRevision, 2);
  assert.equal(exported.manualExport.sent, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, migration } from "./helpers/stacks-sqlite.mjs";
import {
  createStack,
  publishStack,
  saveStack,
  workspaceForUser,
} from "../src/lib/stacks.mjs";
import {
  melbourneLocalInput,
  melbourneLocalInstant,
  shareCalendarCommand,
} from "../src/lib/share-calendar.ts";
import {
  BLUESKY_APPROVAL_REASON_LABELS,
  BLUESKY_APPROVAL_STATES,
  BLUESKY_TEXT_BYTES,
  BLUESKY_TEXT_GRAPHEMES,
  blueskyApprovalStatus,
  blueskyPackageForItem,
  blueskySendOutcome,
  blueskyTextForItem,
  blueskyUsage,
  buildBlueskyPackage,
  createBlueskyApproval,
  createBlueskyContent,
  hasBlueskyDraft,
  sha256Text,
} from "../src/lib/share-approval.ts";
import {
  BLUESKY_CREDENTIAL_STATEMENT,
  BLUESKY_PUBLISHING_STATEMENT,
  configuredBlueskyHandle,
  normalizeBlueskyHandle,
  resolveBlueskyIdentity,
} from "../src/lib/bluesky-account.ts";
import {
  approvalPackageForItem,
  sharePackageJson,
  sharePackageMarkdown,
  sharePackagePlainText,
} from "../src/lib/share-package.ts";
import { manageShareCalendar } from "../src/lib/share-calendar-admin.ts";

const origin = "https://composer.loftwah.com";
const handle = "trail-notes.bsky.social";
const did = "did:plc:abcdefghijklmnopqrstuvwx";
const now = new Date("2026-11-16T00:00:00.000Z");
const future = "2099-02-01T09:30:00.000Z";
const itemId = "11111111-1111-4111-8111-111111111111";

const schema = [
  "0003_stacks.sql",
  "0004_stack_publications.sql",
  "0031_share_calendar.sql",
  "0032_share_calendar_packages.sql",
  "0034_share_approvals.sql",
  "0035_bluesky_deliveries.sql",
  "0037_portfolio_no_stack.sql",
]
  .map(migration)
  .join("\n");

const owner = { id: "fictional-bluesky-owner", role: 20 };

const trailNotes = {
  id: "fictional-trail-notes",
  slug: "fictional-trail-notes",
  name: "Fictional Trail Notes",
  description:
    "Public fictional trail notes and approved visitor postcards. No private records.",
  publication: 7,
  publishedAt: "2026-11-10T00:00:00.000Z",
  url: origin + "/s/fictional-trail-notes",
  imagePath: `/s/fictional-trail-notes/share/v2-r7-${"a".repeat(64)}.png`,
  imageAlt:
    "Fictional Trail Notes. Published apps: Trail Notes. App Composer stack, published revision 7.",
  apps: ["Trail Notes"],
};

function contentItem(overrides = {}) {
  return {
    id: itemId,
    stack: trailNotes.id,
    stackName: trailNotes.name,
    stackSlug: trailNotes.slug,
    publication: trailNotes.publication,
    sourceCurrent: true,
    channel: "linkedin",
    destination: "MP personal LinkedIn profile",
    caption: "LinkedIn remains the manual fallback.",
    variants: [
      {
        channel: "bluesky",
        destination: "",
        caption: "A public Trail Notes walk, published with exact approval. 🌏",
      },
    ],
    link: trailNotes.url,
    scheduledAt: future,
    state: "scheduled",
    sharedAt: null,
    revision: 3,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    ...overrides,
  };
}

function identity(overrides = {}) {
  return {
    ok: true,
    status: "resolved",
    handle,
    did,
    displayName: "Trail Notes",
    avatar: "https://cdn.bsky.app/img/avatar/plain/example",
    profileUrl: `https://bsky.app/profile/${handle}`,
    resolvedAt: now.toISOString(),
    source: "public.api.bsky.app",
    message: "The public AT Protocol AppView returned this profile.",
    retryable: false,
    publicIdentity: "resolved",
    publishing: {
      authorised: false,
      reason: "no_authorised_connection",
      statement: BLUESKY_PUBLISHING_STATEMENT,
    },
    ...overrides,
  };
}

function account(overrides = {}) {
  return {
    handle,
    did,
    displayName: "Trail Notes",
    avatar: "https://cdn.bsky.app/img/avatar/plain/example",
    profileUrl: `https://bsky.app/profile/${handle}`,
    resolvedAt: now.toISOString(),
    publicIdentity: "resolved",
    publishing: "not_authorised",
    ...overrides,
  };
}

async function approvedContent() {
  const content = await createBlueskyContent(contentItem(), trailNotes, now);
  assert.deepEqual(content.problems, []);
  const approval = await createBlueskyApproval(content, account(), { now });
  return { content, approval };
}

test("Bluesky counts graphemes and bytes, including composed emoji", () => {
  assert.equal(blueskyUsage("👩‍👩‍👧‍👦").count, 1);
  assert.equal(blueskyUsage("👍🏽").count, 1);
  assert.equal(blueskyUsage("🇦🇺").count, 1);
  assert.equal(blueskyUsage("e\u0301").count, 1);
  assert.equal(blueskyUsage("🌏".repeat(BLUESKY_TEXT_GRAPHEMES)).count, 300);
  assert.equal(
    blueskyUsage("🌏".repeat(BLUESKY_TEXT_GRAPHEMES)).withinLimit,
    true,
  );
  assert.equal(
    blueskyUsage("🌏".repeat(BLUESKY_TEXT_GRAPHEMES + 1)).withinLimit,
    false,
  );
  // 300 graphemes but far beyond the 3,000-byte lexicon limit.
  const family = "👩‍👩‍👧‍👦".repeat(BLUESKY_TEXT_GRAPHEMES);
  const usage = blueskyUsage(family);
  assert.equal(usage.count, 300);
  assert.ok(usage.bytes > BLUESKY_TEXT_BYTES);
  assert.equal(usage.withinLimit, false);
  assert.match(
    BLUESKY_APPROVAL_REASON_LABELS.text_too_many_bytes,
    /3000 UTF-8 bytes/,
  );
});

test("the owner's datetime input is converted from Melbourne wall time, not the browser zone", () => {
  assert.equal(
    melbourneLocalInstant("2026-11-20T20:30"),
    "2026-11-20T09:30:00.000Z",
  );
  assert.equal(
    melbourneLocalInstant("2026-06-20T20:30"),
    "2026-06-20T10:30:00.000Z",
  );
  assert.equal(
    melbourneLocalInput("2026-11-20T09:30:00.000Z"),
    "2026-11-20T20:30",
  );
  assert.equal(
    melbourneLocalInput("2026-06-20T10:30:00.000Z"),
    "2026-06-20T20:30",
  );
  // 2026-10-04 02:30 does not exist in Melbourne: the clock jumps 02:00→03:00.
  assert.equal(melbourneLocalInstant("2026-10-04T02:30"), null);
  assert.equal(melbourneLocalInstant("not-a-time"), null);
  assert.equal(melbourneLocalInput(null), "");
});

test("the Bluesky draft binds public Trail Notes copy, card, alt, link and both times", async () => {
  const content = await createBlueskyContent(contentItem(), trailNotes, now);
  assert.equal(hasBlueskyDraft(contentItem()), true);
  assert.equal(
    blueskyTextForItem(contentItem()),
    "A public Trail Notes walk, published with exact approval. 🌏",
  );
  assert.equal(content.itemId, itemId);
  assert.equal(content.revision, 3);
  assert.equal(content.usage.count, blueskyUsage(content.text).count);
  assert.ok(content.usage.count <= 300);
  assert.equal(content.media.length, 1);
  assert.equal(
    content.media[0].url,
    new URL(trailNotes.imagePath, trailNotes.url).href,
  );
  assert.equal(content.media[0].alt, trailNotes.imageAlt);
  assert.equal(content.media[0].revision, trailNotes.imagePath);
  assert.match(content.media[0].hash, /^[a-f0-9]{64}$/);
  assert.match(content.mediaHash, /^[a-f0-9]{64}$/);
  assert.equal(content.link, trailNotes.url);
  assert.match(
    content.schedule.local ?? "",
    /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} (AEDT|AEST)$/,
  );
  assert.match(
    content.schedule.utc ?? "",
    /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2} UTC$/,
  );
  assert.equal(content.schedule.timeZone, "Australia/Melbourne");
  assert.equal(content.schedule.scheduledAt, future);
  assert.match(content.source.rightsNote, /Public share card/);
  assert.match(
    content.source.rightsNote,
    /No visitor, enquiry or workspace-private record/,
  );
  assert.deepEqual(content.problems, []);
  assert.equal(content.textHash, await sha256Text(content.text));
});

test("approval binds the account DID, revision, text, media, link and time", async () => {
  const { content, approval } = await approvedContent();
  assert.equal(approval.state, "approved");
  assert.equal(approval.approvalRevision, 1);
  assert.equal(approval.accountDid, did);
  assert.equal(approval.accountHandle, handle);
  assert.equal(approval.draftRevision, content.revision);
  assert.equal(approval.textHash, content.textHash);
  assert.equal(approval.mediaHash, content.mediaHash);
  assert.equal(approval.link, content.link);
  assert.equal(approval.scheduledAt, future);
  assert.match(approval.bindingHash, /^[a-f0-9]{64}$/);

  const status = blueskyApprovalStatus({
    content,
    account: account(),
    approval,
    now,
  });
  assert.equal(status.state, "approved");
  assert.equal(status.label, "Approved (not sent)");
  assert.equal(status.notSent, true);
  assert.equal(status.send.ok, false);
  assert.equal(status.send.code, "needs_owner");
  assert.match(status.send.message, /Nothing was sent/);
  assert.match(status.send.message, /no Bluesky publishing connection/i);
  assert.equal(status.canCancel, true);

  const changed = async (nextContent, nextAccount = account(), at = now) =>
    blueskyApprovalStatus({
      content: nextContent,
      account: nextAccount,
      approval,
      now: at,
    });

  const textChanged = {
    ...content,
    text: content.text + " Edit",
    textHash: await sha256Text(content.text + " Edit"),
  };
  assert.ok((await changed(textChanged)).reasons.includes("text_changed"));

  const didChanged = await changed(
    content,
    account({ did: "did:plc:zyxwvutsrqponmlkjihgfedc" }),
  );
  assert.ok(didChanged.reasons.includes("account_did_changed"));

  const handleChanged = await changed(
    content,
    account({ handle: "trail-notes-two.bsky.social" }),
  );
  assert.ok(handleChanged.reasons.includes("account_handle_changed"));

  const mediaChanged = await changed({
    ...content,
    media: [
      {
        ...content.media[0],
        alt: "A different public card",
        revision: "different-media-revision",
        hash: await sha256Text("different"),
      },
    ],
    mediaHash: await sha256Text("different"),
  });
  assert.ok(mediaChanged.reasons.includes("media_changed"));

  const linkChanged = await changed({
    ...content,
    link: trailNotes.url + "?edit=1",
  });
  assert.ok(linkChanged.reasons.includes("link_changed"));

  const timeChanged = await changed({
    ...content,
    scheduledAt: "2099-02-02T09:30:00.000Z",
    schedule: { ...content.schedule, scheduledAt: "2099-02-02T09:30:00.000Z" },
  });
  assert.ok(timeChanged.reasons.includes("time_changed"));

  const revisionChanged = await changed({
    ...content,
    revision: content.revision + 1,
  });
  assert.ok(revisionChanged.reasons.includes("draft_revision_changed"));
  assert.notEqual(revisionChanged.state, "approved");
  assert.equal(revisionChanged.state, "awaiting_approval");
});

test("expiry, cancellation, revocation and an unknown receipt each invalidate honestly", async () => {
  const { content, approval } = await approvedContent();
  const base = { content, account: account(), approval };

  const before = blueskyApprovalStatus({
    ...base,
    now: new Date("2026-11-16T23:59:00.000Z"),
  });
  assert.equal(before.state, "approved");

  const expired = blueskyApprovalStatus({
    ...base,
    now: new Date("2026-11-17T00:00:00.000Z"),
  });
  assert.equal(expired.state, "awaiting_approval");
  assert.ok(expired.reasons.includes("approval_expired"));
  assert.notEqual(expired.label, "Approved (not sent)");

  const cancelled = {
    ...approval,
    state: "cancelled",
    approvalRevision: 2,
    cancelledAt: now.toISOString(),
  };
  const cancelledStatus = blueskyApprovalStatus({
    content,
    account: account(),
    approval: cancelled,
    now,
  });
  assert.equal(cancelledStatus.state, "cancelled");
  assert.equal(cancelledStatus.label, "Cancelled");
  assert.ok(cancelledStatus.reasons.includes("approval_cancelled"));
  assert.equal(cancelledStatus.canCancel, false);
  assert.match(cancelledStatus.send.message, /Nothing was sent/);

  const revokedConnection = blueskyApprovalStatus({
    content,
    account: account(),
    approval,
    now,
    connection: {
      state: "revoked",
      reason: "Owner revoked the connection",
      revokedAt: now.toISOString(),
    },
  });
  assert.equal(revokedConnection.state, "blocked");
  assert.ok(revokedConnection.reasons.includes("connection_revoked"));
  assert.equal(revokedConnection.send.code, "needs_owner");

  const unknown = blueskyApprovalStatus({
    content,
    account: account(),
    approval,
    now,
    receipt: {
      state: "unknown",
      recordedAt: now.toISOString(),
      reason: "No provider receipt arrived",
    },
  });
  assert.equal(unknown.state, "unknown");
  assert.equal(unknown.label, "Unknown");
  assert.equal(unknown.canApprove, false);
  assert.match(unknown.note, /will not retry automatically/);
  assert.match(unknown.send.message, /unknown/i);
});

test("an unexpired approval stays sendable after its intended time", async () => {
  const item = contentItem({ scheduledAt: "2026-11-16T01:00:00.000Z" });
  const content = await createBlueskyContent(item, trailNotes, now);
  assert.deepEqual(content.problems, []);
  const approval = await createBlueskyApproval(content, account(), { now });
  const sendAt = new Date("2026-11-16T01:05:00.000Z");
  const sendContent = await createBlueskyContent(item, trailNotes, sendAt);
  assert.ok(
    sendContent.problems.some((problem) => problem.code === "time_passed"),
    "the content itself reports the passed intended time",
  );
  const status = blueskyApprovalStatus({
    content: sendContent,
    account: account(),
    approval,
    connection: {
      state: "configured",
      handle,
      did,
    },
    now: sendAt,
  });
  assert.ok(status.reasons.includes("time_passed"));
  assert.equal(status.state, "approved");
  assert.equal(status.send.ok, true);
  assert.equal(status.send.code, "ready");

  const expired = blueskyApprovalStatus({
    content: sendContent,
    account: account(),
    approval,
    now: new Date("2026-11-16T04:00:00.000Z"),
  });
  assert.ok(expired.reasons.includes("approval_expired"));
  assert.notEqual(expired.state, "approved");
  assert.equal(expired.send.ok, false);
});

test("re-approval advances the approval revision and past times are blocked", async () => {
  const { content, approval } = await approvedContent();
  const again = await createBlueskyApproval(content, account(), {
    now: new Date("2026-11-16T01:00:00.000Z"),
    previous: approval,
  });
  assert.equal(again.approvalRevision, 2);
  assert.equal(
    again.bindingHash,
    approval.bindingHash,
    "the unchanged exact content keeps the same binding hash",
  );
  assert.equal(again.state, "approved");

  const past = {
    ...contentItem({
      scheduledAt: "2026-11-15T09:30:00.000Z",
    }),
  };
  const pastContent = await createBlueskyContent(past, trailNotes, now);
  assert.ok(
    pastContent.problems.some((problem) => problem.code === "time_passed"),
  );
  await assert.rejects(
    () => createBlueskyApproval(pastContent, account(), { now }),
    /intended time has passed/i,
  );
  const pastStatus = blueskyApprovalStatus({
    content: pastContent,
    account: account(),
    approval: null,
    now,
  });
  assert.equal(pastStatus.state, "blocked");
  assert.equal(pastStatus.canApprove, false);
});

test("public identity resolution reports success, absence and every failure state", async () => {
  const calls = [];
  const success = await resolveBlueskyIdentity("@Trail-Notes.bsky.social", {
    now,
    fetch: async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          did,
          handle,
          displayName: "Trail Notes",
          avatar: "https://cdn.bsky.app/img/avatar/plain/example",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  assert.equal(success.status, "resolved");
  assert.equal(success.ok, true);
  assert.equal(success.handle, handle);
  assert.equal(success.did, did);
  assert.equal(success.publicIdentity, "resolved");
  assert.equal(success.publishing.authorised, false);
  assert.match(success.publishing.statement, /not publishing authorisation/);
  assert.match(
    calls[0],
    /^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.actor\.getProfile\?actor=trail-notes\.bsky\.social$/,
  );
  assert.deepEqual(Object.keys(success).sort(), [
    "avatar",
    "did",
    "displayName",
    "handle",
    "message",
    "ok",
    "profileUrl",
    "publicIdentity",
    "publishing",
    "resolvedAt",
    "retryable",
    "source",
    "status",
  ]);
  assert.equal("token" in success, false);
  assert.equal("password" in success, false);

  const needs = await resolveBlueskyIdentity(null, { now });
  assert.equal(needs.status, "needs_account");
  assert.match(needs.message, /No Bluesky handle is configured/);

  let fetchedWithoutHandle = false;
  const needsNoFetch = await resolveBlueskyIdentity("", {
    now,
    fetch: async () => {
      fetchedWithoutHandle = true;
      throw new Error("must not fetch");
    },
  });
  assert.equal(needsNoFetch.status, "needs_account");
  assert.equal(fetchedWithoutHandle, false);

  for (const invalid of [
    "not a handle",
    "name",
    "127.0.0.1",
    "owner.bsky.social:app-password",
    "@",
    "a".repeat(254) + ".social",
  ]) {
    const result = await resolveBlueskyIdentity(invalid, { now });
    assert.equal(result.status, "invalid_handle", invalid);
    assert.equal(result.publicIdentity, "unresolved");
  }

  const notFound = await resolveBlueskyIdentity(handle, {
    now,
    fetch: async () =>
      new Response(JSON.stringify({ error: "InvalidRequest" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
  });
  assert.equal(notFound.status, "not_found");
  assert.equal(notFound.retryable, false);

  const failed = await resolveBlueskyIdentity(handle, {
    now,
    fetch: async () => new Response("{}", { status: 503 }),
  });
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.retryable, true);

  const redirected = await resolveBlueskyIdentity(handle, {
    now,
    fetch: async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://example.invalid/profile" },
      }),
  });
  assert.equal(redirected.status, "unavailable");
  assert.match(redirected.message, /redirected/i);
  assert.equal(redirected.publicIdentity, "unresolved");

  const networked = await resolveBlueskyIdentity(handle, {
    now,
    fetch: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(networked.status, "unavailable");
  assert.equal(networked.publicIdentity, "unresolved");

  const timedOut = await resolveBlueskyIdentity(handle, {
    now,
    timeoutMs: 10,
    fetch: () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve(
              new Response(JSON.stringify({ did, handle }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
            ),
          100,
        ),
      ),
  });
  assert.equal(timedOut.status, "unavailable");
  assert.match(timedOut.message, /short timeout/i);

  const mismatch = await resolveBlueskyIdentity(handle, {
    now,
    fetch: async () =>
      new Response(JSON.stringify({ did, handle: "different.bsky.social" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });
  assert.equal(mismatch.status, "mismatch");
  assert.equal(mismatch.publicIdentity, "unresolved");

  const invalidDid = await resolveBlueskyIdentity(handle, {
    now,
    fetch: async () =>
      new Response(JSON.stringify({ did: "did:key:not-valid", handle }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });
  assert.equal(invalidDid.status, "unavailable");

  const unsafeAvatar = await resolveBlueskyIdentity(handle, {
    now,
    fetch: async () =>
      new Response(
        JSON.stringify({
          did,
          handle,
          avatar: "http://user:pass@cdn.example/avatar",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  assert.equal(unsafeAvatar.status, "resolved");
  assert.equal(unsafeAvatar.avatar, null);
});

test("the identity module reads only the public handle; credentials stay in the encrypted setting", () => {
  assert.equal(configuredBlueskyHandle({}), null);
  assert.equal(
    configuredBlueskyHandle({
      SHARE_BLUESKY_HANDLE: "@Trail-Notes.bsky.social",
    }),
    handle,
  );
  assert.equal(
    configuredBlueskyHandle({
      SHARE_BLUESKY_HANDLE: "not a handle",
    }),
    null,
  );
  assert.equal(
    configuredBlueskyHandle({
      BSKY_APP_PASSWORD: "should-never-be-read",
      BLUESKY_ACCESS_TOKEN: "should-never-be-read",
    }),
    null,
  );
  assert.equal(normalizeBlueskyHandle("owner.bsky.social:secret"), null);
  assert.equal(normalizeBlueskyHandle("owner.bsky.social/path"), null);
  assert.match(
    BLUESKY_CREDENTIAL_STATEMENT,
    /never asks|encrypted plugin setting/i,
  );
  assert.doesNotMatch(BLUESKY_CREDENTIAL_STATEMENT, /paste it here/i);
});

test("a send path is ready only with an exact approval and a configured connection", async () => {
  const { content, approval } = await approvedContent();
  const status = blueskyApprovalStatus({
    content,
    account: account(),
    approval,
    now,
  });
  const absent = blueskySendOutcome({
    state: status.state,
    account: account(),
    connection: { state: "absent", reason: "No connection" },
  });
  assert.equal(absent.ok, false);
  assert.equal(absent.available, false);
  assert.equal(absent.code, "needs_owner");
  assert.match(absent.message, /Nothing was sent/);

  const revoked = blueskySendOutcome({
    state: status.state,
    account: account(),
    connection: {
      state: "revoked",
      reason: "Revoked",
      revokedAt: now.toISOString(),
    },
  });
  assert.equal(revoked.code, "needs_owner");
  assert.match(revoked.message, /owner must reconnect/i);

  const mismatch = blueskySendOutcome({
    state: status.state,
    account: account(),
    connection: {
      state: "authorised",
      did: "did:plc:zyxwvutsrqponmlkjihgfedc",
      scope: "app.bsky.feed.post",
      authorisedAt: now.toISOString(),
    },
  });
  assert.equal(mismatch.code, "account_mismatch");
  assert.match(mismatch.message, /Nothing was sent/);

  const nominal = blueskySendOutcome({
    state: status.state,
    account: account(),
    connection: {
      state: "authorised",
      did,
      scope: "app.bsky.feed.post",
      authorisedAt: now.toISOString(),
    },
  });
  assert.equal(nominal.ok, true);
  assert.equal(nominal.available, true);
  assert.equal(nominal.code, "ready");
  assert.match(nominal.message, /Nothing is sent until the owner confirms/i);
  assert.equal(
    shareCalendarCommand.safeParse({
      action: "blueskySend",
      item: itemId,
      expectedRevision: 1,
      expectedApprovalRevision: 1,
    }).success,
    true,
  );
  assert.equal(
    shareCalendarCommand.safeParse({
      action: "blueskySend",
      item: itemId,
      expectedRevision: 1,
    }).success,
    false,
  );
  assert.equal(
    shareCalendarCommand.safeParse({
      action: "blueskyReconcile",
      item: itemId,
      expectedApprovalRevision: 1,
    }).success,
    true,
  );
});

test("the package exports the exact account, text, media, times and approval state", async () => {
  const { content, approval } = await approvedContent();
  const status = blueskyApprovalStatus({
    content,
    account: account(),
    approval,
    now,
  });
  const identityResult = identity();
  const bluesky = buildBlueskyPackage(
    content,
    identityResult,
    approval,
    status,
  );
  const item = contentItem();
  const value = approvalPackageForItem(
    {
      ok: true,
      workspace: {
        id: "fictional-trail",
        name: "Fictional Trail",
        role: "owner",
      },
      sources: [trailNotes],
      items: [item],
      approvals: [approval],
      bluesky: { configuredHandle: handle },
      now: now.toISOString(),
      changed: null,
    },
    item,
    bluesky,
  );
  assert.equal(value.bluesky?.account.status, "resolved");
  assert.equal(value.bluesky?.account.handle, handle);
  assert.equal(value.bluesky?.account.did, did);
  assert.equal(value.bluesky?.count, content.usage.count);
  assert.equal(value.bluesky?.textHash, content.textHash);
  assert.equal(value.bluesky?.limit, 300);
  assert.equal(value.bluesky?.media.length, 1);
  assert.equal(value.bluesky?.schedule.local, content.schedule.local);
  assert.equal(value.bluesky?.schedule.utc, content.schedule.utc);
  assert.equal(value.bluesky?.approval.label, "Approved (not sent)");
  assert.equal(value.bluesky?.approval.notSent, true);
  assert.equal(value.bluesky?.send.available, false);

  const json = sharePackageJson(value);
  const decoded = JSON.parse(json);
  assert.equal(decoded.bluesky.account.did, did);
  assert.equal(decoded.bluesky.text, content.text);
  assert.equal(decoded.bluesky.textHash, content.textHash);
  assert.equal(decoded.bluesky.approval.state, "approved");
  assert.equal(decoded.bluesky.approval.notSent, true);
  assert.equal(decoded.bluesky.media[0].alt, trailNotes.imageAlt);
  assert.match(json, /composer\.bluesky-approval-package\/v1/);

  const markdown = sharePackageMarkdown(value);
  assert.match(markdown, /## Bluesky/);
  assert.ok(markdown.includes("@" + handle));
  assert.ok(markdown.includes(did));
  assert.match(markdown, /Approved \(not sent\)/);
  assert.match(markdown, /graphemes/);
  assert.match(markdown, /Send:.*unavailable/);
  assert.match(markdown, /not sent/i);
  const plain = sharePackagePlainText(value);
  assert.ok(plain.includes("BLUESKY · @" + handle));
  assert.match(plain, /media descriptor hash/i);
  assert.match(plain, /not sent/i);

  const needs = buildBlueskyPackage(
    await createBlueskyContent(contentItem(), null, now),
    null,
    null,
    blueskyApprovalStatus({
      content: await createBlueskyContent(contentItem(), null, now),
      account: null,
      approval: null,
      now,
    }),
  );
  assert.equal(needs.account.status, "not_checked");
  assert.equal(needs.account.handle, null);
  assert.equal(needs.account.publicIdentity, "unresolved");
  assert.match(
    needs.account.statement,
    /No public Bluesky account has been resolved/,
  );
});

// ---------------------------------------------------------------------------
// Owner route behaviour with the real SQLite schema.

function sample(name) {
  return {
    version: 1,
    name,
    description: "A public published stack for the Bluesky approval test.",
    theme: "midnight",
    instances: [
      { id: "fictional-bluesky-instance", app: "hello", label: "Hello World" },
    ],
  };
}

async function seeded(db, user = owner, name = "Fictional Trail Notes") {
  const workspace = await workspaceForUser(db, user);
  const draft = await createStack(db, workspace.id, name);
  const saved = await saveStack(
    db,
    workspace.id,
    draft.id,
    sample(name),
    draft.revision,
  );
  const published = await publishStack(
    db,
    workspace.id,
    saved.id,
    saved.revision,
  );
  return { workspace, stack: published };
}

function fakeIdentity(options = {}) {
  const calls = [];
  const fetch = async (input) => {
    calls.push(String(input));
    if (options.failure === "not_found")
      return new Response(JSON.stringify({ error: "InvalidRequest" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    if (options.failure === "unavailable")
      return new Response("{}", { status: 503 });
    return new Response(
      JSON.stringify({
        did,
        handle,
        displayName: "Fictional Trail Notes",
        avatar: "https://cdn.bsky.app/img/avatar/plain/example",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  return { calls, fetch };
}

function runtime(db, options = {}) {
  return {
    DB: db,
    PUBLIC_ORIGIN: origin,
    SHARE_BLUESKY_HANDLE: options.configured === false ? undefined : handle,
    fetch: options.fetch,
  };
}

function call(db, user, value, method = "POST", options = {}) {
  const read = method === "GET";
  return manageShareCalendar(
    {
      user,
      input: value,
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/" +
          (read ? "shareCalendarRead" : "shareCalendarWrite"),
        {
          method,
          headers: read
            ? {}
            : {
                Origin: origin,
                "X-EmDash-Request": "1",
                "Content-Type": "application/json",
              },
        },
      ),
    },
    runtime(db, options),
  );
}

function createApprovalItem(db, user, stack) {
  return call(
    db,
    user,
    {
      action: "create",
      stack: stack.id,
      channel: "linkedin",
      destination: "MP personal LinkedIn profile",
      caption: "LinkedIn remains the manual fallback.",
      link: origin + "/s/" + stack.slug,
      scheduledAt: future,
    },
    "POST",
  );
}

test("the owner route resolves a public handle and persists an exact approval", async () => {
  const db = sqliteD1({ schema });
  try {
    const { workspace, stack } = await seeded(db);
    const created = await createApprovalItem(db, owner, stack);
    assert.equal(created.ok, true);
    let item = created.items[0];
    const variant = await call(db, owner, {
      action: "variant",
      item: item.id,
      expectedRevision: item.revision,
      channel: "bluesky",
      caption: "A public Trail Notes walk, published with exact approval.",
    });
    assert.equal(variant.ok, true);
    item = variant.items.find((entry) => entry.id === item.id);
    assert.ok(item);

    const listed = await call(db, owner, { action: "list" }, "GET");
    assert.equal(listed.ok, true);
    assert.equal(listed.bluesky.configuredHandle, handle);
    assert.deepEqual(listed.approvals, []);

    const identityReply = await call(
      db,
      owner,
      { action: "blueskyIdentity" },
      "GET",
      { fetch: fakeIdentity().fetch },
    );
    assert.equal(identityReply.ok, true);
    assert.equal(identityReply.action, "blueskyIdentity");
    assert.equal(identityReply.result.status, "resolved");
    assert.equal(identityReply.result.did, did);
    assert.equal(identityReply.result.publishing.authorised, false);

    const noConfigured = await call(
      db,
      owner,
      { action: "blueskyIdentity" },
      "GET",
      { configured: false, fetch: fakeIdentity().fetch },
    );
    assert.equal(noConfigured.ok, true);
    assert.equal(noConfigured.result.status, "needs_account");

    const fake = fakeIdentity();
    const approved = await call(
      db,
      owner,
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fake.fetch },
    );
    assert.equal(approved.ok, true, approved.message);
    assert.equal(fake.calls.length, 1);
    assert.match(fake.calls[0], /public\.api\.bsky\.app/);
    assert.doesNotMatch(
      fake.calls[0],
      /createRecord|com\.atproto\.repo|session|password/i,
    );
    const approval = approved.approvals[0];
    assert.ok(approval);
    assert.equal(approval.state, "approved");
    assert.equal(approval.accountHandle, handle);
    assert.equal(approval.accountDid, did);
    assert.equal(approval.draftRevision, item.revision);
    assert.equal(approval.approvalRevision, 1);
    assert.equal(approval.link, origin + "/s/" + stack.slug);
    assert.equal(approval.scheduledAt, future);
    assert.match(approval.bindingHash, /^[a-f0-9]{64}$/);

    const rows = await db
      .prepare("SELECT * FROM creator_share_approvals")
      .all();
    assert.equal(rows.results.length, 1);
    for (const key of Object.keys(rows.results[0]))
      assert.doesNotMatch(key, /password|token|secret|private.?key/i);

    const status = blueskyApprovalStatus({
      content: await createBlueskyContent(item, listed.sources[0], new Date()),
      account: account(),
      approval,
      now: new Date(),
    });
    assert.equal(status.state, "approved");

    const cancelled = await call(db, owner, {
      action: "blueskyCancel",
      item: item.id,
      expectedApprovalRevision: approval.approvalRevision,
      reason: "Owner cancelled before handoff.",
    });
    assert.equal(cancelled.ok, true, cancelled.message);
    assert.equal(cancelled.approvals[0].state, "cancelled");
    assert.equal(cancelled.approvals[0].approvalRevision, 2);
    assert.ok(cancelled.approvals[0].cancelledAt);

    const again = await call(
      db,
      owner,
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fakeIdentity().fetch },
    );
    assert.equal(again.ok, true, again.message);
    assert.equal(again.approvals[0].state, "approved");
    assert.equal(again.approvals[0].approvalRevision, 3);

    const viewerId = "fictional-bluesky-viewer";
    await db
      .prepare(
        "INSERT INTO creator_members (workspace_id,user_id,role) VALUES (?,?,?)",
      )
      .bind(workspace.id, viewerId, "viewer")
      .run();
    const viewer = await call(
      db,
      { id: viewerId, role: 20 },
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fakeIdentity().fetch },
    );
    assert.equal(viewer.code, "FORBIDDEN");
  } finally {
    db.cleanup();
  }
});

test("approval failures are explicit: no account, bad profile, past time, missing link, long text", async () => {
  const db = sqliteD1({ schema });
  try {
    const { stack } = await seeded(db);
    const created = await createApprovalItem(db, owner, stack);
    let item = created.items[0];
    const variant = await call(db, owner, {
      action: "variant",
      item: item.id,
      expectedRevision: item.revision,
      channel: "bluesky",
      caption: "A public Trail Notes walk with exact approval.",
    });
    item = variant.items.find((entry) => entry.id === item.id);

    const failedIdentity = await call(
      db,
      owner,
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fakeIdentity({ failure: "unavailable" }).fetch },
    );
    assert.equal(failedIdentity.ok, false);
    assert.equal(failedIdentity.code, "BLOCKED");
    assert.match(failedIdentity.message, /No identity was confirmed/);
    assert.match(failedIdentity.message, /stores none|app password/i);

    const invalid = await call(db, owner, {
      action: "blueskyApprove",
      item: item.id,
      expectedRevision: item.revision,
      handle: "owner.bsky.social:app-password",
    });
    assert.equal(invalid.code, "NEEDS_OWNER");
    assert.match(invalid.message, /not a valid public Bluesky handle/i);

    // A saved past time is blocked before any approval is written.
    await db
      .prepare(
        "UPDATE creator_share_calendar_items SET scheduled_at=? WHERE id=?",
      )
      .bind("2026-11-15T09:30:00.000Z", item.id)
      .run();
    const past = await call(
      db,
      owner,
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fakeIdentity().fetch },
    );
    assert.equal(past.ok, false);
    assert.equal(past.code, "BLOCKED");
    assert.match(past.message, /intended time has passed/i);

    // Missing canonical link.
    await db
      .prepare(
        "UPDATE creator_share_calendar_items SET scheduled_at=?,link='' WHERE id=?",
      )
      .bind(future, item.id)
      .run();
    const missingLink = await call(
      db,
      owner,
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fakeIdentity().fetch },
    );
    assert.equal(missingLink.code, "BLOCKED");
    assert.match(missingLink.message, /canonical link/i);

    // Over-limit text inserted directly (the normal save correctly rejects it
    // earlier with captionProblem).
    await db
      .prepare(
        "UPDATE creator_share_calendar_items SET link=?,variants=? WHERE id=?",
      )
      .bind(
        origin + "/s/" + stack.slug,
        JSON.stringify([
          {
            channel: "bluesky",
            destination: "",
            caption: "e\u0301".repeat(301),
          },
        ]),
        item.id,
      )
      .run();
    const longText = await call(
      db,
      owner,
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fakeIdentity().fetch },
    );
    assert.equal(longText.code, "BLOCKED");
    assert.match(longText.message, /300 graphemes/i);

    const rows = await db
      .prepare("SELECT COUNT(*) AS count FROM creator_share_approvals")
      .first();
    assert.equal(rows.count, 0, "no failed attempt stores an approval");
  } finally {
    db.cleanup();
  }
});

test("the approval package reads the persisted snapshot, not editor state", async () => {
  const db = sqliteD1({ schema });
  try {
    const { stack } = await seeded(db);
    const created = await createApprovalItem(db, owner, stack);
    let item = created.items[0];
    const variant = await call(db, owner, {
      action: "variant",
      item: item.id,
      expectedRevision: item.revision,
      channel: "bluesky",
      caption: "Trail Notes, public copy only. 🌏",
    });
    item = variant.items.find((entry) => entry.id === item.id);
    const approved = await call(
      db,
      owner,
      {
        action: "blueskyApprove",
        item: item.id,
        expectedRevision: item.revision,
        handle,
      },
      "POST",
      { fetch: fakeIdentity().fetch },
    );
    const listed = await call(db, owner, { action: "list" }, "GET");
    const persisted = listed.items.find((entry) => entry.id === item.id);
    const bluesky = await blueskyPackageForItem(listed, persisted, {
      identity: identity(),
      now: new Date(),
    });
    assert.ok(bluesky);
    assert.equal(bluesky.account.did, did);
    assert.equal(bluesky.approval.label, "Approved (not sent)");
    assert.equal(bluesky.send.available, false);
    const value = approvalPackageForItem(listed, persisted, bluesky);
    const decoded = JSON.parse(sharePackageJson(value));
    assert.equal(decoded.bluesky.account.did, did);
    assert.equal(decoded.bluesky.text, "Trail Notes, public copy only. 🌏");
    assert.equal(
      decoded.bluesky.count,
      blueskyUsage("Trail Notes, public copy only. 🌏").count,
    );
    assert.match(sharePackageMarkdown(value), /Approved \(not sent\)/);
    assert.equal(approved.approvals.length, 1);
  } finally {
    db.cleanup();
  }
});

test("the approval state vocabulary never claims a post", () => {
  assert.deepEqual(
    BLUESKY_APPROVAL_STATES.map((state) => state.id),
    [
      "draft",
      "awaiting_approval",
      "approved",
      "cancelled",
      "blocked",
      "unknown",
    ],
  );
  for (const state of BLUESKY_APPROVAL_STATES) {
    assert.doesNotMatch(
      state.label + " " + state.note,
      /^posted$|published to|live on/i,
    );
  }
  assert.equal(
    BLUESKY_APPROVAL_STATES.find((state) => state.id === "approved")?.label,
    "Approved (not sent)",
  );
  assert.doesNotMatch(
    BLUESKY_APPROVAL_REASON_LABELS.unknown_receipt,
    /posted successfully/i,
  );
});

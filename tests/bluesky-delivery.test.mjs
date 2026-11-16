import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sqliteD1, migration } from "./helpers/stacks-sqlite.mjs";
import {
  createStack,
  publishStack,
  saveStack,
  workspaceForUser,
} from "../src/lib/stacks.mjs";
import { manageShareCalendar } from "../src/lib/share-calendar-admin.ts";
import {
  blueskyDeliveryKey,
  claimBlueskyDelivery,
  markBlueskyDeliveryPublished,
} from "../src/lib/bluesky-delivery.ts";
import {
  BLUESKY_APP_PASSWORD_SETTING,
  blueskyPostRkey,
} from "../src/lib/bluesky-publisher.ts";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";

const origin = "https://composer.loftwah.com";
const did = "did:plc:abcdefghijklmnopqrstuvwx";
const handle = "trail-notes.bsky.social";
const accessJwt = "access-" + "a".repeat(40);
const refreshJwt = "refresh-" + "b".repeat(40);
const cid = "bafyreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const blobLink = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const appPassword = "abcd-efgh-ijkl-mnop";
const blueskyText =
  "A public Trail Notes walk, published with exact approval. 🌏";
const base = new Date("2026-11-16T00:00:00.000Z");
const scheduled = "2026-11-16T01:00:00.000Z";
const sendNow = new Date("2026-11-16T01:05:00.000Z");
const owner = { id: "fictional-bluesky-sender", role: 20 };

const schema = [
  "0003_stacks.sql",
  "0004_stack_publications.sql",
  "0031_share_calendar.sql",
  "0032_share_calendar_packages.sql",
  "0034_share_approvals.sql",
  "0035_bluesky_deliveries.sql",
]
  .map(migration)
  .join("\n");

function sample(name) {
  return {
    version: 1,
    name,
    description: "A public published stack for the Bluesky delivery test.",
    theme: "midnight",
    instances: [
      { id: "fictional-bluesky-instance", app: "hello", label: "Hello World" },
    ],
  };
}

async function seeded(db) {
  const workspace = await workspaceForUser(db, owner);
  const draft = await createStack(db, workspace.id, "Fictional Trail Notes");
  const saved = await saveStack(
    db,
    workspace.id,
    draft.id,
    sample("Fictional Trail Notes"),
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

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeIdentity() {
  return async () =>
    json({
      did,
      handle,
      displayName: "Fictional Trail Notes",
      avatar: "https://cdn.bsky.app/img/avatar/plain/example",
    });
}

function fakeSettings(password) {
  return {
    async getVersioned(key) {
      return password && key === BLUESKY_APP_PASSWORD_SETTING
        ? { value: password, revision: "synthetic-1" }
        : null;
    },
  };
}

function runtime(db, options = {}) {
  return {
    DB: db,
    PUBLIC_ORIGIN: origin,
    SHARE_BLUESKY_HANDLE: options.configured === false ? undefined : handle,
    fetch: options.fetch,
    now: options.now ?? base,
    blueskyTimeoutMs: options.timeoutMs,
  };
}

function call(db, value, method = "POST", options = {}) {
  const read = method === "GET";
  return manageShareCalendar(
    {
      user: owner,
      input: value,
      settings:
        options.settings ??
        fakeSettings(
          options.password === null ? null : (options.password ?? appPassword),
        ),
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

function fakePds(options = {}) {
  const list = [];
  const state = { recordBody: null };
  const fetch = async (input, init = {}) => {
    const url = String(input);
    list.push({ url, init });
    if (url.startsWith(origin + "/s/")) {
      if (options.imageType)
        return new Response("not an image", {
          status: 200,
          headers: { "Content-Type": options.imageType },
        });
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
    if (url.endsWith("/com.atproto.server.createSession")) {
      if (options.session === "reject")
        return json({ error: "InvalidPassword" }, 401);
      return json({ accessJwt, refreshJwt, handle, did, active: true });
    }
    if (url.endsWith("/com.atproto.repo.uploadBlob"))
      return json({
        blob: {
          $type: "blob",
          ref: { $link: blobLink },
          mimeType: "image/png",
          size: 4,
        },
      });
    if (url.endsWith("/com.atproto.repo.createRecord")) {
      if (options.create === "timeout")
        throw new DOMException("The operation was aborted.", "AbortError");
      if (options.create === "conflict")
        return json({ error: "RecordAlreadyExists" }, 400);
      const body = JSON.parse(String(init.body));
      state.recordBody = body;
      return json({
        uri: `at://${did}/app.bsky.feed.post/${body.rkey}`,
        cid,
      });
    }
    if (url.includes("/com.atproto.repo.getRecord")) {
      if (options.read === "missing")
        return json({ error: "RecordNotFound" }, 400);
      if (options.read === "error")
        return json({ error: "InternalServerError" }, 503);
      const rkey = new URL(url).searchParams.get("rkey");
      return json({
        uri: `at://${did}/app.bsky.feed.post/${rkey}`,
        cid,
        value: { text: options.readText ?? blueskyText },
      });
    }
    throw Error("Unexpected network request: " + url);
  };
  return { list, fetch, state };
}

async function approvedItem(db, options = {}) {
  const { stack } = await seeded(db);
  const created = await call(
    db,
    {
      action: "create",
      stack: stack.id,
      channel: "linkedin",
      destination: "MP personal LinkedIn profile",
      caption: "LinkedIn remains the manual fallback.",
      link: origin + "/s/" + stack.slug,
      scheduledAt: scheduled,
    },
    "POST",
    { now: base },
  );
  assert.equal(created.ok, true, created.message);
  let item = created.items[0];
  const variant = await call(
    db,
    {
      action: "variant",
      item: item.id,
      expectedRevision: item.revision,
      channel: "bluesky",
      caption: blueskyText,
    },
    "POST",
    { now: base },
  );
  assert.equal(variant.ok, true, variant.message);
  item = variant.items.find((entry) => entry.id === item.id);
  const approved = await call(
    db,
    {
      action: "blueskyApprove",
      item: item.id,
      expectedRevision: item.revision,
      handle,
    },
    "POST",
    { now: base, fetch: fakeIdentity() },
  );
  assert.equal(approved.ok, true, approved.message);
  return {
    item: approved.items.find((entry) => entry.id === item.id),
    approval: approved.approvals.find((entry) => entry.itemId === item.id),
  };
}

function send(db, item, approval, options = {}) {
  return call(
    db,
    {
      action: "blueskySend",
      item: item.id,
      expectedRevision: item.revision,
      expectedApprovalRevision: approval.approvalRevision,
    },
    "POST",
    { now: sendNow, ...options },
  );
}

function reconcile(db, item, approval, options = {}) {
  return call(
    db,
    {
      action: "blueskyReconcile",
      item: item.id,
      expectedApprovalRevision: approval.approvalRevision,
    },
    "POST",
    { now: sendNow, ...options },
  );
}

test("send publishes once at the deterministic key and stores no secret", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const pds = fakePds();
    const sent = await send(db, item, approval, { fetch: pds.fetch });
    assert.equal(sent.ok, true, sent.message);
    const delivery = sent.deliveries.find(
      (entry) =>
        entry.itemId === item.id &&
        entry.approvalRevision === approval.approvalRevision,
    );
    assert.ok(delivery);
    assert.equal(delivery.state, "published");
    assert.equal(delivery.attempt, 1);
    assert.equal(delivery.accountHandle, handle);
    assert.equal(delivery.accountDid, did);
    assert.equal(
      delivery.rkey,
      await blueskyPostRkey(item.id, approval.approvalRevision),
    );
    assert.equal(
      delivery.providerUri,
      `at://${did}/app.bsky.feed.post/${delivery.rkey}`,
    );
    assert.equal(delivery.providerCid, cid);
    assert.equal(
      delivery.permalink,
      `https://bsky.app/profile/${handle}/post/${delivery.rkey}`,
    );
    assert.ok(delivery.publishedAt);

    const order = pds.list
      .map((entry) => entry.url.replace(/^https:\/\/[^/]+/, ""))
      .filter((path) => path.startsWith("/xrpc/"));
    assert.deepEqual(order, [
      "/xrpc/com.atproto.server.createSession",
      "/xrpc/com.atproto.repo.uploadBlob",
      "/xrpc/com.atproto.repo.createRecord",
    ]);
    assert.equal(pds.state.recordBody.repo, did);
    assert.equal(pds.state.recordBody.rkey, delivery.rkey);
    assert.equal(
      pds.state.recordBody.record.embed.$type,
      "app.bsky.embed.external",
    );
    assert.equal(pds.state.recordBody.record.embed.external.uri, approval.link);

    const rows = await db
      .prepare("SELECT * FROM creator_share_deliveries")
      .all();
    assert.equal(rows.results.length, 1);
    for (const key of Object.keys(rows.results[0]))
      assert.doesNotMatch(key, /password|token|secret|private.?key|jwt/i);
    const stored = JSON.stringify(rows.results[0]);
    assert.doesNotMatch(stored, /abcd-efgh|access-|refresh-/);
    assert.doesNotMatch(
      JSON.stringify(sent),
      /abcd-efgh|access-|refresh-|Bearer/i,
    );

    const before = pds.list.length;
    const again = await send(db, item, approval, { fetch: pds.fetch });
    assert.equal(again.ok, true, again.message);
    assert.equal(pds.list.length, before, "a published receipt is not resent");
    assert.equal(
      again.deliveries.find((entry) => entry.itemId === item.id).state,
      "published",
    );

    const cancel = await call(
      db,
      {
        action: "blueskyCancel",
        item: item.id,
        expectedApprovalRevision: approval.approvalRevision,
        reason: "Owner tried to cancel after a publish.",
      },
      "POST",
      { now: sendNow },
    );
    assert.equal(cancel.ok, false);
    assert.equal(cancel.code, "CONFLICT");
    assert.match(cancel.message, /already published/i);
  } finally {
    db.cleanup();
  }
});

test("claiming is atomic: exactly one worker can own a send", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const rkey = await blueskyPostRkey(item.id, approval.approvalRevision);
    const input = {
      itemId: item.id,
      workspaceId: (
        await db
          .prepare(
            "SELECT workspace_id FROM creator_share_calendar_items WHERE id=?",
          )
          .bind(item.id)
          .first()
      ).workspace_id,
      approvalRevision: approval.approvalRevision,
      accountHandle: handle,
      accountDid: did,
      bindingHash: approval.bindingHash,
      textHash: approval.textHash,
      rkey,
      now: sendNow,
    };
    const results = await Promise.all([
      claimBlueskyDelivery(db, input),
      claimBlueskyDelivery(db, input),
    ]);
    assert.equal(
      results.filter((entry) => entry.claimed).length,
      1,
      "one conditional claim wins",
    );
    assert.equal(results.find((entry) => !entry.claimed)?.reason, "sending");
    const key = blueskyDeliveryKey(item.id, approval.approvalRevision);
    await markBlueskyDeliveryPublished(db, key, {
      uri: `at://${did}/app.bsky.feed.post/${rkey}`,
      cid,
      permalink: `https://bsky.app/profile/${handle}/post/${rkey}`,
      now: sendNow,
    });
    const after = await claimBlueskyDelivery(db, input);
    assert.equal(after.claimed, false);
    assert.equal(after.reason, "published");
  } finally {
    db.cleanup();
  }
});

test("a timeout becomes unknown, reconciles to published and never blind retries", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const failing = fakePds({ create: "timeout" });
    const failed = await send(db, item, approval, { fetch: failing.fetch });
    assert.equal(failed.ok, false);
    assert.equal(failed.code, "UNAVAILABLE");
    assert.match(failed.message, /reconcile/i);

    const row = await db
      .prepare("SELECT * FROM creator_share_deliveries")
      .first();
    assert.equal(row.state, "unknown");
    assert.equal(row.error_code, "timeout");
    assert.equal(row.attempt, 1);
    assert.match(row.error_message, /outcome is unknown/i);
    assert.equal(
      failing.list.filter((entry) =>
        entry.url.endsWith("com.atproto.repo.createRecord"),
      ).length,
      1,
    );

    const reading = fakePds({ readText: blueskyText });
    const reconciled = await reconcile(db, item, approval, {
      fetch: reading.fetch,
    });
    assert.equal(reconciled.ok, true, reconciled.message);
    const delivery = reconciled.deliveries.find(
      (entry) => entry.itemId === item.id,
    );
    assert.equal(delivery.state, "published");
    assert.equal(
      delivery.permalink,
      `https://bsky.app/profile/${handle}/post/${delivery.rkey}`,
    );

    const before = failing.list.length;
    const retry = await send(db, item, approval, { fetch: failing.fetch });
    assert.equal(retry.ok, true, retry.message);
    assert.equal(failing.list.length, before, "no duplicate provider request");
    assert.equal(
      retry.deliveries.find((entry) => entry.itemId === item.id).state,
      "published",
    );
  } finally {
    db.cleanup();
  }
});

test("reconciliation resolves a missing record to failed and leaves no retry", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const pds = fakePds({ create: "timeout" });
    await send(db, item, approval, { fetch: pds.fetch });
    const reading = fakePds({ read: "missing" });
    const reconciled = await reconcile(db, item, approval, {
      fetch: reading.fetch,
    });
    assert.equal(reconciled.ok, true, reconciled.message);
    const delivery = reconciled.deliveries.find(
      (entry) => entry.itemId === item.id,
    );
    assert.equal(delivery.state, "failed");
    assert.equal(delivery.errorCode, "record_not_found");
    assert.match(delivery.errorMessage, /Nothing was published/i);
    assert.equal(
      reading.list.filter((entry) =>
        entry.url.endsWith("com.atproto.repo.createRecord"),
      ).length,
      0,
    );

    const again = await reconcile(db, item, approval, {
      fetch: fakePds().fetch,
    });
    assert.equal(again.ok, true);
    assert.equal(
      again.deliveries.find((entry) => entry.itemId === item.id).state,
      "failed",
      "a terminal receipt is not reconciled twice",
    );
  } finally {
    db.cleanup();
  }
});

test("reconciliation refuses to claim a record whose text differs from the approval", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const pds = fakePds({ create: "timeout" });
    await send(db, item, approval, { fetch: pds.fetch });
    const reading = fakePds({ readText: "A different public post." });
    const reconciled = await reconcile(db, item, approval, {
      fetch: reading.fetch,
    });
    assert.equal(reconciled.ok, true, reconciled.message);
    const delivery = reconciled.deliveries.find(
      (entry) => entry.itemId === item.id,
    );
    assert.equal(delivery.state, "failed");
    assert.equal(delivery.errorCode, "content_mismatch");
    assert.match(delivery.errorMessage, /does not match the approval/i);
    assert.equal(
      delivery.providerUri,
      `at://${did}/app.bsky.feed.post/${delivery.rkey}`,
      "the existing provider record is surfaced for review",
    );
  } finally {
    db.cleanup();
  }
});

test("cancelled, expired and changed approvals cannot send", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const cancelled = await call(
      db,
      {
        action: "blueskyCancel",
        item: item.id,
        expectedApprovalRevision: approval.approvalRevision,
        reason: "Owner stopped the send.",
      },
      "POST",
      { now: sendNow },
    );
    assert.equal(cancelled.ok, true, cancelled.message);
    const pds = fakePds();
    const refused = await send(db, item, approval, { fetch: pds.fetch });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, "CONFLICT");
    assert.equal(pds.list.length, 0);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_deliveries")
          .first()
      ).count,
      0,
    );
  } finally {
    db.cleanup();
  }

  const expiredDb = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(expiredDb);
    const pds = fakePds();
    const expired = await send(expiredDb, item, approval, {
      fetch: pds.fetch,
      now: new Date("2026-11-16T04:00:00.000Z"),
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.code, "BLOCKED");
    assert.match(expired.message, /expired/i);
    assert.equal(pds.list.length, 0);
  } finally {
    expiredDb.cleanup();
  }

  const changedDb = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(changedDb);
    await changedDb
      .prepare("UPDATE creator_share_approvals SET text_hash=? WHERE item_id=?")
      .bind("f".repeat(64), item.id)
      .run();
    const pds = fakePds();
    const changed = await send(changedDb, item, approval, {
      fetch: pds.fetch,
    });
    assert.equal(changed.ok, false);
    assert.equal(changed.code, "CONFLICT");
    assert.match(changed.message, /no longer matches|binding/i);
    assert.equal(pds.list.length, 0);
  } finally {
    changedDb.cleanup();
  }

  const revokedDb = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(revokedDb);
    await revokedDb
      .prepare(
        "UPDATE creator_share_approvals SET state='revoked',revoked_at=? WHERE item_id=?",
      )
      .bind(sendNow.toISOString(), item.id)
      .run();
    const pds = fakePds();
    const revoked = await send(revokedDb, item, approval, {
      fetch: pds.fetch,
    });
    assert.equal(revoked.ok, false);
    assert.equal(revoked.code, "CONFLICT");
    assert.match(revoked.message, /not current/i);
    assert.equal(pds.list.length, 0);
  } finally {
    revokedDb.cleanup();
  }
});

test("an unconfigured or rejected connection stays honest and stores no secret", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const pds = fakePds();
    const unconfigured = await send(db, item, approval, {
      fetch: pds.fetch,
      settings: fakeSettings(null),
    });
    assert.equal(unconfigured.ok, false);
    assert.equal(unconfigured.code, "NEEDS_OWNER");
    assert.match(unconfigured.message, /No Bluesky publishing connection/i);
    assert.equal(pds.list.length, 0);

    const rejected = await send(db, item, approval, {
      fetch: fakePds({ session: "reject" }).fetch,
      password: appPassword,
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, "NEEDS_OWNER");
    const row = await db
      .prepare("SELECT * FROM creator_share_deliveries")
      .first();
    assert.equal(row.state, "needs_auth");
    assert.equal(row.error_code, "needs_auth");
    assert.doesNotMatch(row.error_message, /abcd-efgh/);
    assert.doesNotMatch(JSON.stringify(row), /abcd-efgh|access-|refresh-/);
    assert.doesNotMatch(JSON.stringify(rejected), /abcd-efgh|access-|refresh-/);
  } finally {
    db.cleanup();
  }
});

test("a non-image share card fails before createRecord", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const pds = fakePds({ imageType: "text/html" });
    const failed = await send(db, item, approval, { fetch: pds.fetch });
    assert.equal(failed.ok, false);
    assert.equal(failed.code, "BLOCKED");
    const row = await db
      .prepare("SELECT * FROM creator_share_deliveries")
      .first();
    assert.equal(row.state, "failed");
    assert.equal(row.error_code, "invalid_media");
    assert.equal(
      pds.list.filter((entry) =>
        entry.url.endsWith("com.atproto.repo.createRecord"),
      ).length,
      0,
    );
  } finally {
    db.cleanup();
  }
});

test("an over-limit saved draft is refused before any provider call", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    await db
      .prepare("UPDATE creator_share_calendar_items SET variants=? WHERE id=?")
      .bind(
        JSON.stringify([
          { channel: "bluesky", destination: "", caption: "🌏".repeat(301) },
        ]),
        item.id,
      )
      .run();
    const pds = fakePds();
    const refused = await send(db, item, approval, { fetch: pds.fetch });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, "BLOCKED");
    assert.match(refused.message, /300 graphemes/i);
    assert.equal(pds.list.length, 0);
    assert.equal(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM creator_share_deliveries")
          .first()
      ).count,
      0,
    );
  } finally {
    db.cleanup();
  }
});

test("the native surface has a deliberate send action and a copyable fallback", () => {
  const page = readFileSync(
    new URL("../src/plugins/share-calendar-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Send approved post/);
  assert.match(page, /Reconcile receipt/);
  assert.match(page, /Copy approval package/);
  assert.match(page, /I reviewed the bound handle, exact text, media and/);
  assert.match(page, /blueskySend/);
  assert.match(page, /blueskyReconcile/);
  assert.match(page, /connection\.state !== "configured"/);
  assert.match(page, /Configure an encrypted app password/);
  assert.doesNotMatch(page, /onCheckSend/);

  const loadStart = page.indexOf("async function load()");
  const loadEnd = page.indexOf("useEffect(() => {", loadStart);
  assert.ok(loadStart > 0 && loadEnd > loadStart);
  const loadBlock = page.slice(loadStart, loadEnd);
  assert.match(loadBlock, /calendarCall\("list"/);
  assert.doesNotMatch(
    loadBlock,
    /createSession|uploadBlob|createRecord|blueskySend|blueskyReconcile|identityCall/,
  );

  const plugin = readFileSync(
    new URL("../src/lib/creator-plugin.ts", import.meta.url),
    "utf8",
  );
  assert.match(plugin, /blueskyPublisherSettings/);
  assert.match(plugin, /settingsSchema/);

  const definition = creatorPlugin("fictional-admin-entry", {});
  assert.equal(
    definition.admin.settingsSchema[BLUESKY_APP_PASSWORD_SETTING].type,
    "secret",
  );
});

test("the delivery table has no credential column and one row per approval", async () => {
  const db = sqliteD1({ schema });
  try {
    const { item, approval } = await approvedItem(db);
    const workspace = await db
      .prepare(
        "SELECT workspace_id FROM creator_share_calendar_items WHERE id=?",
      )
      .bind(item.id)
      .first();
    const columns = await db
      .prepare("PRAGMA table_info(creator_share_deliveries)")
      .all();
    for (const column of columns.results)
      assert.doesNotMatch(
        column.name,
        /password|token|secret|private.?key|jwt|response/i,
      );

    const rkey = await blueskyPostRkey(item.id, approval.approvalRevision);
    const input = {
      itemId: item.id,
      workspaceId: workspace.workspace_id,
      approvalRevision: approval.approvalRevision,
      accountHandle: handle,
      accountDid: did,
      bindingHash: approval.bindingHash,
      textHash: approval.textHash,
      rkey,
      now: sendNow,
    };
    const claimed = await claimBlueskyDelivery(db, input);
    assert.equal(claimed.claimed, true);
    // A second row for the same item + revision is rejected even with a
    // different idempotency key.
    await assert.rejects(
      () =>
        db
          .prepare(
            `INSERT INTO creator_share_deliveries
             (idempotency_key,item_id,workspace_id,channel,approval_revision,account_handle,account_did,binding_hash,text_hash,rkey,state,attempt,created_at,updated_at)
             VALUES (?,?,?,'bluesky',?,?,?,?,?,?,'approved',0,?,?)`,
          )
          .bind(
            "bluesky:duplicate-key",
            item.id,
            workspace.workspace_id,
            approval.approvalRevision,
            handle,
            did,
            approval.bindingHash,
            approval.textHash,
            rkey,
            sendNow.toISOString(),
            sendNow.toISOString(),
          )
          .run(),
      /UNIQUE/i,
    );
  } finally {
    db.cleanup();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { sqliteD1, migration } from "./helpers/stacks-sqlite.mjs";
import {
  listBlueskyObservations,
  runScheduledBlueskyObservations,
} from "../src/lib/bluesky-observations.ts";
import { blueskyObservationSchedule } from "../src/lib/bluesky-observation-contract.ts";

const schema = [
  "0003_stacks.sql",
  "0031_share_calendar.sql",
  "0035_bluesky_deliveries.sql",
  "0049_bluesky_observations.sql",
]
  .map(migration)
  .join("\n");
const workspace = "observation-test";
const did = "did:plc:abcdefghijklmnopqrstuvwx";
const cid = "bafytest5678";
const time = (value) => new Date(value);
const publishedAt = "2026-11-28T10:45:00.000Z";

async function receipt(db, number, at, state = "published") {
  const id = "00000000-0000-4000-8000-" + String(number).padStart(12, "0");
  const rkey = "test" + number;
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
  await db
    .prepare(
      `INSERT OR IGNORE INTO creator_workspaces(id,name) VALUES(?1,'Test')`,
    )
    .bind(workspace)
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO creator_stacks(id,workspace_id,slug,name,draft_json)
     VALUES('fixture-stack',?1,'fixture-stack','Test','{}')`,
    )
    .bind(workspace)
    .run();
  await db
    .prepare(
      `INSERT INTO creator_share_calendar_items(
      id,workspace_id,stack_id,stack_revision,channel,caption,created_by,updated_by,created_at,updated_at
    ) VALUES(?1,?2,'fixture-stack',1,'bluesky','test caption','test','test',?3,?3)`,
    )
    .bind(id, workspace, at)
    .run();
  await db
    .prepare(
      `INSERT INTO creator_share_deliveries(
      idempotency_key,item_id,workspace_id,channel,approval_revision,account_handle,account_did,
      binding_hash,text_hash,rkey,state,provider_uri,provider_cid,permalink,published_at,created_at,updated_at
    ) VALUES(?1,?2,?3,'bluesky',1,'test.bsky.social',?4,?5,?5,?6,?7,?8,?9,?10,?11,?12,?12)`,
    )
    .bind(
      "test-observation-delivery-" + number,
      id,
      workspace,
      did,
      "0".repeat(64),
      rkey,
      state,
      state === "published" ? uri : null,
      state === "published" ? cid : null,
      state === "published"
        ? `https://bsky.app/profile/${did}/post/${rkey}`
        : null,
      state === "published" ? at : null,
      at,
    )
    .run();
  return { id, uri };
}

function tick(db, at, fetcher) {
  return runScheduledBlueskyObservations(db, time(at), fetcher, () => time(at));
}

test("observations replay durable exact receipts, claim once, and retain nulls and recovery", async () => {
  const db = sqliteD1({ schema });
  try {
    const active = await receipt(db, 1, publishedAt);
    await receipt(db, 2, publishedAt, "approved");
    const requests = [];
    const unavailable = async (url, options) => {
      requests.push({ url, options });
      return Response.json({}, { status: 503 });
    };
    const collected = async (url, options) => {
      requests.push({ url, options });
      return Response.json({
        posts: [
          {
            uri: active.uri,
            cid,
            likeCount: 0,
            replyCount: 3,
            repostCount: -1,
          },
        ],
      });
    };
    assert.deepEqual(await tick(db, publishedAt, unavailable), {
      observed: 0,
      failed: 0,
    });
    const first = "2026-11-29T10:45:00.000Z";
    await Promise.all([
      tick(db, first, unavailable),
      tick(db, first, unavailable),
    ]);
    assert.equal(requests.length, 1);
    let [observed] = await listBlueskyObservations(db, workspace);
    assert.equal(observed.lastFailure, "appview_unavailable");
    assert.equal(observed.retryAt, "2026-11-29T11:00:00.000Z");
    assert.equal(observed.observedAt, null);
    assert.equal(observed.itemId, active.id);
    assert.equal(observed.approvalRevision, 1);
    assert.equal(requests[0].url.origin, "https://public.api.bsky.app");
    assert.deepEqual(requests[0].url.searchParams.getAll("uris"), [active.uri]);
    assert.equal(requests[0].options.method, "GET");
    assert.equal(requests[0].options.redirect, "manual");
    assert.equal(requests[0].options.headers.authorization, undefined);
    await tick(db, "2026-11-29T11:00:00.000Z", collected);
    [observed] = await listBlueskyObservations(db, workspace);
    assert.equal(observed.attempts, 2);
    assert.equal(observed.observedAt, "2026-11-29T11:00:00.000Z");
    assert.equal(observed.lastFailure, "appview_unavailable");
    assert.equal(observed.failedAt, first);
    assert.equal(observed.retryAt, null);
    assert.deepEqual(
      [observed.likes, observed.replies, observed.reposts, observed.quotes],
      [0, 3, null, null],
    );
    assert.deepEqual(await tick(db, "2026-11-29T11:15:00.000Z", collected), {
      observed: 0,
      failed: 0,
    });
    assert.deepEqual(
      await listBlueskyObservations(db, "foreign-workspace"),
      [],
    );
    const timeline = blueskyObservationSchedule(
      publishedAt,
      [observed],
      observed.observedAt,
    );
    const expiredLease = {
      ...observed,
      observedAt: null,
      leaseUntil: "2026-11-29T11:05:00.000Z",
    };
    const retriable = blueskyObservationSchedule(
      publishedAt,
      [expiredLease],
      "2026-11-29T11:15:00.000Z",
    );
    assert.equal(retriable[0].status, "Awaiting collection");
    assert.deepEqual(
      timeline.map(({ hours, status }) => [hours, status]),
      [
        [24, "Collected"],
        [72, "Scheduled"],
        [168, "Scheduled"],
      ],
    );
  } finally {
    db.cleanup();
  }
});

test("old publications get a current baseline only, and changed CIDs get no counter record", async () => {
  const db = sqliteD1({ schema });
  try {
    const old = await receipt(db, 3, "2026-11-15T10:45:00.000Z");
    const recent = await receipt(db, 4, publishedAt);
    const at = "2026-12-01T10:45:00.000Z";
    const fetcher = async (url) => {
      assert.deepEqual(
        new Set(url.searchParams.getAll("uris")),
        new Set([old.uri, recent.uri]),
      );
      return Response.json({
        posts: [
          {
            uri: old.uri,
            cid,
            likeCount: 1,
            replyCount: 0,
            repostCount: 0,
            quoteCount: 0,
          },
          { uri: recent.uri, cid: "bafydifferentcid", likeCount: 999 },
        ],
      });
    };
    assert.deepEqual(await tick(db, at, fetcher), { observed: 1, failed: 1 });
    const rows = await listBlueskyObservations(db, workspace);
    const baseline = rows.find(({ itemId }) => itemId === old.id);
    const changed = rows.find(({ itemId }) => itemId === recent.id);
    assert.equal(baseline.windowHours, 0);
    assert.equal(baseline.observedAt, at);
    assert.equal(baseline.likes, 1);
    assert.equal(changed.windowHours, 72);
    assert.equal(changed.observedAt, null);
    assert.equal(changed.likes, null);
    assert.equal(changed.lastFailure, "revision_changed");
    assert.equal(changed.retryAt, null);
    const timeline = blueskyObservationSchedule(publishedAt, [changed], at);
    assert.deepEqual(
      timeline.map(({ status }) => status),
      ["Window missed", "Collection stopped", "Scheduled"],
    );
    assert.deepEqual(await tick(db, "2026-12-01T11:00:00.000Z", fetcher), {
      observed: 0,
      failed: 0,
    });
  } finally {
    db.cleanup();
  }
});

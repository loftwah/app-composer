import test from "node:test";
import assert from "node:assert/strict";
import {
  BLUESKY_APP_PASSWORD_SETTING,
  BLUESKY_IMAGE_MAX_BYTES,
  blueskyPostPermalink,
  BLUESKY_TID_LENGTH,
  blueskyPostRkey,
  blueskyPublisherSettings,
  createBlueskyPost,
  createBlueskySession,
  isBlueskyAtPostUri,
  listBlueskyPosts,
  readBlueskyPost,
  refreshBlueskySession,
  uploadBlueskyImage,
} from "../src/lib/bluesky-publisher.ts";
import { BLUESKY_TEXT_GRAPHEMES } from "../src/lib/share-approval.ts";

const did = "did:plc:abcdefghijklmnopqrstuvwx";
const handle = "trail-notes.bsky.social";
const accessJwt = "access-" + "a".repeat(40);
const refreshJwt = "refresh-" + "b".repeat(40);
const cid = "bafyreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const blobLink = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
const rkey = "0123456789abcdef0123456789abcdef";
const createdAt = "2026-11-16T01:05:00.000Z";
const link = "https://composer.loftwah.com/s/fictional-trail-notes";

function session() {
  return { did, handle, accessJwt, refreshJwt };
}

function blob() {
  return {
    $type: "blob",
    ref: { $link: blobLink },
    mimeType: "image/png",
    size: 128,
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function calls() {
  const list = [];
  return {
    list,
    fetch: async (input, init = {}) => {
      list.push({ url: String(input), init });
      throw Error("Unexpected network request in a publisher test");
    },
  };
}

function successfulPost() {
  const fake = calls();
  fake.fetch = async (input, init = {}) => {
    fake.list.push({ url: String(input), init });
    const body = JSON.parse(String(init.body));
    return json({
      uri: `at://${did}/app.bsky.feed.post/${body.rkey}`,
      cid,
    });
  };
  return fake;
}

test("createSession sends the app password once and returns bounded tokens only", async () => {
  const fake = calls();
  fake.fetch = async (input, init = {}) => {
    fake.list.push({ url: String(input), init });
    const body = JSON.parse(String(init.body));
    assert.equal(body.identifier, handle);
    assert.equal(body.password, "abcd-efgh-ijkl-mnop");
    return json({
      accessJwt,
      refreshJwt,
      handle,
      did,
      active: true,
    });
  };
  const result = await createBlueskySession(
    {
      identifier: "@Trail-Notes.bsky.social",
      password: " abcd-efgh-ijkl-mnop ",
    },
    { fetch: fake.fetch },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.session, session());
  assert.equal(fake.list.length, 1);
  assert.match(
    fake.list[0].url,
    /^https:\/\/bsky\.social\/xrpc\/com\.atproto\.server\.createSession$/,
  );
  assert.equal(fake.list[0].init.method, "POST");
  assert.doesNotMatch(JSON.stringify(result), /abcd-efgh-ijkl-mnop/);
});

test("a rejected session is needs_auth, never a generic failure", async () => {
  const rejected = await createBlueskySession(
    { identifier: handle, password: "wrong-password" },
    {
      fetch: async () => json({ error: "InvalidPassword" }, 401),
    },
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "needs_auth");
  assert.equal(rejected.needsAuth, true);
  assert.doesNotMatch(rejected.message, /wrong-password/);
  assert.match(rejected.message, /rejected the app password/i);

  const expired = await refreshBlueskySession(refreshJwt, {
    fetch: async () => json({ error: "ExpiredToken" }, 401),
  });
  assert.equal(expired.ok, false);
  assert.equal(expired.code, "needs_auth");
  assert.equal(expired.needsAuth, true);

  const refreshed = await refreshBlueskySession("refresh-" + "c".repeat(40), {
    fetch: async (input, init = {}) => {
      assert.match(String(input), /refreshSession$/);
      assert.equal(
        new Headers(init.headers).get("Authorization"),
        "Bearer refresh-" + "c".repeat(40),
      );
      return json({
        accessJwt: "access-" + "d".repeat(40),
        refreshJwt: "refresh-" + "e".repeat(40),
        handle,
        did,
      });
    },
  });
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.session.accessJwt, "access-" + "d".repeat(40));
});

test("network, rate-limit and server failures are classified without retrying", async () => {
  const timeout = await createBlueskySession(
    { identifier: handle, password: "abcd-efgh-ijkl-mnop" },
    {
      fetch: async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      },
    },
  );
  assert.equal(timeout.ok, false);
  assert.equal(timeout.code, "timeout");
  assert.equal(timeout.transport, true);
  assert.equal(timeout.retryable, true);

  const limited = await createBlueskySession(
    { identifier: handle, password: "abcd-efgh-ijkl-mnop" },
    { fetch: async () => json({ error: "RateLimitExceeded" }, 429) },
  );
  assert.equal(limited.code, "rate_limited");
  assert.equal(limited.retryable, true);

  const unavailable = await createBlueskySession(
    { identifier: handle, password: "abcd-efgh-ijkl-mnop" },
    { fetch: async () => json({ error: "InternalServerError" }, 503) },
  );
  assert.equal(unavailable.code, "unavailable");
  assert.equal(unavailable.retryable, true);
});

test("text and byte limits are enforced before any createRecord request", async () => {
  const fake = calls();
  const tooLong = await createBlueskyPost(
    {
      session: session(),
      rkey,
      text: "🌏".repeat(BLUESKY_TEXT_GRAPHEMES + 1),
      createdAt,
    },
    { fetch: fake.fetch },
  );
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.code, "invalid_text");
  assert.equal(fake.list.length, 0);

  const tooManyBytes = await createBlueskyPost(
    {
      session: session(),
      rkey,
      text: "👩‍👩‍👧‍👦".repeat(BLUESKY_TEXT_GRAPHEMES),
      createdAt,
    },
    { fetch: fake.fetch },
  );
  assert.equal(tooManyBytes.ok, false);
  assert.equal(tooManyBytes.code, "invalid_text");
  assert.equal(fake.list.length, 0);

  const unsafe = await createBlueskyPost(
    {
      session: session(),
      rkey,
      text: "A public walk.",
      createdAt,
      link: "https://user:pass@example.com/post",
      embed: "external",
      image: { blob: blob(), alt: "A public trail" },
      external: { title: "Trail", description: "A public walk." },
    },
    { fetch: fake.fetch },
  );
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.code, "invalid_link");
  assert.equal(fake.list.length, 0);
});

test("the record key is deterministic per item and approval revision", async () => {
  const first = await blueskyPostRkey(
    "11111111-1111-4111-8111-111111111111",
    1,
  );
  const same = await blueskyPostRkey("11111111-1111-4111-8111-111111111111", 1);
  const next = await blueskyPostRkey("11111111-1111-4111-8111-111111111111", 2);
  assert.equal(first, same);
  assert.notEqual(first, next);
  // Bluesky requires a TID: 13 base32-sortable characters, top bit clear.
  assert.match(first, /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/);
  assert.equal(first.length, BLUESKY_TID_LENGTH);
  await assert.rejects(() => blueskyPostRkey("not-an-item", 1), /item id/);
  await assert.rejects(
    () => blueskyPostRkey("11111111-1111-4111-8111-111111111111", 0),
    /approval revision/,
  );
});

test("blob upload refuses type and size before the network, then accepts a bounded PNG", async () => {
  const fake = calls();
  const gif = await uploadBlueskyImage(
    {
      session: session(),
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/gif",
    },
    { fetch: fake.fetch },
  );
  assert.equal(gif.ok, false);
  assert.equal(gif.code, "invalid_media");
  assert.equal(fake.list.length, 0);

  const huge = await uploadBlueskyImage(
    {
      session: session(),
      bytes: new Uint8Array(BLUESKY_IMAGE_MAX_BYTES + 1),
      mimeType: "image/png",
    },
    { fetch: fake.fetch },
  );
  assert.equal(huge.ok, false);
  assert.equal(huge.code, "invalid_media");
  assert.equal(fake.list.length, 0);

  fake.fetch = async (input, init = {}) => {
    fake.list.push({ url: String(input), init });
    assert.equal(new Headers(init.headers).get("Content-Type"), "image/png");
    assert.equal(
      new Headers(init.headers).get("Authorization"),
      "Bearer " + accessJwt,
    );
    return json({ blob: blob() });
  };
  const accepted = await uploadBlueskyImage(
    {
      session: session(),
      bytes: new Uint8Array([137, 80, 78, 71]),
      mimeType: "image/png",
    },
    { fetch: fake.fetch },
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.blob.ref.$link, blobLink);
});

test("createRecord builds a text, external-card and image embed at the deterministic key", async () => {
  const fake = successfulPost();
  const result = await createBlueskyPost(
    {
      session: session(),
      rkey,
      text: "A public Trail Notes walk, published with exact approval. 🌏",
      createdAt,
      link,
      embed: "external",
      image: { blob: blob(), alt: "Fictional Trail Notes share card." },
      external: {
        title: "Fictional Trail Notes",
        description: "Published revision 7",
      },
    },
    { fetch: fake.fetch },
  );
  assert.equal(result.ok, true);
  assert.equal(result.post.uri, `at://${did}/app.bsky.feed.post/${rkey}`);
  assert.equal(result.post.cid, cid);
  assert.equal(
    result.post.permalink,
    `https://bsky.app/profile/${handle}/post/${rkey}`,
  );
  assert.equal(isBlueskyAtPostUri(result.post.uri, did, rkey), true);
  assert.equal(isBlueskyAtPostUri(result.post.uri, did, "other"), false);

  assert.equal(fake.list.length, 1);
  assert.match(fake.list[0].url, /\/xrpc\/com\.atproto\.repo\.createRecord$/);
  const body = JSON.parse(String(fake.list[0].init.body));
  assert.equal(body.repo, did);
  assert.equal(body.collection, "app.bsky.feed.post");
  assert.equal(body.rkey, rkey);
  assert.equal(body.validate, true);
  assert.equal(body.record.$type, "app.bsky.feed.post");
  assert.equal(
    body.record.text,
    "A public Trail Notes walk, published with exact approval. 🌏",
  );
  assert.equal(body.record.embed.$type, "app.bsky.embed.external");
  assert.equal(body.record.embed.external.uri, link);
  assert.equal(body.record.embed.external.title, "Fictional Trail Notes");
  assert.deepEqual(body.record.embed.external.thumb, blob());
  assert.equal(body.record.embed.images, undefined);
});

test("an image-only post uses the images embed and a text-only post has no embed", async () => {
  const imageFake = successfulPost();
  const image = await createBlueskyPost(
    {
      session: session(),
      rkey,
      text: "A public share card.",
      createdAt,
      embed: "images",
      image: { blob: blob(), alt: "Fictional Trail Notes share card." },
    },
    { fetch: imageFake.fetch },
  );
  assert.equal(image.ok, true);
  const imageBody = JSON.parse(String(imageFake.list[0].init.body));
  assert.equal(imageBody.record.embed.$type, "app.bsky.embed.images");
  assert.equal(
    imageBody.record.embed.images[0].alt,
    "Fictional Trail Notes share card.",
  );

  const textFake = successfulPost();
  const text = await createBlueskyPost(
    { session: session(), rkey, text: "A short public note.", createdAt },
    { fetch: textFake.fetch },
  );
  assert.equal(text.ok, true);
  const textBody = JSON.parse(String(textFake.list[0].init.body));
  assert.equal(textBody.record.embed, undefined);
});

test("createRecord rejects a mismatched URI and a record conflict without hiding it", async () => {
  const wrongUri = await createBlueskyPost(
    { session: session(), rkey, text: "A short public note.", createdAt },
    {
      fetch: async () =>
        json({ uri: `at://${did}/app.bsky.feed.post/other`, cid }),
    },
  );
  assert.equal(wrongUri.ok, false);
  assert.equal(wrongUri.code, "invalid_response");

  const conflict = await createBlueskyPost(
    { session: session(), rkey, text: "A short public note.", createdAt },
    {
      fetch: async () => json({ error: "RecordAlreadyExists" }, 400),
    },
  );
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "record_conflict");
  assert.match(conflict.message, /already has a record/i);
});

test("getRecord and listRecords provide bounded reconciliation reads", async () => {
  const found = await readBlueskyPost(
    { repo: did, rkey },
    {
      fetch: async (input) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/xrpc/com.atproto.repo.getRecord");
        assert.equal(url.searchParams.get("repo"), did);
        assert.equal(url.searchParams.get("rkey"), rkey);
        return json({
          uri: `at://${did}/app.bsky.feed.post/${rkey}`,
          cid,
          value: { text: "The exact approved text." },
        });
      },
    },
  );
  assert.equal(found.ok, true);
  assert.equal(found.record.found, true);
  assert.equal(found.record.text, "The exact approved text.");
  assert.equal(found.record.cid, cid);

  const missing = await readBlueskyPost(
    { repo: did, rkey },
    { fetch: async () => json({ error: "RecordNotFound" }, 400) },
  );
  assert.equal(missing.ok, true);
  assert.equal(missing.record.found, false);

  const listed = await listBlueskyPosts(
    { repo: did, limit: 5 },
    {
      fetch: async (input) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/xrpc/com.atproto.repo.listRecords");
        assert.equal(url.searchParams.get("limit"), "5");
        return json({
          records: [
            {
              uri: `at://${did}/app.bsky.feed.post/${rkey}`,
              cid,
              value: { text: "Public text" },
            },
          ],
          cursor: "next",
        });
      },
    },
  );
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.records, [
    { uri: `at://${did}/app.bsky.feed.post/${rkey}`, cid, rkey },
  ]);
  assert.equal(listed.cursor, "next");
});

test("permalinks are well formed and the publisher registers only an encrypted secret", () => {
  assert.equal(
    blueskyPostPermalink(handle, rkey),
    `https://bsky.app/profile/${handle}/post/${rkey}`,
  );
  assert.equal(blueskyPostPermalink("not-a-handle", rkey), null);
  assert.equal(blueskyPostPermalink(handle, "bad/key"), null);
  assert.equal(
    blueskyPublisherSettings[BLUESKY_APP_PASSWORD_SETTING].type,
    "secret",
  );
  assert.match(
    blueskyPublisherSettings[BLUESKY_APP_PASSWORD_SETTING].description ?? "",
    /encrypts this value/i,
  );
});

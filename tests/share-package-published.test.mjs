// Focused #663 regression: the approval package must agree with the native
// published-card receipt only for the exact item + approval revision. Every
// fixture is synthetic and local: no provider, network, credential or database.
import test from "node:test";
import assert from "node:assert/strict";
import {
  approvalPackageForItem,
  sharePackageJson,
  sharePackageMarkdown,
  sharePackagePlainText,
  SHARE_PACKAGE_PUBLISHED_LABEL,
} from "../src/lib/share-package.ts";
import { BLUESKY_PACKAGE_SCHEMA } from "../src/lib/share-approval.ts";

const publishedAt = "2026-11-19T01:02:03.000Z";
const permalink = "https://bsky.app/profile/example.test/post/3lpublished";
const savedAt = "2026-11-19T00:00:00.000Z";
const item = {
  id: "11111111-1111-4111-8111-111111111111",
  stack: null,
  stackName: "Published artwork",
  stackSlug: null,
  publication: null,
  catalogue: null,
  sourceCurrent: true,
  channel: "bluesky",
  destination: "",
  caption: "A published caption. 🌏",
  variants: [],
  link: "https://example.com/work",
  scheduledAt: null,
  state: "shared",
  sharedAt: publishedAt,
  revision: 3,
  createdAt: savedAt,
  updatedAt: savedAt,
};
const approval = {
  itemId: item.id,
  draftRevision: 3,
  approvalRevision: 2,
  state: "approved",
  accountHandle: "example.test",
  accountDid: "did:plc:example",
  bindingHash: "c".repeat(64),
  approvedAt: "2026-11-19T00:30:00.000Z",
  expiresAt: null,
  createdAt: savedAt,
  updatedAt: savedAt,
};

function delivery(over = {}) {
  return {
    itemId: item.id,
    approvalRevision: 2,
    state: "published",
    attempt: 1,
    accountHandle: "example.test",
    accountDid: "did:plc:example",
    rkey: "3lpublished",
    providerUri: "at://did:plc:example/app.bsky.feed.post/3lpublished",
    providerCid: "bafyreiexample",
    permalink,
    errorCode: "",
    errorMessage: "",
    claimedAt: "2026-11-19T01:00:00.000Z",
    publishedAt,
    createdAt: savedAt,
    updatedAt: savedAt,
    ...over,
  };
}

function snapshot(deliveries) {
  return {
    ok: true,
    workspace: {
      id: "fictional-workspace",
      name: "Fictional workspace",
      role: "owner",
    },
    sources: [],
    items: [item],
    approvals: [approval],
    deliveries,
    bluesky: {
      configuredHandle: "example.test",
      connection: {
        state: "configured",
        handle: "example.test",
        note: "Fictional fixture.",
      },
    },
    now: "2026-11-19T02:00:00.000Z",
    changed: null,
  };
}

function blueskyPackage() {
  return {
    schema: BLUESKY_PACKAGE_SCHEMA,
    item: { id: item.id, revision: item.revision },
    account: {
      status: "resolved",
      handle: "example.test",
      did: "did:plc:example",
      displayName: "Example",
      avatar: null,
      profileUrl: "https://bsky.app/profile/example.test",
      publicIdentity: "resolved",
      publishing: "not_authorised",
      checkedAt: savedAt,
      bound: null,
      statement: "Public identity checked in the fixture.",
    },
    text: item.caption,
    textHash: "a".repeat(64),
    count: item.caption.length,
    limit: 300,
    unit: "graphemes",
    bytes: 30,
    byteLimit: 3000,
    withinLimit: true,
    media: [],
    mediaHash: "b".repeat(64),
    link: item.link,
    schedule: {
      scheduledAt: null,
      timeZone: "Australia/Melbourne",
      local: null,
      utc: null,
      label: "Not scheduled",
      revalidatedAt: savedAt,
      future: false,
    },
    source: {
      stackId: null,
      name: item.stackName,
      slug: null,
      publication: null,
      url: null,
      imagePath: null,
      imageAlt: null,
      current: true,
      rightsNote: "Fictional fixture; public copy only.",
    },
    approval: {
      state: "approved",
      label: "Approved (not sent)",
      note: "The exact revision is approved. Approval is not a post and does not send.",
      reasons: [],
      approvalRevision: approval.approvalRevision,
      approvedAt: approval.approvedAt,
      expiresAt: null,
      bindingHash: approval.bindingHash,
      notSent: true,
    },
    send: {
      ok: false,
      available: false,
      code: "needs_owner",
      message: "A Bluesky send needs the owner's confirmation.",
    },
  };
}

test("the exact published revision adds a public receipt in JSON, Markdown and copy text", () => {
  const frozen = JSON.stringify(item);
  const evidence = blueskyPackage();
  const value = approvalPackageForItem(snapshot([delivery()]), item, evidence);

  assert.deepEqual(value.bluesky.published, { publishedAt, permalink });
  assert.equal(value.bluesky.approval.notSent, false);
  assert.equal(value.bluesky.approval.label, SHARE_PACKAGE_PUBLISHED_LABEL);
  assert.equal(value.bluesky.approval.state, "approved");
  assert.deepEqual(value.bluesky.approval.reasons, []);
  assert.equal(value.bluesky.send.available, false);
  assert.equal(value.bluesky.send.code, "already_published");
  assert.equal(value.posting.ownerPerformsShare, false);
  assert.match(value.posting.statement, /already published/);
  assert.equal(JSON.stringify(item), frozen, "packaging changes no saved value");

  const json = sharePackageJson(value);
  const decoded = JSON.parse(json);
  assert.deepEqual(decoded.bluesky.published, { publishedAt, permalink });
  assert.equal(decoded.bluesky.approval.notSent, false);
  assert.equal(decoded.bluesky.approval.label, SHARE_PACKAGE_PUBLISHED_LABEL);
  for (const internal of [
    '"rkey"',
    '"providerUri"',
    '"providerCid"',
    '"claimedAt"',
    '"errorCode"',
  ])
    assert.ok(!json.includes(internal), `${internal} is not exported`);
  assert.ok(!json.includes("at://"), "no AT URI in export");

  const markdown = sharePackageMarkdown(value);
  assert.match(markdown, /\*\*Published:\*\*/);
  assert.ok(markdown.includes(publishedAt));
  assert.ok(markdown.includes(permalink));
  assert.doesNotMatch(markdown, /not sent/i);
  assert.doesNotMatch(markdown, /Send:.*unavailable/);

  const plain = sharePackagePlainText(value);
  assert.match(plain, /^Published: /m);
  assert.ok(plain.includes(publishedAt));
  assert.ok(plain.includes(permalink));
  assert.doesNotMatch(plain, /not sent/i);
  assert.doesNotMatch(plain, /Send: unavailable/);
  assert.ok(
    plain.includes("This approval package does not post"),
    "the package still performs no action",
  );
});

test("older, failed and mismatched deliveries keep notSent true and no receipt", () => {
  const cases = [
    ["an older approval revision", delivery({ approvalRevision: 1 })],
    ["a failed exact revision", delivery({ state: "failed", permalink: null, publishedAt: null })],
    ["an unknown exact revision", delivery({ state: "unknown", permalink: null })],
    ["another item", delivery({ itemId: "sibling" })],
  ];
  for (const [label, record] of cases) {
    const value = approvalPackageForItem(
      snapshot([record]),
      item,
      blueskyPackage(),
    );
    assert.equal(value.bluesky.published, undefined, label);
    assert.equal(value.bluesky.approval.notSent, true, label);
    assert.equal(value.bluesky.approval.label, "Approved (not sent)", label);
    const outputs = [
      sharePackageJson(value),
      sharePackageMarkdown(value),
      sharePackagePlainText(value),
    ];
    for (const output of outputs) {
      assert.match(output, /not sent/i, label);
      assert.ok(!output.includes(permalink), label);
      assert.ok(!output.includes(publishedAt), label);
    }
    assert.match(sharePackageMarkdown(value), /Send:.*unavailable/, label);
    assert.match(sharePackagePlainText(value), /Send: unavailable/, label);
  }

  const stale = { ...item, revision: 2 };
  const staleValue = approvalPackageForItem(
    snapshot([delivery()]),
    stale,
    blueskyPackage(),
  );
  assert.equal(staleValue.bluesky.published, undefined, "an older item revision");
  assert.equal(staleValue.bluesky.approval.notSent, true);
});

test("packaging stays offline and leaves other channel handoff untouched", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("an approval package must not use the network");
  };
  try {
    const first = approvalPackageForItem(
      snapshot([delivery()]),
      item,
      blueskyPackage(),
    );
    const second = approvalPackageForItem(
      snapshot([delivery()]),
      item,
      blueskyPackage(),
    );
    assert.equal(sharePackageJson(first), sharePackageJson(second));
    assert.equal(sharePackageMarkdown(first), sharePackageMarkdown(second));
    assert.equal(sharePackagePlainText(first), sharePackagePlainText(second));

    const decoded = JSON.parse(sharePackageJson(first));
    assert.equal(decoded.destinations.length, 1);
    assert.equal(decoded.destinations[0].caption, item.caption);
    assert.equal(decoded.schedule.label, "Not scheduled");
    assert.equal(decoded.bluesky.send.code, "already_published");
    const plain = sharePackagePlainText(first);
    assert.ok(plain.includes("Fictional fixture; public copy only."));
    assert.ok(plain.includes("DESTINATION · Bluesky"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

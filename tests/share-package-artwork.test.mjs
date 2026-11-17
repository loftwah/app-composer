// Focused regression for a Woodhouse Share artwork approval package (#477/#663).
// The fixture is entirely local: no provider, network, credential or database.
import test from "node:test";
import assert from "node:assert/strict";
import {
  approvalPackageForItem,
  sharePackageJson,
  sharePackageMarkdown,
  sharePackagePlainText,
} from "../src/lib/share-package.ts";

const updatedAt = "2026-11-16T00:00:00.000Z";
const catalogue = {
  assetId: "workshop-image",
  title: "Workshop image",
  assetRevision: "v3-20261116",
  renditionUrl: "https://woodhouse.loftwah.com/campaign/workshop-preview.jpg",
  mimeType: "image/jpeg",
  byteLength: 4096,
  bytesSha256: "b".repeat(64),
  alt: "A paper tag under a press.",
  credit: "Foilbury Studio",
  projectUrl: "https://example.com/workshop",
  sourceUrl: "https://woodhouse.loftwah.com/campaign/provenance.txt",
  // Confirmation metadata is deliberately not part of an export.
  rightsConfirmedBy: "fictional-owner",
  rightsConfirmedAt: updatedAt,
};

function artworkItem(sourceCurrent = true) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    stack: null,
    stackName: catalogue.title,
    stackSlug: null,
    publication: null,
    catalogue,
    sourceCurrent,
    channel: "bluesky",
    destination: "",
    caption: "A public artwork draft. 🌏",
    variants: [],
    link: catalogue.projectUrl,
    scheduledAt: null,
    state: "draft",
    sharedAt: null,
    revision: 2,
    createdAt: updatedAt,
    updatedAt,
  };
}

function snapshotFor(item) {
  return {
    ok: true,
    workspace: { id: "fictional-workspace", name: "Fictional workspace", role: "owner" },
    sources: [],
    items: [item],
    approvals: [],
    deliveries: [],
    bluesky: { configuredHandle: null, connection: { state: "not_configured", handle: null, note: "none" } },
    now: updatedAt,
    changed: null,
  };
}

// No bluesky argument: the owner has not resolved an account. The saved
// artwork provenance must still travel in every downloadable format.
function packageFor(item) {
  return approvalPackageForItem(snapshotFor(item), item);
}

test("an artwork export carries saved credit, revision and exact byte digest without bluesky evidence", () => {
  const item = artworkItem(true);
  const value = packageFor(item);
  assert.equal(value.bluesky, undefined, "no account evidence was supplied");

  const artwork = value.artwork;
  assert.ok(artwork, "additive artwork provenance is present in the package");
  assert.equal(artwork.assetId, catalogue.assetId);
  assert.equal(artwork.credit, catalogue.credit);
  assert.equal(artwork.assetRevision, catalogue.assetRevision);
  assert.equal(artwork.bytesSha256, catalogue.bytesSha256);
  assert.equal(artwork.byteLength, catalogue.byteLength);
  assert.equal(artwork.status, "saved");
  assert.match(artwork.statement, /approval checks the current rendition separately/i);

  const json = sharePackageJson(value);
  const decoded = JSON.parse(json);
  assert.equal(decoded.artwork.credit, catalogue.credit);
  assert.equal(decoded.artwork.assetRevision, catalogue.assetRevision);
  assert.equal(decoded.artwork.bytesSha256, catalogue.bytesSha256);
  assert.doesNotMatch(json, /rightsConfirmedBy|rightsConfirmedAt|fictional-owner/);
  assert.equal(decoded.bluesky, undefined);

  const markdown = sharePackageMarkdown(value);
  for (const expected of [catalogue.credit, catalogue.assetRevision, catalogue.bytesSha256])
    assert.ok(markdown.includes(expected), `Markdown has ${expected}`);

  const plain = sharePackagePlainText(value);
  for (const expected of [catalogue.credit, catalogue.assetRevision, catalogue.bytesSha256])
    assert.ok(plain.includes(expected), `Plain text has ${expected}`);

  assert.equal(value.shareImage.status, "available");
  assert.equal(value.shareImage.url, catalogue.renditionUrl);
});

test("the additive field leaves stack packages unchanged and coexists with bluesky evidence", () => {
  const stackItem = {
    ...artworkItem(true),
    catalogue: undefined,
    stack: "fictional-stack",
    stackName: "Fictional stack",
    stackSlug: "fictional-stack",
    publication: 7,
  };
  const stack = packageFor(stackItem);
  assert.equal(stack.artwork, undefined, "stack items keep their exact shape");
  assert.doesNotMatch(sharePackageJson(stack), /"artwork"/);
  assert.doesNotMatch(sharePackageMarkdown(stack), /Artwork:/);
  assert.doesNotMatch(sharePackagePlainText(stack), /Artwork:/);

  const withBluesky = approvalPackageForItem(
    snapshotFor(artworkItem(true)),
    artworkItem(true),
    {
      schema: "composer.bluesky-approval-package/v1",
      account: { status: "needs_account", handle: null },
      text: "public draft",
    },
  );
  assert.ok(withBluesky.bluesky, "existing bluesky section is untouched");
  assert.ok(withBluesky.artwork, "artwork provenance is additive beside it");
});

test("a stale stored artwork descriptor stays truthful and exposes no fresh export link", () => {
  const value = packageFor(artworkItem(false));
  assert.ok(value.artwork);
  assert.equal(value.artwork.status, "historical");
  assert.match(value.artwork.statement, /no longer current|historical/i);
  assert.doesNotMatch(value.provenance.statement, /current approved catalogue rendition/i);

  // A historical descriptor must not present the current rendition as live.
  assert.equal(value.shareImage.status, "not available");
  assert.equal(value.shareImage.url, null);
  assert.equal(value.shareImage.path, null);
  assert.equal(value.source.url, null);

  const json = sharePackageJson(value);
  assert.doesNotMatch(json, /workshop-preview\.jpg/);
  for (const format of [sharePackageMarkdown(value), sharePackagePlainText(value)]) {
    assert.doesNotMatch(format, /workshop-preview\.jpg/);
    assert.match(format, /no longer current|historical/i);
    assert.ok(format.includes(catalogue.credit));
    assert.ok(format.includes(catalogue.bytesSha256));
  }
});


test("keeps raw provenance in JSON and escapes displayed Markdown", () => {
  const item = artworkItem();
  item.catalogue = { ...catalogue, credit: "[raw](https://example.com)", assetRevision: "revision `<marker>\n line" };
  const value = packageFor(item);
  assert.equal(JSON.parse(sharePackageJson(value)).artwork.credit, item.catalogue.credit);
  const markdown = sharePackageMarkdown(value);
  assert.doesNotMatch(markdown, /\[raw\]\(https:/);
  assert.doesNotMatch(markdown, /<marker>/);
  assert.match(sharePackagePlainText(value), /revision `<marker> line/);
});

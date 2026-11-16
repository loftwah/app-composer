import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  resolveShareCatalogueAsset,
  sameCatalogueAsset,
  SHARE_CATALOGUE_API_BASE,
  SHARE_CATALOGUE_ORIGIN,
} from "../src/lib/share-catalogue-asset.ts";

const id = "workshop-image";
const endpoint = `${SHARE_CATALOGUE_API_BASE}/${id}`;
const asset = {
  id,
  title: "Workshop image",
  visibility: "public",
  reuse: "unconfirmed",
  previewUrl: `${SHARE_CATALOGUE_ORIGIN}/campaign/workshop-preview.jpg`,
  sourceUrl: `${SHARE_CATALOGUE_ORIGIN}/campaign/provenance.txt`,
  projectUrl: "https://example.com/workshop",
  credit: "Workshop",
  alt: "A paper tag under a press.",
  original: { version: null },
};

test("resolve pins the selected rendition bytes and the public provenance", async () => {
  const bytes = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
  const requests = [];
  const result = await resolveShareCatalogueAsset(id, {
    fetch: async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, "manual");
      assert.equal(new Headers(options.headers).has("Authorization"), false);
      if (url === endpoint) return Response.json({ version: 1, asset });
      assert.equal(url, asset.previewUrl);
      return new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
    },
  });
  assert.equal(result.ok, true);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(result.asset.bytesSha256, hash);
  assert.equal(result.asset.assetRevision, hash);
  assert.equal(result.asset.sourceUrl, asset.sourceUrl);
  assert.equal(result.asset.projectUrl, asset.projectUrl);
  assert.deepEqual(requests, [endpoint, asset.previewUrl]);
  assert.equal(
    sameCatalogueAsset(result.asset, { ...result.asset, credit: "Other" }),
    false,
  );
  assert.equal(
    sameCatalogueAsset(result.asset, {
      ...result.asset,
      sourceUrl: asset.previewUrl,
    }),
    false,
  );
});

test("unpublished, substituted and off-origin previews are refused before image fetch", async () => {
  for (const change of [
    { id: "substitute" },
    { visibility: "private" },
    { reuse: "prohibited" },
    { previewUrl: "https://example.com/campaign/workshop-preview.jpg" },
    { previewUrl: `${SHARE_CATALOGUE_ORIGIN}/api/workshop-preview.jpg` },
  ]) {
    const result = await resolveShareCatalogueAsset(id, {
      fetch: async (url) => {
        assert.equal(url, endpoint);
        return Response.json({ version: 1, asset: { ...asset, ...change } });
      },
    });
    assert.equal(result.code, "catalogue_invalid");
  }
});

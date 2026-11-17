import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  browseShareArtwork,
  resolveShareCatalogueAsset,
  sameCatalogueAsset,
  searchShareCatalogueAssets,
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

test("search sends a bounded query to Woodhouse and returns only public candidates", async () => {
  const candidate = { ...asset, project: "woodhouse" };
  const result = await searchShareCatalogueAssets("  art & light  ", {
    fetch: async (url, options) => {
      const endpoint = new URL(url);
      assert.equal(
        endpoint.origin + endpoint.pathname,
        SHARE_CATALOGUE_API_BASE,
      );
      assert.deepEqual(
        [...endpoint.searchParams],
        [
          ["q", "art & light"],
          ["limit", "8"],
        ],
      );
      assert.equal(options.redirect, "manual");
      assert.equal(new Headers(options.headers).has("Authorization"), false);
      return Response.json({
        version: 1,
        assets: [
          candidate,
          candidate,
          { ...candidate, id: "private-art", visibility: "private" },
          { ...candidate, id: "prohibited-art", reuse: "prohibited" },
          { ...candidate, id: "bad/id" },
        ],
      });
    },
  });
  assert.deepEqual(result, {
    ok: true,
    items: [{ assetId: id, title: "Workshop image", project: "woodhouse" }],
  });
});

test("search distinguishes catalogue failure from an empty result", async () => {
  for (const response of [
    Response.redirect("https://example.com"),
    Response.json({ version: 2, assets: [] }),
    new Response("x".repeat(65_537)),
  ]) {
    const result = await searchShareCatalogueAssets("foilbury", {
      fetch: async () => response,
    });
    assert.equal(result.ok, false);
  }
  assert.deepEqual(
    await searchShareCatalogueAssets("foilbury", {
      fetch: async () => Response.json({ version: 1, assets: [] }),
    }),
    { ok: true, items: [] },
  );
});

test("artwork browsing preserves its filters and only links public, same-origin renditions", async () => {
  const artwork = {
    ...asset,
    project: "workshop",
    thumbnailUrl: asset.previewUrl,
    shareUrl: `${SHARE_CATALOGUE_ORIGIN}/share/workshop/`,
  };
  const filters = { query: "art & light", project: "workshop", after: "earlier" };
  const result = await browseShareArtwork(filters, {
    fetch: async (href, options) => {
      const url = new URL(href);
      assert.equal(`${url.origin}${url.pathname}`, SHARE_CATALOGUE_API_BASE);
      assert.equal(url.searchParams.get("q"), filters.query);
      assert.equal(url.searchParams.get("project"), filters.project);
      assert.equal(url.searchParams.get("after"), filters.after);
      assert.equal(options.redirect, "manual");
      return Response.json({
        version: 1,
        assets: [
          artwork,
          { ...artwork, id: "private", visibility: "private" },
          { ...artwork, id: "external-image", thumbnailUrl: "https://example.com/campaign/art.jpg" },
          { ...artwork, id: "external-kit", shareUrl: "https://example.com/share/workshop/" },
        ],
        nextAfter: "next-page",
      });
    },
  });
  assert.deepEqual(result?.items.map((item) => item.assetId), [id]);
  assert.equal(result.items[0].previewUrl, artwork.previewUrl);
  assert.equal(result.nextAfter, "next-page");
});

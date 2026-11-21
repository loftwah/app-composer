import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  artworkRevision,
  browseShareArtwork,
  publicShareArtwork,
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

test("a public artwork link pins the same catalogue response before reading its image", async () => {
  const artwork = {
    ...asset,
    project: "workshop",
    description: "The exact short artwork description.",
    thumbnailUrl: asset.previewUrl,
    shareUrl: `${SHARE_CATALOGUE_ORIGIN}/share/workshop/`,
  };
  const body = () => Response.json({ version: 1, asset: artwork });
  const publicRecord = await publicShareArtwork(id, { fetch: async () => body() });
  assert.equal(publicRecord.status, 200);
  const revision = await artworkRevision(publicRecord.artwork);
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    if (url === endpoint) return body();
    return new Response(Uint8Array.of(0xff, 0xd8, 0xff, 0xd9), { headers: { "Content-Type": "image/jpeg" } });
  };
  const stale = await resolveShareCatalogueAsset(id, { fetch, expectedArtworkRevision: "0".repeat(64) });
  assert.equal(stale.code, "artwork_stale");
  assert.deepEqual(calls.splice(0), [endpoint]);
  const exact = await resolveShareCatalogueAsset(id, { fetch, expectedArtworkRevision: revision });
  assert.equal(exact.ok, true);
  assert.equal(exact.sourceDescription, artwork.description);
  assert.equal(Object.hasOwn(exact.asset, "description"), false);
  assert.deepEqual(calls, [endpoint, asset.previewUrl]);
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

test("artwork detail requires the matching public record and distinguishes missing from unavailable", async () => {
  const artwork = {
    ...asset,
    project: "workshop",
    thumbnailUrl: asset.previewUrl,
    shareUrl: `${SHARE_CATALOGUE_ORIGIN}/share/workshop/`,
  };
  for (const [record, status] of [
    [artwork, 200],
    [{ ...artwork, id: "substituted" }, 404],
    [{ ...artwork, visibility: "private" }, 404],
  ]) {
    const result = await publicShareArtwork(id, {
      fetch: async (url, options) => {
        assert.equal(url, endpoint);
        assert.equal(options.redirect, "manual");
        return Response.json({ version: 1, asset: record });
      },
    });
    assert.equal(result.status, status);
  }
  for (const status of [404, 503]) {
    assert.equal((await publicShareArtwork(id, {
      fetch: async () => new Response(null, { status }),
    })).status, status);
  }
});

test("Composer artwork is available by its public ID and exact revision without the legacy catalogue", async () => {
  const id = "composer-workshop-08-weird";
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    return new Response(Uint8Array.of(0xff, 0xd8, 0xff, 0xd9), {
      headers: { "content-type": "image/jpeg" },
    });
  };
  const detail = await publicShareArtwork(id, { fetch });
  assert.equal(detail.status, 200);
  assert.ok(detail.artwork.tags.includes("workshop-series"));
  assert.deepEqual(calls, []);

  const stale = await resolveShareCatalogueAsset(id, {
    fetch,
    expectedArtworkRevision: "0".repeat(64),
  });
  assert.equal(stale.code, "artwork_stale");
  assert.deepEqual(calls, []);

  const exact = await resolveShareCatalogueAsset(id, {
    fetch,
    expectedArtworkRevision: await artworkRevision(detail.artwork),
  });
  assert.equal(exact.ok, true);
  assert.equal(exact.sourceDescription, detail.artwork.caption);
  assert.deepEqual(calls, [detail.artwork.previewUrl]);
  assert.match(calls[0], /^https:\/\/composer\.loftwah\.com\/campaign\//);
});

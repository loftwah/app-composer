import test from "node:test";
import assert from "node:assert/strict";
import {
  artworkFilters,
  galleryHref,
  galleryPage,
} from "../src/lib/share-gallery.ts";
import {
  artworkRevision,
  composerShareCollection,
  publicShareArtwork,
} from "../src/lib/share-catalogue-asset.ts";
import { handleShareFeedback, readLikedArtworkIds } from "../src/lib/share-feedback.ts";
import { migration, sqliteD1 } from "./helpers/stacks-sqlite.mjs";

test("artwork facets and featured picks apply before pagination and shuffle stays stable", () => {
  const entries = Array.from({ length: 53 }, (_, index) => ({
    assetId: `asset-${index}`,
    project: index % 2 ? "fighter" : "bubbles",
    title: `Lantern ${index}`,
    alt: "Festival",
    thumbnailUrl: `https://woodhouse.loftwah.com/campaign/collection/asset-${index}.webp`,
    description: "",
    credit: "Composer",
    category: "illustration",
    tags: ["poster"],
    reviewedAt: "2026-11-14",
  }));
  const curation = [{ assetId: "asset-52", featured: true, tags: ["key art"] }];
  const forURL = (value) =>
    artworkFilters(new URL(value, "https://composer.test").searchParams);
  const featured = galleryPage(entries, curation, forURL("/share"));
  assert.equal(featured.items[0].assetId, "asset-52");
  assert.deepEqual(
    galleryPage(
      entries,
      curation,
      forURL(
        "/share?category=illustration&tag=key+art&project=bubbles&art=lantern+festival",
      ),
    ).items.map((item) => item.assetId),
    ["asset-52"],
  );

  const composer = { ...entries[0], project: "app-composer", assetId: "composer-study" };
  const studio = { ...entries[0], project: "composer-media-studio", assetId: "studio-study" };
  const mixed = [...entries, studio, composer];
  const first = galleryPage(mixed, curation, forURL("/share")).items.slice(0, 4);
  assert.equal(first[0].assetId, "asset-52");
  assert.equal(new Set(first.map(item => item.project)).size, 4);
  const liked = forURL("/share?view=liked");
  assert.deepEqual(galleryPage(mixed, curation, liked, new Set(["composer-study", "withdrawn"])).items.map(item => item.assetId), ["composer-study"]);
  assert.equal(new URL(galleryHref(liked, { after: "composer-study" }), "https://composer.test").searchParams.get("view"), "liked");
  assert.ok(galleryPage(mixed, curation, forURL("/share?project=fighter")).items.every(item => item.project === "fighter"));

  const walk = (seed) => {
    let url = `/share?sort=random&seed=${seed}`;
    const ids = [];
    while (url) {
      const filters = forURL(url);
      const page = galleryPage(entries, curation, filters);
      ids.push(...page.items.map((item) => item.assetId));
      assert.ok(ids.length <= entries.length);
      url = page.nextAfter
        ? galleryHref(filters, { after: page.nextAfter })
        : "";
    }
    assert.equal(new Set(ids).size, entries.length);
    return ids;
  };
  assert.deepEqual(walk("1234abcd"), walk("1234abcd"));
  assert.notDeepEqual(walk("1234abcd"), walk("4321abcd"));
});

test("Clef scores order the entire filtered cohort and leave unknowns browseable", () => {
  const entries = Array.from({ length: 28 }, (_, index) => ({
    assetId: `piece-${String(index).padStart(2, "0")}`,
    title: "Lantern",
    project: index === 27 ? "elsewhere" : "bubbles",
    category: "illustration",
    tags: [],
  }));
  const scores = new Map(entries.slice(0, 26).map((entry, index) =>
    [entry.assetId, { score: index === 0 ? 0 : index > 23 ? 4 : 2 }]));
  scores.set("piece-27", { score: 4 });
  const filters = artworkFilters(new URLSearchParams("sort=clef&project=bubbles&art=lantern"));
  const first = galleryPage(entries, [], filters, undefined, scores);
  assert.deepEqual(first.items.slice(0, 2).map(item => item.assetId), ["piece-24", "piece-25"]);
  assert.equal(first.total, 27);
  assert.equal(first.items.length, 24);
  const next = new URL(galleryHref(filters, { after: first.nextAfter }), "https://composer.test");
  const second = galleryPage(entries, [], artworkFilters(next.searchParams), undefined, scores);
  assert.deepEqual(second.items.map(item => item.assetId), ["piece-23", "piece-00", "piece-26"]);
  assert.equal(second.items[1].social.score, 0);
  assert.equal(second.items[2].social, undefined);
});

test("a new title or thumbnail retires a cached Clef assessment", async () => {
  const { artworkSocialReview } = await import("../src/lib/decision-intelligence.ts");
  const artwork = composerShareCollection("who-keeps-the-map")
    .find(item => item.assetId === "map-ask-the-owner");
  assert.ok(await artworkSocialReview(artwork));
  assert.equal(await artworkSocialReview({ ...artwork, title: "A materially different title" }), undefined);
  assert.equal(await artworkSocialReview({ ...artwork, thumbnailUrl: artwork.previewUrl }), undefined);
  assert.ok(await artworkSocialReview(artwork));
});

test("orientation filter uses recorded original dimensions and survives gallery URLs", () => {
  const piece = (assetId, original, thumbnail) => ({
    assetId,
    project: "bubbles",
    title: assetId,
    alt: "Festival",
    description: "",
    credit: "Composer",
    category: "illustration",
    tags: [],
    reviewedAt: "2026-11-14",
    original: original
      ? {
          url: `https://woodhouse.loftwah.com/campaign/${assetId}.png`,
          label: "Original",
          width: original[0],
          height: original[1],
        }
      : null,
    thumbnailSize: {
      url: `https://woodhouse.loftwah.com/campaign/${assetId}-thumb.png`,
      label: "",
      width: thumbnail[0],
      height: thumbnail[1],
    },
  });
  // "tall" is a portrait original with a deliberately misleading landscape
  // thumbnail: classification must come from the original, never the preview.
  const entries = [
    piece("wide", [1600, 900], [1600, 900]),
    piece("tall", [900, 1600], [1600, 900]),
    piece("square", [1000, 1000], [1000, 1000]),
    piece("unknown", null, [1600, 900]),
  ];
  const forURL = (value) =>
    artworkFilters(new URL(value, "https://composer.test").searchParams);
  const ids = (url) =>
    galleryPage(entries, [], forURL(url)).items
      .map((item) => item.assetId)
      .sort();
  const all = ["square", "tall", "unknown", "wide"];
  const params = (value) =>
    new URL(value, "https://composer.test").searchParams;

  // Default and unknown/invalid values never hide an artwork with unknown size.
  assert.deepEqual(ids("/share"), all);
  assert.deepEqual(ids("/share?orientation=any"), all);
  assert.deepEqual(ids("/share?orientation=diagonal"), all);
  assert.deepEqual(ids("/share?orientation=landscape"), ["wide"]);
  assert.deepEqual(ids("/share?orientation=portrait"), ["tall"]);
  assert.deepEqual(ids("/share?orientation=square"), ["square"]);

  // The selection survives pagination, Shuffle, Back and chip removal.
  const filters = forURL(
    "/share?orientation=portrait&art=lantern&category=illustration",
  );
  assert.equal(filters.orientation, "portrait");
  for (const updates of [
    { after: "" },
    { after: "tall" },
    { sort: "random", seed: "abcd1234" },
  ]) {
    const next = params(galleryHref(filters, updates));
    assert.equal(next.get("orientation"), "portrait");
    assert.equal(next.get("art"), "lantern");
    assert.equal(next.get("category"), "illustration");
  }
  assert.equal(
    params(galleryHref(filters, { orientation: "any" })).has("orientation"),
    false,
  );
  assert.equal(
    params(galleryHref(forURL("/share"))).has("orientation"),
    false,
  );
});

test("artwork feedback stores the current public revision privately without entering film history", async () => {
  const base = "https://composer.test/api/share-feedback";
  const record = {
    id: "old-lantern",
    visibility: "public",
    project: "bubbles",
    title: "Old lantern",
    alt: "An old lantern",
    credit: "Bubbles",
    thumbnailUrl: "https://woodhouse.loftwah.com/campaign/old-lantern.jpg",
    previewUrl: "https://woodhouse.loftwah.com/campaign/old-lantern.jpg",
    shareUrl: "https://woodhouse.loftwah.com/share/bubbles/",
    original: {
      url: "https://woodhouse.loftwah.com/campaign/old-lantern.png",
      version: "1",
    },
  };
  const resolve = (id) =>
    publicShareArtwork(id, {
      fetch: async () => Response.json({ version: 1, asset: record }),
    });
  const resolved = await resolve(record.id);
  assert.equal(resolved.status, 200);
  const revision = await artworkRevision(resolved.artwork);
  const db = sqliteD1({ schema: migration("0040_share_feedback.sql") });
  const call = (actor, url, payload) =>
    handleShareFeedback(
      new Request(
        url,
        payload
          ? {
              method: "POST",
              headers: {
                Origin: new URL(base).origin,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }
          : undefined,
      ),
      actor,
      db,
      resolve,
    );
  const key = { assetId: record.id, revision };
  const save = {
    ...key,
    action: "save",
    vote: "up",
    reasons: [],
    note: "Keep the warm light.",
  };
  const itemUrl = base + "?" + new URLSearchParams(key);
  try {
    assert.equal((await call("alice", base, save)).status, 200);
    assert.equal(
      (await (await call("alice", itemUrl)).json()).item.note,
      save.note,
    );
    assert.equal((await (await call("bob", itemUrl)).json()).item, null);
    assert.deepEqual([...await readLikedArtworkIds("alice", db)], [record.id]);
    assert.deepEqual([...await readLikedArtworkIds("bob", db)], []);
    assert.deepEqual((await (await call("alice", base)).json()).items, []);
    record.original.version = "2";
    assert.equal((await call("alice", base, save)).status, 409);
    assert.equal(
      (await call("alice", base, { ...key, action: "remove" })).status,
      200,
    );
    assert.equal((await (await call("alice", itemUrl)).json()).item, null);
    assert.equal((await readLikedArtworkIds("alice", db)).size, 0);
  } finally {
    db.cleanup();
  }
});

test("native admin curation returns data for the EmDash envelope and requires an administrator", async () => {
  const { manageShareArtwork } =
    await import("../src/lib/share-gallery-admin.ts");
  const db = sqliteD1({ schema: migration("0041_share_artwork_curation.sql") });
  const request = new Request(
    "https://composer.test/_emdash/api/plugins/composer-stacks/shareArtworkRead",
  );
  try {
    const data = await manageShareArtwork({ request, user: { role: 50 } }, db);
    assert.deepEqual(data, { items: [] });
    await assert.rejects(
      manageShareArtwork({ request, user: { role: 40 } }, db),
      { name: "PluginRouteError" },
    );
  } finally {
    db.cleanup();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  artworkFilters,
  galleryHref,
  galleryPage,
} from "../src/lib/share-gallery.ts";
import {
  artworkRevision,
  publicShareArtwork,
} from "../src/lib/share-catalogue-asset.ts";
import { handleShareFeedback } from "../src/lib/share-feedback.ts";
import { migration, sqliteD1 } from "./helpers/stacks-sqlite.mjs";

test("artwork facets and featured picks apply before pagination and shuffle stays stable", () => {
  const entries = Array.from({ length: 53 }, (_, index) => ({
    assetId: `asset-${index}`,
    project: index % 2 ? "fighter" : "bubbles",
    title: `Lantern ${index}`,
    alt: "Festival",
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
    assert.deepEqual((await (await call("alice", base)).json()).items, []);
    record.original.version = "2";
    assert.equal((await call("alice", base, save)).status, 409);
    assert.equal(
      (await call("alice", base, { ...key, action: "remove" })).status,
      200,
    );
    assert.equal((await (await call("alice", itemUrl)).json()).item, null);
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

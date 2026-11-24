import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  approvedAnarchCover, approvedCoverForSource, approvedOpenGoldbergCover, normaliseApprovedCovers,
} from "../src/lib/top-nine-approved-cover.ts";

const album = "https://music.apple.com/us/album/bach-goldberg-variations/1162185845";

test("approved artwork matches the exact album across storefronts", () => {
  assert.equal(approvedCoverForSource(album), approvedOpenGoldbergCover);
  assert.equal(approvedCoverForSource(album.replace("/us/", "/au/")), approvedOpenGoldbergCover);
  assert.equal(approvedCoverForSource(album.replace("1162185845", "1162185846")), null);
  assert.equal(approvedCoverForSource(album + "?i=1162185847"), null);
  assert.equal(approvedCoverForSource(album.replace("music.apple.com", "music.example.com")), null);
  assert.equal(approvedCoverForSource("Open Goldberg Variations"), null);
});

test("each approved file matches its reviewed bytes", async () => {
  for (const cover of [approvedOpenGoldbergCover, approvedAnarchCover]) {
    const artwork = await readFile(new URL("../public" + cover.src, import.meta.url));
    assert.equal(artwork.byteLength, cover.bytes);
    assert.equal(createHash("sha256").update(artwork).digest("hex"), cover.sha256);
  }
});

test("game artwork is attached only to its exact Wikidata identity and defaults to whole image", () => {
  assert.equal(approvedCoverForSource(approvedAnarchCover.entity), approvedAnarchCover);
  assert.equal(approvedCoverForSource("https://www.wikidata.org/entity/Q114540914"), approvedAnarchCover);
  assert.equal(approvedCoverForSource("https://www.wikidata.org/wiki/Q4751684"), null);
  assert.equal(approvedCoverForSource("https://www.wikidata.org/wiki/Q16410283"), null);
  assert.equal(approvedCoverForSource("https://example.com/wiki/Q114540914"), null);
  assert.equal(approvedAnarchCover.defaultFit, "contain");
});

test("shared cover references require a pinned ID, its matching album, and an explicit fit", () => {
  const albumLinks = [album, ...Array(8).fill(null)];
  const ref = { id: approvedOpenGoldbergCover.id, fit: "contain" };
  const covers = [ref, ...Array(8).fill(null)];
  assert.deepEqual(normaliseApprovedCovers(covers, albumLinks), covers);
  assert.deepEqual(normaliseApprovedCovers(undefined, albumLinks), []);
  assert.deepEqual(normaliseApprovedCovers([ref], albumLinks), []);
  assert.ok(normaliseApprovedCovers(covers, albumLinks.map(() => null)).every((value) => value === null));
  for (const invalid of [{ ...ref, id: "https://example.com/art.jpg" }, { ...ref, fit: "stretch" }]) {
    assert.ok(normaliseApprovedCovers([invalid, ...Array(8).fill(null)], albumLinks).every((value) => value === null));
  }
});

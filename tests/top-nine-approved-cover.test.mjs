import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  approvedCoverForSource, approvedOpenGoldbergCover, normaliseApprovedCovers,
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

test("only the pinned Commons image is shipped", async () => {
  const artwork = await readFile(new URL("../public" + approvedOpenGoldbergCover.src, import.meta.url));
  assert.equal(artwork.byteLength, approvedOpenGoldbergCover.bytes);
  assert.equal(createHash("sha256").update(artwork).digest("hex"), approvedOpenGoldbergCover.sha256);
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

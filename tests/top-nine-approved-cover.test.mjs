import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  approvedCoverForSource, approvedOpenGoldbergCover,
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

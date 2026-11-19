// Focused regression for the user-triggered Share artwork post package (#477).
// Fictional bytes only: no network, provider, credential or database.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildArtworkPackage,
  artworkPackageName,
  readArtworkPackageBytes,
  sha256Hex,
  PACKAGE_TEXT_NAME,
  PACKAGE_MANIFEST_NAME,
} from "../src/lib/share-artwork-package.ts";
import { unzip } from "../lib/launch-kit/archive.mjs";

const input = {
  assetId: "atlas-04-composer-family",
  revision: "a".repeat(64),
  title: "A finish catches light",
  credit: "Woodhouse · GPT Image 2.6 via Fal",
  sourceUrl: "https://woodhouse.loftwah.com/campaign/provenance.txt",
  canonical: "https://composer.loftwah.com/share/artwork/atlas-04-composer-family",
  extension: "png",
  postTextFile: "A finish catches light\n\nWoodhouse · GPT Image 2.6 via Fal\n\nImage alt text\n\nA machined block catching warm light.",
  alt: "A machined block catching warm light.",
  bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]),
};

function open(archive) {
  const files = unzip(archive);
  return {
    files,
    text: new TextDecoder().decode(files.get(PACKAGE_TEXT_NAME)),
    manifest: JSON.parse(new TextDecoder().decode(files.get(PACKAGE_MANIFEST_NAME))),
  };
}

test("the package is a valid ZIP of the exact artwork bytes, credited text and alt", async () => {
  const built = await buildArtworkPackage(input);
  assert.equal(built.name, "atlas-04-composer-family-post-package.zip");
  assert.equal(artworkPackageName(input.assetId), built.name);

  const { files, text, manifest } = open(built.archive);
  assert.deepEqual([...files.keys()], [
    "atlas-04-composer-family-artwork.png",
    PACKAGE_TEXT_NAME,
    PACKAGE_MANIFEST_NAME,
  ]);
  assert.deepEqual(files.get("atlas-04-composer-family-artwork.png"), input.bytes);
  assert.equal(
    text,
    input.postTextFile,
  );
  assert.equal(manifest.alt, undefined, "raw provenance stays in JSON; text is the display copy");
  assert.equal(manifest.imageAlt, input.alt);
  assert.equal(manifest.credit, input.credit);
  assert.equal(manifest.source, input.sourceUrl);
  assert.equal(manifest.canonical, input.canonical);
  assert.equal(manifest.revision, input.revision);
  assert.equal(manifest.artworkBytes, input.bytes.length);
  assert.match(manifest.note, /revision-bound public artwork download/i);
});

test("the saved digest is the digest of the packaged bytes", async () => {
  const expected = createHash("sha256").update(input.bytes).digest("hex");
  assert.equal(await sha256Hex(input.bytes), expected);
  const built = await buildArtworkPackage(input);
  assert.equal(open(built.archive).manifest.artworkSha256, expected);
});

test("long or unusual asset ids still produce safe, stable native names", async () => {
  const long = "a".repeat(120);
  const built = await buildArtworkPackage({ ...input, assetId: long, extension: "JPEG?!" });
  const entry = [...open(built.archive).files.keys()][0];
  assert.match(entry, /^[a-z0-9][a-z0-9.-]{0,79}$/);
  assert.ok(entry.endsWith("-artwork.jpeg"));
  assert.equal(built.name, `${long}-post-package.zip`);
});

test("an oversized artwork fails with a direct-download recovery message", async () => {
  await assert.rejects(
    buildArtworkPackage({ ...input, bytes: new Uint8Array(7 * 1024 * 1024 + 1) }),
    /too large for one package\. Use the direct download instead\./,
  );
});

test("the browser stops reading an oversized artwork before buffering the whole response", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readArtworkPackageBytes(new Response(body)), /too large for one package/);
  assert.equal(cancelled, true);
});

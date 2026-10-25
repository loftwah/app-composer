import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import source from "../lib/ldraw/source.json" with { type: "json" };
import { apps } from "../src/lib/apps.ts";
import { validateManifest } from "../scripts/contracts.mjs";
import { appDeviceSupport } from "../src/lib/app-device-support.ts";
import { deviceAssessment } from "../src/lib/device-support.mjs";
import { ldrawDestination } from "../src/lib/ldraw-entry.mjs";

function losslessDimensions(data) {
  assert.equal(data.toString("ascii", 0, 4), "RIFF");
  assert.equal(data.toString("ascii", 8, 16), "WEBPVP8L");
  assert.equal(data[20], 0x2f);
  const dimensions = data.readUInt32LE(21);
  return [(dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1];
}

const bytes = readFileSync(
  new URL("../lib/ldraw/app.manifest.json", import.meta.url),
);
const manifest = JSON.parse(bytes);
test("LDraw retains its exact independent static contract with no Composer data authority", () => {
  assert.match(source.commit, /^[a-f0-9]{40}$/);
  assert.equal(
    source.repository,
    "https://github.com/loftwah/app-composer-ldraw",
  );
  assert.equal(source.origin, "https://ldraw.loftwah.com");
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    source.manifestFileSha256,
  );
  assert.equal(
    "sha256:" +
      createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    source.manifestDigest,
  );
  const checked = validateManifest(manifest);
  assert.equal(checked.id, "ldraw");
  assert.equal(checked.runtime, "static-assets");
  assert.deepEqual(checked.capabilities, []);
  assert.deepEqual(checked.configuration, {});
  const config = JSON.parse(
    readFileSync(new URL("../wrangler.jsonc", import.meta.url)),
  );
  assert.ok(
    !config.services.some((binding) =>
      /ldraw/i.test(binding.binding + binding.service),
    ),
  );
});
test("standalone device intent is visible without converting missing evidence into support", () => {
  const support = appDeviceSupport("ldraw");
  assert.equal(support.target, "both");
  assert.equal(deviceAssessment(support, "desktop").status, "supported");
  assert.equal(deviceAssessment(support, "phone").status, "limited");
  assert.equal(deviceAssessment(support, "phone").evidence.method, "browser-emulation");
  assert.equal(deviceAssessment(support, "phone").evidence.revision, source.commit);
  assert.equal(deviceAssessment(support, "tablet").status, "unknown");
  assert.equal(appDeviceSupport("unrecognised-app").target, "unknown");
});
test("entry forwards only bounded verification flags to the fixed independent origin", () => {
  const url = ldrawDestination(
    "https://composer.loftwah.com/ldraw?analytics=off&qa=proof-290&project=private&scene=secret&target=https://other.example#secret",
  );
  assert.equal(url.origin, "https://ldraw.loftwah.com");
  assert.equal(url.pathname, "/");
  assert.deepEqual(
    [...url.searchParams],
    [
      ["analytics", "off"],
      ["qa", "proof-290"],
    ],
  );
  assert.equal(url.hash, "");
  for (const query of [
    "qa=" + "a".repeat(65),
    "qa=unsafe%20value",
    "qa=%0Ahidden",
    "analytics=on",
    "url=https://other.example",
    "token=secret",
  ])
    assert.equal(
      ldrawDestination("https://composer.loftwah.com/ldraw?" + query).href,
      "https://ldraw.loftwah.com/",
    );
  assert.equal(
    ldrawDestination(
      new URL("https://composer.loftwah.com/ldraw?qa=0"),
    ).searchParams.get("qa"),
    "0",
  );
});

// The public artwork is bound to the adopted release, not just to a date. These
// checks decode the real pixels so a replaced file cannot pass on its name.
test("the LDraw capture, previews, share card and tile match the adopted release", () => {
  const app = apps.find((entry) => entry.id === "ldraw");
  const asset = (url) =>
    readFileSync(new URL("../public" + url, import.meta.url));
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const provenance = JSON.parse(asset(app.previewProvenance));
  assert.equal(app.releasedSource, source.commit);
  assert.equal(app.source, source.repository + "/tree/" + source.commit);
  assert.equal(provenance.capture.releasedSource, source.commit);
  assert.equal(provenance.capture.url, app.previewOrigin);
  assert.equal(app.previewOrigin, source.origin + "/");
  assert.equal(provenance.capture.capturedAt.slice(0, 10), app.previewCaptured);
  assert.equal(provenance.recipe, "composer.ldraw-discovery/2");
  assert.equal(provenance.compositor.path, "scripts/ldraw-discovery-assets.py");
  assert.equal(
    digest(
      readFileSync(
        new URL("../scripts/ldraw-discovery-assets.py", import.meta.url),
      ),
    ),
    provenance.compositor.sha256,
  );
  const record = (url) => {
    const name = url.split("/").at(-1);
    const entry = provenance.assets[name];
    assert.ok(entry, name + " has no provenance record");
    const file = asset(url);
    assert.equal(digest(file), entry.sha256, name + " must keep its recorded bytes");
    return { bytes: file, entry };
  };

  const capture = record("/brand/apps/" + provenance.capture.preservedAs);
  assert.equal(digest(capture.bytes), provenance.capture.sha256);
  const decodedCapture = PNG.sync.read(capture.bytes);
  assert.deepEqual([decodedCapture.width, decodedCapture.height], [1440, 1000]);
  assert.equal(digest(decodedCapture.data), provenance.capture.pixelSha256);

  const shareRecord = record(app.share);
  const share = PNG.sync.read(shareRecord.bytes);
  assert.deepEqual([share.width, share.height], [1200, 630]);
  assert.equal(digest(share.data), shareRecord.entry.pixelSha256);

  // Lossless previews keep their recorded pixels; the 1440 resize is the capture itself.
  for (const url of [app.preview, app.previewWide]) {
    const { bytes, entry } = record(url);
    assert.deepEqual(
      losslessDimensions(bytes),
      [entry.width, entry.height],
      url + " must decode at its recorded size",
    );
  }
  assert.equal(
    record(app.previewWide).entry.pixelSha256,
    provenance.capture.pixelSha256,
  );

  const tile = record(app.thumbnail);
  assert.deepEqual(losslessDimensions(tile.bytes), [96, 96]);
  assert.match(tile.entry.role, /wordmark tile/i);

  // The replaced release keeps its own dated provenance and original pixels.
  const previous = JSON.parse(
    asset("/brand/apps/ldraw-provenance-c9c2339a1296-d2e0dc4b-r2.json"),
  );
  assert.equal(
    previous.capture.releasedSource,
    "c9c2339a1296ee7c06a7d94f274c69143478acba",
  );
  assert.notEqual(previous.capture.sha256, provenance.capture.sha256);
  const previousCapture = asset("/brand/apps/" + previous.capture.preservedAs);
  assert.equal(digest(previousCapture), previous.capture.sha256);
  // The typographic tile is Composer's own art: unchanged pixels, new source-bound name.
  assert.equal(
    digest(asset("/brand/apps/ldraw-tile-c9c2339a1296-d2e0dc4b-r2-96.webp")),
    digest(tile.bytes),
  );
});

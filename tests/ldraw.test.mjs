import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import source from "../lib/ldraw/source.json" with { type: "json" };
import { validateManifest } from "../scripts/contracts.mjs";
import { appDeviceSupport } from "../src/lib/app-device-support.ts";
import { deviceAssessment } from "../src/lib/device-support.mjs";
import { ldrawDestination } from "../src/lib/ldraw-entry.mjs";

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

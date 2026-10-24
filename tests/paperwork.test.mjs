import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest } from "../scripts/contracts.mjs";
import { validatePaperworkConfig } from "../lib/paperwork/config.mjs";
const manifest = {
  contract: 1,
  id: "paperwork",
  repository: "https://github.com/loftwah/app-composer-paperwork",
  runtime: "static-assets",
  dataVersion: 1,
  routes: ["/paperwork"],
  capabilities: [],
  configuration: {
    title: { type: "string", maxLength: 80 },
    intro: { type: "string", maxLength: 240 },
    theme: { type: "select", options: ["midnight", "daylight"] },
  },
};
test("static mini-app contract has no data or service authority", () => {
  assert.equal(validateManifest(manifest).runtime, "static-assets");
  for (const change of [
    { capabilities: ["items:read"] },
    { memberService: { version: 2 } },
    { services: ["anything"] },
    { runtime: "remote-build" },
  ])
    assert.throws(() => validateManifest({ ...manifest, ...change }));
});
test("Paperwork portable configuration rejects document data, unknown keys and active text", () => {
  const config = {
    version: 1,
    title: "My Paperwork",
    intro: "Complete this form.",
    theme: "daylight",
  };
  assert.deepEqual(validatePaperworkConfig(config), config);
  for (const change of [
    { pdf: "bytes" },
    { signature: "bytes" },
    { theme: "system" },
    { version: 2 },
    { title: "<script>\n" },
    { intro: "x".repeat(241) },
  ])
    assert.throws(() => validatePaperworkConfig({ ...config, ...change }));
});
test("working editor is discoverable through the incumbent product and Init", () => {
  for (const file of [
    "src/components/DiscoverWork.astro",
    "src/lib/apps.ts",
    "src/pages/paperwork.astro",
    "src/pages/init.astro",
  ])
    assert.match(readFileSync(file, "utf8"), /paperwork/);
  assert.match(
    readFileSync("src/pages/init/paperwork.astro", "utf8"),
    /pnpm init:paperwork/,
  );
});

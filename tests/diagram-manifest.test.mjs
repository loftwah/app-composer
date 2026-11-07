import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildManifest, validateManifest, manifestPath, root } from "../scripts/diagram-manifest.mjs";

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

test("every atlas diagram has reviewed provenance and matching files", () => {
  const { problems, checked } = validateManifest(manifest, { directory: root });
  assert.deepEqual(problems, []);
  assert.equal(checked >= 3, true);
});

test("the manifest keeps the four committed scenes", () => {
  const names = manifest.diagrams.map((entry) => entry.name).sort();
  assert.deepEqual(names, [
    "agent-approval-boundary",
    "cloudflare-isolation",
    "contribution-boundary",
    "get-ready-lifecycle",
  ]);
});

test("a changed scene is refused with the review instruction", () => {
  const changed = structuredClone(manifest);
  changed.diagrams[0].sha256.png = "0".repeat(64);
  const { problems } = validateManifest(changed, { directory: root });
  assert.equal(problems.length > 0, true);
  assert.match(problems.join("\n"), /changed since review/);
  assert.match(problems.join("\n"), /pnpm diagrams:manifest --write/);
});

test("a wrong atlas dimension is refused before the page reserves space", () => {
  const { problems } = validateManifest(
    { ...structuredClone(manifest), diagrams: structuredClone(manifest.diagrams).map((entry) => ({ ...entry, width: entry.width + 1 })) },
    { directory: root },
  );
  assert.equal(problems.some((problem) => /manifest is .* the PNG is/.test(problem)), true);
});

test("building the manifest records the real PNG dimensions", () => {
  const rebuilt = buildManifest({ directory: root, reviewed: "2026-11-07" });
  const byName = new Map(rebuilt.diagrams.map((entry) => [entry.name, entry]));
  assert.equal(byName.get("get-ready-lifecycle").width, 2176);
  assert.equal(byName.get("cloudflare-isolation").width, 2335);
});

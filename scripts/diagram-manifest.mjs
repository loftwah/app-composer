#!/usr/bin/env node
// Diagram atlas provenance gate.
//
// The atlas page renders committed LDraw scenes. A scene, SVG or PNG can change
// without the other two following, and a mismatched PNG dimension reserves the
// wrong space before the image loads. This gate records one reviewed hash per
// file, requires the atlas dimensions to match the PNG, and refuses a partial
// or unreviewed replacement. It writes nothing unless `--write` is explicit.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { diagramAtlas } from "../src/lib/diagram-atlas.ts";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const manifestPath = join(root, "public/diagrams/ldraw/manifest.json");
export const assetDir = "public/diagrams/ldraw";
const statuses = new Set(["shipped", "review"]);
const extensions = ["excalidraw", "svg", "png"];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function assetName(entry) {
  return entry.assetName ?? entry.name;
}

function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

/** Build the reviewed manifest from the atlas and the committed files. */
export function buildManifest({ directory = root, reviewed = new Date().toISOString().slice(0, 10), owner = "Loftwah" } = {}) {
  const diagrams = diagramAtlas.map((entry) => {
    const name = assetName(entry);
    const pngPath = join(directory, assetDir, name + ".png");
    if (!existsSync(pngPath)) throw Error(`Missing diagram PNG: ${assetDir}/${name}.png`);
    const png = readPng(pngPath);
    const hashes = {};
    for (const extension of extensions) {
      const relative = `${assetDir}/${name}.${extension}`;
      const path = join(directory, relative);
      if (!existsSync(path)) throw Error(`Missing diagram file: ${relative}`);
      hashes[extension] = sha256(readFileSync(path));
    }
    return {
      name: entry.name,
      assetName: name,
      status: "shipped",
      reviewed,
      source: `${assetDir}/${name}.excalidraw`,
      width: png.width,
      height: png.height,
      sha256: hashes,
    };
  });
  return {
    contract: 1,
    reviewed,
    owner,
    licence: "MIT",
    renderer: { app: "LDraw", engine: "@excalidraw/excalidraw@0.18.1", origin: "https://ldraw.loftwah.com" },
    diagrams,
  };
}

/** Validate the atlas, files and manifest against each other. Returns a report. */
export function validateManifest(manifest, { directory = root } = {}) {
  const problems = [];
  const fail = (message) => problems.push(message);
  if (manifest?.contract !== 1) fail("Manifest contract must be 1.");
  for (const field of ["reviewed", "owner", "licence", "renderer"]) {
    if (!manifest?.[field]) fail(`Manifest is missing ${field}.`);
  }
  if (!Array.isArray(manifest?.diagrams)) {
    fail("Manifest has no diagram list.");
    return { problems, checked: 0 };
  }
  const byName = new Map(manifest.diagrams.map((entry) => [entry.name, entry]));
  if (byName.size !== manifest.diagrams.length) fail("Manifest repeats a diagram name.");
  const atlasNames = new Set(diagramAtlas.map((entry) => entry.name));
  for (const name of atlasNames) {
    if (!byName.has(name)) fail(`Atlas diagram ${name} has no manifest entry.`);
  }
  for (const name of byName.keys()) {
    if (!atlasNames.has(name)) fail(`Manifest diagram ${name} is not in the atlas.`);
  }
  for (const entry of diagramAtlas) {
    const record = byName.get(entry.name);
    if (!record) continue;
    const name = assetName(entry);
    if (record.assetName !== name) {
      fail(`Diagram ${entry.name} records assetName ${record.assetName}, expected ${name}.`);
      continue;
    }
    if (!statuses.has(record.status)) fail(`Diagram ${entry.name} has an unsupported status: ${record.status}.`);
    if (!record.reviewed) fail(`Diagram ${entry.name} has no review date.`);
    if (!record.source?.endsWith(`/${name}.excalidraw`)) fail(`Diagram ${entry.name} does not name its editable source.`);
    const pngPath = join(directory, assetDir, name + ".png");
    if (!existsSync(pngPath)) {
      fail(`Missing diagram PNG: ${assetDir}/${name}.png`);
      continue;
    }
    const png = readPng(pngPath);
    if (record.width !== png.width || record.height !== png.height) {
      fail(`Diagram ${entry.name} manifest is ${record.width}x${record.height}; the PNG is ${png.width}x${png.height}.`);
    }
    if (entry.imageWidth !== png.width || entry.imageHeight !== png.height) {
      fail(
        `Atlas ${entry.name} declares ${entry.imageWidth ?? "default"}x${entry.imageHeight ?? "default"}; the PNG is ${png.width}x${png.height}. Set imageWidth: ${png.width}, imageHeight: ${png.height}.`,
      );
    }
    for (const extension of extensions) {
      const relative = `${assetDir}/${name}.${extension}`;
      const path = join(directory, relative);
      if (!existsSync(path)) {
        fail(`Missing diagram file: ${relative}`);
        continue;
      }
      const current = sha256(readFileSync(path));
      if (record.sha256?.[extension] !== current) {
        fail(
          `Diagram ${entry.name} ${extension} changed since review. Inspect it at 390 and 1440, then run \`pnpm diagrams:manifest --write\` and commit the scene, SVG and PNG together.`,
        );
      }
    }
  }
  return { problems, checked: byName.size };
}

function main() {
  const write = process.argv.includes("--write");
  if (write) {
    const manifest = buildManifest();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Wrote ${manifest.diagrams.length} reviewed diagrams to ${assetDir}/manifest.json.`);
    return;
  }
  if (!existsSync(manifestPath)) {
    throw Error("Missing public/diagrams/ldraw/manifest.json. Run `pnpm diagrams:manifest --write` and review the result.");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const { problems, checked } = validateManifest(manifest);
  if (problems.length) {
    for (const problem of problems) console.error(`✖ ${problem}`);
    throw Error(`${problems.length} diagram problem(s). Nothing was changed.`);
  }
  console.log(`Diagram atlas verified: ${checked} reviewed scenes with matching source, SVG, PNG and dimensions.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

#!/usr/bin/env node
// Refresh or check the committed Studio capability snapshot.
//
// The default mode is local and offline: it validates the committed JSON that
// drives Composer's Media Studio choices. `--write` is an explicit manual
// refresh from the published Studio manifest. It never calls inference, buys
// credit or changes a production default by itself.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = resolve(root, "config/media-studio-capabilities.json");
const sourceUrl = "https://media.loftwah.com/capabilities.json";
const requiredImages = ["studio-print", "studio-film", "studio-craft", "studio-quick"];
const requiredVideos = ["hailuo-standard", "kling-standard"];
const requiredAudio = ["studio-score", "studio-voice"];
const requiredFrames = ["square", "portrait", "landscape", "wide"];

function fail(message) {
  console.error(`studio-capabilities: ${message}`);
  process.exit(1);
}

export function validateManifest(value, { write = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The manifest must be an object");
  if (value.contract !== "media-studio-capabilities")
    throw new Error("The manifest contract is not media-studio-capabilities");
  if (value.version !== 1) throw new Error("Only manifest version 1 is supported");
  if (value.source !== undefined && value.source !== sourceUrl)
    throw new Error(`The manifest source must stay ${sourceUrl}`);
  if (!Array.isArray(value.models) || !value.models.length)
    throw new Error("The manifest has no models");
  if (!Array.isArray(value.retired)) throw new Error("The manifest has no retired list");
  if (!Array.isArray(value.frames)) throw new Error("The manifest has no frames");

  const byId = new Map();
  for (const model of value.models) {
    if (!model || typeof model.id !== "string" || !model.id)
      throw new Error("Every model needs an id");
    if (byId.has(model.id)) throw new Error(`Duplicate model ${model.id}`);
    if (typeof model.label !== "string" || !model.label)
      throw new Error(`${model.id} needs a label`);
    if (!["image", "video", "audio"].includes(model.kind))
      throw new Error(`${model.id} has an unsupported kind`);
    if (typeof model.endpoint !== "string" || !model.endpoint)
      throw new Error(`${model.id} needs an exact provider endpoint`);
    if (!Number.isInteger(model.costMicro) || model.costMicro <= 0)
      throw new Error(`${model.id} needs a positive planning cost`);
    if (typeof model.costBasis !== "string" || model.costBasis.length < 20)
      throw new Error(`${model.id} needs a readable cost basis`);
    byId.set(model.id, model);
  }
  const ids = new Set(byId.keys());
  for (const id of [...requiredImages, ...requiredVideos, ...requiredAudio]) {
    if (!ids.has(id)) throw new Error(`The enabled catalogue is missing ${id}`);
  }
  if (ids.has("studio-draft"))
    throw new Error("The retired SDXL Lightning model must not be enabled for new work");
  const retired = value.retired.find((model) => model.id === "studio-draft");
  if (!retired) throw new Error("The retired Studio Draft record is missing");
  if (retired.replacement !== "studio-craft")
    throw new Error("Studio Draft must name studio-craft as its replacement");
  if (retired.endpoint !== "@cf/bytedance/stable-diffusion-xl-lightning")
    throw new Error("The retired Studio Draft endpoint must stay exact");
  if (byId.get("studio-craft").endpoint !== "@cf/black-forest-labs/flux-2-klein-9b")
    throw new Error("Studio Draft must use FLUX.2 Klein 9B");

  if (JSON.stringify(value.frames) !== JSON.stringify(requiredFrames))
    throw new Error("The supported frames changed; review Composer Init before accepting them");
  const checkedAt = Date.parse(value.checkedAt);
  if (!Number.isFinite(checkedAt)) throw new Error("checkedAt must be an ISO timestamp");
  if (value.lastGoodAt && !Number.isFinite(Date.parse(value.lastGoodAt)))
    throw new Error("lastGoodAt must be an ISO timestamp when present");

  value.source = sourceUrl;
  if (write) {
    const temporary = `${configPath}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n");
    renameSync(temporary, configPath);
  }
  return {
    checkedAt: value.checkedAt,
    models: value.models.length,
    images: value.models.filter((model) => model.kind === "image").map((model) => model.id),
    videos: value.models.filter((model) => model.kind === "video").map((model) => model.id),
    retired: value.retired.map((model) => `${model.id}→${model.replacement}`),
  };
}

async function fetchManifest() {
  const response = await fetch(sourceUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Studio manifest returned HTTP ${response.status}`);
  return response.json();
}

const write = process.argv.includes("--write");
let value;
try {
  value = write ? await fetchManifest() : JSON.parse(readFileSync(configPath, "utf8"));
  if (write) value.models = value.models.filter((model) => model.composer === true);
  const summary = validateManifest(value, { write });
  console.log(JSON.stringify({ mode: write ? "write" : "check", source: sourceUrl, ...summary, modelCalls: 0 }, null, 2));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

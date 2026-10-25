#!/usr/bin/env node
// MIT. Capture/compare evidence; no agent execution, installation or publication.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  captureProjectState,
  compareProjectState,
} from "./lib/project-preservation.mjs";
const [command, project, receipt, ...extra] = process.argv.slice(2);
const ownerFiles = [];
while (extra.length) {
  if (extra.shift() !== "--owner-file" || !extra.length)
    throw Error("Use --owner-file <exact-relative-path>.");
  ownerFiles.push(extra.shift());
}
if (!["capture", "compare"].includes(command) || !project || !receipt)
  throw Error(
    "Usage: node scripts/project-preservation.mjs capture|compare <project-root> <receipt.json> [--owner-file <relative-path>]",
  );
if (command === "capture") {
  const result = captureProjectState(project, ownerFiles);
  writeFileSync(resolve(receipt), JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      captured: Object.keys(result.files).length,
      source: result.source,
      coverage: result.coverage,
    }),
  );
} else {
  const before = JSON.parse(readFileSync(resolve(receipt), "utf8"));
  // Validate the receipt before using its selected path list.
  compareProjectState(before, before);
  if (ownerFiles.length)
    throw Error(
      "Compare uses the owner-file selection from the captured receipt.",
    );
  const result = compareProjectState(
    before,
    captureProjectState(project, before.ownerFiles),
  );
  console.log(JSON.stringify(result));
  if (!result.unchanged) process.exitCode = 1;
}

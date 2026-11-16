#!/usr/bin/env node
// Validate the Studio job-receipt evidence that /benchmarks/comparisons renders.
// Offline by default: it reads the committed file and the committed studio-media
// inventory, then checks that the aggregates still add up and that no private
// record, undated row or mixed inventory slipped into the data. It never calls
// D1, a provider or the Studio, and it never rewrites the evidence it checks.
//
//   node scripts/studio-job-evidence.mjs            # check (same as --check)
//   node scripts/studio-job-evidence.mjs --check    # fail on invalid evidence
//   node scripts/studio-job-evidence.mjs --json     # machine-readable summary
//   node scripts/studio-job-evidence.mjs --sql      # print the exact queries
//
// Refreshing the numbers is a reviewed read, not a write: run the printed SQL
// against the production Studio D1 with read-only access, update the aggregates,
// set checkedAt, and run this check again.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateJobEvidence } from "../src/lib/studio-job-evidence.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const evidencePath = "benchmarks/comparisons/studio-job-receipts.json";
const inventoryPath = "benchmarks/inventory/studio-media.json";

function readJson(relative) {
  return JSON.parse(readFileSync(resolve(root, relative), "utf8"));
}

function fail(message) {
  console.error(`studio-job-evidence: ${message}`);
  process.exit(1);
}

let file;
let inventory;
try {
  file = readJson(evidencePath);
} catch (error) {
  fail(`${evidencePath} could not be read: ${error instanceof Error ? error.message : String(error)}`);
}
try {
  inventory = readJson(inventoryPath);
} catch (error) {
  fail(`${inventoryPath} could not be read: ${error instanceof Error ? error.message : String(error)}`);
}

if (process.argv.includes("--sql")) {
  console.log(`# ${file?.source?.command ?? "command not recorded"}`);
  console.log(file?.source?.sql ?? "# aggregate SQL is missing");
  console.log(`\n# ${file?.source?.examplesCommand ?? "command not recorded"}`);
  console.log(file?.source?.examplesSql ?? "# examples SQL is missing");
  process.exit(0);
}

const result = validateJobEvidence(file, {
  now: Date.now(),
  inventoryEntries: inventory?.entries,
});

const summary = result.summary;
const payload = {
  ok: result.ok,
  issues: result.issues,
  id: summary?.id ?? "unknown",
  inventory: summary?.inventory ?? "unknown",
  checkedAt: summary?.checkedAt ?? null,
  ageDays: summary?.ageDays ?? null,
  stale: summary?.stale ?? null,
  totals: summary?.totals ?? null,
  groups: (summary?.groups ?? []).map((group) => ({
    model: group.model,
    kind: group.kind,
    inventoryEntry: group.inventoryEntry ?? null,
    jobs: group.jobs,
    saved: group.saved,
    failed: group.failed,
    unknown: group.unknown,
    savedRate: group.savedRate,
    medianMs: group.savedLatencyMs?.median ?? null,
    p90Ms: group.savedLatencyMs?.p90 ?? null,
    costEstimateMicroSum: group.costEstimateMicro?.sum ?? null,
  })),
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const totals = payload.totals ?? {};
  const rate = typeof totals.savedRate === "number" ? `${(totals.savedRate * 100).toFixed(1)}%` : "unknown";
  const age = payload.ageDays === null ? "undated" : `${payload.ageDays}d old`;
  console.log(
    `${result.ok ? "ok  " : "FAIL"} ${payload.id.padEnd(20)} ${totals.jobs ?? "?"} jobs · ${totals.saved ?? "?"} saved (${rate}) · ${payload.groups.length} models · checked ${payload.checkedAt ?? "unknown"} (${age})${payload.stale ? " · STALE" : ""}`,
  );
  for (const group of payload.groups) {
    const latency =
      group.medianMs === null ? "no saved latency" : `median ${Math.round(group.medianMs)}ms · p90 ${Math.round(group.p90Ms)}ms`;
    const cost = typeof group.costEstimateMicroSum === "number" ? `US$${(group.costEstimateMicroSum / 1_000_000).toFixed(4)}` : "cost unknown";
    console.log(
      `     ${group.model.padEnd(20)} ${String(group.kind).padEnd(6)} ${String(group.jobs).padStart(3)} jobs · ${String(group.saved).padStart(3)} saved · ${latency} · ${cost}`,
    );
  }
  for (const issue of result.issues) console.log(`     ${issue.code}: ${issue.detail}`);
  console.log(
    `${result.ok ? "ok  " : "FAIL"} ${evidencePath} · ${inventoryPath} · ${summary?.inventory ?? "unknown"} inventory only`,
  );
}

if (!result.ok) process.exit(1);

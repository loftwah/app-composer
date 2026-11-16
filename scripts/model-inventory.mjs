#!/usr/bin/env node
// Validate the three Benchmarks Studio inventories committed in
// benchmarks/inventory/. Offline by default: it reads the committed files, the
// pinned run they point at, and the pending decision queue. It never calls a
// provider, spends money or rewrites a recorded run.
//
//   node scripts/model-inventory.mjs            # check (same as --check)
//   node scripts/model-inventory.mjs --check    # fail on an invalid inventory
//   node scripts/model-inventory.mjs --json     # machine-readable summary
//
// Refreshing an inventory is a separate, reviewed act: read the source again,
// edit the data file, and record the difference in its changes list. There is
// deliberately no --write here, because a validator that rewrites the evidence
// it just checked can always agree with itself.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INVENTORY_IDS,
  validateInventories,
} from "../src/lib/model-inventory.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function readJson(relative) {
  return JSON.parse(readFileSync(resolve(root, relative), "utf8"));
}

function fail(message) {
  console.error(`model-inventory: ${message}`);
  process.exit(1);
}

const files = INVENTORY_IDS.map((id) => {
  const path = `benchmarks/inventory/${id}.json`;
  try {
    return readJson(path);
  } catch (error) {
    fail(`${path} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
});

const now = Date.now();
const results = validateInventories(files, {
  now,
  exists: (path) => existsSync(resolve(root, path)),
});

let pending;
try {
  pending = readJson("benchmarks/inventory/pending.json");
} catch (error) {
  fail(`benchmarks/inventory/pending.json could not be read: ${error instanceof Error ? error.message : String(error)}`);
}

const problems = [];
if (pending?.schema !== "composer/inventory-decisions/1") problems.push("pending.json has the wrong schema");
if (!Array.isArray(pending?.decisions) || pending.decisions.length === 0) problems.push("pending.json has no queued decisions");
for (const decision of pending?.decisions ?? []) {
  if (typeof decision?.cost?.label !== "string" || !decision.cost.label)
    problems.push(`decision ${decision?.id ?? "unknown"} needs a cost label`);
  if (decision?.status !== "queued") problems.push(`decision ${decision?.id ?? "unknown"} must stay queued here`);
}

const summaries = results.map((result) => ({
  id: result.id,
  ok: result.ok,
  issues: result.issues,
  counts: result.summary?.counts ?? null,
  checkedAt: result.summary?.checkedAt ?? null,
  stale: result.summary?.stale ?? null,
  ageDays: result.summary?.ageDays ?? null,
  changes: result.summary?.changes ?? null,
}));

const failed = results.some((result) => !result.ok) || problems.length > 0;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: !failed, inventories: summaries, pendingProblems: problems, pending: pending.decisions?.length ?? 0 }, null, 2));
} else {
  for (const summary of summaries) {
    const counts = summary.counts
      ? Object.entries(summary.counts)
          .filter(([, count]) => count > 0)
          .map(([status, count]) => `${count} ${status}`)
          .join(", ")
      : "unreadable";
    const age = summary.ageDays === null ? "undated" : `${summary.ageDays}d old`;
    console.log(`${summary.ok ? "ok  " : "FAIL"} ${summary.id.padEnd(17)} ${counts} · checked ${summary.checkedAt ?? "unknown"} (${age})${summary.stale ? " · STALE" : ""}`);
    for (const issue of summary.issues) console.log(`       ${issue.code}: ${issue.detail}`);
  }
  console.log(`${failed ? "FAIL" : "ok  "} benchmarks/inventory/pending.json · ${pending.decisions?.length ?? 0} queued decision(s), none run`);
  for (const problem of problems) console.log(`       pending: ${problem}`);
}

if (failed) process.exit(1);

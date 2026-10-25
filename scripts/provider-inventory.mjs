#!/usr/bin/env node
// Read-only Cloudflare inventory for App Composer.
//
// Usage:
//   node scripts/provider-inventory.mjs plan
//   node scripts/provider-inventory.mjs snapshot [--out DIR]
//   node scripts/provider-inventory.mjs compare [--snapshot FILE] [--out DIR]
//   node scripts/provider-inventory.mjs report [--snapshot FILE]
//
// Every provider request is a GET from the adapter's allowlist. Nothing is
// created, changed, tagged, deployed or deleted. Snapshots are written only
// under this repository's ignored output/ directory, with provider error text
// redacted. The token is read from CLOUDFLARE_API_TOKEN and never printed.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_PAGES,
  DEFAULT_MAX_REQUESTS,
  DEFAULT_PER_PAGE,
  DEFAULT_TIMEOUT_MS,
  allowedProviderPath,
  readProviderInventory,
  redactProviderText,
} from "../src/lib/provider-inventory.mjs";
import {
  EXPECTED_ACCOUNT,
  expectedProviderInventory,
} from "../src/lib/provider-expected.ts";
import { buildProviderCheck } from "../src/lib/provider-inventory-check.ts";
import { providerCheck } from "../src/lib/provider-inventory-contract.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const command = process.argv[2];
const args = process.argv.slice(3);
const supported = new Set(["plan", "snapshot", "compare", "report"]);
if (!supported.has(command)) {
  console.error(
    "Use plan, snapshot, compare or report. All commands are read-only.",
  );
  process.exit(2);
}
const value = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
};
if (
  args.some(
    (arg) => arg.startsWith("--") && arg !== "--strict" && arg !== "--json",
  )
) {
  const allowed = new Set([
    "--out",
    "--snapshot",
    "--revision",
    "--strict",
    "--json",
  ]);
  for (const arg of args)
    if (arg.startsWith("--") && !allowed.has(arg))
      throw Error("Unsupported option: " + arg);
}
const strict = args.includes("--strict");
const jsonOutput = args.includes("--json");

const wrangler = JSON.parse(
  readFileSync(resolve(root, "wrangler.jsonc"), "utf8"),
);
if (wrangler.account_id !== EXPECTED_ACCOUNT)
  throw Error("wrangler.jsonc account differs from the recorded expectation.");
const revision =
  value("--revision") ??
  (() => {
    try {
      return execFileSync("git", ["rev-parse", "origin/main"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
    } catch {
      return execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
    }
  })();
const expected = expectedProviderInventory({ revision });

function outputDirectory() {
  const selected = resolve(root, value("--out") ?? "output/provider-inventory");
  const allowedRoot = resolve(root, "output") + sep;
  if (!selected.startsWith(allowedRoot))
    throw Error(
      "Provider snapshots may be written only under the ignored output/ directory.",
    );
  mkdirSync(selected, { recursive: true });
  return selected;
}

function stamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function writeJson(name, body) {
  const directory = outputDirectory();
  const path = resolve(directory, name);
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n");
  return path;
}

function summaryMarkdown(check, snapshot) {
  const lines = [
    "# App Composer Cloudflare check",
    "",
    "Local operator snapshot with the existing deployment credential; not a Worker-side read, not a new grant, no writes.",
    "",
    "- Observed: " +
      (check.observation?.utc ?? "not observed") +
      (check.observation ? " (" + check.observation.melbourne + ")" : ""),
    "- Account: " + check.account,
    "- State: " + check.state,
    "- Expected source revision: " +
      (check.expectedRevision ?? "not specified"),
    "- Scope: " + snapshot.scope + " resources only",
    "- Unrelated account resources excluded: " + snapshot.unrelatedResources,
    "- Expected: " + check.counts.expected,
    "- Observed: " + check.counts.observed,
    "- Match: " + check.counts.match,
    "- Drift: " + check.counts.drift,
    "- Missing: " + check.counts.missing,
    "- Unverified: " + check.counts.unverified,
    "- Inaccessible: " + check.counts.inaccessible,
    "- Undeclared Worker scripts: " + check.counts.untracked,
    "- Needs attention: " + check.counts.attention,
    "",
    "## Findings",
    "",
  ];
  for (const finding of check.findings)
    lines.push(
      "### " + finding.severity.toUpperCase() + " · " + finding.title,
      "",
      finding.detail,
      "",
    );
  lines.push(
    "## Expected and observed",
    "",
    "| State | Kind | Resource | Detail |",
    "| --- | --- | --- | --- |",
  );
  for (const item of check.comparisons)
    lines.push(
      "| " +
        item.state +
        " | " +
        item.kind +
        " | `" +
        item.name +
        "` | " +
        item.detail.replace(/\|/g, "\\|") +
        " |",
    );
  lines.push("", "## Endpoints", "");
  const endpointStates = check.endpoints.reduce((counts, endpoint) => {
    counts[endpoint.state] = (counts[endpoint.state] ?? 0) + 1;
    return counts;
  }, {});
  for (const [state, count] of Object.entries(endpointStates))
    lines.push("- " + state + ": " + count);
  lines.push("", "## Limitations", "");
  for (const limitation of check.limitations) lines.push("- " + limitation);
  lines.push(
    "",
    "## Cost and authority",
    "",
    check.cost.note,
    "",
    "Read-only: every request was a GET from the allowlist. Nothing was created, changed, tagged, deployed or deleted. Tags and names are not ownership, access or billing authority.",
    "",
  );
  return lines.join("\n");
}

function writeMarkdown(name, text) {
  const directory = outputDirectory();
  const path = resolve(directory, name);
  writeFileSync(path, text);
  return path;
}

function readSnapshot(path) {
  const body = JSON.parse(readFileSync(resolve(root, path), "utf8"));
  if (
    !body ||
    typeof body !== "object" ||
    body.version !== "composer.provider-inventory/1" ||
    body.readOnly !== true ||
    body.scope !== "composer" ||
    typeof body.unrelatedResources !== "number" ||
    body.account !== EXPECTED_ACCOUNT ||
    !Array.isArray(body.resources) ||
    body.resources.length > 400 ||
    !Array.isArray(body.endpoints) ||
    body.endpoints.length > 100
  )
    throw Error(
      "The snapshot is not a bounded, redacted Composer provider observation.",
    );
  return body;
}

function requireToken() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token?.trim())
    throw Error(
      "Set CLOUDFLARE_API_TOKEN to a read-only account credential. The token is never printed or saved.",
    );
  if (
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_ACCOUNT_ID !== EXPECTED_ACCOUNT
  )
    throw Error(
      "CLOUDFLARE_ACCOUNT_ID differs from Composer's recorded account.",
    );
  return token.trim();
}

async function observe() {
  const token = requireToken();
  const snapshot = await readProviderInventory({
    token,
    account: EXPECTED_ACCOUNT,
    workerHints: expected.workerHints,
    databaseHints: expected.databaseHints,
    workerNames: expected.workerNames,
    databaseIds: expected.databaseIds,
    settingsFor: expected.settingsFor,
    schedulesFor: expected.schedulesFor,
  });
  return snapshot;
}

function printPlan() {
  const endpoints = [
    "/accounts/{account}/workers/scripts?per_page=50&page=1…".replace(
      "{account}",
      EXPECTED_ACCOUNT,
    ),
    "/accounts/{account}/workers/domains".replace(
      "{account}",
      EXPECTED_ACCOUNT,
    ),
    "/accounts/{account}/d1/database?per_page=50&page=1".replace(
      "{account}",
      EXPECTED_ACCOUNT,
    ),
    "/accounts/{account}/r2/buckets".replace("{account}", EXPECTED_ACCOUNT),
    "/accounts/{account}/storage/kv/namespaces?per_page=50&page=1".replace(
      "{account}",
      EXPECTED_ACCOUNT,
    ),
    "Per-Worker GET /tags, /deployments?per_page=1, /settings and /schedules for up to 12 declared Workers.",
    "Per-database GET /d1/database/{id} for the two declared databases.",
  ];
  for (const endpoint of endpoints)
    if (endpoint.startsWith("/accounts/")) {
      const path = endpoint.split("?")[0];
      if (!allowedProviderPath(path))
        throw Error("The plan contains a path outside the read allowlist.");
    }
  console.log("# App Composer provider inventory plan");
  console.log("Account: " + EXPECTED_ACCOUNT);
  console.log("Read-only: yes. Every request is a GET from the allowlist.");
  console.log(
    "Scope: Composer-owned app-composer/composer-* resources only; unrelated account resources are counted but excluded.",
  );
  console.log(
    `Bounds: ${DEFAULT_MAX_PAGES} pages × ${DEFAULT_PER_PAGE} rows, ${DEFAULT_MAX_REQUESTS} requests, ${DEFAULT_TIMEOUT_MS} ms per request.`,
  );
  console.log("Expected resources: " + expected.resources.length);
  console.log("Worker detail names: " + expected.workerNames.join(", "));
  console.log("D1 detail ids: " + expected.databaseIds.join(", "));
  console.log("No network request was made by this plan.");
  console.log("\nEndpoints:");
  for (const endpoint of endpoints) console.log("  " + endpoint);
}

async function main() {
  if (command === "plan") {
    printPlan();
    return;
  }
  const snapshotPath = value("--snapshot")
    ? readSnapshot(value("--snapshot"))
    : await observe();
  if (command === "snapshot") {
    const path = writeJson(stamp() + "-snapshot.json", snapshotPath);
    console.log(
      [
        "Provider snapshot written to " + path,
        "State: " + snapshotPath.state,
        "Observed: " +
          snapshotPath.observation.utc +
          " (" +
          snapshotPath.observation.melbourne +
          ")",
        "Resources: " + snapshotPath.resources.length,
        "Unrelated account resources excluded: " +
          snapshotPath.unrelatedResources,
        "Endpoints: " + snapshotPath.endpoints.length,
        "Redactions: " + snapshotPath.redactions,
        "Cost: unknown (never zero).",
      ].join("\n"),
    );
    return;
  }
  const check = providerCheck.parse(
    buildProviderCheck({
      expected,
      snapshot: snapshotPath,
      source: "local-cli",
      now: Date.now(),
      revision,
    }),
  );
  if (command === "report" || command === "compare") {
    if (jsonOutput) {
      console.log(JSON.stringify(check, null, 2));
    } else {
      console.log("# App Composer Cloudflare check");
      console.log(
        "Observed: " +
          (check.observation?.utc ?? "not observed") +
          (check.observation ? " (" + check.observation.melbourne + ")" : ""),
      );
      console.log("Account: " + check.account);
      console.log("State: " + check.state);
      console.log(
        "Summary: " +
          [
            check.counts.expected + " expected",
            check.counts.observed + " observed",
            check.counts.match + " match",
            check.counts.drift + " drift",
            check.counts.missing + " missing",
            check.counts.unverified + " unverified",
            check.counts.inaccessible + " inaccessible",
            check.counts.untracked + " undeclared Worker script(s)",
          ].join(" · "),
      );
      console.log("\n## Expected and observed");
      for (const item of check.comparisons)
        console.log(
          [
            item.state.toUpperCase().padEnd(12),
            item.kind.padEnd(7),
            item.name,
            item.detail,
          ].join(" "),
        );
      console.log("\n## Findings");
      for (const finding of check.findings)
        console.log(
          [finding.severity.toUpperCase(), finding.title, finding.detail].join(
            " · ",
          ),
        );
      console.log("\n## Endpoints");
      for (const endpoint of check.endpoints)
        console.log(
          `GET ${endpoint.path} · ${endpoint.state}` +
            (endpoint.status ? ` (${endpoint.status})` : ""),
        );
      console.log("\n## Limitations");
      for (const limitation of check.limitations)
        console.log("- " + limitation);
      console.log("\nCost: " + check.cost.note);
      console.log(
        "Read-only: nothing was created, changed, tagged or deleted.",
      );
    }
    const generated = stamp();
    const path = writeJson(generated + "-compare.json", check);
    const summaryPath = writeMarkdown(
      generated + "-summary.md",
      summaryMarkdown(check, snapshotPath),
    );
    console.error("Wrote " + path + " and " + summaryPath + " (gitignored).");
  }
  if (strict && check.counts.attention > 0) process.exitCode = 2;
}

main().catch((error) => {
  const message = redactProviderText(
    error instanceof Error ? error.message : String(error),
    400,
  );
  console.error("Provider inventory failed: " + message);
  process.exitCode = 1;
});

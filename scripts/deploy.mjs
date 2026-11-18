import { assertReleasePackage } from "./package-get-ready.mjs";
import { assertMcpReleasePackage } from "./package-get-ready-mcp.mjs";
import {
  createGitHubAdapter,
  createReleaseRun,
  COMPOSER_LIMIT_MS,
} from "../lib/delivery/release-timing.mjs";
import { verifyLive } from "./verify-live.mjs";
import { auditPublication } from "./audit-publication.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { query } from "./records.mjs";
import { assertReceiptCounterSchema } from "../lib/usage/schema.mjs";
import { execFileSync } from "node:child_process";
import { isSupportedNode } from "../lib/get-ready/local-checks.mjs";
import {
  assertProductionEnvironment,
  assertProductionTarget,
  assertFreshPushedMain,
  parseAdminSecrets,
  snapshotAdminSecrets,
  readEmdashEncryptionSecrets,
  combineDeploymentSecrets,
  assertEmptyPluginStoresForFreshKey,
} from "./deployment-target.mjs";
assertProductionEnvironment(process.env);
const extra = process.argv.slice(2);
if (
  extra.some((arg) => !["--miniapp-secrets", "--emdash-key"].includes(arg)) ||
  new Set(extra).size !== extra.length
)
  throw new Error("Unsupported deploy option");
const connecting = extra.includes("--miniapp-secrets");
const replacingEmdashKey = extra.includes("--emdash-key");
const validatedAdminSecrets = connecting
  ? parseAdminSecrets(
      readFileSync(".private/miniapp-admin-secrets.json", "utf8"),
    )
  : null;
const validatedEmdashSecrets = replacingEmdashKey
  ? readEmdashEncryptionSecrets(process.cwd())
  : null;
const validatedSecrets = combineDeploymentSecrets(
  validatedAdminSecrets,
  validatedEmdashSecrets,
);
const run = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
// Fail early when a global shim selected a different Node line.
function assertSelectedRuntime() {
  if (!isSupportedNode(process.versions.node)) {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    throw new Error(
      `Node ${process.versions.node} is outside the release toolchain ${manifest.engines.node}. Select the .node-version default (or .mise.toml) before rebuilding; no remote action was taken.`,
    );
  }
  const pnpm = /(?:^|\s)pnpm\/(\d+\.\d+\.\d+)/.exec(
    process.env.npm_config_user_agent ?? "",
  )?.[1];
  console.log(
    `Release runtime: Node ${process.versions.node}${pnpm ? `, pnpm ${pnpm}` : ""}`,
  );
}
assertSelectedRuntime();
if (run(["status", "--porcelain"]))
  throw new Error("Commit the reviewed source before deploying");
const sha = run(["rev-parse", "HEAD"]);
const guard = () => {
  if (
    run(["branch", "--show-current"]) !== "main" ||
    run(["rev-parse", "HEAD"]) !== sha ||
    run(["rev-parse", "origin/main"]) !== sha ||
    run(["status", "--porcelain"])
  )
    throw new Error("Production requires clean pushed reviewed main.");
  let remote;
  try {
    remote = run(["ls-remote", "--exit-code", "origin", "refs/heads/main"]);
  } catch {
    throw Error(
      "Current remote main could not be verified. No new remote action was authorised.",
    );
  }
  assertFreshPushedMain(sha, remote);
};
guard();
const cfg = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const lock = JSON.parse(readFileSync("composition.lock.json", "utf8"));
assertProductionTarget(cfg, cfg, lock);
let github = null;
try {
  github = createGitHubAdapter({ repo: "loftwah/app-composer" });
} catch (error) {
  console.error(
    "Delivery SLA alert reporting is unavailable; a redacted pending event will be queued. " +
      error.message,
  );
}
const releaseRun = createReleaseRun({
  repo: "loftwah/app-composer",
  project: "app-composer",
  sha,
  releasePath: "scripts/deploy.mjs",
  kind: "worker-production",
  receiptDir: ".release/timing",
  firstEditAt: process.env.COMPOSER_FIRST_EDIT_AT,
  targetMs: COMPOSER_LIMIT_MS,
  limitMs: COMPOSER_LIMIT_MS,
  github,
});
// Use the same pnpm and Node selected by the release launcher.
const pnpmCommand = () => {
  const execpath = process.env.npm_execpath;
  if (!execpath) return ["pnpm", []];
  if (/\.(?:c|m)?js$/.test(execpath)) return [process.execPath, [execpath]];
  return [execpath, []];
};
const runPnpm = (args) => {
  const [file, prefix] = pnpmCommand();
  return execFileSync(file, [...prefix, ...args], { stdio: "inherit" });
};
const stage = async (name, work) => {
  const started = performance.now();
  const result = await releaseRun.stage(name, work);
  const durationMs = performance.now() - started;
  console.log(
    "Release gate passed: " +
      name +
      " (" +
      (durationMs / 1000).toFixed(1) +
      "s)",
  );
  return result;
};
try {
await stage("dependency audit", () =>
  runPnpm(["run", "audit"]),
);
await stage("production build", () => runPnpm(["build"]));
assertReleasePackage(
  JSON.parse(readFileSync("public/downloads/get-ready-core.json", "utf8")),
  readFileSync("public/downloads/get-ready-core.tgz"),
  sha,
);
assertMcpReleasePackage(
  JSON.parse(readFileSync("public/downloads/get-ready-mcp.json", "utf8")),
  readFileSync("public/downloads/get-ready-mcp.tgz"),
  sha,
);
const pointer = resolve(".wrangler/deploy/config.json");
const generatedPath = resolve(
  dirname(pointer),
  JSON.parse(readFileSync(pointer, "utf8")).configPath,
);
if (generatedPath !== resolve("dist/server/wrangler.json"))
  throw Error("Unexpected generated deployment configuration path.");
assertProductionTarget(
  cfg,
  JSON.parse(readFileSync(generatedPath, "utf8")),
  lock,
);
// Another independent Composer release can advance main while local checks and build run.
// origin/main is a cache; re-read the provider before migrations and upload.
guard();
// The workspace schema ships with the Worker. Applying recorded migrations here is
// idempotent and prevents a release serving a page whose tables do not exist yet.
await stage("remote D1 migrations", () =>
  execFileSync(
    "pnpm",
    [
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "app-composer-emdash",
      "--remote",
    ],
    { stdio: "inherit" },
  ),
);
const usageSchema = await query(
  "SELECT sql FROM sqlite_schema WHERE type='table' AND name='composer_usage'",
);
assertReceiptCounterSchema(usageSchema[0]?.results?.[0]?.sql);
console.log("Release gate passed: receipt counter schema");
guard();
// This read-only inspection runs after all local checks/builds, directly before
// the existing code+secret upload. Any current plugin data refuses replacement.
if (replacingEmdashKey) {
  await stage("empty plugin stores before initial key recovery", () =>
    assertEmptyPluginStoresForFreshKey(query),
  );
  guard();
}
const snapshot = validatedSecrets
  ? snapshotAdminSecrets(validatedSecrets, process.cwd())
  : null;
await stage("Worker upload", () => {
  try {
    if (snapshot) {
      try {
        execFileSync(
          "pnpm",
          [
            "wrangler",
            "deploy",
            "--message",
            "App Composer " + sha,
            "--secrets-file",
            snapshot.path,
          ],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
      } catch {
        throw Error(
          "The secret-bearing Worker upload could not be confirmed. Inspect deployment identity before retrying; private CLI output was suppressed.",
        );
      }
    } else
      execFileSync(
        "pnpm",
        ["wrangler", "deploy", "--message", "App Composer " + sha],
        { stdio: "inherit" },
      );
  } finally {
    snapshot?.remove();
  }
});
await stage("live source and pinned services", () => verifyLive(sha, lock));
const publication = await stage("live publication privacy", () =>
  auditPublication("https://composer.loftwah.com", {
    downloads: [
      "/downloads/get-ready-core.tgz",
      "/downloads/get-ready-mcp.tgz",
      "/downloads/cloudflare-extension.zip",
    ],
  }),
);
console.log(JSON.stringify(publication));
if (!publication.ok)
  throw Error("Live publication privacy verification failed.");
await stage("anonymous administration boundary", async () => {
  for (const path of [
    "/_emdash/admin/setup",
    "/_emdash/api/users",
    "/_emdash/api/setup/status",
    "/_emdash/api/plugins/composer-miniapps/read?app=guestbook&action=snapshot",
  ]) {
    const res = await fetch("https://composer.loftwah.com" + path, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (AppComposer verification)" },
    });
    const location = res.headers.get("location"),
      redirect = location
        ? new URL(location, "https://composer.loftwah.com")
        : null;
    const accessLogin =
      [302, 303].includes(res.status) &&
      redirect?.hostname === cfg.vars.CF_ACCESS_TEAM_DOMAIN &&
      redirect.pathname.startsWith("/cdn-cgi/access/login");
    if (res.status !== 403 && !accessLogin)
      throw new Error(
        "Unauthenticated administration boundary failed: " + path,
      );
  }
});
await stage("release record", async () => {
  await query(
    "UPDATE composer_releases SET state='superseded' WHERE state='active' AND id!=?",
    [lock.id],
  );
  await query("UPDATE composer_releases SET state='active' WHERE id=?", [
    lock.id,
  ]);
});
console.log("Verified exact live Composer source " + sha);
const receipt = await releaseRun.finish({
  status: "passed",
  target: "https://composer.loftwah.com",
  liveRevision: sha,
});
console.log(
  "Release " +
    receipt.status +
    ": " +
    (receipt.totalMs / 1000).toFixed(1) +
    "s (target " +
    (receipt.targetMs / 1000).toFixed(0) +
    "s, limit " +
    (receipt.limitMs / 1000).toFixed(0) +
    "s)",
);
if (receipt.status === "over-budget") {
  const slowest = receipt.stages.reduce((a, b) =>
    b.durationMs > a.durationMs ? b : a,
  );
  console.log(
    "Delivery SLA breach recorded; slowest stage was " +
      slowest.name +
      " (" +
      (slowest.durationMs / 1000).toFixed(1) +
      "s). Alert state: " +
      receipt.alert.state +
      (receipt.alert.issue ? " issue #" + receipt.alert.issue : "") +
      ".",
  );
}
} catch (error) {
  await releaseRun.fail(error);
  throw error;
}

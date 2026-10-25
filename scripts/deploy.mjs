import { assertReleasePackage } from "./package-get-ready.mjs";
import { assertMcpReleasePackage } from "./package-get-ready-mcp.mjs";
import { verifyLive } from "./verify-live.mjs";
import { verifySharing } from "./verify-sharing.mjs";
import { auditPublication } from "./audit-publication.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { query } from "./records.mjs";
import { assertReceiptCounterSchema } from "../lib/usage/schema.mjs";
import { execFileSync } from "node:child_process";
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
const stage = async (name, work) => {
  const started = Date.now();
  const result = await work();
  console.log(
    "Release gate passed: " +
      name +
      " (" +
      ((Date.now() - started) / 1000).toFixed(1) +
      "s)",
  );
  return result;
};
await stage("dependency audit", () =>
  execFileSync("pnpm", ["run", "audit"], { stdio: "inherit" }),
);
// Required local checks run before any remote mutation, so a failing gate cannot
// apply migrations first. This is the only full `pnpm check` invocation in a
// release; the delivery journey delegates here rather than repeating it.
await stage("required checks (pnpm check)", () =>
  execFileSync("pnpm", ["check"], { stdio: "inherit" }),
);
// Another independent Composer release can advance main while checks run.
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
await stage("production build", () =>
  execFileSync("pnpm", ["build"], { stdio: "inherit" }),
);
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
await stage("live sharing output", () =>
  verifySharing("https://composer.loftwah.com"),
);
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

// Builds one isolated, clearly fictional copy of this checkout for the native
// admin journey evidence. It never reads owner data, never deploys and never
// touches production. The copy lives under one explicit temporary root and is
// removed by `--clean` or by the operator's own cleanup step.
//
// Usage (node 22.23.4 or newer is required by Astro):
//   node docs/evidence/admin-journey-20261025/prepare-fixture.mjs \
//     --source "$PWD" \
//     --root /private/var/folders/.../opencode/lane-a-20261025 \
//     --origin http://localhost:4337
//
// The fixture seams are deliberately narrow and recorded in fixture.json:
//   1. the Cloudflare Access wrapper is replaced by EmDash's own passkey auth
//      (the production entry is never used here);
//   2. the site origin, PUBLIC_ORIGIN and the overview read guard point at the
//      local fixture origin;
//   3. provider service bindings, routes and cron triggers are removed so no
//      request can leave the machine.
// Nothing in this file is a product change and no seam is written back to the
// source checkout.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const index = process.argv.indexOf("--" + name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const source = resolve(arg("source", resolve(here, "../../..")));
const root = resolve(arg("root", ""));
const origin = arg("origin", "http://localhost:4337");
const app = join(root, "app");
const hash = (value) => createHash("sha256").update(value).digest("hex");

if (!arg("root"))
  throw Error("Pass --root with one explicitly owned temporary directory.");
const guard = join(root, "OWNED.md");
if (!root.includes("/opencode/") || root.startsWith(source + "/"))
  throw Error("The fixture root must be an owned directory outside the checkout.");
mkdirSync(root, { recursive: true });
writeFileSync(
  guard,
  "Owned by docs/evidence/admin-journey-20261025/prepare-fixture.mjs\n",
);

if (process.argv.includes("--clean")) {
  if (existsSync(app))
    spawnSync(
      process.execPath,
      [join(app, "node_modules/astro/bin/astro.mjs"), "dev", "stop"],
      { cwd: app, stdio: "ignore", env: process.env },
    );
  rmSync(app, { recursive: true, force: true });
  rmSync(guard, { recursive: true, force: true });
  console.log(JSON.stringify({ cleaned: true, root }));
  process.exit(0);
}

if (!existsSync(join(source, "package.json")))
  throw Error("--source must be this checkout.");
if (existsSync(join(app, "node_modules/astro/bin/astro.mjs")))
  spawnSync(
    process.execPath,
    [join(app, "node_modules/astro/bin/astro.mjs"), "dev", "stop"],
    { cwd: app, stdio: "ignore", env: process.env },
  );
for (let attempt = 0; attempt < 10; attempt++) {
  try {
    rmSync(app, { recursive: true, force: true });
    break;
  } catch (error) {
    if (attempt === 9) throw error;
    await new Promise((yes) => setTimeout(yes, 300));
  }
}
// APFS clone keeps the fixture cheap; the fallback is a plain copy.
try {
  execFileSync("cp", ["-cR", source, app], { stdio: "ignore" });
} catch {
  execFileSync("cp", ["-R", source, app], { stdio: "ignore" });
}
rmSync(join(app, ".git"), { recursive: true, force: true });
rmSync(join(app, ".wrangler"), { recursive: true, force: true });
rmSync(join(app, "dist"), { recursive: true, force: true });
rmSync(join(app, "output"), { recursive: true, force: true });

const seams = {};
function patch(file, before, after, note) {
  const full = join(app, file);
  const original = readFileSync(full, "utf8");
  const pattern =
    before instanceof RegExp
      ? before
      : new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if ((original.match(pattern) ?? []).length !== 1)
    throw Error("Reviewed seam changed in " + file + "; re-read it before running.");
  writeFileSync(full, original.replace(pattern, after));
  seams[file + " :: " + note] = {
    note,
    seam: before instanceof RegExp ? before.source : before,
  };
}

patch(
  "astro.config.mjs",
  /,auth:access\(\{[^}]*\}\)/,
  "",
  "Cloudflare Access auth removed; EmDash native passkey auth used instead.",
);
patch(
  "astro.config.mjs",
  "siteUrl:'https://composer.loftwah.com'",
  "siteUrl:'" + origin + "'",
  "Fixture site origin; WebAuthn relying party must match the local host.",
);
patch(
  "src/lib/overview.ts",
  'const origin = "https://composer.loftwah.com";',
  'const origin = "' + origin + '";',
  "Fixture origin guard for the read-only overview; the production guard is unchanged in source.",
);

writeFileSync(
  join(app, "lab-entry.ts"),
  "// Isolated local fixture only: supported native EmDash auth, the production\n" +
    "// Cloudflare Access wrapper and every provider binding are absent.\n" +
    "import handler, { PluginBridge } from '@emdash-cms/cloudflare/worker';\n" +
    "export { PluginBridge };\n" +
    "export default handler;\n",
);
const wrangler = JSON.parse(readFileSync(join(app, "wrangler.jsonc"), "utf8"));
wrangler.name = "composer-admin-journey-fixture";
wrangler.main = "./lab-entry.ts";
wrangler.routes = [];
wrangler.workers_dev = false;
wrangler.preview_urls = false;
delete wrangler.services;
delete wrangler.triggers;
delete wrangler.env;
wrangler.vars = {
  PUBLIC_ORIGIN: origin,
  RESOURCE_ACCOUNT_ID: "fictional-lane-a-account",
  RESOURCE_ENVIRONMENT: "production",
};
writeFileSync(join(app, "wrangler.jsonc"), JSON.stringify(wrangler, null, 2) + "\n");
seams.wrangler = {
  note: "Local D1/R2 only; no routes, cron or provider service bindings.",
  vars: wrangler.vars,
};

const port = new URL(origin).port || "80";
const free = await new Promise((yes) => {
  const probe = createServer();
  probe.once("error", () => yes(false));
  probe.listen(Number(port), "127.0.0.1", () =>
    probe.close(() => yes(true)),
  );
});
if (!free)
  throw Error(
    "Port " +
      port +
      " is already in use. Stop that server (astro dev stop) or pass another --origin.",
  );
const dev = spawn(
  process.execPath,
  [join(app, "node_modules/astro/bin/astro.mjs"), "dev", "--host", "127.0.0.1", "--port", port],
  { cwd: app, stdio: ["ignore", "pipe", "pipe"], env: process.env },
);
let devOutput = "";
for (const stream of [dev.stdout, dev.stderr])
  stream.on("data", (chunk) => (devOutput = (devOutput + chunk).slice(-8000)));

// The first request compiles the whole Astro app, so each attempt gets a real
// budget instead of cancelling the server's own work.
async function waitFor(url, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (response.status < 500) return response;
    } catch {}
    await new Promise((yes) => setTimeout(yes, 1000));
  }
  throw Error("The fixture server did not answer: " + devOutput.slice(-1200));
}
await waitFor(origin + "/");
await waitFor(origin + "/_emdash/api/auth/mode");
const entry = await waitFor(origin + "/");

const runner = (file, args) =>
  spawnSync(process.execPath, [join(app, file), ...args], {
    cwd: app,
    encoding: "utf8",
    env: process.env,
  });
const migrate = runner("node_modules/wrangler/bin/wrangler.js", [
  "d1",
  "migrations",
  "apply",
  "DB",
  "--local",
  "--config",
  "wrangler.jsonc",
]);
if (migrate.status !== 0)
  throw Error("Local D1 migrations failed: " + (migrate.stderr || migrate.stdout).slice(-1500));

const databases = readdirSync(
  join(app, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"),
)
  .filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite")
  .map((file) =>
    join(app, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject", file),
  );
if (databases.length !== 1)
  throw Error("Expected exactly one local D1 database, found " + databases.length);

const git = (args) =>
  execFileSync("git", args, { cwd: source, encoding: "utf8" }).trim();
const fixture = {
  schema: "composer.admin-journey-fixture/1",
  preparedAt: new Date().toISOString(),
  warning:
    "FICTIONAL LOCAL FIXTURE. Not the owner's draft data, not production, not a deployment.",
  origin,
  app,
  database: databases[0],
  sourceCheckout: source,
  sourceRevision: git(["rev-parse", "HEAD"]),
  sourceDirty: git(["status", "--porcelain"]) !== "",
  renderedEntry: entry.status,
  authentication:
    "EmDash native passkey registration and sign-in with a virtual authenticator. Cloudflare Access is absent in this copy; this is never production proof.",
  seams,
};
writeFileSync(join(root, "fixture.json"), JSON.stringify(fixture, null, 2) + "\n");
dev.unref();
console.log(JSON.stringify(fixture, null, 2));

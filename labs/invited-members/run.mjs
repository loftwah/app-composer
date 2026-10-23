// All writes/processes belong to one temporary root. No production credentials,
// authentication changes, D1 writes, DNS changes or email delivery are used.
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  realpathSync,
  existsSync,
  rmSync,
  openSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:net";
import { createRequire } from "node:module";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [action, ...args] = process.argv.slice(2);
const options = Object.fromEntries(
  args.reduce((pairs, arg, i) => {
    if (arg.startsWith("--")) pairs.push([arg.slice(2), args[i + 1]]);
    return pairs;
  }, []),
);
const pointer = resolve(
  options.pointer ?? join(repo, "output/invited-members/local-root"),
);
const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
async function available(port) {
  await new Promise((yes, no) => {
    const s = createServer();
    s.once("error", no);
    s.listen(port, "127.0.0.1", () => s.close(yes));
  });
}
function readRun() {
  const root = readFileSync(pointer, "utf8").trim();
  const meta = JSON.parse(readFileSync(join(root, "run.json"), "utf8"));
  if (
    meta.schema !== "composer.invited-local/1" ||
    meta.root !== root ||
    !root.startsWith(join(tmpdir(), "composer-invited-"))
  )
    throw Error("Invalid owned lab marker");
  return meta;
}
function terminate(meta) {
  for (const p of meta.processes ?? []) {
    try {
      const start = run(
        "ps",
        ["-p", String(p.pid), "-o", "lstart="],
        repo,
      ).trim();
      if (start === p.started) process.kill(-p.pid, "SIGTERM");
    } catch {}
  }
}
if (action === "stop") {
  if (!existsSync(pointer)) {
    console.log("No owned lab is registered.");
    process.exit(0);
  }
  const meta = readRun();
  if (meta.cliSession === "invited-" + meta.root.split("-").at(-1)) {
    try {
      run(
        join(
          process.env.HOME,
          ".codex/skills/playwright/scripts/playwright_cli.sh",
        ),
        ["-s=" + meta.cliSession, "close"],
        meta.root,
      );
    } catch {}
  }
  terminate(meta);
  await new Promise((r) => setTimeout(r, 500));
  for (const p of meta.processes ?? []) {
    try {
      if (
        run("ps", ["-p", String(p.pid), "-o", "lstart="], repo).trim() ===
        p.started
      )
        process.kill(-p.pid, "SIGKILL");
    } catch {}
  }
  rmSync(meta.root, { recursive: true, force: true });
  rmSync(pointer, { force: true });
  console.log("Stopped owned lab and removed " + meta.root);
  process.exit(0);
}
if (action === "status") {
  const meta = readRun();
  console.log(
    JSON.stringify(
      {
        root: meta.root,
        origins: meta.origins,
        sources: meta.sources,
        auth: "native passkey, local-only",
        processes: meta.processes,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (action === "refresh-apps") {
  const meta = readRun();
  const names = ["guestbook", "showcase"];
  const replacements = names.map((name) => {
    if (!options[name] || !/^[a-f0-9]{40}$/.test(options[name + "-head"] ?? ""))
      throw Error("Provide explicit --" + name + " PATH and --" + name + "-head SHA.");
    const source = resolve(options[name]);
    const head = run("git", ["rev-parse", "HEAD"], source).trim();
    if (head !== options[name + "-head"] || run("git", ["status", "--porcelain"], source).trim())
      throw Error("Refresh requires the exact clean reviewed " + name + " checkout.");
    const proc = meta.processes.find((p) => p.name === name);
    if (!proc || run("ps", ["-p", String(proc.pid), "-o", "lstart="], repo).trim() !== proc.started)
      throw Error("The registered " + name + " process identity changed; inspect the lab first.");
    const dest = join(meta.root, name);
    const config = JSON.parse(readFileSync(join(dest, "wrangler.local.jsonc"), "utf8"));
    if (config.name !== "composer-invited-" + name || config.main !== "./local-entry.ts")
      throw Error("The owned app configuration does not match.");
    const manifest = JSON.parse(readFileSync(join(source, "app.manifest.json"), "utf8"));
    return { name, source, head, proc, dest, manifest };
  });
  // Preflight both sources and process identities before stopping either app.
  // State directories, local configuration/secrets, dependencies and browser
  // sessions are never copied, migrated, deleted or reset by this operation.
  for (const { name, source, head, proc, dest, manifest } of replacements) {
    terminate({ processes: [proc] });
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, 100));
      try { await available(meta.ports[name]); break; }
      catch { if (attempt === 19) throw Error("Owned " + name + " port did not close; state preserved."); }
    }
    for (const directory of ["src", "public"])
      run("rsync", ["-a", "--delete", join(source, directory) + "/", join(dest, directory) + "/"], repo);
    writeFileSync(join(dest, "app.manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    const named = name === "guestbook" ? ",{GuestbookMemberService}" : "";
    writeFileSync(join(dest, "local-entry.ts"),
      `import worker${named} from './src/worker.ts';\nObject.assign(globalThis,{BUILD_SHA:${JSON.stringify(head)},MANIFEST:${JSON.stringify(manifest)}});\n${name === "guestbook" ? "export {GuestbookMemberService};\n" : ""}export default worker;\n`);
    const log = openSync(join(meta.root, name + ".log"), "a");
    const child = spawn("pnpm", ["exec", "wrangler", "dev", "--config", "wrangler.local.jsonc", "--port", String(meta.ports[name]),
      "--persist-to", join(meta.root, name + "-state"), "--local-protocol", "http", "--local-upstream",
      new URL(meta.origins[name]).hostname, "--upstream-protocol", "https", "--local", "--inspector-port", "0"],
      { cwd: dest, detached: true, stdio: ["ignore", log, log] });
    child.unref();
    meta.sources[name] = { checkout: source, head, dirty: false };
    meta.processes = meta.processes.filter((p) => p.name !== name);
    meta.processes.push({ name, pid: child.pid, started: run("ps", ["-p", String(child.pid), "-o", "lstart="], repo).trim() });
    meta.appsRequireComposerRefresh = true;
    writeFileSync(join(meta.root, "run.json"), JSON.stringify(meta, null, 2), { mode: 0o600 });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const build = JSON.parse(run("curl", ["-ksS", "--noproxy", "*", "--connect-to",
          new URL(meta.origins[name]).hostname + ":443:127.0.0.1:8443", "--max-time", "2", meta.origins[name] + "/build.json"], repo));
        if (build.app === name && build.revision === head) { ready = true; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) throw Error("Refreshed " + name + " did not become ready; state and process registration preserved.");
  }
  console.log(JSON.stringify({ refreshed: Object.fromEntries(names.map((name) => [name, meta.sources[name]])), statePreserved: true,
    next: "Run refresh-composer before private app actions; its source pins must match the refreshed app builds." }, null, 2));
  process.exit(0);
}
if (action === "refresh-composer") {
  const meta = readRun();
  const source = resolve(options.composer ?? meta.sources.composer.checkout);
  const dest = join(meta.root, "composer");
  const proc = meta.processes.find((p) => p.name === "composer");
  if (proc) terminate({ processes: [proc] });
  await new Promise((r) => setTimeout(r, 600));
  for (const name of ["src", "public", "lib", "scripts"])
    run(
      "rsync",
      ["-a", "--delete", join(source, name) + "/", join(dest, name) + "/"],
      repo,
    );
  const lock = JSON.parse(
    readFileSync(join(source, "composition.lock.json"), "utf8"),
  );
  const views = JSON.parse(
    readFileSync(join(dest, "src/vendor/workbench/sources.json"), "utf8"),
  );
  for (const app of lock.apps) {
    app.commit = meta.sources[app.id].head;
    app.manifest = JSON.parse(
      readFileSync(join(meta.root, app.id, "app.manifest.json"), "utf8"),
    );
    app.manifestDigest =
      "sha256:" +
      createHash("sha256").update(JSON.stringify(app.manifest)).digest("hex");
    const view = views.apps.find((v) => v.id === app.id);
    const bytes = readFileSync(join(meta.root, app.id, view.source));
    if (createHash("sha256").update(bytes).digest("hex") !== view.sha256)
      throw Error("The app view differs from the reviewed copied adapter.");
    view.commit = app.commit;
  }
  lock.id = createHash("sha256")
    .update(JSON.stringify({ contract: 1, apps: lock.apps, spec: null }))
    .digest("hex");
  writeFileSync(
    join(dest, "composition.lock.json"),
    JSON.stringify(lock, null, 2) + "\n",
  );
  writeFileSync(
    join(dest, "src/vendor/workbench/sources.json"),
    JSON.stringify(views, null, 2) + "\n",
  );
  run("git", ["add", "src", "public", "lib", "scripts", "composition.lock.json"], dest);
  if (run("git", ["diff", "--cached", "--name-only"], dest).trim()) run(
    "git",
    [
      "-c",
      "user.name=Fictional local lab",
      "-c",
      "user.email=fictional@example.test",
      "commit",
      "-qm",
      "Refresh reviewed Composer source; preserve native auth and local app pins",
    ],
    dest,
  );
  meta.sources.composer = {
    checkout: source,
    head: run("git", ["rev-parse", "HEAD"], source).trim(),
    dirty: run("git", ["status", "--porcelain"], source).trim() !== "",
    labHead: run("git", ["rev-parse", "HEAD"], dest).trim(),
  };
  meta.localComposition = lock.id;
  delete meta.appsRequireComposerRefresh;
  writeFileSync(join(meta.root, "run.json"), JSON.stringify(meta, null, 2), {
    mode: 0o600,
  });
  writeFileSync(
    join(meta.root, "refresh-build.log"),
    run("pnpm", ["build"], dest),
  );
  const log = openSync(join(meta.root, "composer.log"), "a");
  const child = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--port",
      String(meta.ports.composer),
      "--persist-to",
      join(meta.root, "composer-state"),
      "--local-protocol",
      "http",
      "--local-upstream",
      "composer.loftwah.com",
      "--upstream-protocol",
      "https",
      "--local",
      "--inspector-port",
      "0",
    ],
    { cwd: dest, detached: true, stdio: ["ignore", log, log] },
  );
  child.unref();
  meta.processes = meta.processes.filter((p) => p.name !== "composer");
  meta.processes.push({
    name: "composer",
    pid: child.pid,
    started: run("ps", ["-p", String(child.pid), "-o", "lstart="], repo).trim(),
  });
  writeFileSync(join(meta.root, "run.json"), JSON.stringify(meta, null, 2), {
    mode: 0o600,
  });
  for (let i = 0; i < 40; i++) {
    try {
      const response = JSON.parse(
        run(
          "curl",
          [
            "-ksS",
            "--noproxy",
            "*",
            "--connect-to",
            "composer.loftwah.com:443:127.0.0.1:8443",
            "--max-time",
            "2",
            "https://composer.loftwah.com/_emdash/api/auth/mode",
          ],
          repo,
        ),
      );
      if (response.data?.authMode === "passkey") {
        console.log(
          JSON.stringify(
            {
              refreshed: meta.sources.composer,
              localComposition: meta.localComposition,
              statePreserved: true,
              root: meta.root,
            },
            null,
            2,
          ),
        );
        process.exit(0);
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error(
    "Refreshed local Composer did not become ready; owned state is preserved for recovery.",
  );
}
if (action === "reset-accounts") {
  const meta = readRun();
  const proc = meta.processes.find((p) => p.name === "composer");
  if (proc) terminate({ processes: [proc] });
  await new Promise((r) => setTimeout(r, 800));
  rmSync(join(meta.root, "composer-state"), { recursive: true, force: true });
  const dir = join(meta.root, "composer");
  const config = JSON.parse(
    readFileSync(join(dir, "wrangler.local.jsonc"), "utf8"),
  );
  for (const database of config.d1_databases ?? [])
    run(
      "pnpm",
      [
        "exec",
        "wrangler",
        "d1",
        "migrations",
        "apply",
        database.database_name,
        "--local",
        "--config",
        "wrangler.local.jsonc",
        "--persist-to",
        join(meta.root, "composer-state"),
      ],
      dir,
    );
  const log = openSync(join(meta.root, "composer.log"), "a");
  const child = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--port",
      String(meta.ports.composer),
      "--persist-to",
      join(meta.root, "composer-state"),
      "--local-protocol",
      "http",
      "--local-upstream",
      "composer.loftwah.com",
      "--upstream-protocol",
      "https",
      "--local",
      "--inspector-port",
      "0",
    ],
    { cwd: dir, detached: true, stdio: ["ignore", log, log] },
  );
  child.unref();
  const replacement = {
    name: "composer",
    pid: child.pid,
    started: run("ps", ["-p", String(child.pid), "-o", "lstart="], repo).trim(),
  };
  meta.processes = meta.processes.filter((p) => p.name !== "composer");
  meta.processes.push(replacement);
  writeFileSync(join(meta.root, "run.json"), JSON.stringify(meta, null, 2), {
    mode: 0o600,
  });
  for (const name of ["owner", "member-a", "member-b"])
    rmSync(join(meta.root, name + "-state.json"), { force: true });
  console.log(
    "Reset only the owned fictional Composer account/session fixture; artifact retained.",
  );
  process.exit(0);
}
if (action !== "start")
  throw Error(
    "Use start --composer PATH --guestbook PATH --showcase PATH, status, or stop.",
  );
if (existsSync(pointer))
  throw Error("An owned lab is already registered; inspect or stop it first.");
await Promise.all([
  available(8443),
  available(8811),
  available(8812),
  available(8813),
]);
const sources = {
  composer: resolve(options.composer ?? repo),
  guestbook: resolve(
    options.guestbook ??
      join(repo, "../app-composer-guestbook-members-20261023"),
  ),
  showcase: resolve(
    options.showcase ?? join(repo, "../app-composer-showcase-invited"),
  ),
};
for (const source of Object.values(sources))
  if (!existsSync(join(source, "node_modules")))
    throw Error("Use an existing installed checkout: " + source);
const root = mkdtempSync(join(tmpdir(), "composer-invited-"));
const meta = {
  schema: "composer.invited-local/1",
  root,
  ports: { composer: 8811, guestbook: 8812, showcase: 8813 },
  origins: {
    composer: "https://composer.loftwah.com",
    guestbook: "https://guestbook.loftwah.com",
    showcase: "https://showcase.loftwah.com",
  },
  sources: {},
  processes: [],
  createdAt: new Date().toISOString(),
};
let success = false;
const save = () =>
  writeFileSync(join(root, "run.json"), JSON.stringify(meta, null, 2), {
    mode: 0o600,
  });
save();
mkdirSync(dirname(pointer), { recursive: true });
writeFileSync(pointer, root, { mode: 0o600 });
const cleanup = () => {
  if (!success) {
    terminate(meta);
    rmSync(root, { recursive: true, force: true });
    rmSync(pointer, { force: true });
  }
};
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));
try {
  const tokens = {
    profile: randomBytes(24).toString("hex"),
    guestbook: randomBytes(24).toString("hex"),
    owner: randomBytes(24).toString("hex"),
  };
  for (const [name, source] of Object.entries(sources)) {
    const dest = join(root, name);
    mkdirSync(dest);
    run(
      "rsync",
      [
        "-a",
        "--exclude=.git",
        "--exclude=node_modules",
        "--exclude=.wrangler",
        "--exclude=.astro",
        "--exclude=dist",
        "--exclude=output",
        "--exclude=.dev.vars*",
        "--exclude=.env*",
        source + "/",
        dest + "/",
      ],
      repo,
    );
    run(
      "cp",
      [
        "-cR",
        realpathSync(join(source, "node_modules")),
        join(dest, "node_modules"),
      ],
      repo,
    );
    meta.sources[name] = {
      checkout: source,
      head: run("git", ["rev-parse", "HEAD"], source).trim(),
      dirty: run("git", ["status", "--porcelain"], source).trim() !== "",
    };
    const config = JSON.parse(
      readFileSync(join(dest, "wrangler.jsonc"), "utf8"),
    );
    config.name = "composer-invited-" + name;
    config.routes = [];
    config.workers_dev = false;
    config.preview_urls = false;
    delete config.env;
    delete config.triggers;
    delete config.ratelimits;
    config.vars = { ...(config.vars ?? {}), PUBLIC_ORIGIN: meta.origins[name] };
    delete config.vars.CF_ACCESS_TEAM_DOMAIN;
    delete config.vars.CF_ACCESS_AUDIENCE;
    if (name === "composer") {
      config.main = "./lab-entry.ts";
      config.vars = {
        PUBLIC_ORIGIN: meta.origins.composer,
        RESOURCE_ACCOUNT_ID: "invited-local-account",
        RESOURCE_ENVIRONMENT: "local",
        COMPOSER_PROFILE_BRIDGE_TOKEN: tokens.profile,
        GUESTBOOK_MEMBER_TOKEN: tokens.guestbook,
        GUESTBOOK_OWNER_TOKEN: tokens.owner,
      };
      config.services = [
        { binding: "GUESTBOOK", service: "composer-invited-guestbook" },
        {
          binding: "GUESTBOOK_MEMBERS",
          service: "composer-invited-guestbook",
          entrypoint: "GuestbookMemberService",
        },
        { binding: "SHOWCASE", service: "composer-invited-showcase" },
      ];
      writeFileSync(
        join(dest, "lab-entry.ts"),
        "// Isolated lab only: supported native auth, production Access wrapper absent.\nimport handler,{PluginBridge} from '@emdash-cms/cloudflare/worker';\nexport {PluginBridge};\nexport default handler;\n",
      );
      const require = createRequire(join(source, "package.json"));
      const ts = require("typescript");
      const file = ts.createSourceFile(
        "astro.config.mjs",
        readFileSync(join(dest, "astro.config.mjs"), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
      );
      const transformed = ts.transform(file, [
        (context) => {
          const visitor = (node) => {
            if (
              ts.isCallExpression(node) &&
              node.expression.getText(file) === "emdash" &&
              node.arguments[0] &&
              ts.isObjectLiteralExpression(node.arguments[0])
            ) {
              const original = node.arguments[0];
              const props = original.properties
                .filter((p) => p.name?.getText(file) !== "auth")
                .map((p) => {
                  if (
                    p.name?.getText(file) === "plugins" &&
                    ts.isPropertyAssignment(p) &&
                    ts.isArrayLiteralExpression(p.initializer)
                  )
                    return ts.factory.updatePropertyAssignment(
                      p,
                      p.name,
                      ts.factory.updateArrayLiteralExpression(
                        p.initializer,
                        p.initializer.elements.filter(
                          (el) => !el.getText(file).includes("composer-resend"),
                        ),
                      ),
                    );
                  return p;
                });
              return ts.factory.updateCallExpression(
                node,
                node.expression,
                node.typeArguments,
                [
                  ts.factory.updateObjectLiteralExpression(original, props),
                  ...node.arguments.slice(1),
                ],
              );
            }
            return ts.visitEachChild(node, visitor, context);
          };
          return (node) => ts.visitNode(node, visitor);
        },
      ]);
      writeFileSync(
        join(dest, "astro.config.mjs"),
        ts.createPrinter().printFile(transformed.transformed[0]),
      );
      transformed.dispose();
      run("git", ["init", "-q"], dest);
      run("git", ["add", "."], dest);
      run(
        "git",
        [
          "-c",
          "user.name=Fictional local lab",
          "-c",
          "user.email=fictional@example.test",
          "commit",
          "-qm",
          "Isolated native-auth qualification source",
        ],
        dest,
      );
      meta.sources.composer.labHead = run(
        "git",
        ["rev-parse", "HEAD"],
        dest,
      ).trim();
    } else {
      const named = name === "guestbook" ? ",{GuestbookMemberService}" : "";
      const manifest = JSON.parse(
        readFileSync(join(dest, "app.manifest.json"), "utf8"),
      );
      writeFileSync(
        join(dest, "local-entry.ts"),
        `import worker${named} from './src/worker.ts';\nObject.assign(globalThis,{BUILD_SHA:${JSON.stringify(meta.sources[name].head)},MANIFEST:${JSON.stringify(manifest)}});\n${name === "guestbook" ? "export {GuestbookMemberService};\n" : ""}export default worker;\n`,
      );
      config.main = "./local-entry.ts";
      config.vars.OWNER_API_TOKEN = tokens.owner;
      config.vars.PUBLIC_ORIGIN = meta.origins.composer;
      if (name === "guestbook")
        Object.assign(config.vars, {
          RESOURCE_ACCOUNT_ID: "invited-local-account",
          RESOURCE_ENVIRONMENT: "local",
          MEMBER_ISSUER: meta.origins.composer,
          MEMBER_SERVICE_TOKEN: tokens.guestbook,
        });
      else {
        Object.assign(config.vars, {
          COMPOSER_ISSUER: meta.origins.composer,
          PROFILE_ORIGIN: meta.origins.showcase,
          COMPOSER_PROFILE_BRIDGE_TOKEN: tokens.profile,
        });
        config.services = [
          { binding: "ITEM_PROVIDER", service: "composer-invited-guestbook" },
        ];
      }
    }
    writeFileSync(
      join(dest, "wrangler.local.jsonc"),
      JSON.stringify(config, null, 2),
      { mode: 0o600 },
    );
    // The production build reads wrangler.jsonc. Only this copy points at local services.
    writeFileSync(
      join(dest, "wrangler.jsonc"),
      JSON.stringify(config, null, 2),
      { mode: 0o600 },
    );
  }
  save();
  for (const name of ["guestbook", "showcase", "composer"]) {
    const dir = join(root, name),
      config = JSON.parse(
        readFileSync(join(dir, "wrangler.local.jsonc"), "utf8"),
      );
    for (const database of config.d1_databases ?? [])
      run(
        "pnpm",
        [
          "exec",
          "wrangler",
          "d1",
          "migrations",
          "apply",
          database.database_name,
          "--local",
          "--config",
          "wrangler.local.jsonc",
          "--persist-to",
          join(root, name + "-state"),
        ],
        dir,
      );
  }
  console.log(
    "Building one isolated Composer artifact with supported native passkey auth.",
  );
  writeFileSync(
    join(root, "build.log"),
    run("pnpm", ["build"], join(root, "composer")),
  );
  const detached = (name, command, args, cwd) => {
    const log = openSync(join(root, name + ".log"), "a");
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: ["ignore", log, log],
    });
    child.unref();
    meta.processes.push({
      name,
      pid: child.pid,
      started: run(
        "ps",
        ["-p", String(child.pid), "-o", "lstart="],
        repo,
      ).trim(),
    });
    save();
  };
  for (const name of ["guestbook", "showcase", "composer"])
    detached(
      name,
      "pnpm",
      [
        "exec",
        "wrangler",
        "dev",
        "--config",
        name === "composer"
          ? "dist/server/wrangler.json"
          : "wrangler.local.jsonc",
        "--port",
        String(meta.ports[name]),
        "--persist-to",
        join(root, name + "-state"),
        "--local-protocol",
        "http",
        "--local-upstream",
        meta.origins[name].replace("https://", ""),
        "--upstream-protocol",
        "https",
        "--local",
        "--inspector-port",
        "0",
      ],
      join(root, name),
    );
  run(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(root, "key.pem"),
      "-out",
      join(root, "cert.pem"),
      "-days",
      "2",
      "-subj",
      "/CN=composer.loftwah.com",
      "-addext",
      "subjectAltName=DNS:composer.loftwah.com,DNS:guestbook.loftwah.com,DNS:showcase.loftwah.com",
    ],
    repo,
  );
  detached(
    "proxy",
    process.execPath,
    [join(repo, "labs/invited-members/proxy.mjs"), root],
    repo,
  );
  writeFileSync(
    join(root, "playwright.config.json"),
    JSON.stringify(
      {
        browser: {
          browserName: "chromium",
          launchOptions: {
            channel: "chrome",
            args: [
              "--host-resolver-rules=MAP composer.loftwah.com 127.0.0.1:8443, MAP guestbook.loftwah.com 127.0.0.1:8443, MAP showcase.loftwah.com 127.0.0.1:8443",
              "--no-proxy-server",
            ],
          },
          contextOptions: { ignoreHTTPSErrors: true },
        },
      },
      null,
      2,
    ),
  );
  for (let count = 0; count < 60; count++) {
    try {
      const raw = run(
        "curl",
        [
          "-ksS",
          "--noproxy",
          "*",
          "--connect-to",
          "composer.loftwah.com:443:127.0.0.1:8443",
          "--max-time",
          "2",
          "https://composer.loftwah.com/_emdash/api/auth/mode",
        ],
        repo,
      );
      if (JSON.parse(raw).data?.authMode === "passkey") {
        success = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!success) throw Error("Native-auth local workers did not become ready.");
  save();
  console.log(
    JSON.stringify(
      {
        root,
        pointer,
        composer: meta.origins.composer,
        authentication: "native passkey; Access/provider admission unqualified",
        authCommand: `node labs/invited-members/auth.mjs --pointer ${pointer}`,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  throw error;
}

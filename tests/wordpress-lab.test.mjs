import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  chmodSync,
  readdirSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../scripts/wordpress-lab.mjs", import.meta.url),
);
async function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "composer-weekender-gate-"));
  for (const name of ["tmp", "home", "bin"]) mkdirSync(join(root, name));
  try {
    return await run(root);
  } finally {
    rmSync(root, { recursive: true });
  }
}
function execute(root, args) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 20000,
    env: {
      PATH: join(root, "bin") + delimiter + process.env.PATH,
      HOME: join(root, "home"),
      TMPDIR: join(root, "tmp"),
    },
  });
}
function fakeDocker(root, policyDrift = false) {
  // Failure injection only: this is never used as source/runtime/import evidence.
  const marker = join(root, "docker-commands.jsonl");
  writeFileSync(
    join(root, "bin/docker"),
    `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(marker)},JSON.stringify(args)+'\\n');
if(args.includes('config')&&args.includes('--format')){const cfg=JSON.parse(fs.readFileSync(args[args.indexOf('--file')+1],'utf8').replaceAll('$$','$'));if(${policyDrift})delete cfg.services.cli.environment.WORDPRESS_CONFIG_EXTRA;console.log(JSON.stringify(cfg));process.exit(0);}
if(args.includes('install')){console.error('FICTIONAL_SETUP_FAILURE');process.exit(7);}process.exit(0);
`,
    { mode: 0o755 },
  );
  return marker;
}

function registeredRun(root) {
  const owned = mkdtempSync(
    join(realpathSync(join(root, "tmp")), "composer-weekender-"),
  );
  const nonce = "d".repeat(32);
  mkdirSync(join(owned, "evidence"));
  writeFileSync(join(owned, "source.env"), "");
  writeFileSync(
    join(owned, "ownership.json"),
    JSON.stringify({ schema: "app-composer.wordpress-lab/1", nonce }),
  );
  const registry = join(root, "run.json");
  writeFileSync(
    registry,
    JSON.stringify({
      schema: "app-composer.wordpress-lab/1",
      root: owned,
      nonce,
      project: "composer-weekender-" + nonce.slice(0, 12),
      dockerHost: "unix:///Users/deanlofts/.orbstack/run/docker.sock",
      scenario: "publisher",
      sourceBase: "a".repeat(40),
      sourceOrigin: "http://localhost:12345",
      resources: [],
    }),
  );
  return { owned, registry };
}

function transportFixture(root, exitsEarly = false) {
  // OS/process and refusal injection only. No network/WordPress acceptance.
  const { owned, registry } = registeredRun(root);
  const repository = join(root, "fixture-repository");
  mkdirSync(join(repository, "scripts"), { recursive: true });
  mkdirSync(join(repository, "labs/wordpress/weekender"), { recursive: true });
  const copiedScript = join(repository, "scripts/wordpress-lab.mjs");
  writeFileSync(copiedScript, readFileSync(script));
  const vendor = join(owned, "cloudflared");
  const bytes = `#!${process.execPath}\nprocess.stdout.write('https://controlled-weekender-lifecycle.trycloudflare.com\\n');${exitsEarly ? "process.exit(0);" : "setInterval(()=>{},1000);"}\n`;
  writeFileSync(vendor, bytes, { mode: 0o755 });
  const pins = JSON.parse(
    readFileSync(
      new URL("../labs/wordpress/weekender/versions.json", import.meta.url),
    ),
  );
  pins.cloudflared.binarySHA256 = createHash("sha256")
    .update(bytes)
    .digest("hex");
  writeFileSync(
    join(repository, "labs/wordpress/weekender/versions.json"),
    JSON.stringify(pins),
  );
  const preload = join(root, "controlled-source-health.mjs");
  writeFileSync(
    preload,
    `globalThis.fetch=async url=>{if(new URL(url).hostname!=='controlled-weekender-lifecycle.trycloudflare.com')throw Error('Unexpected fixture network');return new Response(JSON.stringify({name:'Macedon Weekender — fictional lab'}));};`,
  );
  const marker = join(root, "docker-commands.jsonl");
  writeFileSync(
    join(root, "bin/docker"),
    `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(marker)},JSON.stringify(args)+'\\n');const owned=args[args.indexOf('--project-directory')+1];
if(args.includes('get')&&args.includes('composer_weekender_fixture'))console.log('1');
else if(args.includes('eval-file'))console.log(JSON.stringify({version:'7.1.3',fictional:true,articles:[{status:'publish',url:'https://controlled-weekender-lifecycle.trycloudflare.com/fictional'}],pages:[]}));
else if(args.includes('export'))fs.writeFileSync(path.join(owned,'evidence/weekender.xml'),'<wp:wxr_version>TRANSPORT_LIFECYCLE_FIXTURE_ONLY</wp:wxr_version>');
else if(args.includes('version'))console.log(args.includes('core')?'7.1.3':'WP-CLI 2.12.0');
else if(args.includes('eval'))console.log('8.3.35');
else if(args.includes('--version'))console.log('MariaDB transport lifecycle fixture');
`,
    { mode: 0o755 },
  );
  return { owned, registry, copiedScript, preload, marker, vendor };
}

async function stopFixtureVendor(value) {
  const run = JSON.parse(readFileSync(value.registry));
  const pid = run.cloudflared?.pid;
  if (!Number.isSafeInteger(pid)) return;
  const command = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  }).stdout;
  if (!command) return;
  assert(
    command.includes(value.vendor),
    "Never stop a PID outside this exact fixture.",
  );
  process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 20; attempt++) {
    const remaining = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
    }).stdout;
    if (!remaining.includes(value.vendor)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw Error("The exact owned fixture transport did not exit before cleanup.");
}

test(
  "a source transport survives cleanup of its short-lived CLI process group",
  { skip: process.platform !== "darwin" || process.arch !== "arm64" },
  () =>
    fixture(async (root) => {
      const value = transportFixture(root);
      try {
        const result = spawnSync(
          process.execPath,
          [
            "--import",
            value.preload,
            value.copiedScript,
            "transport",
            "--run",
            value.registry,
          ],
          {
            encoding: "utf8",
            timeout: 20000,
            detached: true,
            env: {
              PATH: join(root, "bin") + delimiter + process.env.PATH,
              HOME: join(root, "home"),
              TMPDIR: join(root, "tmp"),
            },
          },
        );
        assert.equal(result.status, 0, result.stderr);
        const run = JSON.parse(readFileSync(value.registry));
        try {
          process.kill(-result.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        const alive = spawnSync(
          "ps",
          ["-p", String(run.cloudflared.pid), "-o", "command="],
          { encoding: "utf8" },
        ).stdout;
        assert(
          alive.includes(value.vendor),
          "The selected source tunnel must outlive the command that started it.",
        );
        assert.equal(
          run.sourceOrigin,
          "https://controlled-weekender-lifecycle.trycloudflare.com",
        );
      } finally {
        await stopFixtureVendor(value);
      }
    }),
);

test(
  "a source URL banner followed by process exit cannot rewrite the WordPress source",
  { skip: process.platform !== "darwin" || process.arch !== "arm64" },
  () =>
    fixture(async (root) => {
      const value = transportFixture(root, true);
      try {
        const result = spawnSync(
          process.execPath,
          [
            "--import",
            value.preload,
            value.copiedScript,
            "transport",
            "--run",
            value.registry,
          ],
          {
            encoding: "utf8",
            timeout: 20000,
            env: {
              PATH: join(root, "bin") + delimiter + process.env.PATH,
              HOME: join(root, "home"),
              TMPDIR: join(root, "tmp"),
            },
          },
        );
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /transport exited before source readiness/);
        const run = JSON.parse(readFileSync(value.registry));
        assert.equal(run.sourceOrigin, "http://localhost:12345");
        const commands = existsSync(value.marker)
          ? readFileSync(value.marker, "utf8")
              .trim()
              .split("\n")
              .map(JSON.parse)
          : [];
        assert.equal(
          commands.some(
            (args) =>
              args.includes("search-replace") ||
              args.includes("update") ||
              args.includes("export"),
          ),
          false,
        );
      } finally {
        await stopFixtureVendor(value);
      }
    }),
);

test("changed or incomplete source recovery points refuse before a new runtime exists", () =>
  fixture((root) => {
    const marker = fakeDocker(root);
    const directory = join(root, "private-backup");
    mkdirSync(directory, { mode: 0o700 });
    const pins = JSON.parse(
      readFileSync(
        new URL("../labs/wordpress/weekender/versions.json", import.meta.url),
      ),
    );
    const inventory = {
      fictional: true,
      version: "7.1.3",
      scenario: "publisher",
    };
    const artifacts = {
      "source-database.sql": "SQL_GUARD_FIXTURE_ONLY",
      "source-files.tar.gz": "ARCHIVE_GUARD_FIXTURE_ONLY",
      "source-files.json": '{"guardFixtureOnly":true}',
      "source-inventory.json": JSON.stringify(inventory),
    };
    const files = {};
    for (const [name, text] of Object.entries(artifacts)) {
      writeFileSync(join(directory, name), text, { mode: 0o600 });
      files[name] = {
        bytes: Buffer.byteLength(text),
        sha256: createHash("sha256").update(text).digest("hex"),
      };
    }
    const original = {
      schema: "app-composer.wordpress-source-backup/1",
      fictional: true,
      private: true,
      containsSecrets: true,
      maintenanceQuiesced: true,
      sourceScenario: "publisher",
      sourceBase: "a".repeat(40),
      sourceOrigin: "http://localhost:12345",
      images: {
        wordpress: pins.wordpress.image,
        cli: pins.cli.image,
        database: pins.database.image,
      },
      files,
    };
    const path = join(directory, "manifest.json");
    for (const mutate of [
      (value) => {
        value.images.wordpress = "wordpress:latest";
      },
      (value) => {
        value.sourceOrigin = "https://customer.example";
      },
      (value) => {
        value.private = false;
      },
      (value) => {
        delete value.files["source-database.sql"];
      },
      (value) => {
        value.files["../../owner-file"] = value.files["source-database.sql"];
      },
      (value) => {
        value.files["source-files.tar.gz"].sha256 = "f".repeat(64);
      },
    ]) {
      const manifest = structuredClone(original);
      mutate(manifest);
      writeFileSync(path, JSON.stringify(manifest), { mode: 0o600 });
      const result = execute(root, [
        "run",
        "--run",
        join(root, "new-run.json"),
        "--restore",
        path,
      ]);
      assert.notEqual(result.status, 0);
      assert.equal(existsSync(marker), false);
      assert.equal(existsSync(join(root, "new-run.json")), false);
      assert.deepEqual(readdirSync(join(root, "tmp")), []);
      assert.equal(
        readFileSync(join(directory, "source-database.sql"), "utf8"),
        artifacts["source-database.sql"],
      );
    }
  }));

test("unknown scenarios and scenario changes on existing runs refuse before Docker", () =>
  fixture((root) => {
    const marker = fakeDocker(root);
    for (const args of [
      ["run", "--run", join(root, "new.json"), "--scenario", "customer"],
      ["snapshot", "--run", join(root, "new.json"), "--scenario", "publisher"],
    ]) {
      const result = execute(root, args);
      assert.notEqual(result.status, 0);
      assert.equal(existsSync(marker), false);
      assert.deepEqual(readdirSync(join(root, "tmp")), []);
    }
  }));

test("a failed database backup exits maintenance and removes only its own partial recovery staging", () =>
  fixture((root) => {
    const { owned, registry } = registeredRun(root);
    const marker = join(root, "docker-commands.jsonl");
    writeFileSync(join(owned, "evidence", "keep-source-work.txt"), "preserve");
    writeFileSync(
      join(root, "bin/docker"),
      `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(marker)},JSON.stringify(args)+'\\n');
if(args.includes('eval'))console.log('inactive');
if(args.includes('db')&&args.includes('export')){fs.writeFileSync(${JSON.stringify(join(owned, "evidence", "source-database.sql"))},'PARTIAL_SQL_FAILURE_FIXTURE');console.error('FICTIONAL_BACKUP_INTERRUPTED');process.exit(7);}
`,
      { mode: 0o755 },
    );
    const result = execute(root, ["backup", "--run", registry]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FICTIONAL_BACKUP_INTERRUPTED/);
    assert.equal(existsSync(join(owned, "backup.lock")), false);
    assert.deepEqual(readdirSync(join(owned, "evidence")), [
      "keep-source-work.txt",
    ]);
    assert.equal(
      readFileSync(join(owned, "evidence", "keep-source-work.txt"), "utf8"),
      "preserve",
    );
    assert.equal(
      readdirSync(root).some((name) => name.startsWith("source-backup-")),
      false,
    );
    const calls = readFileSync(marker, "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert(
      calls.some(
        (args) =>
          args.includes("maintenance-mode") && args.includes("activate"),
      ),
    );
    assert(
      calls.some(
        (args) =>
          args.includes("maintenance-mode") && args.includes("deactivate"),
      ),
    );
    assert.equal(
      calls.some((args) => args.includes("down") || args.includes("prune")),
      false,
    );
  }));

test("backup preserves an existing maintenance state, prior staging and another backup lock", () =>
  fixture((root) => {
    const { owned, registry } = registeredRun(root);
    const marker = join(root, "docker-commands.jsonl");
    writeFileSync(
      join(root, "bin/docker"),
      `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(marker)},JSON.stringify(args)+'\\n');if(args.includes('eval'))console.log('active');`,
      { mode: 0o755 },
    );
    const active = execute(root, ["backup", "--run", registry]);
    assert.notEqual(active.status, 0);
    assert.match(active.stderr, /already in maintenance/);
    assert.equal(readFileSync(marker, "utf8").trim().split("\n").length, 1);
    assert.equal(existsSync(join(owned, "backup.lock")), false);
    const staged = join(owned, "evidence", "source-database.sql");
    writeFileSync(staged, "unconfirmed prior source backup");
    const prior = execute(root, ["backup", "--run", registry]);
    assert.notEqual(prior.status, 0);
    assert.match(prior.stderr, /staging is preserved/);
    assert.equal(
      readFileSync(staged, "utf8"),
      "unconfirmed prior source backup",
    );
    writeFileSync(join(owned, "backup.lock"), "other owned backup is active");
    const locked = execute(root, ["backup", "--run", registry]);
    assert.notEqual(locked.status, 0);
    assert.match(locked.stderr, /EEXIST/);
    assert.equal(
      readFileSync(join(owned, "backup.lock"), "utf8"),
      "other owned backup is active",
    );
  }));

test("the lab refuses an existing selected registry before any Docker operation", () =>
  fixture((root) => {
    const marker = fakeDocker(root),
      registry = join(root, "owner.json");
    const original = '{"fixture":"unrelated owner work must remain"}\n';
    writeFileSync(registry, original);
    const result = execute(root, ["run", "--run", registry]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /existing lab sources are never overwritten/i);
    assert.equal(readFileSync(registry, "utf8"), original);
    assert.equal(existsSync(marker), false);
  }));

test("registration failure removes fresh staging before any Docker operation", () =>
  fixture((root) => {
    const marker = fakeDocker(root);
    const destination = join(root, "read-only-evidence");
    mkdirSync(destination, { mode: 0o500 });
    try {
      const result = execute(root, [
        "run",
        "--run",
        join(destination, "run.json"),
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /EACCES|permission denied/i);
      assert.deepEqual(readdirSync(join(root, "tmp")), []);
      assert.equal(existsSync(marker), false);
    } finally {
      chmodSync(destination, 0o700);
    }
  }));

test("a forged registry outside the registered temp-root boundary cannot stop or remove a project", () =>
  fixture((root) => {
    const marker = fakeDocker(root),
      registry = join(root, "run.json");
    writeFileSync(
      registry,
      JSON.stringify({
        schema: "app-composer.wordpress-lab/1",
        project: "composer-weekender-" + "a".repeat(12),
        root,
        nonce: "b".repeat(32),
      }),
    );
    const result = execute(root, ["source-off", "--run", registry]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /registered run|ownership|directory/i);
    assert.equal(existsSync(root), true);
    assert.equal(existsSync(marker), false);
  }));

test("failed WordPress setup finally removes only the exact registered project and temporary root", () =>
  fixture((root) => {
    const marker = fakeDocker(root),
      registry = join(root, "run.json");
    const result = execute(root, ["run", "--run", registry]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /FICTIONAL_SETUP_FAILURE/);
    const run = JSON.parse(readFileSync(registry, "utf8"));
    const receipt = JSON.parse(
      readFileSync(join(root, "cleanup.json"), "utf8"),
    );
    assert.equal(receipt.project, run.project);
    assert.equal(receipt.dockerDownSucceeded, true);
    assert.equal(receipt.rootRemoved, true);
    assert.equal(existsSync(run.root), false);
    assert.equal(existsSync(root), true);
    const commands = readFileSync(marker, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert(
      commands.some(
        (args) => args.includes("down") && args.includes("--volumes"),
      ),
    );
    for (const args of commands) {
      assert.equal(args[args.indexOf("--project-name") + 1], run.project);
      assert.equal(
        args[args.indexOf("--host") + 1],
        "unix:///Users/deanlofts/.orbstack/run/docker.sock",
      );
      assert.equal(args.includes("prune"), false);
      assert.equal(args.includes("--rmi"), false);
    }
  }));

test("a live controller stays alive and SIGTERM executes scoped finally cleanup", async () =>
  fixture(async (root) => {
    // Transport/lifecycle simulation only. Actual WordPress proof uses the real engine.
    const marker = join(root, "docker-commands.jsonl"),
      registry = join(root, "run.json");
    writeFileSync(
      join(root, "bin/docker"),
      `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(marker)},JSON.stringify(args)+'\\n');const owned=args[args.indexOf('--project-directory')+1];
if(args.includes('config')&&args.includes('--format')) console.log(fs.readFileSync(args[args.indexOf('--file')+1],'utf8').replaceAll('$$','$'));
else if(args.includes('eval-file')) console.log(JSON.stringify({version:'7.1.3',fictional:true,articles:[{status:'publish',url:'http://localhost:12345/fictional'}],pages:[]}));
else if(args.includes('export')) fs.writeFileSync(path.join(owned,'evidence/weekender.xml'),'<wp:wxr_version>FAKE_LIFECYCLE_ONLY</wp:wxr_version>');
else if(args.includes('version')) console.log(args.includes('core')?'7.1.3':'WP-CLI 2.12.0');
else if(args.includes('eval')) console.log('8.3.35');
else if(args.includes('--version')) console.log('MariaDB fictional lifecycle fixture');
`,
      { mode: 0o755 },
    );
    const child = spawn(process.execPath, [script, "run", "--run", registry], {
      env: {
        PATH: join(root, "bin") + delimiter + process.env.PATH,
        HOME: join(root, "home"),
        TMPDIR: join(root, "tmp"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const done = new Promise((resolve) =>
      child.once("exit", (code, signal) => resolve({ code, signal })),
    );
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              Error("Controller did not reach its waiting state: " + output),
            ),
          8000,
        );
        child.stdout.on("data", (bytes) => {
          output += bytes;
          if (output.includes("Source remains alive")) {
            clearTimeout(timeout);
            resolve();
          }
        });
        child.stderr.on("data", (bytes) => {
          output += bytes;
        });
        child.once("exit", (code) => {
          clearTimeout(timeout);
          reject(
            Error("Controller exited before waiting: " + code + " " + output),
          );
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 125));
      assert.equal(
        child.exitCode,
        null,
        "An unsettled top-level await must not terminate the live lab",
      );
      const registered = JSON.parse(readFileSync(registry, "utf8"));
      const config = JSON.parse(
        readFileSync(join(registered.root, "compose.json")),
      );
      const cliPolicy = config.services.cli.environment.WORDPRESS_CONFIG_EXTRA;
      assert.equal(
        cliPolicy,
        config.services.wordpress.environment.WORDPRESS_CONFIG_EXTRA,
      );
      assert.match(cliPolicy, /AUTOMATIC_UPDATER_DISABLED/);
      const observed = execute(root, ["snapshot", "--run", registry]);
      assert.equal(observed.status, 0, observed.stderr);
      child.kill("SIGTERM");
      assert.equal((await done).code, 0, output);
      const run = JSON.parse(readFileSync(registry, "utf8")),
        receipt = JSON.parse(readFileSync(join(root, "cleanup.json"), "utf8"));
      assert.equal(receipt.project, run.project);
      assert.equal(receipt.rootRemoved, true);
      assert.equal(existsSync(run.root), false);
      const commands = readFileSync(marker, "utf8")
        .trim()
        .split("\n")
        .map(JSON.parse);
      assert.equal(
        commands.filter((args) => args.includes("/fixture/seed.php")).length,
        1,
        "Snapshot never reseeds source work",
      );
      assert.equal(
        commands.filter((args) => args.includes("/fixture/inventory.php"))
          .length,
        2,
        "Snapshot independently observes actual state",
      );
      assert.equal(
        commands.filter(
          (args) => args.includes("down") && args.includes("--volumes"),
        ).length,
        1,
      );
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await done;
      }
    }
  }));

test("cleanup retains a live owned dev consumer, then recovers only that root after it closes", () =>
  fixture(async (root) => {
    const owned = mkdtempSync(
      join(realpathSync(join(root, "tmp")), "composer-weekender-"),
    );
    const nonce = "c".repeat(32),
      registry = join(root, "run.json");
    writeFileSync(join(owned, "source.env"), "");
    writeFileSync(
      join(owned, "ownership.json"),
      JSON.stringify({ schema: "app-composer.wordpress-lab/1", nonce }),
    );
    writeFileSync(
      registry,
      JSON.stringify({
        schema: "app-composer.wordpress-lab/1",
        root: owned,
        nonce,
        project: "composer-weekender-" + nonce.slice(0, 12),
        dockerHost: "unix:///Users/deanlofts/.orbstack/run/docker.sock",
        pid: 999999999,
        resources: [],
      }),
    );
    fakeDocker(root);
    const consumer = spawn(
      process.execPath,
      ["-e", "setInterval(()=>{},1000)", join(owned, "fictional-dev-consumer")],
      { stdio: "ignore" },
    );
    const exited = new Promise((resolve) => consumer.once("exit", resolve));
    try {
      const refused = execute(root, ["down", "--run", registry]);
      assert.notEqual(refused.status, 0);
      assert.match(refused.stderr, /consumers remain active/);
      assert.equal(existsSync(owned), true);
      assert.equal(
        JSON.parse(readFileSync(join(root, "cleanup.json"))).rootRemoved,
        false,
      );
      consumer.kill("SIGTERM");
      await exited;
      const recovered = execute(root, ["down", "--run", registry]);
      assert.equal(recovered.status, 0, recovered.stderr);
      assert.equal(existsSync(owned), false);
      assert.equal(existsSync(root), true);
    } finally {
      if (consumer.exitCode === null) {
        consumer.kill("SIGTERM");
        await exited;
      }
      rmSync(owned, { recursive: true, force: true });
    }
  }));

test("a CLI policy mismatch refuses before any WordPress source container starts", () =>
  fixture((root) => {
    const marker = fakeDocker(root, true);
    const registry = join(root, "run.json");
    const result = execute(root, [
      "run",
      "--run",
      registry,
      "--scenario",
      "publisher",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CLI and web WordPress policies differ/);
    const commands = readFileSync(marker, "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(
      commands.some((args) => args.includes("up")),
      false,
    );
    assert.equal(
      JSON.parse(readFileSync(join(root, "cleanup.json"))).rootRemoved,
      true,
    );
    assert.deepEqual(readdirSync(join(root, "tmp")), []);
  }));

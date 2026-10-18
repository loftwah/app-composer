import test from "node:test";
import assert from "node:assert/strict";
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
function fakeDocker(root) {
  // Failure injection only: this is never used as source/runtime/import evidence.
  const marker = join(root, "docker-commands.jsonl");
  writeFileSync(
    join(root, "bin/docker"),
    `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(marker)},JSON.stringify(args)+'\\n');
if(args.includes('config')&&args.includes('--format')){console.log(JSON.stringify({services:{wordpress:{healthcheck:{test:['CMD','php','-r','$s=1;']},environment:{WORDPRESS_CONFIG_EXTRA:'$_SERVER'}}}}));process.exit(0);}
if(args.includes('install')){console.error('FICTIONAL_SETUP_FAILURE');process.exit(7);}process.exit(0);
`,
    { mode: 0o755 },
  );
  return marker;
}

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
if(args.includes('config')&&args.includes('--format')) console.log(JSON.stringify({services:{wordpress:{healthcheck:{test:['CMD','php','-r','$s=1;']},environment:{WORDPRESS_CONFIG_EXTRA:'$_SERVER'}}}}));
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

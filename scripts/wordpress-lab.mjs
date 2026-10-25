// MIT. A bounded local lab, using the actual WordPress and EmDash runtimes.
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import {
  existsSync,
  openSync,
  closeSync,
  lstatSync,
  chmodSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(repository, "labs/wordpress/weekender");
const versions = JSON.parse(
  readFileSync(join(fixture, "versions.json"), "utf8"),
);
const schema = "app-composer.wordpress-lab/1";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const dockerHost = "unix:///Users/deanlofts/.orbstack/run/docker.sock";
const args = process.argv.slice(2);
const action = args.shift();
if (
  ![
    "run",
    "resume",
    "status",
    "source-off",
    "down",
    "snapshot",
    "destination",
    "transport",
    "exporter",
  ].includes(action) ||
  args.length !== 2 ||
  args[0] !== "--run" ||
  !isAbsolute(args[1])
) {
  console.error(
    "Use node scripts/wordpress-lab.mjs run|resume|status|snapshot|destination|transport|exporter|source-off|down --run /absolute/ignored-output/run.json. run owns finally cleanup; down ends only this run. No remote deployment is implemented.",
  );
  process.exit(1);
}
const runPath = args[1];
function writeRun(run) {
  writeFileSync(runPath, JSON.stringify(run, null, 2) + "\n", { mode: 0o600 });
}
function loadRun() {
  const run = JSON.parse(readFileSync(runPath, "utf8"));
  if (
    run.schema !== schema ||
    !/^composer-weekender-[a-f0-9]{12}$/.test(run.project) ||
    !isAbsolute(run.root) ||
    dirname(run.root) !== realpathSync(tmpdir()) ||
    !/^composer-weekender-[a-zA-Z0-9-]+$/.test(run.root.split("/").pop()) ||
    !/^[a-f0-9]{32}$/.test(run.nonce) ||
    run.project !== "composer-weekender-" + run.nonce.slice(0, 12)
  )
    throw Error("Select this lab’s registered run, not an unrelated project.");
  if (
    !existsSync(run.root) ||
    lstatSync(run.root).isSymbolicLink() ||
    realpathSync(run.root) !== run.root
  )
    throw Error("The owned lab directory is absent or changed.");
  const marker = JSON.parse(readFileSync(join(run.root, "ownership.json")));
  if (
    marker.schema !== schema ||
    marker.nonce !== run.nonce ||
    run.dockerHost !== dockerHost
  )
    throw Error("Lab ownership or selected Docker endpoint changed.");
  return run;
}
function docker(run, argv, options = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: join(run.root, "home"),
    TMPDIR: join(run.root, "tmp"),
    DOCKER_CONFIG: join(run.root, "docker"),
  };
  const result = spawnSync(
    "docker",
    ["--config", join(run.root, "docker"), "--host", run.dockerHost, ...argv],
    {
      encoding: "utf8",
      env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 180000,
      ...options,
    },
  );
  if (result.error || result.status !== 0)
    throw Error(
      "Owned Docker operation failed: " +
        (result.stderr || result.error?.message || result.status),
    );
  return result.stdout;
}
function compose(run, argv, options) {
  return docker(
    run,
    [
      "compose",
      "--project-name",
      run.project,
      "--project-directory",
      run.root,
      "--file",
      join(run.root, "compose.json"),
      "--env-file",
      join(run.root, "source.env"),
      ...argv,
    ],
    options,
  );
}
function wp(run, argv, options) {
  return compose(
    run,
    ["run", "--rm", "--no-deps", "-T", "cli", "wp", ...argv],
    options,
  );
}
async function availablePort() {
  return await new Promise((accept, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => accept(port));
    });
  });
}
function snapshot(run) {
  const inventory = JSON.parse(
    wp(run, ["eval-file", "/fixture/inventory.php"]),
  );
  if (
    inventory.version !== versions.wordpress.version ||
    inventory.fictional !== true
  )
    throw Error(
      "The source engine/fixture does not match the reviewed version.",
    );
  writeFileSync(
    join(run.root, "inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );
  writeFileSync(
    join(dirname(runPath), "source-inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );
  wp(run, ["export", "--dir=/evidence", "--filename_format=weekender.xml"]);
  const wxr = readFileSync(join(run.root, "evidence/weekender.xml"));
  if (wxr.length > 2 * 1024 * 1024 || !wxr.includes("<wp:wxr_version>"))
    throw Error(
      "The native WordPress WXR export is absent or unexpectedly large.",
    );
  writeFileSync(join(dirname(runPath), "source-wordpress-export.xml"), wxr);
  const runtime = {
    core: wp(run, ["core", "version"]).trim(),
    cli: wp(run, ["cli", "version"]).trim(),
    php: wp(run, ["eval", "echo PHP_VERSION;"]).trim(),
    database: compose(run, [
      "exec",
      "-T",
      "database",
      "mariadb",
      "--version",
    ]).trim(),
  };
  const result = {
    fictional: true,
    nativeWordPressExport: true,
    wxrSHA256: hash(wxr),
    wxrBytes: wxr.length,
    runtime,
    publicArticles: inventory.articles.filter((p) => p.status === "publish")
      .length,
    privateArticles: inventory.articles.filter((p) => p.status !== "publish")
      .length,
    pages: inventory.pages.length,
  };
  writeFileSync(
    join(dirname(runPath), "source-snapshot.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  run.stage = "source-exported";
  run.sourceOrigin = inventory.articles.find((p) => p.status === "publish")?.url
    ? new URL(inventory.articles.find((p) => p.status === "publish").url).origin
    : run.sourceOrigin;
  writeRun(run);
  return result;
}
// Only the reviewed vendor assets below can be acquired, under this run root.
async function acquire(run, url, sha256, name) {
  const allowed = [versions.cloudflared.macOSArm64, versions.exporter.url];
  if (
    !allowed.includes(url) ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    !/^[a-z0-9.-]+$/.test(name)
  )
    throw Error("Choose the reviewed pinned vendor asset.");
  const path = join(run.root, name);
  if (existsSync(path)) {
    if (
      lstatSync(path).isSymbolicLink() ||
      !lstatSync(path).isFile() ||
      hash(readFileSync(path)) !== sha256
    )
      throw Error("Existing owned tool bytes differ; no file was replaced.");
    return path;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (
    !response.ok ||
    ![
      "github.com",
      "release-assets.githubusercontent.com",
      "objects.githubusercontent.com",
    ].includes(new URL(response.url).hostname)
  )
    throw Error("Reviewed vendor download failed.");
  const chunks = [];
  let length = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 33554432)
        throw Error("Reviewed asset exceeds the bounded download size.");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks);
  if (hash(bytes) !== sha256)
    throw Error("Reviewed vendor checksum differs; no tool was installed.");
  writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
  return path;
}
async function transport(run) {
  if (process.platform !== "darwin" || process.arch !== "arm64")
    throw Error(
      "This reviewed cloudflared pin is macOS arm64; select a reviewed platform pin first.",
    );
  const binary = join(run.root, "cloudflared"),
    log = join(run.root, "tunnel.log");
  if (existsSync(binary)) {
    if (
      lstatSync(binary).isSymbolicLink() ||
      hash(readFileSync(binary)) !== versions.cloudflared.binarySHA256
    )
      throw Error("Existing owned cloudflared bytes differ.");
  } else {
    const archive = await acquire(
      run,
      versions.cloudflared.macOSArm64,
      versions.cloudflared.archiveSHA256,
      "cloudflared.tgz",
    );
    const unpack = spawnSync(
      "tar",
      ["-xzf", archive, "-C", run.root, "cloudflared"],
      { encoding: "utf8", timeout: 10000 },
    );
    if (
      unpack.status !== 0 ||
      hash(readFileSync(binary)) !== versions.cloudflared.binarySHA256
    )
      throw Error("Pinned cloudflared extraction failed.");
    chmodSync(binary, 0o700);
  }
  const alive =
    Number.isSafeInteger(run.cloudflared?.pid) &&
    spawnSync("ps", ["-p", String(run.cloudflared.pid), "-o", "command="], {
      encoding: "utf8",
    }).stdout.startsWith(
      binary + " tunnel --url http://127.0.0.1:" + run.port + " ",
    );
  if (
    alive &&
    /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(run.sourceOrigin)
  ) {
    const health = await fetch(run.sourceOrigin + "/wp-json/", {
      signal: AbortSignal.timeout(15000),
    });
    if (
      !health.ok ||
      (await health.json()).name !== "Macedon Weekender — fictional lab"
    )
      throw Error(
        "The existing fictional HTTPS source is unhealthy; no source URL was changed.",
      );
    console.log(
      "Reused the exact pinned owned source transport: " + run.sourceOrigin,
    );
    return;
  }
  if (run.cloudflared?.pid) stopSourceTunnel(run);
  const fd = openSync(log, "w", 0o600);
  let child;
  try {
    child = spawn(
      binary,
      [
        "tunnel",
        "--url",
        "http://127.0.0.1:" + run.port,
        "--no-autoupdate",
        "--metrics",
        "127.0.0.1:0",
      ],
      {
        env: {
          PATH: process.env.PATH,
          HOME: join(run.root, "home"),
          TMPDIR: join(run.root, "tmp"),
        },
        stdio: ["ignore", fd, fd],
      },
    );
  } finally {
    closeSync(fd);
  }
  run.cloudflared = {
    pid: child.pid,
    path: binary,
    version: versions.cloudflared.version,
    binarySHA256: versions.cloudflared.binarySHA256,
    archiveSHA256: versions.cloudflared.archiveSHA256,
    log,
    globalInstall: false,
  };
  writeRun(run);
  let startupError;
  child.once("error", (error) => {
    startupError = error;
  });
  child.unref();
  try {
    let origin;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (startupError)
        throw Error("The owned source transport could not start.");
      origin = readFileSync(log, "utf8").match(
        /https:\/\/[a-z0-9-]+\.trycloudflare\.com/,
      )?.[0];
      if (origin) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!origin)
      throw Error("The bounded temporary HTTPS source did not become ready.");
    if (wp(run, ["option", "get", "composer_weekender_fixture"]).trim() !== "1")
      throw Error(
        "Select the seeded fictional source before source URL changes.",
      );
    const old = run.sourceOrigin;
    wp(run, [
      "search-replace",
      old,
      origin,
      "--all-tables",
      "--precise",
      "--skip-columns=guid",
      "--report-changed-only",
    ]);
    wp(run, ["option", "update", "home", origin]);
    wp(run, ["option", "update", "siteurl", origin]);
    run.sourceLocalOrigin = "http://localhost:" + run.port;
    run.sourceOrigin = origin;
    writeRun(run);
    snapshot(run);
    console.log(
      "Temporary fictional source HTTPS: " +
        origin +
        ". Native WXR was re-exported after its URL update.",
    );
  } catch (error) {
    stopSourceTunnel(run);
    throw error;
  }
}
async function exporter(run) {
  if (
    !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(run.sourceOrigin) ||
    wp(run, ["option", "get", "composer_weekender_fixture"]).trim() !== "1"
  )
    throw Error(
      "Prepare this seeded fictional source’s HTTPS transport first.",
    );
  const archive = await acquire(
    run,
    versions.exporter.url,
    versions.exporter.sha256,
    "emdash-exporter.zip",
  );
  const installed = wp(run, [
    "plugin",
    "list",
    "--name=emdash-exporter",
    "--format=json",
  ]);
  const list = JSON.parse(installed);
  if (list.length && list[0].version !== versions.exporter.version)
    throw Error("An existing exporter version differs; it was preserved.");
  if (!list.length) {
    copyFileSync(archive, join(run.root, "evidence/emdash-exporter.zip"));
    chmodSync(join(run.root, "evidence/emdash-exporter.zip"), 0o644);
    wp(run, [
      "plugin",
      "install",
      "/evidence/emdash-exporter.zip",
      "--activate",
    ]);
  } else wp(run, ["plugin", "activate", "emdash-exporter"]);
  // CLI has no incoming HTTPS request; the actual source is already HTTPS.
  // Use the vendor key generator and normal application-password authentication.
  const result = JSON.parse(
    wp(run, [
      "--user=fictional-editor",
      "eval",
      '$_SERVER["HTTPS"]="on"; echo json_encode(EmDash_Migration_Key::generate());',
    ]),
  );
  if (typeof result.key !== "string" || !result.key.startsWith("em1."))
    throw Error(
      "Native exporter key generation failed; no credential was printed.",
    );
  mkdirSync(join(run.root, "private"), { recursive: true, mode: 0o700 });
  const path = join(run.root, "private/migration-key.json");
  writeFileSync(path, JSON.stringify(result) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
  console.log(
    "Pinned native exporter ready. Use the private migration key in the ordinary owner import UI: " +
      path +
      ". Never copy the key into evidence.",
  );
}

function stopSourceTunnel(run) {
  const pid = run.cloudflared?.pid;
  if (!Number.isSafeInteger(pid)) return;
  const command = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  }).stdout.trim();
  if (!command) return;
  const expected =
    join(run.root, "cloudflared") +
    " tunnel --url http://127.0.0.1:" +
    run.port;
  if (!command.startsWith(expected + " "))
    throw Error(
      "The registered tunnel PID changed; no unrelated process was stopped.",
    );
  process.kill(pid, "SIGTERM");
}

function cleanup(run) {
  let failure;
  stopSourceTunnel(loadRun());
  try {
    compose(run, ["down", "--volumes", "--remove-orphans", "--timeout", "10"]);
  } catch (error) {
    failure = error.message;
  }
  const receipt = {
    schema,
    project: run.project,
    sourceBase: run.sourceBase,
    resources: run.resources,
    stoppedAt: new Date().toISOString(),
    dockerDownSucceeded: !failure,
    failure: failure ?? null,
    rootRemoved: false,
  };
  if (!failure) {
    // The source controller does not own browsers or dev servers launched by an
    // operator. Never remove their files while they are still running. Finish
    // the run-level finally block by closing only its registered consumers, then
    // call down again to recover this same exact root.
    const consumers = spawnSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
    })
      .stdout.split("\n")
      .filter(
        (line) =>
          line.includes(run.root + "/") &&
          !line.trim().startsWith(String(process.pid) + " "),
      );
    if (consumers.length)
      failure =
        "Owned local browser/dev consumers remain active; close this run’s consumers before down. Runtime files were retained.";
  }
  receipt.failure = failure ?? null;
  if (!failure) {
    const selected = loadRun();
    if (selected.nonce !== run.nonce)
      throw Error("Owned cleanup identity changed.");
    rmSync(run.root, { recursive: true });
    receipt.rootRemoved = !existsSync(run.root);
  }
  writeFileSync(
    join(dirname(runPath), "cleanup.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  if (failure) throw Error("Retained owned runtime for inspection: " + failure);
}
async function start(run) {
  const port = run.port;
  const composeConfig = {
    services: {
      database: {
        image: versions.database.image,
        environment: {
          MARIADB_DATABASE: "weekender",
          MARIADB_USER: "weekender",
          MARIADB_PASSWORD: "${LAB_DATABASE_PASSWORD}",
          MARIADB_ROOT_PASSWORD: "${LAB_ROOT_PASSWORD}",
        },
        volumes: ["database:/var/lib/mysql"],
        healthcheck: {
          test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"],
          interval: "2s",
          timeout: "5s",
          retries: 40,
        },
        cpus: 0.5,
        mem_limit: "384m",
        labels: { "dev.app-composer.lab": run.nonce },
      },
      wordpress: {
        image: versions.wordpress.image,
        depends_on: { database: { condition: "service_healthy" } },
        ports: ["127.0.0.1:" + port + ":80"],
        environment: {
          WORDPRESS_DB_HOST: "database",
          WORDPRESS_DB_NAME: "weekender",
          WORDPRESS_DB_USER: "weekender",
          WORDPRESS_DB_PASSWORD: "${LAB_DATABASE_PASSWORD}",
          WORDPRESS_CONFIG_EXTRA:
            "define('WP_ENVIRONMENT_TYPE','local'); define('AUTOMATIC_UPDATER_DISABLED',true); define('WP_AUTO_UPDATE_CORE',false); define('DISALLOW_FILE_EDIT',true); if (isset($$_SERVER['HTTP_X_FORWARDED_PROTO']) && $$_SERVER['HTTP_X_FORWARDED_PROTO']==='https') { $$_SERVER['HTTPS']='on'; }",
        },
        volumes: ["wordpress:/var/www/html"],
        healthcheck: {
          test: [
            "CMD",
            "php",
            "-r",
            '$$s=@fsockopen("127.0.0.1",80);exit($$s?0:1);',
          ],
          interval: "2s",
          timeout: "5s",
          retries: 40,
        },
        cpus: 0.5,
        mem_limit: "384m",
        labels: { "dev.app-composer.lab": run.nonce },
      },
      cli: {
        image: versions.cli.image,
        profiles: ["tools"],
        user: "33:33",
        environment: {
          WORDPRESS_DB_HOST: "database",
          WORDPRESS_DB_NAME: "weekender",
          WORDPRESS_DB_USER: "weekender",
          WORDPRESS_DB_PASSWORD: "${LAB_DATABASE_PASSWORD}",
          HOME: "/tmp",
        },
        volumes: [
          "wordpress:/var/www/html",
          fixture + ":/fixture:ro",
          join(run.root, "evidence") + ":/evidence",
        ],
        working_dir: "/var/www/html",
        cpus: 0.5,
        mem_limit: "192m",
        labels: { "dev.app-composer.lab": run.nonce },
      },
    },
    volumes: { database: {}, wordpress: {} },
  };
  writeFileSync(
    join(run.root, "compose.json"),
    JSON.stringify(composeConfig, null, 2) + "\n",
  );
  run.resources = [
    run.project + "-wordpress-1",
    run.project + "-database-1",
    run.project + "_wordpress",
    run.project + "_database",
    run.project + "_default",
  ];
  writeRun(run);
  const effective = JSON.parse(compose(run, ["config", "--format", "json"]));
  if (
    !effective.services.wordpress.healthcheck.test.at(-1).includes("$s=") ||
    !effective.services.wordpress.environment.WORDPRESS_CONFIG_EXTRA.includes(
      "$_SERVER",
    )
  )
    throw Error(
      "Compose changed the literal PHP variables; refusing source startup.",
    );
  compose(run, [
    "up",
    "--detach",
    "--wait",
    "--wait-timeout",
    "120",
    "database",
    "wordpress",
  ]);
  // A fresh installation only. The password is stdin, never an argument or evidence.
  wp(
    run,
    [
      "core",
      "install",
      "--url=" + run.sourceOrigin,
      "--title=Macedon Weekender — fictional lab",
      "--admin_user=fictional-editor",
      "--admin_email=editor@example.test",
      "--skip-email",
      "--prompt=admin_password",
    ],
    { input: readFileSync(join(run.root, "wp-password"), "utf8") },
  );
  wp(run, ["eval-file", "/fixture/seed.php"]);
  return snapshot(run);
}

try {
  if (action === "run") {
    if (existsSync(runPath))
      throw Error(
        "Use a new absent run registry. Existing lab sources are never overwritten.",
      );
    if (!existsSync(dirname(runPath)))
      throw Error("Create the selected ignored evidence folder first.");
    const port = await availablePort();
    const sourceBase = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: repository,
      encoding: "utf8",
    }).stdout.trim();
    const nonce = randomBytes(16).toString("hex");
    const root = mkdtempSync(
      join(realpathSync(tmpdir()), "composer-weekender-"),
    );
    let registered = false;
    let keepAlive;
    let run;
    try {
      run = {
        schema,
        nonce,
        root,
        project: "composer-weekender-" + nonce.slice(0, 12),
        dockerHost,
        sourceBase,
        pid: process.pid,
        port,
        stage: "registered",
        resources: [],
        sourceOrigin: "",
      };
      run.sourceOrigin = "http://localhost:" + run.port;
      for (const name of ["home", "tmp", "docker", "evidence"])
        mkdirSync(join(root, name));
      chmodSync(join(root, "evidence"), 0o777);
      writeFileSync(
        join(root, "ownership.json"),
        JSON.stringify({ schema, nonce }),
      );
      writeFileSync(
        join(root, "docker/config.json"),
        JSON.stringify({
          cliPluginsExtraDirs: [
            "/Applications/OrbStack.app/Contents/MacOS/xbin",
          ],
        }) + "\n",
      );
      writeFileSync(
        join(root, "source.env"),
        "LAB_DATABASE_PASSWORD=" +
          randomBytes(24).toString("hex") +
          "\nLAB_ROOT_PASSWORD=" +
          randomBytes(24).toString("hex") +
          "\n",
        { mode: 0o600 },
      );
      writeFileSync(
        join(root, "wp-password"),
        randomBytes(30).toString("base64url") + "\n",
        { mode: 0o600 },
      );
      writeRun(run);
      registered = true;
      const stopped = new Promise((accept) => {
        process.once("SIGINT", accept);
        process.once("SIGTERM", accept);
      });
      keepAlive = setInterval(() => {}, 60000);
      console.log(JSON.stringify(await start(run), null, 2));
      console.log(
        "Fictional WordPress ready at " +
          run.sourceOrigin +
          ". Registry: " +
          runPath,
      );
      console.log(
        "Source remains alive for the actual authenticated EmDash import. Send SIGTERM or run down to finish only this lab and execute finally cleanup.",
      );
      await stopped;
    } finally {
      clearInterval(keepAlive);
      if (registered) cleanup(run);
      else {
        // No Docker operation or external consumer is possible before registration.
        // The exact freshly allocated staging root is still owned on setup errors.
        rmSync(root, { recursive: true });
        writeFileSync(
          join(dirname(runPath), "cleanup.json"),
          JSON.stringify(
            {
              schema,
              project: run?.project ?? null,
              sourceBase,
              resources: [],
              stoppedAt: new Date().toISOString(),
              dockerDownSucceeded: true,
              failure: "Registration failed before any Docker operation.",
              rootRemoved: !existsSync(root),
            },
            null,
            2,
          ) + "\n",
        );
      }
    }
  } else if (action === "resume") {
    const run = loadRun();
    const old = spawnSync("ps", ["-p", String(run.pid), "-o", "command="], {
      encoding: "utf8",
    }).stdout.trim();
    if (old)
      throw Error(
        "The registered PID is still active; do not replace its controller.",
      );
    const stopped = new Promise((accept) => {
      process.once("SIGINT", accept);
      process.once("SIGTERM", accept);
    });
    const keepAlive = setInterval(() => {}, 60000);
    run.pid = process.pid;
    writeRun(run);
    console.log(
      "Resumed cleanup ownership of this exact existing fictional source: " +
        run.sourceOrigin,
    );
    try {
      await stopped;
    } finally {
      clearInterval(keepAlive);
      cleanup(run);
    }
  } else {
    const run = loadRun();
    if (action === "destination") {
      if (run.stage !== "source-exported")
        throw Error(
          "Export the actual healthy WordPress source before creating its destination.",
        );
      const { createContentProject } =
        await import("../lib/content-model/project.mjs");
      const destination = join(run.root, "destination");
      const model = {
        schema: "app-composer.content-model",
        version: 1,
        collection: "posts",
        label: "Macedon Weekender",
        groups: ["Story"],
        fields: [
          {
            key: "title",
            label: "Title",
            type: "string",
            required: true,
            group: "Story",
          },
          {
            key: "excerpt",
            label: "Excerpt",
            type: "text",
            required: false,
            group: "Story",
          },
        ],
      };
      const inventory = JSON.parse(
        readFileSync(join(run.root, "inventory.json"), "utf8"),
      );
      const routes = [
        ...inventory.articles.map((item) => ({ ...item, collection: "posts" })),
        ...inventory.pages.map((item) => ({ ...item, collection: "pages" })),
      ].map((item) => {
        const url = new URL(item.url);
        if (
          url.origin !== run.sourceOrigin ||
          url.username ||
          url.password ||
          (url.search && url.search !== "?p=" + item.id) ||
          url.hash ||
          url.pathname.length > 512 ||
          !/^[a-z0-9-]{1,200}$/.test(item.slug)
        )
          throw Error(
            "An actual source route needs a bounded mapping decision.",
          );
        return {
          wordpressId: item.id,
          collection: item.collection,
          slug: item.slug,
          path: url.pathname,
          query: url.search,
        };
      });
      const overlay = join(fixture, "destination");
      const targetPackage = JSON.parse(
        readFileSync(join(overlay, "package.json"), "utf8"),
      );
      if (
        targetPackage.dependencies?.emdash !== versions.destination.emdash ||
        targetPackage.dependencies?.["@emdash-cms/cloudflare"] !==
          versions.destination.emdash ||
        targetPackage.dependencies?.astro !== versions.destination.astro ||
        targetPackage.devDependencies?.wrangler !==
          versions.destination.wrangler ||
        targetPackage.packageManager !== "pnpm@" + versions.destination.pnpm
      )
        throw Error(
          "The publisher overlay does not match its reviewed destination toolchain.",
        );
      createContentProject({ model, destination });
      // The generic recipe's empty branding JSON predates its format gate.
      // Normalize whitespace locally without changing its values or release boundary.
      const brandingPath = join(destination, "src/launch-kit-branding.json");
      writeFileSync(
        brandingPath,
        JSON.stringify(
          JSON.parse(readFileSync(brandingPath, "utf8")),
          null,
          2,
        ) + "\n",
      );
      const authored = {};
      for (const relative of readdirSync(overlay, { recursive: true })) {
        const source = join(overlay, relative);
        if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink())
          continue;
        const output = join(destination, relative);
        mkdirSync(dirname(output), { recursive: true });
        copyFileSync(source, output);
        authored[relative] = hash(readFileSync(source));
      }
      writeFileSync(
        join(destination, "src/old-routes.json"),
        JSON.stringify(routes, null, 2) + "\n",
      );
      writeFileSync(
        join(destination, "weekender-lab.json"),
        JSON.stringify(
          {
            sourceBase: run.sourceBase,
            recipe: "Composer createContentProject",
            destinationToolchain: versions.destination,
            overlay: authored,
            oldRoutesSHA256: hash(Buffer.from(JSON.stringify(routes))),
            seededDestinationEntries: 0,
            imported: false,
          },
          null,
          2,
        ) + "\n",
      );
      run.destination = destination;
      writeRun(run);
      console.log(
        "Created an empty independent Composer recipe destination: " +
          destination,
      );
      console.log(
        "Install its frozen dependencies, run its checks/dev server, then use the authenticated native EmDash WordPress importer. No destination entries or owner were seeded.",
      );
    }
    if (action === "status")
      console.log(
        JSON.stringify(
          {
            stage: run.stage,
            sourceOrigin: run.sourceOrigin,
            project: run.project,
            sourceBase: run.sourceBase,
          },
          null,
          2,
        ),
      );
    if (action === "transport") await transport(run);
    if (action === "exporter") await exporter(run);
    if (action === "snapshot")
      console.log(JSON.stringify(snapshot(run), null, 2));
    if (action === "source-off") {
      stopSourceTunnel(run);
      compose(run, ["stop", "wordpress", "database"]);
      run.stage = "source-off";
      writeRun(run);
      console.log(
        "Stopped only this fictional WordPress/database pair. The independent EmDash target must now be verified in a fresh empty-cache browser.",
      );
    }
    if (action === "down") {
      const command = spawnSync(
        "ps",
        ["-p", String(run.pid), "-o", "command="],
        { encoding: "utf8" },
      ).stdout.trim();
      if (!command) {
        cleanup(run);
        console.log(
          "Recovered only the registered stopped controller’s owned lab resources.",
        );
      } else {
        if (
          !["run", "resume"].some((mode) =>
            command.includes(
              "scripts/wordpress-lab.mjs " + mode + " --run " + runPath,
            ),
          )
        )
          throw Error(
            "The registered PID belongs to another process; inspect exact owned resources before cleanup.",
          );
        process.kill(run.pid, "SIGTERM");
        console.log(
          "Requested owned controller finally cleanup. Inspect cleanup.json after it exits.",
        );
      }
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

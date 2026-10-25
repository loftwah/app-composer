// A bounded derivative of the existing invited-members lifecycle. Product source stays unchanged.
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  realpathSync,
  statSync,
  copyFileSync,
  constants,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { authenticateNativeActors } from "./native-auth.mjs";
import { nativeJourney } from "./native-journey.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const action = process.argv[2] ?? "prepare";
const arg = (name) => {
  const i = process.argv.indexOf("--" + name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const sources = {
  composer: repo,
  guestbook: resolve(
    arg("guestbook") ??
      join(repo, "../app-composer-guestbook-members-20261023"),
  ),
  showcase: resolve(
    arg("showcase") ?? join(repo, "../app-composer-showcase-invited"),
  ),
};
const output = resolve(arg("output") ?? join(repo, "output/platform-native"));
if (!output.startsWith(join(repo, "output") + "/"))
  throw Error(
    "Evidence must remain in this checkout's ignored output directory.",
  );
const pointer = join(output, "local-root");
const availabilityFixture = process.argv.includes("--availability-fixture");
const creatorLifecycle = process.argv.includes("--creator-lifecycle");
const playwright =
  arg("playwright") ??
  "/Users/deanlofts/.npm/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs";
const ffprobe = arg("ffprobe") ?? "/opt/homebrew/bin/ffprobe";
const videoDurationLimitMs = 6 * 60 * 1000;
const videoByteLimit = 32 * 1024 * 1024;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const git = (source, args) =>
  execFileSync("git", args, { cwd: source, encoding: "utf8" }).trim();
const lock = JSON.parse(
  readFileSync(join(repo, "composition.lock.json"), "utf8"),
);
const memberApp = lock.apps.find((app) => app.id === "guestbook");
const memberDescriptor = {
  version: 2,
  entrypoint: "GuestbookMemberService",
  transport: "service-binding",
  path: "/__composer/member",
};
const memberQualified =
  !!memberApp &&
  Object.keys(memberApp.manifest.memberService ?? {}).length === 4 &&
  Object.entries(memberDescriptor).every(
    ([key, value]) => memberApp.manifest.memberService[key] === value,
  ) &&
  memberApp.manifest.configuration.guestAccess.default === "closed" &&
  JSON.stringify(memberApp.manifest.configuration.guestAccess.options) ===
    JSON.stringify(["closed", "postcards", "members"]);
if (action === "run" && !memberQualified)
  throw Error(
    "Member authoring fixture is unavailable on the actual locked source. Release and qualify Guestbook v2, deliberately promote its exact source pin, and integrate Composer first. No pin override or closed-mode substitute is supported.",
  );
const lifecycle = readFileSync(
  join(repo, "labs/invited-members/run.mjs"),
  "utf8",
);
const originalFactory = "return creatorPlugin(options.adminEntry, env);";
const localRuntime =
  "const runtime = { ...env, PLATFORM_PUBLIC_FETCH: (request: Request) => (env as unknown as { PLATFORM_PUBLIC_PAGES: { fetch(request: Request): Promise<Response> } }).PLATFORM_PUBLIC_PAGES.fetch(request) };";
const localFactory =
  localRuntime + "\n  return creatorPlugin(options.adminEntry, runtime);";
const originalMemberFactory = "return memberPlugin(\n    env,";
const localMemberFactory =
  localRuntime + "\n  return memberPlugin(\n    runtime,";
function once(source, before, after) {
  if (source.split(before).length !== 2)
    throw Error(
      "Reviewed lifecycle/source sentinel changed; re-review before running: " +
        before.slice(0, 70),
    );
  return source.replace(before, after);
}
const patch = `
      // Qualification seam in copied source only. Fixed self binding; no owner headers.
      const factoryPath = join(dest, "src/plugins/stacks.ts");
      const originalFactory = ${JSON.stringify(originalFactory)};
      const factorySource = readFileSync(factoryPath, "utf8");
      if (factorySource.split(originalFactory).length !== 2) throw Error("Copied plugin factory changed; re-review local seam.");
      writeFileSync(factoryPath, factorySource.replace(originalFactory, ${JSON.stringify(localFactory)}));
      const memberFactoryPath = join(dest, "src/plugins/members.ts");
      const originalMemberFactory = ${JSON.stringify(originalMemberFactory)};
      const memberFactorySource = readFileSync(memberFactoryPath, "utf8");
      if (memberFactorySource.split(originalMemberFactory).length !== 2) throw Error("Copied member plugin factory changed; re-review local seam.");
      writeFileSync(memberFactoryPath, memberFactorySource.replace(originalMemberFactory, ${JSON.stringify(localMemberFactory)}));
      config.services.push({ binding: "PLATFORM_PUBLIC_PAGES", service: "composer-invited-composer" });
`;
let derived = once(
  lifecycle,
  'const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");',
  "const repo = " + JSON.stringify(repo) + ";",
);
derived = once(
  derived,
  '      run("git", ["init", "-q"], dest);',
  patch + '\n      run("git", ["init", "-q"], dest);',
);
const originalLocalAccount = '"invited-local-account"';
const fictionalLocalAccount = "00000000000000000000000000000001";
if (derived.split(originalLocalAccount).length !== 3)
  throw Error(
    "Reviewed fictional account selection changed; inspect the lifecycle.",
  );
derived = derived.replaceAll(
  originalLocalAccount,
  JSON.stringify(fictionalLocalAccount),
);
// All selected checkouts and exact source pins are checked before allocating any temporary storage.
const identities = {};
const authored = [
  "labs/platform/native-run.mjs",
  "labs/platform/native-auth.mjs",
  "labs/platform/native-capture.mjs",
  "labs/platform/native-journey.mjs",
  "docs/platform/native-demo.md",
  "labs/platform/native-incident.mjs",
  "docs/platform/incident-demo.md",
  "labs/platform/native-export.mjs",
  "labs/platform/native-creator-lifecycle.mjs",
  "docs/platform/native-export.md",
];
const authoredHashes = Object.fromEntries(
  authored.map((path) => [path, hash(readFileSync(join(repo, path)))]),
);
function assertComposerChanges() {
  const changed = [
    ...git(repo, ["diff", "HEAD", "--name-only"]).split("\n"),
    ...git(repo, ["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ].filter(Boolean);
  if (changed.some((path) => !authored.includes(path)))
    throw Error(
      "Composer has changes outside this bounded fixture; coordinate a clean candidate first.",
    );
}
for (const [name, source] of Object.entries(sources)) {
  if (!existsSync(join(source, "node_modules")))
    throw Error("Select an existing installed checkout for " + name);
  const head = git(source, ["rev-parse", "HEAD"]),
    dirty = git(source, ["status", "--porcelain"]);
  // Our new authored lab files may be uncommitted; tracked product changes are never accepted silently.
  if (name === "composer") {
    assertComposerChanges();
  } else {
    const pin = lock.apps.find((app) => app.id === name)?.commit;
    if (head !== pin || dirty)
      throw Error(
        "Use exact clean locked " + name + " checkout; expected " + pin,
      );
  }
  identities[name] = { head, checkout: source, dirty: Boolean(dirty) };
}
function assertSourcesUnchanged() {
  assertComposerChanges();
  for (const [name, source] of Object.entries(sources)) {
    if (
      git(source, ["rev-parse", "HEAD"]) !== identities[name].head ||
      (name !== "composer" && git(source, ["status", "--porcelain"]))
    )
      throw Error(
        "Selected " +
          name +
          " source changed after preflight; no native writes permitted.",
      );
  }
  for (const [path, expected] of Object.entries(authoredHashes))
    if (hash(readFileSync(join(repo, path))) !== expected)
      throw Error(
        "Native fixture changed after preflight; no native writes permitted.",
      );
}
const factorySource = readFileSync(join(repo, "src/plugins/stacks.ts"), "utf8");
const memberFactorySource = readFileSync(
  join(repo, "src/plugins/members.ts"),
  "utf8",
);
const derivedFactory = once(factorySource, originalFactory, localFactory);
const derivedMemberFactory = once(
  memberFactorySource,
  originalMemberFactory,
  localMemberFactory,
);
if (!existsSync(playwright))
  throw Error(
    "Select an existing installed Playwright module; no installation is attempted.",
  );
if (!existsSync(ffprobe))
  throw Error(
    "Select an existing ffprobe binary; no installation is attempted.",
  );
const ports = {};
for (const port of [8443, 8811, 8812, 8813]) {
  ports[port] = await new Promise((resolvePort) => {
    const server = createServer();
    server.once("error", () => resolvePort("occupied"));
    server.listen(port, "127.0.0.1", () =>
      server.close(() => resolvePort("available")),
    );
  });
}
const preflight = {
  schema: "composer.platform-native-preflight/1",
  creatorLifecycle,
  availabilityFixture: {
    enabled: availabilityFixture,
    scope:
      "Owned local visibility fault and deterministic recovery only; vendor/agent/code rollback unavailable",
  },
  composerHead: identities.composer.head,
  fixtureBaseline: "a325a9bfb06a981eb536b807558e197d96efd8cb",
  memberContract: {
    qualified: memberQualified,
    source: memberApp.commit,
    required: memberDescriptor,
    sourceOverride: false,
    nativeExecution: "not-run",
  },
  sources: identities,
  authoredHashes,
  lifecycleSha256: hash(lifecycle),
  derivedLifecycleSha256: hash(derived),
  copiedFactoryPatch: {
    path: "src/plugins/stacks.ts",
    before: originalFactory,
    after: localFactory,
    originalSha256: hash(factorySource),
    derivedSha256: hash(derivedFactory),
  },
  copiedMemberFactoryPatch: {
    path: "src/plugins/members.ts",
    before: originalMemberFactory,
    after: localMemberFactory,
    originalSha256: hash(memberFactorySource),
    derivedSha256: hash(derivedMemberFactory),
  },
  copiedAccountPatch: {
    before: "invited-local-account",
    after: fictionalLocalAccount,
    scope:
      "Fictional local account identity, never a provider account or permission receipt",
  },
  authSha256: hash(readFileSync(new URL("./native-auth.mjs", import.meta.url))),
  journeySha256: hash(
    readFileSync(new URL("./native-journey.mjs", import.meta.url)),
  ),
  playwright: realpathSync(playwright),
  video: {
    ffprobe: realpathSync(ffprobe),
    perActorByteLimit: videoByteLimit,
    continuousCaptureLimitMs: videoDurationLimitMs,
    actors: 4,
  },
  ports,
  admission:
    "Local virtual passkeys. Production Access and physical credentials not exercised.",
  verification:
    "Actual local /s and mounted app handlers through fixed host-configured self service binding; public edge not qualified.",
};
if (action === "prepare") {
  console.log(JSON.stringify(preflight, null, 2));
  process.exit(0);
}
if (action !== "run" || !process.argv.includes("--admitted"))
  throw Error(
    "Use prepare, or run --admitted only after shared host admission.",
  );
if (Object.values(ports).some((status) => status !== "available"))
  throw Error(
    "A required local lab port is occupied; preserve the other process.",
  );
if (existsSync(pointer))
  throw Error(
    "This output already registers a local root; inspect it instead of replacing it.",
  );

mkdirSync(output, { recursive: true });
const owned = mkdtempSync(join(tmpdir(), "composer-platform-native-"));
let browser, lab, activeChild, cleanupError;
const actorContexts = [];
let videoDeadline;
let interrupted = false;
const receipt = {
  schema: "composer.platform-native/1",
  startedAt: new Date().toISOString(),
  preflight,
  qualification: "not-run",
};
const env = { ...process.env, TMPDIR: owned };
const previousTmpdir = process.env.TMPDIR;
// Playwright's parent-side temporary profiles/artifacts also belong to this root.
process.env.TMPDIR = owned;
const runner = join(owned, "native-derived-run.mjs");
async function command(args) {
  await new Promise((yes, no) => {
    const child = spawn(process.execPath, [runner, ...args], {
      cwd: repo,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
    let tail = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (chunk) => {
        tail = (tail + chunk).slice(-16384);
      });
    child.once("error", no);
    child.once("exit", (code) => {
      activeChild = undefined;
      if (code === 0) yes();
      else {
        receipt.lifecycleFailureTail = tail
          .replace(/[a-zA-Z0-9_-]{32,}/g, "[redacted-long-value]")
          .slice(-2500);
        no(
          Error(
            "Owned lifecycle " +
              args[0] +
              " failed, exit " +
              code +
              ". Inspect the bounded receipt; no source or production configuration was changed.",
          ),
        );
      }
    });
  });
}
const abort = () => {
  interrupted = true;
  activeChild?.kill("SIGTERM");
  if (browser) void browser.close().catch(() => {});
};
process.on("SIGINT", abort);
process.on("SIGTERM", abort);
// Do not install session state in persistent output. Browser, certificates, all D1/R2 and copied sources remain owned.
try {
  writeFileSync(runner, derived, { mode: 0o600 });
  assertSourcesUnchanged();
  await command([
    "start",
    "--pointer",
    pointer,
    ...Object.entries(sources).flatMap(([name, source]) => [
      "--" + name,
      source,
    ]),
  ]);
  if (interrupted) throw Error("Native qualification interrupted.");
  assertSourcesUnchanged();
  const inner = readFileSync(pointer, "utf8").trim();
  if (!inner.startsWith(owned + "/"))
    throw Error("Lifecycle escaped the one owned root.");
  lab = JSON.parse(readFileSync(join(inner, "run.json"), "utf8"));
  receipt.copiedSource = {
    ...lab.sources,
    factorySha256: hash(
      readFileSync(join(inner, "composer/src/plugins/stacks.ts")),
    ),
    memberFactorySha256: hash(
      readFileSync(join(inner, "composer/src/plugins/members.ts")),
    ),
    authConfigSha256: hash(
      readFileSync(join(inner, "composer/astro.config.mjs")),
    ),
    entrySha256: hash(readFileSync(join(inner, "composer/lab-entry.ts"))),
    productTree: git(join(inner, "composer"), ["rev-parse", "HEAD^{tree}"]),
  };
  if (
    receipt.copiedSource.factorySha256 !==
      preflight.copiedFactoryPatch.derivedSha256 ||
    receipt.copiedSource.memberFactorySha256 !==
      preflight.copiedMemberFactoryPatch.derivedSha256
  )
    throw Error(
      "Copied native/member public verification factories do not match the reviewed local binding seam.",
    );
  const localConfig = JSON.parse(
    readFileSync(join(inner, "composer/wrangler.local.jsonc"), "utf8"),
  );
  receipt.localConfiguration = {
    sha256: hash(readFileSync(join(inner, "composer/wrangler.local.jsonc"))),
    main: localConfig.main,
    services: localConfig.services,
    vars: {
      PUBLIC_ORIGIN: localConfig.vars.PUBLIC_ORIGIN,
      RESOURCE_ACCOUNT_ID: localConfig.vars.RESOURCE_ACCOUNT_ID,
      RESOURCE_ENVIRONMENT: localConfig.vars.RESOURCE_ENVIRONMENT,
    },
    secretValuesRetained: false,
    localD1: true,
    localR2: true,
  };
  const { chromium } = await import(pathToFileURL(playwright).href);
  if (interrupted) throw Error("Native qualification interrupted.");
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--host-resolver-rules=MAP composer.loftwah.com 127.0.0.1:8443, MAP guestbook.loftwah.com 127.0.0.1:8443, MAP showcase.loftwah.com 127.0.0.1:8443",
      "--no-proxy-server",
    ],
  });
  videoDeadline = setTimeout(() => {
    interrupted = true;
    receipt.videoDeadlineExceeded = true;
    if (browser) void browser.close().catch(() => {});
  }, videoDurationLimitMs);
  const auth = await authenticateNativeActors(browser, lab, {
    output: join(owned, "video"),
    onActorContext: (recording) => actorContexts.push(recording),
  });
  receipt.authentication = { identities: auth.receipt, ...auth.qualification };
  receipt.journey = await nativeJourney({
    actors: auth.actors,
    lab,
    output,
    memberSource: memberApp.commit,
    availabilityFixture: availabilityFixture ? { ownedRoot: owned } : undefined,
    creatorLifecycle,
  });
  receipt.qualification = "passed";
} catch (error) {
  receipt.qualification = "failed";
  receipt.failure = String(error.message).slice(0, 1500);
  receipt.failureViews = [];
  for (const recording of actorContexts) {
    try {
      if (recording.page.isClosed()) continue;
      const address = new URL(recording.page.url());
      const view = {
        actor: recording.key,
        page: address.origin + address.pathname,
        text: (
          await recording.page.locator("body").innerText({ timeout: 2000 })
        )
          .replace(/[a-zA-Z0-9_-]{32,}/g, "[redacted-long-value]")
          .slice(0, 12000),
        buttons: await recording.page.locator("button").evaluateAll((buttons) =>
          buttons.slice(0, 60).map((button) => ({
            text: button.innerText.slice(0, 120),
            disabled: button.disabled,
          })),
        ),
      };
      const filename = "failure-" + recording.key + ".png";
      await recording.page.screenshot({
        path: join(output, filename),
        timeout: 3000,
      });
      receipt.failureViews.push({ ...view, screenshot: filename });
    } catch {
      receipt.failureViews.push({ actor: recording.key, unavailable: true });
    }
  }
  process.exitCode = 1;
} finally {
  clearTimeout(videoDeadline);
  // Closing contexts normally flushes each continuous page recording before browser shutdown.
  for (const recording of actorContexts) {
    try {
      await recording.context.close();
    } catch (error) {
      cleanupError = "Actor context close: " + error.message;
    }
  }
  try {
    await browser?.close();
  } catch (error) {
    cleanupError = "Browser close: " + error.message;
  }
  receipt.videos = [];
  for (const recording of actorContexts) {
    if (!recording.video) continue;
    try {
      const temporaryVideo = await recording.video.path();
      const bytes = statSync(temporaryVideo).size;
      if (bytes > videoByteLimit)
        throw Error(
          "Recording exceeds the per-actor byte limit; not retained.",
        );
      const metadata = JSON.parse(
        execFileSync(
          ffprobe,
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration,size:stream=codec_name,width,height,avg_frame_rate",
            "-of",
            "json",
            temporaryVideo,
          ],
          { encoding: "utf8", timeout: 10000, maxBuffer: 65536 },
        ),
      );
      const durationSeconds = Number(metadata.format?.duration);
      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds > videoDurationLimitMs / 1000 + 5
      )
        throw Error(
          "Recording exceeds the duration bound or lacks inspectable duration; not retained.",
        );
      const filename =
        "native-" +
        recording.key +
        "-" +
        identities.composer.head.slice(0, 8) +
        "-" +
        owned.split("-").at(-1) +
        ".webm";
      const destination = join(output, filename);
      // The closed context has already flushed this local file. Copying it does
      // not depend on a browser connection that has deliberately been closed.
      copyFileSync(temporaryVideo, destination, constants.COPYFILE_EXCL);
      receipt.videos.push({
        actor: recording.key,
        path: filename,
        durationSeconds,
        bytes,
        sha256: hash(readFileSync(destination)),
        startedAt: recording.startedAt,
        continuous: true,
        speed: "actual browser recording, no edits or speed changes",
        source: lab?.sources,
        streams: metadata.streams,
        admission:
          "Fictional accounts and local virtual passkeys; production Access unqualified.",
        privateStateExported: false,
      });
    } catch (error) {
      receipt.videos.push({
        actor: recording.key,
        retained: false,
        reason: String(error.message).slice(0, 300),
      });
      process.exitCode = 1;
    }
  }
  receipt.capture = {
    expectedActors: 4,
    retainedActors: receipt.videos.filter((video) => video.path).length,
    status:
      receipt.videos.length === 4 && receipt.videos.every((video) => video.path)
        ? "complete"
        : "incomplete",
    finalIssue221Film: false,
  };
  if (receipt.capture.status !== "complete") process.exitCode = 1;
  try {
    if (existsSync(pointer)) await command(["stop", "--pointer", pointer]);
  } catch (error) {
    cleanupError = "Lifecycle stop: " + error.message;
  }
  // Preserve owned process metadata if stop fails; never erase the only handle to a still-running process.
  try {
    if (!cleanupError) rmSync(owned, { recursive: true, force: true });
  } catch (error) {
    cleanupError = "Owned root removal: " + error.message;
  }
  receipt.finishedAt = new Date().toISOString();
  process.removeListener("SIGINT", abort);
  process.removeListener("SIGTERM", abort);
  if (previousTmpdir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = previousTmpdir;
  receipt.cleanup = {
    browserClosed: !browser || !browser.isConnected(),
    ownedRootRemoved: !existsSync(owned),
    pointerRemoved: !existsSync(pointer),
    ...(cleanupError ? { error: cleanupError, ownedRoot: owned } : {}),
  };
  if (cleanupError) process.exitCode = 1;
  writeFileSync(
    join(output, "receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        qualification: receipt.qualification,
        composerHead: identities.composer.head,
        receipt: join(output, "receipt.json"),
        sha256: hash(readFileSync(join(output, "receipt.json"))),
        cleanup: receipt.cleanup,
      },
      null,
      2,
    ),
  );
  if (
    receipt.cleanup.browserClosed &&
    receipt.cleanup.ownedRootRemoved &&
    receipt.cleanup.pointerRemoved &&
    !cleanupError &&
    process.env.LOFTWAH_VALIDATION_COMPLETION &&
    process.env.LOFTWAH_VALIDATION_GENERATION
  ) {
    writeFileSync(
      process.env.LOFTWAH_VALIDATION_COMPLETION,
      JSON.stringify({
        version: 1,
        generation: process.env.LOFTWAH_VALIDATION_GENERATION,
        cleanup: "complete",
      }),
    );
  }
}

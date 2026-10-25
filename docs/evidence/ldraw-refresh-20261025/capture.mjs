// Bounded live LDraw capture for the Composer source-bound artwork.
//
// One 1440x1000 viewport PNG of https://ldraw.loftwah.com/ at the exact released
// source, from a brand-new persistent Chromium profile (no prior IndexedDB or
// localStorage), dark default, the default Creator journey scene, no library
// dialog and no browser chrome. The pixels are never edited.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const RUN = "/private/var/folders/qm/ltm8shgs7tv9k8qfqgfpjxq80000gn/T/opencode/composer-ldraw-refresh-20261025";
const PROFILE = process.env.CAPTURE_PROFILE ?? RUN + "/chromium-profile";
const OUT = process.env.CAPTURE_OUT ?? RUN + "/capture";
const EXPECTED_SOURCE = "fa7a2ab6171cf53edc53c01630fbba2d5d4888aa";
const LIVE = "https://ldraw.loftwah.com/";
const EXECUTABLE =
  "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell";

if (existsSync(PROFILE)) {
  if (readdirSync(PROFILE).length) throw new Error("Profile directory is not empty: refusing an inherited profile.");
} else {
  mkdirSync(PROFILE, { recursive: true });
}
mkdirSync(OUT, { recursive: true });

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const report = {
  schema: "composer.ldraw-live-capture/1",
  startedAt: new Date().toISOString(),
  url: LIVE,
  expectedSource: EXPECTED_SOURCE,
  browser: {
    executable: EXECUTABLE,
    playwright: JSON.parse(
      readFileSync("/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/package.json", "utf8"),
    ).version,
  },
  profile: { path: PROFILE, preExistingEntries: 0 },
  checks: {},
  problems: [],
};

const problems = report.problems;
const T0 = Date.now();
const milestones = (report.milestones = []);
const mark = (label) => milestones.push({ atMs: Date.now() - T0, label });
const ensure = (condition, message) => {
  if (!condition) problems.push(message);
  return condition;
};

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: EXECUTABLE,
  headless: true,
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  locale: "en-AU",
  timezoneId: "Australia/Melbourne",
});

// Prove the origin storage is empty before any app script runs.
await context.addInitScript(() => {
  // IndexedDB/localStorage are opaque on the initial about:blank; probe only
  // on the real https document, before any app script can write to it.
  if (location.protocol !== "https:") return;
  if (window.__freshProfile) return;
  window.__pageEvents = [];
  window.addEventListener("unhandledrejection", (event) => {
    window.__pageEvents.push({
      kind: "unhandledrejection",
      reasonType: typeof event.reason,
      reason: (() => {
        try {
          return String(event.reason);
        } catch {
          return "unstringifiable";
        }
      })(),
      stack: event.reason?.stack ?? null,
      at: performance.now(),
    });
  });
  window.addEventListener("error", (event) => {
    window.__pageEvents.push({
      kind: "error",
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: (() => {
        try {
          return String(event.error);
        } catch {
          return "unstringifiable";
        }
      })(),
      stack: event.error?.stack ?? null,
      at: performance.now(),
    });
  });
  window.__freshProfile = {
    at: new Date().toISOString(),
    localStorageKeys: (() => {
      try {
        return Object.keys(localStorage);
      } catch {
        return "unavailable";
      }
    })(),
    indexedDb: new Promise((resolve) => {
      try {
        indexedDB
          .databases()
          .then((databases) => resolve(databases.map((database) => database.name)))
          .catch(() => resolve("unavailable"));
      } catch {
        resolve("unavailable");
      }
    }),
  };
});

const page = await context.newPage();
page.on("pageerror", (error) =>
  problems.push(
    "pageerror@" +
      (Date.now() - T0) +
      "ms: " +
      JSON.stringify({
        name: error?.name ?? null,
        message: error?.message ?? null,
        text: String(error),
        stack: error?.stack?.split("\n").slice(0, 6).join("\n") ?? null,
      }),
  ),
);
page.on("requestfailed", (request) =>
  problems.push("requestfailed: " + request.url() + " " + (request.failure()?.errorText ?? "")),
);
page.on("console", (message) => {
  if (message.type() === "error") problems.push("console: " + message.text());
});

// Served release identity, read with the page's own session.
const buildResponse = await context.request.get(LIVE + "build.json");
const buildBytes = await buildResponse.body();
mark("release identity read");
report.release = {
  buildJson: { status: buildResponse.status(), sha256: sha256(buildBytes), body: JSON.parse(buildBytes.toString("utf8")) },
};
const manifestResponse = await context.request.get(LIVE + "app.manifest.json");
const manifestBytes = await manifestResponse.body();
report.release.manifest = {
  status: manifestResponse.status(),
  bytes: manifestBytes.length,
  sha256: sha256(manifestBytes),
  canonicalDigest:
    "sha256:" + sha256(Buffer.from(JSON.stringify(JSON.parse(manifestBytes.toString("utf8"))), "utf8")),
};
ensure(buildResponse.status() === 200, "build.json must serve");
ensure(manifestResponse.status() === 200, "app.manifest.json must serve");
ensure(report.release.buildJson.body.source === EXPECTED_SOURCE, "the live build must be the exact released source");

mark("goto");
const response = await page.goto(LIVE, { waitUntil: "domcontentloaded" });
mark("document loaded");
report.checks.document = { status: response?.status(), url: page.url() };
ensure(response?.status() === 200, "the live editor must answer 200");

await page.waitForSelector(".excalidraw", { state: "attached", timeout: 45000 });
mark("editor attached");
await page.waitForFunction(() => Boolean(window.ldraw), null, { timeout: 45000 });
mark("window.ldraw ready");
report.checks.freshProfile = await page.evaluate(async () => ({
  at: window.__freshProfile?.at,
  localStorageKeys: window.__freshProfile?.localStorageKeys,
  indexedDb: await window.__freshProfile?.indexedDb,
}));
ensure(Array.isArray(report.checks.freshProfile.indexedDb), "IndexedDB must be reachable for the fresh-profile probe");
ensure(report.checks.freshProfile.indexedDb.length === 0, "the capture profile must start with no IndexedDB database");
ensure(
  Array.isArray(report.checks.freshProfile.localStorageKeys) && report.checks.freshProfile.localStorageKeys.length === 0,
  "the capture profile must start with no localStorage keys",
);

await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(
  () => document.fonts.check('32px "Excalifont"') && document.querySelector(".excalidraw"),
  null,
  { timeout: 30000 },
);
// Let the editor finish its post-ready scroll/paint work deterministically.
await page.waitForTimeout(1500);
mark("settled");
report.checks.pageEventsAtCapture = await page.evaluate(() => window.__pageEvents ?? []);
mark("page events read");

report.checks.theme = await page.evaluate(() => ({
  appearance: document.documentElement.dataset.appearance,
  theme: document.documentElement.dataset.theme,
  colorScheme: getComputedStyle(document.documentElement).colorScheme,
  background: getComputedStyle(document.documentElement).backgroundColor,
  storedAppearance: localStorage.getItem("ldraw:appearance"),
  mediaPrefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
  themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
}));
ensure(report.checks.theme.theme === "dark", "the live editor must open in its default dark appearance");
ensure(report.checks.theme.appearance === "dark", "the default appearance preference must remain dark");

report.checks.scene = await page.evaluate(() => {
  const scene = window.ldraw.readScene();
  const elements = scene.scene.elements ?? [];
  return {
    revision: scene.revision,
    count: elements.length,
    texts: elements
      .filter((element) => typeof element.text === "string")
      .map((element) => element.text),
    types: [...new Set(elements.map((element) => element.type))],
  };
});
ensure(
  report.checks.scene.texts.includes("Creator journey"),
  "the default scene must be the Creator journey preset",
);

report.checks.chrome = await page.evaluate(() => ({
  title: document.title,
  openDialogs: [...document.querySelectorAll("dialog[open]")].map(
    (dialog) => dialog.getAttribute("aria-label") ?? dialog.className,
  ),
  editorRoots: document.querySelectorAll(".excalidraw").length,
  libraryButton: [...document.querySelectorAll("button")].some((button) =>
    /^Library$/.test(button.textContent.trim()),
  ),
  status: [...document.querySelectorAll("[role=status], .status")]
    .map((node) => node.textContent.trim())
    .filter(Boolean)
    .slice(0, 4),
  bodyText: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 240),
}));
ensure(report.checks.chrome.openDialogs.length === 0, "no library or preview dialog may be open in the capture");
ensure(report.checks.chrome.editorRoots === 1, "the live page must hold exactly one Excalidraw editor");

report.checks.library = await page.evaluate(() => {
  const flag = localStorage.getItem("ldraw:library:20261025");
  return { installedFlag: flag };
});
ensure(report.checks.library.installedFlag === "1", "the named block library must install on first load");

const file = OUT + "/ldraw-live-1440x1000.png";
mark("screenshot");
await page.screenshot({ path: file, animations: "allow" });
report.capture = {
  file,
  capturedAt: new Date().toISOString(),
  url: page.url(),
  bytes: statSync(file).size,
  sha256: sha256(readFileSync(file)),
};
mark("finished");
report.checks.pageEventsAtEnd = await page.evaluate(() => window.__pageEvents ?? []);
report.finishedAt = new Date().toISOString();
report.problems = problems;
writeFileSync(OUT + "/capture.json", JSON.stringify(report, null, 2) + "\n");
await context.close();
console.log(JSON.stringify(report, null, 2));
if (problems.length) process.exit(1);

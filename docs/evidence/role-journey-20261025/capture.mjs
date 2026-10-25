// Bounded visual evidence for the role-pack and setup-guide surfaces, captured
// from a local render of the committed Composer source. Real pixels only: no
// mock screenshots and no production login. It records layout measurements,
// console errors and the interactions it actually exercised.
//
//   node docs/evidence/role-journey-20261025/capture.mjs
//
// Origin defaults to the local dev server. Images, receipt.json and README live
// beside this script.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shots = resolve(here, "shots");
const origin = (process.env.JOURNEY_ORIGIN ?? "http://127.0.0.1:4377").replace(/\/$/, "");
mkdirSync(shots, { recursive: true });

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return import(process.env.PLAYWRIGHT_MODULE);
  const base = `${process.env.HOME}/.npm/_npx`;
  const candidates = [];
  try {
    for (const entry of readdirSync(base)) {
      const path = `${base}/${entry}/node_modules/playwright/index.mjs`;
      try { candidates.push([statSync(path).mtimeMs, path]); } catch { /* not installed */ }
    }
  } catch { /* no cache */ }
  candidates.sort((a, b) => b[0] - a[0]);
  for (const [, path] of candidates) {
    try { return await import(path); } catch { /* next */ }
  }
  return import("playwright");
}

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pages = [
  { id: "roles", path: "/roles", full: true },
  { id: "roles-qa", path: "/roles/qa", full: true },
  { id: "setup", path: "/setup", full: true },
];
const viewports = [
  { id: "desktop", width: 1440, height: 1000 },
  { id: "phone", width: 390, height: 844 },
];

const playwright = await loadPlaywright();
const browser = await playwright.chromium.launch({ headless: true });
const receipt = {
  schema: "composer.role-journey-evidence/1",
  capturedAt: new Date().toISOString(),
  origin,
  source: execFileSync("git", ["rev-parse", "HEAD"], { cwd: resolve(here, "../../.."), encoding: "utf8" }).trim(),
  workingTree: execFileSync("git", ["status", "--porcelain"], { cwd: resolve(here, "../../.."), encoding: "utf8" }).trim().split("\n").filter(Boolean).slice(0, 30),
  browser: `Chromium ${browser.version()}`,
  scope: "Local Astro render of this source. Public pages only; the owner admin is behind Cloudflare Access and was not opened. Browser emulation is not physical-device or screen-reader acceptance.",
  captures: [],
  checks: [],
  problems: [],
};
const problem = (message) => { receipt.problems.push(message); console.error("PROBLEM", message); };

for (const viewport of viewports) {
  for (const theme of ["dark", "light"]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme, deviceScaleFactor: 1 });
    await context.addInitScript((value) => window.localStorage.setItem("composer-theme", value), theme);
    for (const entry of pages) {
      const page = await context.newPage();
      const errors = [];
      const failed = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text().slice(0, 300)); });
      page.on("requestfailed", (request) => failed.push(`${request.url().slice(0, 160)} ${request.failure()?.errorText ?? ""}`));
      const response = await page.goto(`${origin}${entry.path}`, { waitUntil: "networkidle" });
      if (!response || response.status() !== 200) problem(`${entry.path} answered ${response?.status()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(220);
      const actualTheme = await page.evaluate(() => document.documentElement.dataset.theme);
      if (actualTheme !== theme) problem(`${entry.path} ${theme}: document theme is ${actualTheme}`);
      const measure = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll("body *")]
          .filter((node) => {
            const box = node.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) return false;
            const style = getComputedStyle(node);
            if (style.position === "fixed" || style.overflowX === "auto" || style.overflowX === "scroll") return false;
            return box.right > width + 1 || box.left < -1;
          })
          .slice(0, 8)
          .map((node) => `${node.tagName.toLowerCase()}${node.className ? "." + String(node.className).split(" ").filter(Boolean).slice(0, 2).join(".") : ""} ${Math.round(node.getBoundingClientRect().right)}px`);
        const target = document.querySelector(".pack-index a, .role-row, .setup-guide a");
        return {
          clientWidth: width,
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          body: document.body.scrollWidth - document.body.clientWidth,
          height: document.documentElement.scrollHeight,
          offenders,
          firstControl: target ? { tag: target.tagName.toLowerCase(), text: (target.textContent ?? "").trim().slice(0, 40) } : null,
        };
      });
      if (measure.document > 0 || measure.body > 0) problem(`${entry.path} ${viewport.id} ${theme}: horizontal overflow document ${measure.document} body ${measure.body}`);
      for (const offender of measure.offenders) problem(`${entry.path} ${viewport.id} ${theme}: ${offender} extends past the viewport`);
      const clean = errors.filter((text) => !/favicon|ERR_ABORTED/i.test(text));
      if (clean.length) problem(`${entry.path} ${viewport.id} ${theme}: console errors ${JSON.stringify(clean.slice(0, 3))}`);
      const name = `${entry.id}-${viewport.id}-${theme}.png`;
      await page.screenshot({ path: resolve(shots, name) });
      if (entry.full) await page.screenshot({ path: resolve(shots, `${entry.id}-${viewport.id}-${theme}-full.jpg`), fullPage: true, type: "jpeg", quality: 82 });
      for (const file of [name, entry.full ? `${entry.id}-${viewport.id}-${theme}-full.jpg` : null].filter(Boolean)) {
        const bytes = readFileSync(resolve(shots, file));
        receipt.captures.push({ page: entry.id, viewport: viewport.id, theme, file, bytes: bytes.length, sha256: sha(bytes) });
      }
      receipt.checks.push({ page: entry.id, viewport: viewport.id, theme, status: response?.status() ?? null, ...measure, consoleErrors: clean, failedRequests: failed.slice(0, 5) });
      if (!entry.full) await page.close();
      else await page.close();
    }
    await context.close();
  }
}

// Interactions that the pages actually implement.
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
await context.addInitScript(() => window.localStorage.setItem("composer-theme", "dark"));
const interaction = async (id, path, steps) => {
  const page = await context.newPage();
  const response = await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
  const result = await steps(page);
  receipt.checks.push({ interaction: id, status: response?.status() ?? null, ...result });
  if (result.failed) problem(`${id}: ${result.failed}`);
  await page.close();
};

await interaction("roles-keyboard-first-row", "/roles", async (page) => {
  await page.keyboard.press("Tab");
  const trail = [];
  for (let step = 0; step < 14; step += 1) {
    await page.keyboard.press("Tab");
    trail.push(await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return "body";
      const style = getComputedStyle(active);
      return `${active.tagName.toLowerCase()}:${(active.textContent ?? "").trim().slice(0, 24)} outline=${style.outlineStyle}/${style.outlineWidth}`;
    }));
  }
  const reachedRow = trail.some((entry) => entry.startsWith("a:") || entry.includes("Service Owner"));
  return { trail, reachedRow, failed: reachedRow ? null : "keyboard tab order never reached a role row or link" };
});

await interaction("roles-qa-copy-prompt", "/roles/qa", async (page) => {
  await page.click("#copy-prompt");
  await page.waitForTimeout(300);
  const status = (await page.textContent("#copy-status"))?.trim() ?? "";
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  const ok = /copied|selected/i.test(status) && copied.length > 100;
  return { status, copiedChars: copied.length, failed: ok ? null : `copy status "${status}" clipboard ${copied.length} chars` };
});

await interaction("roles-qa-index-jump", "/roles/qa", async (page) => {
  await page.click('.pack-index a[href="#tests-title"]');
  await page.waitForTimeout(450);
  const top = await page.evaluate(() => document.getElementById("tests-title")?.getBoundingClientRect().top ?? null);
  const heading = await page.evaluate(() => document.getElementById("tests-title")?.textContent?.trim() ?? "");
  return { heading, top: top === null ? null : Math.round(top), failed: heading === "Negative tests" ? null : "index link did not land on the negative tests heading" };
});

await interaction("setup-switch-new-project", "/setup", async (page) => {
  await page.check('input[name="mode"][value="new"]');
  await page.waitForTimeout(250);
  const guide = await page.inputValue("#setup-preview");
  const status = (await page.textContent("[data-setup-status]"))?.trim() ?? "";
  await page.reload({ waitUntil: "networkidle" });
  const restored = await page.inputValue("#setup-preview");
  const ok = guide.includes('"path": "New project"') && restored === guide && /Restored|saved/i.test(status + (await page.textContent("[data-setup-status]") ?? ""));
  return { status, guideChars: guide.length, restoredMatches: restored === guide, failed: ok ? null : `new-project guide ${guide.length} chars, restored=${restored === guide}, status "${status}"` };
});

await interaction("setup-copy-guide", "/setup", async (page) => {
  await page.click("[data-setup-copy]");
  await page.waitForTimeout(350);
  const status = (await page.textContent("[data-setup-status]"))?.trim() ?? "";
  const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  return { status, copiedChars: copied.length, failed: copied.includes("Guide: app-composer.project-setup/1") ? null : "clipboard did not contain the guide" };
});

const themeContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const themePage = await themeContext.newPage();
await themePage.goto(`${origin}/roles`, { waitUntil: "networkidle" });
{
  const page = themePage;
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click("#theme-toggle");
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  const stored = await page.evaluate(() => window.localStorage.getItem("composer-theme"));
  await page.reload({ waitUntil: "networkidle" });
  const reloaded = await page.evaluate(() => document.documentElement.dataset.theme);
  receipt.checks.push({ interaction: "theme-toggle-persists", ...{ before, after, stored, reloaded }, failed: before !== after && stored === after && reloaded === after ? null : "theme toggle did not change and persist" });
  if (before === after || stored !== after || reloaded !== after) problem(`theme-toggle-persists: ${before} -> ${after}, stored ${stored}, reloaded ${reloaded}`);
}
await themeContext.close();

await context.close();
await browser.close();
receipt.summary = {
  captures: receipt.captures.length,
  checks: receipt.checks.length,
  problems: receipt.problems.length,
};
writeFileSync(resolve(here, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt.summary, null, 2));
if (receipt.problems.length) process.exitCode = 1;

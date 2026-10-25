// Bounded local render check for the refreshed LDraw artwork.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const RUN =
  process.env.LDRAW_EVIDENCE_RUN ??
  "/private/var/folders/qm/ltm8shgs7tv9k8qfqgfpjxq80000gn/T/opencode/composer-ldraw-refresh-20261025";
const SHOTS = RUN + "/render";
const ORIGIN = process.env.LDRAW_RENDER_ORIGIN ?? "http://127.0.0.1:4397";
const PROFILE = RUN + "/profile-render";
const EXECUTABLE =
  "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell";
mkdirSync(SHOTS, { recursive: true });

const report = { schema: "composer.ldraw-render-check/1", observedAt: new Date().toISOString(), origin: ORIGIN, checks: [], problems: [] };
const check = (name, pass, detail) => {
  report.checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) report.problems.push({ name, detail });
};

const context = await chromium.launchPersistentContext(PROFILE, {
  executablePath: EXECUTABLE,
  headless: true,
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on("pageerror", (error) => report.problems.push({ name: "pageerror", detail: String(error) }));
page.on("console", (message) => {
  if (message.type() === "error") report.problems.push({ name: "console", detail: message.text() });
});
await page.goto(ORIGIN + "/apps", { waitUntil: "domcontentloaded" });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => document.querySelectorAll("article[data-app]").length === 8);

const card = page.locator("article[data-app]").filter({ hasText: "LDraw" });
const data = await card.evaluate((node) => {
  const links = [...node.querySelectorAll(".app-links a")].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") }));
  const art = node.querySelector(".app-art img");
  return {
    heading: node.querySelector("h2")?.textContent.trim(),
    deviceSummary: node.querySelector(".device-summary")?.textContent.trim().replace(/\s+/g, " "),
    links,
    thumbnail: art && { src: art.getAttribute("src"), naturalWidth: art.naturalWidth, naturalHeight: art.naturalHeight, complete: art.complete },
  };
});
check("the library card names LDraw", data.heading === "LDraw", data.heading);
check(
  "the card tile is the new source-bound name and decodes at 96px",
  data.thumbnail?.complete && data.thumbnail.naturalWidth === 96 &&
    /^\/brand\/apps\/ldraw-tile-fa7a2ab6171c-010cfbd2-r2-96\.webp$/.test(data.thumbnail.src),
  data.thumbnail,
);
check(
  "the card opens the bounded entry, the live origin and the exact new source",
  data.links.some((link) => link.text.startsWith("Open app") && link.href === "/ldraw") &&
    data.links.some((link) => link.text === "Standalone" && link.href === "https://ldraw.loftwah.com/") &&
    data.links.some((link) => link.text.includes("GitHub source") && link.href === "https://github.com/loftwah/app-composer-ldraw/tree/fa7a2ab6171cf53edc53c01630fbba2d5d4888aa"),
  data.links,
);
check("device support separates desktop from the limited phone result", /Desktop supported/.test(data.deviceSummary) && /Phone limited/.test(data.deviceSummary), data.deviceSummary);
await card.scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -140));
await page.waitForTimeout(250);
await page.screenshot({ path: SHOTS + "/apps-1440-dark.png" });

await card.locator("details.app-explanation summary").click();
const preview = await card.locator(".app-screen img").evaluate(async (image) => {
  image.loading = "eager";
  if (image.decode) await image.decode().catch(() => {});
  const response = await fetch(image.currentSrc || image.src);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // naturalWidth is density-corrected for srcset widths; decode the real file.
  const dimensions = new DataView(bytes.buffer).getUint32(21, true);
  return {
    currentSrc: new URL(image.currentSrc || image.src, location.href).pathname,
    complete: image.complete,
    bytes: bytes.length,
    riff: String.fromCharCode(...bytes.slice(0, 4)),
    webp: String.fromCharCode(...bytes.slice(8, 12)),
    width: (dimensions & 0x3fff) + 1,
    height: ((dimensions >>> 14) & 0x3fff) + 1,
  };
});
await card
  .locator("figure.app-screen")
  .screenshot({ path: SHOTS + "/apps-ldraw-preview-1440-dark.png" });
check(
  "the card preview is the new 960px lossless WebP capture",
  preview.complete && preview.width === 960 && preview.height === 667 &&
    preview.currentSrc === "/brand/apps/ldraw-workspace-fa7a2ab6171c-010cfbd2-r2-960.webp" &&
    preview.riff === "RIFF" && preview.webp === "WEBP",
  preview,
);
const features = await card.locator("details.app-explanation").innerText();
check(
  "the explanation names the dark workspace and the named block library",
  /default dark workspace/i.test(features) && /named, editable portfolio blocks/i.test(features),
  features.replace(/\s+/g, " ").slice(0, 320),
);
const caption = await card.locator(".app-screen figcaption").innerText();
check("the tile caption stays honest", /not an LDraw logo/i.test(caption), caption);
await card.locator("details.app-explanation").evaluate((node) => (node.open = false));

await page.keyboard.press("Meta+k");
const dialog = page.locator("#app-navigation");
await dialog.waitFor({ state: "visible" });
await dialog.locator("input[type=search]").fill("LDraw");
await dialog.locator("[data-destination] a").filter({ hasText: "LDraw" }).waitFor();
await page.waitForTimeout(200);
const row = dialog.locator("[data-destination] a").filter({ hasText: "LDraw" });
await dialog
  .locator("img[src$='ldraw-tile-fa7a2ab6171c-010cfbd2-r2-96.webp']")
  .evaluate((image) => image.decode?.().catch(() => {}));
await page.waitForFunction(
  () => {
    const image = document.querySelector(
      "#app-navigation img[src$='ldraw-tile-fa7a2ab6171c-010cfbd2-r2-96.webp']",
    );
    return Boolean(image && image.complete && image.naturalWidth === 96);
  },
  null,
  { timeout: 10000 },
);
const rowData = await row.evaluate((anchor) => {
  const image = anchor.querySelector("img");
  return { href: anchor.getAttribute("href"), src: image?.getAttribute("src"), decoded: !!image && image.complete && image.naturalWidth === 96 };
});
check(
  "the launcher row opens the live editor with the new source-bound tile",
  rowData.href === "https://ldraw.loftwah.com/" && rowData.decoded &&
    rowData.src === "/brand/apps/ldraw-tile-fa7a2ab6171c-010cfbd2-r2-96.webp",
  rowData,
);
await page.screenshot({ path: SHOTS + "/launcher-1440-dark-ldraw.png" });
await page.keyboard.press("Escape");

const html = await (await context.request.get(ORIGIN + "/apps")).text();
check(
  "the server-rendered launcher already carries the new LDraw row",
  /<a href="\/ldraw"><img[^>]*ldraw-tile-fa7a2ab6171c-010cfbd2-r2-96\.webp[^>]*><span>LDraw</.test(html),
  { bytes: html.length },
);

report.finishedAt = new Date().toISOString();
(await import("node:fs")).writeFileSync(SHOTS + "/report.json", JSON.stringify(report, null, 2) + "\n");
await context.close();
console.log(JSON.stringify({ problems: report.problems, checks: report.checks.map((entry) => ({ name: entry.name, pass: entry.pass })) }, null, 2));
if (report.problems.length) process.exit(1);

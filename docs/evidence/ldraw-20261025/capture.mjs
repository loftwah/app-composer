// Bounded LDraw discovery acceptance. Renders the committed Composer source in
// Chromium and records real pixels/measurements. It is a layout/interaction
// probe, not physical-device, stylus or assistive-technology acceptance.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";

const ORIGIN = process.env.LDRAW_EVIDENCE_ORIGIN ?? "http://127.0.0.1:4324";
const OUT = "/private/var/folders/qm/ltm8shgs7tv9k8qfqgfpjxq80000gn/T/opencode/composer-run-20261024/ldraw/docs/evidence/ldraw-20261025";
const SHOTS = OUT;
const LIVE = "https://ldraw.loftwah.com/";
const SOURCE_SHA = "c9c2339a1296ee7c06a7d94f274c69143478acba";
const EXECUTABLE = "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell";
mkdirSync(SHOTS, { recursive: true });

const receipt = {
  schema: "composer.ldraw-acceptance/1",
  observedAt: new Date().toISOString(),
  source: process.env.LDRAW_EVIDENCE_SOURCE ?? null,
  origin: ORIGIN,
  releasedLdrawSource: SOURCE_SHA,
  browser: "Chromium 1248 (Playwright 1.64 alpha headless shell), deviceScaleFactor 1",
  note: "Local production-equivalent Astro dev render of the committed Composer source. No Composer deployment is claimed.",
  fixtures: {
    catalogue: "A local fictional 'LDraw' catalogue contract was inserted into this run's own gitignored D1 dev database only to render /catalogue/ldraw for review. It is not the owner's unpublished native draft; nothing was published, deployed or retained.",
  },
  pages: {},
  captures: [],
  checks: {},
  pageErrors: [],
};

const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });
const problems = [];
function ensure(condition, message) {
  if (!condition) problems.push(message);
  return condition;
}
function overflow(page) {
  return page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
}
async function setTheme(page, theme) {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
  }, theme);
  await page.waitForTimeout(120);
}
async function shot(page, name) {
  const path = SHOTS + "/" + name;
  await page.screenshot({ path });
  receipt.captures.push({
    file: name,
    bytes: statSync(path).size,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  });
}
async function decodeImage(locator) {
  return locator.evaluate(async (image) => {
    image.loading = "eager";
    if (image.decode) await image.decode().catch(() => {});
    return {
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      currentSrc: image.currentSrc || new URL(image.getAttribute("src"), location.href).href,
      src: image.getAttribute("src"),
      alt: image.getAttribute("alt"),
    };
  });
}
function track(page, label) {
  page.on("pageerror", (error) => receipt.pageErrors.push(label + ": " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error") receipt.pageErrors.push(label + " console: " + message.text());
  });
}

// ---- Apps library -----------------------------------------------------------
const library = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const libraryPage = await library.newPage();
track(libraryPage, "apps");
await libraryPage.goto(ORIGIN + "/apps", { waitUntil: "domcontentloaded" });
await libraryPage.evaluate(() => document.fonts.ready);
await libraryPage.waitForFunction(() => document.querySelectorAll("article[data-app]").length === 8);
const card = libraryPage.locator("article[data-app]").filter({ hasText: "LDraw" });
ensure((await card.count()) === 1, "exactly one LDraw card must exist");
const cardData = await card.evaluate((node) => {
  const art = node.querySelector(".app-art img");
  const links = [...node.querySelectorAll(".app-links a")].map((a) => ({
    text: a.textContent.trim(),
    href: a.getAttribute("href"),
  }));
  const preview = node.querySelector(".app-screen img");
  const previewSource = node.querySelector(".app-screen source");
  const summary = node.querySelector(".device-summary");
  return {
    heading: node.querySelector("h2")?.textContent.trim(),
    description: node.querySelector("h2 + p")?.textContent.trim(),
    category: node.querySelector("h2 + p + span")?.textContent.trim(),
    deviceSummary: summary?.textContent.trim().replace(/\s+/g, " "),
    deviceFilterTokens: node.getAttribute("data-devices"),
    links,
    thumbnail: art
      ? { src: art.getAttribute("src"), width: art.getAttribute("width"), naturalWidth: art.naturalWidth, naturalHeight: art.naturalHeight, complete: art.complete }
      : null,
    preview: preview
      ? { src: preview.getAttribute("src"), alt: preview.getAttribute("alt"), naturalWidth: preview.naturalWidth, naturalHeight: preview.naturalHeight }
      : null,
    previewWide: previewSource?.getAttribute("srcset"),
    caption: node.querySelector(".app-screen figcaption")?.textContent.trim().replace(/\s+/g, " "),
  };
});
receipt.pages.apps = cardData;
receipt.checks.card = {
  name: cardData.heading === "LDraw",
  openAppHref: cardData.links.find((link) => link.text.startsWith("Open app"))?.href,
  standaloneHref: cardData.links.find((link) => link.text === "Standalone")?.href,
  sourceHref: cardData.links.find((link) => link.text.includes("GitHub source"))?.href,
  thumbnailDecoded: cardData.thumbnail?.complete === true && cardData.thumbnail.naturalWidth === 96,
  thumbnailSrc: cardData.thumbnail?.src,
  deviceSummary: cardData.deviceSummary,
  deviceFilterTokens: cardData.deviceFilterTokens,
};
ensure(cardData.heading === "LDraw", "the LDraw card must use the LDraw name");
ensure(cardData.links.find((link) => link.text.startsWith("Open app"))?.href === "/ldraw", "Open app must use the bounded Composer entry /ldraw");
ensure(cardData.links.find((link) => link.text === "Standalone")?.href === LIVE, "Standalone must open the live editor exactly");
ensure(cardData.links.find((link) => link.text.includes("GitHub source"))?.href === "https://github.com/loftwah/app-composer-ldraw/tree/" + SOURCE_SHA, "GitHub source must pin the released LDraw source");
ensure(!!cardData.thumbnail?.complete && cardData.thumbnail.naturalWidth === 96, "the LDraw tile must decode at 96px");
ensure(/ldraw-tile-c9c2339a1296-d2e0dc4b-r2-96\.webp$/.test(cardData.thumbnail?.src ?? ""), "the card must use the reviewed LDraw tile");
ensure(/Desktop supported/.test(cardData.deviceSummary) && /Phone limited/.test(cardData.deviceSummary), "device support must separate desktop from the limited phone result");
ensure(!/Tablet/.test(cardData.deviceSummary), "unchecked tablet support must stay out of the positive summary");

// Open the real preview and inspect the shared discovery tile.
await card.locator("details.app-explanation summary").click();
const previewDecoded = await decodeImage(card.locator(".app-screen img"));
receipt.checks.preview = previewDecoded;
ensure(previewDecoded.complete && previewDecoded.naturalWidth > 0, "the LDraw preview must decode");
ensure(/-960\.webp$/.test(new URL(previewDecoded.currentSrc, ORIGIN).pathname), "the preview must select the reviewed 960px capture");
const previewBytes = await (await library.request.get(ORIGIN + new URL(previewDecoded.currentSrc, ORIGIN).pathname)).body();
receipt.checks.previewBytes = { bytes: previewBytes.length, riff: previewBytes.subarray(0, 4).toString("ascii"), webp: previewBytes.subarray(8, 12).toString("ascii") };
ensure(receipt.checks.previewBytes.webp === "WEBP", "the served preview must be a real WebP capture");
// The 96px tile is a typographic wordmark, not a resized screenshot.
const tilePixels = await card.locator(".app-art img").evaluate(async (image) => {
  image.loading = "eager";
  if (image.decode) await image.decode().catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, 96, 96);
  const data = context.getImageData(0, 0, 96, 96).data;
  let white = 0;
  for (let index = 0; index < data.length; index += 4)
    if (data[index] > 250 && data[index + 1] > 250 && data[index + 2] > 250) white += 1;
  return {
    corner: [...context.getImageData(1, 1, 1, 1).data].slice(0, 3),
    centre: [...context.getImageData(48, 48, 1, 1).data].slice(0, 3),
    whitePixels: white,
    currentSrc: image.currentSrc || new URL(image.getAttribute("src"), location.href).href,
  };
});
receipt.checks.tile = tilePixels;
ensure(/ldraw-tile-c9c2339a1296-d2e0dc4b-r2-96\.webp$/.test(new URL(tilePixels.currentSrc, ORIGIN).pathname), "the catalogue tile must be the reviewed LDraw tile");
ensure(Math.abs(tilePixels.corner[0] - 252) < 6 && Math.abs(tilePixels.corner[1] - 91) < 6 && Math.abs(tilePixels.corner[2] - 5) < 6, "the tile field must be the canonical Composer orange");
ensure(tilePixels.whitePixels > 200, "the tile must carry white wordmark ink at 96px");
// Thumbnail crop at its real 96px presentation.
await card.locator(".app-art img").screenshot({ path: SHOTS + "/ldraw-thumbnail-96.png" });
receipt.captures.push({ file: "ldraw-thumbnail-96.png", bytes: statSync(SHOTS + "/ldraw-thumbnail-96.png").size, note: "element screenshot of the real 96x96 catalogue tile" });
await card.locator("details.app-explanation").evaluate((node) => (node.open = false));

for (const theme of ["dark", "light"]) {
  await setTheme(libraryPage, theme);
  receipt.checks["appsOverflow" + theme] = await overflow(libraryPage);
  ensure(receipt.checks["appsOverflow" + theme].document <= 0, "apps library must not overflow horizontally at 1440 " + theme);
  await shot(libraryPage, `apps-1440-${theme}.png`);
}
// The server-rendered launcher rows are the no-JavaScript fallback.
const noScript = await (await library.request.get(ORIGIN + "/apps")).text();
receipt.checks.noScriptFallback = {
  ldrawRow: /<a href="\/ldraw"><img[^>]*ldraw-tile-c9c2339a1296-d2e0dc4b-r2-96\.webp[^>]*><span>LDraw</.test(noScript),
};
ensure(receipt.checks.noScriptFallback.ldrawRow, "the server-rendered launcher must offer /ldraw before JavaScript runs");
await library.close();

// ---- Phone library ----------------------------------------------------------
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const phonePage = await phone.newPage();
track(phonePage, "apps-phone");
await phonePage.goto(ORIGIN + "/apps", { waitUntil: "domcontentloaded" });
await phonePage.evaluate(() => document.fonts.ready);
await phonePage.waitForFunction(() => document.querySelectorAll("article[data-app]").length === 8);
for (const theme of ["dark", "light"]) {
  await setTheme(phonePage, theme);
  const sizes = await overflow(phonePage);
  receipt.checks["appsPhoneOverflow" + theme] = sizes;
  ensure(sizes.document <= 0, "apps library must not overflow horizontally at 390 " + theme);
  await phonePage.locator("article[data-app]").filter({ hasText: "LDraw" }).scrollIntoViewIfNeeded();
  await shot(phonePage, `apps-390-${theme}.png`);
}
await setTheme(phonePage, "dark");
await phonePage.evaluate(() => (document.documentElement.style.fontSize = "200%"));
const phoneZoom = await overflow(phonePage);
receipt.checks.appsPhoneOverflow200 = phoneZoom;
ensure(phoneZoom.document <= 0, "apps library must not overflow at 390 with 200% root text");
await phonePage.locator("article[data-app]").filter({ hasText: "LDraw" }).scrollIntoViewIfNeeded();
await shot(phonePage, "apps-390-dark-200-percent-text.png");
await phonePage.evaluate(() => (document.documentElement.style.fontSize = ""));
await phone.close();

// ---- Catalogue list and detail ---------------------------------------------
// A local fictional fixture contract exercises the detail page. It is not the
// owner's unpublished native draft and nothing is published by this run.
const listContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const listPage = await listContext.newPage();
track(listPage, "catalogue-list");
await listPage.goto(ORIGIN + "/catalogue", { waitUntil: "domcontentloaded" });
await listPage.evaluate(() => document.fonts.ready);
const listData = await listPage.evaluate(() => {
  const rows = [...document.querySelectorAll(".route-row")].map((row) => ({
    title: row.querySelector("h2 a")?.textContent.trim(),
    href: row.querySelector("h2 a")?.getAttribute("href"),
    openApp: row.querySelector("a.button")?.getAttribute("href"),
    deviceSummary: row.querySelector(".device-summary")?.textContent.trim().replace(/\s+/g, " "),
  }));
  return { rows, count: document.querySelector(".small:last-of-type")?.textContent.trim() };
});
receipt.pages.catalogueList = listData;
const listRow = listData.rows.find((row) => row.title === "LDraw");
ensure(listRow?.href === "/catalogue/ldraw" && listRow.openApp === "/ldraw", "the catalogue list must route LDraw to /ldraw");
ensure(/Desktop supported/.test(listRow?.deviceSummary ?? ""), "the catalogue list must show the reviewed LDraw device summary");
await shot(listPage, "catalogue-list-1440-dark.png");
await listPage.setViewportSize({ width: 390, height: 844 });
await setTheme(listPage, "dark");
const listPhone = await overflow(listPage);
receipt.checks.catalogueListPhoneOverflow = listPhone;
ensure(listPhone.document <= 0, "catalogue list must not overflow at 390");
await listPage.locator(".route-row").filter({ hasText: "LDraw" }).scrollIntoViewIfNeeded();
await shot(listPage, "catalogue-list-390-dark.png");
await listContext.close();

const detail = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const detailPage = await detail.newPage();
track(detailPage, "catalogue");
const detailResponse = await detailPage.goto(ORIGIN + "/catalogue/ldraw", { waitUntil: "domcontentloaded" });
receipt.checks.catalogueStatus = detailResponse?.status();
ensure(detailResponse?.status() === 200, "the fixture catalogue detail must render");
await detailPage.evaluate(() => document.fonts.ready);
const detailPreview = await decodeImage(detailPage.locator("figure.app-screen img"));
const detailData = await detailPage.evaluate(() => {
  const figure = document.querySelector("figure.app-screen img");
  const actions = [...document.querySelectorAll(".actions a")].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") }));
  const handoff = [...document.querySelectorAll("section.section")].map((section) => section.textContent.replace(/\s+/g, " ").trim());
  const build = document.querySelector("section.section a[href*='github.com']");
  return {
    title: document.querySelector("h1")?.textContent.trim(),
    lede: document.querySelector(".lede")?.textContent.trim(),
    deviceSummary: document.querySelector(".device-summary")?.textContent.trim().replace(/\s+/g, " "),
    actions,
    preview: figure ? { src: figure.getAttribute("src"), alt: figure.getAttribute("alt") } : null,
    handoff,
    buildHref: build?.getAttribute("href"),
    buildText: build?.textContent.trim(),
    ogImage: document.querySelector("meta[property='og:image']")?.getAttribute("content"),
    ogTitle: document.querySelector("meta[property='og:title']")?.getAttribute("content"),
  };
});
detailData.preview = { ...detailData.preview, ...detailPreview };
receipt.pages.catalogue = detailData;
receipt.checks.catalogue = {
  openAppHref: detailData.actions.find((action) => action.text === "Open app")?.href,
  sourceHref: detailData.actions.find((action) => action.text.includes("GitHub source"))?.href,
  deviceSummary: detailData.deviceSummary,
  previewDecoded: detailData.preview?.complete && detailData.preview.naturalWidth > 0,
  previewSrc: detailData.preview?.src,
  nativeHandoff: detailData.handoff.some((text) => text.includes("native .excalidraw files")),
  noInitWizard: !detailData.handoff.some((text) => text.includes("Configure the supported pair")),
};
ensure(detailData.title === "LDraw", "catalogue detail must be the LDraw entry");
ensure(receipt.checks.catalogue.openAppHref === "/ldraw", "catalogue Open app must use /ldraw");
ensure(detailData.preview?.complete && detailData.preview.naturalWidth > 0, "catalogue preview must decode");
ensure(/ldraw-workspace-c9c2339a1296-d2e0dc4b-r2-960\.webp$/.test(detailData.preview?.src ?? ""), "catalogue detail must show the reviewed workspace capture");
ensure(receipt.checks.catalogue.nativeHandoff, "catalogue detail must offer the native LDraw source handoff");
ensure(receipt.checks.catalogue.noInitWizard, "catalogue detail must not offer the pair Init wizard for LDraw");
for (const theme of ["dark", "light"]) {
  await setTheme(detailPage, theme);
  const sizes = await overflow(detailPage);
  receipt.checks["catalogueOverflow" + theme] = sizes;
  ensure(sizes.document <= 0, "catalogue must not overflow at 1440 " + theme);
  await shot(detailPage, `catalogue-ldraw-1440-${theme}.png`);
}
await detailPage.setViewportSize({ width: 390, height: 844 });
await setTheme(detailPage, "dark");
const catPhone = await overflow(detailPage);
receipt.checks.cataloguePhoneOverflow = catPhone;
ensure(catPhone.document <= 0, "catalogue must not overflow at 390");
await shot(detailPage, "catalogue-ldraw-390-dark.png");
// Share card bytes from the metadata the page publishes.
const shareResponse = await detail.request.get(ORIGIN + new URL(detailData.ogImage).pathname);
const shareBytes = await shareResponse.body();
receipt.checks.share = {
  url: detailData.ogImage,
  status: shareResponse.status(),
  type: shareResponse.headers()["content-type"],
  bytes: shareBytes.length,
  png: shareBytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  width: shareBytes.readUInt32BE(16),
  height: shareBytes.readUInt32BE(20),
};
ensure(shareResponse.status() === 200, "the published share image must serve");
ensure(receipt.checks.share.png && receipt.checks.share.width === 1200 && receipt.checks.share.height === 630, "the share image must be a real 1200x630 PNG");
await detail.close();

// ---- /ldraw entry -----------------------------------------------------------
const entryContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const entryRedirect = await entryContext.request.get(
  ORIGIN + "/ldraw?analytics=off&qa=proof-290&project=private&scene=secret#secret",
  { maxRedirects: 0 },
);
receipt.checks.entryRedirect = { status: entryRedirect.status(), location: entryRedirect.headers()["location"] };
ensure(entryRedirect.status() === 302, "the Composer entry must answer with a 302 redirect");
ensure(entryRedirect.headers()["location"] === LIVE + "?analytics=off&qa=proof-290", "the redirect must forward only the bounded verification flags");
const entryStripped = await entryContext.request.get(
  ORIGIN + "/ldraw?project=private&scene=secret&token=secret&qa=bad%20value",
  { maxRedirects: 0 },
);
receipt.checks.entryStripped = { status: entryStripped.status(), location: entryStripped.headers()["location"] };
ensure(entryStripped.headers()["location"] === LIVE, "drawing, project and unknown parameters must be stripped");
const entry = await entryContext.newPage();
track(entry, "entry");
await entry.goto(ORIGIN + "/ldraw?analytics=off&qa=proof-290&project=private&scene=secret#secret", { waitUntil: "domcontentloaded" });
await entry.waitForURL(/ldraw\.loftwah\.com/, { timeout: 45000 }).catch(() => {});
await entry.waitForLoadState("domcontentloaded").catch(() => {});
receipt.checks.entry = {
  finalUrl: entry.url(),
  title: await entry.title().catch(() => null),
  editorRoot: await entry.locator(".excalidraw").count().catch(() => 0),
  header: (await entry.locator("header, [class*=header]").first().innerText().catch(() => "")).slice(0, 120),
};
ensure(entry.url().split("#")[0] === LIVE + "?analytics=off&qa=proof-290", "the entry must forward only analytics=off and the bounded qa label");
receipt.checks.entry.fragment = new URL(entry.url()).hash;
ensure(receipt.checks.entry.editorRoot > 0, "the entry must open the actual Excalidraw editor");
await entry.waitForTimeout(1200);
await shot(entry, "live-editor-entry-1440.png");
await entry.setViewportSize({ width: 390, height: 844 });
await entry.waitForTimeout(600);
await shot(entry, "live-editor-entry-390.png");
await entryContext.close();

// ---- Shared launcher --------------------------------------------------------
const launcher = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const launcherPage = await launcher.newPage();
track(launcherPage, "launcher");
await launcherPage.goto(ORIGIN + "/apps", { waitUntil: "domcontentloaded" });
await launcherPage.evaluate(() => document.fonts.ready);
await launcherPage.waitForFunction(() => document.querySelectorAll("article[data-app]").length === 8);
await setTheme(launcherPage, "dark");
await launcherPage.keyboard.press("Meta+k");
const dialog = launcherPage.locator("#app-navigation");
await dialog.waitFor({ state: "visible" });
receipt.checks.keyboardOpen = await launcherPage.evaluate(() => ({
  open: document.querySelector("#app-navigation")?.open === true,
  focus: document.activeElement?.getAttribute("type") === "search" ? "search" : document.activeElement?.tagName,
}));
ensure(receipt.checks.keyboardOpen.open && receipt.checks.keyboardOpen.focus === "search", "Cmd+K must open the launcher and focus search");
const search = dialog.locator("input[type=search]");
await search.fill("LDraw");
await launcherPage.waitForTimeout(120);
const row = dialog.locator("[data-destination] a").filter({ hasText: "LDraw" });
const rowData = await row.evaluate((anchor) => {
  const image = anchor.querySelector("img");
  return {
    href: anchor.getAttribute("href"),
    text: anchor.textContent.replace(/\s+/g, " ").trim(),
    imageSrc: image?.getAttribute("src"),
    imageDecoded: !!image && image.complete && image.naturalWidth === 96,
    status: document.querySelector("#app-navigation [role=status]")?.textContent.trim(),
    visibleRows: [...document.querySelectorAll("#app-navigation [data-destination]")].filter((node) => node.offsetParent !== null).length,
  };
});
receipt.checks.launcherRow = rowData;
ensure(rowData.href === LIVE, "the launcher LDraw row must open the live editor");
ensure(rowData.imageDecoded, "the launcher must decode the LDraw thumbnail");
ensure(rowData.visibleRows === 1, "search must narrow to the single LDraw row");
await shot(launcherPage, "launcher-1440-dark-ldraw.png");
// Keyboard selection then Escape.
await launcherPage.keyboard.press("ArrowDown");
receipt.checks.launcherKeyboard = await launcherPage.evaluate(() => {
  const active = document.activeElement;
  return { tag: active?.tagName, href: active?.getAttribute?.("href"), focusedRow: active?.closest?.("[data-destination]") !== null };
});
await launcherPage.keyboard.press("Escape");
await launcherPage.waitForTimeout(80);
receipt.checks.launcherEscape = await launcherPage.evaluate(() => ({
  open: document.querySelector("#app-navigation")?.open === true,
  focus: document.activeElement?.hasAttribute?.("data-open-apps") ? "apps-trigger" : document.activeElement?.tagName,
}));
ensure(receipt.checks.launcherEscape.open === false, "Escape must close the launcher even with search text");
// Reduced motion.
await launcherPage.emulateMedia({ reducedMotion: "reduce" });
await launcherPage.locator("[data-open-apps]").click();
await dialog.waitFor({ state: "visible" });
receipt.checks.reducedMotion = await launcherPage.evaluate(() => {
  const node = document.querySelector("#app-navigation");
  const style = getComputedStyle(node);
  return {
    open: node.open,
    animationDuration: style.animationDuration,
    transitionDuration: style.transitionDuration,
    matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
});
ensure(receipt.checks.reducedMotion.matches, "reduced-motion emulation must be active");
await launcherPage.keyboard.press("Escape");
await launcherPage.emulateMedia({ reducedMotion: "no-preference" });
await launcherPage.locator("[data-open-apps]").click();
await dialog.waitFor({ state: "visible" });
await launcherPage.keyboard.press("Escape");
await launcherPage.waitForTimeout(80);
receipt.checks.launcherEscapeFromTrigger = await launcherPage.evaluate(() => ({
  open: document.querySelector("#app-navigation")?.open === true,
  focus: document.activeElement?.hasAttribute?.("data-open-apps") ? "apps-trigger" : document.activeElement?.tagName,
}));
ensure(receipt.checks.launcherEscapeFromTrigger.open === false, "Escape must close the launcher opened from its trigger");
ensure(receipt.checks.launcherEscapeFromTrigger.focus === "apps-trigger", "Escape must restore focus to the Apps trigger");
// Light theme launcher.
await setTheme(launcherPage, "light");
await launcherPage.locator("[data-open-apps]").click();
await dialog.waitFor({ state: "visible" });
await launcherPage.waitForTimeout(100);
await shot(launcherPage, "launcher-1440-light.png");
await launcherPage.keyboard.press("Escape");
await launcher.close();

// ---- Phone launcher, 200% text ---------------------------------------------
const phoneLauncher = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const phoneLauncherPage = await phoneLauncher.newPage();
track(phoneLauncherPage, "launcher-phone");
await phoneLauncherPage.goto(ORIGIN + "/apps", { waitUntil: "domcontentloaded" });
await phoneLauncherPage.evaluate(() => document.fonts.ready);
await phoneLauncherPage.waitForFunction(() => document.querySelectorAll("article[data-app]").length === 8);
for (const theme of ["dark", "light"]) {
  await setTheme(phoneLauncherPage, theme);
  await phoneLauncherPage.locator("[data-open-apps]").tap();
  const dialogPhone = phoneLauncherPage.locator("#app-navigation");
  await dialogPhone.waitFor({ state: "visible" });
  await phoneLauncherPage.waitForTimeout(120);
  const state = await phoneLauncherPage.evaluate(() => {
    const node = document.querySelector("#app-navigation");
    const rows = [...node.querySelectorAll("[data-destination]")];
    const list = node.querySelector("ul");
    const ldraw = rows.find((item) => item.textContent.includes("LDraw"));
    const image = ldraw?.querySelector("img");
    return {
      open: node.open,
      focus: document.activeElement?.hasAttribute?.("data-close-apps") ? "close" : document.activeElement?.tagName,
      dialogWidth: node.getBoundingClientRect().width,
      dialogOverflow: node.scrollWidth - node.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      listScrolls: list ? list.scrollHeight > list.clientHeight : null,
      ldrawHref: ldraw?.querySelector("a")?.getAttribute("href"),
      ldrawImageDecoded: !!image && image.complete && image.naturalWidth === 96,
      ldrawVisible: ldraw ? ldraw.offsetParent !== null : false,
    };
  });
  receipt.checks["launcherPhone" + theme] = state;
  ensure(state.open && state.focus === "close", "phone tap must open the launcher with Close focused");
  ensure(state.documentOverflow <= 0 && state.dialogOverflow <= 0, "phone launcher must not overflow at 390 " + theme);
  ensure(state.ldrawHref === LIVE && state.ldrawImageDecoded, "phone launcher must offer the exact LDraw entry with decoded artwork");
  await shot(phoneLauncherPage, `launcher-390-${theme}.png`);
  await phoneLauncherPage.keyboard.press("Escape");
  await phoneLauncherPage.waitForTimeout(80);
}
await setTheme(phoneLauncherPage, "dark");
await phoneLauncherPage.evaluate(() => (document.documentElement.style.fontSize = "200%"));
await phoneLauncherPage.locator("[data-open-apps]").tap();
const zoomDialog = phoneLauncherPage.locator("#app-navigation");
await zoomDialog.waitFor({ state: "visible" });
await phoneLauncherPage.waitForTimeout(150);
const zoomState = await phoneLauncherPage.evaluate(() => {
  const node = document.querySelector("#app-navigation");
  const list = node.querySelector("ul");
  const input = node.querySelector("input[type=search]");
  return {
    dialogOverflow: node.scrollWidth - node.clientWidth,
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    listOnlyScrolls: list ? list.scrollHeight > list.clientHeight : null,
    searchFontSize: input ? parseFloat(getComputedStyle(input).fontSize) : null,
    closeVisible: (() => {
      const close = node.querySelector("[data-close-apps]");
      const rect = close.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    })(),
  };
});
receipt.checks.launcherPhone200 = zoomState;
ensure(zoomState.dialogOverflow <= 0 && zoomState.documentOverflow <= 0, "launcher must not overflow at 200% root text");
ensure(zoomState.searchFontSize >= 16, "the launcher search input must keep a 16px computed floor");
await shot(phoneLauncherPage, "launcher-390-dark-200-percent-text.png");
await phoneLauncher.close();

receipt.problems = problems;
writeFileSync(SHOTS + "/receipt.json", JSON.stringify(receipt, null, 2) + "\n");
await browser.close();
const total = receipt.captures.reduce((sum, capture) => sum + capture.bytes, 0);
console.log(JSON.stringify({ problems, captures: receipt.captures.length, totalBytes: total, checks: Object.keys(receipt.checks) }, null, 2));
if (problems.length) process.exit(1);

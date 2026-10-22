// Authoring only. Explicit local app roots; no provider calls or owner writes.
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve, join, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

if (!process.env.ART_PLAYWRIGHT_MODULE) throw Error("Select existing ART_PLAYWRIGHT_MODULE; nothing is installed.");
const { chromium } = await import(pathToFileURL(process.env.ART_PLAYWRIGHT_MODULE).href);
const root = process.cwd(), output = resolve(root, "output/visual-20261018/cards");
const data = (bytes, mime) => `data:${mime};base64,${bytes.toString("base64")}`;
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const font = await readFile(resolve(root, "public/brand/space-latin-20261018.woff2"));
if (sha256(font) !== "61d00a1c57fcd7d4826c7a69cd85b61d15d133d5471d3c9c4731d70193d9f71f") throw Error("Review the changed font before rendering.");
const fontUri = data(font, "font/woff2"), sources = [], jobs = [];
const asset = async (path, mime) => {
  const bytes = await readFile(path);
  sources.push({ path, sha256: sha256(bytes) });
  return data(bytes, mime);
};
const template = async name => (await readFile(resolve(root, `.artwork/og/${name}`), "utf8"))
  .replaceAll("../../public/brand/space-latin-20261018.woff2", fontUri)
  .replaceAll("COMPOSER_IDENTITY", await asset(resolve(root, "public/brand/composer-icon-20261022-96.png"), "image/png"));
const product = (await template("composer-card-v5.html")).replace("../../public/brand/hero-composer-v5-1600.webp", await asset(resolve(root, "public/brand/hero-composer-v5-1600.webp"), "image/webp"));
jobs.push({ name: "share-composer-20261018", html: product });
const identities = new Map([
  ["@loftwah/composer-guestbook", { id: "herethere", master: "herethere-art-v4-master.png", legacy: "tile-herethere-v5" }],
  ["@loftwah/composer-linkcheck", { id: "linkcheck", master: "linkcheck-art-v4-master.png", legacy: "tile-linkcheck-v5" }],
  ["app-composer-hello", { id: "hello", master: "hello-art-v4-master.png", legacy: "tile-hello-v5" }],
  ["app-composer-state", { id: "carryforward", master: "carry-forward-art-v4-master.png", legacy: "tile-carryforward-v5" }],
]);
const seen = new Set();
for (const directory of process.argv.slice(2)) {
  if (!isAbsolute(directory)) throw Error("Select absolute local app roots.");
  const packageName = JSON.parse(await readFile(join(directory, "package.json"), "utf8")).name;
  if (seen.has(packageName)) throw Error("Select each app once.");
  seen.add(packageName);
  if (packageName === "@loftwah/composer-showcase") {
    let html = await template("loftwah-card-v5.html");
    for (const [token, file] of [["BANNER", "creators/loftwah-banner-v1.jpg"], ["PORTRAIT", "creators/loftwah-avatar-v1.jpg"], ["MARK", "linkarooie-icon-20261018-96.png"]])
      html = html.replace(token, await asset(join(directory, "public/brand", file), file.endsWith("png") ? "image/png" : "image/jpeg"));
    jobs.push({ name: "loftwah-share-20261018", html });
    continue;
  }
  const app = identities.get(packageName);
  if (!app) throw Error("Unsupported selected app root.");
  let html = await template("share-card-v5.html");
  const illustration = await asset(join(directory, "public/brand", app.master), "image/png");
  html = html.replace("const id = new URLSearchParams(location.search).get('app');", `const id = ${JSON.stringify(app.id)};`)
    .replace("'../../.artwork/masters/' + app.art + '.png'", JSON.stringify(illustration));
  jobs.push({ name: `${app.id}-share-20261018`, html });
}
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "composer-card-export-"));
let context;
try {
  context = await chromium.launchPersistentContext(join(temporary, "profile"), { headless: true, viewport: { width: 1200, height: 630 }, env: { ...process.env, TMPDIR: temporary } });
  const page = context.pages()[0] ?? await context.newPage();
  for (const job of jobs) {
    await page.goto("about:blank");
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(job.html);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images, image => image.decode())); });
    const loaded = await page.evaluate(() => ({ font: document.fonts.check("600 30px Space"), images: Array.from(document.images, image => image.naturalWidth), bodyFont: getComputedStyle(document.body).fontFamily }));
    if (!loaded.font || loaded.images.some(width => !width) || !loaded.bodyFont.startsWith("Space")) throw Error("The actual font/images did not load.");
    for (const width of [1200, 600, 300]) {
      await page.setViewportSize({ width, height: Math.round(width * 630 / 1200) });
      await page.evaluate(scale => { document.querySelector(".card").style.transform = `scale(${scale})`; document.querySelector(".card").style.transformOrigin = "top left"; document.body.style.overflow = "hidden"; }, width / 1200);
      await page.screenshot({ path: join(output, `${job.name}-${width}.png`) });
    }
    for (const extension of ["jpg", "webp"])
      execFileSync("magick", [join(output, `${job.name}-1200.png`), "-strip", "-quality", "88", join(output, `${job.name}.${extension}`)]);
    execFileSync("magick", [join(output, `${job.name}-600.png`), "-strip", "-quality", "88", join(output, `${job.name}-600.webp`)]);
    job.loaded = loaded;
    delete job.html;
  }
  await writeFile(join(output, "render.json"), JSON.stringify({ date: "2026-10-18", state: "exported candidate; no deployment or external-platform acceptance", font: sha256(font), sources, jobs }, null, 2) + "\n");
} finally {
  await context?.close();
  await rm(temporary, { recursive: true });
}
console.log(`${jobs.length} cards rendered at 1200/600/300px; owned profile removed. ${output}`);

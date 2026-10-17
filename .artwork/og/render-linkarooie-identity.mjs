// Authoring-only compositor. Uses selected local artwork and real bundled font;
// it makes no image-service calls and does not touch another app checkout.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

if (!process.env.ART_PLAYWRIGHT_MODULE)
  throw Error("Select the existing authoring Playwright module with ART_PLAYWRIGHT_MODULE.");
const { chromium } = await import(pathToFileURL(process.env.ART_PLAYWRIGHT_MODULE).href);
const root = process.cwd();
const output = resolve(root, "output/visual-20261018/linkarooie");
const characterPath = resolve(root, ".artwork/masters/linkarooie-original-redraw-20261018.png");
const fontPath = resolve(root, "public/brand/space-latin-20261018.woff2");
const character = await readFile(characterPath);
const font = await readFile(fontPath);
const uri = (bytes, mime) => `data:${mime};base64,${bytes.toString("base64")}`;
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "composer-art-review-"));
let context;
try {
  context = await chromium.launchPersistentContext(join(temporary, "profile"), {
    headless: true,
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    env: { ...process.env, TMPDIR: temporary },
  });
  const page = await context.newPage();
  const render = async (variant, width) => {
    const scale = width / 1200;
    await page.setViewportSize({ width, height: Math.round(630 * scale) });
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
      @font-face{font-family:Space;src:url('${uri(font, "font/woff2")}') format('woff2');font-weight:300 700}
      *{box-sizing:border-box}html,body{margin:0;overflow:hidden;background:#160d20;font-family:Space,Arial,sans-serif}
      .card{position:relative;width:1200px;height:630px;overflow:hidden;transform:scale(${scale});transform-origin:top left;background:#160d20;color:#f5f1e8}
      .orbit{position:absolute;left:638px;top:66px;width:478px;height:478px;border:3px solid #4c2b72;border-radius:50%;transform:rotate(-19deg)}
      .orbit:after{content:'';position:absolute;inset:27px -57px;border:2px solid #4c2b72;border-radius:50%;transform:rotate(35deg)}
      .art{position:absolute;width:612px;height:612px;object-fit:contain;left:585px;top:9px}
      .copy{position:absolute;left:64px;top:${variant === "a" ? 116 : 166}px;width:610px}
      .eyebrow{margin:0 0 23px;color:#c5b7d4;font:500 18px/1.2 Space,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
      h1{margin:0;font:700 93px/1 Space,Arial,sans-serif;letter-spacing:-.065em;white-space:nowrap}
      h1 span{color:#a5fd0e}
      .purpose{font:500 34px/1.28 Space,Arial,sans-serif;letter-spacing:-.02em;margin:31px 0 0;max-width:470px}
      .detail{font:400 21px/1.4 Space,Arial,sans-serif;color:#c5b7d4;margin:19px 0 0;max-width:420px}
      .origin{position:absolute;left:68px;bottom:49px;font:500 20px/1.2 Space,Arial,sans-serif;color:#a5fd0e}
      .rule{position:absolute;left:68px;bottom:91px;width:45px;height:4px;background:#a5fd0e}
      </style></head><body><main class="card"><div class="orbit"></div>
      <img class="art" alt="" src="${uri(character, "image/png")}">
      <div class="copy"><p class="eyebrow">Your collection. Your call.</p><h1>Link<span>arooie</span></h1>
      <p class="purpose">${variant === "a" ? "Keep the good stuff<br>together." : "Your links.<br>In good company."}</p>
      <p class="detail">Links, projects and favourite finds.<br>Picked by you.</p></div>
      <div class="rule"></div><p class="origin">showcase.loftwah.com</p></main></body></html>`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (image) => image.decode()));
    });
    const ready = await page.evaluate(() => ({
      font: document.fonts.check('700 93px Space'),
      image: document.images[0].naturalWidth,
      body: getComputedStyle(document.body).fontFamily,
    }));
    if (!ready.font || !ready.image) throw Error("Artwork or font did not load.");
    await page.screenshot({ path: join(output, `identity-${variant}-${width}.png`) });
    return ready;
  };
  const renders = [];
  for (const variant of ["a", "b"])
    for (const width of [1200, 600, 300])
      renders.push({ variant, width, ...(await render(variant, width)) });
  await writeFile(join(output, "render.json"), JSON.stringify({
    state: "candidate - not owner approved or deployed",
    character: { path: characterPath, sha256: createHash("sha256").update(character).digest("hex") },
    font: { path: fontPath, sha256: createHash("sha256").update(font).digest("hex") },
    renders,
  }, null, 2) + "\n");
} finally {
  await context?.close();
  await rm(temporary, { recursive: true });
}
console.log(`Rendered both editorial treatments at 1200/600/300px; owned profile removed. ${output}`);

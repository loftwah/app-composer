import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Use an existing local Playwright installation. The render only reads repo assets.
if (!process.env.ART_PLAYWRIGHT_MODULE) throw new Error('Set ART_PLAYWRIGHT_MODULE to an existing Playwright entry point.');
const { chromium } = await import(pathToFileURL(process.env.ART_PLAYWRIGHT_MODULE).href);
const [font, mark, source] = await Promise.all([
  readFile('public/brand/space-latin-20261018.woff2'),
  readFile('public/brand/composer-icon-20261022b.svg', 'utf8'),
  readFile('.artwork/og/composer-home-20261128.html', 'utf8'),
]);
const shapes = mark.match(/<g id="blocks"[\s\S]+<\/svg>/)?.[0].replace('</svg>', '').replace(/fill="(?:#fc5b05|#fff)"/g, 'fill="currentColor"');
if (!shapes) throw new Error('The Composer mark has no expected block geometry.');
const document = source.replace('FONT_DATA', `data:font/woff2;base64,${font.toString('base64')}`).replace('COMPOSER_SHAPES', shapes);
const out = 'output/og-20261128';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(document);
  const ready = await page.evaluate(async () => (await window.document.fonts.load('700 144px Space')).length > 0);
  if (!ready) throw new Error('Space Grotesk did not load.');
  await page.screenshot({ path: `${out}/composer-flat-1200.png` });
} finally {
  await browser.close();
}

// Explicit host browser regression; not part of the Node-only pnpm test suite.
// Reuse an installed Playwright package through COMPOSER_PLAYWRIGHT_MODULE.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyFontGlyphs } from '../scripts/font-journey.mjs';

const modulePath = process.env.COMPOSER_PLAYWRIGHT_MODULE;
if (!modulePath || !isAbsolute(modulePath)) throw Error('Select an existing absolute Playwright module path; no browser installation is performed.');
const browsers = await import(pathToFileURL(modulePath).href);
const reviewedFont = process.env.COMPOSER_REVIEWED_WEB_FONT;
if (reviewedFont && !isAbsolute(reviewedFont)) throw Error('Select an absolute reviewed web-font path.');
const root = mkdtempSync(join(tmpdir(), 'composer-font-glyphs-'));
const previousTmpdir = process.env.TMPDIR;
process.env.TMPDIR = root;
after(() => {
  if (previousTmpdir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = previousTmpdir;
  rmSync(root, { recursive: true });
  assert.equal(existsSync(root), false);
  console.log('Removed owned font-proof root: ' + root);
});

for (const name of ['chromium', 'webkit']) {
  test(`${name}: known subset falls back; the reviewed full source covers printable Latin`, async t => {
    const context = await browsers[name].launchPersistentContext(join(root, name), { headless: true });
    try {
      const page = context.pages()[0] ?? await context.newPage();
      const before = await page.evaluate(() => document.fonts.size);
      let negative;
      await assert.rejects(
        verifyFontGlyphs(page, fileURLToPath(new URL('./fixtures/fonts/space-vietnamese.woff2', import.meta.url))),
        error => {
          negative = error.report;
          return negative?.fallbackDependent.includes('A')
            && negative.fallbackDependent.includes('a')
            && negative.uncalibrated.length === 0;
        },
      );
      const complete = await verifyFontGlyphs(page, fileURLToPath(new URL('../src/assets/fonts/SpaceGrotesk.ttf.bin', import.meta.url)));
      assert.equal(complete.checked, 95);
      assert.deepEqual(complete.fallbackDependent, []);
      let web;
      if (reviewedFont) {
        web = await verifyFontGlyphs(page, reviewedFont);
        assert.equal(web.checked, 95);
        assert.deepEqual(web.fallbackDependent, []);
      }
      assert.equal(await page.evaluate(() => document.fonts.size), before, 'probe removes only its temporary FontFace');
      t.diagnostic(JSON.stringify({ browser: name, checked: complete.checked,
        rejectedSubset: { sha256: negative.sha256, fallbackGlyphs: negative.fallbackDependent.length },
        completeTtf: complete.sha256, reviewedWebFont: web?.sha256 ?? null }));
    } finally {
      await context.close();
    }
  });
}

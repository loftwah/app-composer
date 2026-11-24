import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.argv[2] ?? 'https://composer.loftwah.com';
const title = 'Fictional Top Nine';
const items = Array.from({ length: 9 }, (_, index) => `Fixture item ${index + 1}`);
const fragment = new URLSearchParams({ result: JSON.stringify({ game: 'top-nine', title, items }) });
const routes = [
  ['/top-nine', { width: 393, height: 659 }],
  ['/share/experiences/top-nine', { width: 1440, height: 900 }],
];

const browser = await chromium.launch();
try {
  for (const [path, viewport] of routes) {
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const address = new URL(path, origin);
      address.hash = fragment.toString();
      await page.goto(address.href);
      const control = page.getByText('Image and sharing options', { exact: true }).first();
      await page.locator('[data-nine-recipient]').waitFor();
      assert.equal(await page.locator('[data-nine-count]').textContent(), '9 of 9 titles');

      const newPage = context.waitForEvent('page', { timeout: 1000 }).catch(error => {
        if (error.name !== 'TimeoutError') throw error;
        return null;
      });
      await control.click({ button: 'middle' });
      const unwanted = await newPage;
      if (unwanted) await unwanted.waitForLoadState('domcontentloaded');
      assert.equal(unwanted?.url(), undefined, 'Middle-click opened an address outside the shared board');

      await control.focus();
      await control.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'nine-image-options');
      assert.equal(page.url(), address.href);
      await page.reload();
      const board = page.locator('[data-nine-recipient]');
      await board.waitFor();
      assert.equal(await board.locator('[data-nine-preview-title]').textContent(), title);
      assert.equal(await board.locator('[data-nine-count]').textContent(), '9 of 9 titles');
      console.log(`PASS ${path} at ${viewport.width}px`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

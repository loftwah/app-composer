import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.argv[2] ?? 'https://composer.loftwah.com';
const workshop = '/share/experiences/';
const journeys = [
  {
    path: '/prompts',
    copy: '[data-copy-template="setup"]',
    change: '[data-prompt-fields="setup"] textarea[name="project"]',
    manual: '[data-manual="setup"]',
    status: '[data-copy-status="setup"]',
    prepare: async () => {},
    move: (page, change) => page.locator(change).fill('Fictional changed project'),
    denied: /could not copy/,
  },
  {
    path: workshop + 'one-must-go',
    copy: '[data-omg-copy]',
    change: '[data-omg-round="weekend"]',
    manual: '[data-omg-copy-manual]',
    status: '[data-omg-copy-status]',
    prepare: async () => {},
    move: (page, change) => page.locator(change).click(),
    denied: /denied/,
  },
  {
    path: workshop + 'cursed-choices',
    copy: '[data-cc-copy]',
    change: '[data-cc-next]',
    manual: '[data-cc-copy-manual]',
    status: '[data-cc-copy-status]',
    prepare: async () => {},
    move: (page, change) => page.locator(change).click(),
    denied: /denied/,
  },
  {
    path: workshop + 'tech-tournament',
    copy: '[data-tt-copy]',
    change: '[data-tt-again]',
    manual: '[data-tt-copy-manual]',
    status: '[data-tt-copy-status]',
    prepare: async (page) => {
      for (let match = 0; match < 7; match++) await page.locator('[data-tt-pick]:enabled').first().click();
    },
    move: async (page, change) => page.locator(change).click(),
    denied: /denied/,
  },
];

const browser = await chromium.launch();
try {
  for (const [index, journey] of journeys.entries()) {
    const viewport = index % 2 ? { width: 1440, height: 900 } : { width: 390, height: 700 };
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(5000);
    try {
      await page.addInitScript(() => {
        window.clipboardWrites = [];
        Object.defineProperty(navigator, 'clipboard', { value: {
          writeText: (text) => new Promise((resolve, reject) => window.clipboardWrites.push({ text, resolve, reject })),
        } });
      });
      await page.goto(new URL(journey.path, origin).href);
      const button = page.locator(journey.copy);
      const manual = page.locator(journey.manual);
      const status = page.locator(journey.status);
      await journey.prepare(page);
      await button.click();
      await journey.move(page, journey.change);
      const announce = await status.textContent();
      await page.evaluate(async () => {
        window.clipboardWrites[0].reject(new Error('delayed denial for previous content'));
        await Promise.resolve();
      });
      assert.equal(await manual.isVisible(), false, `${journey.path} showed a stale fallback`);
      assert.equal(await status.textContent(), announce, `${journey.path} announced a stale result`);

      if (journey.path.endsWith('tech-tournament')) await journey.prepare(page);
      await button.click();
      const expected = await page.evaluate(async () => {
        const write = window.clipboardWrites[1];
        write.reject(new Error('denial for current content'));
        await Promise.resolve();
        return write.text;
      });
      await manual.waitFor({ state: 'visible' });
      assert.match(await status.textContent(), journey.denied);
      const selection = await page.evaluate(() => {
        const field = document.activeElement;
        return field.value?.slice(field.selectionStart, field.selectionEnd);
      });
      assert.equal(selection, expected, `${journey.path} selected the exact current clipboard text`);
      console.log(`PASS ${journey.path} at ${viewport.width}px`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

// Use the caller's admitted Playwright page; no browser/profile is created here.
// Normal homepage edits need six representative captures. The gap regression
// qualification can opt into the fuller set of widths once.
export async function verifyHomepage(page, origin, { capture, full = false } = {}) {
  const ensure = (value, message) => { if (!value) throw new Error(message); };
  const entryLinks = ['/learn', '#example', '/demo'];
  const receipt = { url: new URL('/', origin).href, views: [], keyboard: [], limits: [
    'Chromium viewport and text reflow checks do not establish physical device, native browser zoom or screen reader acceptance.',
    'Screenshots require visual review; geometric checks alone cannot establish a finished composition.',
  ] };
  const widths = full ? [320, 390, 430, 768, 900, 1024, 1280, 1440, 1920] : [390, 768, 1440];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['dark', 'light']) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await page.goto(new URL('/?analytics=off&qa=1', origin).href, { waitUntil: 'domcontentloaded' });
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await page.locator('#theme-toggle').click();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.studio-stage').scrollIntoViewIfNeeded();
      const poster = await page.locator(`.studio-poster-${theme} img`).evaluate(async image => {
        await image.decode();
        return image.naturalWidth;
      });
      const geometry = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { opening: box('.home-opening'), workshop: box('.studio-hero'), copy: box('.studio-copy'), stage: box('.studio-stage'), deck: box('.studio-deck'), next: box('#make-something'),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior };
      });
      ensure(!geometry.overflow, `Homepage overflows at ${width}/${theme}`);
      ensure(poster > 0, `Missing workshop poster at ${width}/${theme}`);
      ensure(geometry.reducedMotion, 'Reduced motion preference was lost');
      ensure(geometry.scrollBehavior === 'auto', 'Reduced motion still animates anchor scrolling');
      ensure(geometry.copy.bottom <= geometry.deck.top + 1, 'Workshop desk covers headline, actions or context');
      if (width <= 900) ensure(geometry.stage.bottom <= geometry.deck.top + 1, 'Workshop stage overlaps the desk');
      ensure(geometry.copy.top >= geometry.workshop.top - 1, 'Workshop copy is outside its section');
      ensure(Math.abs(geometry.next.top - geometry.opening.bottom) <= 2, 'Opening and next section do not meet');
      for (const href of entryLinks) {
        ensure(await page.locator(`.home-opening-actions a[href="${href}"]`).isVisible(), `${href} is not visible in the opening`);
      }
      ensure(await page.locator('.studio-copy a[href="/apps"]').isVisible(), 'Workshop apps link is missing');
      const name = `${width}-${theme}`;
      if (capture) {
        // Scroll through lazy content before a full-page capture; the browser
        // does not load offscreen images merely because a screenshot is tall.
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
            scrollTo(0, y);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }
          scrollTo(0, 0);
        });
        await page.locator('main img').evaluateAll(images => Promise.all(images.filter(image => image.getClientRects().length).map(image => image.decode())));
        await capture(page, name, { fullPage: true });
      }
      receipt.views.push({ width, theme, ...geometry });
    }
  }
  // Tab from Skip to content into the first task, then follow the actual order.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL('/?analytics=off&qa=1', origin).href);
  await page.keyboard.press('Tab');
  ensure(await page.locator('.skip').evaluate(element => element === document.activeElement), 'Skip link is not the first keyboard target');
  await page.keyboard.press('Enter');
  for (const href of entryLinks) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({ href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle }));
    ensure(focused.href === href && focused.outline !== 'none', `Keyboard path or focus missing for ${href}`);
    receipt.keyboard.push(focused);
  }
  await page.keyboard.press('Enter');
  await page.waitForURL(url => url.pathname === '/demo');
  ensure(await page.locator('h1').isVisible(), 'Sandbox failed to open by keyboard');
  // Browser viewport at 720px covers the reflow width of a 1440px window at
  // 200%; separately double root text to catch fixed-size text containers.
  for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width: 720, height: 500 });
    await page.goto(new URL('/?analytics=off&qa=1', origin).href);
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#theme-toggle').click();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '200% text reflow overflows');
    if (capture) await capture(page, `720-${theme}-200-percent-text`, { fullPage: true });
  }
  return receipt;
}

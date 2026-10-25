// Use the caller's admitted Playwright page; no browser/profile is created here.
// Normal homepage edits need six representative captures. The gap regression
// qualification can opt into the fuller set of widths once.
export async function verifyHomepage(page, origin, { capture, full = false } = {}) {
  const ensure = (value, message) => { if (!value) throw new Error(message); };
  const receipt = { url: new URL('/', origin).href, views: [], keyboard: [], limits: [
    'Chromium viewport and text reflow checks do not establish physical device, native browser zoom or screen reader acceptance.',
    'Screenshots require visual review; geometric checks alone cannot establish a finished composition.',
  ] };
  const widths = full ? [320, 390, 430, 768, 900, 1024, 1280, 1440, 1920] : [390, 768, 1440];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['dark', 'light']) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await page.goto(new URL('/?analytics=off&qa=1', origin).href, { waitUntil: 'networkidle' });
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await page.locator('#theme-toggle').click();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.home-proof img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      const geometry = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { hero: box('.home-hero'), copy: box('.home-hero-copy'), proof: box('.home-proof'), next: box('.home-paths'),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          imageCount: [...document.querySelectorAll('.home-proof img')].filter(image => image.naturalWidth > 0).length };
      });
      ensure(!geometry.overflow, `Homepage overflows at ${width}/${theme}`);
      ensure(geometry.imageCount === 4, `Missing original proof imagery at ${width}/${theme}`);
      ensure(geometry.reducedMotion, 'Reduced motion preference was lost');
      // Regression: the full-width 900px proof panel formerly grew to 937px.
      if (width >= 701 && width <= 1000) ensure(geometry.proof.height < 480, 'Tablet proof panel strands the following section');
      if (width > 1000) ensure(Math.abs(geometry.copy.height - geometry.proof.height) < 240, 'Hero columns leave an excessive unused region');
      ensure(geometry.next.top - geometry.hero.bottom <= 2, 'Unexplained gap after the hero');
      for (const href of ['/ready', '/prompts', '/agent']) ensure(await page.locator(`.home-hero a[href="${href}"]`).isVisible(), `${href} is not visible`);
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
        await page.locator('main img').evaluateAll(images => Promise.all(images.filter(image => getComputedStyle(image).display !== 'none').map(image => image.decode())));
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
  for (const href of ['/ready', '/prompts', '/agent']) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({ href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle }));
    ensure(focused.href === href && focused.outline !== 'none', `Keyboard path or focus missing for ${href}`);
    receipt.keyboard.push(focused);
  }
  await page.keyboard.press('Enter');
  await page.waitForURL('**/agent');
  ensure(await page.locator('h1').isVisible(), 'Agent entry failed to open by keyboard');
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

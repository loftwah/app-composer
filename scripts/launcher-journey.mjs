// MIT. A focused Playwright journey, usable with the existing browser/CLI host.
// No runner or browser dependency is added to deployed applications.
export async function verifyLauncher(page, url, { width = 390, height = 600, theme = 'dark', screenshot } = {}) {
  const ensure = (condition, message) => { if (!condition) throw Error(`${url}: ${message}`); };
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-open-apps]').waitFor();
  await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
  const trigger = page.locator('[data-open-apps]');
  await trigger.click();
  const dialog = page.locator('#app-navigation');
  await dialog.waitFor({ state: 'visible' });
  await dialog.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
  const read = () => dialog.evaluate(element => {
    const box = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    const input = element.querySelector('input'), close = element.querySelector('[data-close-apps]'), list = element.querySelector('ul');
    return { dialog: box(element), input: box(input), close: box(close), font: parseFloat(getComputedStyle(input).fontSize), inputFocused: document.activeElement === input, closeFocused: document.activeElement === close, listOverflow: getComputedStyle(list).overflowY, pageOverflow: document.documentElement.scrollWidth > innerWidth, bodyLocked: getComputedStyle(document.body).position === 'fixed', viewport: { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale }, scrollY };
  });
  const initial = await read();
  ensure(initial.closeFocused && !initial.inputFocused, 'click opening must focus Close');
  ensure(initial.font >= 16, 'search is smaller than 16px');
  ensure(initial.close.width >= 44 && initial.close.height >= 44, 'Close is too small');
  ensure(initial.dialog.top >= 0 && initial.dialog.bottom <= height + 1 && initial.dialog.left >= 0 && initial.dialog.right <= width + 1, 'menu exceeds viewport');
  ensure(!initial.pageOverflow && initial.bodyLocked, 'background lock or width failed');
  await dialog.locator('ul').evaluate(list => { list.scrollTop = list.scrollHeight; });
  const scrolled = await read();
  ensure(Math.abs(scrolled.close.top - initial.close.top) < 1 && Math.abs(scrolled.input.top - initial.input.top) < 1, 'scroll hid fixed controls');
  ensure(['auto', 'scroll'].includes(scrolled.listOverflow), 'destinations do not own scrolling');
  const search = dialog.locator('input[type=search]');
  await search.fill('nothing-matches-xyz');
  ensure(await dialog.locator('[role=status]').textContent() === 'No matches. Try an app or task name.', 'empty search recovery missing');
  ensure(await dialog.locator('[data-destination]:visible').count() === 0, 'empty search left a destination visible');
  await search.fill('');
  ensure(await dialog.locator('[data-destination]:visible').count() > 0, 'clear did not restore destinations');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#app-navigation').open && getComputedStyle(document.body).position !== 'fixed');
  ensure(await trigger.evaluate(element => element === document.activeElement), 'Escape did not restore trigger focus');
  ensure(await page.evaluate(() => getComputedStyle(document.body).position !== 'fixed'), 'close retained page lock');
  await page.keyboard.press('Control+k');
  ensure(await search.evaluate(element => element === document.activeElement), 'shortcut did not focus search');
  await page.setViewportSize({ width, height: Math.min(height, 360) });
  const keyboardSized = await read();
  ensure(keyboardSized.close.top >= 0 && keyboardSized.input.bottom <= Math.min(height, 360), 'reduced visual viewport hides controls');
  await page.setViewportSize({ width, height });
  await page.keyboard.press('Tab');
  ensure(await dialog.evaluate(element => element.contains(document.activeElement)), 'Tab escaped modal');
  await dialog.locator('[data-close-apps]').click();
  await page.waitForFunction(() => getComputedStyle(document.body).position !== 'fixed');
  await trigger.click();
  if (screenshot) {
    await dialog.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))); });
    await page.screenshot({ path: screenshot });
  }
  await dialog.locator('[data-close-apps]').click();
  return { url, width, height, theme, ...initial, controlsFixedAfterScroll: true, emptySearch: true, shortcut: true, escapeFocusReturn: true, reopen: true };
}

// The caller may route the destination hostname to a local independently built
// app. The ordinary href, document navigation and browser Back remain real.
export async function verifyLinkCheckReturn(page, url, destination = 'https://ready.loftwah.com') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#url').fill('https://showcase.loftwah.com/');
  await page.locator('#discovery').check();
  await page.locator('[data-open-apps]').click();
  await page.locator(`#app-navigation a[href="${destination}"]`).click();
  await page.waitForURL(new URL(destination).href);
  await page.locator('h1').waitFor({ state: 'visible' });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForURL(url);
  if (await page.locator('#url').inputValue() !== 'https://showcase.loftwah.com/' || !await page.locator('#discovery').isChecked()) throw Error('Back navigation lost the public inspection draft.');
  if (await page.locator('#app-navigation').isVisible()) throw Error('Back navigation retained an open launcher.');
  await page.locator('[data-open-apps]').click();
  await page.locator('[data-close-apps]').click();
  await page.waitForFunction(() => getComputedStyle(document.body).position !== 'fixed');
  return { destination: new URL(destination).href, destinationRendered: true, backDraftPreserved: true, closeReopen: true };
}

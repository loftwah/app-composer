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
  await dialog.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  ensure(await dialog.locator('img').evaluateAll(images => images.every(image => image.naturalWidth > 0 && getComputedStyle(image).visibility !== 'hidden')), 'decoded menu artwork is hidden');
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

// Verify the shared navigation frame and ordinary keyboard navigation. Real
// destination navigation is checked separately so this helper never submits data.
export async function verifyCommandMenu(page, url) {
  const ensure = (value, message) => { if (!value) throw Error(`${url}: ${message}`); };
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const trigger = page.locator('[data-open-apps]');
  await trigger.waitFor();
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const dialog = page.locator('#app-navigation');
  const search = dialog.locator('input[type=search]');
  ensure(await search.evaluate(input => input === document.activeElement), 'Cmd/Ctrl K did not enter search');
  const brand = dialog.locator('.launcher-brand');
  await brand.locator('img').evaluate(image => image.decode());
  ensure(await brand.getAttribute('aria-label') === 'App Composer home', 'Composer branding/link missing');
  ensure(await brand.locator('img').evaluate(image => image.complete && image.naturalWidth === 96), 'Composer artwork is not decoded');
  const order = await dialog.locator('[data-launcher-group=apps] a > span:not(.task-icon)').evaluateAll(nodes => nodes.map(node => node.firstChild.textContent));
  ensure(JSON.stringify(order) === JSON.stringify(['Linkarooie', 'Here / there', 'Link Check', 'Hello World', 'Carry / forward']), 'app order differs across menus');
  await search.fill('website icons');
  ensure(await dialog.locator('[data-destination]:visible').count() === 1, 'task aliases did not match');
  ensure((await dialog.locator('[data-destination]:visible').textContent()).includes('Link Check'), 'task alias chose the wrong app');
  await search.fill('');
  await page.keyboard.press('ArrowDown');
  ensure(await dialog.locator('[data-active=true]').evaluate(entry => entry.contains(document.activeElement)), 'arrow selection is not focusable');
  ensure((await dialog.locator('[data-active=true]').textContent()).includes('Linkarooie'), 'first arrow selected wrong result');
  await page.keyboard.press('ArrowDown');
  ensure((await dialog.locator('[data-active=true]').textContent()).includes('Here / there'), 'second arrow did not move');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowDown');
  ensure((await dialog.locator('[data-active=true]').textContent()).includes('Linkarooie'), 'result navigation did not wrap');
  await page.keyboard.type('postcard');
  ensure(await search.inputValue() === 'postcard', 'typing after arrows lost search characters');
  ensure(await dialog.locator('[data-destination]:visible').count() === 1, 'typed task search did not filter');
  ensure((await dialog.locator('[data-destination]:visible').textContent()).includes('Here / there'), 'postcard search chose wrong app');
  const shortcutHint = await trigger.locator('kbd').textContent();
  ensure(['⌘ K', 'Ctrl K'].includes(shortcutHint), 'platform keyboard hint missing');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#app-navigation').open && document.activeElement === document.querySelector('[data-open-apps]'));
  ensure(await trigger.evaluate(button => button === document.activeElement), 'shortcut close lost prior focus');
  return { url, brandedHome: await brand.getAttribute('href'), allApps: await dialog.locator('.launcher-all').getAttribute('href'), orderedApps: order, aliasSearch: true, arrowSelection: true, wrap: true, typingAfterSelection: true, focusReturn: true };
}

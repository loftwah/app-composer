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
  ensure(await dialog.locator('[role=status]').textContent() === 'No matches. Try a task like “create site” or “check a link”.', 'empty search recovery missing');
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

// Verify the shared navigation frame, task groups and ordinary keyboard
// navigation. Real destination navigation is checked separately so this helper
// never submits data. `forceAnonymous` marks the shell as a signed-out viewer
// even when the harness has a local session.
export async function verifyCommandMenu(page, url, { forceAnonymous = false } = {}) {
  const ensure = (value, message) => { if (!value) throw Error(`${url}: ${message}`); };
  if (forceAnonymous) {
    await page.addInitScript(() => {
      const apply = () => {
        const dialog = document.querySelector('#app-navigation');
        if (!dialog) return;
        dialog.dataset.viewer = 'public';
        delete dialog.dataset.launcherRecents;
      };
      new MutationObserver(apply).observe(document, { childList: true, subtree: true });
      apply();
    });
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const loadedUrl = page.url();
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
  const headings = await dialog.locator('.launcher-section h3').evaluateAll(nodes => nodes.map(node => node.textContent));
  for (const heading of ['Make something', 'Continue exploring', 'Use a tool', 'Apps']) ensure(headings.includes(heading), `missing ${heading} task group`);
  const expectedApps = ['media-studio', 'ldraw', 'guestbook', 'showcase', 'hello', 'state', 'launch-kit', 'paperwork', 'linkcheck'];
  for (const catalogue of expectedApps) {
    const count = await dialog.locator(`[data-catalogue="${catalogue}"]`).count();
    ensure(count === 1, `${catalogue} must appear exactly once in the task-first inventory`);
  }
  for (const [catalogue, href] of [['launch-kit', 'https://composer-launch-kit.loftwah.workers.dev/'], ['paperwork', 'https://composer-paperwork.loftwah.workers.dev/'], ['ldraw', 'https://ldraw.loftwah.com/'], ['linkcheck', 'https://share.loftwah.com/']]) {
    const app = dialog.locator(`[data-catalogue="${catalogue}"] a`);
    ensure(await app.getAttribute('href') === href, `${catalogue} does not open its working app`);
  }
  if (forceAnonymous) {
    const privateRows = await dialog.locator('[data-destination] a').evaluateAll(nodes => nodes.filter(node => /My profile|\/_emdash\/|People & access|Your creator stacks|Manage mini-apps/.test(node.textContent + ' ' + node.getAttribute('href'))).length);
    ensure(privateRows === 0, 'anonymous launcher exposed an invitation destination');
    ensure(await dialog.locator('[data-recent-kind]').count() === 0, 'anonymous launcher requested recent projects');
  }
  await search.fill('Hello World');
  for (const composition of [{isComposing: true, keyCode: 13}, {isComposing: false, keyCode: 229}]) {
    await search.evaluate((input, shape) => input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true, ...shape})), composition);
    ensure(await dialog.isVisible() && page.url() === loadedUrl, 'IME confirmation activated a destination');
  }
  await search.fill('social preview');
  ensure(await dialog.locator('[data-destination]:visible').count() === 1, 'task aliases did not match');
  ensure((await dialog.locator('[data-destination]:visible').textContent()).includes('Check a page before sharing'), 'task alias chose the wrong app');
  await search.fill('postcard');
  ensure((await dialog.locator('[data-destination]:visible').textContent()).includes('Here / there'), 'postcard search chose wrong app');
  await search.fill('');
  ensure(await dialog.locator('.launcher-more details').evaluate(element => !element.open), 'More shortcuts must start collapsed');
  await search.fill('diagram');
  ensure((await dialog.locator('[data-destination]:visible').first().textContent()).includes('Diagram atlas'), 'advanced search did not rank the route first');
  await search.fill('');
  ensure(await dialog.locator('.launcher-more details').evaluate(element => !element.open), 'clearing search must restore the collapsed group');
  await page.keyboard.press('ArrowDown');
  ensure(await dialog.locator('[data-active=true]').evaluate(entry => entry.contains(document.activeElement)), 'arrow selection is not focusable');
  ensure((await dialog.locator('[data-active=true]').textContent()).includes('Create a site'), 'first arrow selected wrong result');
  await page.keyboard.press('ArrowDown');
  ensure((await dialog.locator('[data-active=true]').textContent()).includes('Shape your content'), 'second arrow did not move');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowDown');
  ensure((await dialog.locator('[data-active=true]').textContent()).includes('Create a site'), 'result navigation did not wrap');
  await page.keyboard.type('postcard');
  ensure(await search.inputValue() === 'postcard', 'typing after arrows lost search characters');
  ensure(await dialog.locator('[data-destination]:visible').count() === 1, 'typed task search did not filter');
  ensure((await dialog.locator('[data-destination]:visible').textContent()).includes('Here / there'), 'typed search chose wrong app');
  const shortcutHint = await trigger.locator('kbd').textContent();
  ensure(['⌘ K', 'Ctrl K'].includes(shortcutHint), 'platform keyboard hint missing');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#app-navigation').open && document.activeElement === document.querySelector('[data-open-apps]'));
  ensure(await trigger.evaluate(button => button === document.activeElement), 'shortcut close lost prior focus');
  return { url, brandedHome: await brand.getAttribute('href'), allApps: await dialog.locator('.launcher-all').getAttribute('href'), taskGroups: headings, aliases: true, arrowSelection: true, wrap: true, typingAfterSelection: true, focusReturn: true };
}

// The launcher must not take Cmd/Ctrl+K from a form field or another modal.
// Call this on a page with an ordinary input outside the launcher.
export async function verifyShortcutBoundary(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const field = page.locator('main input:not([type=search]), main textarea').first();
  if (!await field.count()) return { url, skipped: 'no page field' };
  await field.focus();
  await page.keyboard.press('Control+k');
  if (await page.locator('#app-navigation').isVisible()) throw Error(`${url}: the launcher took Ctrl+K from a form field`);
  if (!await field.evaluate(element => element === document.activeElement)) throw Error(`${url}: Ctrl+K moved focus out of the form field`);
  return { url, formShortcutPreserved: true };
}

// A contract check for the signed-in recents panel. The endpoint is mocked
// because this harness has no owner session; the real session, database and
// tenant boundary are covered by node --test and remain a live-owner check.
export async function verifyRecentsContract(page, url, { unavailable = false } = {}) {
  const ensure = (value, message) => { if (!value) throw Error(`${url}: ${message}`); };
  await page.route('**/api/launcher/recents', route => route.fulfill(unavailable
    ? { status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Recent projects are unavailable.' }) }
    : { status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        workspace: { name: 'Paper and Light', allHref: '/_emdash/admin/plugins/composer-stacks/stacks?workspace=ws-paper-01' },
        project: {
          name: 'Paper & Light',
          state: 'published',
          action: 'Continue editing',
          updatedAt: '2026-11-16T02:00:00.000Z',
          href: '/_emdash/admin/plugins/composer-stacks/stacks?workspace=ws-paper-01&stack=stack-paper-1',
          publishedHref: '/s/paper-and-light',
        },
      }) }));
  await page.addInitScript(() => {
    const apply = () => {
      const dialog = document.querySelector('#app-navigation');
      if (!dialog) return;
      dialog.dataset.viewer = 'member';
      dialog.dataset.launcherRecents = '/api/launcher/recents';
    };
    new MutationObserver(apply).observe(document, { childList: true, subtree: true });
    apply();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-open-apps]').click();
  const dialog = page.locator('#app-navigation');
  await dialog.waitFor({ state: 'visible' });
  if (unavailable) {
    await dialog.locator('[data-recent-kind="all"]').waitFor();
    ensure((await dialog.textContent()).includes('Recent projects are unavailable.'), 'an unavailable endpoint must say so');
    ensure(await dialog.locator('[data-recent-kind="project"]').count() === 0, 'a failed request must not invent a project');
  } else {
    await dialog.locator('[data-recent-kind="project"]').waitFor();
    const project = dialog.locator('[data-recent-kind="project"] a');
    const href = await project.getAttribute('href');
    ensure(href.includes('workspace=ws-paper-01') && href.includes('stack=stack-paper-1'), 'recent project link lost its confirmed workspace/stack');
    ensure(!/token|email|user=/.test(href), 'recent project link carries private context');
    ensure((await project.textContent()).includes('Continue editing Paper & Light'), 'recent project action is not readable');
    ensure((await dialog.locator('[data-recent-kind="published"] a').getAttribute('href')).endsWith('/s/paper-and-light'), 'published page link is missing');
    ensure((await dialog.locator('[data-recent-kind="all"] a').getAttribute('href')).includes('workspace=ws-paper-01'), 'all-projects link is missing');
    await page.locator('#app-navigation input[type=search]').focus();
    await page.keyboard.press('ArrowDown');
    ensure((await dialog.locator('[data-active=true]').textContent()).includes('Continue editing Paper & Light'), 'recents must lead the keyboard order');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#app-navigation').open);
  return { url, recents: unavailable ? 'unavailable' : 'ready', projectContext: true, mockedEndpoint: true };
}

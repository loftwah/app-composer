// Focused Top Nine draft-status coverage. Runs against a local dev server on
// port 43145 by default, or any reachable origin passed as the first argument.
//
//   PLAYWRIGHT_MODULE=/abs/path/to/playwright/index.mjs \
//     node tests/top-nine-saved-revision.browser.mjs http://127.0.0.1:43145 both
//
// The race is deterministic: the first canvas.toBlob after the hold is armed
// is parked until the test finishes editing board A into board B. No network,
// owner data or third-party media is used; every cover is drawn in the tab.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const modulePath = process.env.PLAYWRIGHT_MODULE ?? process.env.COMPOSER_PLAYWRIGHT_MODULE ?? 'playwright';
const { chromium, webkit } = await import(modulePath);
const origin = process.argv[2] ?? 'http://127.0.0.1:43145';
const choice = process.argv[3] ?? 'both';
const engines = choice === 'both'
  ? [['chromium', chromium], ['webkit', webkit]]
  : choice === 'webkit' ? [['webkit', webkit]] : [['chromium', chromium]];

const item = (page, index) => page.locator(`[data-object="${index}"]`);
const titleField = (page) => page.getByRole('textbox', { name: 'Board title' });
const draftNote = (page) => page.locator('[data-draft-status]');
const revisionNote = (page) => page.locator('[data-draft-revision-status]');
const saveButton = (page) => page.getByRole('button', { name: 'Save draft', exact: true });

async function fixturePng(page, colours) {
  const base64 = await page.evaluate((fills) => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext('2d');
    fills.forEach((fill, index) => {
      context.fillStyle = fill;
      context.fillRect(index * 13, 0, 13, 20);
    });
    return canvas.toDataURL().split(',')[1];
  }, colours);
  return Buffer.from(base64, 'base64');
}

async function openBoard(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.goto(new URL('/top-nine', origin).href);
  return { context, page };
}

async function addCover(page, index, buffer) {
  const preview = page.locator(`[data-nine-preview-cover="${index}"]`);
  const previous = await preview.getAttribute('src');
  await page.locator(`[data-nine-edit-slot="${index}"]`).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add custom art', exact: true }).click();
  await (await chooser).setFiles({
    name: `fixture-${index}.png`, mimeType: 'image/png', buffer,
  });
  await page.waitForFunction(({ index, previous }) => {
    const image = document.querySelector(`[data-nine-preview-cover="${index}"]`);
    return image && !image.hidden && image.getAttribute('src') !== previous;
  }, { index, previous });
}

/** Park the first artwork encoding until the test calls window.finishTopNineSave. */
async function holdFirstEncode(page) {
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      HTMLCanvasElement.prototype.toBlob = original;
      window.finishTopNineSave = () => original.apply(this, args);
    };
  });
}

async function readStoredBoard(page) {
  return page.evaluate(async () => {
    const open = () => new Promise((resolve, reject) => {
      const request = indexedDB.open('composer-top-nine-device-draft', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const db = await open();
    try {
      const record = await new Promise((resolve, reject) => {
        const request = db.transaction('drafts', 'readonly').objectStore('drafts').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!record) return null;
      const board = JSON.parse(record.draft.file);
      const covers = await Promise.all(record.draft.covers.map(async (cover) => cover ? {
        fit: cover.fit,
        sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', cover.bytes))]
          .map((byte) => byte.toString(16).padStart(2, '0')).join(''),
      } : null));
      return {
        title: board.title, items: board.items, profile: board.profile ?? null,
        covers: covers.map((cover) => cover && { fit: cover.fit, sha256: cover.sha256 }),
      };
    } finally {
      db.close();
    }
  });
}

/** A small pixel digest of the decoded preview art, not just its blob URL. */
async function previewPixels(page) {
  await page.waitForFunction(() => [0, 1].every((index) => {
    const image = document.querySelector(`[data-nine-preview-cover="${index}"]`);
    return image && !image.hidden && image.complete && image.naturalWidth > 0;
  }));
  return page.evaluate(() => [0, 1].map((index) => {
    const image = document.querySelector(`[data-nine-preview-cover="${index}"]`);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let digest = 2166136261;
    for (const value of pixels) {
      digest ^= value;
      digest = Math.imul(digest, 16777619);
    }
    return { width: canvas.width, height: canvas.height, digest: digest >>> 0 };
  }));
}

async function waitForRevision(page, expected) {
  await page.waitForFunction((text) => document.querySelector('[data-draft-revision-status]')?.textContent?.includes(text), expected);
}

async function race(browser, name, viewport) {
  const { context, page } = await openBoard(browser, viewport);
  try {
    const coverA = await fixturePng(page, ['#be4200', '#eea300', '#222222']);
    const coverB = await fixturePng(page, ['#1337aa', '#00a88f', '#f4f1e8']);
    await titleField(page).fill('Fictional board A');
    await page.getByRole('button', { name: 'Show all titles', exact: true }).click();
    for (let index = 0; index < 9; index += 1) {
      await item(page, index).fill(`Fixture A${index + 1}`);
    }
    await addCover(page, 0, coverA);
    await addCover(page, 1, coverB);
    await page.getByLabel('Fit for exhibit 1').selectOption('contain');
    await page.getByLabel('Fit for exhibit 2').selectOption('contain');

    // A is the board whose bytes will be encoded; hold that encoding so B
    // can be typed, a fit changed and the covers moved before the write ends.
    await holdFirstEncode(page);
    await saveButton(page).focus();
    await saveButton(page).press('Enter');
    await page.waitForFunction(() => typeof window.finishTopNineSave === 'function');

    await titleField(page).fill('Fictional board B');
    await item(page, 0).fill('Fixture B1');
    await page.getByLabel('Fit for exhibit 1').selectOption('cover');
    await page.getByText('Reorder exhibits', { exact: true }).click();
    await page.locator('[data-order-index]').selectOption({ value: '0' });
    await page.locator('[data-swap-target]').selectOption({ value: '1' });
    await page.locator('[data-swap-slots]').click();
    assert.equal(await item(page, 0).inputValue(), 'Fixture A2');
    assert.equal(await item(page, 1).inputValue(), 'Fixture B1');

    await page.evaluate(() => window.finishTopNineSave());
    await waitForRevision(page, 'Fictional board A');
    const revision = (await revisionNote(page).textContent()).trim();
    assert.match(revision, /not saved yet/i, revision);
    assert.doesNotMatch(revision, /Fictional board B/, revision);
    assert.equal(await titleField(page).inputValue(), 'Fictional board B');
    // Operation status is for progress/failures only, never saved truth.
    assert.equal((await draftNote(page).textContent()).trim(), "");
    if (process.env.TOP_NINE_EVIDENCE_DIR) {
      await revisionNote(page).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(process.env.TOP_NINE_EVIDENCE_DIR, `top-nine-after-${name}-${viewport.width}.png`),
      });
    }

    const savedA = await readStoredBoard(page);
    assert.equal(savedA.title, 'Fictional board A');
    assert.equal(savedA.items[0], 'Fixture A1');
    assert.equal(savedA.covers.filter(Boolean).length, 2);
    assert.equal(savedA.covers[0].fit, 'contain');
    assert.equal(savedA.covers[1].fit, 'contain');

    // A second save persists B; a real reload restores those exact bytes and
    // the decoded artwork in its new slots.
    await saveButton(page).click();
    await waitForRevision(page, 'Fictional board B');
    assert.doesNotMatch((await revisionNote(page).textContent()).trim(), /not saved yet/i);
    const savedB = await readStoredBoard(page);
    assert.equal(savedB.title, 'Fictional board B');
    assert.equal(savedB.items[0], 'Fixture A2');
    assert.equal(savedB.items[1], 'Fixture B1');
    assert.equal(savedB.covers[0].fit, 'contain');
    assert.equal(savedB.covers[1].fit, 'cover');
    assert.equal(savedB.covers[0].sha256, savedA.covers[1].sha256);
    assert.equal(savedB.covers[1].sha256, savedA.covers[0].sha256);
    const pixelsBefore = await previewPixels(page);

    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-exhibition-title]')?.value === 'Fictional board B');
    assert.equal(await item(page, 0).inputValue(), 'Fixture A2');
    assert.equal(await item(page, 1).inputValue(), 'Fixture B1');
    assert.deepEqual(await readStoredBoard(page), savedB);
    assert.deepEqual(await previewPixels(page), pixelsBefore);
    assert.equal(await page.locator('[data-nine-preview-cell="0"]').getAttribute('data-cover-fit'), 'contain');
    assert.equal(await page.locator('[data-nine-preview-cell="1"]').getAttribute('data-cover-fit'), 'cover');
    const restored = (await revisionNote(page).textContent()).trim();
    assert.match(restored, /Fictional board B/, restored);
    assert.doesNotMatch(restored, /not saved yet/i, restored);
    await addCover(page, 1, coverB);
    await waitForRevision(page, 'not saved yet');
    console.log(`PASS race ${name} ${viewport.width}px`);
  } finally {
    await context.close();
  }
}

async function identityAndSanitation(browser) {
  const { context, page } = await openBoard(browser, { width: 1440, height: 900 });
  try {
    await titleField(page).fill('Fictional identity board');
    await item(page, 0).fill('Fixture item');
    await saveButton(page).click();
    await waitForRevision(page, 'Fictional identity board');
    const clean = (await revisionNote(page).textContent()).trim();
    assert.doesNotMatch(clean, /not saved yet/i, clean);

    // A plain edit is unsaved; typing it back is the same board identity.
    await titleField(page).fill('Fictional identity board edited');
    const dirty = (await revisionNote(page).textContent()).trim();
    assert.match(dirty, /Fictional identity board/, dirty);
    assert.match(dirty, /not saved yet/i, dirty);
    await titleField(page).fill('Fictional identity board');
    assert.equal((await revisionNote(page).textContent()).trim(), clean);

    // An unsaveable profile is dropped from the bytes, and the status says so.
    await page.locator('[data-profile]').fill('javascript:not-a-profile');
    await saveButton(page).click();
    await waitForRevision(page, 'without the invalid profile link');
    assert.equal((await readStoredBoard(page)).profile, null);
    assert.match((await revisionNote(page).textContent()).trim(), /Fictional identity board/);

    await page.locator('[data-profile]').fill('https://example.com/fictional-creator');
    await saveButton(page).click();
    await page.waitForFunction(() => !document.querySelector('[data-draft-status]')?.textContent?.includes('Saving'));
    // IDB is the live store; read the saved record directly.
    await page.waitForFunction(async () => {
      const db = await new Promise((resolve) => {
        const request = indexedDB.open('composer-top-nine-device-draft', 1);
        request.onsuccess = () => resolve(request.result);
      });
      const record = await new Promise((resolve) => {
        const request = db.transaction('drafts', 'readonly').objectStore('drafts').get('current');
        request.onsuccess = () => resolve(request.result);
      });
      db.close();
      return JSON.parse(record.draft.file).profile === 'https://example.com/fictional-creator';
    });
    assert.doesNotMatch((await revisionNote(page).textContent()).trim(), /without the invalid profile link/);
    console.log('PASS identity and profile sanitation chromium 1440px');
  } finally {
    await context.close();
  }
}

async function storageFailure(browser) {
  const { context, page } = await openBoard(browser, { width: 390, height: 844 });
  try {
    const cover = await fixturePng(page, ['#883311', '#eeaa00', '#111111']);
    await titleField(page).fill('Fictional board C');
    await item(page, 0).fill('Fixture C1');
    await addCover(page, 0, cover);
    await saveButton(page).click();
    await waitForRevision(page, 'Fictional board C');
    const before = await readStoredBoard(page);

    // One failed device open: nothing is overwritten and the board stays.
    await page.evaluate(() => {
      const original = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function () {
        IDBFactory.prototype.open = original;
        const request = {
          error: new DOMException('deliberate storage fault', 'QuotaExceededError'),
          onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null,
        };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      };
    });
    await saveButton(page).click();
    await page.waitForFunction(() => document.querySelector('[data-draft-status]')?.textContent?.includes('couldn’t save the draft'));
    assert.equal(await titleField(page).inputValue(), 'Fictional board C');
    assert.equal(await item(page, 0).inputValue(), 'Fixture C1');
    assert.equal(await page.locator('[data-nine-preview-cover="0"]').isVisible(), true);
    assert.deepEqual(await readStoredBoard(page), before);

    // Portable recovery still works after the device failure.
    await page.getByText('Drafts', { exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-draft-file-save]').click(),
    ]);
    const file = await readFile(await download.path());
    const portable = JSON.parse(file.toString());
    assert.equal(portable.title, 'Fictional board C');
    assert.equal(portable.items[0], 'Fixture C1');
    await titleField(page).fill('Fictional board D');
    await page.locator('[data-draft-file]').setInputFiles({
      name: 'composer-top-nine-draft.json', mimeType: 'application/json', buffer: file,
    });
    await page.waitForFunction(() => document.querySelector('[data-exhibition-title]')?.value === 'Fictional board C');
    assert.equal(await item(page, 0).inputValue(), 'Fixture C1');
    console.log('PASS storage failure and portable recovery chromium 390px');
  } finally {
    await context.close();
  }
}

try {
  for (const [name, engine] of engines) {
    const browser = await engine.launch();
    try {
      // One engine per size: Chromium at desktop, WebKit at phone.
      if (name === 'chromium') {
        await race(browser, name, { width: 1440, height: 900 });
        await identityAndSanitation(browser);
        await storageFailure(browser);
      } else {
        await race(browser, name, { width: 390, height: 844 });
      }
    } finally {
      await browser.close();
    }
  }
  console.log(`ALL PASS ${origin}`);
} finally {
  // Every context and browser above closes; no other resource is owned here.
}

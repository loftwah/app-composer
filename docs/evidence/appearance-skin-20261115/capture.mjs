// Browser acceptance for the public /appearance skin reference.
//
// Proves: both skins render at phone and desktop widths in light and dark, no
// horizontal overflow, keyboard operation, the saved/reopened local choice, the
// compare slider's keyboard and value text, and the off / on / unsupported
// press-feedback paths. It does not prove physical vibration, screen-reader
// speech, hosted Access or a production release.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, "screens"));
mkdirSync(out, { recursive: true });
const origin = process.env.APPEARANCE_ORIGIN ?? "http://127.0.0.1:4326";
const receipt = {
  schema: "composer.appearance-lab-acceptance/1",
  source: process.env.APPEARANCE_SOURCE ?? "working tree",
  url: `${origin}/appearance`,
  browser: "Chromium via Playwright",
  warning:
    "Headless Chromium only. No physical phone, no screen reader, no production deployment and no owner acceptance.",
  checks: {},
  captures: [],
};
let browser;
try {
  browser = await chromium.launch();
  async function pageFor({ width, height, theme, reduced = false, scripts = [] }) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    for (const script of scripts) await context.addInitScript(script);
    const page = await context.newPage();
    await page.goto(`${origin}/appearance`, { waitUntil: "networkidle" });
    await page.evaluate((value) => localStorage.setItem("composer-theme", value), theme);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Two skins. One set of controls." }).waitFor();
    return { context, page };
  }
  const capture = async (page, name) => {
    await page.screenshot({ path: join(out, name), fullPage: true });
    receipt.captures.push(name);
  };
  const noOverflow = (page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  // Desktop and phone, both themes, both skins.
  for (const [width, height, suffix] of [
    [390, 844, "390"],
    [1440, 900, "1440"],
    [1728, 1080, "1728"],
  ]) {
    for (const theme of ["dark", "light"]) {
      const { context, page } = await pageFor({ width, height, theme });
      assert.ok(await noOverflow(page), `${suffix} ${theme} has no horizontal overflow`);
      await page.getByRole("radio", { name: /Workshop press/ }).check();
      await page.locator(".appearance-lab-pressure input").fill("4");
      await page.waitForTimeout(100);
      assert.ok(await noOverflow(page), `${suffix} ${theme} press skin does not overflow`);
      await capture(page, `appearance-${suffix}-${theme}-workshop.png`);
      await page.getByRole("radio", { name: /Contact sheet/ }).check();
      await page.locator(".appearance-lab-pressure input").fill("3");
      await page.waitForTimeout(100);
      assert.ok(await noOverflow(page), `${suffix} ${theme} sheet skin does not overflow`);
      await capture(page, `appearance-${suffix}-${theme}-contact-sheet.png`);
      const skin = await page
        .locator("[data-appearance-lab] .skin-specimen")
        .first()
        .getAttribute("data-composer-skin");
      assert.equal(skin, "contact-sheet");
      await context.close();
    }
  }
  receipt.checks.phoneAndDesktop = "390/1440/1728, dark and light, both skins, no horizontal overflow";

  // Keyboard: radio group, pressure range, saved choice, reopen, reset.
  {
    const { context, page } = await pageFor({ width: 1440, height: 900, theme: "dark" });
    const composer = page.getByRole("radio", { name: /Composer default/ });
    await composer.focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.getByRole("radio", { name: /Workshop press/ }).isChecked(),
      true,
    );
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page.getByRole("radio", { name: /Contact sheet/ }).isChecked(),
      true,
    );
    const pressure = page.locator(".appearance-lab-pressure input");
    await pressure.focus();
    await page.keyboard.press("End");
    assert.equal(await pressure.inputValue(), "4");
    assert.match(await pressure.getAttribute("aria-valuetext"), /Pressed — 4 of 4/);
    await page.getByRole("textbox", { name: /sample admin name/ }).focus();
    const outline = await page
      .getByRole("textbox", { name: /sample admin name/ })
      .evaluate((node) => getComputedStyle(node).outlineWidth);
    assert.notEqual(outline, "0px", "the sample field shows a visible focus outline");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Two skins. One set of controls." }).waitFor();
    assert.equal(
      await page.getByRole("radio", { name: /Contact sheet/ }).isChecked(),
      true,
      "the chosen skin reopens",
    );
    assert.equal(await pressure.inputValue(), "4");
    assert.match(await page.getByRole("status").first().innerText(), /Saved on this device/);
    await page.getByRole("button", { name: "Reset to Composer default" }).click();
    assert.equal(
      await page.getByRole("radio", { name: /Composer default/ }).isChecked(),
      true,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Two skins. One set of controls." }).waitFor();
    assert.equal(
      await page.getByRole("radio", { name: /Composer default/ }).isChecked(),
      true,
      "reset does not reopen the old skin",
    );
    receipt.checks.keyboardAndReopen =
      "arrow keys change skin, End sets pressure 4 with spoken value text, focus outline visible, choice reopens, reset clears it";
    await context.close();
  }

  // Compare slider: value text and keyboard both move it.
  {
    const { context, page } = await pageFor({ width: 1440, height: 900, theme: "light" });
    const slider = page.getByRole("slider", {
      name: "Compare Composer default with the chosen skin",
    });
    await page.getByRole("radio", { name: /Contact sheet/ }).check();
    const before = Number(await slider.inputValue());
    await slider.focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal(Number(await slider.inputValue()), before - 1);
    assert.match(await slider.getAttribute("aria-valuetext"), /Composer default visible/);
    await capture(page, "appearance-compare-1440-light.png");
    receipt.checks.compareSlider =
      "native range is the only control; ArrowLeft moves it; aria-valuetext names both panes";
    await context.close();
  }

  // Off path: nothing plays, the pressed edge still works.
  {
    const { context, page } = await pageFor({ width: 900, height: 1000, theme: "dark" });
    await page.getByRole("radio", { name: /Workshop press/ }).check();
    assert.equal(
      await page.getByRole("checkbox", { name: /Sound cue on this device/ }).isChecked(),
      false,
    );
    assert.equal(
      await page.getByRole("checkbox", { name: /Haptic tap on supported devices/ }).isChecked(),
      false,
    );
    await page.getByRole("button", { name: "Press the sample" }).click();
    assert.match(
      await page.getByRole("status").last().innerText(),
      /Press feedback is off/,
    );
    receipt.checks.offPath = "both preferences start unchecked; pressing reports that feedback is off";
    await context.close();
  }

  // On path with observable audio and vibration calls.
  {
    const probe = () => {
      window.__skinProbe = { oscillators: 0, vibrations: [] };
      const Original = window.AudioContext;
      class Probed extends Original {
        createOscillator() {
          window.__skinProbe.oscillators += 1;
          return super.createOscillator();
        }
      }
      window.AudioContext = Probed;
      navigator.vibrate = (pattern) => {
        window.__skinProbe.vibrations.push(pattern);
        return true;
      };
    };
    {
      const { context, page } = await pageFor({
        width: 900,
        height: 1000,
        theme: "dark",
        scripts: [probe],
      });
      await page.getByRole("radio", { name: /Workshop press/ }).check();
      await page.getByRole("checkbox", { name: /Sound cue on this device/ }).check();
      await page.getByRole("checkbox", { name: /Haptic tap on supported devices/ }).check();
      await page.getByRole("button", { name: "Press the sample" }).click();
      await page.getByRole("status").filter({ hasText: /Played/ }).waitFor();
      const result = await page.evaluate(() => window.__skinProbe);
      assert.equal(result.oscillators, 2, "press plays the tick and the settle");
      assert.deepEqual(result.vibrations, [[12]]);
      receipt.checks.onPath =
        "sound and haptics enable deliberately; one press played two oscillator starts and one 12ms vibration pattern";
      await context.close();
    }
    {
      const { context, page } = await pageFor({
        width: 900,
        height: 1000,
        theme: "dark",
        reduced: true,
        scripts: [probe],
      });
      await page.getByRole("radio", { name: /Workshop press/ }).check();
      await page.getByRole("checkbox", { name: /Sound cue on this device/ }).check();
      await page.getByRole("checkbox", { name: /Haptic tap on supported devices/ }).check();
      await page.getByRole("button", { name: "Press the sample" }).click();
      await page.getByRole("status").filter({ hasText: /Played/ }).waitFor();
      const result = await page.evaluate(() => window.__skinProbe);
      assert.equal(result.oscillators, 1, "reduced motion drops the settle tick");
      assert.deepEqual(result.vibrations, [], "reduced motion drops the vibration");
      receipt.checks.reducedMotion =
        "with prefers-reduced-motion the same press played one tick and no vibration";
      await capture(page, "appearance-reduced-motion-900-dark.png");
      await context.close();
    }
  }

  // Unsupported path: no Web Audio and no vibration API.
  {
    const strip = () => {
      Object.defineProperty(window, "AudioContext", { value: undefined });
      Object.defineProperty(window, "webkitAudioContext", { value: undefined });
      Object.defineProperty(navigator, "vibrate", { value: undefined });
    };
    const { context, page } = await pageFor({
      width: 900,
      height: 1000,
      theme: "light",
      scripts: [strip],
    });
    assert.equal(
      await page.getByRole("checkbox", { name: /Sound cue on this device/ }).isDisabled(),
      true,
    );
    assert.equal(
      await page.getByRole("checkbox", { name: /Haptic tap on supported devices/ }).isDisabled(),
      true,
    );
    assert.match(await page.locator("body").innerText(), /does not expose Web Audio/);
    assert.match(await page.locator("body").innerText(), /does not report vibration support/);
    await page.getByRole("button", { name: "Press the sample" }).click();
    assert.match(
      await page.getByRole("status").last().innerText(),
      /Press feedback is off/,
    );
    await capture(page, "appearance-unsupported-900-light.png");
    receipt.checks.unsupportedPath =
      "Web Audio and navigator.vibrate removed; both preferences disabled with the reason, press still works";
    await context.close();
  }

  writeFileSync(join(out, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await browser?.close();
}

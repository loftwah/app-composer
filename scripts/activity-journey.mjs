// Run with an existing Playwright host against a selected public page or an
// isolated fictional Worker. No runner, credentials or browser enters runtime.
export async function verifyActivity(
  page,
  url,
  { width = 390, theme = "dark", screenshot } = {},
) {
  const ensure = (value, message) => {
    if (!value) throw Error(message);
  };
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
  }, theme);
  await page.locator("[data-activity-history].activity-enhanced").waitFor();
  await page.evaluate(() => document.fonts.ready);
  ensure(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Activity report overflows the page",
  );
  ensure(
    await page
      .locator("#activity-signal")
      .evaluate((input) => parseFloat(getComputedStyle(input).fontSize) >= 16),
    "Signal selector is below the native font floor",
  );
  const api = await (
    await page.request.get(new URL("/api/portfolio-analytics?days=7", url).href)
  ).json();
  const verified = [];
  for (const key of [
    "app_opens",
    "photo_opens",
    "inspection_completed",
    "guest_postcards_received",
  ]) {
    await page.locator("#activity-signal").selectOption(key);
    const panel = page.locator(`[data-signal="${key}"]`);
    ensure(await panel.isVisible(), "Selected signal is not visible");
    ensure(
      (await page.locator("[data-signal]:visible").count()) === 1,
      "Signals are displayed as an ambiguous combined score",
    );
    const metric = api.metrics.find((metric) => metric.key === key);
    ensure(
      (await panel.locator(".signal-heading strong").textContent()) ===
        (metric.value === null
          ? "Unavailable"
          : metric.value.toLocaleString("en-AU")),
      "Displayed total differs from the public API",
    );
    const range = panel.locator("[data-day-range]");
    await range.focus();
    await page.keyboard.press("Home");
    ensure(
      (await range.inputValue()) === "0",
      "Home did not reach the first UTC day",
    );
    ensure(
      await panel.locator('[data-step="-1"]').isDisabled(),
      "Previous day is enabled outside the window",
    );
    const first = await panel
      .locator("[data-day-date]")
      .first()
      .getAttribute("data-day-text");
    ensure(
      (await panel.locator("[data-day-description]").textContent()) === first,
      "Keyboard inspection does not match the daily table",
    );
    await page.keyboard.press("End");
    ensure(
      await panel.locator('[data-step="1"]').isDisabled(),
      "Next day is enabled outside the window",
    );
    await panel.locator('[data-step="-1"]').click();
    ensure(
      (await range.inputValue()) === "5",
      "Previous UTC day did not update the native range",
    );
    verified.push({
      key,
      value: metric.value,
      quality: metric.quality,
      keyboardTableAgreement: true,
    });
  }
  await page.locator("#activity-signal").selectOption("app_opens");
  if (screenshot) {
    await page.locator("[data-activity-history]").scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshot });
  }
  await page.locator("#activity-days").selectOption("30");
  await page
    .getByRole("button", { name: "Update window", exact: true })
    .click();
  await page.waitForURL((value) => value.searchParams.get("days") === "30");
  ensure(
    (await page
      .locator('[data-signal="app_opens"] [data-day-date]')
      .count()) === 30,
    "Native GET period did not update the requested UTC window",
  );
  await page.locator("#activity-surface").selectOption("composed");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.waitForURL(
    (value) => value.searchParams.get("surface") === "composed",
  );
  ensure(
    (await page.locator(".activity-scope").textContent()).includes(
      "Inside Composer",
    ),
    "Surface scope is not explicit",
  );
  ensure(
    (await page.locator(".signal-picker p").textContent()).includes(
      "all connected versions",
    ),
    "Daily scope was silently narrowed to a surface",
  );
  return {
    width,
    theme,
    metrics: verified,
    nativePeriodAndSurface: true,
    overflow: false,
  };
}

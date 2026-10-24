// Reuse the admitted browser host; this module starts no runner or browser.
// The caller owns the page/context and captures the returned bounded receipt.
export async function verifyResourceReading(page, origin, { screenshot } = {}) {
  const ensure = (condition, message) => {
    if (!condition) throw Error(message);
  };
  const target = new URL(
    "/resources/incident?analytics=off&qa=1#resource",
    origin,
  ).href;
  const receipt = {
    longRunbook: null,
    textSize: [],
    reducedMotion: false,
    limits: [
      "200% root text-size scaling is a layout probe, not native browser text-only zoom or assistive-technology acceptance.",
    ],
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  ensure(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    "Reduced-motion preference was not applied",
  );
  await page.locator("#resource-fallback summary").click();
  const text = page.locator("#resource-text");
  const value = await text.inputValue();
  ensure(
    value.length > 2500 &&
      value.includes("## Success receipt") &&
      value.includes("## Copyable agent prompt"),
    "Complete long runbook is absent",
  );
  await text.focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End",
  );
  const end = await text.evaluate((element) => ({
    end: element.selectionEnd,
    length: element.value.length,
    scroll: element.scrollTop,
    max: element.scrollHeight - element.clientHeight,
  }));
  ensure(
    end.end === end.length && end.scroll > 0 && end.scroll >= end.max - 4,
    "Keyboard cannot reach the end of the complete long runbook",
  );
  await page.keyboard.press("Tab");
  ensure(
    !(await text.evaluate((element) => document.activeElement === element)),
    "Long-text control traps keyboard focus",
  );
  receipt.longRunbook = {
    resource: "incident",
    characters: value.length,
    complete: true,
    keyboardEndAndExit: true,
  };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      const metrics = await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.fontSize = "200%";
        return {
          base: getComputedStyle(document.documentElement).fontSize,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      }, theme);
      ensure(parseFloat(metrics.base) >= 32, "Root text size did not double");
      ensure(
        metrics.overflow <= 1,
        "Resource layout overflows at 200% root text size",
      );
      await page.locator("#resource").scrollIntoViewIfNeeded();
      const download = page.locator(".resource-actions a[download]");
      await download.focus();
      ensure(
        await download.evaluate(
          (element) => document.activeElement === element,
        ),
        "Scaled resource download lost keyboard focus",
      );
      ensure(
        (await download.getAttribute("href")) === "/resources/incident.md",
        "Scaled resource action changed its selected job",
      );
      if (screenshot)
        await page.screenshot({
          path: screenshot({
            width,
            theme,
            textScale: 200,
            reducedMotion: true,
          }),
        });
      receipt.textSize.push({
        width,
        theme,
        rootPercent: 200,
        overflow: false,
        actionReachable: true,
      });
    }
  }
  await page.locator('.resource-jobs a[data-resource-id="change"]').click();
  ensure(
    new URL(page.url()).pathname === "/resources/change",
    "Reduced-motion native resource navigation failed",
  );
  ensure(
    (await page.locator("#resource").textContent()) === "Make a change",
    "Reduced-motion selection shows the wrong runbook",
  );
  ensure(
    await page
      .locator("#resource")
      .evaluate((element) => document.activeElement === element),
    "Native reduced-motion fragment did not focus the selected heading",
  );
  await page.keyboard.press("Tab");
  ensure(
    await page
      .locator(".resource-actions a[download]")
      .evaluate((element) => document.activeElement === element),
    "Native reduced-motion selection lost its next download Tab destination",
  );
  ensure(
    await page.evaluate(
      () =>
        getComputedStyle(document.documentElement).scrollBehavior !== "smooth",
    ),
    "Reduced-motion navigation retains smooth scrolling",
  );
  receipt.reducedMotion = true;
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return receipt;
}

// Bounded live device-support evidence for the exact LDraw release.
//
// Mirrors the independent app's own qualification journey against the deployed
// origin with a fresh Chromium profile per device: fresh-visitor dark default,
// native text/drawing, named block library, native file roundtrip, PNG/SVG
// export, autosave reload and (desktop) the offline cached workspace. It is a
// browser-emulation probe, not physical-device or assistive-technology proof.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RUN = "/private/var/folders/qm/ltm8shgs7tv9k8qfqgfpjxq80000gn/T/opencode/composer-ldraw-refresh-20261025";
const OUT = join(RUN, "device");
const LIVE = "https://ldraw.loftwah.com/";
const EXPECTED_SOURCE = "fa7a2ab6171cf53edc53c01630fbba2d5d4888aa";
const EXECUTABLE =
  "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const modifier = "Meta";

mkdirSync(OUT, { recursive: true });
if (existsSync(join(OUT, "report.json"))) throw new Error("This run root already holds a report.");

const report = {
  schema: "composer.ldraw-live-device-evidence/1",
  observedAt: new Date().toISOString(),
  url: LIVE,
  expectedSource: EXPECTED_SOURCE,
  browser: "Chromium 1248 headless shell (Playwright 1.64 alpha), deviceScaleFactor 1, pointer/keyboard emulation",
  checks: [],
  problems: [],
};
const check = (name, pass, detail) => {
  report.checks.push({ name, pass: Boolean(pass), detail });
  if (!pass) report.problems.push({ name, detail });
  return pass;
};
const sceneOf = (page) => page.evaluate(() => window.ldraw.readScene());
const exportBundle = (page) =>
  page.evaluate(async () => {
    const output = {};
    for (const kind of ["png", "svg"]) {
      const bytes = new Uint8Array(await (await window.ldraw.exportBlob(kind)).arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      output[kind] = { base64: btoa(binary), bytes: bytes.length };
    }
    return output;
  });
const pngSize = (base64) => {
  const buffer = Buffer.from(base64, "base64");
  return {
    signature: buffer.subarray(0, 8).toString("hex"),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

async function journeys(label, contextOptions, profileName, { desktop }) {
  const profile = join(OUT, profileName);
  if (existsSync(profile) && readdirSync(profile).length) throw new Error("Profile is not fresh: " + profile);
  mkdirSync(profile, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: EXECUTABLE,
    headless: true,
    downloadsPath: join(OUT, profileName + "-downloads"),
    ...contextOptions,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    report.problems.push({ name: label + " pageerror", detail: String(error) }),
  );
  const result = { label };
  try {
    await page.goto(LIVE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.ldraw), null, { timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".excalidraw").waitFor();
    await page.waitForTimeout(1200);

    result.dark = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      appearance: document.documentElement.dataset.appearance,
      editorDark: document.querySelector(".excalidraw")?.classList.contains("theme--dark") ?? false,
      stored: localStorage.getItem("ldraw:appearance"),
    }));
    check(
      label + ": fresh visitor opens the default dark editor",
      result.dark.theme === "dark" && result.dark.appearance === "dark" && result.dark.editorDark,
      result.dark,
    );

    const initial = await sceneOf(page);
    check(
      label + ": default Creator journey scene is present and editable",
      initial.scene.elements.some((element) => element.text === "Creator journey") &&
        initial.scene.elements.length > 8,
      { elements: initial.scene.elements.length, revision: initial.revision },
    );

    result.overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    check(label + ": no horizontal overflow", result.overflow.document <= 0, result.overflow);

    // Native human text entry, then native undo/redo. The phone viewport keeps
    // the probe point inside its own 390x844 canvas.
    const point = desktop ? { x: 900, y: 760 } : { x: 200, y: 520 };
    await page.mouse.click(point.x, point.y);
    await page.keyboard.press("t");
    await page.mouse.click(point.x, point.y);
    await page.keyboard.type("Composer device note");
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => window.ldraw.readScene().scene.elements.some((element) => element.text === "Composer device note"),
      null,
      { timeout: 15000 },
    );
    const typed = await sceneOf(page);
    const note = typed.scene.elements.find((element) => element.text === "Composer device note");
    await page.keyboard.press(modifier + "+z");
    await page.waitForFunction(
      () =>
        !window.ldraw
          .readScene()
          .scene.elements.some((element) => !element.isDeleted && element.text === "Composer device note"),
      null,
      { timeout: 15000 },
    );
    await page.keyboard.press(modifier + "+Shift+z");
    await page.waitForFunction(
      (id) => window.ldraw.readScene().scene.elements.some((element) => !element.isDeleted && element.id === id),
      note.id,
      { timeout: 15000 },
    );
    check(label + ": native keyboard text entry with undo/redo keeping the element", Boolean(note), {
      id: note.id,
      fontSize: note.fontSize,
      fontFamily: note.fontFamily,
    });

    if (desktop) {
      await page.getByRole("button", { name: "Library", exact: true }).first().click();
      const dialog = page.getByRole("dialog", { name: "LDraw library" });
      await dialog.waitFor();
      const library = await dialog.evaluate((node) => ({
        items: [...node.querySelectorAll(".library-item strong")].map((item) => item.textContent.trim()),
        groups: [...node.querySelectorAll(".library-group h3")].map((item) => item.textContent.trim()),
      }));
      const before = (await sceneOf(page)).scene.elements.filter((element) => !element.isDeleted).length;
      await dialog.locator(".library-item", { hasText: "Composer pipeline" }).click();
      await page.waitForFunction(
        (count) =>
          window.ldraw.readScene().scene.elements.filter((element) => !element.isDeleted).length > count,
        before,
        { timeout: 15000 },
      );
      const after = (await sceneOf(page)).scene.elements.filter((element) => !element.isDeleted).length;
      result.library = { ...library, before, after };
      check(
        label + ": named block library opens and inserts an editable block",
        library.items.length >= 10 &&
          library.items.includes("Composer pipeline") &&
          library.groups.length >= 4 &&
          after > before,
        { items: library.items.length, groups: library.groups.length, before, after },
      );
    }

    // Native file roundtrip with a real image payload.
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const current = await sceneOf(page);
    const fixture = structuredClone(current.scene);
    const base = fixture.elements.find((element) => element.type === "rectangle") ?? fixture.elements[0];
    fixture.elements.push({
      ...base,
      id: "composer-evidence-image",
      type: "image",
      x: 30,
      y: 30,
      width: 50,
      height: 50,
      fileId: "composer-evidence-pixel",
      status: "saved",
      scale: [1, 1],
      crop: null,
      boundElements: null,
      version: 1,
      versionNonce: 1,
    });
    fixture.files = fixture.files ?? {};
    fixture.files["composer-evidence-pixel"] = {
      id: "composer-evidence-pixel",
      dataURL: pixel,
      mimeType: "image/png",
      created: 1,
    };
    const fixturePath = join(OUT, label + "-roundtrip.excalidraw");
    writeFileSync(fixturePath, JSON.stringify(fixture));
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("input[type=file]").setInputFiles(fixturePath);
    await page.waitForFunction(
      () => window.ldraw.readScene().scene.elements.some((element) => element.id === "composer-evidence-image"),
      null,
      { timeout: 20000 },
    );
    const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
    await page.getByRole("button", { name: "Save editable" }).click();
    const download = await downloadPromise;
    const savedPath = await download.path();
    const savedBytes = readFileSync(savedPath);
    const saved = JSON.parse(savedBytes.toString("utf8"));
    const savedHuman = saved.elements.find((element) => element.id === note.id);
    check(
      label + ": native file open and Save editable roundtrip preserve IDs, image bytes and text",
      Boolean(savedHuman) &&
        saved.files["composer-evidence-pixel"]?.dataURL === pixel &&
        saved.elements.some((element) => element.text === "Composer device note") &&
        savedBytes.length > 1000,
      {
        bytes: savedBytes.length,
        sha256: createHash("sha256").update(savedBytes).digest("hex"),
        elements: saved.elements.length,
        humanText: savedHuman?.text ?? null,
      },
    );

    const exported = await exportBundle(page);
    const png = pngSize(exported.png.base64);
    const svg = Buffer.from(exported.svg.base64, "base64").toString("utf8");
    result.export = {
      png: { ...png, bytes: exported.png.bytes },
      svg: {
        bytes: exported.svg.bytes,
        hasSvg: /<svg/.test(svg),
        hasText: svg.includes("Composer device note"),
        hasEmbeddedImage: /data:image\/png;base64/.test(svg),
        hasFontFace: /@font-face/.test(svg),
      },
    };
    check(
      label + ": PNG and SVG export are real bytes from this release",
      png.signature === "89504e470d0a1a0a" &&
        png.width > 0 &&
        png.height > 0 &&
        result.export.svg.hasSvg &&
        result.export.svg.hasText &&
        result.export.svg.hasEmbeddedImage &&
        result.export.svg.hasFontFace,
      result.export,
    );

    await page.waitForFunction(
      () => document.querySelector("[role=status]")?.textContent === "Saved on this browser",
      null,
      { timeout: 30000 },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.ldraw), null, { timeout: 45000 });
    await page.waitForFunction(
      () => window.ldraw.readScene().scene.elements.some((element) => element.text === "Composer device note"),
      null,
      { timeout: 30000 },
    );
    const restored = await sceneOf(page);
    check(
      label + ": autosave reload restores the current scene from this browser",
      restored.scene.elements.some((element) => element.id === note.id),
      { elements: restored.scene.elements.length, revision: restored.revision },
    );

    if (desktop) {
      let offline = null;
      try {
        await page.waitForFunction(
          () => document.body.textContent.includes("Offline workspace cached"),
          null,
          { timeout: 60000 },
        );
        await context.setOffline(true);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(
          () => window.ldraw?.readScene().scene.elements.some((element) => element.id === "composer-evidence-image"),
          null,
          { timeout: 60000 },
        );
        offline = { reloaded: true };
      } catch (error) {
        offline = { reloaded: false, error: String(error).split("\n")[0] };
      } finally {
        await context.setOffline(false);
      }
      result.offline = offline;
      check(label + ": offline cached workspace reload", offline.reloaded, offline);
    }
  } catch (error) {
    report.problems.push({ name: label + " journey aborted", detail: String(error).split("\n").slice(0, 3).join(" ") });
  } finally {
    report.result = { ...(report.result ?? {}), [label]: result };
    await context.close();
  }
}

await journeys("desktop", { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }, "profile-desktop", {
  desktop: true,
});
await journeys(
  "phone",
  { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  "profile-phone",
  { desktop: false },
);

report.finishedAt = new Date().toISOString();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ problems: report.problems, checks: report.checks.map((c) => ({ name: c.name, pass: c.pass })) }, null, 2));
if (report.problems.length) process.exit(1);

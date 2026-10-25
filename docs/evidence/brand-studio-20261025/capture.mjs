// Actual native EmDash runtime and persisted fictional D1. This is local
// acceptance; virtual WebAuthn is not hosted Access/MFA or a physical passkey.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = dirname(fileURLToPath(import.meta.url));
const parent = join(tmpdir(), "opencode");
mkdirSync(parent, { recursive: true });
const root = mkdtempSync(join(parent, "composer-brand-studio-"));
const prep = join(
  source,
  "docs/evidence/admin-journey-20261025/prepare-fixture.mjs",
);
let browser,
  cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (existsSync(join(root, "OWNED.md")))
    spawnSync(
      process.execPath,
      [prep, "--source", source, "--root", root, "--clean"],
      { cwd: source, stdio: "ignore", timeout: 30000 },
    );
  rmSync(root, { recursive: true, force: true });
}
process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
const receipt = {
  schema: "composer.brand-studio-acceptance/1",
  warning:
    "Fictional local native EmDash/D1; virtual passkey. No production Access, MFA, provider or physical-device acceptance.",
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: source,
    encoding: "utf8",
  }).trim(),
  sourceDirty:
    execFileSync("git", ["status", "--porcelain"], {
      cwd: source,
      encoding: "utf8",
    }).trim() !== "",
  runtimeSourceHashes: Object.fromEntries(
    [
      "src/lib/admin-brand.ts",
      "src/lib/admin-brand-contract.ts",
      "src/plugins/brand-studio-page.tsx",
      "src/plugins/brand-studio-page.css",
      "migrations/0020_admin_brand_studio.sql",
    ].map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(join(source, file)))
        .digest("hex"),
    ]),
  ),
  captures: [],
  checks: {},
  cleanup: false,
};
try {
  const port = await new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const selected = server.address().port;
      server.close(() => resolve(selected));
    });
  });
  const origin = "http://localhost:" + port;
  const changes = [
    [
      "src/lib/creator-plugin.ts",
      'import { definePlugin } from "emdash";',
      'import { definePlugin } from "emdash";\nimport { manageAdminBrand,adminBrandStyles } from "./admin-brand.ts";',
    ],
    [
      "src/lib/creator-plugin.ts",
      "pages: [",
      'pages: [\n{path:"/brand-studio",label:"Brand Studio",icon:"paint-brush"},',
    ],
    [
      "src/lib/creator-plugin.ts",
      "routes: {",
      'routes: {\nbrandRead:{methods:["GET"],permission:"plugins:manage",handler:ctx=>manageAdminBrand(ctx,runtime)},\nbrandWrite:{methods:["POST"],permission:"plugins:manage",request:{body:"json",maxBytes:8000},handler:ctx=>manageAdminBrand(ctx,runtime)},',
    ],
    [
      "src/plugins/stacks-admin.tsx",
      "import { PlatformPage }",
      'import { BrandStudioPage } from "./brand-studio-page";\nimport { PlatformPage }',
    ],
    [
      "src/plugins/stacks-admin.tsx",
      'export const pages: PluginAdminExports["pages"] = {',
      'export const pages: PluginAdminExports["pages"] = {\n"/brand-studio":BrandStudioPage,',
    ],
  ];
  const middleware = `import {defineMiddleware} from 'astro:middleware';
import {env} from 'cloudflare:workers';
import {prepareAdminBrand,brandAdminResponse,adminBrandStyles} from './lib/admin-brand.ts';
export const onRequest=defineMiddleware(async(context,next)=>{
if(context.url.pathname==='/_emdash/composer-admin-brand.css')return adminBrandStyles({request:context.request,user:context.locals.user},env);
const presentation=await prepareAdminBrand(context,env);
return brandAdminResponse(await next(),presentation);
});\n`;
  const cloneDependencies = `const {lstatSync,realpathSync}=await import('node:fs');
if(lstatSync(join(app,'node_modules')).isSymbolicLink()){
const dependencies=realpathSync(join(app,'node_modules'));
rmSync(join(app,'node_modules'));
execFileSync('cp',['-cR',dependencies,join(app,'node_modules')]);
}\n`;
  const integration =
    cloneDependencies +
    changes
      .map(
        ([file, before, after]) =>
          "patch(" +
          [
            file,
            before,
            after,
            "Brand Studio native integration before runtime startup",
          ]
            .map((value) => JSON.stringify(value))
            .join(",") +
          ");",
      )
      .join("\n") +
    '\nwriteFileSync(join(app,"src/middleware.ts"),' +
    JSON.stringify(middleware) +
    ");\n";
  const prepareSource = readFileSync(prep, "utf8");
  const marker = 'const port = new URL(origin).port || "80";';
  assert.equal(
    prepareSource.split(marker).length,
    2,
    "Fixture startup seam changed",
  );
  const variant = join(root, "prepare-brand-fixture.mjs");
  writeFileSync(
    variant,
    prepareSource.replace(marker, integration + "\n" + marker),
  );
  execFileSync(
    process.execPath,
    [variant, "--source", source, "--root", root, "--origin", origin],
    { cwd: source, stdio: "pipe", timeout: 240000 },
  );
  const fixture = JSON.parse(readFileSync(join(root, "fixture.json"), "utf8"));
  receipt.integrationSeams = [
    "Native page/route registration only in fixture copy.",
    "Existing shared middleware calls prepareAdminBrand before next, brandAdminResponse after next.",
    "Existing fixture: Access removed; native passkeys, local origin, no provider bindings.",
  ];
  browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const request = async (path, body) =>
    page.evaluate(
      async ({ path, body }) => {
        const response = await fetch(path, {
          method: body === undefined ? "GET" : "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-EmDash-Request": "1",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const parsed = await response.json();
        if (!response.ok || parsed.success === false)
          throw Error(JSON.stringify(parsed));
        return parsed.data ?? parsed;
      },
      { path, body },
    );
  await page.goto(origin + "/_emdash/api/auth/mode", {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await request("/_emdash/api/setup", {
    title: "Fictional Brand Studio",
    tagline: "Local acceptance only",
    includeContent: false,
  });
  const admin = await request("/_emdash/api/setup/admin", {
    email: "brand-fixture@example.test",
    name: "Fictional brand owner",
  });
  const credential = await page.evaluate(async (options) => {
    const result = await navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
    });
    return result.toJSON();
  }, admin.options);
  await request("/_emdash/api/setup/admin/verify", { credential });
  console.log(
    "Native setup result",
    JSON.stringify(await request("/_emdash/api/auth/me")),
  );
  const studio = "/_emdash/admin/plugins/composer-stacks/brand-studio",
    overview = "/_emdash/admin/plugins/composer-stacks/overview";
  const capture = async (name) => {
    await page.screenshot({ path: join(out, name), fullPage: true });
    receipt.captures.push(name);
  };
  await page.goto(origin + overview, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  const welcome = page.getByRole("button", {
    name: "Get Started",
    exact: true,
  });
  await welcome.waitFor({ state: "visible", timeout: 60000 });
  await welcome.click();
  await welcome.waitFor({ state: "hidden" });
  await page
    .getByRole("heading", { name: "Needs attention", exact: true })
    .waitFor();
  await page.locator(".co-next h2").waitFor();
  await capture("before-native-1440-dark.png");
  await page.goto(origin + studio, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.getByRole("textbox", { name: /^Admin name/ }).waitFor();
  await page
    .getByRole("textbox", { name: /^Admin name/ })
    .fill("App Composer Studio");
  await page
    .getByLabel("Footer label", { exact: true })
    .fill("Built with App Composer");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByText("Draft saved. Open an actual admin preview before publishing.", {
      exact: true,
    })
    .waitFor();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "Open Desktop preview", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState("networkidle");
  await popup
    .getByText("Saved appearance preview · version 1.", { exact: false })
    .waitFor();
  assert.equal(await popup.title(), "App Composer Studio Admin");
  assert.equal(
    await popup.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-kumo-brand")
        .trim(),
    ),
    "#c74400",
  );
  await popup.close();
  receipt.checks.actualNativePreview = true;
  await page
    .getByLabel("I reviewed the saved draft on the screens I need.", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Publish saved appearance", exact: true })
    .click();
  await page
    .getByText(
      "Appearance published. Reload an admin tab to see the saved result.",
      { exact: true },
    )
    .waitFor();
  let snapshot = await request(
    "/_emdash/api/plugins/composer-stacks/brandRead?action=read",
  );
  assert.equal(snapshot.publishedVersion, 2);
  const first = snapshot.published;
  const anonymous = await browser.newContext();
  const deniedCss = await anonymous.request.get(
    origin + "/_emdash/composer-admin-brand.css?version=2",
  );
  assert.equal(deniedCss.status(), 403);
  await anonymous.close();
  receipt.checks.anonymousStylesDenied = true;
  await page.goto(origin + overview, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "App Composer Studio Admin");
  assert.equal(
    await page.locator('link[data-composer-brand-version="2"]').count(),
    1,
  );
  await page.goto(origin + studio, { waitUntil: "networkidle" });
  await page
    .getByLabel("Footer label", { exact: true })
    .fill("Composer operations");
  await page.getByLabel("Spacing", { exact: true }).selectOption("compact");
  await page.getByLabel("Text size", { exact: true }).selectOption("large");
  assert.equal(
    await page.getByRole("textbox", { name: /^Admin name/ }).inputValue(),
    "App Composer Studio",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByText("Draft saved. Open an actual admin preview before publishing.", {
      exact: true,
    })
    .waitFor();
  const phonePromise = page.waitForEvent("popup");
  await page
    .getByRole("link", { name: "Open Phone preview", exact: true })
    .click();
  const phone = await phonePromise;
  await phone.waitForLoadState("networkidle");
  assert.equal(
    await phone.evaluate(
      () => getComputedStyle(document.documentElement).fontSize,
    ),
    "18px",
  );
  await phone.locator(".co-next h2").waitFor();
  await phone.screenshot({
    path: join(out, "second-draft-native-phone.png"),
    fullPage: true,
  });
  receipt.captures.push("second-draft-native-phone.png");
  await phone.close();
  await page
    .getByLabel("I reviewed the saved draft on the screens I need.", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Publish saved appearance", exact: true })
    .click();
  await page
    .getByText(
      "Appearance published. Reload an admin tab to see the saved result.",
      { exact: true },
    )
    .waitFor();
  snapshot = await request(
    "/_emdash/api/plugins/composer-stacks/brandRead?action=read",
  );
  assert.equal(snapshot.publishedVersion, 4);
  assert.equal(snapshot.published.siteName, first.siteName);
  assert.equal(snapshot.published.footerLabel, "Composer operations");
  assert.deepEqual(
    snapshot.history.find((row) => row.version === 2).config,
    first,
  );
  receipt.checks.secondChangePreservedFirst = true;
  await page
    .getByRole("button", { name: "Restore version 2", exact: true })
    .click();
  await page
    .getByText(
      "Previous published appearance restored as a new version. Earlier versions are retained.",
      { exact: true },
    )
    .waitFor();
  snapshot = await request(
    "/_emdash/api/plugins/composer-stacks/brandRead?action=read",
  );
  assert.equal(snapshot.publishedVersion, 5);
  assert.deepEqual(snapshot.published, first);
  assert.equal(snapshot.history.length, 5);
  receipt.checks.rollbackPreservedHistory = true;
  await page.getByLabel("Import configuration", { exact: true }).setInputFiles({
    name: "unsafe-brand.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...first, css: "body{display:none}" }),
    ),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Use a version 1 Composer appearance file" })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: /^Admin name/ }).inputValue(),
    first.siteName,
  );
  receipt.checks.unsafeImportRetainedForm = true;
  // Dismiss the demonstrated import error with an explicit read; no write.
  await page
    .getByRole("button", { name: "Reload saved appearance", exact: true })
    .click();
  await page.getByRole("textbox", { name: /^Admin name/ }).waitFor();
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ])
    for (const theme of ["dark", "light"]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(
        (theme) => localStorage.setItem("emdash-theme", theme),
        theme,
      );
      await page.goto(origin + studio, { waitUntil: "networkidle" });
      await page.getByRole("textbox", { name: /^Admin name/ }).waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await capture(`studio-${width}-${theme}.png`);
      await page.goto(origin + overview, { waitUntil: "networkidle" });
      await page
        .getByRole("heading", { name: "Needs attention", exact: true })
        .waitFor();
      assert.equal(await page.title(), "App Composer Studio Admin");
      await page.locator(".co-next h2").waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await capture(`after-native-${width}-${theme}.png`);
    }
  await page.goto(origin + studio, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: /^Admin name/ }).waitFor();
  await page.getByRole("textbox", { name: /^Admin name/ }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.tagName),
    "INPUT",
  );
  receipt.checks.keyboardForm = true;
  await page
    .getByRole("heading", { name: "Saved versions", exact: true })
    .scrollIntoViewIfNeeded();
  await capture("history-390-light.png");
  await page.evaluate(() => (document.documentElement.style.fontSize = "32px"));
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  receipt.checks.doubleRootTextReflow = true;
  await capture("studio-390-light-double-root-text.png");
  receipt.checks.nativePerRequestConfig = true;
  receipt.checks.persistedVersions = snapshot.history.map((row) => ({
    version: row.version,
    event: row.event,
    siteName: row.config.siteName,
    footerLabel: row.config.footerLabel,
  }));
  receipt.pageErrors = errors;
  assert.deepEqual(errors, []);
  receipt.success = true;
  console.log(
    JSON.stringify({
      success: true,
      captures: receipt.captures.length,
      checks: receipt.checks,
    }),
  );
} catch (error) {
  receipt.failure = String(error);
  const failed = browser?.contexts()[0]?.pages()[0];
  if (failed) {
    receipt.failedUrl = failed.url();
    receipt.failedBody = (await failed.locator("body").innerText()).slice(
      0,
      5000,
    );
    await failed.screenshot({
      path: join(source, "output/brand-studio/failed-native.png"),
      fullPage: true,
    });
  }
  throw error;
} finally {
  await browser?.close();
  cleanup();
  receipt.cleanup = !existsSync(root);
  writeFileSync(
    join(out, "receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}

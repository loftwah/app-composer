// Real local native EmDash UI, core plugin-state reads and permission dispatch.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import {
  authenticateNativeActors,
  nativeCall,
  nativeData,
} from "../../../labs/platform/native-auth.mjs";
const root = process.argv[2],
  out = process.argv[3];
const fixture = JSON.parse(readFileSync(join(root, "fixture.json"), "utf8"));
assert.match(fixture.warning, /^FICTIONAL LOCAL FIXTURE/);
const sourceFiles = [
  "src/lib/plugin-trust.ts",
  "src/lib/plugin-trust-contract.ts",
  "src/data/plugin-trust-20261025.json",
  "src/plugins/plugin-trust-page.tsx",
  "src/plugins/plugin-trust-page.css",
  "src/lib/creator-plugin.ts",
  "src/plugins/stacks-admin.tsx",
];
const receipt = {
  version: "composer.plugin-trust-native/1",
  source: fixture.sourceRevision,
  sourceDirty: fixture.sourceDirty,
  observedAt: new Date().toISOString(),
  origin: fixture.origin,
  warning:
    "Fictional local native EmDash auth with virtual passkeys. Production profile emulated through an explicit local request-origin seam; not production, Access, MFA, real installation, provider entitlement or physical-device acceptance.",
  seams: fixture.seams,
  runtimeSourceHashes: Object.fromEntries(
    sourceFiles.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(join(fixture.app, file)))
        .digest("hex"),
    ]),
  ),
  checks: {},
  captures: [],
  pageErrors: [],
  console: [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell",
});
let database;
try {
  const auth = await authenticateNativeActors(browser, {
    root,
    origins: { composer: fixture.origin },
  });
  receipt.nativeAuth = { ...auth.qualification, actors: auth.receipt };
  const { owner } = auth.actors,
    page = owner.page;
  page.on("pageerror", (error) => receipt.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") receipt.console.push(message.text());
  });
  const path = "/_emdash/api/plugins/composer-stacks/pluginTrustRead";
  const response = await nativeCall(page, path);
  const report = nativeData(response);
  assert.equal(report.ok, true);
  assert.equal(report.site, "https://composer.loftwah.com");
  assert.equal(report.environment, "production");
  assert.equal(
    report.inventory.available,
    true,
    "Native D1 query must actually succeed",
  );
  database = new DatabaseSync(fixture.database, { readOnly: true });
  const schema = database
    .prepare("PRAGMA table_info('_plugin_state')")
    .all()
    .map((row) => row.name);
  for (const name of [
    "plugin_id",
    "version",
    "status",
    "source",
    "registry_publisher_did",
    "registry_slug",
  ])
    assert.ok(schema.includes(name), "Installed core schema: " + name);
  const actual = database
    .prepare(
      "SELECT plugin_id,version,status,source,registry_publisher_did,registry_slug FROM _plugin_state ORDER BY plugin_id LIMIT 100",
    )
    .all()
    .map((row) => ({ ...row }));
  assert.deepEqual(report.inventory.rows, actual);
  receipt.checks.inventory = {
    http: response.status,
    available: report.inventory.available,
    atLimit: report.inventory.atLimit,
    rows: actual,
    coreSchema: schema,
  };
  receipt.checks.snapshot = {
    observedAt: report.snapshot.observedAt,
    packages: report.snapshot.packages.map((item) => ({
      did: item.did,
      slug: item.slug,
      version: item.version,
      releaseCid: item.releaseCid,
    })),
    ratings: report.evaluations.map((item) => item.state),
  };
  assert.ok(!report.evaluations.some((item) => item.state === "GREEN"));
  for (const key of ["app-user", "creator-a", "creator-b"]) {
    const denied = await nativeCall(auth.actors[key].page, path);
    assert.equal(
      denied.status,
      403,
      key + " must not inherit administrator inventory access",
    );
    receipt.checks[key] = {
      role: auth.actors[key].user.role,
      status: denied.status,
    };
  }
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(fixture.origin + path, {
    maxRedirects: 0,
  });
  assert.equal(denied.status(), 401);
  receipt.checks.anonymous = denied.status();
  await anonymous.close();
  const override = await nativeCall(page, path + "?account=other");
  assert.equal(override.status, 400);
  receipt.checks.targetOverride = override.status;
  const mutation = await nativeCall(page, path, {
    action: "install",
    target: "production",
  });
  assert.equal(mutation.status, 405);
  receipt.checks.mutationDenied = mutation.status;
  const privileged = auth.actors["creator-a"];
  const promoted = await page.evaluate(async (id) => {
    const response = await fetch(
      "/_emdash/api/admin/users/" + encodeURIComponent(id),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-EmDash-Request": "1",
        },
        body: JSON.stringify({ role: 50 }),
      },
    );
    return { status: response.status, body: await response.json() };
  }, privileged.user.id);
  nativeData(promoted);
  const beforeDisabled = await nativeCall(privileged.page, path);
  assert.equal(
    beforeDisabled.status,
    200,
    "Promoted local administrator can read before disable",
  );
  nativeData(
    await nativeCall(
      page,
      "/_emdash/api/admin/users/" + privileged.user.id + "/disable",
      {},
    ),
  );
  const afterDisabled = await nativeCall(privileged.page, path);
  assert.equal(
    afterDisabled.status,
    401,
    "Existing session is refused after local disable",
  );
  const unaffectedOwner = await nativeCall(page, path);
  assert.equal(unaffectedOwner.status, 200);
  receipt.checks.disabledAdministrator = {
    actor: "creator-a",
    promotedRole: 50,
    before: beforeDisabled.status,
    after: afterDisabled.status,
    ownerControl: unaffectedOwner.status,
  };
  await page.goto(
    fixture.origin + "/_emdash/admin/plugins/composer-stacks/plugin-trust",
    { waitUntil: "networkidle", timeout: 180000 },
  );
  await page.getByRole("button", { name: "Get Started", exact: true }).click();
  await page
    .getByRole("heading", { name: "Plugin Trust Centre", exact: true })
    .waitFor();
  await page
    .getByRole("heading", {
      name: "This site's installed inventory",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.locator(".composer-plugin-trust button").count(),
    0,
    "Loaded evaluator has no install/mutation buttons",
  );
  const details = page.locator(".pt-package details").first();
  await details.locator("summary").focus();
  await page.keyboard.press("Space");
  assert.equal(await details.getAttribute("open"), "");
  receipt.checks.keyboardDisclosure = true;
  const capture = async (name) => {
    const path = join(out, name);
    await page.screenshot({ path });
    receipt.captures.push({
      file: name,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    });
  };
  for (const theme of ["dark", "light"])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const toggle = page.getByRole("button", {
        name: theme === "dark" ? "Switch to dark" : "Switch to light",
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.mode === theme,
        theme,
      );
      await page.locator("#plugin-trust-title").scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await capture("native-" + width + "-" + theme + ".png");
    }
  await page
    .getByRole("heading", {
      name: "This site's installed inventory",
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await capture("native-inventory-390-light.png");
  const initialCount = database
    .prepare("SELECT COUNT(*) n FROM _plugin_state")
    .get().n;
  await page.goto(fixture.origin + "/plugin-trust", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", {
      name: "Review a plugin before it reaches your app.",
      exact: true,
    })
    .first()
    .waitFor();
  await capture("public-390-light.png");
  assert.equal(
    database.prepare("SELECT COUNT(*) n FROM _plugin_state").get().n,
    initialCount,
    "Read-only journey leaves core plugin state unchanged",
  );
  receipt.checks.noInstall = { before: initialCount, after: initialCount };
  assert.equal(receipt.pageErrors.length, 0, receipt.pageErrors.join("\n"));
} finally {
  try {
    const pages = browser.contexts().flatMap((context) => context.pages());
    receipt.finalPages = await Promise.all(
      pages.map(async (page) => ({
        url: page.url(),
        text: (await page.locator("body").innerText()).slice(0, 2500),
      })),
    );
  } catch {}
  database?.close();
  await browser.close();
  writeFileSync(join(out, "receipt.json"), JSON.stringify(receipt, null, 2));
}

// Capture the real fictional Guestbook → Linkarooie journey against two local
// Workers. This host script uses an existing Playwright/Chrome installation;
// it does not ship a browser, a runner or any credential in the app runtime.
//
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
//   node labs/building/capture-journey.mjs
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const modulePath = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(modulePath);
const guestbook = process.env.GUESTBOOK_URL || "https://localhost:8788";
const linkarooie = process.env.LINKAROOIE_URL || "https://localhost:8787";
const token = process.env.OWNER_TOKEN || "build-199-fictional-owner";
const resource = process.env.RESOURCE_ID || "build199-trail";
const output =
  process.env.CAPTURE_OUT || "output/build-199/captures";
const specPath =
  process.env.INIT_SPEC ||
  "public/downloads/building-199-init-spec.json";
mkdirSync(output, { recursive: true });
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const NOTE = "A postcard from the edge of the map.";

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const api = context.request;
const files = [];
const checks = [];
const shot = async (name, target = page, options = {}) => {
  const path = `${output}/${name}.png`;
  await target.screenshot({ path, ...options });
  files.push({ name: name + ".png", bytes: readFileSync(path).byteLength });
  return path;
};
const assert = (value, message) => {
  if (!value) throw Error(message);
  checks.push(message);
};
const json = async (response, label) => {
  const value = await response.json();
  if (!response.ok()) throw Error(`${label}: ${response.status()} ${JSON.stringify(value)}`);
  return value;
};
const sourceOf = (revision) => ({
  Authorization: `Bearer ${token}`,
  "X-Composer-Workspace": "build199workspace",
  "X-Composer-Account": "build199account",
  "X-Composer-Environment": "local",
  "X-Composer-Source": revision,
  "X-Composer-Target": guestbook,
});
const resourceURL = `${guestbook}/api/resources/${resource}`;

const builds = {
  guestbook: await json(await api.get(`${guestbook}/build.json`), "Guestbook build"),
  linkarooie: await json(await api.get(`${linkarooie}/build.json`), "Linkarooie build"),
};
const guestbookHeaders = sourceOf(builds.guestbook.revision);
const snapshot = async () => json(await api.get(resourceURL, { headers: guestbookHeaders }), "resource snapshot");
const command = async (body) =>
  json(await api.post(resourceURL, { headers: { ...guestbookHeaders, "Content-Type": "application/json" }, data: body }), "resource " + body.action);
const operation = (action) => `${action}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const stageAndActivate = async (configuration, label) => {
  const current = await snapshot();
  const staged = await command({
    action: "stage",
    operationId: operation("stage"),
    expectedVersion: current.resource.version,
    configuration,
  });
  const active = await command({
    action: "activate",
    operationId: operation("activate"),
    expectedVersion: staged.resource.version,
    configurationRevision: staged.configuration.revision,
    configurationDigest: staged.configuration.digest,
  });
  assert(active.configuration.revision === staged.configuration.revision, `${label} configuration is active`);
  return active;
};

// The profile and Guestbook already hold the Init specification and curated
// links. Capture the starting state before a visitor contributes.
await page.goto(linkarooie + "/", { waitUntil: "networkidle" });
await page.locator(".creator-contribution").waitFor();
await page.evaluate(() => document.fonts.ready);
await shot("01-profile-open-desktop");
const cta = page.getByRole("link", { name: /Leave a note in the guestbook/i });
assert(await cta.isVisible(), "open Guestbook shows a real contribution action");
assert((await page.locator("#guestbook-note-title").textContent()) === "Leave a note", "the invitation names its purpose");

// Real visitor submission through the Guestbook-owned form.
await cta.click();
await page.waitForLoadState("networkidle");
await page.fill(
  'textarea[name="caption"]',
  NOTE,
);
await page.fill('input[name="author"]', "Fictional Visitor");
await page.check('input[name="consent"]');
await page.waitForFunction(() => {
  const button = document.querySelector("#guest-postcard button");
  return button && !button.disabled;
});
await shot("02-contribution-filled-desktop");
await page.fill('input[name="code"]', "hunter2");
await page.getByRole("button", { name: /Send for approval/i }).click();
await page.waitForFunction(
  () => document.querySelector("#guest-postcard button")?.textContent === "Postcard sent",
  null,
  { timeout: 30000 },
);
await page.evaluate(() => {
  const input = document.querySelector('input[name="code"]');
  if (input) input.value = "";
  document.querySelector("#postcard-status")?.focus();
});
const receipt = await page.locator("#postcard-status").textContent();
assert(/with the owner|waiting for owner review/i.test(receipt), "the visitor receives a pending-review receipt");
await shot("03-pending-receipt-desktop");

const exported = await json(
  await api.get(`${resourceURL}/export`, { headers: guestbookHeaders }),
  "owner resource export",
);
const item = exported.items.find(
  (entry) => entry.caption === NOTE,
);
assert(item?.status === "pending", "the contribution is pending and private before approval");
assert(
  (await api.get(`${guestbook}/r/${resource}/media/${item.id}`)).status() === 404,
  "pending media is not public",
);

// Owner approval through the app-owned moderation contract.
const approved = await command({
  action: "moderate",
  operationId: operation("approve"),
  expectedVersion: (await snapshot()).resource.version,
  item: item.id,
  itemRevision: item.revision,
  status: "approved",
});
assert(approved.resource.version > 0, "owner approval is recorded on the resource");
await page.goto(`${guestbook}/r/${resource}/c/1/`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
assert((await page.locator("body").textContent()).includes(NOTE), "approved note is public in Guestbook");
await shot("04-guestbook-approved-desktop");

// Separate explicit composition choice: collect the exact approved source item.
const mine = await json(
  await api.get(`${linkarooie}/api/export`, { headers: { Authorization: `Bearer ${token}` } }),
  "Linkarooie export",
);
const collected = await json(
  await api.post(`${linkarooie}/api/cards`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: linkarooie,
      "X-Composer-Source": builds.linkarooie.revision,
      "X-Composer-Target": linkarooie,
    },
    data: {
      item: item.id,
      status: "published",
      source: {
        kind: "guestbook.resource",
        version: 1,
        resource,
        configuration: 1,
      },
    },
  }),
  "Linkarooie collection write",
);
assert(collected.id && collected.status === "published", "the approved note is explicitly collected in Linkarooie");
const card = mine.cards.find((entry) => entry.id === collected.id);
if (!card?.pinned)
  await json(
    await api.post(`${linkarooie}/api/presentation`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Origin: linkarooie },
      data: { id: collected.id, pinned: true, icon: "heart", group: "Connect" },
    }),
    "Linkarooie pin",
  );
await page.goto(linkarooie + "/", { waitUntil: "networkidle" });
await page.locator("#featured").waitFor();
await page.evaluate(() => document.fonts.ready);
assert((await page.locator("#featured").textContent()).includes(NOTE), "the featured section shows the approved note");
assert(await page.getByRole("link", { name: /Leave a note in the guestbook/i }).isVisible(), "the contribution action remains open after featuring");
await shot("05-featured-profile-desktop");
await page.locator("#featured").scrollIntoViewIfNeeded();
await shot("05b-featured-note-desktop");
await shot("06-featured-section-desktop", page.locator("#featured"));
await page.locator("#reader-theme").click();
await page.evaluate(() => document.fonts.ready);
await shot("07-featured-profile-dark-desktop");
await page.locator("#reader-theme").click();

// Source revocation must remove the card and media, not just hide the CTA.
const hidden = await command({
  action: "moderate",
  operationId: operation("hide"),
  expectedVersion: (await snapshot()).resource.version,
  item: item.id,
  itemRevision: 2,
  status: "hidden",
});
assert(hidden.resource.version > 0, "owner hide is recorded at the source");
assert(
  (await api.get(`${guestbook}/r/${resource}/media/${item.id}`)).status() === 404,
  "hidden media returns 404",
);
assert(
  (await api.get(`${guestbook}/r/${resource}/c/1/api/items/${item.id}`)).status() === 404,
  "hidden item API returns 404",
);
await page.goto(linkarooie + "/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
assert(!(await page.locator("body").textContent()).includes(NOTE), "hidden source content disappears from Linkarooie");
await shot("08-revoked-profile-desktop");

// Closed and paused states come from the source's current active configuration.
await stageAndActivate({ ...spec.appSettings.guestbook, guestAccess: "closed" }, "closed");
await page.goto(linkarooie + "/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
assert((await page.locator(".creator-contribution").textContent()).includes("closed right now"), "closed Guestbook is explained");
assert((await page.getByRole("link", { name: /Leave a note in the guestbook/i }).count()) === 0, "closed Guestbook shows no send action");
await shot("09-closed-profile-desktop");

await stageAndActivate({ ...spec.appSettings.guestbook, guestAccess: "postcards" }, "reopened");
// Re-approve the same fictional note so the final phone view has a finished
// featured result. This is an owner decision, not automatic publication.
const hiddenItem = (await json(await api.get(`${resourceURL}/export`, { headers: guestbookHeaders }), "export after hide")).items.find((entry) => entry.id === item.id);
await command({
  action: "moderate",
  operationId: operation("reapprove"),
  expectedVersion: (await snapshot()).resource.version,
  item: item.id,
  itemRevision: hiddenItem.revision,
  status: "approved",
});
await page.goto(linkarooie + "/", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await shot("10-final-profile-desktop");

const phone = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const mobile = await phone.newPage();
await mobile.goto(linkarooie + "/", { waitUntil: "networkidle" });
await mobile.evaluate(() => document.fonts.ready);
await shot("11-profile-phone", mobile);
await mobile.locator(".creator-contribution").scrollIntoViewIfNeeded();
await shot("12-invitation-phone", mobile.locator(".creator-contribution"));
await mobile.locator("#featured").scrollIntoViewIfNeeded();
await shot("13-featured-phone", mobile.locator("#featured"));
await mobile.getByRole("link", { name: /Leave a note in the guestbook/i }).click();
await mobile.waitForLoadState("networkidle");
await mobile.evaluate(() => document.fonts.ready);
await shot("14-contribution-phone", mobile);
await phone.close();

const report = {
  generated: new Date().toISOString(),
  guestbook: guestbook,
  linkarooie: linkarooie,
  resource,
  contribution: item.id,
  sources: { guestbook: builds.guestbook.revision, linkarooie: builds.linkarooie.revision },
  initSpec: { path: specPath, sha256: createHash("sha256").update(readFileSync(specPath)).digest("hex") },
  checks,
  files,
  notes: {
    approval: "app-owned resource moderation contract",
    featuring: "explicit owner collection write; not automatic publication",
    revocation: "hidden item, media and item API returned 404; Linkarooie card disappeared",
    closedState: "current active Guestbook configuration returned closed; Linkarooie showed no send action",
  },
};
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));

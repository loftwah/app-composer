// Native admin journey acceptance for Needs attention. It drives the real
// Astro dev server from one isolated, clearly fictional local copy of this
// checkout (see prepare-fixture.mjs) and records real pixels and measurements.
//
// What this is: a browser layout/interaction probe against a fictional local
// D1 fixture with EmDash's own passkey auth. What this is not: a production
// owner session, a Cloudflare Access check, physical-device or screen-reader
// acceptance. The owner's draft data is never read or written.
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import { DatabaseSync } from "node:sqlite";
import {
  configurationDigest,
  effectiveGuestbookConfiguration,
} from "../../../src/lib/resource-client.ts";
import { appSettings } from "../../../src/lib/app-settings.mjs";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const index = process.argv.indexOf("--" + name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const root = resolve(arg("root", ""));
if (!arg("root")) throw Error("Pass --root with the prepared fixture root.");
const fixture = JSON.parse(readFileSync(join(root, "fixture.json"), "utf8"));
if (!fixture.warning?.startsWith("FICTIONAL LOCAL FIXTURE"))
  throw Error("fixture.json is not a labelled fictional fixture.");
const fixtureSeams = fixture.seams;
const ORIGIN = fixture.origin;
const OUT = resolve(arg("out", here));
const EXECUTABLE =
  arg("chromium") ??
  "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const PAGE = "/_emdash/admin/plugins/composer-stacks/overview";
const ACCOUNT = fixtureSeams.wrangler.vars.RESOURCE_ACCOUNT_ID;
const WORKFLOWS = "fixture-workflow-0001";
const NOTIFICATIONS = "fixture-notification-0001";
const MALFORMED = "fixture-platform-malformed";
const receipt = {
  schema: "composer.admin-journey-acceptance/1",
  observedAt: new Date().toISOString(),
  warning:
    "Locally simulated fixture. EmDash native passkey auth and a fictional local D1. Not production, not Cloudflare Access, not the owner's data.",
  origin: ORIGIN,
  sourceRevision: fixture.sourceRevision,
  sourceDirty: fixture.sourceDirty,
  renderedEntry: fixture.renderedEntry,
  fixtureSeams,
  fixture: {
    workspaceId: null,
    account: ACCOUNT,
    environments: ["production", "preview"],
    apps: ["guestbook"],
    records:
      "2 real-shaped workflow failures, 2 held notifications, 1 deliberately malformed platform request inserted and then repaired, 1 synthetic run that must stay excluded. Every value is invented for this run.",
  },
  browser: "Chromium 1248 (Playwright headless shell), deviceScaleFactor 1",
  pages: {},
  measurements: {},
  checks: {},
  captures: [],
  pageErrors: [],
  problems: [],
};
const problems = receipt.problems;
function ensure(condition, message) {
  if (!condition) problems.push(message);
  return condition;
}
const capture = async (page, name) => {
  const path = join(OUT, name);
  await page.screenshot({ path });
  receipt.captures.push({
    file: name,
    bytes: statSync(path).size,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  });
};
const sleep = (ms) => new Promise((yes) => setTimeout(yes, ms));
function withDatabase(read) {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const database = new DatabaseSync(fixture.database);
      try {
        return read(database);
      } finally {
        database.close();
      }
    } catch (error) {
      if (!/busy|locked/i.test(String(error))) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
  throw Error("The local fixture database stayed locked.");
}

const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });
function track(page, label) {
  page.on("pageerror", (error) =>
    receipt.pageErrors.push(label + ": " + error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      receipt.pageErrors.push(label + " console: " + message.text());
  });
}
async function authenticate(page) {
  const call = (path, body) =>
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
        const text = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {}
        return { status: response.status, body: parsed, text };
      },
      { path, body },
    );
  const data = (reply) => {
    if (reply.status < 200 || reply.status >= 300 || reply.body?.success === false)
      throw Error(
        "Native endpoint refused: " + reply.status + " " + reply.text.slice(0, 200),
      );
    return reply.body?.data ?? reply.body;
  };
  const credential = (options, create) =>
    page.evaluate(
      async ({ options, create }) => {
        const publicKey = create
          ? PublicKeyCredential.parseCreationOptionsFromJSON(options)
          : PublicKeyCredential.parseRequestOptionsFromJSON(options);
        const result = await navigator.credentials[create ? "create" : "get"]({
          publicKey,
        });
        return result.toJSON();
      },
      { options, create },
    );
  await page.goto(ORIGIN + "/_emdash/api/auth/mode", {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  const setupReply = await call("/_emdash/api/setup", {
    title: "Fictional admin journey",
    tagline: "Local fixture only",
    includeContent: false,
  });
  if (setupReply.body?.error?.code === "ALREADY_CONFIGURED")
    throw Error(
      "The fixture database is not fresh. Re-run prepare-fixture.mjs before capture.mjs.",
    );
  const setup = data(setupReply);
  if (setup.setupComplete)
    throw Error(
      "The fixture database is not fresh. Re-run prepare-fixture.mjs before capture.mjs.",
    );
  const admin = data(
    await call("/_emdash/api/setup/admin", {
      email: "fixture@example.test",
      name: "Fictional owner",
    }),
  );
  data(
    await call("/_emdash/api/setup/admin/verify", {
      credential: await credential(admin.options, true),
    }),
  );
  return data(await call("/_emdash/api/auth/me"));
}

// ---- Authentication, fictional rows, first render ---------------------------
const identity = await (async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  track(page, "setup");
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
  const me = await authenticate(page);
  const workspaceReply = await page.evaluate(async () => {
    const response = await fetch(
      "/_emdash/api/plugins/composer-stacks/overviewRead?action=list",
      {
        cache: "no-store",
        headers: { "X-EmDash-Request": "1" },
      },
    );
    return { status: response.status, body: await response.json() };
  });
  const overview = workspaceReply.body?.data ?? workspaceReply.body;
  if (!overview?.workspace)
    throw Error(
      "The overview did not confirm a workspace: " +
        workspaceReply.status +
        " " +
        JSON.stringify(workspaceReply.body).slice(0, 400),
    );
  const workspace = overview.workspace;
  const state = await context.storageState();
  await context.close();
  return { me, workspace, state };
})();
receipt.fixture.workspaceId = identity.workspace.id;
receipt.checks.authentication = {
  realEndpoint: "/_emdash/api/auth/passkey + /_emdash/api/setup",
  emDashUser: identity.me.id,
  role: identity.me.role,
  productionAccess: false,
  virtualAuthenticator: true,
};
ensure(identity.me.role === 50, "the fixture actor must be an administrator");

const fixtureConfig = {
  title: "Fixture Trail Notes",
  intro: "Fictional local fixture only.",
  theme: "midnight",
  layout: "grid",
  guestAccess: "closed",
};
const fixtureValues = effectiveGuestbookConfiguration(fixtureConfig);
const fixtureDigest = await configurationDigest(fixtureValues);
const installedSource = appSettings.guestbook.source.commit;
withDatabase((database) => {
  for (const table of [
    "creator_stack_resource_bindings",
    "creator_resource_operations",
    "creator_enquiry_notification_outbox",
    "creator_workflow_runs",
    "creator_platform_requests",
    "creator_stacks",
    "creator_app_resources",
  ])
    database.exec(
      "DELETE FROM " + table + " WHERE " + (table === "creator_stacks" ? "id" : table === "creator_stack_resource_bindings" ? "stack_id" : table === "creator_resource_operations" ? "id" : table === "creator_app_resources" ? "id" : table === "creator_platform_requests" ? "id" : "id") + " LIKE 'fixture-%'",
    );
  const add = (sql, ...values) => database.prepare(sql).run(...values);
  const draft = {
    version: 1,
    name: "Fixture Trail Notes",
    description: "",
    theme: "midnight",
    instances: [
      {
        id: "fixture-instance-1",
        app: "guestbook",
        label: "Fixture Trail Notes",
        caption: "",
        visible: true,
        binding: { mode: "own", shareOf: null },
        config: fixtureConfig,
      },
    ],
  };
  const stack = (id, slug, name) => {
    add(
      "INSERT INTO creator_stacks(id,workspace_id,slug,name,status,revision,draft_json,created_at,updated_at) VALUES(?,?,?,?,'draft',1,?,'2026-10-23 01:00:00','2026-10-23 01:00:00')",
      id,
      identity.workspace.id,
      slug,
      name,
      JSON.stringify(draft),
    );
    add(
      "INSERT INTO creator_stack_resource_bindings(stack_id,instance_id,resource_id,mode) VALUES(?,?,?,'own')",
      id,
      "fixture-instance-1",
      "fixture-resource-" + (id.includes("production") ? "production" : "preview"),
    );
  };
  const resource = (environment, source) => {
    const id = "fixture-resource-" + environment;
    add(
      "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,version,state,configuration_revision,configuration_digest,configuration_source,configuration_json,created_at) VALUES(?,?,'guestbook',?,?,?,1,'ready',1,?,?,?,'2026-10-23 01:00:00')",
      id,
      identity.workspace.id,
      ACCOUNT,
      environment,
      "https://composer.loftwah.com/guestbook",
      fixtureDigest,
      source,
      JSON.stringify(fixtureValues),
    );
    add(
      "INSERT INTO creator_resource_operations(id,resource_id,stack_id,instance_id,action,state,source_revision,request_json,created_at) VALUES(?,?,?,?, 'activate','confirmed',?, '{}','2026-10-24 02:00:00')",
      "fixture-operation-" + environment,
      id,
      "fixture-stack-" + environment,
      "fixture-instance-1",
      source,
    );
  };
  // Production records genuine source drift against the installed app source;
  // preview is in step, so the environment selector can be exercised without
  // inventing another problem.
  resource("production", "b".repeat(40));
  resource("preview", installedSource);
  stack("fixture-stack-production", "fixture-trail-notes-production", "Fixture Trail Notes");
  stack("fixture-stack-preview", "fixture-trail-notes-preview", "Fixture Trail Notes (preview)");
  for (const [id, event, revision, synthetic, updated] of [
    [WORKFLOWS, "fixture-event-a", 1, 0, "2026-10-25 06:00:00"],
    ["fixture-workflow-0002", "fixture-event-b", 2, 0, "2026-10-25 05:00:00"],
    ["fixture-workflow-synthetic", "fixture-event-c", 3, 1, "2026-10-25 07:00:00"],
  ])
    add(
      "INSERT INTO creator_workflow_runs(id,workspace_id,recipe,event_id,source_id,source_revision,account_id,environment,recipe_revision,synthetic,state,revision,attempts,steps_json,message,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      identity.workspace.id,
      "operation-attention",
      event,
      "fixture-source-0001",
      revision,
      ACCOUNT,
      "production",
      1,
      synthetic,
      "needs-attention",
      1,
      3,
      '["observed","source-checked"]',
      "Fictional local fixture run.",
      "2026-10-24 03:00:00",
      updated,
    );
  for (const [id, event, state, created, updated] of [
    [NOTIFICATIONS, "fixture-notify-a", "failed", "2026-10-23 02:00:00", "2026-10-24 05:00:00"],
    ["fixture-notification-0002", "fixture-notify-b", "uncertain", "2026-10-23 03:00:00", "2026-10-24 04:00:00"],
  ])
    add(
      "INSERT INTO creator_enquiry_notification_outbox(id,workspace_id,resource_id,event_id,account_id,environment,target,owner_id,state,attempts,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      identity.workspace.id,
      "fixture-resource-production",
      event,
      ACCOUNT,
      "production",
      "https://composer.loftwah.com/guestbook",
      identity.me.id,
      state,
      2,
      "Fictional local fixture reason.",
      created,
      updated,
    );
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  reducedMotion: "reduce",
  storageState: identity.state,
});
const page = await context.newPage();
track(page, "overview");
await page.goto(ORIGIN + PAGE, {
  waitUntil: "networkidle",
  timeout: 180000,
});
await page.evaluate(() => document.fonts.ready);
await page.waitForSelector(".co-next h2", { timeout: 120000 });

const leaderTitle = () => page.locator(".co-next h2").innerText();
// EmDash's shell shows a first-run "Welcome" modal after setup. It belongs to
// the host, not this plugin, and must be dismissed before pointer interaction.
async function dismissShellOverlay() {
  const portal = page.locator("[data-base-ui-portal]").first();
  if (!(await portal.count())) return "";
  const label = (await portal.innerText().catch(() => ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  await page.keyboard.press("Escape");
  if (await portal.isVisible().catch(() => false)) {
    const close = portal
      .locator("button")
      .filter({ hasText: /got started|close|dismiss|done/i })
      .first();
    if (await close.count()) await close.click({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
  return label;
}
receipt.checks.shellOverlay = await dismissShellOverlay();
const notice = () => page.locator(".co-notice").innerText().catch(() => "");
const alertText = () => page.locator(".co-error").innerText().catch(() => "");
async function openCoverage() {
  const details = page.locator("details.co-coverage");
  if (!(await details.evaluate((node) => node.open)))
    await details.locator("summary").click();
}
async function recheck(label) {
  await openCoverage();
  const button = page
    .locator(".co-sources button")
    .filter({ hasText: new RegExp("^(Recheck|Retry) " + label) });
  await button.first().click();
}

receipt.pages.firstRender = await page.evaluate(() => ({
  heading: document.querySelector(".co-next h2")?.textContent.trim(),
  scope: [...document.querySelectorAll(".co-scope-field")].map((field) =>
    field.textContent.replace(/\s+/g, " ").trim(),
  ),
  account: document.querySelector(".co-scope-account code")?.textContent,
  coverage: document.querySelector(".co-coverage summary")?.textContent
    .replace(/\s+/g, " ")
    .trim(),
}));
ensure(
  (await leaderTitle()) === "A workflow needs attention",
  "the most recent retained failure must lead before an app is chosen",
);
ensure(
  /All recorded apps/.test(receipt.pages.firstRender.scope.join(" ")),
  "the scope bar must show the unfiltered app selection",
);
ensure(
  receipt.pages.firstRender.account === ACCOUNT,
  "the scope bar must show the server-owned account",
);
ensure(
  !(await page.locator(".co-list").innerText()).includes("Sample"),
  "synthetic runs must never appear in the attention queue",
);

// ---- Drill-down from the lead problem -------------------------------------
const drillHref = await page.locator("a.co-primary").getAttribute("href");
const drillUrl = new URL(drillHref ?? "", ORIGIN);
receipt.checks.drilldown = {
  href: drillHref,
  path: drillUrl.pathname,
  workspace: drillUrl.searchParams.get("workspace"),
  environment: drillUrl.searchParams.get("environment"),
  hash: drillUrl.hash,
};
ensure(
  drillUrl.pathname === "/_emdash/admin/plugins/composer-stacks/workflows" &&
    drillUrl.hash.startsWith("#workflow-run-") &&
    drillUrl.searchParams.get("environment") === "production",
  "the drill-down must carry the exact scope and record anchor",
);
await page.locator("a.co-primary").click();
await page.waitForURL(/\/workflows/);
await page.waitForSelector("h1", { timeout: 60000 });
await page.waitForTimeout(6000);
const anchored = await page.evaluate((hash) => {
  const node = document.querySelector(hash);
  return {
    heading: document.querySelector("h1")?.textContent?.trim() ?? "",
    exact: !!node,
    anchors: document.querySelectorAll('[id^="workflow-run-"]').length,
    text: (node?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    body: document.body.innerText.replace(/\s+/g, " ").slice(0, 300),
  };
}, drillUrl.hash);
receipt.checks.anchoredRecord = anchored;
ensure(
  /workflows/i.test(anchored.heading),
  "the drill-down must open the Workflows screen",
);
// The owning screen renders asynchronously from its own scoped read. Record
// whether the exact anchor or any retained run appeared; the README states the
// observed result instead of pretending the fixture proved it.
receipt.checks.anchoredRecordProven = anchored.exact || anchored.anchors > 0;
await capture(page, "drilldown-workflows-1440-dark.png");
await page.goBack();
await page.waitForSelector(".co-next h2");
await dismissShellOverlay();
ensure(
  (await leaderTitle()) === "A workflow needs attention",
  "Back must restore the same overview result",
);

// ---- App focus and reload persistence -------------------------------------
await page.selectOption("#co-scope-app", "guestbook");
await page.waitForFunction(
  () =>
    new URL(location.href).searchParams.get("app") === "guestbook" &&
    document.querySelector(".co-next h2")?.textContent?.includes("notifications"),
  undefined,
  { timeout: 60000 },
);
ensure(
  (await leaderTitle()) === "A visitor book’s notifications need attention",
  "choosing the recorded app must put its problem first",
);
ensure(
  new URL(page.url()).searchParams.get("app") === "guestbook",
  "the app focus must be written to the URL",
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".co-next h2");
await dismissShellOverlay();
ensure(
  (await page.inputValue("#co-scope-app")) === "guestbook" &&
    (await leaderTitle()) === "A visitor book’s notifications need attention",
  "a reload must keep the confirmed app scope",
);

// ---- Environment scope ----------------------------------------------------
await page.selectOption("#co-scope-environment", "preview");
await page.waitForFunction(
  () => new URL(location.href).searchParams.get("environment") === "preview",
  undefined,
  { timeout: 60000 },
);
const preview = {
  url: page.url(),
  heading: await leaderTitle(),
  environment: await page.inputValue("#co-scope-environment"),
};
receipt.checks.previewScope = preview;
ensure(
  new URL(page.url()).searchParams.get("environment") === "preview" &&
    !new URL(page.url()).searchParams.has("app"),
  "changing environment must write the URL and drop the now-ambiguous app focus",
);
ensure(
  preview.environment === "preview",
  "the environment control must show the confirmed preview scope",
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(
  () =>
    new URL(location.href).searchParams.get("environment") === "preview" &&
    document.querySelector("#co-scope-environment")?.value === "preview",
  undefined,
  { timeout: 60000 },
);
ensure(
  (await page.inputValue("#co-scope-environment")) === "preview",
  "a reload must keep the confirmed environment scope",
);
await page.selectOption("#co-scope-environment", "production");
await page.waitForFunction(
  () => new URL(location.href).searchParams.get("environment") === "production",
  undefined,
  { timeout: 60000 },
);
await page.waitForSelector(".co-next h2");

// ---- One supported action: recheck a source -------------------------------
const before = await page.locator(".co-coverage summary").innerText();
await recheck("Workflows");
await page.waitForSelector(".co-notice");
const success = await notice();
receipt.checks.recheckSuccess = {
  notice: success,
  coverageBefore: before.replace(/\s+/g, " ").trim(),
};
ensure(
  /Workflows rechecked\. 2 retained problem records/.test(success),
  "the recheck must report the real grouped record count",
);
ensure((await alertText()) === "", "a successful recheck must not raise an alert");
ensure(
  (await page.locator(".co-sources").innerText()).includes("2 retained"),
  "the coverage list must show the re-read count",
);
await capture(page, "recheck-success-1440-dark.png");

// ---- Deliberate failure, then recovery ------------------------------------
withDatabase((database) => {
  database
    .prepare(
      "INSERT INTO creator_platform_requests(id,workspace_id,actor_id,submission_key,revision,request_json,plan_json,plan_digest,policy_revision,decision_json,status,reason,created_at,updated_at) VALUES(?,?,?,?,1,'{}','broken JSON','fixture-digest',1,'{}','needs-attention','Fictional local fixture reason.','2026-10-25 08:00:00','2026-10-25 08:00:00')",
    )
    .run(MALFORMED, identity.workspace.id, identity.me.id, MALFORMED);
});
const itemsBeforeFailure = await page.locator(".co-next h2").innerText();
await recheck("Internal platform");
await page.waitForSelector(".co-error");
const failure = await alertText();
receipt.checks.recheckFailure = {
  alert: failure,
  previousResultStillShown: await page.locator(".co-next h2").innerText(),
};
ensure(
  /Internal platform recheck failed/.test(failure) &&
    /still shown and was not replaced/.test(failure),
  "a failed recheck must be an explicit failure next to the control",
);
ensure(
  (await page.locator(".co-notice").count()) === 0,
  "a failed recheck must not leave a success notice",
);
ensure(
  (await page.locator(".co-next h2").innerText()) === itemsBeforeFailure,
  "a failed recheck must not erase the previous result",
);
await capture(page, "recheck-failure-1440-dark.png");

withDatabase((database) => {
  database
    .prepare("UPDATE creator_platform_requests SET plan_json=? WHERE id=?")
    .run(
      JSON.stringify({
        target: { account: ACCOUNT, environment: "production" },
      }),
      MALFORMED,
    );
});
await page.locator(".co-error button").click();
await page.waitForSelector(".co-notice");
const recovered = {
  notice: await notice(),
  heading: await leaderTitle(),
  coverage: await page.locator(".co-coverage summary").innerText(),
};
receipt.checks.recheckRecovery = recovered;
ensure(
  recovered.heading === "A platform request needs attention",
  "the repaired read must surface the actual retained platform request",
);
ensure(
  /4 of 4 sources read/.test(recovered.coverage.replace(/\s+/g, " ")),
  "recovery must restore full source coverage",
);
ensure((await alertText()) === "", "recovery must clear the failure alert");

// ---- Keyboard-only operation ---------------------------------------------
async function tabTo(predicate, limit = 250) {
  for (let index = 0; index < limit; index++) {
    await page.keyboard.press("Tab");
    const state = await page.evaluate(() => ({
      id: document.activeElement?.id ?? "",
      className: document.activeElement?.className ?? "",
      tag: document.activeElement?.tagName ?? "",
      text: (document.activeElement?.textContent ?? "").trim().slice(0, 60),
    }));
    if (predicate(state)) return state;
  }
  return null;
}
await page.goto(ORIGIN + PAGE + "?" + new URLSearchParams({
  workspace: identity.workspace.id,
  environment: "production",
}), { waitUntil: "networkidle" });
await page.waitForSelector(".co-next h2");
await page.evaluate(() => document.body.focus());
const scopeFocus = await tabTo((state) => state.id === "co-scope-environment");
ensure(!!scopeFocus, "the environment control must be reachable with Tab");
const beforeKey = await page.evaluate(() => ({
  active: document.activeElement?.id,
  options: [...(document.querySelector("#co-scope-environment")?.options ?? [])].map(
    (option) => option.value,
  ),
  url: location.href,
}));
receipt.checks.keyboardSelect = beforeKey;
// Tab reaches the select and its recorded options are real. macOS headless
// Chromium does not commit a closed native select with arrow keys, so the
// environment change itself is driven through the select API below and that
// limit is stated in the evidence README.
ensure(
  beforeKey.active === "co-scope-environment" && beforeKey.options?.includes("preview"),
  "Tab must reach the environment select with its recorded options",
);
await page.goto(ORIGIN + PAGE + "?" + new URLSearchParams({
  workspace: identity.workspace.id,
  environment: "production",
}), { waitUntil: "networkidle" });
await page.waitForSelector(".co-next h2");
await page.evaluate(() => document.body.focus());
const primaryFocus = await tabTo((state) =>
  /co-primary/.test(state.className),
);
ensure(!!primaryFocus, "the one primary action must be reachable with Tab");
receipt.checks.focus = await page.evaluate(() => {
  const node = document.activeElement;
  const style = getComputedStyle(node);
  return {
    tag: node?.tagName,
    text: (node?.textContent ?? "").trim(),
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
    outlineColor: style.outlineColor,
  };
});
ensure(
  receipt.checks.focus.outlineStyle !== "none" &&
    parseFloat(receipt.checks.focus.outlineWidth) >= 2,
  "keyboard focus must draw a visible outline on the primary action",
);
await capture(page, "keyboard-focus-1440-dark.png");
const enterHref = new URL(
  (await page.locator("a.co-primary").getAttribute("href")) ?? "",
  ORIGIN,
);
await page.keyboard.press("Enter");
await page.waitForURL((url) => url.pathname === enterHref.pathname, {
  timeout: 20000,
});
ensure(
  page.url() === enterHref.href,
  "Enter on the primary action must follow the same scoped drill-down",
);
const enterAnchor = await page.evaluate(
  (hash) => !!document.querySelector(hash),
  enterHref.hash,
);
receipt.checks.keyboardAnchor = enterAnchor;
await page.goBack();
await page.waitForSelector(".co-next h2");
await page.locator("details.co-coverage").evaluate((node) => (node.open = false));
await page.locator(".co-coverage summary").focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
ensure(
  await page.locator("details.co-coverage").evaluate((node) => node.open),
  "Enter must open the coverage disclosure",
);
await page.keyboard.press("Escape");
const escaped = await page.evaluate(() => ({
  open: document.querySelector("details.co-coverage")?.open,
  focus:
    document.activeElement === document.querySelector("details.co-coverage summary"),
}));
ensure(!escaped.open, "Escape must close the coverage disclosure");
ensure(escaped.focus, "Escape must return focus to the coverage summary");

// ---- Measurements and captures, both widths, both themes ------------------
async function measure(label) {
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const controls = [
      ...document.querySelectorAll(
        ".co-overview button, .co-overview a, .co-overview select, .co-overview summary",
      ),
    ]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 48),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        };
      });
    return {
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      bodyOverflow:
        document.body.scrollWidth - document.body.clientWidth,
      controls,
      smallestHeight: controls.length
        ? Math.min(...controls.map((control) => control.height))
        : null,
      pageHeight: document.documentElement.scrollHeight,
    };
  });
  receipt.measurements[label] = {
    ...metrics,
    undersized: metrics.controls.filter((control) => control.height < 44),
  };
  ensure(
    metrics.documentOverflow <= 0 && metrics.bodyOverflow <= 0,
    label + " must not overflow horizontally",
  );
  ensure(
    !receipt.measurements[label].undersized.length,
    label + " must keep every control at least 44px tall",
  );
  return metrics;
}
for (const [width, height] of [[1440, 1000], [390, 844]]) {
  await page.setViewportSize({ width, height });
  for (const mode of ["dark", "light"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.mode = value;
    }, mode);
    await page.waitForTimeout(150);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ensure(
      Boolean(background),
      width + " " + mode + " must resolve a themed background",
    );
    await measure(width + "-" + mode);
    await capture(page, `overview-${width}-${mode}.png`);
  }
}
// The two keyboard states also need a phone-width capture.
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => {
  document.documentElement.dataset.mode = "dark";
});
await page.locator(".co-coverage summary").focus();
await page.keyboard.press("Enter");
await capture(page, "coverage-390-dark.png");

receipt.checks.theme = await page.evaluate(() => ({
  theme: document.documentElement.dataset.theme,
  mode: document.documentElement.dataset.mode,
  background: getComputedStyle(document.body).backgroundColor,
  foreground: getComputedStyle(document.body).color,
}));

await context.close();
await browser.close();
writeFileSync(join(OUT, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      problems,
      captures: receipt.captures.length,
      measurements: Object.fromEntries(
        Object.entries(receipt.measurements).map(([key, value]) => [
          key,
          {
            documentOverflow: value.documentOverflow,
            smallestHeight: value.smallestHeight,
            undersized: value.undersized.length,
          },
        ]),
      ),
      pageErrors: receipt.pageErrors,
    },
    null,
    2,
  ),
);
if (problems.length || receipt.pageErrors.length) process.exit(1);

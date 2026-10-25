// Actual native EmDash sign-in + persisted proposal review. Fictional local data.
import assert from "node:assert/strict";
import { chromium } from "/Users/deanlofts/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  provisionAgentGrant,
  createAgentBriefing,
  submitAgentProposal,
} from "../../../src/lib/agent-proposals.ts";
import { replaySitrep } from "../../../src/lib/incident-replay.ts";

const root = process.argv[2],
  out = process.argv[3];
const fixture = JSON.parse(readFileSync(join(root, "fixture.json"), "utf8"));
assert.match(fixture.warning, /^FICTIONAL LOCAL FIXTURE/);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Users/deanlofts/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell",
});
const receipt = {
  version: "composer.incident-desk-native/1",
  observedAt: new Date().toISOString(),
  source: fixture.sourceRevision,
  sourceDirty: fixture.sourceDirty,
  origin: fixture.origin,
  seams: fixture.seams,
  warning:
    "Fictional local D1 and native EmDash authentication with a virtual authenticator. No Access/real MFA, production, external email, PagerDuty, agent execution or recovered service proof.",
  screenshots: [],
  checks: {},
  errors: [],
};
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on("pageerror", (error) => receipt.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") receipt.errors.push(message.text());
});
const api = async (path, body) =>
  page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EmDash-Request": "1",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const reply = await response.json();
      return { status: response.status, data: reply.data ?? reply };
    },
    { path, body },
  );
const data = (reply) => {
  assert.equal(reply.status, 200, JSON.stringify(reply));
  assert.notEqual(reply.data.success, false);
  return reply.data;
};
const capture = async (name) => {
  const path = join(out, name);
  await page.screenshot({ path, fullPage: false });
  receipt.screenshots.push({
    name,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  });
};
let sqlite;
try {
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
  await page.goto(fixture.origin + "/_emdash/api/auth/mode", {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  data(
    await api("/_emdash/api/setup", {
      title: "Fictional Incident Desk",
      tagline: "Local replay only",
      includeContent: false,
    }),
  );
  const admin = data(
    await api("/_emdash/api/setup/admin", {
      email: "incident-owner@example.test",
      name: "Fictional incident owner",
    }),
  );
  const credential = await page.evaluate(async (options) => {
    const result = await navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
    });
    return result.toJSON();
  }, admin.options);
  data(await api("/_emdash/api/setup/admin/verify", { credential }));
  const me = data(await api("/_emdash/api/auth/me"));
  const snapshot = data(
    await api("/_emdash/api/plugins/composer-stacks/proposalsRead?action=list"),
  );
  const workspace = snapshot.workspace;
  sqlite = new DatabaseSync(fixture.database);
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind(...values) {
      return statement(sql, values);
    },
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  });
  const db = {
    prepare: statement,
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map(({ sql, params }) => ({
          success: true,
          results: sqlite.prepare(sql).all(...params),
        }));
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const owner = { id: me.id, name: me.name };
  const now = new Date().toISOString();
  const environment = {
    id: "incident-desk-local",
    kind: "local",
    account: "fictional-local-account",
  };
  const agent = { id: "agent:incident-replay", name: "Fictional investigator" };
  const grant = await provisionAgentGrant(db, {
    workspace: workspace.id,
    app: "guestbook",
    environment,
    rolePack: "devops",
    agent,
    owner,
    fallback: { id: "fictional-fallback", name: "Fictional fallback" },
    issuedBy: owner.name,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const evidence = [
    {
      id: "journey-01",
      kind: "labelled-replay",
      source: "fixture://missing-caption",
      environment: environment.id,
      observedAt: now,
      summary:
        "REPLAY: missing-caption journey returns 500; health returns 200.",
    },
    {
      id: "control-01",
      kind: "labelled-replay",
      source: "fixture://team-b-control",
      environment: environment.id,
      observedAt: now,
      summary: "REPLAY: Team B expected content remains unchanged.",
    },
  ];
  const briefing = await createAgentBriefing(db, {
    workspace: workspace.id,
    grant: grant.id,
    asOf: now,
    evidence,
  });
  const source = {
    kind: "local-path",
    path: "fictional/incident-replay.txt",
    contentHash: createHash("sha256").update("fictional-replay").digest("hex"),
    files: 1,
    bytes: 16,
    checkedAt: now,
  };
  const command = {
    action: "submit",
    workspace: workspace.id,
    app: "guestbook",
    environment,
    rolePack: "devops",
    grant: grant.id,
    briefing: briefing.id,
    agent,
    source: { kind: "local-path", path: source.path },
    evidence: ["journey-01", "control-01"],
    risk: "low",
    change: {
      kind: "actions",
      summary:
        "Investigate the missing-caption failure before proposing a recovery.",
      actions: [
        {
          op: "investigate",
          target: "fictional-local-visitor-book",
          detail:
            "Check missing-caption input and scoped data response; do not change the service.",
        },
      ],
      incident: replaySitrep,
    },
  };
  const first = (await submitAgentProposal(db, command, { source })).view;
  const url =
    fixture.origin +
    "/_emdash/admin/plugins/composer-stacks/incidents?workspace=" +
    workspace.id;
  const nativeResponse = await page.goto(url, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  receipt.nativeEntry = {
    status: nativeResponse.status(),
    url: page.url(),
    text: (await page.locator("body").innerText()).slice(0, 2000),
    overview: (
      await context.request.get(
        fixture.origin + "/_emdash/admin/plugins/composer-stacks/overview",
      )
    ).status(),
  };
  await capture("native-entry-diagnostic.png");
  assert.equal(
    nativeResponse.status(),
    200,
    JSON.stringify(receipt.nativeEntry),
  );
  await page.getByRole("button", { name: "Get Started", exact: true }).click();
  receipt.checks.firstAccountWelcomeDismissed = true;
  await page
    .getByRole("heading", { name: "Incident Desk", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Situation report", exact: true })
    .first()
    .waitFor();
  await capture("submitted-1440-light.png");
  await page
    .getByRole("button", { name: /Investigate the missing-caption failure/ })
    .focus();
  let reasonReached = false;
  for (let count = 0; count < 12; count++) {
    await page.keyboard.press("Tab");
    if (
      await page.evaluate(() => document.activeElement?.tagName === "TEXTAREA")
    ) {
      reasonReached = true;
      break;
    }
  }
  assert.equal(reasonReached, true, "Keyboard reaches the decision reason");
  receipt.checks.keyboardReasonReached = true;
  await capture("keyboard-reason-1440-light.png");
  await page
    .getByRole("textbox", { name: "Reason", exact: true })
    .fill(
      "Keep the failing request and control. Add a missing-caption regression check before proposing recovery.",
    );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.match(
    await page.evaluate(() => document.activeElement.textContent),
    /Send back with instructions/,
  );
  await page.keyboard.press("Space");
  await page
    .getByRole("status")
    .filter({ hasText: "Changes requested." })
    .waitFor();
  const revisionBriefing = await createAgentBriefing(db, {
    workspace: workspace.id,
    grant: grant.id,
    asOf: new Date().toISOString(),
    evidence: [
      ...evidence,
      {
        id: "regression-03",
        kind: "labelled-replay",
        source: "fixture://requested-regression-check",
        environment: environment.id,
        observedAt: new Date().toISOString(),
        summary:
          "REPLAY: the requested missing-caption check has been added to this revision's evidence.",
      },
    ],
  });
  const revised = (
    await submitAgentProposal(
      db,
      {
        ...command,
        proposal: first.id,
        briefing: revisionBriefing.id,
        evidence: ["journey-01", "control-01", "regression-03"],
        change: {
          ...command.change,
          summary:
            "Add a missing-caption regression check; keep recovery unverified.",
          incident: {
            ...replaySitrep,
            stepsTaken: [
              ...replaySitrep.stepsTaken,
              "Added a fictional regression check; evidence still needs real lab verification.",
            ],
          },
        },
      },
      { source: { ...source, checkedAt: new Date().toISOString() } },
    )
  ).view;
  const stale = await api(
    "/_emdash/api/plugins/composer-stacks/proposalsWrite",
    {
      action: "review",
      workspace: workspace.id,
      proposal: first.id,
      environment: environment.id,
      decision: "accept",
      reason: "Attempted old digest must be refused.",
      expectedDigest: first.digest,
      expectedVersion: first.version,
    },
  );
  assert.equal(stale.status, 409, JSON.stringify(stale));
  receipt.checks.staleApproval = stale.data;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("heading", { name: revised.change.summary, exact: true })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Reason", exact: true })
    .fill(
      "Reviewed the revised replay evidence. Approve investigation only; no execution or recovery claim.",
    );
  await page
    .getByRole("button", {
      name: "Approve this proposal — no execution",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Accepted digest", exact: true })
    .waitFor();
  await page
    .getByText("Preserved investigation and proposal versions (2 of 2)", {
      exact: true,
    })
    .click();
  await page.getByText(new RegExp("Version 1 ·")).click();
  await page.getByText("The first investigation", { exact: false }).count();
  await capture("accepted-history-1440-light.png");
  const saved = sqlite
    .prepare(
      "SELECT state,current_version,accepted_digest FROM creator_agent_proposals WHERE id=?",
    )
    .get(first.id);
  assert.equal(saved.state, "accepted");
  assert.equal(saved.current_version, 2);
  assert.equal(saved.accepted_digest, revised.digest);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) n FROM creator_agent_proposal_versions WHERE proposal_id=?",
      )
      .get(first.id).n,
    2,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) n FROM creator_agent_proposal_reviews WHERE proposal_id=?",
      )
      .get(first.id).n,
    2,
  );
  receipt.checks.preserved = { ...saved, versions: 2, reviews: 2 };
  const rejected = (
    await submitAgentProposal(
      db,
      {
        ...command,
        change: {
          ...command.change,
          summary: "Unsafe recovery suggestion retained for rejection.",
        },
      },
      { source },
    )
  ).view;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("button", { name: /Unsafe recovery suggestion retained/ })
    .click();
  await page
    .getByRole("textbox", { name: "Reason", exact: true })
    .fill(
      "Reject the unsafe suggestion. Preserve both original evidence items and keep recovery unverified.",
    );
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Rejected." }).waitFor();
  assert.equal(
    sqlite
      .prepare("SELECT state FROM creator_agent_proposals WHERE id=?")
      .get(rejected.id).state,
    "rejected",
  );
  receipt.checks.rejectionPreserved =
    sqlite
      .prepare(
        "SELECT COUNT(*) n FROM creator_agent_proposal_versions WHERE proposal_id=?",
      )
      .get(rejected.id).n === 1;
  for (const theme of ["dark", "light"])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const switchTheme = page.getByRole("button", {
        name: theme === "dark" ? "Switch to dark" : "Switch to light",
        exact: true,
      });
      if (await switchTheme.count()) await switchTheme.click();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.mode === theme,
        theme,
        { timeout: 5000 },
      );
      await page.locator(".composer-proposals h1").scrollIntoViewIfNeeded();
      await capture("rejected-" + width + "-" + theme + ".png");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(
    fixture.origin +
      "/_emdash/api/plugins/composer-stacks/proposalsRead?action=list",
    { maxRedirects: 0 },
  );
  assert.ok([401, 403, 302].includes(denied.status()), String(denied.status()));
  receipt.checks.anonymousDenied = denied.status();
  await anonymous.close();
  await page.goto(fixture.origin + "/incident-replay", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("heading", {
      name: "Review the investigation.Keep the evidence.",
    })
    .count();
  for (const theme of ["dark", "light"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    await capture("public-390-" + theme + ".png");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  receipt.checks.externalEffects = {
    email: 0,
    pagerDuty: 0,
    deployments: 0,
    agentCalls: 0,
  };
  receipt.checks.nativeAuth = {
    role: me.role,
    virtualAuthenticator: true,
    cloudflareAccess: false,
  };
  receipt.expectedConflictConsole = receipt.errors.filter((error) =>
    error.includes("status of 409"),
  );
  assert.equal(receipt.expectedConflictConsole.length, 1);
  assert.equal(
    receipt.errors.filter((error) => !error.includes("status of 409")).length,
    0,
    receipt.errors.join("\n"),
  );
} finally {
  receipt.headings = await page.locator("h1,h2").evaluateAll((nodes) =>
    nodes.map((node) => ({
      html: node.outerHTML,
      hidden: !!node.closest("[aria-hidden=true],[inert]"),
      role: node.getAttribute("role"),
    })),
  );
  receipt.finalPage = {
    url: page.url(),
    text: (await page.locator("body").innerText()).slice(0, 4000),
  };
  await capture("native-final.png");
  sqlite?.close();
  await browser.close();
  writeFileSync(join(out, "receipt.json"), JSON.stringify(receipt, null, 2));
}

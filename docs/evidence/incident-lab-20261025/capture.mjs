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
import { incidentSitrep } from "../../../src/lib/incident-contract.ts";

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
  version: "composer.incident-isolated-lab/1",
  observedAt: new Date().toISOString(),
  source: fixture.sourceRevision,
  sourceDirty: fixture.sourceDirty,
  origin: fixture.origin,
  seams: fixture.seams,
  warning:
    "Fictional local D1 and native EmDash authentication with a virtual authenticator. Actual injected localhost fault only. No Access/real MFA, production, external email, PagerDuty or agent execution. Recovery is manual lab configuration restoration, not autonomous execution.",
  screenshots: [],
  checks: {},
  errors: [],
};
receipt.runtimeSourceHashes = {};
for (const file of [
  "src/lib/agent-proposals.ts",
  "src/lib/agent-proposal-contract.ts",
  "src/lib/incident-contract.ts",
  "src/plugins/proposals-page.tsx",
  "src/plugins/proposals-page.css",
  "src/lib/creator-plugin.ts",
  "src/plugins/stacks-admin.tsx",
]) {
  receipt.runtimeSourceHashes[file] = {
    original: createHash("sha256")
      .update(readFileSync(new URL("../../../" + file, import.meta.url)))
      .digest("hex"),
    executedFixture: createHash("sha256")
      .update(readFileSync(join(fixture.app, file)))
      .digest("hex"),
  };
}
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
const capture = async (name, target = page) => {
  const path = join(out, name);
  await target.screenshot({ path, fullPage: false });
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
      tagline: "Owned localhost fault drill",
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
  const agent = { id: "agent:incident-lab", name: "Local drill investigator" };
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
  // The canary exists only inside this owned fixture. Real local workerd requests
  // exercise its nullable-caption defect; no status is substituted by the harness.
  assert.ok(fixture.database.startsWith(root + "/app/.wrangler/"));
  sqlite.exec(
    "CREATE TABLE incident_lab_canary(team TEXT PRIMARY KEY,caption TEXT,revision INTEGER NOT NULL)",
  );
  const originalCaption = "Fictional Team A canary is available.";
  const controlCaption = "Fictional Team B control stays unchanged.";
  const insert = sqlite.prepare(
    "INSERT INTO incident_lab_canary VALUES(?,?,1)",
  );
  insert.run("fictional-team-a", originalCaption);
  insert.run("fictional-team-b", controlCaption);
  const routePath = "src/pages/incident-lab-canary/[...path].ts";
  const routeBytes = readFileSync(join(fixture.app, routePath));
  const source = {
    kind: "local-path",
    path: routePath,
    contentHash: createHash("sha256").update(routeBytes).digest("hex"),
    files: 1,
    bytes: routeBytes.length,
    checkedAt: now,
  };
  receipt.target = {
    runtime: "Astro Cloudflare adapter / local workerd / local D1",
    sourcePath: routePath,
    sourceSha256: source.contentHash,
    databaseScope: "incident_lab_canary / fictional-team-a",
    controlScope: "incident_lab_canary / fictional-team-b",
    proposalApp: "guestbook",
    actualGuestbookIncident: false,
    explanation:
      "The existing proposal app discriminator is guestbook; the fault target is only the temporary canary, never Guestbook production or provider infrastructure.",
  };
  const sample = async (stage, path) => {
    const url = fixture.origin + "/incident-lab-canary/" + path;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    const body = await response.text();
    const observation = {
      stage,
      path,
      url,
      status: response.status,
      observedAt: new Date().toISOString(),
      bodySha256: createHash("sha256").update(body).digest("hex"),
      bytes: Buffer.byteLength(body),
      ...(response.ok
        ? { body: body.slice(0, 700) }
        : {
            error: /trim/.test(body)
              ? "Nullable caption trim failure"
              : "HTTP " + response.status + " response",
          }),
    };
    (receipt.http ??= []).push(observation);
    return observation;
  };
  const baseline = await sample("baseline", "page");
  assert.equal(baseline.status, 200);
  const canaryPage = await context.newPage();
  assert.equal(
    (
      await canaryPage.goto(fixture.origin + "/incident-lab-canary/page")
    ).status(),
    200,
  );
  await capture("canary-before-1440.png", canaryPage);
  const controlBefore = await sample("baseline", "control");
  assert.equal(controlBefore.status, 200);
  const inject = sqlite
    .prepare(
      "UPDATE incident_lab_canary SET caption=NULL,revision=revision+1 WHERE team=? AND caption=? AND revision=1",
    )
    .run("fictional-team-a", originalCaption);
  assert.equal(Number(inject.changes), 1);
  receipt.faultInjection = {
    at: new Date().toISOString(),
    actor: "authorized local drill harness",
    kind: "temporary local D1 configuration caption set to NULL",
    beforeRevision: 1,
    afterRevision: 2,
  };
  const failure = await sample("fault", "page");
  assert.equal(failure.status, 500);
  assert.equal((await canaryPage.reload()).status(), 500);
  await capture("canary-failure-1440.png", canaryPage);
  assert.equal((await sample("fault-repeat", "page")).status, 500);
  const health = await sample("fault", "health");
  assert.equal(health.status, 200);
  const scopedData = await sample("fault", "data");
  assert.equal(scopedData.status, 200);
  assert.equal(JSON.parse(scopedData.body).caption, null);
  const controlDuring = await sample("fault", "control");
  assert.equal(controlDuring.bodySha256, controlBefore.bodySha256);
  const evidence = [failure, health, scopedData, controlDuring].map(
    (observation, index) => ({
      id: ["failure-01", "health-02", "data-03", "control-04"][index],
      kind: "actual-local-http",
      source: observation.url,
      environment: environment.id,
      observedAt: observation.observedAt,
      summary: `Actual localhost ${observation.status}; response SHA256 ${observation.bodySha256}. ${observation.path === "data" ? "Scoped D1 read succeeded and caption is null." : observation.path === "control" ? "Unrelated Team B control matches its baseline." : "Recorded in the owned isolated lab."}`,
    }),
  );
  const sitrep = incidentSitrep.parse({
    version: "composer.incident-sitrep/1",
    id: "isolated-caption-fault-0001",
    mode: "isolated-lab",
    service: "Owned localhost caption canary",
    owner: owner.name,
    impact:
      "The temporary Team A canary page returns actual HTTP 500 after an authorized local configuration fault; production is unaffected.",
    firstSeen: failure.observedAt,
    lastSeen: controlDuring.observedAt,
    observations: evidence.map((item) => ({
      text: item.summary,
      evidence: item.id,
    })),
    hypotheses: [
      {
        explanation:
          "The optional caption is null but the canary source calls trim without validation.",
        confidence: "supported",
        nextCheck:
          "Compare the exact retained canary source and D1 row; restore only the prior local caption after owner review.",
      },
      {
        explanation: "The data store is unavailable.",
        confidence: "disproved",
        nextCheck:
          "Keep the successful scoped data read; shallow health alone cannot establish the affected journey.",
      },
    ],
    stepsTaken: [
      "Injected one documented NULL caption in the owned local D1 canary.",
      "Observed repeated HTTP 500, successful scoped data/health reads and unchanged control.",
    ],
    unknowns: [
      "Recovery is not yet verified.",
      "No production/provider outage or notification delivery is exercised; the author of this controlled fault is also the investigator.",
    ],
    nextUpdate:
      "After owner review, manual configuration restoration and repeated HTTP recovery checks.",
    recovery: "unverified",
    notification: "not-sent",
  });
  const briefing = await createAgentBriefing(db, {
    workspace: workspace.id,
    grant: grant.id,
    asOf: new Date().toISOString(),
    evidence,
  });
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
    evidence: evidence.map((item) => item.id),
    risk: "low",
    change: {
      kind: "actions",
      summary:
        "Investigate the actual localhost caption failure before manual recovery.",
      actions: [
        {
          op: "investigate",
          target: fixture.origin + "/incident-lab-canary/page",
          detail:
            "Check missing-caption input and scoped data response; do not change the service.",
        },
      ],
      incident: sitrep,
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
    .getByRole("button", {
      name: /Investigate the actual localhost caption failure/,
    })
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
      "Keep the failing request and control. Compare the retained source and exact prior caption before proposing a guarded manual restoration.",
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
        id: "source-05",
        kind: "actual-local-source",
        source: "owned-local-source://canary-route",
        environment: environment.id,
        observedAt: new Date().toISOString(),
        summary:
          "Retained canary source SHA256 " +
          source.contentHash +
          "; nullable caption is passed directly to trim. Exact pre-fault caption and guarded restoration scope are recorded.",
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
        evidence: [...evidence.map((item) => item.id), "source-05"],
        change: {
          ...command.change,
          summary:
            "Restore the prior caption manually after reviewing the actual local evidence.",
          actions: [
            {
              op: "configure",
              target: fixture.origin + "/incident-lab-canary/page",
              detail:
                "Operator restores fictional-team-a caption to the recorded baseline only while revision=2 and caption IS NULL; verify three page responses and the unrelated control. No execution adapter.",
            },
          ],
          incident: {
            ...sitrep,
            stepsTaken: [
              ...sitrep.stepsTaken,
              "Compared actual NULL D1 row with retained canary source; proposed guarded manual restoration of the exact prior caption.",
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
      "Reviewed actual localhost failure, source and unchanged control. Approve only the documented manual lab configuration restore; execution adapter remains unconnected and recovery unverified.",
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
  // Approval above records a decision only. This explicit local operator action
  // performs the exact guarded restoration; no proposal execution adapter runs.
  assert.equal(
    (await sample("accepted-before-manual-recovery", "page")).status,
    500,
  );
  const restore = sqlite
    .prepare(
      "UPDATE incident_lab_canary SET caption=?,revision=revision+1 WHERE team=? AND caption IS NULL AND revision=2",
    )
    .run(originalCaption, "fictional-team-a");
  assert.equal(Number(restore.changes), 1);
  receipt.manualRecovery = {
    actor: "authorized local drill harness acting as operator",
    at: new Date().toISOString(),
    acceptedDigest: revised.digest,
    beforeRevision: 2,
    afterRevision: 3,
    executionAdapter: "unconnected",
    sourceChanged: false,
  };
  const recovered = [];
  for (let index = 0; index < 3; index++) {
    const check = await sample("recovered-" + (index + 1), "page");
    assert.equal(check.status, 200);
    assert.equal(check.bodySha256, baseline.bodySha256);
    recovered.push(check);
    if (index < 2) await new Promise((yes) => setTimeout(yes, 300));
  }
  const controlAfter = await sample("recovered", "control");
  assert.equal(controlAfter.bodySha256, controlBefore.bodySha256);
  assert.equal((await canaryPage.reload()).status(), 200);
  await capture("canary-restored-1440.png", canaryPage);
  await canaryPage.close();
  assert.equal(
    createHash("sha256")
      .update(readFileSync(join(fixture.app, routePath)))
      .digest("hex"),
    source.contentHash,
  );
  const recoveryEvidence = recovered.map((item, index) => ({
    id: "recovery-0" + (index + 1),
    kind: "actual-local-http",
    source: item.url,
    environment: environment.id,
    observedAt: item.observedAt,
    summary:
      "Actual HTTP 200 after manual restoration; body matches baseline SHA256 " +
      item.bodySha256,
  }));
  const finalEvidence = [...evidence, ...recoveryEvidence];
  const finalBriefing = await createAgentBriefing(db, {
    workspace: workspace.id,
    grant: grant.id,
    asOf: new Date().toISOString(),
    evidence: finalEvidence,
  });
  const finalSitrep = incidentSitrep.parse({
    ...sitrep,
    lastSeen: controlAfter.observedAt,
    observations: [
      ...sitrep.observations,
      ...recoveryEvidence.map((item) => ({
        text: item.summary,
        evidence: item.id,
      })),
    ],
    stepsTaken: [
      ...sitrep.stepsTaken,
      "Owner sent the original investigation back, reviewed revision 2 and approved the exact manual lab restoration.",
      "Operator manually restored the prior caption with a D1 revision guard; three real page responses matched the baseline and Team B stayed unchanged.",
    ],
    hypotheses: [
      {
        ...sitrep.hypotheses[0],
        nextCheck:
          "Add null-safe validation before treating the defect as fixed; restoration mitigates this known configuration only.",
      },
      sitrep.hypotheses[1],
    ],
    unknowns: [
      "The nullable-caption source defect remains; only the prior local configuration was restored.",
      "No autonomous investigation independence, execution adapter, production recovery or provider notification is established.",
    ],
    nextUpdate:
      "Before any code repair or provider exercise; this controlled local configuration drill is complete.",
    recovery: "verified-in-isolated-lab",
  });
  const closure = (
    await submitAgentProposal(
      db,
      {
        ...command,
        briefing: finalBriefing.id,
        evidence: finalEvidence.map((item) => item.id),
        change: {
          ...command.change,
          summary:
            "Record verified local recovery after manual caption restoration.",
          actions: [
            {
              op: "verify",
              target: fixture.origin + "/incident-lab-canary/page",
              detail:
                "Record the three observed HTTP 200 results and unchanged control after explicit manual configuration restoration; no additional action requested.",
            },
          ],
          incident: finalSitrep,
        },
      },
      { source: { ...source, checkedAt: new Date().toISOString() } },
    )
  ).view;
  // Vite broadcasts this intentional request exception to open dev tabs.
  // Verify its cause, then reload the actual native route after recovery. The
  // development overlay does not reliably dismiss within the native app shell.
  const overlay = page.locator("vite-error-overlay");
  if (await overlay.count()) {
    const text = await overlay.evaluate(
      (node) => node.shadowRoot?.textContent ?? "",
    );
    assert.match(text, /trim/);
    assert.match(text, /incident-lab-canary/);
    await page.goto(url, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Incident Desk", exact: true })
      .waitFor();
    assert.equal(await page.locator("vite-error-overlay").count(), 0);
    receipt.checks.expectedCanaryDevOverlay = {
      cause: "controlled nullable-caption exception",
      recoveredBy: "reload real native route after manual recovery",
    };
  }
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("button", { name: /Record verified local recovery/ })
    .click();
  await page
    .getByRole("textbox", { name: "Reason", exact: true })
    .fill(
      "Accept the separate recovery evidence record: three actual localhost responses match baseline, control unchanged, source defect remains. No execution or provider claim.",
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
  receipt.checks.recoveryRecord = {
    proposal: closure.id,
    digest: closure.digest,
    mode: "isolated-lab",
    recovery: finalSitrep.recovery,
    recoverySamples: 3,
    controlUnchanged: true,
    sourceUnchanged: true,
  };
  receipt.persisted = {
    proposals: sqlite
      .prepare(
        "SELECT id,state,current_version,accepted_digest FROM creator_agent_proposals ORDER BY submitted_at,id",
      )
      .all(),
    versions: sqlite
      .prepare(
        "SELECT proposal_id,version,digest,source_json,evidence_json,change_json FROM creator_agent_proposal_versions ORDER BY proposal_id,version",
      )
      .all(),
    reviews: sqlite
      .prepare(
        "SELECT proposal_id,version,decision,reason FROM creator_agent_proposal_reviews ORDER BY created_at,rowid",
      )
      .all(),
    canary: sqlite
      .prepare("SELECT * FROM incident_lab_canary ORDER BY team")
      .all(),
  };
  assert.equal(receipt.persisted.proposals.length, 2);
  assert.equal(receipt.persisted.versions.length, 3);
  assert.equal(receipt.persisted.reviews.length, 3);
  for (const row of receipt.persisted.proposals)
    assert.equal(row.state, "accepted");
  for (const row of receipt.persisted.versions) {
    const report = JSON.parse(row.change_json).incident;
    assert.equal(report.mode, "isolated-lab");
    assert.equal(
      report.recovery,
      row.proposal_id === closure.id
        ? "verified-in-isolated-lab"
        : "unverified",
    );
  }
  for (const theme of ["light", "dark"]) {
    const button = page.getByRole("button", {
      name: theme === "dark" ? "Switch to dark" : "Switch to light",
      exact: true,
    });
    if (await button.count()) await button.click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.locator(".composer-proposals h1").scrollIntoViewIfNeeded();
      await capture("recovered-" + width + "-" + theme + ".png");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
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
  receipt.success = true;
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

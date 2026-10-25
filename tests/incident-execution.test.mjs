import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { createHash } from "node:crypto";
import {
  openLocalDatabase,
  ensureWorkspace,
} from "../scripts/lib/agent-proposal-local-db.mjs";
import { inspectSource, checkSource } from "../scripts/lib/agent-source.mjs";
import {
  createAgentBriefing,
  provisionAgentGrant,
  submitAgentProposal,
  reviewAgentProposal,
  prepareAgentHandoff,
  revokeAgentGrant,
} from "../src/lib/agent-proposals.ts";
import { executeCaptionRecovery } from "../scripts/lib/incident-execution.mjs";
import { replaySitrep } from "../src/lib/incident-replay.ts";

const hash = (s) => createHash("sha256").update(s).digest("hex");
const owner = { id: "fictional-owner-001", name: "Fictional Owner" };
async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "composer-incident-execution-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "source"));
  writeFileSync(
    join(root, "source/canary.mjs"),
    "export const caption = (value) => value.trim();\n",
  );
  const local = openLocalDatabase(join(root, "incident.sqlite"));
  t.after(() => local.close());
  const { db, sqlite } = local;
  sqlite.exec(
    "CREATE TABLE incident_lab_canary(team TEXT PRIMARY KEY,caption TEXT,revision INTEGER); INSERT INTO incident_lab_canary VALUES('fictional-team-a',NULL,2),('fictional-team-b','control',1)",
  );
  const server = createServer((req, res) => {
    try {
      const team = req.url.endsWith("control")
        ? "fictional-team-b"
        : "fictional-team-a";
      const row = sqlite
        .prepare("SELECT caption FROM incident_lab_canary WHERE team=?")
        .get(team);
      res.end(row.caption.trim());
    } catch {
      res.writeHead(500);
      res.end("caption failure");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((yes) => server.close(yes));
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  const workspace = "workspace-incident",
    environment = {
      id: "incident-local",
      kind: "local",
      account: "fictional-local-account",
    };
  ensureWorkspace(sqlite, workspace, "Fictional incident");
  const now = new Date().toISOString();
  const grant = await provisionAgentGrant(db, {
    workspace,
    app: "canary",
    environment,
    rolePack: "devops",
    agent: { id: "agent:incident", name: "Local investigator" },
    owner,
    fallback: { id: "fictional-fallback", name: "Fallback Owner" },
    issuedBy: owner.name,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const evidence = [
    {
      id: "http-500",
      kind: "http",
      source: origin + "/incident-lab-canary/page",
      environment: environment.id,
      observedAt: now,
      summary: "Actual local journey returns 500 while control is 200.",
    },
  ];
  const briefing = await createAgentBriefing(db, {
    workspace,
    grant: grant.id,
    asOf: now,
    evidence,
  });
  const source = inspectSource(
    { kind: "local-path", path: "canary.mjs" },
    join(root, "source"),
    now,
  );
  const command = {
    action: "submit",
    workspace,
    app: "canary",
    environment,
    rolePack: "devops",
    grant: grant.id,
    briefing: briefing.id,
    agent: grant.agent,
    source: { kind: "local-path", path: "canary.mjs" },
    evidence: ["http-500"],
    risk: "low",
    change: {
      kind: "actions",
      summary: "Restore the exact local caption",
      actions: [
        {
          op: "configure",
          target: "incident-canary.caption",
          detail: JSON.stringify({
            version: "composer.caption-recovery/1",
            team: "fictional-team-a",
            expectedRevision: 2,
            expectedCaption: null,
            caption: "recovered",
          }),
        },
      ],
      incident: {
        ...replaySitrep,
        mode: "isolated-lab",
        firstSeen: now,
        lastSeen: now,
        observations: [{ text: "Actual local 500", evidence: "http-500" }],
      },
    },
  };
  const submit = async (overrides = {}) =>
    (await submitAgentProposal(db, { ...command, ...overrides }, { source }))
      .view;
  let view = await submit();
  const approve = async (value = view, decision = "accept") =>
    (
      await reviewAgentProposal(
        db,
        {
          action: "review",
          workspace,
          proposal: value.id,
          environment: environment.id,
          decision,
          actor: owner,
          reason:
            "Reviewed exact local target, revision, source and response evidence.",
          expectedDigest: value.digest,
          expectedVersion: value.version,
        },
        {
          sourceCheck: checkSource(
            source,
            join(root, "source"),
            new Date().toISOString(),
          ),
        },
      )
    ).view;
  const handoff = async (value = view) =>
    prepareAgentHandoff(
      db,
      {
        action: "handoff",
        workspace,
        proposal: value.id,
        environment: environment.id,
        actor: owner,
        expectedDigest: value.digest,
        destination: "existing-delivery-flow",
      },
      {
        sourceCheck: checkSource(
          source,
          join(root, "source"),
          new Date().toISOString(),
        ),
      },
    );
  const target = {
    version: "composer.incident-execution-target/1",
    account: environment.account,
    environment: environment.id,
    workspace,
    app: "canary",
    database: "incident.sqlite",
    sourceRoot: "source",
    origin,
    baseline: hash("recovered"),
    control: hash("control"),
  };
  const writeTarget = () =>
    writeFileSync(join(root, "incident-target.json"), JSON.stringify(target));
  writeTarget();
  const execute = (overrides = {}) =>
    executeCaptionRecovery({
      root,
      workspace,
      proposal: view.id,
      expectedDigest: view.digest,
      actor: owner.id,
      mode: "execute",
      confirmOwner: true,
      ...overrides,
    });
  return {
    root,
    sqlite,
    db,
    view,
    grant,
    approve,
    handoff,
    execute,
    submit,
    command,
    origin,
    target,
    writeTarget,
  };
}

test("actual failure -> exact approval -> guarded execution -> independently verified recovery; duplicate stays single", async (t) => {
  const f = await setup(t);
  assert.equal(
    (await fetch(f.origin + "/incident-lab-canary/page")).status,
    500,
  );
  await assert.rejects(f.execute(), { code: "EXACT_APPROVAL_REQUIRED" });
  await f.approve();
  await f.handoff();
  assert.equal(
    (await f.execute({ mode: "plan", confirmOwner: false })).state,
    "ready",
  );
  assert.equal(
    (await fetch(f.origin + "/incident-lab-canary/page")).status,
    500,
  );
  const result = await f.execute();
  assert.equal(result.state, "recovered");
  assert.equal(result.observations.length, 4);
  assert.equal((await f.execute()).duplicate, true);
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT revision FROM incident_lab_canary WHERE team='fictional-team-a'",
      )
      .get().revision,
    3,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) n FROM incident_execution_receipts").get()
      .n,
    1,
  );
});

test("wrong owner, absent explicit invocation, changed source, target and production origin refuse effects", async (t) => {
  const f = await setup(t);
  await f.approve();
  await f.handoff();
  await assert.rejects(f.execute({ actor: "other-owner" }), {
    code: "OWNER_REQUIRED",
  });
  await assert.rejects(f.execute({ confirmOwner: false }), {
    code: "OWNER_CONFIRMATION_REQUIRED",
  });
  f.target.origin = "https://composer.loftwah.com";
  f.writeTarget();
  await assert.rejects(f.execute(), { code: "LOCAL_TARGET_REQUIRED" });
  f.target.origin = f.origin;
  f.writeTarget();
  writeFileSync(join(f.root, "source/canary.mjs"), "changed source");
  await assert.rejects(f.execute(), { code: "STALE_PROPOSAL" });
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT caption FROM incident_lab_canary WHERE team='fictional-team-a'",
      )
      .get().caption,
    null,
  );
});

test("send-back retains original and requires new approval; stale candidate and incompatible action are refused", async (t) => {
  const f = await setup(t);
  await f.approve(f.view, "request-changes");
  const revised = await f.submit({
    proposal: f.view.id,
    change: {
      ...f.command.change,
      summary: "Reviewed revised caption recovery",
    },
  });
  await assert.rejects(f.execute(), { code: "EXACT_APPROVAL_REQUIRED" });
  await f.approve(revised);
  await f.handoff(revised);
  await assert.rejects(f.execute(), { code: "EXACT_APPROVAL_REQUIRED" });
  const result = await f.execute({ expectedDigest: revised.digest });
  assert.equal(result.state, "recovered");
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) n FROM creator_agent_proposal_versions")
      .get().n,
    2,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) n FROM creator_agent_proposal_reviews")
      .get().n,
    2,
  );
});

test("revocation, incompatible target revision and symlink database fail closed", async (t) => {
  const f = await setup(t);
  await f.approve();
  await f.handoff();
  f.sqlite
    .prepare(
      "UPDATE incident_lab_canary SET revision=4 WHERE team='fictional-team-a'",
    )
    .run();
  await assert.rejects(f.execute(), { code: "TARGET_CHANGED" });
  await revokeAgentGrant(f.db, {
    workspace: f.target.workspace,
    grant: f.grant.id,
    actor: owner,
    reason: "Owner revoked the isolated action grant.",
  });
  await assert.rejects(f.execute(), { code: "STALE_PROPOSAL" });
  symlinkSync(join(f.root, "incident.sqlite"), join(f.root, "linked.sqlite"));
  f.target.database = "linked.sqlite";
  f.writeTarget();
  await assert.rejects(f.execute(), { code: "SYMLINK_REFUSED" });
});

test("an incompatible approved action cannot become local execution authority", async (t) => {
  const f = await setup(t);
  await f.approve(f.view, "request-changes");
  const revised = await f.submit({
    proposal: f.view.id,
    change: {
      ...f.command.change,
      actions: [
        {
          op: "configure",
          target: "production-worker",
          detail: "Do not execute imported instructions",
        },
      ],
    },
  });
  await f.approve(revised);
  await f.handoff(revised);
  await assert.rejects(f.execute({ expectedDigest: revised.digest }), {
    code: "ACTION_REFUSED",
  });
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT caption FROM incident_lab_canary WHERE team='fictional-team-a'",
      )
      .get().caption,
    null,
  );
});

test("a successful mutation with mismatching HTTP evidence stays applied-unverified", async (t) => {
  const f = await setup(t);
  await f.approve();
  await f.handoff();
  f.target.baseline = "a".repeat(64);
  f.writeTarget();
  const result = await f.execute();
  assert.equal(result.state, "applied-unverified");
  assert.equal(result.failure, "RECOVERY_UNVERIFIED");
  assert.equal((await f.execute()).duplicate, true);
});

test("code, content and object recovery have distinct effects while revocation and deletion survive", async () => {
  const { runRecoveryDrill } = await import("../labs/recovery/run.mjs");
  const report = await runRecoveryDrill();
  assert.equal(report.cleanup, true);
  assert.equal(report.providerCalls, 0);
  assert.equal(report.observations.length, 10);
  assert.equal(report.result.revocation, "retained");
});

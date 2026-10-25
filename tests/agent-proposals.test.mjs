import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import {
  createAgentBriefing,
  manageAgentProposals,
  prepareAgentHandoff,
  provisionAgentGrant,
  reviewAgentProposal,
  revokeAgentGrant,
  showAgentProposal,
  submitAgentProposal,
  verifyAgentProposal,
} from "../src/lib/agent-proposals.ts";
import { inspectSource, checkSource } from "../scripts/lib/agent-source.mjs";

const NOW = "2026-10-25T01:00:00Z";
const LATER = "2026-10-25T01:30:00Z";
const OWNER = { id: "fictional-owner-0001", name: "Ada Nguyen" };
const FALLBACK = { id: "fictional-owner-0002", name: "Sam Okafor" };
const AGENT = { id: "agent:opencode/lane-b", name: "OpenCode Lane B" };
const ENVIRONMENT = {
  id: "env-preview-qa",
  kind: "preview",
  account: "fiction-composer-preview",
};
const evidence = [
  {
    id: "ev-01",
    kind: "reproduction",
    source: "fictional-browser://postcard-approve-empty",
    environment: ENVIRONMENT.id,
    observedAt: "2026-10-25T00:00:00Z",
    summary:
      "Approving a postcard whose text becomes empty after trimming returns 500 and leaves the record pending.",
  },
  {
    id: "ev-02",
    kind: "test",
    source: "local://node --test tests/postcards.test.mjs",
    environment: ENVIRONMENT.id,
    observedAt: "2026-10-25T00:10:00Z",
    summary:
      "The maintained postcard tests pass for the current Preview source; the empty-after-trim case is not covered.",
  },
];
const change = {
  kind: "diff",
  summary:
    "Return a 422 validation response instead of 500 when postcard text is empty after trimming.",
  patch:
    '--- a/src/postcards/approve.ts\n+++ b/src/postcards/approve.ts\n@@\n-  if (!postcard.body) {\n+  if (!postcard.body.trim()) {\n+    return json({ error: "Postcard text cannot be empty." }, { status: 422 });\n   }\n',
};
const source = {
  kind: "local-path",
  path: "examples/fictional-postcard/source.md",
  contentHash: "a".repeat(64),
  files: 1,
  bytes: 120,
  checkedAt: NOW,
};

async function prepared(t) {
  const f = fixture();
  t.after(() => f.close());
  f.sqlite.exec(
    readFileSync(
      new URL("../migrations/0016_agent_proposals.sql", import.meta.url),
      "utf8",
    ),
  );
  const workspace = await workspaceForUser(f.db, user);
  const grant = await provisionAgentGrant(
    f.db,
    {
      workspace: workspace.id,
      app: "trail-notes",
      environment: ENVIRONMENT,
      rolePack: "programmer",
      agent: AGENT,
      owner: OWNER,
      fallback: FALLBACK,
      issuedBy: OWNER.name,
      expiresAt: "2026-10-27T00:00:00Z",
    },
    { now: NOW },
  );
  const briefing = await createAgentBriefing(
    f.db,
    {
      workspace: workspace.id,
      grant: grant.id,
      asOf: NOW,
      evidence,
    },
    { now: NOW },
  );
  const submit = async (patch = {}, at = NOW) => {
    const { sourceValue, ...overrides } = patch;
    const command = {
      action: "submit",
      workspace: workspace.id,
      app: "trail-notes",
      environment: ENVIRONMENT,
      rolePack: "programmer",
      grant: grant.id,
      briefing: briefing.id,
      agent: AGENT,
      source: { kind: "local-path", path: source.path },
      evidence: ["ev-01", "ev-02"],
      risk: "medium",
      change,
      ...overrides,
    };
    return submitAgentProposal(f.db, command, {
      now: at,
      source: sourceValue ?? { ...source, checkedAt: at },
    });
  };
  const review = (view, decision = "accept", patch = {}) => {
    const { at, sourceCheck, actorKind, ...overrides } = patch;
    return reviewAgentProposal(
      f.db,
      {
        action: "review",
        workspace: workspace.id,
        proposal: view.id,
        environment: view.environment.id,
        decision,
        actor: OWNER,
        reason:
          "Reviewed the exact digest, the cited isolated Preview evidence and the proposed regression test.",
        expectedDigest: view.digest,
        expectedVersion: view.version,
        ...overrides,
      },
      {
        now: at ?? NOW,
        sourceCheck: sourceCheck ?? {
          state: "current",
          detail: "The submitted file matches its content hash.",
          currentHash: view.source.contentHash,
          checkedAt: NOW,
        },
        actorKind,
      },
    );
  };
  return { ...f, workspace, grant, briefing, submit, review };
}

const currentSource = (view) => ({
  state: "current",
  detail: "The submitted file matches its content hash.",
  currentHash: view.source.contentHash,
  checkedAt: NOW,
});

const code = (pattern) => (error) => {
  assert.equal(error.code, pattern, error.message);
  return true;
};

test("briefing is deterministic and carries the role inputs, evidence, output, stops and prohibitions", async (t) => {
  const f = await prepared(t);
  const again = await createAgentBriefing(
    f.db,
    { workspace: f.workspace.id, grant: f.grant.id, asOf: NOW, evidence },
    { now: NOW },
  );
  assert.equal(again.id, f.briefing.id);
  assert.equal(again.digest, f.briefing.digest);
  assert.equal(again.created, false);
  assert.equal(again.content.rolePack.id, "programmer");
  assert.equal(again.content.inputs.length, 6);
  assert.ok(again.content.requiredEvidence.length >= 5);
  assert.ok(again.content.outputSchema.rolePackFields.length >= 5);
  assert.ok(again.content.stopRules.length >= 6);
  assert.ok(again.content.prohibitedActions.length >= 6);
  assert.match(again.markdown, /## Inputs/);
  assert.match(again.markdown, /## Required evidence/);
  assert.match(again.markdown, /## Output schema/);
  assert.match(again.markdown, /## Stop and escalate/);
  assert.match(again.markdown, /## Prohibited/);
  assert.match(again.markdown, /read-only for the agent/);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_agent_briefings").get()
      .n,
    1,
  );
});

test("end-to-end local journey: v1, request changes, v2, accept, verify, separate handoff", async (t) => {
  const f = await prepared(t);
  const v1 = (await f.submit()).view;
  assert.equal(v1.state, "submitted");
  assert.equal(v1.version, 1);
  const firstDigest = v1.digest;

  const changed = await f.review(v1, "request-changes");
  assert.equal(changed.view.state, "changes-requested");
  assert.equal(changed.view.accepted, null);
  assert.equal(changed.view.reviews.length, 1);

  const v2 = (
    await f.submit(
      {
        proposal: v1.id,
        change: {
          ...change,
          summary:
            "Return 422 for empty-after-trim text and add the regression test requested by the owner.",
          patch:
            change.patch + "+test: approval rejects empty-after-trim text\n",
        },
      },
      LATER,
    )
  ).view;
  assert.equal(v2.id, v1.id);
  assert.equal(v2.version, 2);
  assert.notEqual(v2.digest, firstDigest);
  assert.equal(v2.state, "submitted");

  const accepted = await f.review(v2, "accept", {
    at: "2026-10-25T01:40:00Z",
  });
  assert.equal(accepted.view.state, "accepted");
  assert.equal(accepted.view.accepted.digest, v2.digest);
  assert.equal(accepted.view.accepted.version, 2);
  assert.equal(accepted.view.handoff, null);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_handoffs")
      .get().n,
    0,
  );

  const verified = await verifyAgentProposal(
    f.db,
    { workspace: f.workspace.id, proposal: v2.id },
    {
      now: "2026-10-25T01:45:00Z",
      sourceCheck: {
        state: "current",
        detail: "The submitted file matches its content hash.",
        currentHash: v2.source.contentHash,
        checkedAt: "2026-10-25T01:45:00Z",
      },
    },
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.acceptedDigest, v2.digest);
  assert.equal(verified.acceptedMatchesCurrent, true);
  assert.equal(verified.execution, "not-performed");

  const handoff = await prepareAgentHandoff(
    f.db,
    {
      action: "handoff",
      workspace: f.workspace.id,
      proposal: v2.id,
      environment: ENVIRONMENT.id,
      actor: OWNER,
      expectedDigest: v2.digest,
      destination: "existing-release-flow",
    },
    {
      now: "2026-10-25T01:50:00Z",
      sourceCheck: {
        state: "current",
        detail: "The submitted file matches its content hash.",
        currentHash: v2.source.contentHash,
        checkedAt: "2026-10-25T01:50:00Z",
      },
    },
  );
  assert.equal(handoff.artifact.execution, "not-performed");
  assert.equal(handoff.artifact.digest, v2.digest);
  assert.equal(handoff.artifact.state, "prepared");
  assert.match(
    handoff.artifact.requires.join(" "),
    /existing release authority/,
  );
  assert.equal(handoff.view.handoff.execution, "not-performed");
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_handoffs")
      .get().n,
    1,
  );
});

test("wrong workspace or environment is refused before any proposal row is written", async (t) => {
  const f = await prepared(t);
  await assert.rejects(
    () => f.submit({ workspace: "another-workspace" }),
    code("GRANT_NOT_FOUND"),
  );
  await assert.rejects(
    () =>
      f.submit({
        environment: { ...ENVIRONMENT, id: "env-preview-other" },
      }),
    code("SCOPE_MISMATCH"),
  );
  await assert.rejects(
    () =>
      createAgentBriefing(
        f.db,
        {
          workspace: f.workspace.id,
          grant: f.grant.id,
          asOf: NOW,
          evidence: [{ ...evidence[0], environment: "env-preview-other" }],
        },
        { now: NOW },
      ),
    code("WRONG_ENVIRONMENT"),
  );
  const v1 = (await f.submit()).view;
  await assert.rejects(
    () =>
      f.review(v1, "accept", {
        environment: "env-preview-other",
      }),
    code("SCOPE_MISMATCH"),
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_agent_proposals").get()
      .n,
    1,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_reviews")
      .get().n,
    0,
  );
});

test("revoked and expired grants cannot brief, submit or accept", async (t) => {
  const f = await prepared(t);
  const revoked = await provisionAgentGrant(
    f.db,
    {
      workspace: f.workspace.id,
      app: "trail-notes",
      environment: ENVIRONMENT,
      rolePack: "qa",
      agent: AGENT,
      owner: OWNER,
      fallback: FALLBACK,
      issuedBy: OWNER.name,
      expiresAt: "2026-10-27T00:00:00Z",
    },
    { now: NOW },
  );
  const revokedBriefing = await createAgentBriefing(
    f.db,
    { workspace: f.workspace.id, grant: revoked.id, asOf: NOW, evidence },
    { now: NOW },
  );
  await revokeAgentGrant(
    f.db,
    {
      workspace: f.workspace.id,
      grant: revoked.id,
      actor: OWNER,
      reason:
        "The owner withdrew this proposal scope after the source changed.",
    },
    { now: NOW },
  );
  await assert.rejects(
    () =>
      createAgentBriefing(
        f.db,
        { workspace: f.workspace.id, grant: revoked.id, asOf: NOW, evidence },
        { now: NOW },
      ),
    code("GRANT_REVOKED"),
  );
  await assert.rejects(
    () =>
      submitAgentProposal(
        f.db,
        {
          action: "submit",
          workspace: f.workspace.id,
          app: "trail-notes",
          environment: ENVIRONMENT,
          rolePack: "qa",
          grant: revoked.id,
          briefing: revokedBriefing.id,
          agent: AGENT,
          source: { kind: "local-path", path: source.path },
          evidence: ["ev-01", "ev-02"],
          risk: "low",
          change,
        },
        { now: NOW, source },
      ),
    code("GRANT_REVOKED"),
  );

  const expiring = await provisionAgentGrant(
    f.db,
    {
      workspace: f.workspace.id,
      app: "trail-notes",
      environment: ENVIRONMENT,
      rolePack: "qa",
      agent: AGENT,
      owner: OWNER,
      fallback: FALLBACK,
      issuedBy: OWNER.name,
      expiresAt: "2026-10-25T02:00:00Z",
    },
    { now: NOW },
  );
  const late = "2026-10-25T03:00:00Z";
  await assert.rejects(
    () =>
      createAgentBriefing(
        f.db,
        { workspace: f.workspace.id, grant: expiring.id, asOf: late, evidence },
        { now: late },
      ),
    code("GRANT_EXPIRED"),
  );
  const v1 = (await f.submit()).view;
  await assert.rejects(
    () => f.review(v1, "accept", { at: "2026-10-27T03:00:00Z" }),
    code("GRANT_EXPIRED"),
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_reviews")
      .get().n,
    0,
  );
});

test("a source that moved after submission is stale and cannot be accepted or verified", async (t) => {
  const f = await prepared(t);
  const root = mkdtempSync(join(tmpdir(), "composer-agent-source-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, "source.md");
  writeFileSync(path, "proposal source v1\n");
  const at = "2026-10-25T01:00:00Z";
  const inspected = inspectSource({ kind: "local-path", path }, root, at);
  const v1 = (
    await submitAgentProposal(
      f.db,
      {
        action: "submit",
        workspace: f.workspace.id,
        app: "trail-notes",
        environment: ENVIRONMENT,
        rolePack: "programmer",
        grant: f.grant.id,
        briefing: f.briefing.id,
        agent: AGENT,
        source: { kind: "local-path", path: inspected.path },
        evidence: ["ev-01", "ev-02"],
        risk: "medium",
        change,
      },
      { now: at, source: inspected },
    )
  ).view;
  writeFileSync(path, "proposal source moved after submission\n");
  const staleCheck = checkSource(inspected, root, LATER);
  assert.equal(staleCheck.state, "stale");
  await assert.rejects(
    () => f.review(v1, "accept", { sourceCheck: staleCheck }),
    code("SOURCE_STALE"),
  );
  const verified = await verifyAgentProposal(
    f.db,
    { workspace: f.workspace.id, proposal: v1.id },
    { now: LATER, sourceCheck: staleCheck },
  );
  assert.equal(verified.ok, false);
  assert.equal(verified.source.state, "stale");
  assert.equal(
    verified.checks.find((check) => check.id === "source-current").ok,
    false,
  );
});

test("duplicate submission with the same digest is idempotent and writes one proposal", async (t) => {
  const f = await prepared(t);
  const first = await f.submit();
  const second = await f.submit();
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(second.view.id, first.view.id);
  assert.equal(second.view.digest, first.view.digest);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_agent_proposals").get()
      .n,
    1,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_versions")
      .get().n,
    1,
  );
  const later = await f.submit({}, LATER);
  assert.equal(later.deduplicated, true);
  assert.equal(later.view.version, 1);
});

test("interrupted or partial submission is never treated as accepted", async (t) => {
  const f = await prepared(t);
  await assert.rejects(
    () =>
      submitAgentProposal(
        f.db,
        {
          action: "submit",
          workspace: f.workspace.id,
          app: "trail-notes",
          environment: ENVIRONMENT,
          rolePack: "programmer",
          grant: f.grant.id,
          briefing: f.briefing.id,
          agent: AGENT,
          source: { kind: "local-path", path: source.path },
          evidence: ["ev-01"],
          risk: "medium",
        },
        { now: NOW, source },
      ),
    code("INVALID"),
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_agent_proposals").get()
      .n,
    0,
  );

  const v1 = (await f.submit()).view;
  f.sqlite
    .prepare(
      "DELETE FROM creator_agent_proposal_versions WHERE proposal_id=? AND version=1",
    )
    .run(v1.id);
  await assert.rejects(() => f.review(v1, "accept"), code("INCOMPLETE"));
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_reviews")
      .get().n,
    0,
  );
  await assert.rejects(
    () =>
      showAgentProposal(f.db, {
        workspace: f.workspace.id,
        proposal: v1.id,
      }),
    code("CORRUPT_RECORD"),
  );
});

test("content mutated after review changes the digest and acceptance is refused", async (t) => {
  const f = await prepared(t);
  const v1 = (await f.submit()).view;
  const requested = await f.review(v1, "request-changes");
  assert.equal(requested.view.state, "changes-requested");
  const briefing = f.sqlite
    .prepare("SELECT content_json FROM creator_agent_briefings WHERE id=?")
    .get(f.briefing.id).content_json;
  f.sqlite
    .prepare("UPDATE creator_agent_briefings SET content_json=? WHERE id=?")
    .run(
      briefing.replace("isolated Preview", "mutated Preview"),
      f.briefing.id,
    );
  await assert.rejects(
    () =>
      verifyAgentProposal(
        f.db,
        { workspace: f.workspace.id, proposal: v1.id },
        { now: NOW, sourceCheck: currentSource(requested.view) },
      ),
    code("DIGEST_MISMATCH"),
  );
  f.sqlite
    .prepare("UPDATE creator_agent_briefings SET content_json=? WHERE id=?")
    .run(briefing, f.briefing.id);
  const original = f.sqlite
    .prepare(
      "SELECT change_json FROM creator_agent_proposal_versions WHERE proposal_id=? AND version=1",
    )
    .get(v1.id).change_json;
  f.sqlite
    .prepare(
      "UPDATE creator_agent_proposal_versions SET change_json=? WHERE proposal_id=? AND version=1",
    )
    .run(
      JSON.stringify({ ...change, patch: change.patch + "+tampered\n" }),
      v1.id,
    );
  await assert.rejects(
    () => f.review(requested.view, "accept"),
    code("DIGEST_MISMATCH"),
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT state FROM creator_agent_proposals WHERE id=?")
      .get(v1.id).state,
    "changes-requested",
  );
  f.sqlite
    .prepare(
      "UPDATE creator_agent_proposal_versions SET change_json=? WHERE proposal_id=? AND version=1",
    )
    .run(original, v1.id);
  await assert.rejects(
    () =>
      f.review(requested.view, "accept", {
        expectedDigest: "0".repeat(64),
      }),
    code("CONFLICT"),
  );
});

test("secret-like material is refused and never stored", async (t) => {
  const f = await prepared(t);
  const root = mkdtempSync(join(tmpdir(), "composer-agent-secret-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, ".env"), "CLOUDFLARE_API_TOKEN=fictional-value\n");
  assert.throws(
    () => inspectSource({ kind: "local-path", path: ".env" }, root, NOW),
    code("SECRET_FILENAME"),
  );
  const before = f.sqlite
    .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposals")
    .get().n;
  await assert.rejects(
    () =>
      f.submit({
        change: {
          ...change,
          patch:
            change.patch + "\n+CLOUDFLARE_API_TOKEN=super-secret-value-123\n",
        },
      }),
    code("SECRET_MATERIAL"),
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_agent_proposals").get()
      .n,
    before,
  );
  const dump = JSON.stringify(
    f.sqlite.prepare("SELECT * FROM creator_agent_proposal_versions").all(),
  );
  assert.ok(!dump.includes("super-secret-value-123"));
  await assert.rejects(
    () =>
      createAgentBriefing(
        f.db,
        {
          workspace: f.workspace.id,
          grant: f.grant.id,
          asOf: NOW,
          evidence: [
            {
              ...evidence[0],
              summary: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345",
            },
          ],
        },
        { now: NOW },
      ),
    code("SECRET_MATERIAL"),
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_agent_briefings").get()
      .n,
    1,
  );
});

test("the proposer and any agent identity cannot approve or prepare a handoff", async (t) => {
  const f = await prepared(t);
  const v1 = (await f.submit()).view;
  await assert.rejects(
    () =>
      f.review(v1, "accept", {
        actor: { id: AGENT.id, name: AGENT.name },
      }),
    code("SELF_APPROVAL"),
  );
  await assert.rejects(
    () =>
      f.review(v1, "accept", {
        actorKind: "agent",
      }),
    code("SELF_APPROVAL"),
  );
  await assert.rejects(
    () =>
      f.review(v1, "accept", {
        actor: FALLBACK,
        actorKind: "agent",
      }),
    code("SELF_APPROVAL"),
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT state FROM creator_agent_proposals WHERE id=?")
      .get(v1.id).state,
    "submitted",
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_reviews")
      .get().n,
    0,
  );
});

test("an accepted digest is invalidated by a revision and the old digest cannot be reused", async (t) => {
  const f = await prepared(t);
  const v1 = (await f.submit()).view;
  await f.review(v1, "request-changes");
  const v2 = (
    await f.submit(
      {
        proposal: v1.id,
        change: { ...change, summary: "A different reviewable change." },
      },
      LATER,
    )
  ).view;
  assert.equal(v2.version, 2);
  assert.equal(v2.accepted, null);
  await assert.rejects(
    () => f.review(v2, "accept", { expectedDigest: v1.digest }),
    code("CONFLICT"),
  );
  const accepted = await f.review(v2, "accept");
  assert.equal(accepted.view.accepted.digest, v2.digest);
  assert.notEqual(accepted.view.accepted.digest, v1.digest);
  await assert.rejects(
    () =>
      f.submit(
        {
          proposal: v1.id,
          change: { ...change, summary: "A third change after acceptance." },
        },
        "2026-10-25T02:00:00Z",
      ),
    code("TERMINAL"),
  );
});

test("evidence outside the briefing is refused", async (t) => {
  const f = await prepared(t);
  await assert.rejects(
    () => f.submit({ evidence: ["ev-01", "ev-99"] }),
    code("UNPERMITTED_EVIDENCE"),
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_agent_proposals").get()
      .n,
    0,
  );
});

test("production scope and missing accountability are refused at grant time", async (t) => {
  const f = await prepared(t);
  await assert.rejects(
    () =>
      provisionAgentGrant(
        f.db,
        {
          workspace: f.workspace.id,
          app: "trail-notes",
          environment: { ...ENVIRONMENT, kind: "production" },
          rolePack: "qa",
          agent: AGENT,
          owner: OWNER,
          fallback: FALLBACK,
          issuedBy: OWNER.name,
          expiresAt: "2026-10-27T00:00:00Z",
        },
        { now: NOW },
      ),
    (error) => {
      assert.equal(error.code, "INVALID");
      assert.match(error.message, /Production proposals are not supported/);
      return true;
    },
  );
  await assert.rejects(
    () =>
      provisionAgentGrant(
        f.db,
        {
          workspace: f.workspace.id,
          app: "trail-notes",
          environment: ENVIRONMENT,
          rolePack: "qa",
          agent: AGENT,
          owner: OWNER,
          fallback: OWNER,
          issuedBy: OWNER.name,
          expiresAt: "2026-10-27T00:00:00Z",
        },
        { now: NOW },
      ),
    code("INVALID"),
  );
});

test("native admin route scopes reads, refuses viewers and records one owner decision without execution", async (t) => {
  const f = await prepared(t);
  const v1 = (await f.submit()).view;
  f.sqlite
    .prepare(
      "UPDATE creator_agent_grants SET owner_id=?,owner_name=? WHERE id=?",
    )
    .run(user.id, user.name, f.grant.id);
  const read = (caller = user, workspace = f.workspace.id) =>
    manageAgentProposals(
      {
        user: caller,
        input: { action: "list", workspace },
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/proposalsRead?action=list&workspace=" +
            workspace,
          { method: "GET" },
        ),
      },
      f.runtime,
    );
  const snapshot = await read();
  assert.equal(snapshot.proposals.length, 1);
  assert.equal(snapshot.proposals[0].digest, v1.digest);
  assert.equal(snapshot.execution, "not-performed");
  await assert.rejects(
    () => read({ id: "fictional-outsider", role: 50, name: "Outsider" }),
    code("FORBIDDEN"),
  );
  const write = (payload, caller = user, headers = {}) =>
    manageAgentProposals(
      {
        user: caller,
        input: payload,
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/proposalsWrite",
          {
            method: "POST",
            headers: {
              Origin: origin,
              "X-EmDash-Request": "1",
              ...headers,
            },
          },
        ),
      },
      f.runtime,
    );
  const review = {
    action: "review",
    workspace: f.workspace.id,
    proposal: v1.id,
    environment: ENVIRONMENT.id,
    decision: "accept",
    reason:
      "The owner checked the exact digest, evidence and isolated Preview source.",
    expectedDigest: v1.digest,
    expectedVersion: 1,
  };
  await assert.rejects(
    () => write(review, user, { Origin: "https://example.test" }),
    code("FORBIDDEN"),
  );
  await assert.rejects(
    () => write(review, user, { "X-EmDash-Request": "" }),
    code("FORBIDDEN"),
  );
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  await assert.rejects(() => write(review), code("FORBIDDEN"));
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  await assert.rejects(() => write(review), code("FORBIDDEN"));
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='owner' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  const accepted = await write(review);
  assert.equal(accepted.proposal.state, "accepted");
  assert.equal(accepted.execution, "not-performed");
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_handoffs")
      .get().n,
    0,
  );
});

test("CLI journey records the decision and refuses execute or self-approval", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-agent-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const db = join(root, "proposals.sqlite");
  const evidenceFile = join(root, "evidence.json");
  const changeFile = join(root, "change.json");
  const changeFile2 = join(root, "change-v2.json");
  writeFileSync(evidenceFile, JSON.stringify(evidence));
  writeFileSync(changeFile, JSON.stringify(change));
  writeFileSync(
    changeFile2,
    JSON.stringify({
      ...change,
      summary:
        "Return 422 for empty-after-trim text and add the regression test requested by the owner.",
      patch: change.patch + "+test: approval rejects empty-after-trim text\n",
    }),
  );
  const sourceFile = join(root, "source.md");
  writeFileSync(sourceFile, "fictional source for the CLI journey\n");
  const cli = (args) =>
    spawnSync(process.execPath, ["scripts/agent-proposal.mjs", ...args], {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
  const json = (result, args = []) => {
    if (result.status !== 0)
      console.error("CLI FAILED", args.join(" "), result.stderr);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const grant = json(
    cli([
      "grant",
      "--db",
      db,
      "--workspace",
      "ws-fiction-trail",
      "--workspace-name",
      "Fictional Trail Notes",
      "--app",
      "trail-notes",
      "--environment",
      "env-preview-qa",
      "--environment-kind",
      "preview",
      "--account",
      "fiction-composer-preview",
      "--role",
      "programmer",
      "--agent-id",
      AGENT.id,
      "--agent-name",
      AGENT.name,
      "--owner-id",
      OWNER.id,
      "--owner-name",
      OWNER.name,
      "--fallback-id",
      FALLBACK.id,
      "--fallback-name",
      FALLBACK.name,
      "--issued-by",
      OWNER.name,
      "--expires-at",
      "2026-10-27T00:00:00Z",
      "--confirm-owner",
      "--now",
      NOW,
      "--json",
    ]),
  );
  const briefing = json(
    cli([
      "brief",
      "--db",
      db,
      "--grant",
      grant.id,
      "--evidence",
      evidenceFile,
      "--as-of",
      NOW,
      "--json",
    ]),
  );
  const submitted = json(
    cli([
      "submit",
      "--db",
      db,
      "--grant",
      grant.id,
      "--briefing",
      briefing.id,
      "--evidence",
      "ev-01,ev-02",
      "--source-path",
      sourceFile,
      "--repo-root",
      root,
      "--change",
      changeFile,
      "--risk",
      "medium",
      "--now",
      NOW,
      "--json",
    ]),
  );
  const v1 = submitted.proposal;
  assert.equal(readFileSync(join(root, "proposals.sqlite")).length > 0, true);
  const self = cli([
    "review",
    "--db",
    db,
    "--proposal",
    v1.id,
    "--decision",
    "accept",
    "--actor-id",
    AGENT.id,
    "--actor-name",
    AGENT.name,
    "--actor-kind",
    "agent",
    "--reason",
    "I am the agent and I approve my own proposal.",
    "--expected-digest",
    v1.digest,
    "--now",
    NOW,
  ]);
  assert.equal(self.status, 2);
  assert.match(self.stderr, /SELF_APPROVAL/);
  const requested = json(
    cli([
      "review",
      "--db",
      db,
      "--proposal",
      v1.id,
      "--decision",
      "request-changes",
      "--actor-id",
      OWNER.id,
      "--actor-name",
      OWNER.name,
      "--actor-kind",
      "human",
      "--reason",
      "Add the regression test before acceptance.",
      "--expected-digest",
      v1.digest,
      "--now",
      "2026-10-25T01:20:00Z",
      "--json",
    ]),
  );
  assert.equal(requested.proposal.state, "changes-requested");
  const v2 = json(
    cli([
      "submit",
      "--db",
      db,
      "--grant",
      grant.id,
      "--briefing",
      briefing.id,
      "--proposal",
      v1.id,
      "--evidence",
      "ev-01,ev-02",
      "--source-path",
      sourceFile,
      "--repo-root",
      root,
      "--change",
      changeFile2,
      "--risk",
      "medium",
      "--now",
      "2026-10-25T01:25:00Z",
      "--json",
    ]),
  ).proposal;
  assert.equal(v2.version, 2);
  const acceptArgs = [
    "review",
    "--db",
    db,
    "--proposal",
    v2.id,
    "--decision",
    "accept",
    "--actor-id",
    OWNER.id,
    "--actor-name",
    OWNER.name,
    "--actor-kind",
    "human",
    "--reason",
    "Checked the exact digest and the isolated source.",
    "--expected-digest",
    v2.digest,
    "--repo-root",
    root,
    "--now",
    LATER,
    "--json",
  ];
  const accepted = json(cli(acceptArgs), acceptArgs);
  assert.equal(accepted.proposal.state, "accepted");
  assert.equal(accepted.execution, "not-performed");
  const verified = json(
    cli([
      "verify",
      "--db",
      db,
      "--proposal",
      v2.id,
      "--repo-root",
      root,
      "--now",
      "2026-10-25T01:35:00Z",
      "--json",
    ]),
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.acceptedDigest, v2.digest);
  const wrongExpected = cli([
    "verify",
    "--db",
    db,
    "--proposal",
    v2.id,
    "--repo-root",
    root,
    "--expected-digest",
    "0".repeat(64),
    "--now",
    "2026-10-25T01:36:00Z",
  ]);
  assert.equal(wrongExpected.status, 3);
  assert.match(wrongExpected.stderr, /DIGEST_MISMATCH/);
  const execute = cli(["execute", "--db", db, "--proposal", v2.id]);
  assert.equal(execute.status, 2);
  assert.match(execute.stderr, /NOT_SUPPORTED/);
  const handoff = json(
    cli([
      "handoff",
      "--db",
      db,
      "--proposal",
      v2.id,
      "--actor-id",
      OWNER.id,
      "--actor-name",
      OWNER.name,
      "--expected-digest",
      v2.digest,
      "--repo-root",
      root,
      "--now",
      "2026-10-25T01:40:00Z",
      "--json",
    ]),
  );
  assert.equal(handoff.artifact.execution, "not-performed");
  assert.equal(handoff.artifact.digest, v2.digest);
});

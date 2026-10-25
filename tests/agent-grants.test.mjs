import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import {
  agentToolInputs,
  createAgentBriefing,
  issueAgentGrantConnection,
  listAgentGrants,
  manageAgentProposals,
  manageAgentTools,
  provisionAgentGrant,
  readAgentBriefing,
  readAgentGrantScope,
  reviewAgentProposal,
  revokeAgentGrant,
  rotateAgentGrantConnection,
  showAgentProposal,
  submitAgentProposalViaConnection,
  verifyAgentConnection,
} from "../src/lib/agent-proposals.ts";
import {
  agentCapabilityCatalogue,
  agentReservedActions,
} from "../src/lib/agent-proposal-contract.ts";
import { inspectSource } from "../scripts/lib/agent-source.mjs";
import {
  ensureWorkspace,
  openLocalDatabase,
} from "../scripts/lib/agent-proposal-local-db.mjs";

const NOW = "2026-10-25T01:00:00Z";
const LATER = "2026-10-25T01:20:00Z";
const FALLBACK = { id: "fictional-owner-0002", name: "Sam Okafor" };
const AGENT = { id: "agent:codex/lane-d", name: "Codex Lane D" };
const ENVIRONMENT = {
  id: "env-preview-qa",
  kind: "preview",
  account: "fiction-composer-preview",
};
const evidence = [
  {
    id: "ev-01",
    kind: "test",
    source: "local://node --test tests/agent-proposals.test.mjs",
    environment: ENVIRONMENT.id,
    observedAt: "2026-10-25T00:30:00Z",
    summary:
      "The native review test depended on the wall clock: a submitted source older than ten minutes made acceptance fail with SOURCE_UNVERIFIED.",
  },
];
const change = {
  kind: "actions",
  summary:
    "Observe the source at review time in the native-route test instead of reusing a fixed evidence clock.",
  actions: [
    {
      op: "edit",
      target: "tests/agent-proposals.test.mjs",
      detail:
        "Submit a freshly observed local source and keep the grant live for the native-route acceptance case.",
    },
  ],
};

const code = (pattern) => (error) => {
  assert.equal(error.code, pattern, error.message);
  return true;
};

function grantsFixture(t) {
  const f = fixture();
  t.after(() => f.close());
  for (const file of [
    "0008_workspace_access.sql",
    "0016_agent_proposals.sql",
    "0018_agent_grant_connections.sql",
  ])
    f.sqlite.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  return f;
}

async function ownerWorkspace(t) {
  const f = grantsFixture(t);
  const workspace = await workspaceForUser(f.db, user);
  f.sqlite
    .prepare(
      "UPDATE creator_members SET display_name=? WHERE workspace_id=? AND user_id=?",
    )
    .run("Ada Nguyen", workspace.id, user.id);
  f.sqlite
    .prepare(
      "INSERT INTO creator_members (workspace_id,user_id,role,display_name,email) VALUES (?,?,?,?,?)",
    )
    .run(
      workspace.id,
      FALLBACK.id,
      "editor",
      FALLBACK.name,
      "sam@example.test",
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
  const read = (payload, caller = user) =>
    manageAgentProposals(
      {
        user: caller,
        input: payload,
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/proposalsRead?" +
            new URLSearchParams(payload),
          { method: "GET" },
        ),
      },
      f.runtime,
    );
  const grantRequest = (patch = {}) => ({
    action: "grant",
    workspace: workspace.id,
    app: "trail-notes",
    environment: ENVIRONMENT,
    rolePack: "programmer",
    agent: AGENT,
    fallbackId: FALLBACK.id,
    expiresInHours: 24,
    ...patch,
  });
  return { ...f, workspace, write, read, grantRequest };
}

async function connected(t) {
  const f = await ownerWorkspace(t);
  const created = await f.write(f.grantRequest());
  const auth = {
    workspace: f.workspace.id,
    grant: created.grant.id,
    token: created.connection.token,
  };
  const briefing = await createAgentBriefing(
    f.db,
    { workspace: f.workspace.id, grant: auth.grant, asOf: NOW, evidence },
    { now: NOW },
  );
  return { ...f, created, auth, briefing };
}

const storedSource = {
  kind: "local-path",
  path: "notes/finding.md",
  contentHash: "a".repeat(64),
  files: 1,
  bytes: 120,
  checkedAt: NOW,
};
const submitThrough = (f, auth, patch = {}) =>
  submitAgentProposalViaConnection(
    f.db,
    {
      workspace: auth.workspace,
      grant: auth.grant,
      token: auth.token,
      briefing: f.briefing.id,
      source: { kind: "local-path", path: storedSource.path },
      evidence: ["ev-01"],
      risk: "medium",
      change,
      ...patch,
    },
    { now: NOW, source: storedSource },
  );

test("the capability catalogue is proposal-only and names what stays with a human", () => {
  assert.deepEqual(
    agentCapabilityCatalogue.map((item) => item.id),
    ["scope:read", "briefing:read", "proposal:submit"],
  );
  assert.deepEqual(
    agentCapabilityCatalogue.map((item) => item.authority),
    ["read", "read", "propose"],
  );
  const text = [
    ...agentCapabilityCatalogue.map(
      (item) => `${item.id} ${item.label} ${item.detail}`,
    ),
    ...agentReservedActions,
  ]
    .join(" ")
    .toLowerCase();
  assert.doesNotMatch(
    agentCapabilityCatalogue.map((item) => item.id).join(" "),
    /review|approve|handoff|deploy|execute|spend|secret/,
  );
  for (const reserved of [
    "review, accept",
    "handoff",
    "deploy",
    "credential",
    "membership",
    "spend",
    "secrets",
  ])
    assert.match(text, new RegExp(reserved));
});

test("an owner authorises one scoped connection and receives the credential exactly once", async (t) => {
  const f = await connected(t);
  assert.equal(f.created.connection.token.startsWith("ec_agent_"), true);
  assert.equal(f.created.grant.state, "active");
  assert.equal(f.created.grant.mode, "proposal-only");
  assert.equal(f.created.connection.revokedWithGrant, true);
  assert.equal(f.created.connection.execution, "not-performed");
  assert.equal(f.created.grant.connection.issued, true);
  assert.equal(
    f.created.grant.connection.prefix,
    f.created.connection.token.slice(0, 17),
  );

  const row = f.sqlite
    .prepare("SELECT * FROM creator_agent_grants WHERE id=?")
    .get(f.created.grant.id);
  assert.equal(row.connection_hash.length, 64);
  assert.equal(row.connection_prefix, f.created.grant.connection.prefix);
  const dump = JSON.stringify(
    f.sqlite.prepare("SELECT * FROM creator_agent_grants").all(),
  );
  assert.equal(dump.includes(f.created.connection.token), false);
  assert.equal(dump.includes(f.created.connection.token.slice(13)), false);

  const snapshot = await f.read({
    action: "grants",
    workspace: f.workspace.id,
  });
  assert.equal(snapshot.grants.length, 1);
  assert.equal(
    JSON.stringify(snapshot).includes(f.created.connection.token),
    false,
  );
  assert.equal(snapshot.execution, "not-performed");
  assert.deepEqual(
    snapshot.capabilities.map((item) => item.id),
    ["scope:read", "briefing:read", "proposal:submit"],
  );
  assert.ok(snapshot.reserved.length >= 5);
});

test("only an owner can authorise, and the fallback must be a current non-viewer member", async (t) => {
  const f = await ownerWorkspace(t);
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  await assert.rejects(() => f.write(f.grantRequest()), code("FORBIDDEN"));
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='owner' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);

  await assert.rejects(
    () => f.write(f.grantRequest({ fallbackId: "fictional-outsider-0009" })),
    code("MEMBER_NOT_FOUND"),
  );
  await assert.rejects(
    () => f.write(f.grantRequest({ fallbackId: user.id })),
    code("INVALID"),
  );
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, FALLBACK.id);
  await assert.rejects(() => f.write(f.grantRequest()), code("INVALID"));
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, FALLBACK.id);
  await assert.rejects(
    () =>
      f.write(
        f.grantRequest({
          environment: { ...ENVIRONMENT, kind: "production" },
        }),
      ),
    code("INVALID"),
  );
  await assert.rejects(
    () => f.write(f.grantRequest({ agent: { id: FALLBACK.id, name: "Sam" } })),
    code("INVALID"),
  );
  await assert.rejects(
    () => f.write(f.grantRequest({ expiresInHours: 500 })),
    code("INVALID"),
  );
});

test("the agent sees exactly the selected app, environment and capabilities", async (t) => {
  const f = await connected(t);
  const scope = await readAgentGrantScope(f.db, f.auth, { now: NOW });
  assert.equal(scope.workspace, f.workspace.id);
  assert.equal(scope.app, "trail-notes");
  assert.deepEqual(scope.environment, ENVIRONMENT);
  assert.equal(scope.rolePack, "programmer");
  assert.deepEqual(scope.agent, AGENT);
  assert.equal(scope.owner.name, "Ada Nguyen");
  assert.equal(scope.fallback.name, FALLBACK.name);
  assert.equal(scope.execution, "not-performed");
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT connection_last_used_at FROM creator_agent_grants WHERE id=?",
      )
      .get(f.auth.grant).connection_last_used_at,
    new Date(NOW).toISOString(),
  );

  await assert.rejects(
    () =>
      readAgentGrantScope(
        f.db,
        { ...f.auth, token: "ec_agent_" + "b".repeat(43) },
        { now: NOW },
      ),
    code("CONNECTION_INVALID"),
  );
  await assert.rejects(
    () =>
      readAgentGrantScope(
        f.db,
        { ...f.auth, workspace: "ws-somewhere-else" },
        { now: NOW },
      ),
    code("GRANT_NOT_FOUND"),
  );
  await assert.rejects(
    () => readAgentGrantScope(f.db, { ...f.auth, agent: AGENT }, { now: NOW }),
    code("INVALID"),
  );

  const briefing = await readAgentBriefing(
    f.db,
    { ...f.auth, briefing: f.briefing.id },
    { now: NOW },
  );
  assert.equal(briefing.digest, f.briefing.digest);
  assert.match(briefing.markdown, /Proposal/);
});

test("a connected agent submits a proposal that the native queue shows and a human accepts", async (t) => {
  const f = await connected(t);
  const submitted = await submitThrough(f, f.auth);
  assert.equal(submitted.deduplicated, false);
  assert.equal(submitted.view.state, "submitted");
  assert.equal(submitted.view.execution, "not-performed");
  assert.equal(submitted.view.proposer.id, AGENT.id);
  assert.deepEqual(submitted.view.environment, ENVIRONMENT);

  const queue = await f.read({ action: "list", workspace: f.workspace.id });
  assert.equal(queue.proposals.length, 1);
  assert.equal(queue.proposals[0].id, submitted.view.id);
  assert.equal(queue.proposals[0].digest, submitted.view.digest);
  assert.equal(queue.execution, "not-performed");

  const accepted = await reviewAgentProposal(
    f.db,
    {
      action: "review",
      workspace: f.workspace.id,
      proposal: submitted.view.id,
      environment: ENVIRONMENT.id,
      decision: "accept",
      actor: { id: user.id, name: "Ada Nguyen" },
      reason: "Checked the exact digest and the freshly observed local source.",
      expectedDigest: submitted.view.digest,
      expectedVersion: 1,
    },
    {
      now: LATER,
      sourceCheck: {
        state: "current",
        detail: "The submitted file matches its content hash.",
        currentHash: storedSource.contentHash,
        checkedAt: NOW,
      },
    },
  );
  assert.equal(accepted.view.state, "accepted");
  assert.equal(accepted.execution, "not-performed");
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposal_handoffs")
      .get().n,
    0,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT execution FROM creator_agent_proposal_handoffs")
      .all().length,
    0,
  );
});

test("the agent identity cannot review its own proposal and has no review capability", async (t) => {
  const f = await connected(t);
  const submitted = (await submitThrough(f, f.auth)).view;
  await assert.rejects(
    () =>
      reviewAgentProposal(
        f.db,
        {
          action: "review",
          workspace: f.workspace.id,
          proposal: submitted.id,
          environment: ENVIRONMENT.id,
          decision: "accept",
          actor: { id: AGENT.id, name: AGENT.name },
          reason: "The submitting agent tries to approve its own proposal.",
          expectedDigest: submitted.digest,
          expectedVersion: 1,
        },
        { now: LATER, actorKind: "agent" },
      ),
    code("SELF_APPROVAL"),
  );
  const scope = await readAgentGrantScope(f.db, f.auth, { now: NOW });
  assert.doesNotMatch(
    scope.capabilities.map((item) => item.id).join(" "),
    /review|approve|handoff/,
  );
  assert.match(scope.reserved.join(" "), /Review, accept/);
});

test("revocation refuses further agent use and preserves the reviewable record", async (t) => {
  const f = await connected(t);
  const submitted = (await submitThrough(f, f.auth)).view;
  const revoked = await revokeAgentGrant(
    f.db,
    {
      workspace: f.workspace.id,
      grant: f.auth.grant,
      actor: { id: user.id, name: "Ada Nguyen" },
      reason: "The agent is finished for this environment.",
    },
    { now: LATER },
  );
  assert.equal(revoked.state, "revoked");

  await assert.rejects(
    () => readAgentGrantScope(f.db, f.auth, { now: LATER }),
    code("GRANT_REVOKED"),
  );
  await assert.rejects(
    () =>
      readAgentBriefing(
        f.db,
        { ...f.auth, briefing: f.briefing.id },
        { now: LATER },
      ),
    code("GRANT_REVOKED"),
  );
  await assert.rejects(() => submitThrough(f, f.auth), code("GRANT_REVOKED"));
  await assert.rejects(
    () =>
      issueAgentGrantConnection(
        f.db,
        {
          workspace: f.workspace.id,
          grant: f.auth.grant,
          actor: { id: user.id, name: "Ada Nguyen" },
        },
        { now: LATER },
      ),
    code("GRANT_REVOKED"),
  );
  const stored = await showAgentProposal(f.db, {
    workspace: f.workspace.id,
    proposal: submitted.id,
  });
  assert.equal(stored.state, "submitted");
  assert.equal(stored.grant.state, "revoked");
});

test("expiry and rotation refuse the credential a stale client still holds", async (t) => {
  const f = await connected(t);
  const rotated = await rotateAgentGrantConnection(
    f.db,
    {
      workspace: f.workspace.id,
      grant: f.auth.grant,
      actor: { id: user.id, name: "Ada Nguyen" },
    },
    { now: LATER },
  );
  assert.notEqual(rotated.connection.token, f.created.connection.token);
  await assert.rejects(
    () => readAgentGrantScope(f.db, f.auth, { now: LATER }),
    code("CONNECTION_INVALID"),
  );
  const fresh = { ...f.auth, token: rotated.connection.token };
  assert.equal(
    (await readAgentGrantScope(f.db, fresh, { now: LATER })).grant,
    f.auth.grant,
  );
  await assert.rejects(
    () =>
      rotateAgentGrantConnection(
        f.db,
        {
          workspace: f.workspace.id,
          grant: f.auth.grant,
          actor: { id: user.id, name: "Ada Nguyen" },
        },
        { now: LATER, actorKind: "agent" },
      ),
    code("SELF_APPROVAL"),
  );

  await assert.rejects(
    () => readAgentGrantScope(f.db, fresh, { now: "2026-10-28T00:00:00Z" }),
    code("GRANT_EXPIRED"),
  );
  const expired = await listAgentGrants(
    f.db,
    { workspace: f.workspace.id },
    { now: "2026-10-28T00:00:00Z" },
  );
  assert.equal(expired[0].state, "expired");
});

test("the agent credential is not an EmDash credential and cannot reach plugin admin routes", async () => {
  const install = new URL(
    "../node_modules/emdash/dist/astro/middleware/auth.mjs",
    import.meta.url,
  );
  const source = readFileSync(install, "utf8");
  assert.match(source, /token\.startsWith\("ec_pat_"\)/);
  assert.match(source, /token\.startsWith\("ec_oat_"\)/);
  assert.match(source, /else return "invalid";/);
  assert.match(
    source,
    /"\/_emdash\/api\/plugins",\s*"\*",\s*"admin"/,
    "EmDash must require the admin token scope on plugin routes",
  );
  const pnpm = new URL("../node_modules/.pnpm/", import.meta.url);
  const authDir = readdirSync(pnpm).find((name) =>
    name.startsWith("@emdash-cms+auth@"),
  );
  assert.ok(authDir, "the installed EmDash auth package must be present");
  const { VALID_SCOPES, hasScope } = await import(
    new URL(`${authDir}/node_modules/@emdash-cms/auth/dist/index.mjs`, pnpm)
      .href
  );
  assert.ok(VALID_SCOPES.includes("mcp:tools"));
  assert.equal(
    hasScope(["mcp:tools:composer-stacks"], "mcp:tools:composer-stacks"),
    true,
  );
  assert.equal(hasScope(["mcp:tools:composer-stacks"], "admin"), false);
  assert.equal(hasScope(["mcp:tools:composer-stacks"], "content:write"), false);

  const prefix = "ec_agent_";
  assert.equal(prefix.startsWith("ec_pat_"), false);
  assert.equal(prefix.startsWith("ec_oat_"), false);
});

test("the scoped MCP endpoint exposes three proposal-only tools and refuses after revocation", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-agent-mcp-"));
  const local = openLocalDatabase(join(root, "proposals.sqlite"));
  t.after(() => {
    local.close();
    rmSync(root, { recursive: true, force: true });
  });
  ensureWorkspace(local.sqlite, "ws-fiction-trail", "Fictional Trail Notes");
  const grant = await provisionAgentGrant(
    local.db,
    {
      workspace: "ws-fiction-trail",
      app: "trail-notes",
      environment: ENVIRONMENT,
      rolePack: "programmer",
      agent: AGENT,
      owner: { id: "fictional-owner-0001", name: "Ada Nguyen" },
      fallback: FALLBACK,
      issuedBy: "Ada Nguyen",
      expiresAt: "2026-10-27T00:00:00Z",
    },
    { now: NOW },
  );
  const issued = await issueAgentGrantConnection(
    local.db,
    {
      workspace: "ws-fiction-trail",
      grant: grant.id,
      actor: { id: "fictional-owner-0001", name: "Ada Nguyen" },
    },
    { now: NOW },
  );
  writeFileSync(join(root, "finding.md"), "A bounded fictional finding.\n");
  writeFileSync(join(root, "evidence.json"), JSON.stringify(evidence));

  const client = new Client({ name: "composer-test-client", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "scripts/agent-proposal-mcp.mjs",
      "--db",
      join(root, "proposals.sqlite"),
      "--grant",
      grant.id,
      "--workspace",
      "ws-fiction-trail",
      "--repo-root",
      root,
      "--now",
      NOW,
    ],
    env: { ...process.env, COMPOSER_AGENT_TOKEN: issued.connection.token },
    stderr: "pipe",
  });
  t.after(async () => {
    await client.close().catch(() => {});
  });
  await client.connect(transport);

  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
    "agent_brief",
    "agent_capabilities",
    "agent_submit",
  ]);
  for (const tool of tools.tools)
    assert.doesNotMatch(
      `${tool.name} ${tool.description}`.toLowerCase(),
      /approve|handoff|deploy|merge|execute/,
    );

  const scope = await client.callTool({
    name: "agent_capabilities",
    arguments: {},
  });
  assert.equal(scope.isError ?? false, false);
  const scopeText = scope.content.map((item) => item.text ?? "").join("");
  assert.match(scopeText, /proposal:submit/);
  assert.match(scopeText, /Review, accept/);
  assert.doesNotMatch(scopeText, new RegExp(issued.connection.token));

  const brief = await client.callTool({
    name: "agent_brief",
    arguments: { evidence },
  });
  assert.equal(brief.isError ?? false, false);
  const briefText = brief.content.map((item) => item.text ?? "").join("");
  assert.match(briefText, /# Programmer agent briefing/);
  assert.match(briefText, /This briefing is read-only for the agent/);
  assert.equal(JSON.parse(briefText).briefing.environment.id, ENVIRONMENT.id);

  const submitted = await client.callTool({
    name: "agent_submit",
    arguments: {
      briefing: JSON.parse(briefText).briefing.id,
      source: { kind: "local-path", path: "finding.md" },
      evidence: ["ev-01"],
      risk: "medium",
      change,
    },
  });
  assert.equal(submitted.isError ?? false, false);
  const proposal = JSON.parse(
    submitted.content.map((item) => item.text ?? "").join(""),
  ).proposal;
  assert.equal(proposal.state, "submitted");
  assert.equal(proposal.execution, "not-performed");
  assert.equal(
    local.sqlite
      .prepare("SELECT COUNT(*) AS n FROM creator_agent_proposals WHERE id=?")
      .get(proposal.id).n,
    1,
  );

  await revokeAgentGrant(
    local.db,
    {
      workspace: "ws-fiction-trail",
      grant: grant.id,
      actor: { id: "fictional-owner-0001", name: "Ada Nguyen" },
      reason: "Owner finished the connected session.",
    },
    { now: LATER },
  );
  const refused = await client.callTool({
    name: "agent_submit",
    arguments: {
      briefing: JSON.parse(briefText).briefing.id,
      source: { kind: "local-path", path: "finding.md" },
      evidence: ["ev-01"],
      risk: "medium",
      change,
    },
  });
  assert.equal(refused.isError, true);
  assert.match(
    refused.content.map((item) => item.text ?? "").join(""),
    /GRANT_REVOKED/,
  );
  await assert.rejects(
    () =>
      verifyAgentConnection(
        local.db,
        {
          workspace: "ws-fiction-trail",
          grant: grant.id,
          token: issued.connection.token,
        },
        { now: LATER },
      ),
    code("GRANT_REVOKED"),
  );
});

test("the EmDash MCP surface is exactly three proposal tools on private JSON routes", () => {
  const source = readFileSync(
    new URL("../src/lib/creator-plugin.ts", import.meta.url),
    "utf8",
  );
  const tools = [...source.matchAll(/^\s{8}(agent_[a-z]+): \{/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(tools, ["agent_scope", "agent_brief", "agent_submit"]);
  for (const route of ["agentScope", "agentBrief", "agentSubmit"])
    assert.match(
      source,
      new RegExp(
        `${route}: \\{\\s*methods: \\["POST"\\],\\s*permission: creatorPermission,\\s*request: \\{ body: "json"`,
      ),
      `${route} must be a private JSON POST route`,
    );
  assert.doesNotMatch(source, /route: "proposalsWrite"/);
  assert.doesNotMatch(source, /route: "proposalsRead"/);
  assert.deepEqual(Object.keys(agentToolInputs).sort(), [
    "brief",
    "scope",
    "submit",
  ]);
});

test("owner-facing EmDash MCP tools stay bound to the grant and the accountable owner", async (t) => {
  const f = await connected(t);
  const tool = (action, payload, caller = user) =>
    manageAgentTools(
      {
        user: caller,
        input: payload,
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/agentScope",
          { method: "POST" },
        ),
      },
      f.runtime,
      action,
    );

  const scope = await tool("scope", {
    workspace: f.workspace.id,
    grant: f.auth.grant,
    agent: AGENT,
  });
  assert.equal(scope.app, "trail-notes");
  assert.deepEqual(scope.environment, ENVIRONMENT);
  assert.equal(scope.execution, "not-performed");

  await assert.rejects(
    () =>
      tool(
        "scope",
        { workspace: f.workspace.id, grant: f.auth.grant, agent: AGENT },
        { id: FALLBACK.id, name: FALLBACK.name, role: 50 },
      ),
    code("REVIEWER_NOT_AUTHORISED"),
  );
  await assert.rejects(
    () =>
      tool("scope", {
        workspace: f.workspace.id,
        grant: f.auth.grant,
        agent: { id: "agent:someone-else", name: "Other agent" },
      }),
    code("SCOPE_MISMATCH"),
  );
  await assert.rejects(
    () => tool("scope", { workspace: f.workspace.id, grant: f.auth.grant }),
    code("INVALID"),
  );
  await assert.rejects(
    () =>
      tool(
        "scope",
        { workspace: f.workspace.id, grant: f.auth.grant, agent: AGENT },
        { id: "fictional-outsider-0009", name: "Outsider", role: 50 },
      ),
    code("FORBIDDEN"),
  );

  const submitted = await tool("submit", {
    workspace: f.workspace.id,
    grant: f.auth.grant,
    agent: AGENT,
    briefing: f.briefing.id,
    repository: "loftwah/app-composer",
    commit: "abe4503cdc8701fb1d38c3b583d30cc3b7ec5475",
    evidence: ["ev-01"],
    risk: "low",
    change,
  });
  assert.equal(submitted.proposal.state, "submitted");
  assert.equal(submitted.proposal.source.kind, "repo");
  assert.equal(
    submitted.proposal.source.commit,
    "abe4503cdc8701fb1d38c3b583d30cc3b7ec5475",
  );
  assert.equal(submitted.execution, "not-performed");

  const queue = await f.read({ action: "list", workspace: f.workspace.id });
  assert.equal(queue.proposals.length, 1);
  assert.equal(queue.proposals[0].id, submitted.proposal.id);
});

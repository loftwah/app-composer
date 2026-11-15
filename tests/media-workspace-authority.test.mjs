// Two-workspace acceptance for #599: workspace-scoped media authority.
//
// Real D1-shaped SQLite, the real migration files, the real runtime and a
// fictional Oyster/Prints double. No live provider call and no real credential
// is used; every secret here is an obvious fixture literal.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MediaContractError, mediaCustodyScope } from "../src/lib/media-capability.mjs";
import {
  jobIdFor,
  mediaPermissions,
  resolveAgentScope,
  resolveSessionScope,
  runAction,
} from "../src/lib/media-capability-runtime.mjs";
import { studioAccess } from "../src/lib/member-access.ts";

const baseMigrations = [
  "0003_stacks.sql",
  "0004_stack_publications.sql",
  "0008_workspace_access.sql",
  "0010_member_app_grants.sql",
  "0027_media_capability.sql",
  "0028_media_studio_grants.sql",
];
const scopedMigration = "0029_media_workspace_authority.sql";

const atelier = "ws-atelier-0001";
const gallery = "ws-gallery-0002";

/** The provider's request identity and the derived job id must keep the exact
 * shapes the runtime validates, so fixtures build them instead of typing them. */
const requestIdFor = (label) => "media_request_" + label.padEnd(21, "0");
const jobIdForLabel = (label) => "job_" + label.padEnd(21, "0");
const legacyOne = jobIdForLabel("legacyone");
const legacyTwo = jobIdForLabel("legacytwo");

const ownerA = { id: "fictional-owner-a", name: "Fictional A", role: 50 };
const editorA = { id: "fictional-editor-a", name: "Fictional Editor A", role: 20 };
const ownerB = { id: "fictional-owner-b", name: "Fictional B", role: 50 };
const viewerB = { id: "fictional-viewer-b", name: "Fictional Viewer B", role: 10 };

const cataloguePayload = {
  models: [
    {
      id: "studio-still",
      label: "Studio still",
      kind: "image",
      tier: "balanced",
      maxPromptLength: 1200,
      input: { maxReferences: 4, defaultWidth: 1024, defaultHeight: 1024 },
      video: null,
      priceEstimate: { costMilliunits: 6561 },
    },
  ],
};

function apply(sqlite, names) {
  for (const name of names)
    sqlite.exec(readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"));
}

function d1(sqlite, after) {
  const prepare = (sql, params = []) => ({
    sql,
    params,
    bind(...values) {
      return prepare(sql, values);
    },
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...params);
      if (after) await after(sql, params);
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  });
  return {
    prepare: (sql) => prepare(sql),
    async batch(statements) {
      return statements.map(({ sql, params }) => ({
        success: true,
        results: sqlite.prepare(sql).all(...params),
      }));
    },
  };
}

function seed(sqlite) {
  const workspace = sqlite.prepare("INSERT INTO creator_workspaces (id, name) VALUES (?, ?)");
  workspace.run(atelier, "Atelier");
  workspace.run(gallery, "Gallery");
  const member = sqlite.prepare(
    "INSERT INTO creator_members (workspace_id, user_id, role) VALUES (?, ?, ?)",
  );
  member.run(atelier, ownerA.id, "owner");
  member.run(atelier, editorA.id, "editor");
  member.run(gallery, ownerB.id, "owner");
  member.run(gallery, viewerB.id, "viewer");
  const grant = sqlite.prepare(
    "INSERT INTO creator_app_grants (id, issuer, workspace_id, user_id, app, resource_id, action, status, revision, created_by) VALUES (?, 'https://composer.loftwah.com', ?, ?, 'media-studio', 'studio-installation', ?, 'active', 1, ?)",
  );
  grant.run("grant-a-read", atelier, editorA.id, "read", ownerA.id);
  grant.run("grant-a-generate", atelier, editorA.id, "generate", ownerA.id);
}

function deployment({ legacy = null, after = null } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  apply(sqlite, baseMigrations);
  seed(sqlite);
  if (legacy) {
    sqlite
      .prepare(
        "INSERT INTO media_capability (id, enabled, host, installation, models_json, updated_at, updated_by) VALUES (1, ?, ?, 'prints', NULL, ?, ?)",
      )
      .run(
        legacy.enabled ? 1 : 0,
        legacy.host,
        legacy.updatedAt ?? "2026-11-01T00:00:00.000Z",
        legacy.updatedBy ?? "fictional-owner-a",
      );
    for (const job of legacy.jobs) {
      sqlite
        .prepare(
          "INSERT INTO media_jobs (id, request_id, kind, state, prompt, model, settings_json, reference_path, cost_milliunits, output_json, created_at, updated_at, created_by) VALUES (?, ?, 'image', ?, ?, 'studio-still', '{}', NULL, 6561, NULL, ?, ?, ?)",
        )
        .run(
          job.id,
          job.requestId,
          job.state ?? "completed",
          job.prompt ?? "a legacy bowl",
          job.createdAt ?? "2026-11-01T00:00:00.000Z",
          job.createdAt ?? "2026-11-01T00:00:00.000Z",
          job.createdBy ?? "fictional-owner-a",
        );
    }
  }
  apply(sqlite, [scopedMigration, scopedMigration]);
  const objects = new Map();
  const env = {
    DB: d1(sqlite, after),
    MEDIA: {
      async put(key, bytes, options) {
        objects.set(key, { bytes, options });
      },
    },
    OYSTER_ORIGIN: "https://oyster.example.workers.dev",
    OYSTER_OWNER_KEY: "fictional-deployment-owner-key",
    OYSTER_CONNECTION_ATELIER_ORIGIN: "https://atelier-prints.example.workers.dev",
    OYSTER_CONNECTION_ATELIER_OWNER_KEY: "fictional-atelier-owner-key",
    MEDIA_AGENT_TOKEN: "fictional-deployment-wide-agent-token",
  };
  return { sqlite, env, objects };
}

function jsonResponse(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** A fictional Oyster/Prints MCP host. Every reply is generated locally. */
function providerDouble(overrides = {}) {
  const calls = [];
  const state = { result: overrides.result ?? "ok", output: overrides.output };
  const fetch = async (url, init) => {
    const message = JSON.parse(init.body ?? "{}");
    const code = message.params?.arguments?.code ?? "";
    calls.push({ url: String(url), method: message.method ?? "notification", code });
    if (message.method === "initialize")
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: "2025-11-25",
            capabilities: { tools: {} },
            serverInfo: { name: "fictional-prints", version: "1" },
          },
        },
        { "mcp-session-id": "fictional-session" },
      );
    if (message.method !== "tools/call") return new Response(null, { status: 202 });
    const reply = (payload) =>
      jsonResponse({
        jsonrpc: "2.0",
        id: message.id,
        result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
      });
    if (code.includes("listModels")) return reply(cataloguePayload);
    if (code.includes("generateImage") || code.includes("generateVideo")) {
      if (state.result === "error")
        return jsonResponse(
          {
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32000, message: "The host refused the dispatch" },
          },
          { "Content-Type": "application/json" },
        );
      if (state.result === "timeout") throw new TypeError("network timeout");
      return reply(
        state.output ?? {
          destination: { path: "/out/frame.png" },
          format: "png",
          width: 1024,
          height: 1024,
        },
      );
    }
    if (code.includes("openOutput"))
      return reply({
        parts: [{ offset: 0, size: 4, content: Buffer.from("PNG!").toString("base64") }],
        done: true,
      });
    return reply({});
  };
  return { fetch, calls, state };
}

function useProvider(t, double) {
  const original = globalThis.fetch;
  globalThis.fetch = double.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  return double;
}

const generationCalls = (double) =>
  double.calls.filter((call) => /generate(Image|Video)/.test(call.code)).length;

async function errorOf(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("expected the call to fail closed");
}

test("the migration is additive, idempotent and keeps every legacy row in owner custody", (t) => {
  // Any provider call would go through this double and be counted.
  const double = useProvider(t, providerDouble());
  const { sqlite } = deployment({
    legacy: {
      enabled: true,
      host: "https://oyster.example.workers.dev",
      jobs: [
        { id: legacyOne, requestId: requestIdFor("legacy-one") },
        {
          id: legacyTwo,
          requestId: requestIdFor("legacy-two"),
          state: "unknown",
          createdBy: "agent:old-token",
        },
      ],
    },
  });
  const legacy = sqlite.prepare("SELECT id, request_id, created_by FROM media_jobs ORDER BY id").all();
  assert.equal(legacy.length, 2, "the pre-#599 table is untouched");
  const custody = sqlite
    .prepare("SELECT id, workspace_id, scope, adopted_from FROM media_workspace_jobs ORDER BY id")
    .all();
  assert.deepEqual(
    custody.map((row) => ({ ...row })),
    [
      {
        id: legacyOne,
        workspace_id: mediaCustodyScope,
        scope: "custody",
        adopted_from: "legacy:0027",
      },
      {
        id: legacyTwo,
        workspace_id: mediaCustodyScope,
        scope: "custody",
        adopted_from: "legacy:0027",
      },
    ],
  );
  // Nothing was guessed into a workspace, including the agent-created row.
  assert.equal(
    sqlite.prepare("SELECT count(*) n FROM media_workspace_jobs WHERE scope='workspace'").get().n,
    0,
  );
  assert.equal(double.calls.length, 0, "migration makes no provider call");
});

test("two workspaces hold distinct connections and cannot read each other's state", async (t) => {
  const { env } = deployment();
  const double = useProvider(t, providerDouble());
  const scopeA = await resolveSessionScope(env, { user: ownerA });
  const scopeB = await resolveSessionScope(env, { user: ownerB });
  assert.equal(scopeA.workspaceId, atelier);
  assert.equal(scopeB.workspaceId, gallery);

  const enabledA = await runAction(env, "enable", scopeA, {
    host: "https://oyster.example.workers.dev",
    credentialRef: "OYSTER",
  });
  // The deployment-wide credential serves one workspace at a time; a second
  // workspace must bring its own reference.
  const taken = await errorOf(
    runAction(env, "enable", scopeB, { host: "https://oyster.example.workers.dev" }),
  );
  assert.equal(taken.code, "LEGACY_SCOPE_TAKEN");
  const enabledB = await runAction(env, "enable", scopeB, {
    host: "https://atelier-prints.example.workers.dev",
    credentialRef: "OYSTER_CONNECTION_ATELIER",
  });
  assert.equal(enabledA.connection.host, "https://oyster.example.workers.dev");
  assert.equal(enabledA.connection.credentialRef, "OYSTER");
  assert.equal(enabledA.connection.credentialScope, "deployment-legacy");
  assert.equal(enabledB.connection.host, "https://atelier-prints.example.workers.dev");
  assert.equal(enabledB.connection.credentialRef, "OYSTER_CONNECTION_ATELIER");
  assert.equal(enabledB.connection.credentialScope, "workspace");
  assert.notEqual(enabledA.connection.id, enabledB.connection.id);
  assert.equal(enabledA.jobs.length, 0);
  assert.equal(enabledB.jobs.length, 0);

  // A credential reference can never select an unrelated Worker secret.
  const rejected = await errorOf(
    runAction(env, "enable", scopeA, { credentialRef: "MEDIA_STUDIO_BRIDGE_SECRET" }),
  );
  assert.ok(rejected instanceof MediaContractError);
  assert.equal(rejected.code, "INVALID_CREDENTIAL_REF");
});

test("a generation is scoped, replay-safe inside its workspace and invisible across workspaces", async (t) => {
  const { env } = deployment();
  const double = useProvider(t, providerDouble());
  const scopeA = await resolveSessionScope(env, { user: ownerA });
  const scopeB = await resolveSessionScope(env, { user: ownerB });
  await runAction(env, "enable", scopeA, { host: "https://oyster.example.workers.dev" });
  await runAction(env, "enable", scopeB, {
    host: "https://atelier-prints.example.workers.dev",
    credentialRef: "OYSTER_CONNECTION_ATELIER",
  });
  const requestId = requestIdFor("crossscope");
  const first = await runAction(env, "generate", scopeA, {
    kind: "image",
    model: "studio-still",
    prompt: "a fictional ceramic bowl",
    requestId,
  });
  assert.equal(first.job.workspaceId, atelier);
  assert.equal(first.job.id, await jobIdFor(atelier, requestId));
  assert.equal(first.job.state, "completed");
  assert.equal(generationCalls(double), 1);

  // The same idempotency key inside the same workspace returns the recorded
  // job and never buys a second generation.
  const replay = await runAction(env, "generate", scopeA, {
    kind: "image",
    model: "studio-still",
    prompt: "a fictional ceramic bowl",
    requestId,
  });
  assert.equal(replay.job.id, first.job.id);
  assert.equal(replay.replayed, true);
  assert.equal(replay.providerCalled, false);
  assert.equal(generationCalls(double), 1);

  // Workspace B sees nothing and every direct id probe fails closed with the
  // same answer as a job that never existed.
  const statusB = await runAction(env, "status", scopeB, {});
  assert.equal(statusB.jobs.length, 0);
  assert.equal(JSON.stringify(statusB).includes(first.job.id), false);
  assert.equal(JSON.stringify(statusB).includes("ceramic bowl"), false);
  const foreign = await errorOf(runAction(env, "reconcile", scopeB, { id: first.job.id }));
  const missing = await errorOf(
    runAction(env, "reconcile", scopeB, { id: jobIdForLabel("never-recorded") }),
  );
  assert.equal(foreign.code, "JOB_NOT_FOUND");
  assert.equal(foreign.status, 404);
  assert.equal(foreign.message, missing.message);
  assert.equal(foreign.message.includes(atelier), false);
  const foreignImport = await errorOf(runAction(env, "import", scopeB, { id: first.job.id }));
  assert.equal(foreignImport.code, "JOB_NOT_FOUND");

  // Replaying another workspace's provider identity fails closed and spends
  // nothing. The message does not confirm that the other row exists.
  const conflict = await errorOf(
    runAction(env, "generate", scopeB, {
      kind: "image",
      model: "studio-still",
      prompt: "a fictional ceramic bowl",
      requestId,
    }),
  );
  assert.equal(conflict.code, "SCOPE_CONFLICT");
  assert.equal(conflict.status, 409);
  assert.equal(conflict.message.includes(atelier), false);
  assert.equal(conflict.message.includes(first.job.id), false);
  assert.equal(generationCalls(double), 1);
});

test("concurrent dispatch of one request id records one job and buys one generation", async (t) => {
  const { env } = deployment();
  const double = useProvider(t, providerDouble());
  const scope = await resolveSessionScope(env, { user: ownerA });
  await runAction(env, "enable", scope, { host: "https://oyster.example.workers.dev" });
  const requestId = requestIdFor("concurrent");
  const body = {
    kind: "image",
    model: "studio-still",
    prompt: "two tabs, one intent",
    requestId,
  };
  const results = await Promise.allSettled([
    runAction(env, "generate", scope, body),
    runAction(env, "generate", scope, body),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  assert.equal(fulfilled.length, 2, JSON.stringify(results.map((r) => r.reason?.message)));
  assert.equal(new Set(fulfilled.map((result) => result.value.job.id)).size, 1);
  assert.equal(generationCalls(double), 1);
});

test("a revoked grant or a disabled connection stops dispatch before the provider", async (t) => {
  const { env, sqlite } = deployment();
  const double = useProvider(t, providerDouble());
  const scope = await resolveSessionScope(env, { user: editorA });
  assert.deepEqual(scope.actions, ["read", "generate"]);

  await runAction(env, "enable", await resolveSessionScope(env, { user: ownerA }), {
    host: "https://oyster.example.workers.dev",
  });
  const allowed = await runAction(env, "generate", scope, {
    kind: "image",
    model: "studio-still",
    prompt: "editor work",
  });
  assert.equal(allowed.job.state, "completed");
  assert.equal(generationCalls(double), 1);

  sqlite
    .prepare(
      "UPDATE creator_app_grants SET status='revoked' WHERE workspace_id=? AND user_id=? AND action='generate'",
    )
    .run(atelier, editorA.id);
  const revokedScope = await resolveSessionScope(env, { user: editorA });
  const denied = await errorOf(
    runAction(env, "generate", revokedScope, {
      kind: "image",
      model: "studio-still",
      prompt: "editor work",
    }),
  );
  assert.equal(denied.code, "FORBIDDEN");
  assert.equal(denied.status, 403);
  assert.equal(generationCalls(double), 1, "a revoked grant never reaches the provider");

  sqlite
    .prepare(
      "UPDATE creator_app_grants SET status='active' WHERE workspace_id=? AND user_id=? AND action='generate'",
    )
    .run(atelier, editorA.id);
  const owner = await resolveSessionScope(env, { user: ownerA });
  await runAction(env, "disable", owner);
  const offScope = await resolveSessionScope(env, { user: editorA });
  const off = await errorOf(
    runAction(env, "generate", offScope, {
      kind: "image",
      model: "studio-still",
      prompt: "editor work",
    }),
  );
  assert.equal(off.code, "DISABLED");
  assert.equal(generationCalls(double), 1);
  const kept = await runAction(env, "status", offScope, {});
  assert.equal(kept.jobs.length, 1, "disabling keeps the existing job");

  // The switch is per workspace: Gallery keeps its own connection and rights.
  const galleryOwner = await resolveSessionScope(env, { user: ownerB });
  await runAction(env, "enable", galleryOwner, {
    host: "https://atelier-prints.example.workers.dev",
    credentialRef: "OYSTER_CONNECTION_ATELIER",
  });
  const stillWorking = await runAction(env, "generate", galleryOwner, {
    kind: "image",
    model: "studio-still",
    prompt: "gallery work continues",
  });
  assert.equal(stillWorking.job.workspaceId, gallery);
  assert.equal(generationCalls(double), 2);
});

test("authority is rechecked at dispatch and a revoked grant refuses the intent", async (t) => {
  let revoked = false;
  const { sqlite, env } = deployment({
    after: async (sql) => {
      if (revoked || !sql.startsWith("INSERT INTO media_workspace_jobs")) return;
      revoked = true;
      sqlite
        .prepare(
          "UPDATE creator_app_grants SET status='revoked' WHERE workspace_id=? AND user_id=? AND action='generate'",
        )
        .run(atelier, editorA.id);
    },
  });
  const double = useProvider(t, providerDouble());
  await runAction(env, "enable", await resolveSessionScope(env, { user: ownerA }), {
    host: "https://oyster.example.workers.dev",
  });
  const scope = await resolveSessionScope(env, { user: editorA });
  const failure = await errorOf(
    runAction(env, "generate", scope, {
      kind: "image",
      model: "studio-still",
      prompt: "revoked between intent and dispatch",
    }),
  );
  assert.equal(failure.code, "REVOKED");
  assert.equal(failure.status, 403);
  assert.equal(generationCalls(double), 0);
  const row = sqlite
    .prepare("SELECT state, error_code FROM media_workspace_jobs WHERE workspace_id=?")
    .get(atelier);
  assert.equal(row.state, "refused");
  assert.equal(row.error_code, "REVOKED");
});

test("an unknown outcome stays unknown and is only resolved by an explicit reopen", async (t) => {
  const { env } = deployment();
  const double = useProvider(t, providerDouble({ result: "error" }));
  const scope = await resolveSessionScope(env, { user: ownerA });
  await runAction(env, "enable", scope, { host: "https://oyster.example.workers.dev" });
  const requestId = requestIdFor("unknown");
  const body = {
    kind: "image",
    model: "studio-still",
    prompt: "an uncertain outcome",
    requestId,
  };
  const first = await runAction(env, "generate", scope, body);
  assert.equal(first.unknown, true);
  assert.equal(first.job.state, "unknown");
  assert.equal(first.retryable, false);
  assert.equal(generationCalls(double), 1, "the runtime does not retry a failed dispatch");

  // Reading and replaying the same intent never sends it again.
  const status = await runAction(env, "status", scope, {});
  assert.equal(status.jobs[0].state, "unknown");
  const replay = await runAction(env, "generate", scope, body);
  assert.equal(replay.replayed, true);
  assert.equal(replay.job.state, "unknown");
  assert.equal(generationCalls(double), 1);

  // The explicit reopen is the only path that may talk to the host again.
  double.state.result = "ok";
  const reopened = await runAction(env, "reconcile", scope, { id: first.job.id });
  assert.equal(reopened.job.state, "completed");
  assert.equal(generationCalls(double), 2);

  const timeoutDouble = useProvider(t, providerDouble({ result: "timeout" }));
  const timeout = await runAction(env, "generate", scope, {
    kind: "image",
    model: "studio-still",
    prompt: "a timeout",
    requestId: requestIdFor("timeout"),
  });
  assert.equal(timeout.unknown, true);
  assert.equal(timeout.job.state, "unknown");
  assert.equal(timeout.job.errorCode, "HOST_UNAVAILABLE");
  assert.equal(generationCalls(timeoutDouble), 1);
});

test("legacy jobs stay in owner custody until the owner adopts one explicitly", async (t) => {
  const { sqlite, env } = deployment({
    legacy: {
      enabled: true,
      host: "https://oyster.example.workers.dev",
      jobs: [{ id: legacyOne, requestId: requestIdFor("legacy-one") }],
    },
  });
  const double = useProvider(t, providerDouble());
  const owner = await resolveSessionScope(env, { user: ownerA });
  const galleryOwner = await resolveSessionScope(env, { user: ownerB });
  const editor = await resolveSessionScope(env, { user: editorA });

  const status = await runAction(env, "status", owner, {});
  assert.equal(status.jobs.length, 0, "custody is never mixed into a workspace list");
  const denied = await errorOf(runAction(env, "custody", editor, {}));
  assert.equal(denied.code, "FORBIDDEN");

  const custody = await runAction(env, "custody", owner, {});
  assert.equal(custody.scope, mediaCustodyScope);
  assert.equal(custody.jobs.length, 1);
  assert.equal(custody.jobs[0].id, legacyOne);
  assert.equal(custody.jobs[0].scope, "custody");
  assert.equal(custody.legacyCapability.host, "https://oyster.example.workers.dev");

  const adopted = await runAction(env, "adopt", galleryOwner, {
    id: legacyOne,
  });
  assert.equal(adopted.job.workspaceId, gallery);
  assert.equal(adopted.job.adoptedFrom, mediaCustodyScope);
  assert.equal(adopted.job.state, "completed");
  const event = sqlite
    .prepare("SELECT workspace_id, event, subject, detail_json FROM media_scope_events WHERE event='adopt-custody'")
    .get();
  assert.equal(event.workspace_id, gallery);
  assert.equal(event.subject, legacyOne);
  assert.equal(JSON.parse(event.detail_json).from, mediaCustodyScope);

  // It left custody, is invisible in the other workspace and cannot be adopted
  // twice. No provider call was made anywhere in this test.
  assert.equal((await runAction(env, "custody", owner, {})).jobs.length, 0);
  assert.equal((await runAction(env, "status", owner, {})).jobs.length, 0);
  assert.equal((await runAction(env, "status", galleryOwner, {})).jobs.length, 1);
  const again = await errorOf(runAction(env, "adopt", galleryOwner, { id: legacyOne }));
  assert.equal(again.code, "JOB_NOT_FOUND");
  assert.equal(double.calls.length, 0);
});

test("an imported artifact is written once, from this workspace's own job row", async (t) => {
  const { env, objects } = deployment();
  const double = useProvider(t, providerDouble());
  const scopeA = await resolveSessionScope(env, { user: ownerA });
  const scopeB = await resolveSessionScope(env, { user: ownerB });
  await runAction(env, "enable", scopeA, { host: "https://oyster.example.workers.dev" });
  await runAction(env, "enable", scopeB, {
    host: "https://atelier-prints.example.workers.dev",
    credentialRef: "OYSTER_CONNECTION_ATELIER",
  });
  const job = await runAction(env, "generate", scopeA, {
    kind: "image",
    model: "studio-still",
    prompt: "artifact proof",
    requestId: requestIdFor("artifact"),
  });
  const imported = await runAction(env, "import", scopeA, { id: job.job.id });
  assert.equal(imported.imported, true);
  assert.equal(
    imported.job.imported.key,
    "media-studio/" + job.job.id + ".png",
  );
  assert.equal(
    imported.job.imported.sha256,
    createHash("sha256").update(Buffer.from("PNG!")).digest("hex"),
  );
  assert.ok(objects.has("media-studio/" + job.job.id + ".png"));
  const opened = double.calls.filter((call) => call.code.includes("openOutput")).length;
  assert.equal(opened, 1);

  const again = await runAction(env, "import", scopeA, { id: job.job.id });
  assert.equal(again.alreadyPresent, true);
  assert.equal(
    double.calls.filter((call) => call.code.includes("openOutput")).length,
    1,
    "a repeat import reuses the recorded object",
  );
  const foreign = await errorOf(runAction(env, "import", scopeB, { id: job.job.id }));
  assert.equal(foreign.code, "JOB_NOT_FOUND");
  assert.equal(JSON.stringify(await runAction(env, "status", scopeB, {})).includes("artifact proof"), false);
});

test("agent calls use the same handlers with only their granted workspace and actions", async (t) => {
  const { env, sqlite } = deployment();
  const double = useProvider(t, providerDouble());
  const owner = await resolveSessionScope(env, { user: ownerA });
  await runAction(env, "enable", owner, { host: "https://oyster.example.workers.dev" });

  // The pre-#599 deployment-wide token grants no workspace authority.
  const legacy = await errorOf(
    resolveAgentScope(env, { token: "fictional-deployment-wide-agent-token" }),
  );
  assert.equal(legacy.code, "FORBIDDEN");

  const readOnly = await runAction(env, "grant-agent", owner, {
    label: "Fictional read-only agent",
    actions: ["read"],
    expiresInDays: 7,
  });
  assert.match(readOnly.token, /^media_agent_[A-Za-z0-9_-]{40,}$/);
  assert.equal(readOnly.grant.actions.join(","), "read");
  const stored = sqlite
    .prepare("SELECT token_sha256 FROM media_agent_grants WHERE id=?")
    .get(readOnly.grant.id);
  assert.equal(stored.token_sha256.length, 64);
  assert.equal(stored.token_sha256.includes(readOnly.token), false);
  assert.notEqual(stored.token_sha256, readOnly.token);

  const reader = await resolveAgentScope(env, { token: readOnly.token });
  assert.equal(reader.workspaceId, atelier);
  assert.deepEqual(reader.actions, ["read"]);
  const seen = await runAction(env, "status", reader, {});
  assert.equal(seen.workspace.id, atelier);
  const notGranted = await errorOf(
    runAction(env, "generate", reader, { kind: "image", model: "studio-still", prompt: "agent spend" }),
  );
  assert.equal(notGranted.code, "FORBIDDEN");
  assert.equal(generationCalls(double), 0);

  // Administration never reaches the agent path, even with a wide grant.
  const adminAttempt = await errorOf(runAction(env, "enable", reader, { host: "https://oyster.example.workers.dev" }));
  assert.equal(adminAttempt.code, "FORBIDDEN");
  const wrongWorkspace = await errorOf(resolveAgentScope(env, { token: readOnly.token, workspace: gallery }));
  assert.equal(wrongWorkspace.code, "FORBIDDEN");

  const working = await runAction(env, "grant-agent", owner, {
    label: "Fictional generating agent",
    actions: ["read", "generate"],
  });
  const writer = await resolveAgentScope(env, { token: working.token });
  const generated = await runAction(env, "generate", writer, {
    kind: "image",
    model: "studio-still",
    prompt: "agent generation in its own workspace",
    requestId: requestIdFor("agent"),
  });
  assert.equal(generated.job.workspaceId, atelier);
  assert.equal(generationCalls(double), 1);

  // Revocation and expiry both stop the next call.
  await runAction(env, "revoke-agent", owner, { id: working.grant.id });
  const revoked = await errorOf(resolveAgentScope(env, { token: working.token }));
  assert.equal(revoked.code, "FORBIDDEN");
  const revokedRun = await errorOf(runAction(env, "status", writer, {}));
  assert.equal(revokedRun.code, "REVOKED", "a resolved scope still rechecks the grant");

  const expiredToken = "media_agent_fictional-expired-token-value";
  sqlite
    .prepare(
      "INSERT INTO media_agent_grants (id, workspace_id, label, token_sha256, actions_json, status, revision, expires_at, created_at, created_by) VALUES ('grant_expired0001', ?, 'Fictional expired agent', ?, '[\"read\"]', 'active', 1, '2026-01-01T00:00:00.000Z', '2025-12-01T00:00:00.000Z', ?)",
    )
    .run(atelier, createHash("sha256").update(expiredToken).digest("hex"), ownerA.id);
  const expired = await errorOf(resolveAgentScope(env, { token: expiredToken }));
  assert.equal(expired.code, "FORBIDDEN");
  assert.match(expired.message, /expired/);
});

test("the runtime's media permissions mirror the native Media Studio grants", async () => {
  const { env } = deployment();
  for (const user of [ownerA, editorA, ownerB, viewerB]) {
    const scope = await resolveSessionScope(env, { user });
    const native = await studioAccess(
      env.DB,
      { id: user.id, email: "", name: user.name, role: user.role },
      scope.workspaceId,
    );
    // Order is presentation; the authority set must be identical.
    assert.deepEqual([...scope.actions].sort(), [...native.actions].sort(), user.id);
    assert.deepEqual(
      [...(await mediaPermissions(env.DB, user.id, scope.workspaceId, scope.role))].sort(),
      [...native.actions].sort(),
    );
  }
});

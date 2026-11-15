// Runtime side of the Media capability. Every caller — native EmDash pages and
// the agent route — reaches the same handlers, the same D1 rows and the same
// Oyster/Prints calls.
//
// Authority is never taken from a request body. It is derived server-side from
// the existing workspace, app, account and environment identity:
//
//   human session → workspace membership + the workspace's Media Studio grants
//   agent call    → an owner-issued, workspace-scoped, revocable agent grant
//
// Both paths are rechecked immediately before a provider dispatch, and every
// settings, connection, catalogue, job and imported-artifact lookup is scoped
// by workspace. A row in another workspace is indistinguishable from a row that
// does not exist.
import {
  MediaContractError,
  agentNote,
  connectionEligible,
  connectionView,
  custodyNote,
  disableNote,
  enableNote,
  estimateCostMilliunits,
  formatCost,
  generateImageCode,
  generateVideoCode,
  jobView,
  mediaAgentActions,
  mediaAgentPermissions,
  mediaCapabilityId,
  mediaCapabilityName,
  mediaCapabilityPurpose,
  mediaCapabilityVersion,
  mediaCustodyScope,
  mediaAdminActions,
  newRequestId,
  normaliseHost,
  readCatalogue,
  readCredentialRef,
  readExecuteReply,
  readGeneration,
  readJsonRpcReply,
  readReferencePath,
  readRefusal,
  readRequestId,
  readStatusRow,
  readWorkspaceScope,
} from "./media-capability.mjs";
import { StackError, membership, resolveWorkspace } from "./stacks.mjs";

/** The existing native grant issuer for workspace app grants. */
const mediaIssuer = "https://composer.loftwah.com";
/** Mirrors `studioActions` in member-access.ts. The parity test keeps them equal. */
const studioActions = ["read", "edit", "generate", "publish", "admin"];
const mediaResourceId = "studio-installation";

const connectionColumns =
  "workspace_id, connection_id, label, host, installation, credential_ref, credential_scope, enabled, models_json, revision, updated_at, updated_by";
const jobColumns =
  "id, workspace_id, scope, connection_id, connection_revision, request_id, kind, state, prompt, model, settings_json, reference_path, cost_milliunits, output_json, error_code, created_at, updated_at, imported_key, imported_sha256, imported_bytes, imported_format, created_by, adopted_from";
const jobLimit = 12;
const custodyLimit = 24;
const agentGrantColumns =
  "id, workspace_id, label, actions_json, status, revision, expires_at, created_at, created_by, revoked_at";

function now() {
  return new Date().toISOString();
}

function fail(code, message, status = 400) {
  throw new MediaContractError(code, message, status);
}

function secret(env, name) {
  const value = env?.[name];
  return typeof value === "string" ? value.trim() : "";
}

function requireDb(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function")
    fail("UNAVAILABLE", "Workspace media authority needs the deployment database.", 503);
  return env.DB;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digestId(prefix, input, length) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)),
  );
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < length; index += 1)
    value += alphabet[digest[index] % alphabet.length];
  return prefix + value;
}

/** Job identity is derived from the workspace and the provider request id, so
 * two workspaces can never address one job row by id. The id keeps the shape
 * the asset route and the panel already accept. */
export function jobIdFor(workspaceId, requestId) {
  return digestId("job_", workspaceId + "\u0000" + requestId, 21);
}

export async function connectionIdFor(workspaceId) {
  return digestId("connection_", workspaceId + "\u0000" + crypto.randomUUID(), 32);
}

function parseJson(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function uniqueViolation(error) {
  return /unique constraint failed/i.test(String(error?.message ?? error));
}

function fromStack(error) {
  if (error instanceof StackError) return new MediaContractError(error.code, error.message, error.status);
  return error;
}

/* ------------------------------------------------------------------ scope */

function parseActions(value) {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
}

/** The workspace's current Media Studio permissions for one member. Mirrors
 * `studioAccess` in member-access.ts; a workspace owner holds the full set and
 * every other member needs explicit active grants. */
export async function mediaPermissions(db, userId, workspaceId, role) {
  if (role === "owner") return [...studioActions];
  const rows =
    (
      await db
        .prepare(
          `SELECT action FROM creator_app_grants WHERE issuer=? AND workspace_id=? AND user_id=? AND app='media-studio' AND resource_id=? AND status='active' ORDER BY action`,
        )
        .bind(mediaIssuer, workspaceId, userId, mediaResourceId)
        .all()
    ).results ?? [];
  const held = new Set(rows.map((row) => row.action));
  return studioActions.filter((action) => held.has(action));
}

/** Server-derived authority for a signed-in person. A workspace id from the
 * request is only a selector; without matching membership it is refused and
 * never silently replaced.
 * @param {Record<string, unknown>} env
 * @param {{ user?: { id: string, role?: number, name?: string | null } | null, workspace?: string | null }} input */
export async function resolveSessionScope(env, { user, workspace = null } = {}) {
  const db = requireDb(env);
  if (!user || typeof user.id !== "string" || !user.id)
    fail("FORBIDDEN", "Sign in to use Images & video.", 403);
  let selector = null;
  if (workspace !== undefined && workspace !== null && workspace !== "") {
    selector = readWorkspaceScope(workspace);
    if (selector === mediaCustodyScope)
      fail("FORBIDDEN", "Owner custody is not a workspace.", 403);
  }
  let resolved;
  try {
    resolved = await resolveWorkspace(db, { id: user.id, name: user.name ?? null }, selector);
  } catch (error) {
    throw fromStack(error);
  }
  const platformAdmin = Number(user.role) >= 50;
  const actions = await mediaPermissions(db, user.id, resolved.id, resolved.role);
  return {
    kind: "human",
    actorId: user.id,
    workspaceId: resolved.id,
    workspaceName: typeof resolved.name === "string" ? resolved.name : null,
    role: resolved.role,
    actions,
    platformAdmin,
    admin: resolved.role === "owner" && platformAdmin,
  };
}

/** Server-derived authority for an agent. The bearer token is only a lookup:
 * the workspace, permissions, revision and expiry all come from the owner's
 * grant row, and a request-body workspace can only confirm a mismatch.
 * @param {Record<string, unknown>} env
 * @param {{ token?: string | null, workspace?: string | null }} input */
export async function resolveAgentScope(env, { token, workspace = null } = {}) {
  const db = requireDb(env);
  if (typeof token !== "string" || token.length < 24)
    fail("FORBIDDEN", "That agent token is not admitted.", 403);
  const digest = await sha256Hex(new TextEncoder().encode(token));
  const row = await db
    .prepare(
      "SELECT id, workspace_id, label, actions_json, status, revision, expires_at FROM media_agent_grants WHERE token_sha256=?",
    )
    .bind(digest)
    .first();
  if (!row || row.status !== "active")
    fail("FORBIDDEN", "That agent token is not admitted.", 403);
  if (!(Date.parse(row.expires_at) > Date.now()))
    fail("FORBIDDEN", "That agent grant has expired. Ask the workspace owner for a new one.", 403);
  if (workspace !== undefined && workspace !== null && workspace !== "") {
    const selector = readWorkspaceScope(workspace);
    if (selector !== row.workspace_id)
      fail("FORBIDDEN", "That agent token is not admitted for this workspace.", 403);
  }
  const granted = parseActions(row.actions_json);
  return {
    kind: "agent",
    actorId: "agent:" + row.id,
    grantId: row.id,
    grantLabel: typeof row.label === "string" ? row.label : "",
    grantRevision: Number(row.revision) || 1,
    workspaceId: row.workspace_id,
    workspaceName: null,
    role: "agent",
    actions: mediaAgentPermissions.filter((permission) => granted.includes(permission)),
    platformAdmin: false,
    admin: false,
  };
}

function requireAction(scope, action) {
  if (!scope || !Array.isArray(scope.actions) || !scope.actions.includes(action)) {
    const who = scope?.kind === "agent" ? "This agent grant" : "This account";
    fail("FORBIDDEN", who + " does not have current " + action + " access in this workspace.", 403);
  }
}

function requireAdmin(scope, action) {
  if (scope?.kind !== "human" || !scope.platformAdmin)
    fail(
      "FORBIDDEN",
      "Only the deployment owner can administer media connections and agent grants.",
      403,
    );
  if (scope.role !== "owner")
    fail("FORBIDDEN", "Only a workspace owner can administer this workspace's media.", 403);
  requireAction(scope, "admin");
  // `action` names the administrative intent for the receipt and the message.
  if (!mediaAdminActions.includes(action)) fail("FORBIDDEN", "That is not a media administration action.", 403);
}

/** Recheck the same authority immediately before a provider dispatch. A revoked
 * grant, removed membership or expired agent grant stops the call; the already
 * recorded intent is refused rather than sent. */
export async function assertScopeCurrent(env, scope, permission) {
  const db = requireDb(env);
  if (scope.kind === "agent") {
    const row = await db
      .prepare(
        "SELECT status, expires_at, actions_json FROM media_agent_grants WHERE id=? AND workspace_id=?",
      )
      .bind(scope.grantId, scope.workspaceId)
      .first();
    const actions = row ? parseActions(row.actions_json) : [];
    if (
      !row ||
      row.status !== "active" ||
      !(Date.parse(row.expires_at) > Date.now()) ||
      !actions.includes(permission)
    )
      fail("REVOKED", "This agent grant is no longer valid for this workspace.", 403);
    return;
  }
  const role = await membership(db, scope.workspaceId, scope.actorId);
  const actions = await mediaPermissions(db, scope.actorId, scope.workspaceId, role);
  if (!role || !actions.includes(permission))
    fail(
      "REVOKED",
      "This account no longer has " + permission + " access in this workspace.",
      403,
    );
  scope.actions = actions;
  scope.role = role;
  scope.admin = role === "owner" && scope.platformAdmin;
}

/* ------------------------------------------------------------- connection */

/** Resolve Worker secrets by reference. The reference is validated when it is
 * written; only `OYSTER` and `OYSTER_CONNECTION_<NAME>` can be read, so a
 * stored row can never select an unrelated secret. */
export function hostConfig(env, connection = null) {
  const credentialRef = connection?.credentialRef ?? "OYSTER";
  return {
    credentialRef,
    origin: secret(env, credentialRef + "_ORIGIN"),
    key: secret(env, credentialRef + "_OWNER_KEY"),
    installation: connection?.installation || secret(env, "OYSTER_MEDIA_INSTALLATION") || "prints",
    host: connection?.host || "",
  };
}

export async function currentConnection(env, workspaceId) {
  const row = await requireDb(env)
    .prepare(
      "SELECT " + connectionColumns + " FROM media_workspace_connections WHERE workspace_id=?",
    )
    .bind(workspaceId)
    .first();
  return row ? connectionView(row) : null;
}

async function assertConnectionCurrent(env, workspaceId, expected) {
  const connection = await currentConnection(env, workspaceId);
  if (!connectionEligible(connection))
    fail("REVOKED", "This workspace's media connection is switched off.", 409);
  if (connection.id !== expected.id || connection.host !== expected.host)
    fail("CONNECTION_CHANGED", "This workspace's media connection changed. Review it before sending.", 409);
}

async function writeConnection(env, scope, values) {
  const stamp = now();
  await env.DB.prepare(
    "INSERT INTO media_workspace_connections (workspace_id, connection_id, label, host, installation, credential_ref, credential_scope, enabled, models_json, revision, created_at, created_by, updated_at, updated_by) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) " +
      "ON CONFLICT(workspace_id) DO UPDATE SET label=excluded.label, host=excluded.host, installation=excluded.installation, credential_ref=excluded.credential_ref, credential_scope=excluded.credential_scope, enabled=excluded.enabled, models_json=excluded.models_json, revision=media_workspace_connections.revision+1, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
  )
    .bind(
      scope.workspaceId,
      values.connectionId,
      values.label,
      values.host,
      values.installation,
      values.credentialRef,
      values.credentialScope,
      values.enabled ? 1 : 0,
      values.modelsJson,
      stamp,
      scope.actorId,
      stamp,
      scope.actorId,
    )
    .run();
}

async function recordEvent(env, scope, event, subject, detail) {
  await env.DB.prepare(
    "INSERT INTO media_scope_events (id, workspace_id, actor_id, actor_kind, event, subject, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      scope.workspaceId,
      scope.actorId,
      scope.kind,
      event,
      subject,
      detail === undefined ? null : JSON.stringify(detail),
      now(),
    )
    .run();
}

/* --------------------------------------------------------------- provider */

/** One MCP session: initialize once, then any number of bounded calls. A new
 * session per chunk trips the host's session rate limit, so imports reuse one. */
export async function openSession(env, { connection = null, timeoutMs = 180_000, fetcher } = {}) {
  const config = hostConfig(env, connection);
  if (!config.origin || !config.key)
    fail(
      "SETUP_REQUIRED",
      "The Oyster host address and owner key are not configured for this workspace on this deployment.",
      409,
    );
  if (!config.host)
    fail("SETUP_REQUIRED", "Connect the Oyster host before using this workspace.", 409);
  if (normaliseHost(config.origin) !== normaliseHost(config.host))
    fail(
      "HOST_MISMATCH",
      "This deployment's Oyster credentials are bound to a different host. Update the Worker secret before connecting this one.",
      409,
    );
  const origin = normaliseHost(config.host);
  const call = fetcher ?? fetch;
  const headers = {
    Authorization: "Bearer " + config.key,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-11-25",
  };
  const signal = AbortSignal.timeout(timeoutMs);
  let session = null;
  for (let attempt = 0; ; attempt += 1) {
    const init = await call(origin + "/mcp", {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "composer-media", version: "1.0.0" },
        },
      }),
    });
    if ((init.status === 429 || init.status >= 500) && attempt < 4) {
      await new Promise((done) => setTimeout(done, 1000 * 2 ** attempt));
      continue;
    }
    if (!init.ok)
      fail("HOST_UNAVAILABLE", "The Oyster host refused the connection (" + init.status + ")", 502);
    session = init.headers.get("mcp-session-id");
    readJsonRpcReply(await init.text(), 1);
    break;
  }
  const callHeaders = session ? { ...headers, "mcp-session-id": session } : headers;
  await call(origin + "/mcp", {
    method: "POST",
    headers: callHeaders,
    signal,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => {});
  let nextId = 2;
  return {
    async execute(code) {
      const id = nextId;
      nextId += 1;
      let response;
      for (let attempt = 0; ; attempt += 1) {
        response = await call(origin + "/mcp", {
          method: "POST",
          headers: callHeaders,
          signal,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            method: "tools/call",
            params: { name: "execute", arguments: { code } },
          }),
        });
        if (response.status !== 429 && response.status < 500) break;
        if (attempt >= 4) break;
        await new Promise((done) => setTimeout(done, 1000 * 2 ** attempt));
      }
      const text = await response.text();
      if (!response.ok)
        fail("HOST_UNAVAILABLE", "The Oyster host returned " + response.status, 502);
      return readExecuteReply(readJsonRpcReply(text, id));
    },
  };
}

/** One bounded call on its own session, using this workspace's connection. */
export async function oysterExecute(env, code, options) {
  const session = await openSession(env, options);
  return session.execute(code);
}

async function readModels(env, connection) {
  const reply = await oysterExecute(env, "return await env.PRINTS.listModels({});", { connection });
  const refusal = readRefusal(reply.payload);
  if (refusal) fail("CATALOGUE_REFUSED", refusal.message, 409);
  return readCatalogue(reply.payload, now());
}

/* ------------------------------------------------------------------ jobs */

async function readJobs(env, workspaceId, limit = jobLimit) {
  const rows = await requireDb(env)
    .prepare(
      "SELECT " + jobColumns + " FROM media_workspace_jobs WHERE workspace_id=? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(workspaceId, limit)
    .all();
  return (rows.results ?? []).map((row) => jobView(row));
}

/** One job in this scope. A row in another workspace is reported exactly like a
 * missing row: no id, prompt, state or workspace is echoed back. */
export async function readJob(env, scope, id) {
  if (typeof id !== "string" || !/^job_[a-z0-9]{21}$/.test(id))
    fail("JOB_NOT_FOUND", "That generation is not recorded in this workspace", 404);
  const row = await requireDb(env)
    .prepare("SELECT " + jobColumns + " FROM media_workspace_jobs WHERE id=? AND workspace_id=?")
    .bind(id, scope.workspaceId)
    .first();
  if (!row) fail("JOB_NOT_FOUND", "That generation is not recorded in this workspace", 404);
  return row;
}

async function updateJob(env, scope, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const assignments = keys.map((key) => key + "=?").join(", ");
  await env.DB.prepare(
    "UPDATE media_workspace_jobs SET " + assignments + " WHERE id=? AND workspace_id=?",
  )
    .bind(
      ...keys.map((key) => fields[key]),
      id,
      scope.workspaceId,
    )
    .run();
}

async function applyReply(env, scope, id, payload) {
  const stamp = now();
  const pending = payload && typeof payload === "object" && payload.retryAfterMs;
  if (pending) {
    const retryAfterMs = Number(pending.retryAfterMs) || 0;
    await updateJob(env, scope, id, {
      state: "pending",
      output_json: JSON.stringify(pending),
      error_code: null,
      updated_at: stamp,
    });
    return { job: jobView(await readJob(env, scope, id)), retryAfterMs };
  }
  const refusal = readRefusal(payload);
  if (refusal) {
    await updateJob(env, scope, id, {
      state: "refused",
      error_code: refusal.code,
      output_json: JSON.stringify(payload),
      updated_at: stamp,
    });
    return { job: jobView(await readJob(env, scope, id)), refusal };
  }
  await updateJob(env, scope, id, {
    state: "completed",
    output_json: JSON.stringify(payload),
    error_code: null,
    updated_at: stamp,
  });
  return { job: jobView(await readJob(env, scope, id)) };
}

/* --------------------------------------------------------------- actions */

export async function statusSnapshot(env, scope) {
  requireAction(scope, "read");
  // Every read rechecks the same authority. A revoked grant or removed
  // membership stops a status call as well as a dispatch.
  await assertScopeCurrent(env, scope, "read");
  const connection = await currentConnection(env, scope.workspaceId);
  const jobs = await readJobs(env, scope.workspaceId);
  let agents;
  let agentConfigured;
  if (scope.admin) {
    const rows =
      (
        await requireDb(env)
          .prepare(
            "SELECT " + agentGrantColumns + " FROM media_agent_grants WHERE workspace_id=? ORDER BY created_at DESC LIMIT 12",
          )
          .bind(scope.workspaceId)
          .all()
      ).results ?? [];
    agents = rows.map((row) => ({
      id: row.id,
      label: row.label,
      actions: parseActions(row.actions_json),
      status: row.status,
      revision: row.revision,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at ?? null,
    }));
    agentConfigured = agents.some((grant) => grant.status === "active");
  } else {
    const row = await requireDb(env)
      .prepare(
        "SELECT id FROM media_agent_grants WHERE workspace_id=? AND status='active' LIMIT 1",
      )
      .bind(scope.workspaceId)
      .first();
    agentConfigured = Boolean(row);
  }
  const config = hostConfig(env, connection);
  return {
    version: mediaCapabilityVersion,
    id: mediaCapabilityId,
    name: mediaCapabilityName,
    purpose: mediaCapabilityPurpose,
    workspace: { id: scope.workspaceId, name: scope.workspaceName },
    actor: {
      kind: scope.kind,
      id: scope.actorId,
      role: scope.role,
      admin: Boolean(scope.admin),
    },
    actions: scope.actions,
    enabled: connectionEligible(connection),
    host: connection?.host ?? "",
    installation: connection?.installation ?? "prints",
    catalogue: connection?.catalogue ?? null,
    checkedAt: connection?.catalogue?.checkedAt ?? null,
    updatedAt: connection?.configuredAt ?? null,
    updatedBy: connection?.updatedBy ?? null,
    configured: Boolean(config.origin && config.key),
    agentConfigured,
    legacyAgentTokenConfigured: Boolean(secret(env, "MEDIA_AGENT_TOKEN")),
    connection: connection
      ? {
          id: connection.id,
          label: connection.label,
          host: connection.host,
          installation: connection.installation,
          credentialRef: connection.credentialRef,
          credentialScope: connection.credentialScope,
          revision: connection.revision,
          enabled: connection.enabled,
        }
      : null,
    jobs,
    agents,
    notes: {
      enable: enableNote,
      disable: disableNote,
      custody: custodyNote,
      agent: agentNote,
    },
  };
}

export async function enableCapability(env, scope, input = {}) {
  requireAdmin(scope, "enable");
  const current = await currentConnection(env, scope.workspaceId);
  const deployment = hostConfig(env);
  const requestedHost = input?.host ? normaliseHost(input.host) : "";
  const host = requestedHost || current?.host || (deployment.origin ? normaliseHost(deployment.origin) : "");
  if (!host) fail("INVALID_HOST", "Enter the authorised Oyster host address");
  const credentialRef = input?.credentialRef
    ? readCredentialRef(input.credentialRef)
    : current?.credentialRef ?? "OYSTER";
  const credentialScope = credentialRef === "OYSTER" ? "deployment-legacy" : "workspace";
  const installation = current?.installation ?? deployment.installation;
  // Bounded owner-only transition: the one deployment-wide credential may back
  // one workspace at a time. A second workspace must bring its own
  // OYSTER_CONNECTION_<NAME> secrets, so two workspaces never share one key by
  // accident.
  if (credentialScope === "deployment-legacy") {
    const other = await requireDb(env)
      .prepare(
        "SELECT workspace_id FROM media_workspace_connections WHERE credential_scope='deployment-legacy' AND workspace_id<>? LIMIT 1",
      )
      .bind(scope.workspaceId)
      .first();
    if (other)
      fail(
        "LEGACY_SCOPE_TAKEN",
        "The deployment-wide Oyster credential is already bound to another workspace. Connect this workspace with OYSTER_CONNECTION_<NAME> and its own Worker secrets.",
        409,
      );
  }
  const candidate = { host, credentialRef, installation };
  const config = hostConfig(env, candidate);
  if (!config.origin || !config.key)
    fail(
      "SETUP_REQUIRED",
      "Add " + credentialRef + "_ORIGIN and " + credentialRef + "_OWNER_KEY to this deployment, then enable again.",
      409,
    );
  if (normaliseHost(config.origin) !== host)
    fail(
      "HOST_MISMATCH",
      "This deployment is configured for a different Oyster host. Update the Worker secret first, or connect that host.",
      409,
    );
  let catalogue;
  try {
    catalogue = await readModels(env, candidate);
  } catch (error) {
    if (error instanceof MediaContractError && error.code === "SETUP_REQUIRED")
      fail(
        "SETUP_REQUIRED",
        "Add the Oyster host address and owner key to this deployment, then enable again.",
        409,
      );
    throw error;
  }
  const connectionId = current?.id ?? (await connectionIdFor(scope.workspaceId));
  await writeConnection(env, scope, {
    connectionId,
    label: (typeof input?.label === "string" && input.label.trim().slice(0, 60)) || current?.label || "Oyster",
    host,
    installation,
    credentialRef,
    credentialScope,
    enabled: true,
    modelsJson: JSON.stringify(catalogue),
  });
  await recordEvent(env, scope, "enable", connectionId, { host, credentialRef });
  return statusSnapshot(env, scope);
}

export async function disableCapability(env, scope) {
  requireAdmin(scope, "disable");
  const current = await currentConnection(env, scope.workspaceId);
  // Disabling is a local switch. It never calls the host and never deletes
  // owned media; a workspace with no connection is already off.
  if (current) {
    const row = await requireDb(env)
      .prepare("SELECT models_json FROM media_workspace_connections WHERE workspace_id=?")
      .bind(scope.workspaceId)
      .first();
    await writeConnection(env, scope, {
      connectionId: current.id,
      label: current.label,
      host: current.host,
      installation: current.installation,
      credentialRef: current.credentialRef,
      credentialScope: current.credentialScope,
      enabled: false,
      modelsJson: row?.models_json ?? null,
    });
    await recordEvent(env, scope, "disable", current.id, { host: current.host });
  }
  return statusSnapshot(env, scope);
}

export async function refreshCatalogue(env, scope) {
  requireAdmin(scope, "refresh");
  const current = await currentConnection(env, scope.workspaceId);
  if (!current || !current.host)
    fail("SETUP_REQUIRED", "Connect this workspace's Oyster host before refreshing models", 409);
  const catalogue = await readModels(env, current);
  await writeConnection(env, scope, {
    connectionId: current.id,
    label: current.label,
    host: current.host,
    installation: current.installation,
    credentialRef: current.credentialRef,
    credentialScope: current.credentialScope,
    enabled: current.enabled,
    modelsJson: JSON.stringify(catalogue),
  });
  await recordEvent(env, scope, "refresh", current.id, { models: catalogue.models.length });
  return statusSnapshot(env, scope);
}

export async function submitGeneration(env, scope, input = {}) {
  requireAction(scope, "generate");
  const connection = await currentConnection(env, scope.workspaceId);
  if (!connection)
    fail("SETUP_REQUIRED", "Connect this workspace's Oyster host before generating.", 409);
  if (!connectionEligible(connection))
    fail(
      "DISABLED",
      "Images & video is off for this workspace. Turn it on in Features before generating; existing media is kept.",
      409,
    );
  if (!connection.catalogue)
    fail("SETUP_REQUIRED", "Refresh the model catalogue before generating", 409);
  const request = readGeneration(input, connection.catalogue);
  const model = connection.catalogue.models.find((entry) => entry.id === request.model);
  if (!model) fail("UNKNOWN_MODEL", "That model is no longer in the catalogue", 409);
  const id = await jobIdFor(scope.workspaceId, request.requestId);
  const cost = estimateCostMilliunits(request, model);
  const stamp = now();
  const settings = {
    model: request.model,
    prompt: request.prompt,
    width: request.width,
    height: request.height,
    ...(request.durationSeconds ? { durationSeconds: request.durationSeconds } : {}),
    ...(request.resolution ? { resolution: request.resolution } : {}),
    ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
    ...(request.referencePath ? { reference: request.referencePath } : {}),
  };
  // Intent first: a lost reply leaves a recoverable row rather than a silent
  // charge. The unique provider request id is the concurrency and replay guard.
  let inserted = true;
  try {
    await requireDb(env)
      .prepare(
        "INSERT INTO media_workspace_jobs (id, workspace_id, scope, connection_id, connection_revision, request_id, kind, state, prompt, model, settings_json, reference_path, cost_milliunits, created_at, updated_at, created_by) VALUES (?, ?, 'workspace', ?, ?, ?, ?, 'intent', ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        scope.workspaceId,
        connection.id,
        connection.revision,
        request.requestId,
        request.kind,
        request.prompt,
        request.model,
        JSON.stringify(settings),
        request.referencePath,
        cost,
        stamp,
        stamp,
        scope.actorId,
      )
      .run();
  } catch (error) {
    if (!uniqueViolation(error)) throw error;
    inserted = false;
  }
  if (!inserted) {
    // A replayed request id inside this scope returns the recorded job and
    // never calls the provider again. The same id in another scope fails
    // closed without naming the other workspace or its job.
    const existing = await requireDb(env)
      .prepare("SELECT " + jobColumns + " FROM media_workspace_jobs WHERE request_id=?")
      .bind(request.requestId)
      .first();
    if (existing && existing.workspace_id === scope.workspaceId)
      return { job: jobView(existing), replayed: true, providerCalled: false };
    fail(
      "SCOPE_CONFLICT",
      "That generation could not be recorded in this workspace. Start a new generation.",
      409,
    );
  }
  try {
    await assertScopeCurrent(env, scope, "generate");
    await assertConnectionCurrent(env, scope.workspaceId, connection);
  } catch (error) {
    await updateJob(env, scope, id, {
      state: "refused",
      error_code: error instanceof MediaContractError ? error.code : "REVOKED",
      updated_at: now(),
    });
    throw error;
  }
  const code = request.kind === "video" ? generateVideoCode(request) : generateImageCode(request);
  let reply;
  try {
    reply = await oysterExecute(env, code, { connection });
  } catch (error) {
    // The request may already be running at the host. Record the uncertainty
    // and return it; a second automatic call could buy a second generation.
    await updateJob(env, scope, id, {
      state: "unknown",
      error_code: error instanceof MediaContractError ? error.code : "HOST_UNAVAILABLE",
      updated_at: now(),
    });
    return {
      job: jobView(await readJob(env, scope, id)),
      unknown: true,
      providerCalled: true,
      retryable: false,
    };
  }
  return { ...(await applyReply(env, scope, id, reply.payload)), providerCalled: true };
}

/** Re-read the same request identity: image generation is replay-safe, and a
 * pending video continues from its provider identity without a new charge.
 * An unknown outcome stays unknown until this explicit reopen. */
export async function reconcileJob(env, scope, id) {
  requireAction(scope, "read");
  await assertScopeCurrent(env, scope, "read");
  const row = await readJob(env, scope, id);
  if (row.state === "completed" || row.imported_key) return { job: jobView(row) };
  requireAction(scope, "generate");
  const connection = await currentConnection(env, scope.workspaceId);
  if (!connection)
    fail("SETUP_REQUIRED", "This workspace has no media connection.", 409);
  if (!connectionEligible(connection))
    fail("DISABLED", "Reopening a finished job is allowed; new work is off for this workspace.", 409);
  if (row.connection_id && connection.id !== row.connection_id)
    fail(
      "CONNECTION_CHANGED",
      "This job was sent through a different connection. Keep its recorded result, or start a new generation.",
      409,
    );
  const settings = parseJson(row.settings_json, {});
  const request = {
    requestId: row.request_id,
    kind: row.kind,
    model: row.model,
    prompt: row.prompt,
    width: settings.width,
    height: settings.height,
    durationSeconds: settings.durationSeconds,
    resolution: settings.resolution,
    aspectRatio: settings.aspectRatio,
    referencePath: row.reference_path,
  };
  await assertScopeCurrent(env, scope, "generate");
  await assertConnectionCurrent(env, scope.workspaceId, connection);
  const code = row.kind === "video" ? generateVideoCode(request) : generateImageCode(request);
  let reply;
  try {
    reply = await oysterExecute(env, code, { connection });
  } catch (error) {
    await updateJob(env, scope, id, {
      state: "unknown",
      error_code: error instanceof MediaContractError ? error.code : "HOST_UNAVAILABLE",
      updated_at: now(),
    });
    return { job: jobView(await readJob(env, scope, id)), unknown: true, providerCalled: true };
  }
  return { ...(await applyReply(env, scope, id, reply.payload)), providerCalled: true };
}

async function openOutput(env, connection, printId, path, maxBytes = 16 * 1024 * 1024) {
  const chunks = [];
  let offset = 0;
  let done = false;
  const session = await openSession(env, { connection });
  for (let round = 0; round < 40 && !done; round += 1) {
    // One 128 KiB slice per sandbox call: a large result is a sequence of
    // bounded reads, not a session storm the host has to rate-limit.
    const code = [
      "const parts = [];",
      "let offset = " + offset + ";",
      "let done = false;",
      "for (let index = 0; index < 1; index += 1) {",
      "  const part = await env.PRINTS.openOutput({ printId: " +
        JSON.stringify(printId) +
        ", byteOffset: offset, byteLength: 131072 });",
      "  if (part && part.error) return part;",
      "  const size = String(part.content || '').length ? atob(part.content).length : 0;",
      "  parts.push({ offset, size, content: part.content });",
      "  offset += size;",
      "  if (part.truncated !== true) { done = true; break; }",
      "}",
      "return { parts, done };",
    ].join("\n");
    const reply = await session.execute(code);
    const refusal = readRefusal(reply.payload);
    if (refusal) fail("OUTPUT_REFUSED", refusal.message, 502);
    const page = reply.payload;
    if (!page || !Array.isArray(page.parts) || !page.parts.length)
      fail("OUTPUT_UNREADABLE", "The host returned no output bytes", 502);
    for (const part of page.parts) {
      if (typeof part.content !== "string")
        fail("OUTPUT_UNREADABLE", "The host returned unreadable output bytes", 502);
      if (!part.content) continue;
      const binary = atob(part.content);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      chunks.push(bytes);
      offset = Number(part.offset) + bytes.length;
    }
    if (offset > maxBytes)
      fail("OUTPUT_TOO_LARGE", "The result is larger than this import allows", 413);
    done = page.done === true;
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    merged.set(chunk, position);
    position += chunk.length;
  }
  return { bytes: merged, path };
}

/** Import the owned result into the app's own R2 so the public page and the
 * library do not depend on the host's container being awake. The object is
 * written only from this workspace's job row. */
export async function importJob(env, scope, id) {
  requireAction(scope, "edit");
  await assertScopeCurrent(env, scope, "edit");
  const row = await readJob(env, scope, id);
  if (row.imported_key) return { job: jobView(row), imported: true, alreadyPresent: true };
  const output = parseJson(row.output_json, null);
  if (!output || typeof output !== "object" || !output.destination?.path)
    fail("NOT_READY", "This generation has no saved result to import yet", 409);
  const connection = await currentConnection(env, scope.workspaceId);
  if (!connectionEligible(connection))
    fail(
      "REVOKED",
      "This workspace's media connection is switched off, so the retained result cannot be re-read.",
      409,
    );
  if (row.connection_id && row.connection_id !== connection.id)
    fail(
      "CONNECTION_CHANGED",
      "This job was sent through a different connection. Its result stays as provenance.",
      409,
    );
  const format = typeof output.format === "string" ? output.format : "bin";
  const extension = format === "jpeg" ? "jpg" : format;
  const key = "media-studio/" + row.id + "." + extension;
  const { bytes } = await openOutput(env, connection, row.request_id, output.destination.path);
  if (!bytes.length) fail("OUTPUT_UNREADABLE", "The host returned no bytes", 502);
  const contentType =
    row.kind === "video"
      ? "video/mp4"
      : format === "png"
        ? "image/png"
        : format === "webp"
          ? "image/webp"
          : "image/jpeg";
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: {
      source: "oyster-prints",
      installation: connection.installation,
      workspace: scope.workspaceId,
      requestId: row.request_id,
      model: row.model,
      prompt: row.prompt.slice(0, 900),
    },
  });
  const hash = await sha256Hex(bytes);
  await updateJob(env, scope, id, {
    imported_key: key,
    imported_sha256: hash,
    imported_bytes: bytes.length,
    imported_format: extension,
    updated_at: now(),
  });
  return {
    job: jobView(await readJob(env, scope, id)),
    imported: true,
    bytes: bytes.length,
    sha256: hash,
    url: "/media-studio/asset/" + encodeURIComponent(key.split("/").pop()),
  };
}

/** Owner custody for media rows whose workspace cannot be proven. Read-only:
 * the legacy deployment-wide capability row is shown as evidence, never reused
 * as authority. */
export async function custodySnapshot(env, scope) {
  if (scope.kind !== "human" || !scope.platformAdmin)
    fail("FORBIDDEN", "Owner custody is visible to the deployment owner only.", 403);
  const db = requireDb(env);
  const rows =
    (
      await db
        .prepare(
          "SELECT " + jobColumns + " FROM media_workspace_jobs WHERE scope='custody' ORDER BY created_at DESC LIMIT ?",
        )
        .bind(custodyLimit)
        .all()
    ).results ?? [];
  const legacy = await db
    .prepare(
      "SELECT enabled, host, installation, updated_at, updated_by FROM media_capability WHERE id = 1",
    )
    .first();
  return {
    scope: mediaCustodyScope,
    note: custodyNote,
    jobs: rows.map((row) => jobView(row)),
    legacyCapability: legacy
      ? {
          enabled: Number(legacy.enabled) === 1,
          host: typeof legacy.host === "string" ? legacy.host : "",
          installation: typeof legacy.installation === "string" ? legacy.installation : "prints",
          updatedAt: typeof legacy.updated_at === "string" ? legacy.updated_at : null,
          updatedBy: typeof legacy.updated_by === "string" ? legacy.updated_by : null,
        }
      : null,
  };
}

/** The only provable ownership path for a legacy row: the deployment owner
 * declares it, and the previous scope, actor and time stay on the record. No
 * provider call is made. */
export async function adoptJob(env, scope, id) {
  requireAdmin(scope, "adopt");
  if (typeof id !== "string" || !/^job_[a-z0-9]{21}$/.test(id))
    fail("JOB_NOT_FOUND", "That generation is not in owner custody", 404);
  const row = await requireDb(env)
    .prepare("SELECT " + jobColumns + " FROM media_workspace_jobs WHERE id=? AND scope='custody'")
    .bind(id)
    .first();
  if (!row) fail("JOB_NOT_FOUND", "That generation is not in owner custody", 404);
  const stamp = now();
  const result = await requireDb(env)
    .prepare(
      "UPDATE media_workspace_jobs SET workspace_id=?, scope='workspace', adopted_from=?, adopted_at=?, adopted_by=?, updated_at=? WHERE id=? AND scope='custody'",
    )
    .bind(
      scope.workspaceId,
      row.workspace_id,
      stamp,
      scope.actorId,
      stamp,
      row.id,
    )
    .run();
  if (Number(result?.meta?.changes ?? 0) !== 1)
    fail("CONFLICT", "That job changed while it was being adopted. Reopen it.", 409);
  await recordEvent(env, scope, "adopt-custody", row.id, {
    from: row.workspace_id,
    requestId: row.request_id,
    imported: Boolean(row.imported_key),
  });
  return { job: jobView(await readJob(env, scope, row.id)), adoptedFrom: row.workspace_id };
}

/* ---------------------------------------------------------- agent grants */

function readLabel(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") fail("INVALID_LABEL", "Name the agent you are admitting");
  const label = value.trim();
  if (label.length < 2 || label.length > 60 || /[\u0000-\u001f\u007f]/.test(label))
    fail("INVALID_LABEL", "Keep the agent name between 2 and 60 characters");
  return label;
}

function readAgentPermissions(value) {
  if (value === undefined || value === null) return ["read"];
  if (!Array.isArray(value) || !value.length)
    fail("INVALID_ACTIONS", "Choose the permissions for this agent");
  const unique = [...new Set(value)];
  for (const entry of unique)
    if (typeof entry !== "string" || !mediaAgentPermissions.includes(entry))
      fail(
        "INVALID_ACTIONS",
        "An agent grant may include only " + mediaAgentPermissions.join(", "),
      );
  return mediaAgentPermissions.filter((permission) => unique.includes(permission));
}

function readExpiry(value) {
  const days = value === undefined || value === null ? 30 : Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365)
    fail("INVALID_EXPIRY", "Choose an expiry between 1 and 365 days");
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function agentGrantView(row) {
  return {
    id: row.id,
    label: row.label,
    actions: parseActions(row.actions_json),
    status: row.status,
    revision: row.revision,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at ?? null,
  };
}

export async function grantAgent(env, scope, input = {}) {
  requireAdmin(scope, "grant-agent");
  const label = readLabel(input?.label, "Authorised agent");
  const actions = readAgentPermissions(input?.actions);
  const expiresAt = readExpiry(input?.expiresInDays);
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token =
    "media_agent_" +
    btoa(String.fromCharCode(...raw)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const digest = await sha256Hex(new TextEncoder().encode(token));
  const id = "grant_" + crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const stamp = now();
  await requireDb(env)
    .prepare(
      "INSERT INTO media_agent_grants (id, workspace_id, label, token_sha256, actions_json, status, revision, expires_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)",
    )
    .bind(id, scope.workspaceId, label, digest, JSON.stringify(actions), expiresAt, stamp, scope.actorId)
    .run();
  await recordEvent(env, scope, "grant-agent", id, { actions, expiresAt });
  // Shown once. D1 stores only the SHA-256 of this value.
  return {
    grant: agentGrantView({
      id,
      label,
      actions_json: JSON.stringify(actions),
      status: "active",
      revision: 1,
      expires_at: expiresAt,
      created_at: stamp,
    }),
    token,
    note: agentNote,
  };
}

export async function revokeAgent(env, scope, input = {}) {
  requireAdmin(scope, "revoke-agent");
  const id = typeof input?.id === "string" ? input.id : "";
  if (!/^grant_[a-z0-9]{8,32}$/.test(id))
    fail("GRANT_NOT_FOUND", "That agent grant is not recorded in this workspace", 404);
  const stamp = now();
  const result = await requireDb(env)
    .prepare(
      "UPDATE media_agent_grants SET status='revoked', revoked_at=?, revoked_by=?, revision=revision+1 WHERE id=? AND workspace_id=? AND status='active'",
    )
    .bind(stamp, scope.actorId, id, scope.workspaceId)
    .run();
  if (Number(result?.meta?.changes ?? 0) !== 1)
    fail("GRANT_NOT_FOUND", "That agent grant is not recorded in this workspace", 404);
  await recordEvent(env, scope, "revoke-agent", id, {});
  return { id, status: "revoked", revokedAt: stamp };
}

/* ----------------------------------------------------------------- router */

export async function runAction(env, action, scope, input = {}) {
  if (!scope || typeof scope !== "object" || typeof scope.workspaceId !== "string")
    fail("FORBIDDEN", "A current workspace is required for media actions.", 403);
  if (scope.kind === "agent" && !mediaAgentActions.includes(action))
    fail(
      "FORBIDDEN",
      "An agent cannot administer media connections, agent grants or owner custody.",
      403,
    );
  switch (action) {
    case "enable":
      return enableCapability(env, scope, input);
    case "disable":
      return disableCapability(env, scope);
    case "refresh":
      return refreshCatalogue(env, scope);
    case "generate":
      return submitGeneration(env, scope, input);
    case "reconcile":
      return reconcileJob(env, scope, String(input?.id ?? ""));
    case "import":
      return importJob(env, scope, String(input?.id ?? ""));
    case "status":
      return statusSnapshot(env, scope);
    case "custody":
      return custodySnapshot(env, scope);
    case "adopt":
      return adoptJob(env, scope, String(input?.id ?? ""));
    case "grant-agent":
      return grantAgent(env, scope, input);
    case "revoke-agent":
      return revokeAgent(env, scope, input);
    default:
      fail("UNKNOWN_ACTION", "That media action is not supported", 404);
  }
}

export { readReferencePath, newRequestId, formatCost };

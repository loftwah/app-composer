// Runtime side of the Media capability. Every caller — native EmDash pages and
// the agent route — reaches the same handlers, the same D1 rows and the same
// Oyster/Prints calls. Authorisation is decided by the caller before this module
// runs; nothing here trusts a request body for identity.
import {
  MediaContractError,
  disableNote,
  enableNote,
  estimateCostMilliunits,
  formatCost,
  generateImageCode,
  generateVideoCode,
  jobView,
  mediaCapabilityId,
  mediaCapabilityName,
  mediaCapabilityPurpose,
  mediaCapabilityVersion,
  newRequestId,
  normaliseHost,
  readCatalogue,
  readExecuteReply,
  readGeneration,
  readJsonRpcReply,
  readReferencePath,
  readRefusal,
  readStatusRow,
} from "./media-capability.mjs";

const statusSql =
  "SELECT enabled, host, installation, models_json, updated_at, updated_by FROM media_capability WHERE id = 1";
const jobColumns =
  "id, request_id, kind, state, prompt, model, settings_json, reference_path, cost_milliunits, output_json, error_code, created_at, updated_at, imported_key, imported_sha256, imported_bytes, imported_format, created_by";

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

export function hostConfig(env) {
  return {
    origin: secret(env, "OYSTER_ORIGIN"),
    key: secret(env, "OYSTER_OWNER_KEY"),
    installation: secret(env, "OYSTER_MEDIA_INSTALLATION") || "prints",
  };
}

/** One MCP session per call: initialize, then tools/call. The host keeps no
 * client state that this plugin needs between requests. */
export async function oysterExecute(env, code, { timeoutMs = 180_000, fetcher } = {}) {
  const { origin, key } = hostConfig(env);
  if (!origin || !key)
    fail(
      "SETUP_REQUIRED",
      "The Oyster host address and owner key are not configured on this deployment.",
      409,
    );
  const call = fetcher ?? fetch;
  const headers = {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-11-25",
  };
  const signal = AbortSignal.timeout(timeoutMs);
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
  if (!init.ok) fail("HOST_UNAVAILABLE", "The Oyster host refused the connection (" + init.status + ")", 502);
  const session = init.headers.get("mcp-session-id");
  readJsonRpcReply(await init.text(), 1);
  const callHeaders = session ? { ...headers, "mcp-session-id": session } : headers;
  await call(origin + "/mcp", {
    method: "POST",
    headers: callHeaders,
    signal,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => {});
  let response;
  for (let attempt = 0; ; attempt += 1) {
    response = await call(origin + "/mcp", {
      method: "POST",
      headers: callHeaders,
      signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "execute", arguments: { code } },
      }),
    });
    if (response.status !== 429 && response.status < 500) break;
    if (attempt >= 4) break;
    await new Promise((done) => setTimeout(done, 1000 * 2 ** attempt));
  }
  const text = await response.text();
  if (!response.ok) fail("HOST_UNAVAILABLE", "The Oyster host returned " + response.status, 502);
  const result = readJsonRpcReply(text, 2);
  return readExecuteReply(result);
}

async function readModels(env) {
  const reply = await oysterExecute(env, "return await env.PRINTS.listModels({});");
  const refusal = readRefusal(reply.payload);
  if (refusal) fail("CATALOGUE_REFUSED", refusal.message, 409);
  return readCatalogue(reply.payload, now());
}

async function readStatus(env) {
  const row = await env.DB.prepare(statusSql).first();
  return readStatusRow(row);
}

async function writeStatus(env, { enabled, host, installation, catalogue, by }) {
  const stamp = now();
  await env.DB.prepare(
    "INSERT INTO media_capability (id, enabled, host, installation, models_json, updated_at, updated_by) VALUES (1, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled, host=excluded.host, installation=excluded.installation, models_json=excluded.models_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
  )
    .bind(
      enabled ? 1 : 0,
      host,
      installation,
      catalogue ? JSON.stringify(catalogue) : null,
      stamp,
      by,
    )
    .run();
}

async function readJobs(env, limit = 12) {
  const rows = await env.DB.prepare(
    "SELECT " + jobColumns + " FROM media_jobs ORDER BY created_at DESC LIMIT ?",
  )
    .bind(limit)
    .all();
  return (rows.results ?? []).map((row) => jobView(row));
}

async function readJob(env, id) {
  const row = await env.DB.prepare("SELECT " + jobColumns + " FROM media_jobs WHERE id = ?")
    .bind(id)
    .first();
  if (!row) fail("JOB_NOT_FOUND", "That generation is not recorded here", 404);
  return row;
}

export async function statusSnapshot(env) {
  const status = await readStatus(env);
  const jobs = await readJobs(env);
  return {
    version: mediaCapabilityVersion,
    id: mediaCapabilityId,
    name: mediaCapabilityName,
    purpose: mediaCapabilityPurpose,
    enabled: status.enabled,
    host: status.host,
    installation: status.installation,
    catalogue: status.catalogue,
    checkedAt: status.catalogue?.checkedAt ?? null,
    updatedAt: status.configuredAt,
    updatedBy: status.updatedBy,
    configured: Boolean(hostConfig(env).origin && hostConfig(env).key),
    agentConfigured: Boolean(secret(env, "MEDIA_AGENT_TOKEN")),
    jobs,
    notes: { enable: enableNote, disable: disableNote },
  };
}

export async function enableCapability(env, input, by) {
  const current = await readStatus(env);
  const configured = hostConfig(env).origin;
  const host = input?.host
    ? normaliseHost(input.host)
    : current.host
      ? current.host
      : configured
        ? normaliseHost(configured)
        : "";
  if (!host) fail("INVALID_HOST", "Enter the authorised Oyster host address");
  const { origin } = hostConfig(env);
  if (origin && normaliseHost(origin) !== host)
    fail(
      "HOST_MISMATCH",
      "This deployment is configured for a different Oyster host. Update the deployment secret first.",
      409,
    );
  let catalogue;
  try {
    catalogue = await readModels(env);
  } catch (error) {
    if (error instanceof MediaContractError && error.code === "SETUP_REQUIRED")
      fail(
        "SETUP_REQUIRED",
        "Add OYSTER_ORIGIN and OYSTER_OWNER_KEY to this deployment, then enable again.",
        409,
      );
    throw error;
  }
  await writeStatus(env, {
    enabled: true,
    host,
    installation: current.installation,
    catalogue,
    by,
  });
  return statusSnapshot(env);
}

export async function disableCapability(env, by) {
  const current = await readStatus(env);
  await writeStatus(env, {
    enabled: false,
    host: current.host,
    installation: current.installation,
    catalogue: current.catalogue,
    by,
  });
  return statusSnapshot(env);
}

export async function refreshCatalogue(env, by) {
  const current = await readStatus(env);
  if (!current.host) fail("SETUP_REQUIRED", "Enable the capability before refreshing models", 409);
  const catalogue = await readModels(env);
  await writeStatus(env, {
    enabled: current.enabled,
    host: current.host,
    installation: current.installation,
    catalogue,
    by,
  });
  return statusSnapshot(env);
}

export async function submitGeneration(env, input, by) {
  const status = await readStatus(env);
  if (!status.enabled)
    fail(
      "DISABLED",
      "Images & video is off. Turn it on in Features before generating; existing media is kept.",
      409,
    );
  if (!status.catalogue) fail("SETUP_REQUIRED", "Refresh the model catalogue before generating", 409);
  const request = readGeneration(input, status.catalogue);
  const model = status.catalogue.models.find((entry) => entry.id === request.model);
  if (!model) fail("UNKNOWN_MODEL", "That model is no longer in the catalogue", 409);
  const id = "job_" + request.requestId.slice("media_request_".length);
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
  // Intent first: a lost reply leaves a recoverable row rather than a silent charge.
  await env.DB.prepare(
    "INSERT INTO media_jobs (id, request_id, kind, state, prompt, model, settings_json, reference_path, cost_milliunits, created_at, updated_at, created_by) VALUES (?, ?, ?, 'intent', ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      request.requestId,
      request.kind,
      request.prompt,
      request.model,
      JSON.stringify(settings),
      request.referencePath,
      cost,
      stamp,
      stamp,
      by,
    )
    .run();
  const code = request.kind === "video" ? generateVideoCode(request) : generateImageCode(request);
  let reply;
  try {
    reply = await oysterExecute(env, code);
  } catch (error) {
    await env.DB.prepare(
      "UPDATE media_jobs SET state='unknown', error_code=?, updated_at=? WHERE id=?",
    )
      .bind(error instanceof MediaContractError ? error.code : "HOST_UNAVAILABLE", now(), id)
      .run();
    throw error;
  }
  return applyReply(env, id, reply.payload);
}

async function applyReply(env, id, payload) {
  const stamp = now();
  const pending = payload && typeof payload === "object" && payload.retryAfterMs;
  if (pending) {
    const retryAfterMs = Number(pending.retryAfterMs) || 0;
    await env.DB.prepare(
      "UPDATE media_jobs SET state='pending', output_json=?, error_code=NULL, updated_at=? WHERE id=?",
    )
      .bind(JSON.stringify(pending), stamp, id)
      .run();
    return { job: jobView(await readJob(env, id)), retryAfterMs };
  }
  const refusal = readRefusal(payload);
  if (refusal) {
    await env.DB.prepare(
      "UPDATE media_jobs SET state='refused', error_code=?, output_json=?, updated_at=? WHERE id=?",
    )
      .bind(refusal.code, JSON.stringify(payload), stamp, id)
      .run();
    return { job: jobView(await readJob(env, id)), refusal };
  }
  await env.DB.prepare(
    "UPDATE media_jobs SET state='completed', output_json=?, error_code=NULL, updated_at=? WHERE id=?",
  )
    .bind(JSON.stringify(payload), stamp, id)
    .run();
  return { job: jobView(await readJob(env, id)) };
}

/** Re-read the same request identity: image generation is replay-safe, and a
 * pending video continues from its provider identity without a new charge. */
export async function reconcileJob(env, id) {
  const row = await readJob(env, id);
  if (row.state === "completed" || row.imported_key) return { job: jobView(row) };
  const status = await readStatus(env);
  if (!status.enabled && row.state !== "pending")
    fail("DISABLED", "Reopening a finished job is allowed; new work is off.", 409);
  let settings = {};
  try {
    settings = JSON.parse(row.settings_json);
  } catch {}
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
  const code = row.kind === "video" ? generateVideoCode(request) : generateImageCode(request);
  const reply = await oysterExecute(env, code);
  return applyReply(env, id, reply.payload);
}

async function openOutput(env, printId, path, maxBytes = 16 * 1024 * 1024) {
  const chunks = [];
  let offset = 0;
  let done = false;
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
      "  const size = atob(part.content).length;",
      "  parts.push({ offset, size, content: part.content });",
      "  offset += size;",
      "  if (part.truncated !== true) { done = true; break; }",
      "}",
      "return { parts, done };",
    ].join("\n");
    const reply = await oysterExecute(env, code);
    const refusal = readRefusal(reply.payload);
    if (refusal) fail("OUTPUT_REFUSED", refusal.message, 502);
    const page = reply.payload;
    if (!page || !Array.isArray(page.parts) || !page.parts.length)
      fail("OUTPUT_UNREADABLE", "The host returned no output bytes", 502);
    for (const part of page.parts) {
      if (typeof part.content !== "string" || !part.content)
        fail("OUTPUT_UNREADABLE", "The host returned empty output bytes", 502);
      const binary = atob(part.content);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      chunks.push(bytes);
      offset = Number(part.offset) + bytes.length;
    }
    if (offset > maxBytes)
      fail("OUTPUT_TOO_LARGE", "The result is larger than this import allows", 413);
    done = page.done === true;
    if (!done) await new Promise((settle) => setTimeout(settle, 200));
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

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Import the owned result into the app's own R2 so the public page and the
 * library do not depend on the host's container being awake. */
export async function importJob(env, id) {
  const row = await readJob(env, id);
  if (row.imported_key)
    return { job: jobView(row), imported: true, alreadyPresent: true };
  let output = null;
  try {
    output = row.output_json ? JSON.parse(row.output_json) : null;
  } catch {}
  if (!output || typeof output !== "object" || !output.destination?.path)
    fail("NOT_READY", "This generation has no saved result to import yet", 409);
  const format = typeof output.format === "string" ? output.format : "bin";
  const extension = format === "jpeg" ? "jpg" : format;
  const key = "media-studio/" + row.id + "." + extension;
  const { bytes } = await openOutput(env, row.request_id, output.destination.path);
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
      installation: "prints",
      requestId: row.request_id,
      model: row.model,
      prompt: row.prompt.slice(0, 900),
    },
  });
  const hash = await sha256Hex(bytes);
  await env.DB.prepare(
    "UPDATE media_jobs SET imported_key=?, imported_sha256=?, imported_bytes=?, imported_format=?, updated_at=? WHERE id=?",
  )
    .bind(key, hash, bytes.length, extension, now(), id)
    .run();
  return {
    job: jobView(await readJob(env, id)),
    imported: true,
    bytes: bytes.length,
    sha256: hash,
    url: "/media-studio/asset/" + encodeURIComponent(key.split("/").pop()),
  };
}

export async function runAction(env, action, input, by) {
  switch (action) {
    case "enable":
      return enableCapability(env, input, by);
    case "disable":
      return disableCapability(env, by);
    case "refresh":
      return refreshCatalogue(env, by);
    case "generate":
      return submitGeneration(env, input, by);
    case "reconcile":
      return reconcileJob(env, String(input?.id ?? ""));
    case "import":
      return importJob(env, String(input?.id ?? ""));
    case "status":
      return statusSnapshot(env);
    default:
      fail("UNKNOWN_ACTION", "That media action is not supported", 404);
  }
}

export { readReferencePath, newRequestId, formatCost };

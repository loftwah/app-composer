// Media capability contract: the one versioned operation set used by the native
// EmDash controls, the agent route and the Oyster/Prints adapter. Pure functions
// live here so they can be tested without a Worker runtime; the binding calls
// that touch D1, R2 or the host live in media-capability-runtime.mjs.

export const mediaCapabilityVersion = 1;
export const mediaCapabilityId = "images-and-video";
export const mediaCapabilityName = "Images & video";
export const mediaCapabilityPurpose =
  "Generate stills, reference variations and short image-to-video clips through an authorised Oyster installation, keep the owned result and import it into the app's media library.";

export const mediaActions = [
  "enable",
  "disable",
  "refresh",
  "generate",
  "reconcile",
  "import",
];

export const mediaKinds = ["image", "video"];

export const mediaJobStates = [
  "intent",
  "pending",
  "completed",
  "failed",
  "refused",
  "unknown",
];

const promptLimit = 2000;
const referencePathLimit = 4096;

/** @typedef {"image" | "video"} MediaKind */
/** @typedef {{ id: string, label: string, kind: MediaKind, tier: string, maxPromptLength: number, maxReferences: number, defaultWidth: number, defaultHeight: number, maxDimension: number|null, sizes: string[]|null, video: null|{durations:number[],defaultSeconds:number,defaultResolution:string,defaultAspectRatio:string,formats:{resolution:string,aspectRatio:string,width:number,height:number}[],maxReferenceImages:number}, priceMilliunits: number }} CatalogueModel */
/** @typedef {{ models: CatalogueModel[], checkedAt: string }} Catalogue */
/** @typedef {{ requestId: string, kind: MediaKind, model: string, prompt: string, width: number, height: number, durationSeconds?: number, resolution?: string, aspectRatio?: string, referencePath: string|null }} GenerationRequest */

export class MediaContractError extends Error {
  /** @param {string} code @param {string} message @param {number} [status] */
  constructor(code, message, status = 400) {
    super(message);
    this.name = "MediaContractError";
    this.code = code;
    this.status = status;
  }
}

/** @param {string} code @param {string} message @param {number} [status] */
function fail(code, message, status = 400) {
  throw new MediaContractError(code, message, status);
}

/** An https origin with no credentials, path, query or fragment. */
export function normaliseHost(value) {
  if (typeof value !== "string" || !value.trim())
    fail(
      "INVALID_HOST",
      "Enter the Oyster host address, for example https://oyster.example.workers.dev",
    );
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    fail("INVALID_HOST", "The Oyster host address is not a valid URL");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    fail("INVALID_HOST", "The Oyster host must be an https address without credentials");
  if (url.pathname !== "/" || url.search || url.hash)
    fail("INVALID_HOST", "Use the host origin only, without a path, query or fragment");
  return url.origin;
}

/** `media_request_` plus 21 lowercase letters or digits, as Prints requires. */
export function newRequestId(random = Math.random) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let index = 0; index < 21; index += 1) {
    const value = random();
    const bounded = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999) : 0;
    id += alphabet[Math.floor(bounded * alphabet.length)];
  }
  return "media_request_" + id;
}

export function readPrompt(value) {
  if (typeof value !== "string") fail("INVALID_PROMPT", "Write the prompt for this generation");
  const prompt = value.trim();
  if (prompt.length < 3) fail("INVALID_PROMPT", "The prompt needs at least three characters");
  if (prompt.length > promptLimit)
    fail("INVALID_PROMPT", "Keep the prompt within " + promptLimit + " characters");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(prompt))
    fail("INVALID_PROMPT", "The prompt contains control characters");
  return prompt;
}

/** An absolute Computer path such as /media/prints/cover.png. */
export function readReferencePath(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") fail("INVALID_REFERENCE", "The reference path must be text");
  const path = value.trim();
  if (path.length > referencePathLimit) fail("INVALID_REFERENCE", "The reference path is too long");
  if (!path.startsWith("/") || path.includes("..") || path.includes("\u0000"))
    fail("INVALID_REFERENCE", "Use an absolute path on the authorised Computer");
  return path;
}

function finiteInteger(value, label, min, max) {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max)
    fail("INVALID_SETTINGS", label + " must be a whole number between " + min + " and " + max);
  return number;
}

/** Flatten the runtime listModels reply into the shape this plugin stores. */
export function readCatalogue(raw, checkedAt) {
  const payload = raw;
  if (!payload || !Array.isArray(payload.models))
    fail("INVALID_CATALOGUE", "The host did not return a model catalogue", 502);
  /** @type {CatalogueModel[]} */
  const models = [];
  for (const entry of payload.models) {
    if (!entry || typeof entry !== "object") continue;
    const model = entry;
    const kind = model.kind;
    if (kind !== "image" && kind !== "video") continue;
    if (typeof model.id !== "string" || !model.id) continue;
    const input = model.input ?? {};
    const price = model.priceEstimate ?? {};
    const video = model.video ?? null;
    const formats = video && Array.isArray(video.formats) ? video.formats : [];
    models.push({
      id: model.id,
      label: typeof model.label === "string" ? model.label : model.id,
      kind,
      tier: typeof model.tier === "string" ? model.tier : "standard",
      maxPromptLength:
        typeof model.maxPromptLength === "number" ? model.maxPromptLength : promptLimit,
      maxReferences: typeof input.maxReferences === "number" ? input.maxReferences : 0,
      defaultWidth: typeof input.defaultWidth === "number" ? input.defaultWidth : 1024,
      defaultHeight: typeof input.defaultHeight === "number" ? input.defaultHeight : 1024,
      maxDimension: typeof input.maxDimension === "number" ? input.maxDimension : null,
      sizes: Array.isArray(model.sizes) ? model.sizes : null,
      video: video
        ? {
            durations: Array.isArray(video.durations) ? video.durations : [],
            defaultSeconds:
              typeof video.defaultSeconds === "number" ? video.defaultSeconds : 5,
            defaultResolution:
              typeof video.defaultResolution === "string" ? video.defaultResolution : "720p",
            defaultAspectRatio:
              typeof video.defaultAspectRatio === "string" ? video.defaultAspectRatio : "16:9",
            formats: formats
              .filter((format) => format && typeof format === "object")
              .map((format) => ({
                resolution: String(format.resolution ?? ""),
                aspectRatio: String(format.aspectRatio ?? ""),
                width: Number(format.width ?? 0),
                height: Number(format.height ?? 0),
              }))
              .filter((format) => format.width > 0 && format.height > 0),
            maxReferenceImages:
              typeof video.maxReferenceImages === "number" ? video.maxReferenceImages : 0,
          }
        : null,
      priceMilliunits: typeof price.costMilliunits === "number" ? price.costMilliunits : 0,
    });
  }
  if (!models.length)
    fail("INVALID_CATALOGUE", "The host returned no supported image or video models", 502);
  return { models, checkedAt };
}

/** 100,000 milliunits = US$1, matching Prints' own formatMoney. */
export function formatCost(milliunits) {
  if (!Number.isFinite(milliunits) || milliunits < 0) return "Unknown cost";
  if (milliunits === 0) return "US$0";
  const dollars = milliunits / 100_000;
  return "US$" + dollars.toFixed(dollars < 0.1 ? 3 : 2);
}

/** @returns {GenerationRequest} */
export function readGeneration(input, catalogue) {
  const body = input ?? {};
  const kind = body.kind;
  if (kind !== "image" && kind !== "video") fail("INVALID_KIND", "Choose an image or a video");
  const modelId = typeof body.model === "string" ? body.model.trim() : "";
  const model = catalogue.models.find((entry) => entry.id === modelId);
  if (!model) fail("UNKNOWN_MODEL", "That model is not in the host's current catalogue");
  if (model.kind !== kind) fail("WRONG_MODEL_KIND", "That model does not make " + kind);
  const prompt = readPrompt(body.prompt);
  if (prompt.length > model.maxPromptLength)
    fail("PROMPT_TOO_LONG", "This model accepts at most " + model.maxPromptLength + " characters");
  const referencePath = readReferencePath(body.referencePath);
  if (referencePath && model.maxReferences < 1)
    fail("REFERENCES_UNSUPPORTED", "This model does not accept reference images");
  const requestedWidth = body.width ?? model.defaultWidth;
  const requestedHeight = body.height ?? model.defaultHeight;
  const width = finiteInteger(requestedWidth, "Width", 256, 4096);
  const height = finiteInteger(requestedHeight, "Height", 256, 4096);
  if (model.maxDimension && (width > model.maxDimension || height > model.maxDimension))
    fail(
      "DIMENSIONS_UNSUPPORTED",
      "This model's largest dimension is " + model.maxDimension + " pixels",
    );
  /** @type {GenerationRequest} */
  const request = {
    requestId: newRequestId(),
    kind,
    model: model.id,
    prompt,
    width,
    height,
    referencePath,
  };
  if (kind === "video") {
    const video = model.video;
    if (!video) fail("VIDEO_UNSUPPORTED", "That model does not make video");
    const duration = finiteInteger(
      body.durationSeconds ?? video.defaultSeconds,
      "Duration",
      1,
      30,
    );
    if (video.durations.length && !video.durations.includes(duration))
      fail(
        "DURATION_UNSUPPORTED",
        "This model supports " + video.durations.join(", ") + " second clips",
      );
    const resolution =
      typeof body.resolution === "string" && body.resolution
        ? body.resolution
        : video.defaultResolution;
    const format = video.formats.find((entry) => entry.resolution === resolution);
    if (!format) fail("RESOLUTION_UNSUPPORTED", "That resolution is not in this model's catalogue");
    request.durationSeconds = duration;
    request.resolution = resolution;
    request.aspectRatio = format.aspectRatio;
    request.width = format.width;
    request.height = format.height;
  }
  return request;
}

export function estimateCostMilliunits(request, model) {
  return model.priceMilliunits;
}

/** The exact JS the host's code sandbox runs. Values that reach a user are
 * embedded as JSON literals, never string-concatenated into code. */
export function generateImageCode(request) {
  const settings = {
    model: request.model,
    prompt: request.prompt,
    width: request.width,
    height: request.height,
  };
  if (request.referencePath) settings.references = [{ path: request.referencePath }];
  return (
    "const request = " +
    JSON.stringify({ requestId: request.requestId, settings }) +
    ";\n" +
    "for (let attempt = 0; attempt < 3; attempt += 1) {\n" +
    "  const reply = await env.PRINTS.generateImage(request);\n" +
    "  if (reply && reply.retryAfterMs) { await new Promise((done) => setTimeout(done, Math.min(reply.retryAfterMs, 5000))); continue; }\n" +
    "  return reply;\n" +
    "}\n" +
    'return { error: "pending", stage: "budget", retryable: true };'
  );
}

export function generateVideoCode(request) {
  const settings = {
    model: request.model,
    prompt: request.prompt,
    width: request.width,
    height: request.height,
    durationSeconds: request.durationSeconds,
    resolution: request.resolution,
    aspectRatio: request.aspectRatio,
  };
  if (request.referencePath) settings.references = [{ path: request.referencePath }];
  return (
    "const request = " +
    JSON.stringify({ requestId: request.requestId, settings }) +
    ";\n" +
    "for (let attempt = 0; attempt < 3; attempt += 1) {\n" +
    "  const reply = await env.PRINTS.generateVideo(request);\n" +
    "  if (reply && reply.retryAfterMs) { await new Promise((done) => setTimeout(done, Math.min(reply.retryAfterMs, 5000))); continue; }\n" +
    "  return reply;\n" +
    "}\n" +
    'return { error: "pending", stage: "budget", retryable: true };'
  );
}

/** The host returns MCP content blocks; execute returns one JSON text block. */
export function readExecuteReply(result) {
  const blocks = result?.content;
  if (!Array.isArray(blocks) || !blocks.length)
    fail("EMPTY_REPLY", "The host returned no result", 502);
  const texts = blocks
    .filter(
      (block) =>
        block &&
        typeof block === "object" &&
        block.type === "text" &&
        typeof block.text === "string",
    )
    .map((block) => block.text);
  if (!texts.length) fail("EMPTY_REPLY", "The host returned no text result", 502);
  const text = texts.join("\n");
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { payload, text };
}

/** A refusal is any reply that carries an `error` code from Prints or Media. */
export function readRefusal(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.error !== "string" || !payload.error) return null;
  const message =
    typeof payload.message === "string" && payload.message
      ? payload.message
      : "The host refused this request (" + payload.error + ")";
  return { code: payload.error, message };
}

/** Extract the JSON-RPC reply from a streamable-HTTP body (JSON or SSE). */
export function readJsonRpcReply(text, id) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) fail("EMPTY_REPLY", "The host returned an empty MCP reply", 502);
  const candidates = [];
  if (trimmed.startsWith("{")) candidates.push(trimmed);
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const value = line.slice(5).trim();
    if (value) candidates.push(value);
  }
  for (const candidate of candidates.reverse()) {
    try {
      const message = JSON.parse(candidate);
      if (message.id !== undefined && message.error)
        fail("HOST_ERROR", message.error.message ?? "The host refused the MCP call", 502);
      if (message.id === id && message.result !== undefined) return message.result;
    } catch (error) {
      if (error instanceof MediaContractError) throw error;
    }
  }
  fail("UNREADABLE_REPLY", "The host's MCP reply could not be read", 502);
}

export function readStatusRow(row) {
  const record = row ?? {};
  const enabled = Number(record.enabled) === 1;
  let catalogue = null;
  if (typeof record.models_json === "string" && record.models_json) {
    try {
      const parsed = JSON.parse(record.models_json);
      if (parsed && Array.isArray(parsed.models) && parsed.models.length) catalogue = parsed;
    } catch {
      catalogue = null;
    }
  }
  return {
    enabled,
    host: typeof record.host === "string" ? record.host : "",
    installation:
      typeof record.installation === "string" && record.installation
        ? record.installation
        : "prints",
    catalogue,
    configuredAt: typeof record.updated_at === "string" ? record.updated_at : null,
    updatedBy: typeof record.updated_by === "string" ? record.updated_by : null,
  };
}

export function jobView(row) {
  let settings = {};
  try {
    settings = JSON.parse(row.settings_json);
  } catch {}
  let output = null;
  try {
    output = row.output_json ? JSON.parse(row.output_json) : null;
  } catch {}
  return {
    id: row.id,
    requestId: row.request_id,
    kind: row.kind,
    state: row.state,
    prompt: row.prompt,
    model: row.model,
    settings,
    referencePath: row.reference_path,
    cost: { milliunits: row.cost_milliunits, label: formatCost(row.cost_milliunits) },
    output,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    imported: row.imported_key
      ? {
          key: row.imported_key,
          sha256: row.imported_sha256,
          bytes: row.imported_bytes,
          format: row.imported_format,
        }
      : null,
  };
}

/** What the panel says about a disabled capability. Retention is the default;
 * deleting owned media is always a separate, explicit operation. */
export const disableNote =
  "New requests stop here and in the agent route. Existing jobs, imported media and the Oyster host keep their data. The host is independently reachable and keeps its own access; this switch does not delete either side.";

export const enableNote =
  "Enabling stores the host address and checks its live model catalogue. It does not buy credit, start a container or generate anything. A generation spends the host owner's provider balance and is shown with its estimate before you send it.";

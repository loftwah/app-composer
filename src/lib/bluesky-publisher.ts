// Bounded AT Protocol publishing adapter for the share calendar (#604).
//
// This is the only module in Composer that talks to a Bluesky PDS for writes.
// It uses the documented legacy HTTP session flow (`com.atproto.server.
// createSession` with an app password) because the owner configures a single
// server-side account and Composer has no interactive OAuth callback surface.
// The official OAuth specification recommends OAuth for user-facing clients;
// this narrow server-side path is the smallest supported alternative and is
// called out as such in docs/operator-reference.md.
//
// Privacy and safety rules, enforced here and by the caller:
// - The app password is accepted for one request chain and never returned,
//   logged, stored, serialised into an error or included in a response body.
// - Session tokens are returned to the caller only so it can finish the same
//   send. No delivery row, snapshot or error carries a token.
// - Every request has an explicit short timeout. A transport failure while
//   creating a record is ambiguous, so callers must mark it `unknown` and
//   reconcile by the deterministic record key; they never retry blindly.
// - Text is checked against the same 300-grapheme / 3000-byte contract as the
//   approval before any network call. Links use the existing canonical link
//   rule. Images are bounded by type and size before upload.
// - Provider response bodies are parsed for the exact fields below and never
//   persisted or echoed. Errors are fixed, sanitised messages.
import {
  BLUESKY_HANDLE_SETTING,
  isBlueskyDid,
  normalizeBlueskyHandle,
} from "./bluesky-account.ts";
import { isSafeShareLink } from "./share-calendar.ts";
import { blueskyUsage, sha256Text } from "./share-approval.ts";
import type { SettingField } from "emdash";

export const BLUESKY_PDS_ORIGIN = "https://bsky.social";
export const BLUESKY_POST_COLLECTION = "app.bsky.feed.post";
export const BLUESKY_POST_RKEY_PREFIX = "composer.bluesky-rkey/v1";
export const BLUESKY_APP_PASSWORD_SETTING = "SHARE_BLUESKY_APP_PASSWORD";

// The only Bluesky credential Composer accepts. It is declared as a native
// encrypted `secret` so it uses EmDash's existing plugin settings store; there
// is no second credential table. The public handle is a non-secret setting that
// overrides the `SHARE_BLUESKY_HANDLE` runtime value when the owner saves it
// from Share connections.
export const blueskyPublisherSettings: Record<string, SettingField> =
  Object.freeze({
    [BLUESKY_HANDLE_SETTING]: Object.freeze({
      type: "string",
      label: "Bluesky public handle",
      description:
        "Optional public configuration, not a secret. The exact handle Composer may publish to, for example name.bsky.social. Share connections saves this setting and falls back to the server variable when it is empty.",
    }),
    [BLUESKY_APP_PASSWORD_SETTING]: Object.freeze({
      type: "secret",
      label: "Bluesky app password",
      description:
        "Optional. An app password created in Bluesky Settings → App Passwords for the exact public account. Native EmDash encrypts this value; Composer never returns or logs it. Leave empty to keep manual package handoff.",
    }),
  });

export const BLUESKY_SESSION_TIMEOUT_MS = 8_000;
export const BLUESKY_WRITE_TIMEOUT_MS = 15_000;
export const BLUESKY_READ_TIMEOUT_MS = 8_000;
export const BLUESKY_JSON_MAX_BYTES = 65_536;
export const BLUESKY_ERROR_MAX_BYTES = 16_384;
export const BLUESKY_TOKEN_MAX = 8_192;
export const BLUESKY_APP_PASSWORD_MIN = 8;
export const BLUESKY_APP_PASSWORD_MAX = 512;
export const BLUESKY_IMAGE_MAX_BYTES = 1_000_000;
export const BLUESKY_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const BLUESKY_IMAGE_ALT_MAX = 2_000;
export const BLUESKY_RKEY_MAX = 512;

const NSID = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*){2,}$/;
const RKEY = /^[a-zA-Z0-9._:~-]{1,512}$/;
const CID = /^(?:b[a-z2-7]{20,200}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const BLOB_LINK = /^b[a-z2-7]{20,200}$/;
const PROVIDER_ERROR = /^[A-Za-z0-9_.-]{1,80}$/;

export type BlueskyPublishFailureCode =
  | "needs_auth"
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "invalid_response"
  | "invalid_input"
  | "invalid_text"
  | "invalid_link"
  | "invalid_media"
  | "record_conflict"
  | "account_inactive"
  | "not_found";

export interface BlueskyPublishFailure {
  ok: false;
  code: BlueskyPublishFailureCode;
  message: string;
  retryable: boolean;
  needsAuth: boolean;
  // True when no HTTP response was received (timeout, abort or network error).
  // A transport failure during createRecord is ambiguous and must reconcile.
  transport: boolean;
}

export interface BlueskySession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export interface BlueskyBlobRef {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export interface BlueskyImageBytes {
  bytes: Uint8Array;
  mimeType: (typeof BLUESKY_IMAGE_TYPES)[number];
}

export interface BlueskyPostRecordRef {
  uri: string;
  cid: string;
  rkey: string;
  permalink: string;
}

export interface BlueskyReadPost {
  found: true;
  uri: string;
  cid: string | null;
  text: string;
}

export interface BlueskyMissingPost {
  found: false;
}

export interface BlueskyPostListEntry {
  uri: string;
  cid: string;
  rkey: string;
}

export interface BlueskyFetchOptions {
  fetch?: typeof globalThis.fetch;
  service?: string;
  timeoutMs?: number;
}

export type BlueskySessionResult =
  { ok: true; session: BlueskySession } | BlueskyPublishFailure;

export type BlueskyBlobResult =
  { ok: true; blob: BlueskyBlobRef } | BlueskyPublishFailure;

export type BlueskyPostResult =
  { ok: true; post: BlueskyPostRecordRef } | BlueskyPublishFailure;

export type BlueskyReadResult =
  | { ok: true; record: BlueskyReadPost | BlueskyMissingPost }
  | BlueskyPublishFailure;

export type BlueskyListResult =
  | { ok: true; records: BlueskyPostListEntry[]; cursor: string | null }
  | BlueskyPublishFailure;

export type BlueskyImageResult =
  { ok: true; image: BlueskyImageBytes } | BlueskyPublishFailure;

function failure(
  code: BlueskyPublishFailureCode,
  message: string,
  options: {
    retryable?: boolean;
    needsAuth?: boolean;
    transport?: boolean;
  } = {},
): BlueskyPublishFailure {
  return {
    ok: false,
    code,
    message,
    retryable: options.retryable ?? false,
    needsAuth: options.needsAuth ?? false,
    transport: options.transport ?? false,
  };
}

function isPublishFailure(value: unknown): value is BlueskyPublishFailure {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).ok === false &&
    typeof (value as Record<string, unknown>).code === "string",
  );
}

function serviceOrigin(value: unknown): string | null {
  if (value === undefined || value === null || value === "")
    return BLUESKY_PDS_ORIGIN;
  if (typeof value !== "string" || value.length > 512) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Public configuration only: a plain https origin. It never contains a
// credential and defaults to the main Bluesky host.
export function normalizeBlueskyService(value: unknown): string | null {
  return serviceOrigin(value);
}

function boundedToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 16 || value.length > BLUESKY_TOKEN_MAX) return null;
  return /[\u0000-\u0020\u007f]/.test(value) ? null : value;
}

// Shared with the owner connection routes: the same trimmed bounds are checked
// before any provider call, so an unusable value is never stored or sent.
export function normalizeBlueskyAppPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const password = value.trim();
  if (
    password.length < BLUESKY_APP_PASSWORD_MIN ||
    password.length > BLUESKY_APP_PASSWORD_MAX ||
    /[\u0000-\u0020\u007f]/.test(password)
  )
    return null;
  return password;
}

function sessionFrom(value: unknown): BlueskySession | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!isBlueskyDid(body.did)) return null;
  const handle = normalizeBlueskyHandle(body.handle);
  const accessJwt = boundedToken(body.accessJwt);
  const refreshJwt = boundedToken(body.refreshJwt);
  if (!handle || !accessJwt || !refreshJwt) return null;
  return { did: body.did, handle, accessJwt, refreshJwt };
}

function blobFrom(value: unknown): BlueskyBlobRef | null {
  if (!value || typeof value !== "object") return null;
  const blob = value as Record<string, unknown>;
  if (blob.$type !== "blob") return null;
  const ref = blob.ref;
  if (!ref || typeof ref !== "object") return null;
  const link = (ref as Record<string, unknown>).$link;
  if (typeof link !== "string" || !BLOB_LINK.test(link)) return null;
  const mimeType =
    typeof blob.mimeType === "string"
      ? blob.mimeType.split(";")[0].trim().toLowerCase()
      : "";
  if (!(BLUESKY_IMAGE_TYPES as readonly string[]).includes(mimeType))
    return null;
  const size = typeof blob.size === "number" ? blob.size : 0;
  if (!Number.isInteger(size) || size <= 0 || size > BLUESKY_IMAGE_MAX_BYTES)
    return null;
  return {
    $type: "blob",
    ref: { $link: link },
    mimeType,
    size,
  };
}

interface HttpSuccess {
  ok: true;
  status: number;
  body: unknown;
}

interface HttpFailure {
  ok: false;
  transport: boolean;
  status: number | null;
  providerError: string | null;
}

function providerErrorFrom(text: string): string | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object") return null;
    const error = (value as Record<string, unknown>).error;
    return typeof error === "string" && PROVIDER_ERROR.test(error)
      ? error
      : null;
  } catch {
    return null;
  }
}

async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const text = await response.text();
  return text.length > maxBytes ? null : text;
}

async function httpJson(
  url: string,
  init: RequestInit,
  options: BlueskyFetchOptions,
  defaultTimeout: number,
): Promise<HttpSuccess | HttpFailure> {
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function")
    return { ok: false, transport: true, status: null, providerError: null };
  const timeoutMs = Math.min(
    30_000,
    Math.max(10, options.timeoutMs ?? defaultTimeout),
  );
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      doFetch(url, { ...init, redirect: "manual", signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, timeoutMs);
      }),
    ]);
    if (response.status >= 200 && response.status < 300) {
      const text = await readBoundedText(response, BLUESKY_JSON_MAX_BYTES);
      if (text === null)
        return {
          ok: false,
          transport: false,
          status: response.status,
          providerError: "InvalidResponse",
        };
      try {
        return {
          ok: true,
          status: response.status,
          body: text ? JSON.parse(text) : null,
        };
      } catch {
        return {
          ok: false,
          transport: false,
          status: response.status,
          providerError: "InvalidResponse",
        };
      }
    }
    const text = await readBoundedText(response, BLUESKY_ERROR_MAX_BYTES);
    return {
      ok: false,
      transport: false,
      status: response.status,
      providerError: text ? providerErrorFrom(text) : null,
    };
  } catch {
    return { ok: false, transport: true, status: null, providerError: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function classifyAuthFailure(
  result: HttpFailure,
  action: string,
): BlueskyPublishFailure {
  const status = result.status;
  if (result.transport)
    return failure(
      "timeout",
      `The Bluesky service did not answer while ${action}. The outcome is unknown and Composer did not retry.`,
      { retryable: true, transport: true },
    );
  if (status === 401 || status === 403)
    return failure(
      "needs_auth",
      "The Bluesky session was rejected. Update the encrypted app password in Composer, then try again.",
      { needsAuth: true },
    );
  if (
    status === 400 &&
    (result.providerError === "InvalidToken" ||
      result.providerError === "ExpiredToken" ||
      result.providerError === "AuthRequired")
  )
    return failure(
      "needs_auth",
      "The Bluesky session expired. Update the encrypted app password or refresh the session, then try again.",
      { needsAuth: true },
    );
  if (status === 429)
    return failure(
      "rate_limited",
      "Bluesky asked Composer to slow down. Wait before trying again; nothing was retried automatically.",
      { retryable: true },
    );
  if (status !== null && status >= 500)
    return failure(
      "unavailable",
      `The Bluesky service returned HTTP ${status}. Check the outcome before retrying.`,
      { retryable: true },
    );
  return failure(
    "unavailable",
    `The Bluesky service rejected the ${action} request. Nothing was retried automatically.`,
  );
}

// `com.atproto.server.createSession`: handle + app password in, bounded session
// out. The password is used once and never appears in a result or error.
export async function createBlueskySession(
  input: { identifier: string; password: string },
  options: BlueskyFetchOptions = {},
): Promise<BlueskySessionResult> {
  const handle = normalizeBlueskyHandle(input.identifier);
  const password = normalizeBlueskyAppPassword(input.password);
  if (!handle)
    return failure(
      "invalid_input",
      "Use a public Bluesky handle such as name.bsky.social. Composer stores no credential in this form.",
    );
  if (!password)
    return failure(
      "invalid_input",
      "A Bluesky app password is required. Use the encrypted plugin secret, never a main password.",
    );
  const service = serviceOrigin(options.service);
  if (!service)
    return failure(
      "invalid_input",
      "The Bluesky service address is not a plain https origin.",
    );
  const result = await httpJson(
    service + "/xrpc/com.atproto.server.createSession",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier: handle, password }),
    },
    options,
    BLUESKY_SESSION_TIMEOUT_MS,
  );
  if (!result.ok) {
    if (
      result.providerError === "InvalidPassword" ||
      result.providerError === "InvalidIdentifier" ||
      result.providerError === "AuthFactorTokenRequired"
    )
      return failure(
        "needs_auth",
        "Bluesky rejected the app password or identifier. Nothing was published. Update the encrypted app password and try again.",
        { needsAuth: true },
      );
    return classifyAuthFailure(result, "creating a session");
  }
  const body = result.body as Record<string, unknown> | null;
  if (body && body.active === false)
    return failure(
      "account_inactive",
      "The Bluesky account is not active, so Composer did not publish.",
    );
  const session = sessionFrom(result.body);
  if (!session)
    return failure(
      "invalid_response",
      "The Bluesky service returned an unexpected session. Composer did not use it.",
    );
  return { ok: true, session };
}

// `com.atproto.server.refreshSession` uses the refresh JWT, not the access JWT.
// A rejected refresh is `needs_auth`; it is never reported as a generic failure.
export async function refreshBlueskySession(
  refreshJwt: string,
  options: BlueskyFetchOptions = {},
): Promise<BlueskySessionResult> {
  const token = boundedToken(refreshJwt);
  if (!token)
    return failure(
      "needs_auth",
      "The Bluesky refresh token is not usable. Update the encrypted app password and try again.",
      { needsAuth: true },
    );
  const service = serviceOrigin(options.service);
  if (!service)
    return failure(
      "invalid_input",
      "The Bluesky service address is not a plain https origin.",
    );
  const result = await httpJson(
    service + "/xrpc/com.atproto.server.refreshSession",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
      },
    },
    options,
    BLUESKY_SESSION_TIMEOUT_MS,
  );
  if (!result.ok) {
    if (
      result.status === 400 ||
      result.status === 401 ||
      result.providerError === "ExpiredToken" ||
      result.providerError === "InvalidToken"
    )
      return failure(
        "needs_auth",
        "The Bluesky session expired or was revoked. Update the encrypted app password and try again.",
        { needsAuth: true },
      );
    return classifyAuthFailure(result, "refreshing a session");
  }
  const session = sessionFrom(result.body);
  if (!session)
    return failure(
      "invalid_response",
      "The Bluesky service returned an unexpected refreshed session. Composer did not use it.",
    );
  return { ok: true, session };
}

// `com.atproto.repo.uploadBlob`. Type and size are enforced before the request;
// the returned blob reference is the only part of the response we keep.
export async function uploadBlueskyImage(
  input: { session: BlueskySession; bytes: Uint8Array; mimeType: string },
  options: BlueskyFetchOptions = {},
): Promise<BlueskyBlobResult> {
  const mimeType = input.mimeType.split(";")[0].trim().toLowerCase();
  if (!(BLUESKY_IMAGE_TYPES as readonly string[]).includes(mimeType))
    return failure(
      "invalid_media",
      "Only JPEG, PNG or WebP share-card images can be uploaded to Bluesky.",
    );
  if (
    !(input.bytes instanceof Uint8Array) ||
    input.bytes.byteLength === 0 ||
    input.bytes.byteLength > BLUESKY_IMAGE_MAX_BYTES
  )
    return failure(
      "invalid_media",
      `The share-card image must be between 1 byte and ${BLUESKY_IMAGE_MAX_BYTES} bytes.`,
    );
  if (!boundedToken(input.session.accessJwt))
    return failure(
      "needs_auth",
      "The Bluesky session is not usable. Update the encrypted app password and try again.",
      { needsAuth: true },
    );
  const service = serviceOrigin(options.service);
  if (!service)
    return failure(
      "invalid_input",
      "The Bluesky service address is not a plain https origin.",
    );
  const result = await httpJson(
    service + "/xrpc/com.atproto.repo.uploadBlob",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": mimeType,
        Authorization: "Bearer " + input.session.accessJwt,
      },
      // Copy into a plain ArrayBuffer so the body is a bounded byte sequence
      // independent of the caller's view offset.
      body: input.bytes.slice().buffer as ArrayBuffer,
    },
    options,
    BLUESKY_WRITE_TIMEOUT_MS,
  );
  if (!result.ok) return classifyAuthFailure(result, "uploading an image");
  const body = result.body as Record<string, unknown> | null;
  const blob = body ? blobFrom(body.blob) : null;
  if (!blob)
    return failure(
      "invalid_response",
      "Bluesky returned an unexpected image reference. Composer did not use it.",
    );
  return { ok: true, blob };
}

export type BlueskyEmbedChoice = "auto" | "external" | "images" | "none";

export interface BlueskyPostInput {
  session: BlueskySession;
  rkey: string;
  text: string;
  createdAt: string;
  link?: string | null;
  embed?: BlueskyEmbedChoice;
  image?: { blob: BlueskyBlobRef; alt: string } | null;
  external?: { title: string; description: string } | null;
}

function validInstant(value: string): boolean {
  if (typeof value !== "string" || value.length > 64) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

// Clip by code point so a surrogate pair is never split at the boundary.
function clipCodePoints(value: string, max: number): string {
  return Array.from(value).slice(0, max).join("");
}

function embedFor(
  input: BlueskyPostInput,
): Record<string, unknown> | BlueskyPublishFailure | null {
  const choice = input.embed ?? "auto";
  const image = input.image ?? null;
  const link = input.link?.trim() || null;
  const external = input.external ?? null;
  if (link && !isSafeShareLink(link))
    return failure(
      "invalid_link",
      "The Bluesky link must be a plain http or https address without credentials.",
    );
  const useExternal =
    choice === "external" || (choice === "auto" && Boolean(link && image));
  const useImages =
    choice === "images" ||
    (choice === "auto" && Boolean(image) && !link) ||
    (choice === "external" && Boolean(image) && !link);
  if (choice === "external" && !link)
    return failure(
      "invalid_link",
      "A link card needs a safe canonical link before Composer can publish.",
    );
  if ((useExternal || useImages) && !image)
    return failure(
      "invalid_media",
      "A Bluesky embed needs the approved share-card image.",
    );
  if (useExternal) {
    const title = clipCodePoints(
      (external?.title ?? "App Composer").trim(),
      300,
    );
    const description = clipCodePoints(
      (external?.description ?? input.text).trim(),
      1_000,
    );
    if (!title || !description)
      return failure(
        "invalid_input",
        "A link card needs a title and description.",
      );
    return {
      $type: "app.bsky.embed.external",
      external: {
        uri: link,
        title,
        description,
        thumb: image!.blob,
      },
    };
  }
  if (useImages) {
    const alt = (image!.alt ?? "").trim();
    if (!alt || alt.length > BLUESKY_IMAGE_ALT_MAX)
      return failure(
        "invalid_media",
        "The approved share-card image needs bounded alt text.",
      );
    return {
      $type: "app.bsky.embed.images",
      images: [{ image: image!.blob, alt }],
    };
  }
  if (choice === "none") return null;
  return null;
}

// `com.atproto.repo.createRecord` with an explicit deterministic rkey. The rkey
// is derived from the item id and approval revision by `blueskyPostRkey`, so a
// retry targets the same record instead of creating a second post.
export async function createBlueskyPost(
  input: BlueskyPostInput,
  options: BlueskyFetchOptions = {},
): Promise<BlueskyPostResult> {
  if (!isBlueskyDid(input.session.did))
    return failure("invalid_input", "The Bluesky session has no usable DID.");
  if (!boundedToken(input.session.accessJwt))
    return failure(
      "needs_auth",
      "The Bluesky session is not usable. Update the encrypted app password and try again.",
      { needsAuth: true },
    );
  if (!RKEY.test(input.rkey) || input.rkey === "." || input.rkey === "..")
    return failure(
      "invalid_input",
      "The Bluesky record key is not valid. Composer will not guess one.",
    );
  if (
    typeof input.text !== "string" ||
    !input.text ||
    /[\u0000]/.test(input.text)
  )
    return failure(
      "invalid_text",
      "The Bluesky text is empty or contains NUL.",
    );
  const usage = blueskyUsage(input.text);
  if (!usage.withinLimit)
    return failure(
      "invalid_text",
      "The Bluesky text exceeds the 300-grapheme or 3000-byte limit. Nothing was sent.",
    );
  if (!validInstant(input.createdAt))
    return failure(
      "invalid_input",
      "The Bluesky record needs a canonical created-at instant.",
    );
  const embed = embedFor(input);
  if (isPublishFailure(embed)) return embed;
  const record: Record<string, unknown> = {
    $type: BLUESKY_POST_COLLECTION,
    text: input.text,
    createdAt: input.createdAt,
  };
  if (embed) record.embed = embed;
  const service = serviceOrigin(options.service);
  if (!service)
    return failure(
      "invalid_input",
      "The Bluesky service address is not a plain https origin.",
    );
  const result = await httpJson(
    service + "/xrpc/com.atproto.repo.createRecord",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + input.session.accessJwt,
      },
      body: JSON.stringify({
        repo: input.session.did,
        collection: BLUESKY_POST_COLLECTION,
        rkey: input.rkey,
        validate: true,
        record,
      }),
    },
    options,
    BLUESKY_WRITE_TIMEOUT_MS,
  );
  if (!result.ok) {
    if (
      result.providerError === "RecordAlreadyExists" ||
      result.providerError === "RecordExists" ||
      result.providerError === "InvalidSwap"
    )
      return failure(
        "record_conflict",
        "The Bluesky repository already has a record at this key. Reconcile it before retrying.",
      );
    return classifyAuthFailure(result, "creating a post");
  }
  const body = result.body as Record<string, unknown> | null;
  const uri = body?.uri;
  const cid = body?.cid;
  const expectedUri = `at://${input.session.did}/${BLUESKY_POST_COLLECTION}/${input.rkey}`;
  if (uri !== expectedUri || typeof cid !== "string" || !CID.test(cid))
    return failure(
      "invalid_response",
      "Bluesky returned an unexpected record identity. Composer did not accept it.",
    );
  const permalink = blueskyPostPermalink(input.session.handle, input.rkey);
  if (!permalink)
    return failure(
      "invalid_response",
      "The Bluesky permalink could not be formed from the returned handle and record key.",
    );
  return {
    ok: true,
    post: { uri, cid, rkey: input.rkey, permalink },
  };
}

// Public readback used only for reconciliation after an ambiguous send.
// `com.atproto.repo.getRecord` needs no credential; it is not called on load.
export async function readBlueskyPost(
  input: { repo: string; rkey: string },
  options: BlueskyFetchOptions = {},
): Promise<BlueskyReadResult> {
  if (!isBlueskyDid(input.repo) || !RKEY.test(input.rkey))
    return failure(
      "invalid_input",
      "The Bluesky readback needs the approved DID and record key.",
    );
  const service = serviceOrigin(options.service);
  if (!service)
    return failure(
      "invalid_input",
      "The Bluesky service address is not a plain https origin.",
    );
  const url = new URL(service + "/xrpc/com.atproto.repo.getRecord");
  url.searchParams.set("repo", input.repo);
  url.searchParams.set("collection", BLUESKY_POST_COLLECTION);
  url.searchParams.set("rkey", input.rkey);
  const result = await httpJson(
    url.href,
    { method: "GET", headers: { Accept: "application/json" } },
    options,
    BLUESKY_READ_TIMEOUT_MS,
  );
  if (!result.ok) {
    if (
      result.status === 400 ||
      result.status === 404 ||
      result.providerError === "RecordNotFound"
    )
      return { ok: true, record: { found: false } };
    return classifyAuthFailure(result, "reading a post");
  }
  const body = result.body as Record<string, unknown> | null;
  const value = body?.value as Record<string, unknown> | null;
  if (
    !body ||
    body.uri !==
      `at://${input.repo}/${BLUESKY_POST_COLLECTION}/${input.rkey}` ||
    !value ||
    typeof value.text !== "string"
  )
    return failure(
      "invalid_response",
      "Bluesky returned an unexpected record for this key. Composer did not reconcile it.",
    );
  const cid =
    typeof body.cid === "string" && CID.test(body.cid) ? body.cid : null;
  return {
    ok: true,
    record: {
      found: true,
      uri: body.uri,
      cid,
      text: clipCodePoints(value.text, 3_000),
    },
  };
}

// `com.atproto.repo.listRecords`. Used as a bounded fallback read; the raw
// record value is never returned or stored.
export async function listBlueskyPosts(
  input: { repo: string; limit?: number; cursor?: string },
  options: BlueskyFetchOptions = {},
): Promise<BlueskyListResult> {
  if (!isBlueskyDid(input.repo))
    return failure("invalid_input", "The Bluesky list needs the approved DID.");
  const service = serviceOrigin(options.service);
  if (!service)
    return failure(
      "invalid_input",
      "The Bluesky service address is not a plain https origin.",
    );
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const url = new URL(service + "/xrpc/com.atproto.repo.listRecords");
  url.searchParams.set("repo", input.repo);
  url.searchParams.set("collection", BLUESKY_POST_COLLECTION);
  url.searchParams.set("limit", String(limit));
  if (input.cursor) url.searchParams.set("cursor", input.cursor.slice(0, 512));
  const result = await httpJson(
    url.href,
    { method: "GET", headers: { Accept: "application/json" } },
    options,
    BLUESKY_READ_TIMEOUT_MS,
  );
  if (!result.ok) return classifyAuthFailure(result, "listing posts");
  const body = result.body as Record<string, unknown> | null;
  const records = body?.records;
  if (!Array.isArray(records) || records.length > 100)
    return failure(
      "invalid_response",
      "Bluesky returned an unexpected record list. Composer did not use it.",
    );
  const entries: BlueskyPostListEntry[] = [];
  for (const entry of records) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const uri = record.uri;
    const cid = record.cid;
    if (typeof uri !== "string" || typeof cid !== "string" || !CID.test(cid))
      continue;
    const match = new RegExp(
      `^at://${input.repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${BLUESKY_POST_COLLECTION}/([a-zA-Z0-9._:~-]{1,512})$`,
    ).exec(uri);
    if (!match) continue;
    entries.push({ uri, cid, rkey: match[1] });
  }
  return {
    ok: true,
    records: entries,
    cursor: typeof body?.cursor === "string" ? body.cursor.slice(0, 512) : null,
  };
}

// A deterministic record key derived from the approved item and approval
// revision. It is a valid record-key on its own and changes when the owner
// re-approves, so a stale approval cannot overwrite a newer post.
export async function blueskyPostRkey(
  itemId: string,
  approvalRevision: number,
): Promise<string> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      itemId,
    )
  )
    throw Error("A Bluesky record key needs a share item id.");
  if (!Number.isInteger(approvalRevision) || approvalRevision < 1)
    throw Error("A Bluesky record key needs a positive approval revision.");
  const digest = await sha256Text(
    `${BLUESKY_POST_RKEY_PREFIX}:${itemId}:${approvalRevision}`,
  );
  return digest.slice(0, 32);
}

export function blueskyPostPermalink(
  handle: unknown,
  rkey: unknown,
): string | null {
  const normalized = normalizeBlueskyHandle(handle);
  if (!normalized || typeof rkey !== "string" || !RKEY.test(rkey)) return null;
  const expected = `/profile/${normalized}/post/${rkey}`;
  try {
    const url = new URL("https://bsky.app" + expected);
    return url.origin === "https://bsky.app" && url.pathname === expected
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function isBlueskyAtPostUri(
  value: unknown,
  did: string,
  rkey: string,
): boolean {
  if (typeof value !== "string" || value.length > 1_024) return false;
  return (
    isBlueskyDid(did) &&
    RKEY.test(rkey) &&
    NSID.test(BLUESKY_POST_COLLECTION) &&
    value === `at://${did}/${BLUESKY_POST_COLLECTION}/${rkey}`
  );
}

// Fetch the approved public share card once, on an explicit send only. The
// image host is not the PDS; no credential is sent. Redirects are refused so
// the bytes cannot be sourced from an unapproved location.
export async function fetchBlueskyImage(
  url: string,
  options: BlueskyFetchOptions = {},
): Promise<BlueskyImageResult> {
  if (!isSafeShareLink(url) || !/^https:\/\//.test(url))
    return failure(
      "invalid_media",
      "The approved share-card address is not a safe https URL.",
    );
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function")
    return failure(
      "unavailable",
      "Composer has no network transport for the share card.",
      { retryable: true, transport: true },
    );
  const timeoutMs = Math.min(
    30_000,
    Math.max(10, options.timeoutMs ?? BLUESKY_READ_TIMEOUT_MS),
  );
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      doFetch(url, {
        method: "GET",
        headers: { Accept: "image/png,image/jpeg,image/webp" },
        redirect: "manual",
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, timeoutMs);
      }),
    ]);
    if (response.status >= 300 && response.status < 400)
      return failure(
        "invalid_media",
        "The share-card image redirected. Composer did not follow it.",
      );
    if (!response.ok)
      return failure(
        "invalid_media",
        `The share-card image returned HTTP ${response.status}. Nothing was sent.`,
      );
    const mimeType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!(BLUESKY_IMAGE_TYPES as readonly string[]).includes(mimeType))
      return failure(
        "invalid_media",
        "The share card is not a JPEG, PNG or WebP image. Nothing was sent.",
      );
    const declared = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > BLUESKY_IMAGE_MAX_BYTES)
      return failure(
        "invalid_media",
        `The share card is larger than ${BLUESKY_IMAGE_MAX_BYTES} bytes. Nothing was sent.`,
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > BLUESKY_IMAGE_MAX_BYTES)
      return failure(
        "invalid_media",
        `The share card must be between 1 byte and ${BLUESKY_IMAGE_MAX_BYTES} bytes. Nothing was sent.`,
      );
    return {
      ok: true,
      image: {
        bytes,
        mimeType: mimeType as BlueskyImageBytes["mimeType"],
      },
    };
  } catch {
    return failure(
      "timeout",
      "The share-card image did not load within the short timeout. Nothing was sent.",
      { retryable: true, transport: true },
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

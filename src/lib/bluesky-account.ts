// Public Bluesky identity resolution for the share calendar (#604).
// This module only reads the public AT Protocol AppView. It never accepts or
// stores a password, app password, refresh token or private key, and a resolved
// public profile is never treated as permission to publish.
import { z } from "zod";

export const BLUESKY_APPVIEW_ORIGIN = "https://public.api.bsky.app";
export const BLUESKY_PROFILE_PATH = "/xrpc/app.bsky.actor.getProfile";
export const BLUESKY_PROFILE_TIMEOUT_MS = 3_500;
export const BLUESKY_HANDLE_MAX = 253;
export const BLUESKY_PUBLIC_SOURCE = "public.api.bsky.app";

// The owner configures only a public handle. The name is deliberately not a
// secret name, and this module reads no other environment value.
export const BLUESKY_HANDLE_SETTING = "SHARE_BLUESKY_HANDLE";

export const BLUESKY_PUBLIC_IDENTITY_STATEMENT =
  "The public AT Protocol AppView returned this profile. It confirms a public identity only.";
export const BLUESKY_PUBLISHING_STATEMENT =
  "Public identity resolved is not publishing authorisation. Composer holds no Bluesky credential, app password or OAuth grant and cannot post.";
export const BLUESKY_CREDENTIAL_STATEMENT =
  "Never paste a Bluesky password, app password, recovery code or token into Composer. This page does not ask for one and stores none.";

export type BlueskyIdentityStatus =
  | "resolved"
  | "needs_account"
  | "invalid_handle"
  | "not_found"
  | "mismatch"
  | "unavailable";

export interface BlueskyPublishingAuthority {
  authorised: false;
  reason: "no_authorised_connection";
  statement: typeof BLUESKY_PUBLISHING_STATEMENT;
}

export interface BlueskyIdentityResult {
  ok: boolean;
  status: BlueskyIdentityStatus;
  handle: string | null;
  did: string | null;
  displayName: string | null;
  avatar: string | null;
  profileUrl: string | null;
  resolvedAt: string | null;
  source: typeof BLUESKY_PUBLIC_SOURCE | null;
  message: string;
  retryable: boolean;
  publicIdentity: "resolved" | "unresolved";
  publishing: BlueskyPublishingAuthority;
}

const publishing: BlueskyPublishingAuthority = {
  authorised: false,
  reason: "no_authorised_connection",
  statement: BLUESKY_PUBLISHING_STATEMENT,
};

export const blueskyIdentityResultSchema = z
  .object({
    ok: z.boolean(),
    status: z.enum([
      "resolved",
      "needs_account",
      "invalid_handle",
      "not_found",
      "mismatch",
      "unavailable",
    ]),
    handle: z.string().min(3).max(BLUESKY_HANDLE_MAX).nullable(),
    did: z.string().max(256).nullable(),
    displayName: z.string().max(640).nullable(),
    avatar: z.string().url().max(2048).nullable(),
    profileUrl: z.string().url().max(2048).nullable(),
    resolvedAt: z.string().max(64).nullable(),
    source: z.literal(BLUESKY_PUBLIC_SOURCE).nullable(),
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
    publicIdentity: z.enum(["resolved", "unresolved"]),
    publishing: z
      .object({
        authorised: z.literal(false),
        reason: z.literal("no_authorised_connection"),
        statement: z.literal(BLUESKY_PUBLISHING_STATEMENT),
      })
      .strict(),
  })
  .strict();

export const blueskyIdentityReplySchema = z
  .object({
    ok: z.literal(true),
    action: z.literal("blueskyIdentity"),
    result: blueskyIdentityResultSchema,
  })
  .strict();

// AT Protocol handles are domain names. The last label must start with a
// letter, which also rejects IPv4 literals and invented "handles" containing
// a password separator, path or whitespace.
export function normalizeBlueskyHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!withoutAt || withoutAt.length > BLUESKY_HANDLE_MAX) return null;
  const handle = withoutAt.toLowerCase();
  const labels = handle.split(".");
  if (labels.length < 2) return null;
  if (!/^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(labels.at(-1) ?? ""))
    return null;
  for (const label of labels.slice(0, -1))
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return null;
  return handle;
}

export function isBlueskyHandle(value: unknown): value is string {
  return normalizeBlueskyHandle(value) !== null;
}

export function isBlueskyDid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^did:(?:plc:[a-z2-7]{24}|web:[a-z0-9.-]{1,230})$/.test(value)
  );
}

function failure(
  status: Exclude<BlueskyIdentityStatus, "resolved">,
  handle: string | null,
  message: string,
  retryable = false,
): BlueskyIdentityResult {
  return {
    ok: false,
    status,
    handle,
    did: null,
    displayName: null,
    avatar: null,
    profileUrl: null,
    resolvedAt: null,
    source: null,
    message,
    retryable,
    publicIdentity: "unresolved",
    publishing,
  };
}

// The configured handle is public configuration, not a credential. An invalid
// value is treated as unconfigured here; the page shows the explicit
// needs-account state rather than guessing a profile.
export function configuredBlueskyHandle(runtime: unknown): string | null {
  if (!runtime || typeof runtime !== "object") return null;
  const value = (runtime as Record<string, unknown>)[BLUESKY_HANDLE_SETTING];
  return normalizeBlueskyHandle(value);
}

function safeAvatar(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function safeDisplayName(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 640)
    : null;
}

export interface BlueskyIdentityOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  now?: Date;
}

// Resolve a public handle through the AppView. The timeout is explicit and
// short; a failure is reported as a state, never as a resolved identity.
export async function resolveBlueskyIdentity(
  value: unknown,
  options: BlueskyIdentityOptions = {},
): Promise<BlueskyIdentityResult> {
  const handle = normalizeBlueskyHandle(value);
  if (value === null || value === undefined || value === "")
    return failure(
      "needs_account",
      null,
      "No Bluesky handle is configured. Enter the public handle you intend to use, or leave Bluesky unused.",
    );
  if (!handle)
    return failure(
      "invalid_handle",
      null,
      "That is not a valid public Bluesky handle. Use a handle such as name.bsky.social, without a password, path or spaces.",
    );
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function")
    return failure(
      "unavailable",
      handle,
      "The public Bluesky AppView cannot be reached in this environment. No identity was confirmed.",
      true,
    );
  const timeoutMs = Math.min(
    10_000,
    Math.max(10, options.timeoutMs ?? BLUESKY_PROFILE_TIMEOUT_MS),
  );
  const url = new URL(BLUESKY_PROFILE_PATH, BLUESKY_APPVIEW_ORIGIN);
  url.searchParams.set("actor", handle);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      doFetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, timeoutMs);
      }),
    ]);
    if (response.status === 400 || response.status === 404) {
      return failure(
        "not_found",
        handle,
        "The public AppView did not find that profile. Check the handle before trying again.",
      );
    }
    if (!response.ok)
      return failure(
        "unavailable",
        handle,
        `The public AppView returned ${response.status}. No identity was confirmed.`,
        response.status === 429 || response.status >= 500,
      );
    let payload: unknown;
    try {
      const declared = Number(response.headers.get("content-length") ?? "");
      if (Number.isFinite(declared) && declared > 65_536)
        return failure(
          "unavailable",
          handle,
          "The public AppView returned an oversized profile. No identity was confirmed.",
          true,
        );
      const text = await response.text();
      if (text.length > 65_536)
        return failure(
          "unavailable",
          handle,
          "The public AppView returned an oversized profile. No identity was confirmed.",
          true,
        );
      payload = JSON.parse(text);
    } catch {
      return failure(
        "unavailable",
        handle,
        "The public AppView returned an unreadable profile. No identity was confirmed.",
        true,
      );
    }
    if (!payload || typeof payload !== "object")
      return failure(
        "unavailable",
        handle,
        "The public AppView returned an invalid profile. No identity was confirmed.",
        true,
      );
    const profile = payload as Record<string, unknown>;
    if (!isBlueskyDid(profile.did))
      return failure(
        "unavailable",
        handle,
        "The public profile did not contain a valid DID. No identity was confirmed.",
      );
    const canonical = normalizeBlueskyHandle(profile.handle);
    if (!canonical)
      return failure(
        "unavailable",
        handle,
        "The public profile did not contain a valid handle. No identity was confirmed.",
      );
    if (canonical !== handle)
      return failure(
        "mismatch",
        handle,
        `The AppView reported @${canonical} for this request. Check the current handle before approving.`,
      );
    const resolvedAt = (options.now ?? new Date()).toISOString();
    return {
      ok: true,
      status: "resolved",
      handle,
      did: profile.did,
      displayName: safeDisplayName(profile.displayName),
      avatar: safeAvatar(profile.avatar),
      profileUrl: `https://bsky.app/profile/${handle}`,
      resolvedAt,
      source: BLUESKY_PUBLIC_SOURCE,
      message: BLUESKY_PUBLIC_IDENTITY_STATEMENT,
      retryable: false,
      publicIdentity: "resolved",
      publishing,
    };
  } catch (error) {
    const reason =
      error instanceof Error &&
      /timeout|abort/i.test(error.name + error.message)
        ? "The public AppView did not answer within the short timeout. No identity was confirmed."
        : "The public AppView could not be reached. No identity was confirmed.";
    return failure("unavailable", handle, reason, true);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

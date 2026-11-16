// Owner-only route logic for Share connections.
// The host authenticates the caller and checks the EmDash permission before
// dispatch. This second boundary rechecks the owner administrator role, the
// exact origin and the request marker, then the workspace capability. The page
// is the only place the app password is entered; this module verifies it
// against Bluesky once, stores it through the native encrypted plugin setting
// and never returns, logs or re-renders it.
import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import {
  BLUESKY_HANDLE_MAX,
  BLUESKY_HANDLE_SETTING,
  configuredBlueskyHandle,
  normalizeBlueskyHandle,
  resolveBlueskyIdentity,
  type BlueskyIdentityResult,
} from "./bluesky-account.ts";
import {
  BLUESKY_APP_PASSWORD_MAX,
  BLUESKY_APP_PASSWORD_MIN,
  BLUESKY_APP_PASSWORD_SETTING,
  createBlueskySession,
  normalizeBlueskyAppPassword,
  normalizeBlueskyService,
  type BlueskyPublishFailure,
} from "./bluesky-publisher.ts";
import {
  shareConnectionStatusSchema,
  type ShareConnectionHandleSource,
  type ShareConnectionPublishing,
  type ShareConnectionStatus,
} from "./share-connections.ts";
import { resolveWorkspace, requireCapability, StackError } from "./stacks.mjs";

export interface ShareConnectionsRuntime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  SHARE_BLUESKY_HANDLE?: unknown;
  SHARE_BLUESKY_PDS?: unknown;
  fetch?: typeof globalThis.fetch;
  // Test-only clock and timeout seams. Production leaves both unset.
  now?: Date;
  blueskyTimeoutMs?: number;
}

interface User {
  id: string;
  role: number;
}
interface PluginSettings {
  getVersioned<T>(key: string): Promise<{ value: T; revision: string } | null>;
  compareAndSet(
    key: string,
    expectedRevision: string | null,
    value: unknown,
  ): Promise<{ applied: boolean }>;
  compareAndDelete(
    key: string,
    expectedRevision: string,
  ): Promise<{ applied: boolean }>;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
  settings?: PluginSettings;
}

const origin = "https://composer.loftwah.com";
const unavailable = () => ({
  ok: false as const,
  code: "UNAVAILABLE",
  message: "Share connections are disconnected in this environment.",
});
const fail = (code: string, message: string) => ({
  ok: false as const,
  code,
  message,
});

// The read takes no fields; the write accepts exactly the two declared
// commands. No workspace, account or environment selector widens authority.
const readInput = z.object({}).strict();
const command = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("connect"),
      handle: z.string().trim().min(1).max(BLUESKY_HANDLE_MAX),
      // Bounds only the request; the shared normaliser applies the real
      // trimmed length, whitespace and control-character rules below.
      appPassword: z.string().min(1).max(4_096),
    })
    .strict(),
  z.object({ action: z.literal("disconnect") }).strict(),
]);

function database(value: unknown): value is D1Database {
  return Boolean(value && typeof value === "object" && "prepare" in value);
}

function requestDate(runtime: ShareConnectionsRuntime): Date {
  const value = runtime.now;
  return value instanceof Date && Number.isFinite(value.getTime())
    ? new Date(value.getTime())
    : new Date();
}

function pdsOrigin(runtime: ShareConnectionsRuntime): string | null {
  return normalizeBlueskyService(runtime.SHARE_BLUESKY_PDS) ?? null;
}

// The status ranks configuration, not authorisation. `connected` means the
// public profile resolved and Bluesky accepted the app password at save time;
// every post still needs its own exact approval.
function publishingSummary(
  handle: string | null,
  passwordConfigured: boolean,
  identity: BlueskyIdentityResult,
): ShareConnectionPublishing {
  const state =
    identity.status === "resolved" && passwordConfigured
      ? ("connected" as const)
      : identity.status === "invalid_handle"
        ? ("invalid_handle" as const)
        : !passwordConfigured || !handle
          ? ("not_configured" as const)
          : ("unavailable" as const);
  return {
    state,
    handle,
    note:
      state === "connected"
        ? "The public profile resolved and Bluesky accepted this app password when it was saved. Composer still sends only an exact, current owner approval; a saved connection authorises no post."
        : state === "invalid_handle"
          ? "The saved public handle is not a valid Bluesky handle. Save a valid handle to replace it; publishing stays off."
          : state === "not_configured"
            ? "No usable Bluesky connection is saved. Add a public handle and an app password, or leave Bluesky unused; nothing is sent without both plus an exact approval."
            : "The connection is saved, but the public profile could not be confirmed now. Composer will not treat it as connected until that profile resolves.",
  };
}

async function statusView(
  settings: PluginSettings,
  runtime: ShareConnectionsRuntime,
): Promise<ShareConnectionStatus> {
  const handleSetting = await settings.getVersioned<unknown>(
    BLUESKY_HANDLE_SETTING,
  );
  const storedHandle =
    handleSetting && typeof handleSetting.value === "string"
      ? handleSetting.value.trim()
      : "";
  const handle = configuredBlueskyHandle(runtime, storedHandle || undefined);
  const handleSource: ShareConnectionHandleSource = storedHandle
    ? "stored"
    : handle
      ? "environment"
      : "none";
  const passwordSetting = await settings.getVersioned<unknown>(
    BLUESKY_APP_PASSWORD_SETTING,
  );
  // Presence means the same value the send path would accept. A malformed
  // stored value is reported as not configured rather than as usable.
  const passwordConfigured =
    Boolean(passwordSetting) &&
    normalizeBlueskyAppPassword(passwordSetting?.value) !== null;
  const identity = await resolveBlueskyIdentity(
    handle ?? (storedHandle || null),
    { fetch: runtime.fetch, now: requestDate(runtime) },
  );
  return shareConnectionStatusSchema.parse({
    ok: true,
    handle,
    handleSource,
    passwordConfigured,
    identity,
    publishing: publishingSummary(handle, passwordConfigured, identity),
  });
}

// Fixed, safe codes and messages. A provider body, the entered credential and
// any session token are never included.
function connectFailure(failure: BlueskyPublishFailure) {
  if (failure.needsAuth)
    return fail(
      "CREDENTIAL_REJECTED",
      "Bluesky rejected that public handle or app password. Nothing was saved. Create a new app password in Bluesky Settings → App Passwords and try again.",
    );
  if (failure.code === "account_inactive")
    return fail(
      "BLOCKED",
      "The Bluesky account is not active, so no connection was saved.",
    );
  if (failure.transport || failure.retryable)
    return fail(
      "UNAVAILABLE",
      "The Bluesky service did not confirm this connection. Nothing was saved. Try again when the service is available.",
    );
  return fail(
    "BLOCKED",
    "Bluesky did not confirm this connection. Nothing was saved. Check the public handle and create a fresh app password.",
  );
}

async function connect(
  settings: PluginSettings,
  runtime: ShareConnectionsRuntime,
  handle: string,
  password: string,
) {
  const service = pdsOrigin(runtime);
  if (!service)
    return fail(
      "BLOCKED",
      "The configured Bluesky service address is not a plain https origin. Nothing was saved.",
    );
  const doFetch = runtime.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function")
    return fail(
      "UNAVAILABLE",
      "Composer has no network transport for Bluesky. Nothing was saved.",
    );
  const options = {
    fetch: doFetch,
    service,
    timeoutMs: runtime.blueskyTimeoutMs,
  };
  const sessionResult = await createBlueskySession(
    { identifier: handle, password },
    options,
  );
  if (!sessionResult.ok) return connectFailure(sessionResult);
  const session = sessionResult.session;
  // The app password is account-bound at Bluesky. Refuse a session for any
  // other account instead of saving a credential beside the wrong handle.
  if (session.handle !== handle)
    return fail(
      "BLOCKED",
      "Bluesky accepted that app password for a different account than the handle you entered. Nothing was saved.",
    );
  const identity = await resolveBlueskyIdentity(handle, {
    fetch: doFetch,
    now: requestDate(runtime),
  });
  if (identity.status !== "resolved" || identity.did !== session.did)
    return fail(
      identity.status === "unavailable" || identity.retryable
        ? "UNAVAILABLE"
        : "BLOCKED",
      "The app password was accepted, but the public profile did not confirm the same account. Nothing was saved.",
    );
  // Public configuration is written first: a failed credential write must
  // never leave a sendable app password without its exact public handle.
  const handleSetting = await settings.getVersioned<unknown>(
    BLUESKY_HANDLE_SETTING,
  );
  const handleSaved = await settings.compareAndSet(
    BLUESKY_HANDLE_SETTING,
    handleSetting?.revision ?? null,
    handle,
  );
  if (!handleSaved.applied)
    return fail(
      "CONFLICT",
      "Another window changed the public handle. Nothing was saved; refresh and try again.",
    );
  const passwordSetting = await settings.getVersioned<unknown>(
    BLUESKY_APP_PASSWORD_SETTING,
  );
  const passwordSaved = await settings.compareAndSet(
    BLUESKY_APP_PASSWORD_SETTING,
    passwordSetting?.revision ?? null,
    password,
  );
  if (!passwordSaved.applied)
    return fail(
      "CONFLICT",
      "The public handle was saved, but another window changed the app password. Refresh and connect again to finish.",
    );
  // Both writes succeeded and the identity was resolved before them, so the
  // exact connected state is returned without another provider read.
  return shareConnectionStatusSchema.parse({
    ok: true,
    handle,
    handleSource: "stored",
    passwordConfigured: true,
    identity,
    publishing: publishingSummary(handle, true, identity),
  });
}

// Removing the connection only removes its two settings. Delivery receipts and
// published posts are history and stay exactly as recorded.
async function disconnect(
  settings: PluginSettings,
  runtime: ShareConnectionsRuntime,
) {
  const passwordSetting = await settings.getVersioned<unknown>(
    BLUESKY_APP_PASSWORD_SETTING,
  );
  if (passwordSetting) {
    const removed = await settings.compareAndDelete(
      BLUESKY_APP_PASSWORD_SETTING,
      passwordSetting.revision,
    );
    if (!removed.applied)
      return fail(
        "CONFLICT",
        "The Bluesky connection changed in another window. Nothing was removed; refresh and try again.",
      );
  }
  const handleSetting = await settings.getVersioned<unknown>(
    BLUESKY_HANDLE_SETTING,
  );
  if (handleSetting) {
    const removed = await settings.compareAndDelete(
      BLUESKY_HANDLE_SETTING,
      handleSetting.revision,
    );
    if (!removed.applied)
      return fail(
        "CONFLICT",
        "The app password was removed, but the public handle changed in another window. Refresh and run disconnect again.",
      );
  }
  return statusView(settings, runtime);
}

export async function manageShareConnections(
  ctx: Context,
  runtime: ShareConnectionsRuntime,
) {
  if (!ctx.user || ctx.user.role !== 50 || !ctx.user.id)
    return fail(
      "FORBIDDEN",
      "A signed-in Composer owner administrator is required.",
    );
  if (runtime.PUBLIC_ORIGIN !== origin || !database(runtime.DB))
    return unavailable();
  const settings = ctx.settings;
  if (!settings)
    return fail(
      "UNAVAILABLE",
      "Native plugin settings are unavailable in this environment, so no connection can be stored or read.",
    );
  const db = runtime.DB;
  const reading = ctx.request.method === "GET";
  let requestOrigin: string | null = null;
  try {
    requestOrigin = new URL(ctx.request.url).origin;
  } catch {
    requestOrigin = null;
  }
  if (
    requestOrigin !== origin ||
    (ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin) ||
    ctx.request.headers.has("Authorization") ||
    (!reading &&
      (ctx.request.method !== "POST" ||
        ctx.request.headers.get("Origin") !== origin ||
        ctx.request.headers.get("X-EmDash-Request") !== "1"))
  )
    return fail("FORBIDDEN", "Open this action from Composer administration.");
  try {
    if (reading) {
      const url = new URL(ctx.request.url);
      for (const key of url.searchParams.keys())
        if (url.searchParams.getAll(key).length !== 1)
          throw new StackError(
            "INVALID",
            "The connection status takes no fields. Refresh the page.",
          );
      if (!readInput.safeParse(ctx.input ?? {}).success)
        return fail(
          "INVALID",
          "The connection status takes no fields. Refresh the page.",
        );
      const workspace = await resolveWorkspace(db, ctx.user, null);
      requireCapability(workspace.role, "read");
      return await statusView(settings, runtime);
    }
    const parsed = command.safeParse(ctx.input);
    if (!parsed.success)
      return fail(
        "INVALID",
        "Choose connect or disconnect and enter only the declared fields.",
      );
    const workspace = await resolveWorkspace(db, ctx.user, null);
    requireCapability(workspace.role, "save");
    if (parsed.data.action === "disconnect")
      return await disconnect(settings, runtime);
    const handle = normalizeBlueskyHandle(parsed.data.handle);
    if (!handle)
      return fail(
        "INVALID",
        "Enter a public Bluesky handle such as name.bsky.social, without a password, path or spaces. Nothing was saved.",
      );
    const password = normalizeBlueskyAppPassword(parsed.data.appPassword);
    if (!password)
      return fail(
        "INVALID",
        `An app password must be ${BLUESKY_APP_PASSWORD_MIN}–${BLUESKY_APP_PASSWORD_MAX} characters with no spaces or control characters. Nothing was saved.`,
      );
    return await connect(settings, runtime, handle, password);
  } catch (error) {
    if (error instanceof StackError) return fail(error.code, error.message);
    return fail(
      "UNAVAILABLE",
      "The Bluesky connection could not be confirmed. Refresh before retrying.",
    );
  }
}

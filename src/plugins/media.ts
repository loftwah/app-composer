import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import { definePlugin, PluginRouteError } from "emdash";
import {
  MediaContractError,
  mediaActions,
} from "../lib/media-capability.mjs";
import { runAction, statusSnapshot } from "../lib/media-capability-runtime.mjs";
import { studioAccess } from "../lib/member-access.ts";

type Context = {
  user?: { id: string; role: number };
  request: Request;
  input: unknown;
};

function actor(ctx: Context) {
  if (!ctx.user || ctx.user.role < 50)
    throw new PluginRouteError(
      "FORBIDDEN",
      "Images & video requires a signed-in administrator.",
      403,
    );
  return ctx.user.id;
}

async function guarded(work: () => Promise<unknown>) {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof MediaContractError)
      throw new PluginRouteError(error.code, error.message, error.status);
    if (error instanceof PluginRouteError) throw error;
    throw new PluginRouteError(
      "MEDIA_UNAVAILABLE",
      "The media capability could not complete this request. Nothing was sent twice; reopen the job to see its state.",
      502,
    );
  }
}

export async function readMedia(ctx: Context) {
  actor(ctx);
  if (ctx.request.method !== "GET")
    throw new PluginRouteError("METHOD_NOT_ALLOWED", "This view is read-only.", 405);
  const url = new URL(ctx.request.url);
  const job = url.searchParams.get("job");
  if (job && !/^job_[a-z0-9]{21}$/.test(job))
    throw new PluginRouteError("INVALID", "That job reference is not valid.", 400);
  return guarded(async () => ({
    status: await statusSnapshot(env),
    job: job
      ? (await statusSnapshot(env)).jobs.find((entry: { id: string }) => entry.id === job) ?? null
      : null,
  }));
}

export async function writeMedia(ctx: Context) {
  const by = actor(ctx);
  if (ctx.request.method !== "POST")
    throw new PluginRouteError("METHOD_NOT_ALLOWED", "Use a POST request.", 405);
  const body = (ctx.input ?? {}) as Record<string, unknown>;
  const action = body.action;
  if (typeof action !== "string" || !mediaActions.includes(action as never))
    throw new PluginRouteError("INVALID_ACTION", "Choose a supported media action.", 400);
  return guarded(() => runAction(env, action, body, by));
}

function base64url(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function bridgeToken(secret: string, claim: Record<string, unknown>) {
  const payload = base64url(JSON.stringify(claim));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return payload + "." + hex;
}

/** An authorised handoff from the current EmDash administrator.
 *
 * The claim names the actor, workspace, selected project and current action
 * set. It is deliberately not a generic owner cookie: the studio re-checks
 * these grants with Composer before every privileged dispatch. */
export async function studioHandoff(ctx: Context) {
  const by = actor(ctx);
  const runtime = env as unknown as {
    DB?: D1Database;
    MEDIA_STUDIO_BRIDGE_SECRET?: string;
    MEDIA_STUDIO_ORIGIN?: string;
  };
  const secret = runtime.MEDIA_STUDIO_BRIDGE_SECRET;
  const origin = runtime.MEDIA_STUDIO_ORIGIN;
  if (!secret || !origin || !runtime.DB)
    throw new PluginRouteError(
      "SETUP_REQUIRED",
      "The studio handoff is not configured on this deployment.",
      503,
    );
  const workspace = await runtime.DB.prepare(
    `SELECT w.id,w.name FROM creator_members m JOIN creator_workspaces w ON w.id=m.workspace_id
     WHERE m.user_id=? ORDER BY CASE WHEN m.role='owner' THEN 0 ELSE 1 END, w.created_at, w.id LIMIT 1`,
  )
    .bind(by)
    .first<{ id: string; name: string }>();
  if (!workspace)
    throw new PluginRouteError("FORBIDDEN", "This account has no Composer workspace.", 403);
  const access = await studioAccess(
    runtime.DB,
    { id: by, email: "", name: ctx.user?.id ?? null, role: 50 },
    workspace.id,
  );
  if (!access.actions.includes("read"))
    throw new PluginRouteError(
      "FORBIDDEN",
      "This account does not have current Media Studio access.",
      403,
    );
  const token = await bridgeToken(secret, {
    aud: "media-studio",
    iss: "https://composer.loftwah.com",
    sub: by,
    actorName: ctx.user?.id ?? "Composer admin",
    workspace: workspace.id,
    workspaceName: workspace.name,
    project: null,
    actions: access.actions,
    revision: access.revision,
    exp: Date.now() + 120_000,
    jti: crypto.randomUUID(),
  });
  const target = new URL("/bridge", origin);
  target.searchParams.set("token", token);
  return new Response(null, {
    status: 302,
    headers: { Location: target.href, "Cache-Control": "no-store" },
  });
}

export function createPlugin(options: { adminEntry: string }) {
  return definePlugin({
    id: "composer-media",
    version: "1.0.0",
    admin: {
      entry: options.adminEntry,
      pages: [{ path: "/media", label: "Images & video", icon: "image" }],
    },
    routes: {
      read: {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: readMedia,
      },
      studio: {
        methods: ["GET"],
        permission: "plugins:manage",
        handler: studioHandoff,
      },
      write: {
        methods: ["POST"],
        permission: "plugins:manage",
        request: { body: "json", maxBytes: 64_000 },
        handler: writeMedia,
      },
    },
  });
}

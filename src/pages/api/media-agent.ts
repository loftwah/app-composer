import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  MediaContractError,
  mediaAgentActions,
  mediaAgentPermissions,
} from "../../lib/media-capability.mjs";
import {
  resolveAgentScope,
  runAction,
} from "../../lib/media-capability-runtime.mjs";

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1)
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/** The authorised agent surface for the same media handlers the native panel
 * uses. A bearer token is only a lookup: the workspace, permissions, revision
 * and expiry all come from the owner-issued grant row, never from this request.
 *
 * The pre-#599 deployment-wide `MEDIA_AGENT_TOKEN` no longer grants workspace
 * media access. It is refused explicitly so an old automation cannot keep
 * deployment-wide reach; the owner issues a workspace grant and replaces it. */
export const POST: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("Origin");
  if (suppliedOrigin && suppliedOrigin !== origin)
    return json({ error: "Unsupported origin." }, 403);
  const runtime = env as unknown as Record<string, unknown>;
  const legacy = runtime.MEDIA_AGENT_TOKEN;
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: "That agent token is not admitted." }, 401);
  if (typeof legacy === "string" && legacy && sameSecret(token, legacy))
    return json(
      {
        ok: false,
        code: "AGENT_SCOPE_REQUIRED",
        error:
          "The deployment-wide media agent token no longer grants workspace media access. Issue a workspace-scoped agent grant in Images & video, then use that token.",
      },
      403,
    );

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Send a JSON body." }, 400);
  }
  const action = body.action;
  if (typeof action !== "string" || !mediaAgentActions.includes(action as never))
    return json(
      {
        ok: false,
        code: "UNSUPPORTED_ACTION",
        error:
          "An agent may read status, generate, reconcile or import. Connection, credential and grant administration stay with the owner.",
      },
      403,
    );
  const selector =
    typeof body.workspace === "string"
      ? body.workspace
      : request.headers.get("X-Composer-Workspace");
  try {
    const scope = await resolveAgentScope(runtime, {
      token,
      workspace: selector ?? null,
    });
    const result = await runAction(runtime, action, scope, body);
    return json({
      ok: true,
      data: { ...(result as Record<string, unknown>), permissions: mediaAgentPermissions },
    });
  } catch (error) {
    if (error instanceof MediaContractError)
      return json({ ok: false, error: error.message, code: error.code }, error.status);
    return json(
      {
        ok: false,
        error:
          "The media capability could not complete this request. Reopen the job before retrying.",
        code: "MEDIA_UNAVAILABLE",
      },
      502,
    );
  }
};

export const GET: APIRoute = async () =>
  json({ error: "Use POST with an action." }, 405);

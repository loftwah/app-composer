import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  MediaContractError,
  mediaActions,
} from "../../lib/media-capability.mjs";
import { runAction } from "../../lib/media-capability-runtime.mjs";

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
 * uses. A bearer token admits the call; the browser session is never involved. */
export const POST: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("Origin");
  if (suppliedOrigin && suppliedOrigin !== origin)
    return json({ error: "Unsupported origin." }, 403);
  const expected = (env as unknown as { MEDIA_AGENT_TOKEN?: string }).MEDIA_AGENT_TOKEN;
  if (!expected)
    return json(
      { error: "The agent token is not configured on this deployment." },
      503,
    );
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !sameSecret(token, expected))
    return json({ error: "That agent token is not admitted." }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Send a JSON body." }, 400);
  }
  const action = body.action;
  if (typeof action !== "string" || !mediaActions.includes(action as never))
    return json({ error: "Choose a supported media action." }, 400);
  try {
    const result = await runAction(
      env as unknown as Record<string, unknown>,
      action,
      body,
      "agent:" + (request.headers.get("X-Agent-Name") ?? "authorised-agent").slice(0, 60),
    );
    return json({ ok: true, data: result });
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

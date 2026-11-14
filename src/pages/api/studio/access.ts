import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import { studioAccess } from "../../../lib/member-access";

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

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Server-to-server grant introspection for the independent Media Studio.
 *
 * The studio signs the exact body and timestamp with the shared bridge secret.
 * A current workspace membership and current media-studio grants are read from
 * D1 on every call, so revoking a member or a grant stops the next privileged
 * studio dispatch. This endpoint never returns provider keys, media or a
 * studio session. */
export const POST: APIRoute = async ({ request }) => {
  const runtime = env as unknown as {
    DB?: D1Database;
    MEDIA_STUDIO_BRIDGE_SECRET?: string;
  };
  const secret = runtime.MEDIA_STUDIO_BRIDGE_SECRET;
  if (!runtime.DB || !secret)
    return json({ ok: false, error: "Studio access is not configured." }, 503);

  const timestamp = request.headers.get("x-studio-timestamp") ?? "";
  const supplied = request.headers.get("x-studio-signature") ?? "";
  const issued = Number(timestamp);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > 5 * 60 * 1000)
    return json({ ok: false, error: "The studio grant request expired." }, 401);

  const raw = await request.text();
  if (raw.length > 8_000)
    return json({ ok: false, error: "The studio grant request is too large." }, 413);
  const expected = await hmac(secret, `${timestamp}.${raw}`);
  if (!sameSecret(supplied, expected))
    return json({ ok: false, error: "The studio grant signature is invalid." }, 401);

  let body: {
    actor?: unknown;
    workspace?: unknown;
    project?: unknown;
    revision?: unknown;
    actions?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Send a JSON body." }, 400);
  }
  if (
    typeof body.actor !== "string" ||
    body.actor.length > 128 ||
    typeof body.workspace !== "string" ||
    !/^[a-z0-9-]{6,64}$/.test(body.workspace)
  )
    return json({ ok: false, error: "Name an actor and workspace." }, 400);

  const member = await runtime.DB.prepare(
    "SELECT user_id AS id, email, display_name AS name FROM creator_members WHERE workspace_id=? AND user_id=?",
  )
    .bind(body.workspace, body.actor)
    .first<{ id: string; email: string | null; name: string | null }>();
  if (!member)
    return json(
      { ok: false, error: "This account is not a member of that workspace." },
      403,
    );

  try {
    const access = await studioAccess(
      runtime.DB,
      {
        id: member.id,
        email: member.email ?? "",
        name: member.name,
        role: 20,
      },
      body.workspace,
    );
    return json({
      ok: true,
      actor: member.id,
      workspace: body.workspace,
      actions: access.actions,
      revision: access.revision,
      project: typeof body.project === "string" ? body.project : null,
    });
  } catch {
    return json(
      { ok: false, error: "This account does not have current studio access." },
      403,
    );
  }
};

export const GET: APIRoute = () =>
  json({ ok: false, error: "Use POST from the studio." }, 405);

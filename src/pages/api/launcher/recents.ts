import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import { loadLauncherRecents } from "../../../lib/launcher-recents";

export const prerender = false;

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });

/** One signed-in owner's most recent Composer project.
 *
 * This endpoint reads no query parameters. The account comes from the resolved
 * EmDash session and the workspace from that account's current memberships, so
 * a caller cannot name another tenant's project. Anonymous callers get no
 * project data. */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ ok: false, error: "Sign in to see recent projects." }, 401);
  const runtime = env as unknown as { DB?: D1Database };
  if (!runtime.DB || typeof runtime.DB.prepare !== "function")
    return json({ ok: false, error: "Recent projects are unavailable." }, 503);
  try {
    const recents = await loadLauncherRecents(runtime.DB, user.id);
    return json({ ok: true, ...recents });
  } catch {
    return json({ ok: false, error: "Recent projects are unavailable." }, 503);
  }
};

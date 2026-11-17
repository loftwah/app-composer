import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import { handleShareFeedback } from "../../lib/share-feedback.ts";

export const prerender = false;
const route: APIRoute = ({ request, locals }) =>
  handleShareFeedback(request, locals.user?.id, (env as unknown as { DB?: D1Database }).DB);
export const GET = route;
export const POST = route;

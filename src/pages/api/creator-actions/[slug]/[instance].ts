import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  collectStackAction,
  type OutcomeRuntime,
} from "../../../../lib/private-outcome-events";

export const prerender = false;
export const ALL: APIRoute = ({ request, params }) =>
  collectStackAction(
    request,
    env as unknown as OutcomeRuntime,
    params.slug ?? "",
    params.instance ?? "",
  );

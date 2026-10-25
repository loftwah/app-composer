import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { teamHubPageGate, type TeamHubRuntime } from "./lib/team-hub";
import {
  prepareAdminBrand,
  brandAdminResponse,
  adminBrandStyles,
  type BrandRuntime,
} from "./lib/admin-brand";

const runtime = env as unknown as BrandRuntime & TeamHubRuntime & {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUDIENCE?: string;
  GUESTBOOK?: { fetch(req: Request): Promise<Response> };
  SHOWCASE?: { fetch(req: Request): Promise<Response> };
};
export const onRequest = defineMiddleware(async (context, next) => {
  const app = context.url.pathname.match(
    /^\/(guestbook|showcase)(?:\/|$)/,
  )?.[1];
  if (app) {
    const binding = app === "guestbook" ? runtime.GUESTBOOK : runtime.SHOWCASE;
    if (!binding)
      return new Response(
        "This isolated environment has no app service binding.",
        {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    return binding.fetch(context.request);
  }
  if (context.url.pathname === "/_emdash/composer-admin-brand.css") {
    return adminBrandStyles(
      { request: context.request, user: context.locals.user },
      runtime,
    );
  }
  const teamRejection = await teamHubPageGate(context, runtime);
  if (teamRejection) return teamRejection;
  const appearance = await prepareAdminBrand(context, runtime);
  const response = await brandAdminResponse(await next(), appearance);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cache-Control", "no-store");
  return response;
});

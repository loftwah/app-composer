import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import {
  protectResolvedAdministration,
  type AccessRuntime,
} from "./lib/access-boundary.mjs";
import { teamHubPageGate, type TeamHubRuntime } from "./lib/team-hub";
import {
  prepareAdminBrand,
  brandAdminResponse,
  adminBrandStyles,
  type BrandRuntime,
} from "./lib/admin-brand";

const runtime = env as unknown as BrandRuntime &
  TeamHubRuntime &
  AccessRuntime & {
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUDIENCE?: string;
    GUESTBOOK?: { fetch(req: Request): Promise<Response> };
    SHOWCASE?: { fetch(req: Request): Promise<Response> };
  };
export const onRequest = defineMiddleware(async (context, next) => {
  const identityRejection = await protectResolvedAdministration(
    context.request,
    context.locals.user,
    runtime,
    context.session,
  );
  if (identityRejection) {
    context.locals.user = undefined;
    return identityRejection;
  }
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
  // The public widget catalogue embeds exactly one reviewed third-party origin.
  // Astro's global CSP keeps frame-src 'none' everywhere else; this route swaps
  // in that one origin. The swap is exact-match and fails closed: if the token
  // moves, the page simply stays blocked instead of widening trust.
  if (context.url.pathname === "/widgets") {
    const csp = response.headers.get("content-security-policy");
    if (csp) {
      response.headers.set(
        "content-security-policy",
        csp.replace(
          "frame-src 'none'",
          "frame-src https://fm.loftwah.com",
        ),
      );
    }
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cache-Control", "no-store");
  return response;
});

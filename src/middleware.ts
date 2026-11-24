import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { posterUrl as widgetFilmPoster, videoUrl as widgetFilmVideo } from "./lib/studio-film-starter";
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
  // Keep the reviewed player origin and exact published film URLs scoped to
  // the widget catalogue. English captions are served by Composer.
  if (context.url.pathname === "/widgets") {
    const csp = response.headers.get("content-security-policy");
    if (csp) {
      response.headers.set(
        "content-security-policy",
        csp
          .replace(
            "frame-src 'none'",
            "frame-src https://fm.loftwah.com",
          )
          // The opt-in film preview streams the pinned public video and poster
          // on this one route. Its captions stay same-origin, so no data: source
          // is added and every other page keeps Astro's strict global policy.
          .replace(
            "img-src 'self'",
            `img-src 'self' ${widgetFilmPoster}`,
          )
          .replace(
            "default-src 'self'",
            `default-src 'self'; media-src 'self' ${widgetFilmVideo}`,
          ),
      );
    }
  }
  if (context.url.pathname === "/top-nine" || context.url.pathname === "/share/experiences/top-nine") {
    const csp = response.headers.get("content-security-policy");
    if (csp) {
      response.headers.set(
        "content-security-policy",
        csp
          // Catalogue search (iTunes), Wikidata film/game metadata and the
          // official Spotify oEmbed album read are the only outbound calls on
          // these two entry URLs.
          .replace("connect-src 'self'", "connect-src 'self' https://itunes.apple.com https://www.wikidata.org https://open.spotify.com")
          .replace("frame-src 'none'", "frame-src https://embed.music.apple.com https://open.spotify.com")
          // A cover a person picks from their device renders from a local blob:
          // URL kept in this document only, never uploaded or fetched remotely.
          .replace("img-src 'self'", "img-src 'self' blob:"),
      );
    }
  }
  if (/^\/share\/experiences\/(twenty-one-questions|this-or-that|developer-type|language-type)\/?$/.test(context.url.pathname)) {
    const csp = response.headers.get("content-security-policy");
    if (csp) {
      // Quiz cards and private prompt photos use image URLs from local Blobs.
      response.headers.set("content-security-policy", csp.replace("img-src 'self'", "img-src 'self' blob:"));
    }
  }
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cache-Control", "no-store");
  return response;
});

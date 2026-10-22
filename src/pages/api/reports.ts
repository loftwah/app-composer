import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import { portfolioSummary } from "../../../lib/usage/portfolio.mjs";
import type { PublicHistory } from "../../lib/activity-view.ts";
import {
  buildReport,
  reportScope,
  reportUrl,
  storeReport,
} from "../../lib/public-report.ts";
import build from "../../lib/build.json";

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

export const POST: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get("Origin");
  if (suppliedOrigin && suppliedOrigin !== origin)
    return json({ error: "Open this action from App Composer." }, 403);
  const runtime = env as unknown as {
    DB?: D1Database;
    USAGE_LIMIT?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  };
  if (!runtime.DB || typeof runtime.DB.prepare !== "function")
    return json({ error: "Public reports are unavailable in this environment." }, 503);
  if (runtime.USAGE_LIMIT) {
    const allowed = await runtime.USAGE_LIMIT.limit({ key: "public-report" });
    if (!allowed.success)
      return json({ error: "Too many report requests. Try again in a minute." }, 429);
  }
  let params: URLSearchParams;
  const type = request.headers.get("content-type")?.split(";")[0];
  try {
    if (type === "application/json") {
      const body = (await request.json()) as Record<string, unknown>;
      params = new URLSearchParams(
        Object.entries(body)
          .filter(([, value]) => typeof value === "string" || typeof value === "number")
          .map(([key, value]) => [key, String(value)]),
      );
    } else if (type === "application/x-www-form-urlencoded" || type === "multipart/form-data") {
      const body = await request.formData();
      params = new URLSearchParams();
      for (const [key, value] of body)
        if (typeof value === "string") params.set(key, value);
    } else {
      return json({ error: "Use a form or JSON request." }, 415);
    }
  } catch {
    return json({ error: "The report request could not be read." }, 400);
  }
  let scope;
  try {
    scope = reportScope(params);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Choose a supported report." },
      400,
    );
  }
  try {
    // Recompute from the server's public aggregate; never trust a client total.
    const report = (await portfolioSummary(
      runtime.DB,
      scope.days,
      new Date(),
      build.commit,
      scope.surface as "all" | "standalone" | "composed",
    )) as unknown as PublicHistory;
    const frozen = await buildReport(report, scope, build.commit);
    await storeReport(runtime.DB, frozen);
    if (request.headers.get("accept")?.includes("application/json"))
      return json({
        ok: true,
        id: frozen.id,
        url: reportUrl(frozen.id),
        images: {
          landscape: `${reportUrl(frozen.id)}/landscape.png`,
          square: `${reportUrl(frozen.id)}/square.png`,
          portrait: `${reportUrl(frozen.id)}/portrait.png`,
        },
      });
    return new Response(null, {
      status: 303,
      headers: { Location: `/reports/${frozen.id}`, "Cache-Control": "no-store" },
    });
  } catch {
    return json({ error: "The public report could not be created." }, 503);
  }
};

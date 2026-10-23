import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import {
  isReportFormat,
  readReport,
  reportIdPattern,
} from "../../../lib/public-report.ts";
import { renderReportImage } from "../../../lib/report-share-image.ts";

export const GET: APIRoute = async ({ params, request }) => {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const missing = () =>
    new Response("No frozen report image exists at this address.", {
      status: 404,
      headers,
    });
  const unavailable = () =>
    new Response("The frozen report image is temporarily unavailable.", {
      status: 503,
      headers,
    });
  const id = params.id ?? "";
  const format = params.format ?? "";
  if (!reportIdPattern.test(id) || !isReportFormat(format)) return missing();
  const runtime = env as unknown as { DB?: D1Database };
  if (!runtime.DB || typeof runtime.DB.prepare !== "function") return unavailable();
  try {
    const report = await readReport(runtime.DB, id);
    if (!report) return missing();
    if (request.method === "HEAD") {
      headers.set("Content-Type", "image/png");
      return new Response(null, { headers });
    }
    const image = await renderReportImage(report, format);
    headers.set("Content-Type", "image/png");
    return new Response(image, { headers });
  } catch {
    return unavailable();
  }
};

export const HEAD = GET;

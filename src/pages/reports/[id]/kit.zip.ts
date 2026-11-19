import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import { zip } from "../../../../lib/launch-kit/archive.mjs";
import { readReport, reportCaption, reportFormats, reportIdPattern, reportKitManifest, type ReportFormat } from "../../../lib/public-report.ts";
import { renderReportImage } from "../../../lib/report-share-image.ts";

export const GET: APIRoute = async ({ params, request }) => {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const missing = () => new Response("No frozen report exists at this address.", { status: 404, headers });
  const unavailable = () => new Response("The report kit is temporarily unavailable. The individual report cards can be opened from the report.", { status: 503, headers });
  const id = params.id ?? "";
  if (!reportIdPattern.test(id)) return missing();
  const runtime = env as unknown as { DB?: D1Database };
  if (!runtime.DB || typeof runtime.DB.prepare !== "function") return unavailable();

  try {
    const report = await readReport(runtime.DB, id);
    if (!report) return missing();
    const attachment = {
      ...headers,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="composer-report-${id}-kit.zip"`,
    };
    if (request.method === "HEAD") return new Response(null, { headers: attachment });
    const files = new Map<string, Uint8Array>();
    for (const format of Object.keys(reportFormats) as ReportFormat[]) {
      files.set(`composer-report-${id}-${format}.png`, await renderReportImage(report, format));
    }
    const encoder = new TextEncoder();
    files.set("post-text.txt", encoder.encode(`${reportCaption(report)}\n`));
    files.set("report.json", encoder.encode(`${JSON.stringify(reportKitManifest(report), null, 2)}\n`));
    return new Response(zip(files), { headers: attachment });
  } catch {
    return unavailable();
  }
};

export const HEAD = GET;

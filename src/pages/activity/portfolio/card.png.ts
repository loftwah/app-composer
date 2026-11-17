import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import build from "../../../lib/build.json";
import { portfolioCard } from "../../../lib/portfolio-card";
import { portfolioCardFormat, portfolioCardFormats } from "../../../lib/portfolio-card-formats";
import { portfolioProjects } from "../../../lib/portfolio-projects";
import { parsePortfolioPeriod, readProjectReport } from "../../../lib/portfolio-report";

export const GET: APIRoute = async ({ url, request }) => {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const params = url.searchParams;
  const period = parsePortfolioPeriod(params);
  const project = portfolioProjects.find((item) => item.id === params.get("project"));
  const key = params.get("metric");
  const format = portfolioCardFormat(params.get("format"));
  if (!period || !format || !project?.endpoint || !key || !project.measures.includes(key))
    return new Response("Unknown public report.", { status: 404, headers });

  const runtime = env as unknown as { DB: D1Database };
  const report = await readProjectReport(project, period, runtime.DB, build.commit);
  if (!report) return new Response("Public source temporarily unavailable.", { status: 503, headers });
  const metric = report.metrics.find((item) => item.key === key);
  if (!metric || metric.value === null)
    return new Response("This measure has no public data for the selected window.", { status: 404, headers });

  const { width, height } = portfolioCardFormats[format];
  const png = { ...headers, "Content-Type": "image/png", "X-Portfolio-Card": `${width}x${height}` };
  if (request.method === "HEAD") return new Response(null, { headers: png });
  try {
    const card = await portfolioCard(project, metric, period, format);
    return new Response(card, { headers: png });
  } catch {
    return new Response("The card could not render.", { status: 503, headers });
  }
};

export const HEAD = GET;

import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import build from "../../../lib/build.json";
import { zip } from "../../../../lib/launch-kit/archive.mjs";
import { portfolioCaption, portfolioDateRange, portfolioTotal } from "../../../lib/portfolio-caption";
import { portfolioCard } from "../../../lib/portfolio-card";
import { portfolioProjects } from "../../../lib/portfolio-projects";
import {
  parsePortfolioPeriod, readProjectReport, reportAddress, sourceAddress, REPORT_PATH,
} from "../../../lib/portfolio-report";

const FORMATS = ["landscape", "square", "portrait"] as const;

export const GET: APIRoute = async ({ url, request }) => {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const params = url.searchParams;
  const period = parsePortfolioPeriod(params);
  const project = portfolioProjects.find((item) => item.id === params.get("project"));
  const key = params.get("metric");
  if (!period || !project?.endpoint || !key || !project.measures.includes(key))
    return new Response("Unknown public report.", { status: 404, headers });

  const runtime = env as unknown as { DB: D1Database };
  const report = await readProjectReport(project, period, runtime.DB, build.commit);
  if (!report) return new Response("Public source temporarily unavailable.", { status: 503, headers });
  const metric = report.metrics.find((item) => item.key === key);
  if (!metric || metric.value === null)
    return new Response("This measure has no public data for the selected window.", { status: 404, headers });

  const canonical = new URL(reportAddress(project.id, period, metric.key), "https://composer.loftwah.com").href;
  const caption = portfolioCaption({
    name: project.name, total: portfolioTotal(metric), label: metric.label,
    dateRange: portfolioDateRange(period), quality: metric.quality, canonical,
  });
  const source = sourceAddress(project, period)?.href ?? "";
  const slug = `${project.id}-${metric.key}-${period.to}`.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  const name = `${slug}-social-kit.zip`;
  const attachment = { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` };
  if (request.method === "HEAD") return new Response(null, { headers: attachment });

  const encoder = new TextEncoder();
  const files = new Map<string, Uint8Array>();

  try {
    // Sequential on purpose: one report, one renderer, three formats in order.
    for (const format of FORMATS) {
      const card = await portfolioCard(project, metric, period, format);
      files.set(`${slug}-${format}.png`, card);
    }
  } catch {
    return new Response("A report card could not render.", { status: 503, headers });
  }

  const manifest = {
    schema: "composer.portfolio-social-kit/v1",
    project: project.id,
    projectName: project.name,
    measurement: {
      key: metric.key, label: metric.label, definition: metric.definition,
      quality: metric.quality, value: metric.value, unit: metric.unit,
      cap: metric.days.some((day) => day.capped),
    },
    window: { from: period.from, to: period.to, days: period.days, timezone: "UTC" },
    canonical,
    source,
    ...(report.revision ? { revision: report.revision } : {}),
  };
  files.set("post-text.txt", encoder.encode(`${caption}\n${source}\n`));
  files.set("report.json", encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`));

  try {
    return new Response(zip(files), { headers: attachment });
  } catch {
    return new Response("The report could not be packaged. Use the individual card downloads.", { status: 503, headers });
  }
};

export const HEAD = GET;

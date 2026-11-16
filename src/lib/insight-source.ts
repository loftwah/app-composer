// Server-owned resolution for the public insight. The population is read from
// the same public catalogue the rest of the site links to, never from a
// request parameter.
import type { D1Database } from "@cloudflare/workers-types";
import { portfolioSummary } from "../../lib/usage/portfolio.mjs";
import { apps } from "./apps.ts";
import {
  insightWindow,
  publicInsight,
  type InsightResult,
  type InsightWindow,
} from "./activity-insight.ts";
import type { PublicHistory } from "./activity-view.ts";

export const publicAppIds = () =>
  apps.filter((app) => Boolean(app.href)).map((app) => app.id);

export async function resolveInsight(
  db: D1Database,
  window: InsightWindow,
  options: { revision: string; readAt: Date },
): Promise<InsightResult> {
  const summary = await portfolioSummary(
    db,
    { from: window.from, to: window.to },
    options.readAt,
    options.revision,
    window.surface,
  );
  return publicInsight(summary as unknown as PublicHistory, window, {
    revision: options.revision,
    readAt: options.readAt,
    publicApps: publicAppIds(),
  });
}

export async function insightFromParams(
  db: D1Database | undefined,
  params: URLSearchParams,
  options: { revision: string; readAt?: Date },
): Promise<InsightResult> {
  const readAt = options.readAt ?? new Date();
  const parsed = insightWindow(params, readAt);
  if (parsed.status !== "ok") return parsed;
  if (!db || typeof db.prepare !== "function")
    return {
      status: "unavailable",
      reason: "The public aggregate is disconnected in this environment.",
    };
  try {
    return await resolveInsight(db, parsed.window, {
      revision: options.revision,
      readAt,
    });
  } catch {
    return {
      status: "unavailable",
      reason: "The counter read did not complete, so this insight is withheld.",
    };
  }
}

import { portfolioSummary } from "../../lib/usage/portfolio.mjs";
import type { ActivityDay } from "./activity-view";
import type { PortfolioProject } from "./portfolio-projects";
import type { D1Database } from "@cloudflare/workers-types";

export const REPORT_PATH = "/activity/portfolio";
const DAY = 86_400_000;
const SCHEMA = "woodhouse.portfolio-analytics/1";
const qualities = ["exact", "sampled", "bounded", "partial", "unavailable"] as const;
type Quality = (typeof qualities)[number];
export type Period = { from: string; to: string; days: number };
export type PortfolioMetric = {
  key: string;
  label: string;
  value: number | null;
  definition: string;
  quality: Quality;
  unit: "count" | "seconds";
  days: ActivityDay[];
};
export type ProjectReport = {
  metrics: PortfolioMetric[];
  comparableFrom: string | null;
  limitations: string[];
  revision: string | null;
};

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const isDay = (value: string | null): value is string =>
  !!value && /^\d{4}-\d\d-\d\d$/.test(value) &&
  Number.isFinite(Date.parse(value)) && isoDay(Date.parse(value)) === value;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= limit && !/[<>\x00-\x1f]/.test(value);
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const quality = (value: unknown): value is Quality => qualities.some((known) => known === value);

export function recentPeriod(days: number, now = Date.now()): Period {
  const to = Date.parse(isoDay(now)) - DAY;
  return { from: isoDay(to - (days - 1) * DAY), to: isoDay(to), days };
}

export function parsePortfolioPeriod(params: URLSearchParams, now = Date.now()): Period | null {
  const from = params.get("from");
  const to = params.get("to");
  if (["from", "to", "days"].some((key) => params.getAll(key).length > 1)) return null;
  if (!params.has("from") && !params.has("to")) {
    const chosen = params.get("days") ?? "7";
    return chosen === "7" || chosen === "30" ? recentPeriod(Number(chosen), now) : null;
  }
  if (params.has("days") || !isDay(from) || !isDay(to) || to >= isoDay(now)) return null;
  const days = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  return days === 7 || days === 30 ? { from, to, days } : null;
}

export function previousPeriod(period: Period): Period {
  const from = Date.parse(period.from);
  return { from: isoDay(from - period.days * DAY), to: isoDay(from - DAY), days: period.days };
}

export function reportAddress(project: string, period: Period, metric?: string, path = REPORT_PATH) {
  const query = new URLSearchParams({ project, from: period.from, to: period.to });
  if (metric) query.set("metric", metric);
  return `${path}?${query}`;
}

export function sourceAddress(project: PortfolioProject, period: Period) {
  if (!project.endpoint) return undefined;
  const url = new URL(project.endpoint);
  url.searchParams.set("from", period.from);
  url.searchParams.set("to", period.to);
  return url;
}

// Public allowlisted producers only. Use the exact requested window, never
// forward producer-provided URLs, and retain gaps and cap markers as supplied.
export function parseProjectReport(raw: unknown, project: PortfolioProject, period: Period): ProjectReport | null {
  if (!object(raw) || raw.schema !== SCHEMA || raw.project !== project.id || raw.timezone !== "UTC" ||
    !object(raw.period) || raw.period.from !== period.from || raw.period.to !== period.to ||
    raw.period.days !== period.days || raw.period.complete !== true ||
    !object(raw.coverage) || !Array.isArray(raw.metrics) || raw.metrics.length > 40) return null;

  const metrics: PortfolioMetric[] = [];
  for (const key of project.measures) {
    const matches = raw.metrics.filter((metric) => object(metric) && metric.key === key);
    if (matches.length === 0) continue;
    const item: unknown = matches[0];
    if (matches.length !== 1 || !object(item) || !text(item.label, 100) ||
      !text(item.definition, 1600) || !quality(item.quality) ||
      (item.unit !== "count" && item.unit !== "seconds") ||
      !(item.value === null || count(item.value)) ||
      (item.value === null) !== (item.quality === "unavailable") ||
      !Array.isArray(item.daily) || item.daily.length > period.days) return null;
    const values = new Map<string, { value: number; capped: boolean }>();
    for (const day of item.daily) {
      if (!object(day) || typeof day.date !== "string" || !isDay(day.date) ||
        day.date < period.from || day.date > period.to || !count(day.value) || values.has(day.date)) return null;
      values.set(day.date, { value: day.value, capped: day.capped === true });
    }
    const firstRecorded = [...values.keys()].sort()[0];
    const start = typeof raw.coverage.startedAt === "string" ? raw.coverage.startedAt : "";
    const days = Array.from({ length: period.days }, (_, i): ActivityDay => {
      const date = isoDay(Date.parse(period.from) + i * DAY);
      const point = item.value === null ? undefined : values.get(date);
      return {
        date, value: point?.value ?? null, capped: point?.capped ?? false, current: false,
        partial: !!point && ((date === firstRecorded && item.quality === "partial") ||
          (start.startsWith(date + "T") && start !== `${date}T00:00:00.000Z` && start !== `${date}T00:00:00Z`)),
      };
    });
    metrics.push({ key, label: item.label, value: item.value, unit: item.unit, definition: item.definition, quality: item.quality, days });
  }
  const comparable = raw.coverage.comparableFrom;
  const revision = object(raw.source) ? raw.source.revision : undefined;
  return {
    metrics, comparableFrom: typeof comparable === "string" && Number.isFinite(Date.parse(comparable)) ? comparable : null,
    limitations: Array.isArray(raw.coverage.limitations) ? raw.coverage.limitations.slice(0, 16).filter((item) => text(item, 600)) : [],
    revision: typeof revision === "string" && /^[a-f\d]{7,64}$/.test(revision) ? revision : null,
  };
}

export async function boundedPortfolioJson(response: Response, limit = 196608): Promise<unknown> {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json") ||
    Number(response.headers.get("content-length")) > limit || !response.body) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return JSON.parse(body + decoder.decode());
    size += chunk.value.length;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
}

export async function readProjectReport(
  project: PortfolioProject, period: Period, db?: D1Database, revision?: string,
): Promise<ProjectReport | null> {
  try {
    const endpoint = sourceAddress(project, period);
    if (!endpoint) return null;
    const raw: unknown = project.id === "app-composer" && db
      ? await portfolioSummary(db, period, new Date(), revision ?? null, "all")
      : await boundedPortfolioJson(await fetch(endpoint, { redirect: "manual", signal: AbortSignal.timeout(3500) }));
    return parseProjectReport(raw, project, period);
  } catch {
    return null;
  }
}

export function comparePortfolioMetric(
  current: PortfolioMetric, previous: PortfolioMetric | undefined,
  previousWindow: Period, currentCoverage: string | null, previousCoverage: string | null,
) {
  const previousStart = Date.parse(previousWindow.from);
  if (!previous || current.definition !== previous.definition || current.unit !== previous.unit ||
    !currentCoverage || !previousCoverage || Date.parse(currentCoverage) > previousStart ||
    Date.parse(previousCoverage) > previousStart) return null;
  const exact = (metric: PortfolioMetric) =>
    metric.quality === "exact" && metric.value !== null &&
    metric.days.every((day) => day.value !== null && !day.partial && !day.capped) &&
    metric.days.reduce((sum, day) => sum + (day.value ?? 0), 0) === metric.value;
  return exact(current) && exact(previous) ? previous.value : null;
}

const numberFormat = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });
export function formatPortfolioValue(value: number, unit: PortfolioMetric["unit"]) {
  if (unit === "count") return numberFormat.format(value);
  if (value >= 3600) return `${numberFormat.format(value / 3600)} h`;
  if (value >= 60) return `${numberFormat.format(value / 60)} min`;
  return `${numberFormat.format(value)} s`;
}

export type InstallerRelease = { tag: string; downloads: number; url: string };
export const liferaftReleases = "https://github.com/loftwah/liferaft/releases";
async function readLiferaftDownloads(token?: string): Promise<InstallerRelease[] | null> {
  try {
    const headers = new Headers({ Accept: "application/vnd.github+json", "User-Agent": "App-Composer-Portfolio" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch("https://api.github.com/repos/loftwah/liferaft/releases?per_page=10", {
      headers, redirect: "manual", signal: AbortSignal.timeout(3500), cache: "no-store",
    });
    const releases = await boundedPortfolioJson(response);
    if (!Array.isArray(releases)) return null;
    return releases.flatMap((release): InstallerRelease[] => {
      if (!object(release) || release.draft !== false || release.prerelease !== false ||
        typeof release.tag_name !== "string" || !/^v\d+\.\d+\.\d+$/.test(release.tag_name) ||
        !Array.isArray(release.assets)) return [];
      const packages = release.assets.filter((asset) => object(asset) && asset.state === "uploaded" &&
        typeof asset.name === "string" && /^Liferaft-[\w.-]+\.dmg$/.test(asset.name));
      if (!packages.length || !packages.every((asset) => count(asset.download_count))) return [];
      const downloads = packages.reduce((sum, asset) => sum + asset.download_count, 0);
      return count(downloads) ? [{ tag: release.tag_name, downloads, url: `${liferaftReleases}/tag/${release.tag_name}` }] : [];
    });
  } catch {
    return null;
  }
}

// Cache only the installer totals. The authenticated GitHub response is discarded.
export async function liferaftDownloads(token?: string): Promise<InstallerRelease[] | null> {
  const key = new Request("https://composer.loftwah.com/activity/portfolio/liferaft-downloads-cache");
  const cache = await caches.open("composer-liferaft-downloads-v1").catch(() => undefined);
  try {
    const saved = await cache?.match(key);
    if (saved) return await saved.json() as InstallerRelease[];
  } catch {
    // GitHub remains the source when the cache is unavailable.
  }
  const totals = await readLiferaftDownloads(token);
  if (totals) {
    await cache?.put(key, Response.json(totals, {
      headers: { "Cache-Control": "public, max-age=900" },
    })).catch(() => {});
  }
  return totals;
}

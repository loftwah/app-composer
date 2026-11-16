// One public-safe, shareable reading of the existing bounded counters. The
// insight only uses complete UTC days so a shared total does not move while
// today is still being recorded, and it withdraws rather than publishing a
// stale ranking when its public app population or the source is unavailable.
import {
  appLabels,
  count,
  dateLabel,
  type PublicHistory,
} from "./activity-view.ts";
import { connectedOn } from "../../lib/usage/index.mjs";

export const INSIGHT_ID = "recorded-app-opens";
export const INSIGHT_ORIGIN = "https://composer.loftwah.com";
export const INSIGHT_PATH = `/insights/${INSIGHT_ID}`;
export const INSIGHT_CARD = { width: 1200, height: 630 } as const;
export const INSIGHT_CARD_TYPE = "image/png" as const;
export const INSIGHT_MAX_DAYS = 30;

export type InsightSurface = "all" | "standalone" | "composed";
export interface InsightWindow {
  from: string;
  to: string;
  days: number;
  surface: InsightSurface;
}
export interface InsightRank {
  app: string;
  label: string;
  opens: number;
  /** Share of the recorded window total, rounded to whole percent. */
  share: number;
  shareLabel: string;
  limited: boolean;
}
export interface RecordedOpensInsight {
  id: typeof INSIGHT_ID;
  headline: string;
  /** Short, card-sized statement of the same finding. */
  cardLead: string;
  title: string;
  metricLabel: string;
  unit: string;
  /** Recorded requests, not people. Kept next to the number everywhere. */
  definition: string;
  population: string;
  exclusions: string[];
  value: number;
  valueLabel: string;
  lowerBound: boolean;
  window: InsightWindow;
  windowLabel: string;
  surfaceLabel: string;
  entries: InsightRank[];
  leader: InsightRank;
  leaders: InsightRank[];
  sourceRevision: string;
  readAt: string;
  canonical: string;
  caption: string;
}
export type InsightState = "invalid" | "withdrawn" | "empty" | "unavailable";
export type InsightResult =
  | { status: "ok"; insight: RecordedOpensInsight }
  | { status: InsightState; reason: string };
export type InsightWindowResult =
  | { status: "ok"; window: InsightWindow }
  | { status: "invalid"; reason: string };

export const surfaceLabels: Record<InsightSurface, string> = {
  all: "all connected versions",
  standalone: "standalone apps",
  composed: "apps inside Composer",
};

const utcDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const windowDays = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
const previousDay = (now: Date) => {
  const cursor = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return cursor.toISOString().slice(0, 10);
};
const percentage = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((100 * numerator) / denominator) : 0;
const shareLabel = (share: number, opens: number) =>
  opens > 0 && share === 0 ? "<1%" : `${share}%`;

export function insightWindowFor(
  days: number,
  surface: InsightSurface,
  now = new Date(),
): InsightWindow {
  const to = previousDay(now);
  const start = new Date(to + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1);
  return {
    from: start.toISOString().slice(0, 10),
    to,
    days: Math.max(1, days),
    surface,
  };
}

// The shared address is the allowlist. Unknown keys, repeated keys, a future or
// partial day, more than 30 days and an unsupported route are all rejected so a
// link can never widen the population or the window it appears to name.
export function insightWindow(
  params: URLSearchParams,
  now = new Date(),
): InsightWindowResult {
  const allowed = new Set(["from", "to", "surface"]);
  for (const key of new Set(params.keys()))
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      return {
        status: "invalid",
        reason: "Use one from, to and surface value.",
      };
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const surface = params.get("surface") ?? "all";
  if (!utcDay(from) || !utcDay(to))
    return { status: "invalid", reason: "Use real UTC days as YYYY-MM-DD." };
  if (from > to)
    return {
      status: "invalid",
      reason: "The start day must not follow the end day.",
    };
  if (to >= now.toISOString().slice(0, 10))
    return {
      status: "invalid",
      reason: "The insight uses complete UTC days; today is still in progress.",
    };
  const days = windowDays(from, to);
  if (days > INSIGHT_MAX_DAYS)
    return {
      status: "invalid",
      reason: `Use ${INSIGHT_MAX_DAYS} UTC days or fewer.`,
    };
  if (!Object.hasOwn(surfaceLabels, surface))
    return { status: "invalid", reason: "Choose a supported route scope." };
  return {
    status: "ok",
    window: { from, to, days, surface: surface as InsightSurface },
  };
}

export const insightPath = (window: InsightWindow) =>
  `${INSIGHT_PATH}?${new URLSearchParams({
    from: window.from,
    to: window.to,
    surface: window.surface,
  })}`;
export const insightUrl = (window: InsightWindow) =>
  `${INSIGHT_ORIGIN}${insightPath(window)}`;
export const insightCardPath = (window: InsightWindow) =>
  `${INSIGHT_PATH}/card.png?${new URLSearchParams({
    from: window.from,
    to: window.to,
    surface: window.surface,
  })}`;
export const insightCardUrl = (window: InsightWindow) =>
  `${INSIGHT_ORIGIN}${insightCardPath(window)}`;

export const insightDefinition =
  "Successful public mini-app home-page requests, counted once per request by the app's own publisher or by Composer's mounted route. Reloads, bots and unmarked automation can count. Not people, sessions or conversions.";

const leaderStatement = (leaders: InsightRank[]) =>
  leaders.length === 1
    ? `${leaders[0].label} drew the most recorded app opens`
    : leaders.length === 2
      ? `${leaders[0].label} and ${leaders[1].label} tied for the most recorded app opens`
      : `${leaders.length} apps tied for the most recorded app opens`;

export function publicInsight(
  summary: PublicHistory,
  window: InsightWindow,
  options: {
    revision: string;
    readAt?: Date;
    /** Ids currently published in Composer's public app catalogue. */
    publicApps: string[];
    enabled?: boolean;
  },
): InsightResult {
  const { revision, publicApps, enabled = true } = options;
  const readAt = options.readAt ?? new Date();
  if (!enabled)
    return {
      status: "withdrawn",
      reason: "Public analytics is turned off for this Composer instance.",
    };
  if (
    summary.period.complete !== true ||
    summary.period.from !== window.from ||
    summary.period.to !== window.to ||
    summary.period.days !== window.days ||
    (summary.surface ?? "all") !== window.surface
  )
    return {
      status: "unavailable",
      reason: "The counter read does not match the requested window.",
    };
  const metric = summary.metrics?.find((value) => value.key === "app_opens");
  if (!metric || metric.quality === "unavailable" || metric.value === null)
    return {
      status: "unavailable",
      reason: "The recorded app-open total is unavailable for this window.",
    };
  if (metric.daily.length !== window.days)
    return {
      status: "unavailable",
      reason: "The daily series does not cover the requested window.",
    };
  const population = Object.keys(appLabels).filter((app) =>
    connectedOn(app, window.surface),
  );
  const published = new Set(publicApps);
  const withdrawn = population.filter((app) => !published.has(app));
  if (withdrawn.length)
    return {
      status: "withdrawn",
      reason:
        "An app in this insight is no longer part of Composer's public catalogue.",
    };
  const entries: InsightRank[] = [];
  for (const app of population) {
    const entry = summary.apps?.find((value) => value.app === app);
    if (!entry || !Number.isSafeInteger(entry.opens) || entry.opens < 0)
      return {
        status: "unavailable",
        reason:
          "One app's recorded opens are unavailable, so there is no ranking.",
      };
    entries.push({
      app,
      label: appLabels[app] ?? app,
      opens: entry.opens,
      share: 0,
      shareLabel: "",
      // Only an app-open daily ceiling makes this opens ranking a lower bound.
      limited: entry.signals?.app_open?.some((day) => day.capped === true) === true,
    });
  }
  const total = entries.reduce((sum, entry) => sum + entry.opens, 0);
  if (total !== metric.value)
    return {
      status: "unavailable",
      reason: "The app ranking does not reconcile with the recorded total.",
    };
  if (total <= 0)
    return {
      status: "empty",
      reason:
        "No recorded app opens exist in this window, so there is no leader.",
    };
  for (const entry of entries) {
    entry.share = percentage(entry.opens, total);
    entry.shareLabel = shareLabel(entry.share, entry.opens);
  }
  entries.sort((a, b) => b.opens - a.opens || a.label.localeCompare(b.label));
  const leader = entries[0];
  const leaders = entries.filter((entry) => entry.opens === leader.opens);
  const lowerBound = entries.some((entry) => entry.limited);
  const valueLabel = `${count(total)}${lowerBound ? "+" : ""}`;
  const windowLabel = `${dateLabel(window.from)} – ${dateLabel(window.to, true)} UTC`;
  const surfaceLabel = surfaceLabels[window.surface];
  const leaderLine = leaderStatement(leaders);
  const headline =
    leaders.length === 1
      ? `${leaderLine} — ${count(leader.opens)} of ${valueLabel}`
      : `${leaderLine} — ${count(leader.opens)} each of ${valueLabel}`;
  const cardLead =
    leaders.length === 1
      ? `${leader.label} drew the most opens`
      : leaders.length === 2
        ? `${leaders[0].label} and ${leaders[1].label} tied at ${count(leader.opens)}`
        : `${leaders.length} apps tied at ${count(leader.opens)}`;
  const populationLine = `${population.length} public ${
    population.length === 1 ? "app" : "apps"
  } with a routed public home page, ${surfaceLabel}: ${population
    .map((app) => appLabels[app] ?? app)
    .join(", ")}.`;
  const exclusions = [
    `Today's in-progress UTC day is excluded. The window is ${window.days} complete UTC ${
      window.days === 1 ? "day" : "days"
    }, ${windowLabel}.`,
    "Private vault actions are never counted. No visitor identity, session, enquiry, workspace or raw event enters this insight.",
    "Each app/event/surface counter stops at 1,000 per UTC day, daily counts expire after 35 days, and optional publishers can miss events during an outage. A capped app is a lower bound, marked with +.",
  ];
  if (lowerBound)
    exclusions.push(
      "At least one app reached a daily counter ceiling in this window, so the ranking total is a lower bound.",
    );
  const canonical = insightUrl(window);
  const caption = `${headline} across ${population.length} public ${
    population.length === 1 ? "app" : "apps"
  }, ${windowLabel} (${window.days} complete UTC ${
    window.days === 1 ? "day" : "days"
  }, ${surfaceLabel}). Recorded requests, not people or conversions. ${canonical}`;
  return {
    status: "ok",
    insight: {
      id: INSIGHT_ID,
      headline,
      cardLead,
      title: "Recorded app opens",
      metricLabel: "Recorded app opens",
      unit: lowerBound ? "recorded opens · lower bound" : "recorded opens",
      definition: insightDefinition,
      population: populationLine,
      exclusions,
      value: total,
      valueLabel,
      lowerBound,
      window,
      windowLabel,
      surfaceLabel,
      entries,
      leader,
      leaders,
      sourceRevision: revision,
      readAt: readAt.toISOString(),
      canonical,
      caption,
    },
  };
}

// Render states share one fail-closed policy: nothing from a withdrawn,
// unavailable or empty source is published as a number or an image.
export const insightStatusFor = (status: InsightResult["status"]) =>
  status === "ok"
    ? 200
    : status === "invalid"
      ? 404
      : status === "unavailable"
        ? 503
        : 410;

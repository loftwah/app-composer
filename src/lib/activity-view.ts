// Presentation of the existing public counter contracts. Missing history stays
// missing; these helpers never estimate visitors, conversions or earlier days.
import { collectionStarted } from "../../lib/usage/portfolio.mjs";

export const signalKeys = [
  "app_opens",
  "photo_opens",
  "inspection_completed",
  "guest_postcards_received",
] as const;
export type SignalKey = (typeof signalKeys)[number];
export interface PublicMetric {
  key: string;
  label: string;
  value: number | null;
  quality: string;
  definition: string;
  daily: { date: string; value: number; capped?: boolean }[];
}
export interface PublicHistory {
  generatedAt: string;
  period: { from: string; to: string; days: number; complete: boolean };
  coverage: { startedAt: string; quality: string; limitations: string[] };
  metrics: PublicMetric[];
  surface?: string;
  routeTotals?: SurfaceTotals | null;
  apps?: PublicApp[];
}
export interface PublicAppPostcards {
  value: number | null;
  quality: string;
  daily: { date: string; value: number; capped?: boolean }[];
}
export interface PublicApp {
  app: string;
  connected: boolean;
  opens: number;
  actions: number;
  photoOpens: number;
  inspections: number;
  postcards: PublicAppPostcards | null;
  limited: boolean;
  signals: Record<string, { date: string; value: number; capped?: boolean }[]>;
}
export interface ActivityDay {
  date: string;
  value: number | null;
  partial: boolean;
  current: boolean;
  capped: boolean;
}
export interface SurfaceTotals {
  all: number;
  standalone: number;
  composed: number;
}
export interface Finding {
  key: string;
  app: string | null;
  metric: SignalKey;
  eyebrow: string;
  headline: string;
  detail: string;
  value: string;
  unit: string;
  href: string;
  shareHref: string;
}

export const appLabels: Record<string, string> = {
  guestbook: "Here / there",
  showcase: "Linkarooie",
  linkcheck: "Link Check",
  hello: "Hello World",
  state: "Carry / forward",
};
export const appActions: Record<string, string> = {
  guestbook: "Photos, postcards and review",
  showcase: "Links, profile and curation",
  linkcheck: "Website and sharing checks",
  hello: "A first working deployment",
  state: "Fictional encrypted memory",
};

export const signalSelection = (value: string | null): SignalKey =>
  signalKeys.includes(value as SignalKey) ? (value as SignalKey) : "app_opens";
export const signalLabels: Record<SignalKey, string> = {
  app_opens: "App opens",
  photo_opens: "Contribution-page opens",
  inspection_completed: "Completed inspections",
  guest_postcards_received: "Guest postcards received",
};
// A public app record can only offer measures that app actually declares.
// Requesting anything else is named at the chart rather than silently replaced.
export const appSignals: Record<string, SignalKey[]> = {
  guestbook: ["app_opens", "photo_opens", "guest_postcards_received"],
  linkcheck: ["app_opens", "inspection_completed"],
  showcase: ["app_opens"],
  hello: ["app_opens"],
  state: ["app_opens"],
};
export function appSignalSelection(app: string, value: string | null) {
  const requested = signalSelection(value);
  const supported = appSignals[app] ?? ["app_opens"];
  return supported.includes(requested)
    ? { metric: requested, unsupported: null }
    : { metric: "app_opens" as SignalKey, unsupported: value ? requested : null };
}
export const count = (value: number) => value.toLocaleString("en-AU");
export function dateLabel(value: string, year = false) {
  return new Date(value + "T00:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
export function longDateLabel(value: string) {
  return new Date(value + "T00:00:00Z").toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const utcDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

// A selected UTC day is an allowlisted read-only view of the existing window.
// A bad or out-of-window value is ignored so the page still opens on a useful
// day rather than failing the whole report.
export function daySelection(
  value: string | null,
  from: string,
  to: string,
): string | null {
  if (!value || !utcDay(value)) return null;
  return value >= from && value <= to ? value : null;
}
export function dayIndex(days: ActivityDay[], date?: string | null) {
  if (!days.length) return 0;
  const found = date ? days.findIndex((day) => day.date === date) : -1;
  return found >= 0 ? found : days.length - 1;
}
export function dayState(day: ActivityDay) {
  if (day.value === null) return "History unavailable";
  if (day.current) return "Today, UTC · partial";
  if (day.partial) return "First retained day · partial";
  if (day.capped) return "Lower bound · daily cap reached";
  if (day.value === 0) return "Retained zero · no event recorded";
  return "Recorded count";
}
export function dayValueLabel(day: ActivityDay) {
  if (day.value === null) return "Unavailable";
  return `${count(day.value)}${day.capped ? "+" : ""}`;
}
export function describeDay(day: ActivityDay) {
  const state = dayState(day);
  return `${longDateLabel(day.date)}: ${day.value === null ? "history unavailable" : `${dayValueLabel(day)} recorded`}. ${state}.`;
}

// Report views already cover the whole UTC window; this keeps one shape for
// the chart, the day inspector and the table.
export function metricDays(
  daily: { date: string; value: number | null; capped?: boolean }[],
  quality: string,
  today: string,
): ActivityDay[] {
  const firstValue = daily.findIndex((day) => day.value !== null);
  return daily.map((day, index) => ({
    date: day.date,
    value: day.value,
    capped: day.capped === true,
    partial:
      day.date === collectionStarted ||
      (index === firstValue && index > 0) ||
      (index === 0 && quality === "partial"),
    current: day.date === today,
  }));
}

function buildDays(
  window: { from: string; to: string },
  observed: Map<string, number>,
  capped: Set<string>,
  firstObserved?: string,
  today?: string,
  firstPartial = false,
): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (
    const cursor = new Date(window.from + "T00:00:00Z");
    cursor <= new Date(window.to + "T00:00:00Z");
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    days.push({
      date,
      value: observed.has(date) ? observed.get(date)! : null,
      // The first recorded day began mid-day. A day before the first retained
      // observation is also partial history, never a measured zero.
      partial:
        date === collectionStarted ||
        (date === firstObserved && (firstPartial || firstObserved !== window.from)),
      current: date === today,
      capped: capped.has(date),
    });
  }
  return days;
}

export function signalView(report: PublicHistory, key: SignalKey) {
  const metric = report.metrics.find((value) => value.key === key);
  if (!metric) return undefined;
  const available = metric.value !== null && metric.quality !== "unavailable";
  const observed = new Map(
    available ? metric.daily.map((day) => [day.date, day.value]) : [],
  );
  const capped = new Set(
    available ? metric.daily.filter((day) => day.capped).map((day) => day.date) : [],
  );
  const days = buildDays(
    { from: report.period.from, to: report.period.to },
    observed,
    capped,
    metric.daily[0]?.date,
    report.generatedAt.slice(0, 10),
    metric.quality === "partial",
  );
  const maximum = Math.max(1, ...days.map((day) => day.value ?? 0));
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const ceiling =
    [1, 2, 5, 10].find((step) => step * magnitude >= maximum)! * magnitude;
  return {
    ...metric,
    key,
    days,
    ceiling,
    available: days.filter((day) => day.value !== null).length,
    missing: days.filter((day) => day.value === null).length,
    partial: days.filter((day) => day.partial || day.current).length,
    capped: days.filter((day) => day.capped).length,
    initial: days.length - 1,
  };
}

export function appReport(report: PublicHistory, app: string) {
  const value = report.apps?.find((entry) => entry.app === app);
  if (!value) return undefined;
  const observed = new Map(
    (value.signals.app_open ?? []).map((day) => [day.date, day.value]),
  );
  const capped = new Set(
    (value.signals.app_open ?? []).filter((day) => day.capped).map((day) => day.date),
  );
  const days = buildDays(
    { from: report.period.from, to: report.period.to },
    observed,
    capped,
    value.signals.app_open?.[0]?.date,
    report.generatedAt.slice(0, 10),
  );
  const maximum = Math.max(1, ...days.map((day) => day.value ?? 0));
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const ceiling =
    [1, 2, 5, 10].find((step) => step * magnitude >= maximum)! * magnitude;
  return {
    ...value,
    days,
    ceiling,
    available: days.filter((day) => day.value !== null).length,
    missing: days.filter((day) => day.value === null).length,
    initial: days.length - 1,
  };
}

const query = (days: number, surface: string) =>
  `days=${days}&surface=${encodeURIComponent(surface)}`;
const shareHref = (
  app: string | null,
  metric: SignalKey,
  days: number,
  surface: string,
) =>
  `/reports/new?${query(days, surface)}&metric=${metric}${app ? `&app=${encodeURIComponent(app)}` : ""}`;

export function buildFindings(
  report: PublicHistory,
  surfaces: SurfaceTotals | null,
): Finding[] {
  const days = report.period.days;
  const surface = report.surface ?? "all";
  const findings: Finding[] = [];
  const apps = [...(report.apps ?? [])].sort(
    (a, b) => b.opens - a.opens || a.app.localeCompare(b.app),
  );
  const lead = apps[0];
  if (lead && lead.opens > 0) {
    findings.push({
      key: "app-lead",
      app: lead.app,
      metric: "app_opens",
      eyebrow: "Most opened",
      headline: `${appLabels[lead.app]} led the recorded opens.`,
      detail: `${count(lead.opens)} successful home-page requests in this window. These are recorded requests, not unique people.`,
      value: count(lead.opens),
      unit: lead.opens === 1 ? "recorded open" : "recorded opens",
      href: `/activity/${lead.app}?${query(days, surface)}&metric=app_opens`,
      shareHref: shareHref(lead.app, "app_opens", days, surface),
    });
  }
  const guestbook = report.apps?.find((entry) => entry.app === "guestbook");
  const postcards = guestbook?.postcards?.value ?? null;
  if (guestbook && postcards !== null && postcards > 0) {
    findings.push({
      key: "notes",
      app: "guestbook",
      metric: "guest_postcards_received",
      eyebrow: "A note reached review",
      headline: `${count(postcards)} ${postcards === 1 ? "postcard was" : "postcards were"} committed for review.`,
      detail: `${count(guestbook.photoOpens)} contribution-page ${guestbook.photoOpens === 1 ? "open was" : "opens were"} recorded in the same scope. Page opens are not people, and a received postcard is neither an approval nor a feature.`,
      value: count(postcards),
      unit: postcards === 1 ? "postcard received" : "postcards received",
      href: `/activity/guestbook?${query(days, surface)}&metric=guest_postcards_received`,
      shareHref: shareHref("guestbook", "guest_postcards_received", days, surface),
    });
  }
  const linkcheck = report.apps?.find((entry) => entry.app === "linkcheck");
  if (linkcheck && linkcheck.inspections > 0) {
    findings.push({
      key: "inspections",
      app: "linkcheck",
      metric: "inspection_completed",
      eyebrow: "A task completed",
      headline: `${count(linkcheck.inspections)} Link Check ${linkcheck.inspections === 1 ? "inspection finished" : "inspections finished"}.`,
      detail: "Counted by the app after a completed inspection, not when the page opens. It does not establish who ran it or what they changed.",
      value: count(linkcheck.inspections),
      unit: linkcheck.inspections === 1 ? "completed inspection" : "completed inspections",
      href: `/activity/linkcheck?${query(days, surface)}&metric=inspection_completed`,
      shareHref: shareHref("linkcheck", "inspection_completed", days, surface),
    });
  }
  // A route share is only meaningful when all three independent reads returned
  // and agree. A failed or short read is unavailable, never substituted by a
  // zero, so this finding is suppressed rather than guessed.
  const routes = report.routeTotals ?? surfaces;
  const routeComplete = Boolean(
    routes &&
      Number.isSafeInteger(routes.all) &&
      Number.isSafeInteger(routes.standalone) &&
      Number.isSafeInteger(routes.composed) &&
      routes.all > 0 &&
      routes.all === routes.standalone + routes.composed,
  );
  if (routeComplete && routes && surface === "all") {
    const composedShare = Math.round((routes.composed / routes.all) * 100);
    findings.push({
      key: "surface",
      app: null,
      metric: "app_opens",
      eyebrow: "Where the opens happened",
      headline:
        routes.composed >= routes.standalone
          ? "The composed routes carried most opens."
          : "The standalone apps carried most opens.",
      detail: `${count(routes.standalone)} standalone and ${count(routes.composed)} inside Composer. The composed route is a second address for the same independent app; it is not a second audience.`,
      value: `${composedShare}%`,
      unit: "arrived inside Composer",
      href: `/activity?${query(days, routes.composed >= routes.standalone ? "composed" : "standalone")}`,
      shareHref: shareHref(null, "app_opens", days, surface) + "&story=composed-share",
    });
  }
  const opens = report.metrics.find((metric) => metric.key === "app_opens");
  const peak = opens?.daily.reduce(
    (best, day) => (day.value > (best?.value ?? -1) ? day : best),
    undefined as { date: string; value: number } | undefined,
  );
  if (peak && peak.value > 0) {
    findings.push({
      key: "peak-day",
      app: null,
      metric: "app_opens",
      eyebrow: "Busiest recorded day",
      headline: `${dateLabel(peak.date, true)} recorded ${count(peak.value)} app opens.`,
      detail: "One UTC day in a bounded counter. It is not a trend, a launch result or proof that a change caused the difference. Select it to inspect that exact day.",
      value: count(peak.value),
      unit: "opens that day",
      href: `/activity?${query(days, surface)}&metric=app_opens&day=${peak.date}`,
      shareHref: shareHref(null, "app_opens", days, surface) + `&story=peak-day&day=${peak.date}`,
    });
  }
  return findings.slice(0, 4);
}

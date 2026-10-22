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
  daily: { date: string; value: number }[];
}
export interface PublicHistory {
  generatedAt: string;
  period: { from: string; to: string; days: number; complete: boolean };
  coverage: { startedAt: string; quality: string; limitations: string[] };
  metrics: PublicMetric[];
  surface?: string;
  apps?: PublicApp[];
}
export interface PublicAppPostcards {
  value: number | null;
  quality: string;
  daily: { date: string; value: number }[];
}
export interface PublicApp {
  app: string;
  opens: number;
  actions: number;
  photoOpens: number;
  inspections: number;
  postcards: PublicAppPostcards | null;
  limited: boolean;
  signals: Record<string, { date: string; value: number }[]>;
}
export interface ActivityDay {
  date: string;
  value: number | null;
  partial: boolean;
  current: boolean;
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
export const count = (value: number) => value.toLocaleString("en-AU");
export function dateLabel(value: string, year = false) {
  return new Date(value + "T00:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
export function describeDay(day: ActivityDay) {
  const state = day.current
    ? "UTC day in progress"
    : day.partial
      ? "First recorded day is partial"
      : "";
  return `${dateLabel(day.date, true)}: ${day.value === null ? "history unavailable" : `${count(day.value)} recorded`}${state ? `. ${state}.` : "."}`;
}
export function signalView(report: PublicHistory, key: SignalKey) {
  const metric = report.metrics.find((value) => value.key === key);
  if (!metric) return undefined;
  const observed = new Map(metric.daily.map((day) => [day.date, day.value]));
  const first = metric.daily[0]?.date;
  const today = report.generatedAt.slice(0, 10);
  const days: ActivityDay[] = [];
  for (
    const cursor = new Date(report.period.from + "T00:00:00Z");
    cursor <= new Date(report.period.to + "T00:00:00Z");
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    days.push({
      date,
      value:
        metric.value === null || metric.quality === "unavailable"
          ? null
          : (observed.get(date) ?? null),
      partial:
        date === collectionStarted ||
        (key === "guest_postcards_received" &&
          metric.quality === "partial" &&
          date === first),
      current: date === today,
    });
  }
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
    initial: days.length - 1,
  };
}

export function appReport(report: PublicHistory, app: string) {
  const value = report.apps?.find((entry) => entry.app === app);
  if (!value) return undefined;
  const days: ActivityDay[] = [];
  const observed = new Map(
    (value.signals.app_open ?? []).map((day) => [day.date, day.value]),
  );
  const today = report.generatedAt.slice(0, 10);
  for (
    const cursor = new Date(report.period.from + "T00:00:00Z");
    cursor <= new Date(report.period.to + "T00:00:00Z");
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    days.push({
      date,
      value: observed.get(date) ?? null,
      partial: date === collectionStarted,
      current: date === today,
    });
  }
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
  surfaces: SurfaceTotals,
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
      href: `/activity/${lead.app}?${query(days, surface)}`,
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
      unit: postcards === 1 ? "pending postcard" : "pending postcards",
      href: `/activity/guestbook?${query(days, surface)}`,
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
      href: `/activity/linkcheck?${query(days, surface)}`,
      shareHref: shareHref("linkcheck", "inspection_completed", days, surface),
    });
  }
  if (surfaces.all > 0 && surface === "all") {
    const composedShare = Math.round((surfaces.composed / surfaces.all) * 100);
    findings.push({
      key: "surface",
      app: null,
      metric: "app_opens",
      eyebrow: "Where the opens happened",
      headline:
        surfaces.composed >= surfaces.standalone
          ? "The composed routes carried most opens."
          : "The standalone apps carried most opens.",
      detail: `${count(surfaces.standalone)} standalone and ${count(surfaces.composed)} inside Composer. The composed route is a second address for the same independent app; it is not a second audience.`,
      value: `${composedShare}%`,
      unit: "arrived inside Composer",
      href: `/activity?${query(days, surfaces.composed >= surfaces.standalone ? "composed" : "standalone")}`,
      shareHref: shareHref(null, "app_opens", days, surface),
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
      detail: "One UTC day in a bounded counter. It is not a trend, a launch result or proof that a change caused the difference.",
      value: count(peak.value),
      unit: "opens that day",
      href: `/activity?${query(days, surface)}&metric=app_opens`,
      shareHref: shareHref(null, "app_opens", days, surface),
    });
  }
  return findings.slice(0, 4);
}

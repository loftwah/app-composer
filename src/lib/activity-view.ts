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
}
export interface ActivityDay {
  date: string;
  value: number | null;
  partial: boolean;
  current: boolean;
}

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

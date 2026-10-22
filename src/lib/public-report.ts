// Frozen public analytics stories. A report is built from the same bounded
// aggregate contract as /activity, then stored so its values do not change
// when the 35-day counters or a later release move on.
import type { D1Database } from "@cloudflare/workers-types";
import type {
  PublicHistory,
  PublicMetric,
  SignalKey,
} from "./activity-view.ts";
import { appLabels, signalKeys } from "./activity-view.ts";

export const REPORT_ORIGIN = "https://composer.loftwah.com";
export const REPORT_SCHEMA = "composer.public-report/1" as const;
export const reportFormats = {
  landscape: { width: 1200, height: 630, label: "Landscape" },
  square: { width: 1080, height: 1080, label: "Square" },
  portrait: { width: 1080, height: 1920, label: "Portrait" },
} as const;
export type ReportFormat = keyof typeof reportFormats;
export const isReportFormat = (value: string): value is ReportFormat =>
  Object.hasOwn(reportFormats, value);
export const reportIdPattern = /^r[a-f0-9]{24}$/;

export interface ReportScope {
  app: string | null;
  metric: SignalKey;
  days: number;
  surface: string;
}
export interface FrozenReport {
  schema: typeof REPORT_SCHEMA;
  id: string;
  createdAt: string;
  app: string | null;
  appLabel: string | null;
  metric: SignalKey;
  metricLabel: string;
  headline: string;
  detail: string;
  value: number | null;
  unit: string;
  quality: string;
  period: { from: string; to: string; days: number; surface: string };
  daily: { date: string; value: number | null }[];
  coverage: { startedAt: string; quality: string; limitations: string[] };
  sourceRevision: string;
}

const appMetricDefinitions: Record<
  string,
  Record<string, { label: string; definition: string; unit: string }>
> = {
  guestbook: {
    app_opens: {
      label: "Here / there opens",
      definition:
        "Successful public Here / there home-page requests on this route scope. Reloads and bots may count; not people or sessions.",
      unit: "recorded opens",
    },
    photo_opens: {
      label: "Contribution-page opens",
      definition:
        "Successful public Guestbook contribution-page requests. Repeated opens can count; an open is not a submission, approval or unique person.",
      unit: "recorded opens",
    },
    guest_postcards_received: {
      label: "Guest postcards received",
      definition:
        "New pending guest postcards counted after committed acceptance by Guestbook. Not approvals, publications, unique people or a conversion rate. Before the first retained receipt, history is unavailable.",
      unit: "pending postcards",
    },
  },
  linkcheck: {
    app_opens: {
      label: "Link Check opens",
      definition:
        "Successful public Link Check home-page requests on this route scope. Reloads and bots may count; not people or sessions.",
      unit: "recorded opens",
    },
    inspection_completed: {
      label: "Completed inspections",
      definition:
        "Inspections counted by Link Check after completion, not when the page opens. Not clicks, deployment checks or unique users.",
      unit: "completed inspections",
    },
  },
  showcase: {
    app_opens: {
      label: "Linkarooie opens",
      definition:
        "Successful public Linkarooie home-page requests on this route scope. Reloads and bots may count; not people or sessions.",
      unit: "recorded opens",
    },
  },
  hello: {
    app_opens: {
      label: "Hello World opens",
      definition:
        "Successful public Hello World home-page requests on this route scope. Reloads and bots may count; not people or sessions.",
      unit: "recorded opens",
    },
  },
  state: {
    app_opens: {
      label: "Carry / forward opens",
      definition:
        "Successful public Carry / forward home-page requests on this route scope. Reloads and bots may count. Vault actions remain private and uncounted.",
      unit: "recorded opens",
    },
  },
};

const globalFallback: Record<string, { label: string; definition: string; unit: string }> = {
  app_opens: {
    label: "Recorded app opens",
    definition:
      "Successful public mini-app home-page requests across the selected route scope. Reloads and bots may count; not people, sessions or conversions.",
    unit: "recorded opens",
  },
  photo_opens: {
    label: "Guestbook contribution opens",
    definition:
      "Successful public Guestbook contribution-page requests. Not image downloads, submissions, publications or unique people.",
    unit: "recorded opens",
  },
  inspection_completed: {
    label: "Completed inspections",
    definition:
      "Link Check inspections counted after completion. Not clicks, deployment checks or unique users.",
    unit: "completed inspections",
  },
  guest_postcards_received: {
    label: "Guest postcards received",
    definition:
      "New pending guest postcards counted after committed acceptance by Guestbook. Not approvals, publications, unique people or a conversion rate.",
    unit: "pending postcards",
  },
};

const surfaceLabel = (surface: string) =>
  surface === "standalone"
    ? "standalone apps"
    : surface === "composed"
      ? "apps inside Composer"
      : "all connected versions";

function dailyWindow(
  daily: { date: string; value: number }[] | undefined,
  period: { from: string; to: string },
  nullBefore: boolean,
) {
  const observed = new Map((daily ?? []).map((day) => [day.date, day.value]));
  const first = daily?.[0]?.date;
  const unavailable = !daily || daily.length === 0;
  const points: { date: string; value: number | null }[] = [];
  for (
    const cursor = new Date(period.from + "T00:00:00Z");
    cursor <= new Date(period.to + "T00:00:00Z");
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    points.push({
      date,
      value: unavailable
        ? null
        : nullBefore && first && date < first
          ? null
          : (observed.get(date) ?? (first && date < first ? null : 0)),
    });
  }
  return points;
}

export function reportMetricView(
  report: PublicHistory,
  app: string | null,
  metric: SignalKey,
) {
  if (app) {
    const entry = report.apps?.find((value) => value.app === app);
    const definition = appMetricDefinitions[app]?.[metric];
    if (!entry || !definition)
      throw new Error("That app does not declare this public measure.");
    if (metric === "guest_postcards_received") {
      const postcards = entry.postcards;
      if (!postcards) throw new Error("No receipt measure is declared.");
      return {
        label: definition.label,
        definition: definition.definition,
        unit: definition.unit,
        value: postcards.value,
        quality: postcards.quality,
        daily: dailyWindow(postcards.daily, report.period, true),
      };
    }
    const event =
      metric === "app_opens"
        ? "app_open"
        : metric === "photo_opens"
          ? "item_open"
          : metric;
    const daily = entry.signals[event];
    if (!daily) throw new Error("No daily series is declared for this measure.");
    return {
      label: definition.label,
      definition: definition.definition,
      unit: definition.unit,
      value: daily.reduce((sum, day) => sum + day.value, 0),
      quality: "bounded",
      daily: dailyWindow(daily, report.period, false),
    };
  }
  const found = report.metrics.find((value) => value.key === metric);
  const definition = globalFallback[metric];
  if (!found || !definition)
    throw new Error("That public measure is unavailable.");
  return {
    label: found.label || definition.label,
    definition: found.definition || definition.definition,
    unit: definition.unit,
    value: found.value,
    quality: found.quality,
    daily: dailyWindow(found.daily, report.period, metric === "guest_postcards_received"),
  };
}

const headlineFor = (app: string | null, metric: SignalKey, value: number | null) => {
  const amount = value === null ? "Unavailable" : value.toLocaleString("en-AU");
  if (metric === "guest_postcards_received")
    return `${amount} guest ${value === 1 ? "postcard" : "postcards"} reached review`;
  if (metric === "inspection_completed")
    return `${amount} Link Check ${value === 1 ? "inspection" : "inspections"} completed`;
  if (app) return `${appLabels[app] ?? app}: ${amount} recorded ${value === 1 ? "open" : "opens"}`;
  if (metric === "photo_opens")
    return `${amount} Guestbook contribution ${value === 1 ? "open" : "opens"}`;
  return `${amount} recorded app ${value === 1 ? "open" : "opens"}`;
};

export async function buildReport(
  report: PublicHistory,
  scope: ReportScope,
  sourceRevision: string,
  now = new Date(),
): Promise<FrozenReport> {
  if (!signalKeys.includes(scope.metric))
    throw new Error("Choose a supported public measure.");
  if (scope.app && !Object.hasOwn(appLabels, scope.app))
    throw new Error("Choose a supported app.");
  const selected = reportMetricView(report, scope.app, scope.metric);
  const period = {
    from: report.period.from,
    to: report.period.to,
    days: report.period.days,
    surface: report.surface ?? "all",
  };
  const body = {
    schema: REPORT_SCHEMA,
    app: scope.app,
    metric: scope.metric,
    period,
    value: selected.value,
    quality: selected.quality,
    daily: selected.daily,
    coverage: {
      startedAt: report.coverage.startedAt,
      quality: report.coverage.quality,
      limitations: report.coverage.limitations,
    },
    sourceRevision,
  } as const;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  const id = "r" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
  return {
    schema: REPORT_SCHEMA,
    id,
    createdAt: now.toISOString(),
    app: scope.app,
    appLabel: scope.app ? (appLabels[scope.app] ?? scope.app) : null,
    metric: scope.metric,
    metricLabel: selected.label,
    headline: headlineFor(scope.app, scope.metric, selected.value),
    detail: selected.definition,
    value: selected.value,
    unit: selected.unit,
    quality: selected.quality,
    period,
    daily: selected.daily,
    coverage: body.coverage,
    sourceRevision,
  };
}

const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function parseFrozenReport(raw: unknown): FrozenReport | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    return undefined;
  const value = raw as Record<string, unknown>;
  const period = value.period as Record<string, unknown> | undefined;
  const coverage = value.coverage as Record<string, unknown> | undefined;
  if (
    value.schema !== REPORT_SCHEMA ||
    typeof value.id !== "string" ||
    !reportIdPattern.test(value.id) ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    (value.app !== null && typeof value.app !== "string") ||
    !signalKeys.includes(value.metric as SignalKey) ||
    typeof value.metricLabel !== "string" ||
    typeof value.headline !== "string" ||
    typeof value.detail !== "string" ||
    !(value.value === null || integer(value.value)) ||
    typeof value.unit !== "string" ||
    typeof value.quality !== "string" ||
    !period ||
    typeof period.from !== "string" ||
    typeof period.to !== "string" ||
    !integer(period.days) ||
    typeof period.surface !== "string" ||
    !Array.isArray(value.daily) ||
    value.daily.length > 90 ||
    value.daily.some(
      (day: unknown) =>
        !day ||
        typeof day !== "object" ||
        typeof (day as Record<string, unknown>).date !== "string" ||
        !(
          (day as Record<string, unknown>).value === null ||
          integer((day as Record<string, unknown>).value)
        ),
    ) ||
    !coverage ||
    typeof coverage.startedAt !== "string" ||
    typeof coverage.quality !== "string" ||
    !Array.isArray(coverage.limitations) ||
    coverage.limitations.some((item: unknown) => typeof item !== "string") ||
    typeof value.sourceRevision !== "string"
  )
    return undefined;
  const total = (value.daily as { value: number | null }[]).reduce(
    (sum, day) => sum + (day.value ?? 0),
    0,
  );
  if (value.value !== null && value.value !== total) return undefined;
  return value as unknown as FrozenReport;
}

export async function storeReport(
  db: D1Database,
  report: FrozenReport,
): Promise<void> {
  const result = await db
    .prepare(
      "INSERT INTO composer_reports(id,payload_json,source_revision) VALUES(?1,?2,?3) ON CONFLICT(id) DO NOTHING",
    )
    .bind(report.id, JSON.stringify(report), report.sourceRevision)
    .run();
  if (!result.success) throw new Error("The public report could not be stored.");
  // Public creation is rate-limited and bounded. Older snapshots beyond the
  // retained cap become unavailable; current and recent share links stay intact.
  await db
    .prepare(
      "DELETE FROM composer_reports WHERE id IN (SELECT id FROM composer_reports ORDER BY created_at DESC LIMIT -1 OFFSET 10000)",
    )
    .run();
}

export async function readReport(
  db: D1Database,
  id: string,
): Promise<FrozenReport | undefined> {
  if (!reportIdPattern.test(id)) return undefined;
  const row = await db
    .prepare("SELECT payload_json FROM composer_reports WHERE id=?1")
    .bind(id)
    .first<{ payload_json: string }>();
  if (!row) return undefined;
  if (typeof row.payload_json !== "string" || row.payload_json.length > 65536)
    throw new Error("The stored public report is invalid.");
  return parseFrozenReport(JSON.parse(row.payload_json));
}

export function reportPath(id: string) {
  return `/reports/${id}`;
}
export function reportUrl(id: string) {
  return `${REPORT_ORIGIN}${reportPath(id)}`;
}
export function reportImagePath(id: string, format: ReportFormat) {
  return `${reportPath(id)}/${format}.png`;
}
export function reportCaption(report: FrozenReport) {
  return `${report.headline}. ${report.period.days} UTC days, ${surfaceLabel(report.period.surface)}, through ${report.period.to}. Recorded lower bound, not unique people. ${reportUrl(report.id)}`;
}
export const reportPeriodLabel = (report: FrozenReport) =>
  `${report.period.from} to ${report.period.to} UTC · ${surfaceLabel(report.period.surface)}`;

export function reportScope(params: URLSearchParams): ReportScope {
  const app = params.get("app");
  if (app && !Object.hasOwn(appLabels, app))
    throw new Error("Choose a supported app.");
  const metric = params.get("metric") ?? "app_opens";
  if (!signalKeys.includes(metric as SignalKey))
    throw new Error("Choose a supported public measure.");
  const days = params.get("days") === "30" ? 30 : 7;
  const surface = ["standalone", "composed"].includes(params.get("surface") ?? "")
    ? (params.get("surface") as string)
    : "all";
  return { app: app ?? null, metric: metric as SignalKey, days, surface };
}
export function reportScopeParams(scope: ReportScope) {
  return {
    app: scope.app ?? "",
    metric: scope.metric,
    days: String(scope.days),
    surface: scope.surface,
  };
}

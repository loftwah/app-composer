// This is the only private-outcome → public-story projection. Keep the allowlist
// explicit: neither source report nor request fields are copied into the DTO.
import type { D1Database } from "@cloudflare/workers-types";
import type { OutcomeReport } from "./private-outcomes.ts";
import { appLabels } from "./activity-view.ts";
import {
  REPORT_SCHEMA,
  type FrozenReport,
  parseFrozenReport,
} from "./public-report.ts";

export async function projectOwnerReport(
  report: OutcomeReport,
  app: string,
  revision: string,
): Promise<FrozenReport> {
  if (
    !report.scope.stack ||
    !report.scope.instance ||
    app === "state" ||
    !Object.hasOwn(appLabels, app)
  )
    throw new Error("Choose one supported published app instance.");
  const metric = report.metrics.find(
    (value) => value.key === "app_open_action",
  );
  if (!metric || metric.value === null)
    throw new Error("No retained Open action is available to share.");
  const daily = metric.daily.map((point) => ({
    date: point.date,
    value: point.value,
  }));
  const dto = {
    schema: REPORT_SCHEMA,
    origin: { kind: "owner-permitted" as const, traffic: report.traffic },
    app: null,
    appLabel: null,
    metric: "app_open_action" as const,
    metricLabel: "Published app Open actions",
    headline: `${metric.value.toLocaleString("en-AU")} recorded app-instance Open ${metric.value === 1 ? "action" : "actions"}`,
    detail:
      "Activations of an eligible Open link on one owner-selected published stack/app instance. Not destination loads, home-page requests, unique people, submissions or conversions. The owner explicitly permitted this aggregate; private scope identifiers and content are excluded.",
    value: metric.value,
    unit: "recorded Open actions",
    quality: metric.quality,
    period: {
      from: report.period.from,
      to: report.period.to,
      days: report.period.days,
      surface: "composed",
    },
    daily,
    coverage: {
      startedAt:
        (metric.firstObserved ?? report.period.from) + "T00:00:00.000Z",
      quality: metric.quality,
      limitations: [
        "Recorded lower bound. The first observed day and today can be partial; expired and earlier history are unavailable.",
        "Optional recording, rate limits and outages can lose events. An Open activation does not prove a destination loaded.",
        report.traffic === "demo"
          ? "Explicitly classified demonstration traffic. This is not customer adoption."
          : report.traffic === "all"
            ? "Includes demonstration and unclassified activity. This is not customer adoption."
            : "Unclassified traffic is not evidence of customer adoption.",
      ],
    },
    sourceRevision: revision,
  };
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(dto)),
  );
  const id =
    "r" +
    Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0"),
    )
      .join("")
      .slice(0, 24);
  const frozen = { ...dto, id, createdAt: report.generatedAt };
  if (!parseFrozenReport(frozen))
    throw new Error("The public aggregate does not reconcile.");
  return frozen;
}

export async function storeOwnerReport(
  db: D1Database,
  report: FrozenReport,
  scope: {
    user: string;
    workspace: string;
    stack: string;
    instance: string;
    app: string;
  },
) {
  // Permission and retained instance ownership are checked in the write itself.
  // A revoked owner cannot publish using an earlier preview or stale query.
  const result = await db
    .prepare(
      `INSERT INTO composer_reports(id,payload_json,source_revision)
    SELECT ?1,?2,?3 WHERE EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=?4 AND user_id=?5 AND role='owner')
    AND EXISTS(SELECT 1 FROM creator_stacks s, json_each(CASE WHEN json_valid(s.published_json) THEN s.published_json ELSE '{}' END,'$.instances') i
      WHERE s.id=?6 AND s.workspace_id=?4 AND s.status='published' AND json_extract(i.value,'$.id')=?7
      AND json_extract(i.value,'$.app')=?8 AND COALESCE(json_extract(i.value,'$.visible'),1)=1)
    ON CONFLICT(id) DO UPDATE SET id=excluded.id RETURNING id`,
    )
    .bind(
      report.id,
      JSON.stringify(report),
      report.sourceRevision,
      scope.workspace,
      scope.user,
      scope.stack,
      scope.instance,
      scope.app,
    )
    .first<{ id: string }>();
  if (!result)
    throw new Error(
      "Ownership or the published instance changed. Review again.",
    );
}

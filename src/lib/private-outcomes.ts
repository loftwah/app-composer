import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import {
  resolveWorkspace,
  requireCapability,
  membership,
  StackError,
} from "./stacks.mjs";
import {
  OUTCOME_DAILY_CAP,
  OUTCOME_RETENTION_DAYS,
  outcomeEvents,
  type OutcomeEvent,
} from "./private-outcome-events.ts";

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const readInput = z
  .object({
    action: z.enum(["report", "export"]),
    workspace: id.optional(),
    days: z.enum(["7", "30"]).optional(),
    end: z.enum(["today", "yesterday"]).optional(),
    stack: id.optional(),
    instance: id.optional(),
    traffic: z.enum(["unclassified", "demo", "all"]).optional(),
  })
  .strict();
const settingsInput = z
  .object({
    action: z.literal("setTraffic"),
    workspace: id,
    stack: id,
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
    traffic: z.enum(["unclassified", "demo"]),
  })
  .strict();
const metricDefinitions = {
  app_open_action: {
    label: "Published app Open actions",
    definition:
      "Recorded activations of visible app-instance Open links on the current published stack. Private Carry / forward links stay outside this collector. Not people, destination loads or conversions.",
  },
  postcard_approved: {
    label: "Verified approval transitions",
    definition:
      "An existing app operation changed another moderation state to approved, with matching pre-dispatch version proof and a confirmed receipt. Dated when confirmation was recorded here; the app commit may be earlier.",
  },
  postcard_hidden: {
    label: "Verified hide transitions",
    definition:
      "A proven app operation changed another moderation state to hidden. Dated when confirmation was recorded here; retries and already-hidden commands do not add another.",
  },
  postcard_deleted: {
    label: "Verified deletion transitions",
    definition:
      "A proven app operation changed another moderation state to deleted. Dated when confirmation was recorded here; it does not establish data or media recovery.",
  },
  retained_snapshots: {
    label: "Retained publication snapshots",
    definition:
      "Immutable publication snapshots still stored in this workspace, dated by their recorded creation time. Not every republish/rollback; removed stacks and deleted history are absent. Their original traffic classification is unavailable.",
  },
};
export type OutcomeMetricKey = keyof typeof metricDefinitions;
export interface OutcomeMetric {
  key: OutcomeMetricKey;
  label: string;
  definition: string;
  value: number | null;
  previous: number | null;
  delta: number | null;
  percent: number | null;
  quality: "unavailable" | "partial" | "bounded" | "retained";
  firstObserved: string | null;
  daily: { date: string; value: number | null }[];
}
export interface OutcomeReport {
  schema: "composer.private-outcomes/1";
  generatedAt: string;
  timezone: "UTC";
  scope: { workspace: string; stack: string | null; instance: string | null };
  traffic: "unclassified" | "demo" | "all";
  period: {
    from: string;
    to: string;
    days: 7 | 30;
    end: "today" | "yesterday";
  };
  previous: { from: string; to: string };
  metrics: OutcomeMetric[];
  targets: {
    stack: string;
    instance: string;
    event: OutcomeEvent;
    n: number;
  }[];
  limits: {
    retentionDays: number;
    dailyCap: number;
    targetRows: number;
    notes: string[];
  };
  unavailable: { key: string; label: string; reason: string }[];
}
interface User {
  id: string;
  role: number;
  name?: string | null;
  email?: string;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
}
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
}
interface StackRow {
  id: string;
  name: string;
  status: string;
  draft_json: string;
  published_json: string | null;
}
const parse = (value: string | null) => {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
};
const shift = (day: string, offset: number) => {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const dateRange = (from: string, to: string) => {
  const values: string[] = [];
  for (let day = from; day <= to; day = shift(day, 1)) values.push(day);
  return values;
};
const fail = (code: string, message: string) => ({
  ok: false as const,
  code,
  message,
});
const origin = "https://composer.loftwah.com";

export async function privateOutcomeReport(
  db: D1Database,
  workspace: string,
  input: z.infer<typeof readInput>,
  now = new Date(),
): Promise<OutcomeReport> {
  const days = input.days === "30" ? 30 : 7,
    end = input.end === "yesterday" ? "yesterday" : "today";
  const today = now.toISOString().slice(0, 10),
    to = shift(today, end === "yesterday" ? -1 : 0),
    from = shift(to, -days + 1);
  const priorTo = shift(from, -1),
    priorFrom = shift(priorTo, -days + 1),
    retainedFrom = shift(today, -OUTCOME_RETENTION_DAYS + 1);
  const traffic = input.traffic ?? "unclassified";
  const scopeValues = [
    workspace,
    input.stack ?? "",
    input.instance ?? "",
    traffic,
  ];
  const scope = `workspace_id=? AND (?='' OR stack_id=?) AND (?='' OR instance_id=?) AND (?='all' OR traffic=?)`;
  const values = [
    scopeValues[0],
    scopeValues[1],
    scopeValues[1],
    scopeValues[2],
    scopeValues[2],
    scopeValues[3],
    scopeValues[3],
  ];
  const rowQuery = db
    .prepare(
      `SELECT day,event,SUM(n) AS n FROM creator_outcome_daily WHERE ${scope} AND day>=? AND day<=? GROUP BY day,event ORDER BY day,event`,
    )
    .bind(...values, priorFrom > retainedFrom ? priorFrom : retainedFrom, to);
  const coverageQuery = db
    .prepare(
      `SELECT event,MIN(day) AS first FROM creator_outcome_daily WHERE ${scope} AND day>=? AND day<=? GROUP BY event`,
    )
    .bind(...values, retainedFrom, today);
  const snapshotScope = `s.workspace_id=? AND (?='' OR s.id=?) AND (?='' OR EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(p.document_json) THEN p.document_json ELSE '{}' END,'$.instances') i WHERE json_extract(i.value,'$.id')=?))`;
  const snapshotQuery = db
    .prepare(
      `SELECT substr(p.published_at,1,10) AS day,COUNT(*) AS n FROM creator_stack_publications p JOIN creator_stacks s ON s.id=p.stack_id
    WHERE ${snapshotScope} AND p.published_at>=? AND p.published_at<? GROUP BY substr(p.published_at,1,10) ORDER BY day`,
    )
    .bind(
      workspace,
      input.stack ?? "",
      input.stack ?? "",
      input.instance ?? "",
      input.instance ?? "",
      priorFrom,
      shift(to, 1),
    );
  const targetQuery = db
    .prepare(
      `SELECT stack_id AS stack,instance_id AS instance,event,SUM(n) AS n FROM creator_outcome_daily WHERE ${scope} AND day>=? AND day<=?
    GROUP BY stack_id,instance_id,event ORDER BY n DESC,stack_id,instance_id,event LIMIT 40`,
    )
    .bind(...values, from > retainedFrom ? from : retainedFrom, to);
  // Metrics, coverage, history and targets share one D1 transaction snapshot.
  // A new arrival cannot create a target that is absent from the metric total.
  const batch = await db.batch([
    rowQuery,
    coverageQuery,
    snapshotQuery,
    targetQuery,
  ]);
  const rows = {
      results: batch[0].results as {
        day: string;
        event: OutcomeEvent;
        n: number;
      }[],
    },
    coverage = {
      results: batch[1].results as { event: OutcomeEvent; first: string }[],
    },
    snapshots = { results: batch[2].results as { day: string; n: number }[] },
    targets = {
      results: batch[3].results as {
        stack: string;
        instance: string;
        event: OutcomeEvent;
        n: number;
      }[],
    };
  const daysInWindow = dateRange(from, to);
  const metrics: OutcomeMetric[] = outcomeEvents.map((key) => {
    const first = coverage.results.find((r) => r.event === key)?.first ?? null;
    const points = new Map(
      rows.results.filter((r) => r.event === key).map((r) => [r.day, r.n]),
    );
    const read = (start: string, through: string) =>
      !first || through < first
        ? null
        : rows.results
            .filter(
              (r) => r.event === key && r.day >= start && r.day <= through,
            )
            .reduce((n, r) => n + r.n, 0);
    const value = read(from, to),
      previous = read(priorFrom, priorTo);
    const complete = Boolean(
      first &&
      from > first &&
      priorFrom > first &&
      to < today &&
      priorFrom >= retainedFrom,
    );
    return {
      key,
      ...metricDefinitions[key],
      value,
      previous,
      delta:
        complete && value !== null && previous !== null
          ? value - previous
          : null,
      percent:
        complete && value !== null && previous !== null && previous > 0
          ? Math.round(((value - previous) * 1000) / previous) / 10
          : null,
      quality:
        value === null
          ? "unavailable"
          : !first || from <= first || to === today || from < retainedFrom
            ? "partial"
            : "bounded",
      firstObserved: first,
      daily: daysInWindow.map((date) => ({
        date,
        value:
          !first || date < first || date < retainedFrom
            ? null
            : (points.get(date) ?? 0),
      })),
    };
  });
  const snapshotCount = (start: string, through: string) =>
    snapshots.results
      .filter((r) => r.day >= start && r.day <= through)
      .reduce((n, r) => n + r.n, 0);
  const current = snapshotCount(from, to),
    previous = snapshotCount(priorFrom, priorTo),
    complete = to < today;
  metrics.push({
    key: "retained_snapshots",
    ...metricDefinitions.retained_snapshots,
    value: current,
    previous,
    delta: complete ? current - previous : null,
    percent:
      complete && previous > 0
        ? Math.round(((current - previous) * 1000) / previous) / 10
        : null,
    quality: "retained",
    firstObserved: null,
    daily: daysInWindow.map((date) => ({
      date,
      value: snapshots.results.find((r) => r.day === date)?.n ?? 0,
    })),
  });
  return {
    schema: "composer.private-outcomes/1",
    generatedAt: now.toISOString(),
    timezone: "UTC",
    scope: {
      workspace,
      stack: input.stack ?? null,
      instance: input.instance ?? null,
    },
    traffic,
    period: { from, to, days, end },
    previous: { from: priorFrom, to: priorTo },
    metrics,
    targets: targets.results,
    limits: {
      retentionDays: OUTCOME_RETENTION_DAYS,
      dailyCap: OUTCOME_DAILY_CAP,
      targetRows: 40,
      notes: [
        "New action aggregates are recorded lower bounds. Recording, rate limits, daily caps and outages can drop events.",
        "The first retained observation is partial, not a deployment or enablement date. Earlier/expired history is unavailable; later zero means no recorded event.",
        "Deleting a stack also removes its private outcome rows. Totals can fall when stacks are removed; deleted-stack activity is unavailable.",
        "Marked verification/release probes and confidently identified robots are excluded. Unmarked bots and demonstrations can count; unclassified is not evidence of customer demand.",
        "A demonstration setting applies only when a future action is collected. Earlier classification is not rewritten; original publication history has no traffic classification.",
        "The traffic filter applies only to collected actions. Original publication history has no recorded demonstration classification.",
        "Publication snapshots describe currently retained records. Their counts can change when stacks/history are removed; they are not a complete publication-action history.",
        "Comparisons require two covered complete UTC windows; percentages also require a nonzero previous count. No anonymous funnel, unique-person or external-conversion measure is inferred.",
        "Targets show at most 40 instance/event rows; the selector lists the 50 most recently updated stacks. Workspace totals include all matching retained rows, including older stacks.",
      ],
    },
    unavailable: [
      {
        key: "linkarooie_card_actions",
        label: "Linkarooie card actions",
        reason:
          "The app has no reviewed scoped action-ingestion contract in this slice.",
      },
      {
        key: "scoped_submissions",
        label: "Scoped visitor submissions and enquiries",
        reason:
          "A public aggregate receipt cannot establish a private workspace/stack attribution.",
      },
      {
        key: "people_or_conversion",
        label: "People, sessions and conversion funnels",
        reason:
          "No visitor identity or scoped cross-step correlation is collected.",
      },
      {
        key: "state_actions",
        label: "Private Carry / forward actions",
        reason: "Its private no-network boundary stays outside this collector.",
      },
    ],
  };
}

async function options(db: D1Database, workspace: string, selected?: StackRow) {
  const stacks = await db
    .prepare(
      "SELECT id,name,status FROM creator_stacks WHERE workspace_id=? ORDER BY updated_at DESC,id LIMIT 50",
    )
    .bind(workspace)
    .all<{ id: string; name: string; status: string }>();
  const instances = new Map<
    string,
    { id: string; label: string; app: string }
  >();
  if (selected) {
    for (const document of [
      parse(selected.published_json),
      parse(selected.draft_json),
    ])
      for (const item of Array.isArray(document.instances)
        ? document.instances
        : [])
        if (
          typeof item.id === "string" &&
          typeof item.label === "string" &&
          typeof item.app === "string"
        )
          instances.set(item.id, {
            id: item.id,
            label: item.label,
            app: item.app,
          });
    const old = await db
      .prepare(
        "SELECT DISTINCT instance_id FROM creator_outcome_daily WHERE workspace_id=? AND stack_id=? ORDER BY instance_id LIMIT 100",
      )
      .bind(workspace, selected.id)
      .all<{ instance_id: string }>();
    for (const row of old.results)
      if (!instances.has(row.instance_id))
        instances.set(row.instance_id, {
          id: row.instance_id,
          label: "Earlier instance " + row.instance_id.slice(0, 8),
          app: "earlier",
        });
  }
  return {
    stacks: stacks.results,
    instances: [...instances.values()].slice(0, 100),
  };
}

export async function managePrivateOutcomes(ctx: Context, runtime: Runtime) {
  if (!ctx.user || !isCreatorRole(ctx.user.role) || !ctx.user.id)
    return fail("FORBIDDEN", "A signed-in Composer creator is required.");
  if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB)
    return fail(
      "UNAVAILABLE",
      "Private outcomes are disconnected in this environment.",
    );
  const reading = ctx.request.method === "GET";
  if (
    (ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin) ||
    (!reading &&
      (ctx.request.headers.get("Origin") !== origin ||
        ctx.request.headers.get("X-EmDash-Request") !== "1"))
  )
    return fail("FORBIDDEN", "Open this report from Composer administration.");
  try {
    const input = (reading ? readInput : settingsInput).parse(ctx.input);
    if (!reading && ctx.request.method !== "POST")
      throw new StackError("INVALID", "Choose a supported outcome action.");
    if (reading) {
      const params = new URL(ctx.request.url).searchParams;
      for (const key of params.keys())
        if (params.getAll(key).length > 1)
          throw new StackError("INVALID", "Choose each report filter once.");
    }
    const db = runtime.DB,
      workspace = await resolveWorkspace(db, ctx.user, input.workspace ?? null);
    requireCapability(workspace.role, "read");
    let stack: StackRow | undefined;
    if (input.stack) {
      stack =
        (await db
          .prepare(
            "SELECT id,name,status,draft_json,published_json FROM creator_stacks WHERE id=? AND workspace_id=?",
          )
          .bind(input.stack, workspace.id)
          .first<StackRow>()) ?? undefined;
      if (!stack)
        throw new StackError(
          "NOT_FOUND",
          "Choose a stack in this workspace.",
          404,
        );
    }
    if (input.action === "setTraffic") {
      if (workspace.role !== "owner")
        throw new StackError(
          "FORBIDDEN",
          "Only this workspace owner can classify future demonstration activity.",
          403,
        );
      const currentOwner =
        "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner')";
      const changed =
        input.expectedRevision === 0
          ? await db
              .prepare(
                `INSERT OR IGNORE INTO creator_outcome_settings(stack_id,workspace_id,traffic_mode)
            SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM creator_stacks WHERE id=? AND workspace_id=?)
            AND ${currentOwner} RETURNING stack_id,traffic_mode,revision`,
              )
              .bind(
                input.stack,
                workspace.id,
                input.traffic,
                input.stack,
                workspace.id,
                workspace.id,
                ctx.user.id,
              )
              .first<{
                stack_id: string;
                traffic_mode: "unclassified" | "demo";
                revision: number;
              }>()
          : await db
              .prepare(
                `UPDATE creator_outcome_settings SET traffic_mode=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP
            WHERE stack_id=? AND workspace_id=? AND revision=? AND ${currentOwner} RETURNING stack_id,traffic_mode,revision`,
              )
              .bind(
                input.traffic,
                input.stack,
                workspace.id,
                input.expectedRevision,
                workspace.id,
                ctx.user.id,
              )
              .first<{
                stack_id: string;
                traffic_mode: "unclassified" | "demo";
                revision: number;
              }>();
      if (!changed)
        throw new StackError(
          "CONFLICT",
          "The demonstration classification or workspace access changed. Refresh the report before trying again.",
          409,
        );
      return {
        ok: true as const,
        workspace,
        setting: {
          stack: changed.stack_id,
          traffic: changed.traffic_mode,
          revision: changed.revision,
        },
      };
    }
    if (input.instance && !stack)
      throw new StackError("INVALID", "Choose a stack before an app instance.");
    const choices = await options(db, workspace.id, stack);
    if (
      input.instance &&
      !choices.instances.some((value) => value.id === input.instance)
    )
      throw new StackError(
        "INVALID",
        "Choose an instance retained in this stack.",
      );
    const report = await privateOutcomeReport(db, workspace.id, input);
    if ((await membership(db, workspace.id, ctx.user.id)) !== workspace.role)
      throw new StackError(
        "FORBIDDEN",
        "Your workspace role changed. Reopen this report.",
        403,
      );
    if (input.action === "export")
      return {
        ok: true as const,
        workspace: { id: workspace.id },
        export: report,
      };
    const setting = stack
      ? await db
          .prepare(
            "SELECT traffic_mode,revision FROM creator_outcome_settings WHERE stack_id=? AND workspace_id=?",
          )
          .bind(stack.id, workspace.id)
          .first<{ traffic_mode: "unclassified" | "demo"; revision: number }>()
      : null;
    if ((await membership(db, workspace.id, ctx.user.id)) !== workspace.role)
      throw new StackError(
        "FORBIDDEN",
        "Your workspace role changed. Reopen this report.",
        403,
      );
    return {
      ok: true as const,
      workspace,
      report,
      options: choices,
      setting: stack
        ? {
            stack: stack.id,
            traffic: setting?.traffic_mode ?? "unclassified",
            revision: setting?.revision ?? 0,
          }
        : null,
    };
  } catch (error) {
    return error instanceof StackError
      ? fail(error.code, error.message)
      : error instanceof z.ZodError
        ? fail(
            "INVALID",
            "Choose the supported report window, target and fixed filters.",
          )
        : fail(
            "UNAVAILABLE",
            "The private outcome query could not complete. This is not a zero count. Try the report again later.",
          );
  }
}

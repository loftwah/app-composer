import { z } from "zod";
import { confirmWorkspace } from "../stacks/workspace-scope.ts";

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const day = z.iso.date();
const traffic = z.enum(["unclassified", "demo"]);
const event = z.enum([
  "app_open_action",
  "postcard_approved",
  "postcard_hidden",
  "postcard_deleted",
]);
const metricKey = z.enum([...event.options, "retained_snapshots"]);
const metric = z.object({
  key: metricKey,
  label: z.string(),
  definition: z.string(),
  value: count.nullable(),
  previous: count.nullable(),
  delta: z.number().finite().nullable(),
  percent: z.number().finite().nullable(),
  quality: z.enum(["unavailable", "partial", "bounded", "retained"]),
  firstObserved: day.nullable(),
  daily: z
    .array(z.object({ date: day, value: count.nullable() }))
    .min(7)
    .max(30),
});
export const reportSchema = z
  .object({
    schema: z.literal("composer.private-outcomes/1"),
    generatedAt: z.string().datetime(),
    timezone: z.literal("UTC"),
    scope: z.object({
      workspace: id,
      stack: id.nullable(),
      instance: id.nullable(),
    }),
    traffic: z.enum(["unclassified", "demo", "all"]),
    period: z.object({
      from: day,
      to: day,
      days: z.union([z.literal(7), z.literal(30)]),
      end: z.enum(["today", "yesterday"]),
    }),
    previous: z.object({ from: day, to: day }),
    metrics: z.array(metric).length(5),
    targets: z
      .array(z.object({ stack: id, instance: id, event, n: count }))
      .max(40),
    limits: z.object({
      retentionDays: count,
      dailyCap: count,
      targetRows: count,
      notes: z.array(z.string()),
    }),
    unavailable: z.array(
      z.object({ key: z.string(), label: z.string(), reason: z.string() }),
    ),
  })
  .superRefine((report, ctx) => {
    if (
      new Set(report.metrics.map((value) => value.key)).size !== 5 ||
      report.metrics.some(
        (value) =>
          value.daily.length !== report.period.days ||
          value.daily[0]?.date !== report.period.from ||
          value.daily.at(-1)?.date !== report.period.to ||
          value.daily.some(
            (point, index) =>
              point.date !==
              new Date(
                Date.parse(report.period.from + "T00:00:00Z") +
                  index * 86400000,
              )
                .toISOString()
                .slice(0, 10),
          ),
      )
    )
      ctx.addIssue({ code: "custom", message: "Incomplete outcome series" });
  });
const workspace = z.object({
  id,
  name: z.string(),
  role: z.enum(["owner", "editor", "viewer"]),
});
const setting = z.object({ stack: id, traffic, revision: count });
const readReply = z.object({
  ok: z.literal(true),
  workspace,
  report: reportSchema,
  setting: setting.nullable(),
  options: z.object({
    stacks: z
      .array(z.object({ id, name: z.string(), status: z.string() }))
      .max(50),
    instances: z
      .array(z.object({ id, label: z.string(), app: z.string() }))
      .max(100),
  }),
});
export type ReportReply = z.infer<typeof readReply>;
export type OutcomeReport = z.infer<typeof reportSchema>;
export type OutcomeMetric = OutcomeReport["metrics"][number];
export type Filters = {
  days: "7" | "30";
  end: "today" | "yesterday";
  stack: string;
  instance: string;
  traffic: "all" | "demo" | "unclassified";
};
export const defaultFilters: Filters = {
  days: "7",
  end: "today",
  stack: "",
  instance: "",
  traffic: "unclassified",
};

export function decodeOutcomeReply(
  action: "report" | "export" | "setTraffic",
  raw: unknown,
  fields: Record<string, unknown> = {},
) {
  const failure = z
    .object({ ok: z.literal(false), code: z.string(), message: z.string() })
    .safeParse(raw);
  if (failure.success) throw Error(failure.data.message);
  const schema =
    action === "report"
      ? readReply
      : action === "export"
        ? z.object({
            ok: z.literal(true),
            workspace: z.object({ id }),
            export: reportSchema,
          })
        : z.object({ ok: z.literal(true), workspace, setting });
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw Error(
      "The server did not confirm a complete outcome reply. Keep your choice and refresh before writing again.",
    );
  const value = parsed.data;
  confirmWorkspace(
    typeof fields.workspace === "string" ? fields.workspace : undefined,
    value.workspace.id,
  );
  const report =
    "report" in value
      ? value.report
      : "export" in value
        ? value.export
        : undefined;
  if (
    "report" in value &&
    ((value.setting?.stack ?? null) !== value.report.scope.stack ||
      value.report.targets.some(
        (target) =>
          (fields.stack && target.stack !== fields.stack) ||
          (fields.instance && target.instance !== fields.instance),
      ))
  )
    throw Error(
      "The report settings or targets did not match this scope. Refresh this view.",
    );
  if (
    report &&
    (report.scope.workspace !== value.workspace.id ||
      report.scope.stack !== (fields.stack || null) ||
      report.scope.instance !== (fields.instance || null) ||
      report.period.days !== Number(fields.days ?? 7) ||
      report.period.end !== (fields.end ?? "today") ||
      report.traffic !== (fields.traffic ?? "unclassified"))
  )
    throw Error(
      "The report did not match the requested scope. Refresh this view.",
    );
  if (
    action === "setTraffic" &&
    (value as { setting: z.infer<typeof setting> }).setting &&
    ((value as { setting: z.infer<typeof setting> }).setting.stack !==
      fields.stack ||
      (value as { setting: z.infer<typeof setting> }).setting.traffic !==
        fields.traffic ||
      (value as { setting: z.infer<typeof setting> }).setting.revision !==
        Number(fields.expectedRevision) + 1)
  )
    throw Error(
      "The classification acknowledgement did not match this change. Refresh before writing again.",
    );
  return value;
}

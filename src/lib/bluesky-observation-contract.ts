import { z } from "zod";

export const blueskyObservationWindows = [24, 72, 168] as const;
export const blueskyObservationGraceHours = 6;
export const blueskyObservationFailures = {
  appview_unavailable: "AppView was unavailable",
  post_missing: "AppView could not find the post",
  revision_changed: "The public CID differs from the publication receipt",
} as const;

const counter = z.number().int().nonnegative().nullable();
const instant = z.string().datetime();

export const blueskyObservationSchema = z
  .object({
    itemId: z.string().uuid(),
    approvalRevision: z.number().int().positive(),
    windowHours: z.union([
      z.literal(0),
      z.literal(24),
      z.literal(72),
      z.literal(168),
    ]),
    dueAt: instant,
    attemptedAt: instant,
    retryAt: instant.nullable(),
    leaseUntil: instant.nullable(),
    observedAt: instant.nullable(),
    attempts: z.number().int().min(1).max(3),
    likes: counter,
    replies: counter,
    reposts: counter,
    quotes: counter,
    lastFailure: z
      .enum(["appview_unavailable", "post_missing", "revision_changed"])
      .nullable(),
    failedAt: instant.nullable(),
  })
  .strict();

export type BlueskyObservation = z.infer<typeof blueskyObservationSchema>;

const hour = 3_600_000;
const baselineAge =
  (blueskyObservationWindows.at(-1)! + blueskyObservationGraceHours) * hour;

export function blueskyObservationSchedule(
  publishedAt: string,
  rows: BlueskyObservation[],
  snapshotAt: string,
) {
  const published = Date.parse(publishedAt);
  const now = Date.parse(snapshotAt);
  const baseline = rows.find(({ windowHours }) => windowHours === 0);
  const shouldBaseline =
    now - published >= baselineAge &&
    !rows.some(({ windowHours }) => windowHours > 0);
  const windows = blueskyObservationWindows.map((hours) => ({
    hours,
    dueAt: new Date(published + hours * hour).toISOString(),
    expiry: published + (hours + blueskyObservationGraceHours) * hour,
    row: rows.find(({ windowHours }) => windowHours === hours),
  }));
  return [
    ...windows,
    ...(shouldBaseline || baseline
      ? [
          {
            hours: 0,
            dueAt: baseline?.dueAt ?? null,
            expiry: Infinity,
            row: baseline,
          },
        ]
      : []),
  ].map(({ hours, dueAt, expiry, row }) => {
    let status = "Awaiting collection";
    if (row?.observedAt) status = "Collected";
    else if (now >= expiry)
      status = row ? "Window closed without a measurement" : "Window missed";
    else if (row?.retryAt) status = "Retry scheduled";
    else if (row?.leaseUntil && Date.parse(row.leaseUntil) > now)
      status = "Collecting";
    else if (row && (row.attempts >= 3 || (row.failedAt && !row.leaseUntil)))
      status = "Collection stopped";
    else if (dueAt && Date.parse(dueAt) > now) status = "Scheduled";
    return { hours, dueAt, row, status };
  });
}

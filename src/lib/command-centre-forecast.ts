// Pure, source-neutral completion outlook for the command centre (#658).
//
// This module derives only from confirmed issue history supplied by a source
// adapter. It never reads the clock, never fetches, never invents a count and
// never turns a missing read into a zero. `state` describes whether a
// completion interval is supported at all; `observations` carries the measured
// facts that were actually confirmed, and they stay facts rather than becoming
// a fake deadline.
//
// Completion means the source recorded a completed closure. It is deliberately
// not a deployment claim: a closed issue is not evidence that anything is live.
import { z } from "zod";

export const forecastMinimumCompleted = 5;
export const forecastMinimumWindowDays = 14;
// Thirteen complete weeks is enough to see variation without turning one old
// project season into today's throughput.
export const forecastMaximumWindowDays = 91;
const dayMs = 86_400_000;
// A ten-year display cap keeps a pathological backlog inside the schema without
// pretending the date is meaningful. The cap is always stated in the notes.
const maximumIntervalDays = 3_650;
const bulkClosureMinimum = 5;
const bulkClosureShare = 0.4;
const bulkClosureDominantShare = 0.6;

export type ForecastStateReason =
  | "completed"
  | "not_planned"
  | "duplicate"
  | "reopened"
  | "unknown"
  | null;

// The minimum a source adapter must supply for one issue. Missing timestamps
// are explicit nulls, never `0` or an assumed date.
export interface ForecastIssue {
  number: number;
  title: string;
  url: string;
  createdAt: string | null;
  closedAt: string | null;
  stateReason: ForecastStateReason;
  reopened: boolean;
  labels: string[];
  milestone: string | null;
  linkedReleaseTag: string | null;
}

export interface ForecastOpenInput {
  // Confirmed total open issues, or null when the source could not confirm it.
  count: number | null;
  // How many open issues the bounded page actually held.
  sampled: number | null;
  // True when the page covers every open issue.
  complete: boolean | null;
}

export interface ForecastInput {
  observedAt: string;
  open: ForecastOpenInput | null;
  // `null` means "not read"; `[]` means "read and confirmed empty".
  openItems: ForecastIssue[] | null;
  closedItems: ForecastIssue[] | null;
  closedPageComplete: boolean | null;
  oldestUpdatedAt: string | null;
}

const instant = z.iso.datetime();
const whole = z.number().int().min(0).max(10_000_000);
const rate = z.number().min(0).max(1_000_000);

export const commandCentreForecastObservations = z
  .object({
    sampledClosed: whole.nullable(),
    sampledCompleted: whole.nullable(),
    notPlanned: whole.nullable(),
    duplicate: whole.nullable(),
    unclassified: whole.nullable(),
    missingTimestamps: whole.nullable(),
    releaseLinked: whole.nullable(),
    sampledSpanDays: whole.nullable(),
    windowDays: whole.nullable(),
    windowStartsAt: instant.nullable(),
    windowCompleted: whole.nullable(),
    perWeek: rate.nullable(),
    medianCycleDays: rate.nullable(),
    cycleSample: whole.nullable(),
    backlog: whole.nullable(),
    openSampled: whole.nullable(),
    openSampleComplete: z.boolean().nullable(),
    reopens: whole.nullable(),
    reopensComplete: z.boolean().nullable(),
    windowCoverage: z.enum(["complete", "partial", "unknown"]),
    bulkClosure: z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        count: whole,
        share: z.number().min(0).max(1),
      })
      .strict()
      .nullable(),
    scope: z
      .object({
        state: z.enum(["stable", "changing", "unknown"]),
        notes: z.array(z.string().min(1).max(240)).max(4),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type CommandCentreForecastObservations = z.infer<
  typeof commandCentreForecastObservations
>;

export const commandCentreForecastInterval = z
  .object({
    earliestAt: instant,
    latestAt: instant,
    earliestDays: whole,
    latestDays: whole,
    confidence: z.enum(["low", "medium"]),
    method: z.string().min(1).max(320),
    beyondYear: z.boolean(),
  })
  .strict();
export type CommandCentreForecastInterval = z.infer<
  typeof commandCentreForecastInterval
>;

const forecastNotes = z.array(z.string().min(1).max(300)).max(8);

export const commandCentreForecast = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("ok"),
      observedAt: instant,
      observations: commandCentreForecastObservations,
      interval: commandCentreForecastInterval.nullable(),
      notes: forecastNotes,
    })
    .strict(),
  z
    .object({
      state: z.literal("unknown"),
      observedAt: instant,
      reason: z.string().min(1).max(300),
      observations: commandCentreForecastObservations,
      notes: forecastNotes,
    })
    .strict(),
]);
export type CommandCentreForecast = z.infer<typeof commandCentreForecast>;

export function emptyObservations(): CommandCentreForecastObservations {
  return {
    sampledClosed: null,
    sampledCompleted: null,
    notPlanned: null,
    duplicate: null,
    unclassified: null,
    missingTimestamps: null,
    releaseLinked: null,
    sampledSpanDays: null,
    windowDays: null,
    windowStartsAt: null,
    windowCompleted: null,
    perWeek: null,
    medianCycleDays: null,
    cycleSample: null,
    backlog: null,
    openSampled: null,
    openSampleComplete: null,
    reopens: null,
    reopensComplete: null,
    windowCoverage: "unknown",
    bulkClosure: null,
    scope: null,
  };
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function readInstant(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined ? null : (left + right) / 2;
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function utcDate(instantValue: string): string | null {
  const ms = readInstant(instantValue);
  return ms === null ? null : iso(ms).slice(0, 10);
}

function unknownForecast(
  observedAt: string,
  reason: string,
  observations: CommandCentreForecastObservations,
  notes: string[] = [],
): CommandCentreForecast {
  return {
    state: "unknown",
    observedAt,
    reason,
    observations,
    notes: notes.slice(0, 8),
  };
}

interface ScopeAssessment {
  state: "stable" | "changing" | "unknown";
  notes: string[];
  createdRecently: number | null;
  completedLast7: number | null;
}

function assessScope(
  openItems: ForecastIssue[],
  completed: ForecastIssue[],
  openComplete: boolean | null,
  observedMs: number,
): ScopeAssessment {
  const last7 = observedMs - 7 * dayMs;
  const created = openItems
    .map((issue) => readInstant(issue.createdAt))
    .filter((value): value is number => value !== null);
  const closed = completed
    .map((issue) => readInstant(issue.closedAt))
    .filter((value): value is number => value !== null);
  const completedLast7 = closed.filter((value) => value >= last7).length;
  if (!openItems.length && openComplete === true)
    return {
      state: "stable",
      notes: ["The confirmed open backlog is empty."],
      createdRecently: 0,
      completedLast7,
    };
  if (!created.length)
    return {
      state: "unknown",
      notes: [
        "The open sample carries no readable creation timestamps, so recent scope growth is unknown.",
      ],
      createdRecently: null,
      completedLast7: closed.length ? completedLast7 : null,
    };
  const createdRecently = created.filter((value) => value >= last7).length;
  const qualifier = openComplete === true ? "" : "At least ";
  const growing =
    createdRecently >= 5 && createdRecently > completedLast7 * 2;
  return {
    state: growing ? "changing" : "stable",
    notes: [
      `${qualifier}${createdRecently} open issues were created in the last 7 days; ${completedLast7} completed in the same period.`,
    ],
    createdRecently,
    completedLast7,
  };
}

// Derives the outlook from confirmed history. The band is deliberately plain:
// backlog divided by the slowest and fastest observed complete-week completion
// rates. It widens when throughput varies and shrinks only when the data does.
export function deriveForecast(input: ForecastInput): CommandCentreForecast {
  const observedMs = readInstant(input.observedAt);
  const observedAt =
    observedMs === null ? new Date(0).toISOString() : iso(observedMs);
  const observations = emptyObservations();
  const notes: string[] = [];

  if (observedMs === null)
    return unknownForecast(
      observedAt,
      "The observation time could not be read, so no window can be measured.",
      observations,
    );

  if (input.open) {
    observations.backlog = input.open.count;
    observations.openSampled = input.open.sampled;
    observations.openSampleComplete = input.open.complete;
  }

  if (input.openItems) {
    observations.openSampled = input.openItems.length;
    observations.reopens = input.openItems.filter(
      (issue) => issue.reopened,
    ).length;
    const openCount = input.open?.count ?? null;
    const openComplete = input.open?.complete ?? null;
    observations.reopensComplete =
      openComplete ??
      (openCount === null ? null : input.openItems.length === openCount);
  }

  let completed: ForecastIssue[] = [];
  let earliestClosed: number | null = null;
  if (input.closedItems) {
    const closed = input.closedItems;
    observations.sampledClosed = closed.length;
    const completedItems: ForecastIssue[] = [];
    const cycles: number[] = [];
    let notPlanned = 0;
    let duplicate = 0;
    let unclassified = 0;
    let missingTimestamps = 0;
    let releaseLinked = 0;

    for (const issue of closed) {
      if (issue.stateReason === "not_planned") {
        notPlanned += 1;
        continue;
      }
      if (issue.stateReason === "duplicate") {
        duplicate += 1;
        continue;
      }
      if (issue.stateReason !== "completed") {
        // `null` means the source recorded no reason; an unrecognised value is
        // not silently promoted to completed work.
        unclassified += 1;
        continue;
      }
      if (issue.linkedReleaseTag) releaseLinked += 1;
      completedItems.push(issue);
      const closedMs = readInstant(issue.closedAt);
      if (closedMs === null) {
        missingTimestamps += 1;
        continue;
      }
      if (closedMs > observedMs) {
        missingTimestamps += 1;
        continue;
      }
      if (earliestClosed === null || closedMs < earliestClosed)
        earliestClosed = closedMs;
      const createdMs = readInstant(issue.createdAt);
      if (createdMs !== null && closedMs >= createdMs)
        cycles.push((closedMs - createdMs) / dayMs);
    }

    completed = completedItems;
    observations.sampledCompleted = completedItems.length;
    observations.notPlanned = notPlanned;
    observations.duplicate = duplicate;
    observations.unclassified = unclassified;
    observations.missingTimestamps = missingTimestamps;
    observations.releaseLinked = releaseLinked;
    if (earliestClosed !== null)
      observations.sampledSpanDays = Math.floor(
        (observedMs - earliestClosed) / dayMs,
      );
    const cycleMedian = median(cycles);
    observations.cycleSample = cycles.length >= 3 ? cycles.length : null;
    observations.medianCycleDays =
      cycles.length >= 3 && cycleMedian !== null
        ? round(cycleMedian, 2)
        : null;
  }

  if (!input.closedItems)
    return unknownForecast(
      observedAt,
      "Recent closed issues were not read, so throughput and a completion interval cannot be derived.",
      observations,
    );
  if (!input.open || input.open.count === null)
    return unknownForecast(
      observedAt,
      "The open backlog was not confirmed, so a completion interval cannot be derived.",
      observations,
    );
  if (input.openItems === null)
    return unknownForecast(
      observedAt,
      "The open-issue sample was not read, so scope and reopen signals cannot be checked.",
      observations,
    );

  if (input.open.count === 0 && input.openItems.length > 0)
    return unknownForecast(
      observedAt,
      "The confirmed open count is zero but the open sample contains issues; the two reads disagree.",
      observations,
    );
  if (input.open.count > 0 && input.openItems.length > input.open.count)
    return unknownForecast(
      observedAt,
      "The open sample contains more issues than the confirmed open count; the two reads disagree.",
      observations,
    );

  const scope = assessScope(
    input.openItems,
    completed,
    input.open.complete,
    observedMs,
  );
  observations.scope = { state: scope.state, notes: scope.notes };

  if (input.open.count === 0) {
    observations.backlog = 0;
    return {
      state: "ok",
      observedAt,
      observations,
      interval: null,
      notes: [
        "The confirmed open backlog is empty; there is nothing to forecast.",
        ...(observations.reopens
          ? [
              `${observations.reopens} sampled open issue${observations.reopens === 1 ? " is" : "s are"} marked reopened, but the confirmed backlog is empty.`,
            ]
          : []),
      ].slice(0, 8),
    };
  }

  const completedCount = observations.sampledCompleted ?? 0;
  if (completedCount < forecastMinimumCompleted)
    return unknownForecast(
      observedAt,
      `Only ${completedCount} completed closure${completedCount === 1 ? " was" : "s were"} found in the recent sample; at least ${forecastMinimumCompleted} are needed.`,
      observations,
      notes,
    );
  if (earliestClosed === null)
    return unknownForecast(
      observedAt,
      "None of the sampled completed issues carries a readable close timestamp, so no window can be measured.",
      observations,
      notes,
    );

  const spanDays = Math.floor((observedMs - earliestClosed) / dayMs);
  if (spanDays < forecastMinimumWindowDays)
    return unknownForecast(
      observedAt,
      `The sampled completed issues span ${spanDays} day${spanDays === 1 ? "" : "s"}; at least ${forecastMinimumWindowDays} days are needed for a weekly rate.`,
      observations,
      notes,
    );

  const windowDays = Math.min(
    forecastMaximumWindowDays,
    Math.floor(spanDays / 7) * 7,
  );
  const windowStart = observedMs - windowDays * dayMs;
  const inWindow = completed.filter((issue) => {
    const closedMs = readInstant(issue.closedAt);
    return closedMs !== null && closedMs >= windowStart && closedMs <= observedMs;
  });
  const weeks = windowDays / 7;
  observations.windowDays = windowDays;
  observations.windowStartsAt = iso(windowStart);
  observations.windowCompleted = inWindow.length;
  observations.perWeek = weeks > 0 ? round(inWindow.length / weeks, 2) : null;

  let coverage: "complete" | "partial" | "unknown" = "unknown";
  if (input.closedPageComplete === true) coverage = "complete";
  else {
    const oldest = readInstant(input.oldestUpdatedAt);
    if (oldest !== null && oldest < windowStart) coverage = "complete";
    else if (oldest !== null && input.closedPageComplete === false)
      coverage = "partial";
  }
  observations.windowCoverage = coverage;

  if (inWindow.length < forecastMinimumCompleted)
    return unknownForecast(
      observedAt,
      `Only ${inWindow.length} completed closure${inWindow.length === 1 ? "" : "s"} fall inside the measured ${windowDays}-day window; at least ${forecastMinimumCompleted} are needed.`,
      observations,
      notes,
    );

  if (scope.state === "changing")
    return unknownForecast(
      observedAt,
      `${scope.notes[0] ?? "Recent scope growth exceeds completions."} The backlog is growing faster than it is being cleared, so no completion interval is supported.`,
      observations,
      notes,
    );

  const byDay = new Map<string, number>();
  for (const issue of inWindow) {
    const date = issue.closedAt ? utcDate(issue.closedAt) : null;
    if (date) byDay.set(date, (byDay.get(date) ?? 0) + 1);
  }
  let bulkDate: string | null = null;
  let bulkCount = 0;
  for (const [date, count] of byDay) {
    if (count > bulkCount) {
      bulkCount = count;
      bulkDate = date;
    }
  }
  let bulkClosure: CommandCentreForecastObservations["bulkClosure"] = null;
  if (
    bulkDate !== null &&
    bulkCount >= bulkClosureMinimum &&
    bulkCount / inWindow.length >= bulkClosureShare
  )
    bulkClosure = {
      date: bulkDate,
      count: bulkCount,
      share: round(bulkCount / inWindow.length, 2),
    };
  observations.bulkClosure = bulkClosure;
  if (
    bulkClosure &&
    (bulkClosure.share >= bulkClosureDominantShare ||
      inWindow.length - bulkClosure.count < forecastMinimumCompleted)
  )
    return unknownForecast(
      observedAt,
      `${bulkClosure.count} of ${inWindow.length} completions fell on ${bulkClosure.date} in a single bulk closure; no steady throughput can be derived.`,
      observations,
      notes,
    );

  const rateItems =
    bulkClosure === null
      ? inWindow
      : inWindow.filter((issue) => utcDate(issue.closedAt ?? "") !== bulkClosure.date);
  const weeklyCounts = Array.from({ length: weeks }, () => 0);
  for (const issue of rateItems) {
    const closedMs = readInstant(issue.closedAt);
    if (closedMs === null) continue;
    const index = Math.min(
      weeks - 1,
      Math.max(0, Math.floor((closedMs - windowStart) / (7 * dayMs))),
    );
    weeklyCounts[index] = (weeklyCounts[index] ?? 0) + 1;
  }
  const fastest = Math.max(...weeklyCounts);
  const slowest = Math.min(...weeklyCounts);
  const weeklyMedian = median(weeklyCounts);
  if (fastest <= 0 || weeklyMedian === null)
    return unknownForecast(
      observedAt,
      "No complete week in the measured window contains a confirmed completion.",
      observations,
      notes,
    );
  const slowestEffective = slowest > 0 ? slowest : weeklyMedian / 2;
  if (slowestEffective <= 0)
    return unknownForecast(
      observedAt,
      "The observed weekly completion rate rounds to zero, so no completion interval is supported.",
      observations,
      notes,
    );

  const earliestDays = Math.max(
    1,
    Math.floor((input.open.count / fastest) * 7),
  );
  const rawLatestDays = Math.ceil(
    (input.open.count / slowestEffective) * 7,
  );
  const latestDays = Math.min(
    maximumIntervalDays,
    Math.max(earliestDays, rawLatestDays),
  );
  const confidence: CommandCentreForecastInterval["confidence"] =
    weeks >= 4 &&
    inWindow.length >= 10 &&
    coverage === "complete" &&
    bulkClosure === null &&
    observations.missingTimestamps === 0 &&
    scope.state === "stable"
      ? "medium"
      : "low";

  if (observations.notPlanned || observations.duplicate)
    notes.push(
      `${observations.notPlanned ?? 0} closure${observations.notPlanned === 1 ? " was" : "s were"} not planned and ${observations.duplicate ?? 0} ${observations.duplicate === 1 ? "was a duplicate" : "were duplicates"}; neither counts as completed.`,
    );
  if (observations.missingTimestamps)
    notes.push(
      `${observations.missingTimestamps} completed closure${observations.missingTimestamps === 1 ? " had" : "s had"} no readable close timestamp and ${observations.missingTimestamps === 1 ? "was" : "were"} excluded from the rate.`,
    );
  if (bulkClosure)
    notes.push(
      `A bulk closure on ${bulkClosure.date} (${bulkClosure.count} issues) was excluded from the weekly rate.`,
    );
  if (slowest === 0)
    notes.push(
      "At least one complete week had no completion; the latest end uses half the median weekly rate.",
    );
  if (coverage !== "complete")
    notes.push(
      "The closed-issue page is a lower bound for this window, so the band can only lengthen.",
    );
  if (observations.releaseLinked === 0)
    notes.push(
      "No sampled completed closure links to a release; closure is not delivery evidence.",
    );
  else
    notes.push(
      `${observations.releaseLinked} sampled completed closure${observations.releaseLinked === 1 ? " links" : "s link"} to a release; a release is still not a live check.`,
    );
  if (observations.reopens)
    notes.push(
      `${observations.reopens} sampled open issue${observations.reopens === 1 ? " is" : "s are"} marked reopened; reopened work is not counted as completed.`,
    );
  if (rawLatestDays > maximumIntervalDays)
    notes.push(
      "The latest end is capped at ten years; the observed rate does not clear this backlog within the measured horizon.",
    );
  if (observations.openSampleComplete === false)
    notes.push(
      `Only ${observations.openSampled ?? 0} of ${input.open.count} open issues were sampled; scope and reopen signals are lower bounds.`,
    );

  return {
    state: "ok",
    observedAt,
    observations,
    interval: {
      earliestAt: iso(observedMs + earliestDays * dayMs),
      latestAt: iso(observedMs + latestDays * dayMs),
      earliestDays,
      latestDays,
      confidence,
      method:
        "Open backlog divided by the fastest and slowest complete-week completion rates. Completion means a completed closure, not a live deployment.",
      beyondYear: latestDays > 365,
    },
    notes: notes.slice(0, 8),
  };
}

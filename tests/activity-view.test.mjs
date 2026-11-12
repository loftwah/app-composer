import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFindings,
  daySelection,
  dayState,
  metricDays,
  signalView,
} from "../src/lib/activity-view.ts";
import { portfolioSummary } from "../lib/usage/portfolio.mjs";

const history = (patch = {}) => ({
  generatedAt: "2026-11-12T08:00:00.000Z",
  period: { from: "2026-11-06", to: "2026-11-12", days: 7, complete: false },
  coverage: { startedAt: "2026-10-13T00:00:00.000Z", quality: "partial", limitations: [] },
  metrics: [
    {
      key: "app_opens",
      label: "App opens",
      value: 12,
      quality: "bounded",
      definition: "Recorded requests.",
      daily: [
        { date: "2026-11-08", value: 2, capped: false },
        { date: "2026-11-09", value: 0, capped: false },
        { date: "2026-11-10", value: 10, capped: true },
        { date: "2026-11-11", value: null, capped: false },
        { date: "2026-11-12", value: 0, capped: false },
      ],
    },
  ],
  apps: [
    {
      app: "guestbook",
      connected: true,
      opens: 12,
      actions: 0,
      photoOpens: 0,
      inspections: 0,
      postcards: null,
      limited: true,
      signals: { app_open: [] },
    },
    {
      app: "showcase",
      connected: true,
      opens: 0,
      actions: 0,
      photoOpens: 0,
      inspections: 0,
      postcards: null,
      limited: false,
      signals: { app_open: [] },
    },
  ],
  ...patch,
});

test("an inspected UTC day must be a real, in-window allowlisted date", () => {
  assert.equal(daySelection("2026-11-10", "2026-11-06", "2026-11-12"), "2026-11-10");
  for (const value of [null, "", "10-11-2026", "2026-02-31", "2026-11-05", "2026-11-13", "javascript:alert(1)"])
    assert.equal(daySelection(value, "2026-11-06", "2026-11-12"), null);
});

test("zero, missing, partial, capped and unavailable stay distinct", () => {
  const view = signalView(history(), "app_opens");
  const byDate = Object.fromEntries(view.days.map((day) => [day.date, day]));
  assert.equal(byDate["2026-11-06"].value, null, "before the first retained day");
  assert.equal(dayState(byDate["2026-11-06"]), "History unavailable");
  assert.equal(byDate["2026-11-09"].value, 0);
  assert.equal(dayState(byDate["2026-11-09"]), "Retained zero · no event recorded");
  assert.equal(byDate["2026-11-10"].capped, true);
  assert.equal(dayState(byDate["2026-11-10"]), "Lower bound · daily cap reached");
  assert.equal(byDate["2026-11-12"].current, true);
  assert.equal(dayState(byDate["2026-11-12"]), "Today, UTC · partial");

  const unavailable = signalView(
    history({
      metrics: [
        {
          key: "guest_postcards_received",
          label: "Guest postcards received",
          value: null,
          quality: "unavailable",
          definition: "No retained receipt history.",
          daily: [],
        },
      ],
    }),
    "guest_postcards_received",
  );
  assert.equal(unavailable.value, null);
  assert.ok(unavailable.days.every((day) => day.value === null));
  assert.ok(unavailable.days.every((day) => dayState(day) === "History unavailable"));
});

test("report views mark the first retained and today as partial without inventing values", () => {
  const days = metricDays(
    [
      { date: "2026-11-01", value: null },
      { date: "2026-11-02", value: 3, capped: true },
      { date: "2026-11-03", value: 0 },
    ],
    "bounded",
    "2026-11-03",
  );
  assert.deepEqual(days.map((day) => [day.value, day.partial, day.current, day.capped]), [
    [null, false, false, false],
    [3, true, false, true],
    [0, false, true, false],
  ]);
});

test("a route-share finding needs three complete and consistent reads", () => {
  const complete = { all: 12, standalone: 5, composed: 7 };
  const withRoutes = history({ surface: "all", routeTotals: complete });
  assert.ok(buildFindings(withRoutes, complete).some((finding) => finding.key === "surface"));
  // A failed or short read must suppress the share rather than substitute zero.
  assert.ok(!buildFindings(history({ surface: "all", routeTotals: null }), null).some((finding) => finding.key === "surface"));
  assert.ok(!buildFindings(history({ surface: "all", routeTotals: null }), { all: 12, standalone: 5, composed: 0 }).some((finding) => finding.key === "surface"));
  // The busiest-day finding selects its exact validated day.
  const peak = buildFindings(withRoutes, complete).find((finding) => finding.key === "peak-day");
  assert.match(peak.href, /day=2026-11-10/);
});

const usageDb = (rows) => ({
  prepare(sql) {
    return {
      bind: () => ({
        all: async () =>
          sql.includes("MIN(day)")
            ? { success: true, results: [{ first_day: "2026-11-08" }] }
            : { success: true, results: rows },
      }),
    };
  },
});

test("the aggregate contract carries per-day capped state without losing zeroes", async () => {
  const report = await portfolioSummary(
    usageDb([
      { day: "2026-11-08", app: "guestbook", event: "postcard_received", n: 2, composed_n: 0 },
      { day: "2026-11-10", app: "guestbook", event: "app_open", n: 1000, composed_n: 0 },
      { day: "2026-11-11", app: "linkcheck", event: "inspection_completed", n: 3, composed_n: 3 },
    ]),
    7,
    new Date("2026-11-12T12:00:00Z"),
    "a".repeat(40),
    "all",
  );
  const opens = report.metrics.find((metric) => metric.key === "app_opens");
  assert.equal(opens.daily.find((day) => day.date === "2026-11-10").capped, true);
  assert.equal(opens.daily.find((day) => day.date === "2026-11-11").value, 0);
  assert.equal(opens.daily.find((day) => day.date === "2026-11-11").capped, false);
  const postcards = report.metrics.find((metric) => metric.key === "guest_postcards_received");
  assert.equal(postcards.daily.find((day) => day.date === "2026-11-08").capped, false);
  assert.equal(report.apps.find((app) => app.app === "guestbook").limited, true);
});

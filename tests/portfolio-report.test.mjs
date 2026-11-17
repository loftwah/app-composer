import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePortfolioMetric, parsePortfolioPeriod, parseProjectReport, previousPeriod,
} from "../src/lib/portfolio-report.ts";

const project = { id: "loftwahfm", measures: ["listening_starts"] };
const now = Date.parse("2026-11-17T10:00:00Z");
const period = parsePortfolioPeriod(new URLSearchParams(), now);
const earlier = previousPeriod(period);
const metricFor = (date, value = 2) => ({
  key: "listening_starts", label: "Listening starts", unit: "count", definition: "Accepted starts",
  value, quality: "exact", daily: [{ date, value }],
});
const response = (window, metrics) => ({
  schema: "woodhouse.portfolio-analytics/1", project: project.id, timezone: "UTC",
  period: { ...window, complete: true }, coverage: { comparableFrom: "2026-10-01" },
  metrics, source: { endpoint: "https://untrusted.example" },
});

test("portfolio windows exclude today and validate bookmarked dates", () => {
  assert.deepEqual(period, { from: "2026-11-10", to: "2026-11-16", days: 7 });
  assert.deepEqual(earlier, { from: "2026-11-03", to: "2026-11-09", days: 7 });
  assert.equal(parsePortfolioPeriod(new URLSearchParams("from=2026-11-11&to=2026-11-17"), now), null);
  assert.equal(parsePortfolioPeriod(new URLSearchParams("days=7&days=30"), now), null);
});

test("scope mismatch, duplicates and unknown metrics cannot leak into a report", () => {
  const item = metricFor(period.to);
  const raw = response(period, [item, { ...item, key: "private_example" }]);
  const parsed = parseProjectReport(raw, project, period);
  assert.deepEqual(parsed.metrics.map(({ key }) => key), ["listening_starts"]);
  assert.equal(parsed.metrics[0].days[0].value, null);
  assert.equal(parsed.metrics[0].days.at(-1).value, 2);
  assert.equal(parseProjectReport(raw, project, earlier), null);
  assert.equal(parseProjectReport(response(period, [item, item]), project, period), null);
});

test("a reported total can have daily gaps but comparisons require both complete series", () => {
  const metric = (date, value) => parseProjectReport(response(period, [metricFor(date, value)]), project, period).metrics[0];
  assert.equal(comparePortfolioMetric(metric(period.to, 2), metric(period.from, 0), earlier, "2026-10-01", "2026-10-01"), null);
  const whole = (window, value) => {
    const points = Array.from({ length: window.days }, (_, index) => ({
      date: new Date(Date.parse(window.from) + index * 86400000).toISOString().slice(0, 10), value,
    }));
    const metric = { ...metricFor(window.to), value: value * window.days, daily: points };
    return parseProjectReport(response(window, [metric]), project, window).metrics[0];
  };
  const current = whole(period, 3);
  const prior = whole(earlier, 2);
  assert.equal(comparePortfolioMetric(current, prior, earlier, "2026-10-01", "2026-10-01"), 14);
  assert.equal(comparePortfolioMetric(current, prior, earlier, "2026-11-05", "2026-10-01"), null);
});

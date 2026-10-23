import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { portfolioSummary } from "../lib/usage/portfolio.mjs";
import {
  buildReport,
  parseFrozenReport,
  reportScope,
  reportIdPattern,
  reportCaption,
  reportImagePath,
} from "../src/lib/public-report.ts";
import { reportShareSvg } from "../src/lib/report-share-svg.ts";
import { filtersFromSearch } from "../src/plugins/outcomes/protocol.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0002_usage.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0003_postcard_receipts.sql", "utf8"));
  const insert = sqlite.prepare("INSERT INTO composer_usage VALUES(?,?,?,?,?)");
  insert.run("2026-10-14", "guestbook", "app_open", "standalone", 4);
  insert.run("2026-10-14", "guestbook", "app_open", "composed", 2);
  insert.run("2026-10-14", "guestbook", "item_open", "standalone", 3);
  insert.run("2026-10-15", "linkcheck", "app_open", "standalone", 2);
  insert.run(
    "2026-10-15",
    "linkcheck",
    "inspection_completed",
    "standalone",
    1,
  );
  insert.run("2026-10-15", "guestbook", "postcard_received", "composed", 2);
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all() {
              return {
                success: true,
                results: sqlite.prepare(sql).all(...params),
              };
            },
          };
        },
      };
    },
  };
  return { sqlite, db, close: () => sqlite.close() };
}

test("one surface scope applies to the daily series, app comparison and receipt coverage", async () => {
  const f = fixture();
  try {
    const now = new Date("2026-10-15T12:00:00Z");
    const all = await portfolioSummary(f.db, 7, now, "a".repeat(40), "all");
    const standalone = await portfolioSummary(
      f.db,
      7,
      now,
      "a".repeat(40),
      "standalone",
    );
    const composed = await portfolioSummary(
      f.db,
      7,
      now,
      "a".repeat(40),
      "composed",
    );
    assert.equal(all.surface, "all");
    assert.equal(standalone.surface, "standalone");
    assert.equal(composed.surface, "composed");
    assert.equal(all.apps.find((app) => app.app === "guestbook").opens, 6);
    assert.equal(
      standalone.apps.find((app) => app.app === "guestbook").opens,
      4,
    );
    assert.equal(composed.apps.find((app) => app.app === "guestbook").opens, 2);
    assert.equal(
      all.metrics.find((metric) => metric.key === "app_opens").value,
      8,
    );
    assert.equal(
      composed.metrics.find((metric) => metric.key === "app_opens").value,
      2,
    );
    assert.equal(
      all.apps.find((app) => app.app === "guestbook").postcards.value,
      2,
    );
    assert.equal(
      standalone.apps.find((app) => app.app === "guestbook").postcards.value,
      null,
    );
    assert.equal(all.apps.find((app) => app.app === "guestbook").photoOpens, 3);
    assert.equal(
      all.apps.find((app) => app.app === "linkcheck").inspections,
      1,
    );
  } finally {
    f.close();
  }
});

test("a frozen story keeps its values, scope, coverage and source identity", async () => {
  const f = fixture();
  try {
    const report = await portfolioSummary(
      f.db,
      7,
      new Date("2026-10-15T12:00:00Z"),
      "b".repeat(40),
      "all",
    );
    const first = await buildReport(
      report,
      {
        app: "guestbook",
        metric: "guest_postcards_received",
        days: 7,
        surface: "all",
      },
      "b".repeat(40),
      new Date("2026-10-16T00:00:00Z"),
    );
    const second = await buildReport(
      report,
      {
        app: "guestbook",
        metric: "guest_postcards_received",
        days: 7,
        surface: "all",
      },
      "b".repeat(40),
      new Date("2026-10-20T00:00:00Z"),
    );
    assert.match(first.id, reportIdPattern);
    assert.equal(
      first.id,
      second.id,
      "same evidence produces one stable identity",
    );
    assert.equal(first.value, 2);
    assert.equal(first.quality, "partial");
    assert.equal(first.daily[0].value, null);
    assert.equal(first.daily.at(-1).value, 2);
    assert.equal(first.period.surface, "all");
    assert.equal(first.coverage.startedAt, report.coverage.startedAt);
    assert.equal(first.sourceRevision, "b".repeat(40));
    assert.deepEqual(
      parseFrozenReport(JSON.parse(JSON.stringify(first))),
      first,
    );
    assert.match(first.headline, /2 guest postcards reached review/);
    assert.match(reportCaption(first), /not unique people/);
    assert.equal(
      reportImagePath(first.id, "portrait"),
      `/reports/${first.id}/portrait.png`,
    );
    assert.equal(parseFrozenReport({ ...first, value: 99 }), undefined);
    assert.equal(parseFrozenReport({ ...first, schema: "private" }), undefined);
  } finally {
    f.close();
  }
});

test("report scope rejects unsupported apps and measures instead of guessing", () => {
  assert.deepEqual(
    reportScope(
      new URLSearchParams(
        "app=guestbook&metric=photo_opens&days=30&surface=composed",
      ),
    ),
    { app: "guestbook", metric: "photo_opens", days: 30, surface: "composed" },
  );
  assert.throws(() =>
    reportScope(new URLSearchParams("app=private-workspace")),
  );
  assert.throws(() =>
    reportScope(new URLSearchParams("metric=owner_outcomes")),
  );
  assert.equal(
    reportScope(new URLSearchParams("surface=staging")).surface,
    "all",
  );
  assert.deepEqual(
    filtersFromSearch(
      "?workspace=abcdef&stack=stack-123456&days=30&end=yesterday&traffic=demo",
    ),
    {
      days: "30",
      end: "yesterday",
      stack: "stack-123456",
      instance: "",
      traffic: "demo",
    },
  );
});

test("the share card reflows the same frozen story into three declared formats without private fields", async () => {
  const f = fixture();
  try {
    const report = await portfolioSummary(
      f.db,
      7,
      new Date("2026-10-15T12:00:00Z"),
      "c".repeat(40),
      "all",
    );
    const frozen = await buildReport(
      report,
      { app: "guestbook", metric: "app_opens", days: 7, surface: "all" },
      "c".repeat(40),
    );
    const measure = (text, size) => text.length * size * 0.58;
    for (const [format, size] of Object.entries({
      landscape: [1200, 630],
      square: [1080, 1080],
      portrait: [1080, 1920],
    })) {
      const svg = reportShareSvg(
        frozen,
        format,
        measure,
        "data:image/png;base64,AA==",
      );
      assert.match(svg, new RegExp(`width="${size[0]}" height="${size[1]}"`));
      assert.match(svg, /App Composer/);
      assert.match(svg, /Here \/ there/);
      assert.doesNotMatch(
        svg,
        /"email"|"visitor_id"|"alias"|"brief_text"|workspace_id/i,
      );
      assert.match(svg, /fc5b05/);
    }
  } finally {
    f.close();
  }
});

test("the public report migration stores only allowlisted aggregate snapshots", () => {
  const migration = readFileSync("migrations/0010_public_reports.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS composer_reports/);
  assert.match(migration, /payload_json/);
  assert.doesNotMatch(
    migration.slice(migration.indexOf("CREATE TABLE")),
    /enquir|visitor|email|workspace|stack/i,
  );
  const page = readFileSync("src/pages/reports/[id].astro", "utf8");
  assert.match(page, /Frozen/);
  assert.match(page, /data-report-native/);
  assert.match(page, /reportImagePath\(report.id, "landscape"\)/);
});

test("owner analytics is labelled, stack-scoped and returns to the useful existing surfaces", () => {
  const plugin = readFileSync("src/lib/creator-plugin.ts", "utf8");
  assert.match(plugin, /Analytics & outcomes/);
  const stacks = readFileSync("src/plugins/stacks-admin.tsx", "utf8");
  assert.match(stacks, /requestedStack/);
  assert.match(
    stacks,
    /outcomes\?workspace=\$\{workspace\.id\}&stack=\$\{stack\.id\}/,
  );
  assert.match(
    stacks,
    /outcomes\?workspace=\$\{workspace\.id\}&stack=\$\{current\.id\}&instance=\$\{instance\.id\}/,
  );
  const outcomes = readFileSync("src/plugins/outcomes.tsx", "utf8");
  assert.match(outcomes, /Back to this stack/);
  assert.match(outcomes, /Private enquiries/);
  assert.match(outcomes, /Compare public activity/);
  assert.match(outcomes, /A reviewed enquiry is an owner decision, not a sale/);
  const base = readFileSync("src/layouts/Base.astro", "utf8");
  assert.match(base, /<a href="\/activity">Analytics<\/a>/);
  const home = readFileSync("src/components/ProductHome.astro", "utf8");
  assert.match(home, /href="\/activity"/);
  const manage = readFileSync("src/pages/manage.astro", "utf8");
  assert.match(manage, /id="analytics-proof"/);
  assert.match(manage, /Preview a frozen story/);
  const activity = readFileSync("src/pages/activity.astro", "utf8");
  assert.match(activity, /const scopeOpens = report \? report\.apps\.reduce/);
  assert.match(activity, /scopeOpens === null \? "—" : count\(scopeOpens\)/);
  assert.doesNotMatch(activity, /strong>\{report \? count\(surfaces\.all\)/);
});

test("finding identity survives preview fields, frozen storage, caption and each export", async () => {
  const { buildFindings } = await import("../src/lib/activity-view.ts");
  const { reportScopeParams, preparePublicReport, reportValueLabel } =
    await import("../src/lib/public-report.ts");
  const f = fixture();
  try {
    const now = new Date("2026-10-15T12:00:00Z");
    const history = await portfolioSummary(f.db, 7, now, "d".repeat(40), "all");
    const findings = buildFindings(history, {
      all: 8,
      composed: 2,
      standalone: 6,
    });
    const route = findings.find((value) => value.key === "surface");
    assert.equal(
      new URL(route.shareHref, "https://example.com").searchParams.get("story"),
      "composed-share",
    );
    const scope = reportScope(
      new URL(route.shareHref, "https://example.com").searchParams,
    );
    assert.deepEqual(
      reportScope(new URLSearchParams(reportScopeParams(scope))),
      scope,
    );
    const frozen = await preparePublicReport(f.db, scope, "d".repeat(40), now);
    assert.equal(frozen.value, 25);
    assert.equal(reportValueLabel(frozen), "25%");
    assert.deepEqual(frozen.story, {
      kind: "composed-share",
      numerator: 2,
      denominator: 8,
    });
    assert.match(frozen.detail, /2 composed-route opens out of 8 total/);
    assert.match(reportCaption(frozen), /25%/);
    assert.deepEqual(
      parseFrozenReport(JSON.parse(JSON.stringify(frozen))),
      frozen,
    );
    assert.equal(
      parseFrozenReport({
        ...frozen,
        story: { ...frozen.story, denominator: 9 },
      }),
      undefined,
    );
    assert.equal(parseFrozenReport({ ...frozen, value: 99 }), undefined);
    for (const format of ["landscape", "square", "portrait"]) {
      const svg = reportShareSvg(
        frozen,
        format,
        (text, size) => text.length * size * 0.5,
        "data:image/png;base64,AA==",
      );
      assert.match(svg, /25%/);
      assert.match(svg, /2 composed \/ 8 total/);
    }
    // With no route comparison finding, the day finding is in the first four.
    const peak = buildFindings(
      { ...history, routeTotals: null },
      { all: 0, composed: 0, standalone: 0 },
    ).find((value) => value.key === "peak-day");
    const peakScope = reportScope(
      new URL(peak.shareHref, "https://example.com").searchParams,
    );
    assert.equal(peakScope.day, "2026-10-14");
    assert.deepEqual(
      reportScope(new URLSearchParams(reportScopeParams(peakScope))),
      peakScope,
    );
    const dayReport = await preparePublicReport(
      f.db,
      peakScope,
      "d".repeat(40),
      now,
    );
    assert.equal(
      dayReport.value,
      6,
      "selected-day count, not period total of eight",
    );
    assert.deepEqual(dayReport.story, { kind: "peak-day", date: "2026-10-14" });
    assert.match(dayReport.headline, /14 Oct 2026 recorded 6/);
    assert.deepEqual(parseFrozenReport(dayReport), dayReport);
    assert.equal(
      parseFrozenReport({
        ...dayReport,
        story: { kind: "peak-day", date: "2026-10-15" },
      }),
      undefined,
    );
    for (const format of ["landscape", "square", "portrait"]) {
      assert.match(
        reportShareSvg(
          dayReport,
          format,
          (text, size) => text.length * size * 0.5,
          "data:image/png;base64,AA==",
        ),
        /2026-10-14/,
      );
    }
    const legacy = await buildReport(
      history,
      { app: null, metric: "app_opens", days: 7, surface: "all" },
      "d".repeat(40),
      now,
    );
    assert.equal(legacy.story, undefined);
    assert.equal(legacy.value, 8);
    assert.deepEqual(parseFrozenReport(legacy), legacy);
    assert.notEqual(legacy.id, frozen.id);
    assert.notEqual(legacy.id, dayReport.id);
    await assert.rejects(() =>
      preparePublicReport(
        f.db,
        { ...peakScope, day: "2026-10-15" },
        "d".repeat(40),
        now,
      ),
    );
  } finally {
    f.close();
  }
});

test("finding requests refuse mismatched measures, dates and private scopes", () => {
  for (const query of [
    "story=composed-share&surface=composed",
    "story=composed-share&app=guestbook",
    "story=peak-day&metric=photo_opens&day=2026-10-14",
    "story=peak-day&day=2026-02-30",
    "story=peak-day",
    "story=owner_outcome",
    "day=2026-10-14",
  ])
    assert.throws(() => reportScope(new URLSearchParams(query)), query);
});

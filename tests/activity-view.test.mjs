import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { portfolioSummary } from "../lib/usage/portfolio.mjs";
import {
  signalView,
  signalSelection,
  appSignalSelection,
  buildFindings,
  describeDay,
} from "../src/lib/activity-view.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0002_usage.sql", "utf8"));
  sqlite.exec(readFileSync("migrations/0003_postcard_receipts.sql", "utf8"));
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

test("the plotted UTC window distinguishes unavailable history, retained zero, partial first day and current day", async () => {
  const f = fixture();
  try {
    f.sqlite
      .prepare("INSERT INTO composer_usage VALUES(?,?,?,?,?)")
      .run("2026-10-14", "hello", "app_open", "standalone", 1000);
    f.sqlite
      .prepare("INSERT INTO composer_usage VALUES(?,?,?,?,?)")
      .run("2026-10-14", "hello", "app_open", "composed", 3);
    const report = await portfolioSummary(
      f.db,
      7,
      new Date("2026-10-18T12:00:00Z"),
    );
    const view = signalView(report, "app_opens");
    assert.equal(view.days.length, 7);
    assert.deepEqual(
      view.days.map((day) => day.value),
      [null, 0, 1003, 0, 0, 0, 0],
    );
    assert.equal(view.value, 1003);
    assert.equal(view.available, 6);
    assert.equal(view.missing, 1);
    assert.equal(view.days[1].partial, true);
    assert.equal(view.days.at(-1).current, true);
    assert(view.ceiling >= 1003);
    assert.match(describeDay(view.days[0]), /history unavailable/);
    assert.match(describeDay(view.days[1]), /0 recorded.*partial/);
    assert.match(describeDay(view.days.at(-1)), /UTC day in progress/);
  } finally {
    f.close();
  }
});

test("a new receipt signal stays unavailable until observation, then keeps its partial day and later genuine zeros", async () => {
  const f = fixture();
  try {
    const now = new Date("2026-10-18T12:00:00Z");
    const missing = signalView(
      await portfolioSummary(f.db, 7, now),
      "guest_postcards_received",
    );
    assert.equal(missing.value, null);
    assert(missing.days.every((day) => day.value === null));
    assert.equal(missing.available, 0);
    f.sqlite
      .prepare("INSERT INTO composer_usage VALUES(?,?,?,?,?)")
      .run("2026-10-16", "guestbook", "postcard_received", "standalone", 2);
    const observed = signalView(
      await portfolioSummary(f.db, 7, now),
      "guest_postcards_received",
    );
    assert.deepEqual(
      observed.days.map((day) => day.value),
      [null, null, null, null, 2, 0, 0],
    );
    assert.equal(observed.days[4].partial, true);
    assert.equal(observed.days[5].partial, false);
    assert.equal(observed.value, 2);
    const opens = signalView(await portfolioSummary(f.db, 7, now), "app_opens");
    assert.equal(
      opens.value,
      0,
      "a received postcard must not become an app-open or conversion estimate",
    );
  } finally {
    f.close();
  }
});

test("expired ranges never become zero-valued chart bars or query unavailable rows", async () => {
  const noRead = {
    prepare() {
      throw Error("Expired history must not be queried");
    },
  };
  const report = await portfolioSummary(
    noRead,
    { from: "2026-10-13", to: "2026-10-18" },
    new Date("2026-12-01T12:00:00Z"),
  );
  for (const key of [
    "app_opens",
    "photo_opens",
    "inspection_completed",
    "guest_postcards_received",
  ]) {
    const view = signalView(report, key);
    assert.equal(view.value, null);
    assert.equal(view.available, 0);
    assert(view.days.every((day) => day.value === null));
    assert.equal(view.ceiling, 1);
  }
  assert.equal(signalSelection("private-workspace-outcomes"), "app_opens");
});

test("each finding keeps its measure, period and route when it opens the evidence", async () => {
  const f = fixture();
  try {
    const now = new Date("2026-10-18T12:00:00Z");
    const insert = f.sqlite.prepare(
      "INSERT INTO composer_usage VALUES(?,?,?,?,?)",
    );
    insert.run("2026-10-16", "guestbook", "app_open", "standalone", 5);
    insert.run("2026-10-16", "guestbook", "app_open", "composed", 3);
    insert.run("2026-10-16", "guestbook", "item_open", "standalone", 4);
    insert.run("2026-10-17", "guestbook", "postcard_received", "standalone", 2);
    insert.run("2026-10-17", "linkcheck", "app_open", "standalone", 1);
    insert.run(
      "2026-10-17",
      "linkcheck",
      "inspection_completed",
      "standalone",
      2,
    );
    const report = await portfolioSummary(
      f.db,
      7,
      now,
      "a".repeat(40),
      "all",
    );
    const findings = buildFindings(report, {
      all: 8,
      standalone: 5,
      composed: 3,
    });
    assert(findings.length >= 4);
    for (const finding of findings) {
      const href = new URL(finding.href, "https://composer.test");
      const share = new URL(finding.shareHref, "https://composer.test");
      assert.equal(href.searchParams.get("days"), "7", finding.key);
      assert.equal(share.searchParams.get("days"), "7", finding.key);
      assert.equal(
        share.searchParams.get("metric"),
        finding.metric,
        finding.key,
      );
      assert.equal(share.searchParams.get("app"), finding.app ?? null);
      if (finding.app) {
        assert.equal(href.searchParams.get("surface"), "all", finding.key);
        assert.equal(
          href.searchParams.get("metric"),
          finding.metric,
          finding.key,
        );
        assert.equal(share.searchParams.get("surface"), "all", finding.key);
      }
    }
    const notes = findings.find((finding) => finding.key === "notes");
    assert.equal(
      notes.href,
      "/activity/guestbook?days=7&surface=all&metric=guest_postcards_received",
    );
    const inspections = findings.find(
      (finding) => finding.key === "inspections",
    );
    assert.equal(
      inspections.href,
      "/activity/linkcheck?days=7&surface=all&metric=inspection_completed",
    );
    const lead = findings.find((finding) => finding.key === "app-lead");
    assert.equal(
      lead.href,
      "/activity/guestbook?days=7&surface=all&metric=app_opens",
    );
  } finally {
    f.close();
  }
});

test("an app record names an unsupported measure instead of substituting it silently", () => {
  assert.deepEqual(appSignalSelection("linkcheck", "inspection_completed"), {
    metric: "inspection_completed",
    unsupported: null,
  });
  assert.deepEqual(appSignalSelection("linkcheck", "photo_opens"), {
    metric: "app_opens",
    unsupported: "photo_opens",
  });
  assert.deepEqual(appSignalSelection("guestbook", "guest_postcards_received"), {
    metric: "guest_postcards_received",
    unsupported: null,
  });
  assert.deepEqual(appSignalSelection("showcase", null), {
    metric: "app_opens",
    unsupported: null,
  });
});

test("each new D2 source has phone/theme assets with matching dimensions and bundled rather than remote fonts", () => {
  const sources = JSON.parse(
    readFileSync("public/diagrams/journey-sources.json", "utf8"),
  );
  const dimensions = JSON.parse(
    readFileSync("public/diagrams/journey-dimensions.json", "utf8"),
  );
  for (const kind of ["composer", "composition", "activity"])
    for (const layout of ["desktop", "mobile"]) {
      const stem = sources[kind] + (layout === "mobile" ? "-mobile" : "");
      assert(readFileSync(`public/diagrams/${stem}.d2`, "utf8").length > 100);
      for (const theme of ["dark", "light"]) {
        const svg = readFileSync(
          `public/diagrams/${stem}-${theme}.svg`,
          "utf8",
        );
        const box = svg
          .match(/viewBox="([^"]+)"/)[1]
          .split(" ")
          .map(Number);
        assert.deepEqual(
          { width: Math.round(box[2]), height: Math.round(box[3]) },
          dimensions[kind][layout],
        );
        assert.doesNotMatch(svg, /(?:href|url\()\s*["']?https?:\/\//);
        const embedded = svg.match(
          /data:application\/font-woff;base64,([A-Za-z0-9+/=]+)/,
        )?.[1];
        assert.ok(embedded, "D2 must bundle the subset font");
        assert.equal(
          Buffer.from(embedded, "base64").toString("ascii", 0, 4),
          "wOFF",
        );
        assert(
          !svg.includes("SpaceGrotesk.ttf.bin"),
          "source filesystem paths do not belong in delivered SVG",
        );
      }
    }
});

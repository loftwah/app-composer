import test from "node:test";
import assert from "node:assert/strict";
import {
  INSIGHT_CARD,
  INSIGHT_CARD_TYPE,
  INSIGHT_PATH,
  insightCardPath,
  insightCardUrl,
  insightPath,
  insightStatusFor,
  insightUrl,
  insightWindow,
  insightWindowFor,
  publicInsight,
} from "../src/lib/activity-insight.ts";

const now = new Date("2026-11-16T10:00:00.000Z");
const days = (window, patch = {}) => ({
  generatedAt: `${window.to}T23:59:00.000Z`,
  period: {
    from: window.from,
    to: window.to,
    days: window.days,
    complete: true,
  },
  coverage: {
    startedAt: "2026-10-13T00:00:00.000Z",
    quality: "bounded",
    limitations: [],
  },
  surface: window.surface,
  metrics: [
    {
      key: "app_opens",
      label: "App opens",
      value: 555,
      quality: "bounded",
      definition: "Recorded requests.",
      daily: Array.from({ length: window.days }, (_, index) => ({
        date: new Date(
          Date.parse(window.from + "T00:00:00Z") + index * 86_400_000,
        )
          .toISOString()
          .slice(0, 10),
        value: 0,
      })),
    },
  ],
  apps: [
    {
      app: "guestbook",
      connected: true,
      opens: 135,
      actions: 29,
      photoOpens: 29,
      inspections: 0,
      postcards: null,
      limited: false,
      signals: {},
    },
    {
      app: "showcase",
      connected: true,
      opens: 133,
      actions: 0,
      photoOpens: 0,
      inspections: 0,
      postcards: null,
      limited: false,
      signals: {},
    },
    {
      app: "linkcheck",
      connected: true,
      opens: 95,
      actions: 1,
      photoOpens: 0,
      inspections: 1,
      postcards: null,
      limited: false,
      signals: {},
    },
    {
      app: "hello",
      connected: true,
      opens: 94,
      actions: 0,
      photoOpens: 0,
      inspections: 0,
      postcards: null,
      limited: false,
      signals: {},
    },
    {
      app: "state",
      connected: true,
      opens: 98,
      actions: 0,
      photoOpens: 0,
      inspections: 0,
      postcards: null,
      limited: false,
      signals: {},
    },
  ],
  ...patch,
});
const window7 = {
  from: "2026-11-09",
  to: "2026-11-15",
  days: 7,
  surface: "all",
};
const publicApps = ["guestbook", "showcase", "linkcheck", "hello", "state"];
const build = (patch = {}, window = window7) =>
  publicInsight(days(window, patch), window, {
    revision: "a".repeat(40),
    readAt: now,
    publicApps,
  });

test("the shared address parses only complete, allowlisted windows", () => {
  const parsed = insightWindow(
    new URLSearchParams("from=2026-11-09&to=2026-11-15&surface=all"),
    now,
  );
  assert.equal(parsed.status, "ok");
  assert.deepEqual(parsed.window, window7);
  // The exact filters survive both directions of the canonical link.
  assert.equal(
    insightPath(window7),
    "/insights/recorded-app-opens?from=2026-11-09&to=2026-11-15&surface=all",
  );
  assert.equal(
    insightUrl(window7),
    "https://composer.loftwah.com/insights/recorded-app-opens?from=2026-11-09&to=2026-11-15&surface=all",
  );
  assert.equal(
    insightCardPath(window7),
    "/insights/recorded-app-opens/card.png?from=2026-11-09&to=2026-11-15&surface=all",
  );
  assert.equal(
    insightCardUrl(window7),
    "https://composer.loftwah.com/insights/recorded-app-opens/card.png?from=2026-11-09&to=2026-11-15&surface=all",
  );
  const again = insightWindow(
    new URLSearchParams(insightPath(window7).split("?")[1]),
    now,
  );
  assert.equal(again.status, "ok");
  assert.deepEqual(again.window, window7);
  assert.equal(INSIGHT_PATH, "/insights/recorded-app-opens");
});

test("an address cannot widen the window, population or route", () => {
  const cases = [
    "from=2026-11-09",
    "to=2026-11-15",
    "from=2026-11-09&to=2026-11-15&surface=all&metric=app_opens",
    "from=2026-11-09&from=2026-11-10&to=2026-11-15",
    "from=2026-11-09&to=2026-11-16",
    "from=2026-11-09&to=2026-11-20",
    "from=2026-11-15&to=2026-11-09",
    "from=2026-02-31&to=2026-11-15",
    "from=2026-11-09&to=2026-11-15&surface=weekly",
    "from=2026-10-01&to=2026-11-15",
  ];
  for (const value of cases) {
    const parsed = insightWindow(new URLSearchParams(value), now);
    assert.equal(parsed.status, "invalid", value);
  }
  assert.equal(INSIGHT_CARD.width, 1200);
  assert.equal(INSIGHT_CARD.height, 630);
  assert.equal(INSIGHT_CARD_TYPE, "image/png");
});

test("the default window ends on the last complete UTC day", () => {
  const window = insightWindowFor(7, "all", now);
  assert.deepEqual(window, {
    from: "2026-11-09",
    to: "2026-11-15",
    days: 7,
    surface: "all",
  });
  assert.equal(window.to < "2026-11-16", true, "today is excluded");
});

test("one real, reconciled ranking carries its definition, unit and window", () => {
  const result = build();
  assert.equal(result.status, "ok");
  const insight = result.insight;
  assert.equal(insight.title, "Recorded app opens");
  assert.equal(insight.metricLabel, "Recorded app opens");
  assert.equal(insight.value, 555);
  assert.equal(insight.valueLabel, "555");
  assert.equal(insight.unit, "recorded opens");
  assert.equal(insight.leader.label, "Here / there");
  assert.equal(insight.leader.opens, 135);
  assert.equal(insight.leader.share, 24);
  assert.equal(insight.leader.shareLabel, "24%");
  assert.deepEqual(
    insight.entries.map((entry) => [entry.label, entry.opens]),
    [
      ["Here / there", 135],
      ["Linkarooie", 133],
      ["Carry / forward", 98],
      ["Link Check", 95],
      ["Hello World", 94],
    ],
  );
  assert.match(
    insight.headline,
    /^Here \/ there drew the most recorded app opens/,
  );
  assert.match(insight.headline, /135 of 555/);
  assert.match(
    insight.definition,
    /successful public mini-app home-page requests/i,
  );
  assert.match(insight.definition, /not people, sessions or conversions/i);
  assert.match(insight.population, /5 public apps/);
  assert.match(
    insight.exclusions.join(" "),
    /today's in-progress UTC day is excluded/i,
  );
  assert.match(insight.exclusions.join(" "), /1,000 per UTC day/);
  assert.match(insight.exclusions.join(" "), /expire after 35 days/);
});

test("the caption names the same metric, window, route and canonical link", () => {
  const result = build();
  assert.equal(result.status, "ok");
  const { insight } = result;
  assert.match(
    insight.caption,
    /^Here \/ there drew the most recorded app opens — 135 of 555 across 5 public apps/,
  );
  assert.match(insight.caption, /9 Nov – 15 Nov 2026 UTC/);
  assert.match(insight.caption, /7 complete UTC days/);
  assert.match(insight.caption, /all connected versions/);
  assert.match(insight.caption, /Recorded requests, not people or conversions/);
  assert.ok(insight.caption.endsWith(insight.canonical));
  // The caption never leaks an internal app id, event name or table name.
  for (const leaked of [
    "guestbook",
    "showcase",
    "linkcheck",
    "hello",
    "state",
    "app_open",
    "item_open",
    "composer_usage",
  ])
    assert.equal(insight.caption.includes(leaked), false, leaked);
  const link = insight.caption.slice(insight.caption.lastIndexOf("https://"));
  const parsed = insightWindow(new URL(link).searchParams, now);
  assert.equal(parsed.status, "ok");
  assert.deepEqual(parsed.window, window7);
});

test("a tie is stated as a tie and never awarded to one app", () => {
  const tied = build({
    metrics: [
      {
        key: "app_opens",
        label: "App opens",
        value: 255,
        quality: "bounded",
        definition: "",
        daily: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-11-${String(9 + index).padStart(2, "0")}`,
          value: 0,
        })),
      },
    ],
    apps: [
      {
        app: "guestbook",
        connected: true,
        opens: 100,
        actions: 0,
        photoOpens: 0,
        inspections: 0,
        postcards: null,
        limited: false,
        signals: {},
      },
      {
        app: "showcase",
        connected: true,
        opens: 100,
        actions: 0,
        photoOpens: 0,
        inspections: 0,
        postcards: null,
        limited: false,
        signals: {},
      },
      {
        app: "linkcheck",
        connected: true,
        opens: 55,
        actions: 0,
        photoOpens: 0,
        inspections: 0,
        postcards: null,
        limited: false,
        signals: {},
      },
      {
        app: "hello",
        connected: true,
        opens: 0,
        actions: 0,
        photoOpens: 0,
        inspections: 0,
        postcards: null,
        limited: false,
        signals: {},
      },
      {
        app: "state",
        connected: true,
        opens: 0,
        actions: 0,
        photoOpens: 0,
        inspections: 0,
        postcards: null,
        limited: false,
        signals: {},
      },
    ],
  });
  assert.equal(tied.status, "ok");
  assert.equal(tied.insight.leaders.length, 2);
  assert.match(tied.insight.headline, /Here \/ there and Linkarooie tied/);
  assert.match(tied.insight.headline, /100 each of 255/);
  assert.match(tied.insight.cardLead, /tied at 100/);
});

test("a capped app makes the shared total an explicit lower bound", () => {
  const limited = build(
    {
      apps: [
        {
          app: "guestbook",
          connected: true,
          opens: 335,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: true,
          signals: {
            app_open: [{ date: "2026-11-09", value: 335, capped: true }],
          },
        },
        {
          app: "showcase",
          connected: true,
          opens: 100,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
        {
          app: "linkcheck",
          connected: true,
          opens: 60,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
        {
          app: "hello",
          connected: true,
          opens: 30,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
        {
          app: "state",
          connected: true,
          opens: 30,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
      ],
    },
    { ...window7, days: 7 },
  );
  assert.equal(limited.status, "ok", limited.reason);
  assert.equal(limited.insight.lowerBound, true);
  assert.equal(limited.insight.valueLabel, "555+");
  assert.match(limited.insight.unit, /lower bound/);
  assert.match(limited.insight.exclusions.join(" "), /ceiling/);
  assert.equal(limited.insight.entries[0].limited, true);
});

test("insufficient, empty or unreconciled data stays unavailable, never zero", () => {
  const unavailable = [
    {
      metrics: [
        {
          key: "app_opens",
          label: "App opens",
          value: null,
          quality: "bounded",
          definition: "",
          daily: [],
        },
      ],
    },
    {
      metrics: [
        {
          key: "app_opens",
          label: "App opens",
          value: 555,
          quality: "unavailable",
          definition: "",
          daily: [],
        },
      ],
    },
    {
      metrics: [
        {
          key: "app_opens",
          label: "App opens",
          value: 555,
          quality: "bounded",
          definition: "",
          daily: [],
        },
      ],
    },
    { apps: [] },
    {
      apps: [
        {
          app: "guestbook",
          connected: true,
          opens: 135,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
      ],
    },
    {
      period: { from: "2026-11-08", to: "2026-11-15", days: 8, complete: true },
    },
    { surface: "standalone" },
  ];
  for (const patch of unavailable) {
    const result = build(patch);
    assert.equal(
      result.status,
      "unavailable",
      JSON.stringify(patch).slice(0, 80),
    );
  }
  // A reconciled total of zero has no leader and is withheld, not published as 0.
  const empty = build({
    metrics: [
      {
        key: "app_opens",
        label: "App opens",
        value: 0,
        quality: "bounded",
        definition: "",
        daily: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-11-${String(9 + index).padStart(2, "0")}`,
          value: 0,
        })),
      },
    ],
    apps: ["guestbook", "showcase", "linkcheck", "hello", "state"].map(
      (app) => ({
        app,
        connected: true,
        opens: 0,
        actions: 0,
        photoOpens: 0,
        inspections: 0,
        postcards: null,
        limited: false,
        signals: {},
      }),
    ),
  });
  assert.equal(empty.status, "empty");
  assert.equal("insight" in empty, false);
});

test("withdrawal fails closed when the public population changes", () => {
  const withdrawn = build({}, window7);
  assert.equal(withdrawn.status, "ok");
  const missingApp = publicInsight(days(window7), window7, {
    revision: "a".repeat(40),
    readAt: now,
    publicApps: publicApps.filter((app) => app !== "linkcheck"),
  });
  assert.equal(missingApp.status, "withdrawn");
  assert.match(missingApp.reason, /public catalogue/);
  const disabled = publicInsight(days(window7), window7, {
    revision: "a".repeat(40),
    readAt: now,
    publicApps,
    enabled: false,
  });
  assert.equal(disabled.status, "withdrawn");
  // A withdrawn or empty source maps to Gone; a failed read maps to 503.
  assert.equal(insightStatusFor("withdrawn"), 410);
  assert.equal(insightStatusFor("empty"), 410);
  assert.equal(insightStatusFor("unavailable"), 503);
  assert.equal(insightStatusFor("invalid"), 404);
  assert.equal(insightStatusFor("ok"), 200);
});

test("the composed scope ranks only apps Composer actually mounts", () => {
  const composedWindow = { ...window7, surface: "composed" };
  const composed = publicInsight(
    days(composedWindow, {
      metrics: [
        {
          key: "app_opens",
          label: "App opens",
          value: 268,
          quality: "bounded",
          definition: "",
          daily: Array.from({ length: 7 }, (_, index) => ({
            date: `2026-11-${String(9 + index).padStart(2, "0")}`,
            value: 0,
          })),
        },
      ],
      apps: [
        {
          app: "guestbook",
          connected: true,
          opens: 135,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
        {
          app: "showcase",
          connected: true,
          opens: 133,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
        {
          app: "linkcheck",
          connected: false,
          opens: 0,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
        {
          app: "hello",
          connected: false,
          opens: 0,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
        {
          app: "state",
          connected: false,
          opens: 0,
          actions: 0,
          photoOpens: 0,
          inspections: 0,
          postcards: null,
          limited: false,
          signals: {},
        },
      ],
    }),
    composedWindow,
    { revision: "a".repeat(40), readAt: now, publicApps },
  );
  assert.equal(composed.status, "ok", composed.reason);
  assert.deepEqual(
    composed.insight.entries.map((entry) => entry.app),
    ["guestbook", "showcase"],
  );
  assert.match(composed.insight.surfaceLabel, /inside Composer/);
  assert.match(composed.insight.population, /2 public apps/);
});

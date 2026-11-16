import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initWasm } from "@resvg/resvg-wasm";
import {
  INSIGHT_CARD,
  INSIGHT_CARD_TYPE,
  insightCardUrl,
  publicInsight,
} from "../src/lib/activity-insight.ts";
import { insightShareSvg } from "../src/lib/insight-share-svg.ts";
import {
  insightTextMeasure,
  renderInsightCard,
} from "../src/lib/insight-card-render.ts";

const wasm = readFileSync("node_modules/@resvg/resvg-wasm/index_bg.wasm");
await initWasm(wasm);
const font = new Uint8Array(
  readFileSync("src/assets/fonts/SpaceGrotesk.ttf.bin"),
);
const brand = readFileSync("src/assets/composer-icon-20261022b-96.png.bin");
const brandImage = `data:image/png;base64,${brand.toString("base64")}`;
const window30 = {
  from: "2026-10-17",
  to: "2026-11-15",
  days: 30,
  surface: "all",
};
const summary = {
  generatedAt: "2026-11-16T10:02:49.811Z",
  period: { from: window30.from, to: window30.to, days: 30, complete: true },
  coverage: {
    startedAt: "2026-10-13T00:00:00.000Z",
    quality: "bounded",
    limitations: [],
  },
  surface: "all",
  metrics: [
    {
      key: "app_opens",
      label: "App opens",
      value: 3280,
      quality: "bounded",
      definition: "",
      daily: Array.from({ length: 30 }, (_, index) => ({
        date: new Date(
          Date.parse(window30.from + "T00:00:00Z") + index * 86_400_000,
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
      opens: 758,
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
      opens: 823,
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
      opens: 594,
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
      opens: 520,
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
      opens: 585,
      actions: 0,
      photoOpens: 0,
      inspections: 0,
      postcards: null,
      limited: false,
      signals: {},
    },
  ],
};
const built = publicInsight(summary, window30, {
  revision: "b".repeat(40),
  readAt: new Date("2026-11-16T10:02:49.811Z"),
  publicApps: ["guestbook", "showcase", "linkcheck", "hello", "state"],
});
assert.equal(built.status, "ok");
const insight = built.insight;
const svg = insightShareSvg(insight, insightTextMeasure(font), brandImage);

test("the share card is a 1200 × 630 PNG from the approved art direction", () => {
  assert.match(svg, /^<svg [^>]*width="1200" height="630"/);
  assert.equal(INSIGHT_CARD.width, 1200);
  assert.equal(INSIGHT_CARD.height, 630);
  assert.equal(INSIGHT_CARD_TYPE, "image/png");
  assert.equal(
    insightCardUrl(window30),
    "https://composer.loftwah.com/insights/recorded-app-opens/card.png?from=2026-10-17&to=2026-11-15&surface=all",
  );
});

test("the card carries the exact title, metric, window, population and source", () => {
  assert.match(svg, /RECORDED APP OPENS/);
  assert.match(svg, /Linkarooie drew the most/);
  assert.match(svg, />opens<\/tspan>/);
  assert.match(svg, /3,280/);
  assert.match(svg, /recorded opens/);
  assert.match(svg, /17 Oct – 15 Nov 2026 UTC · 30 complete UTC days/);
  assert.match(svg, /5 public apps · all connected versions/);
  assert.match(svg, /composer\.loftwah\.com\/insights\/recorded-app-opens/);
  assert.match(
    svg,
    /Successful public home-page requests; reloads and bots can count/,
  );
  assert.match(svg, /not people or conversions/);
  // The approved owned brand tile is embedded, not a remote fetch.
  assert.match(svg, /data:image\/png;base64,/);
  // No private identifiers, raw event names or executable content.
  for (const leaked of [
    "guestbook",
    "showcase",
    "linkcheck",
    "app_open",
    "composer_usage",
    "<script",
    "javascript:",
  ])
    assert.equal(svg.includes(leaked), false, leaked);
});

test("the rendered card is a real 1200 by 630 PNG", () => {
  const png = renderInsightCard(svg, font);
  assert.ok(png.byteLength > 5_000);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assert.equal(view.getUint32(16), 1200, "IHDR width");
  assert.equal(view.getUint32(20), 630, "IHDR height");
});

import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { manageAdminBrand, adminBrandStyles } from "../src/lib/admin-brand.ts";
import {
  adminBrandCss,
  brandDefaults,
  brandSkinName,
  compareAdminBrand,
  normaliseAdminBrandConfig,
} from "../src/lib/admin-brand-contract.ts";
import {
  hapticsAvailable,
  parseSensoryPreference,
  readSensoryPreference,
  sensoryOff,
  serialiseSensoryPreference,
  skinCuePlan,
  soundAvailable,
} from "../src/lib/brand-skin-feedback.ts";

const target = {
  account: "fictional",
  app: "composer",
  environment: "preview",
};
const origin = "https://composer.example";
const legacy = {
  schema: "composer.admin-brand/1",
  target,
  siteName: "Owner admin",
  footerLabel: "Owner footer",
  mark: "composer-approved",
  palette: "composer-orange",
  density: "compact",
  typeScale: "large",
};

test("records saved before the skin slice normalise without losing owner choices", () => {
  const config = normaliseAdminBrandConfig(legacy);
  assert.equal(config.skin, "composer");
  assert.equal(config.skinPressure, 2);
  assert.equal(config.siteName, "Owner admin");
  assert.equal(config.footerLabel, "Owner footer");
  assert.equal(config.density, "compact");
  assert.equal(config.typeScale, "large");
  assert.deepEqual(
    normaliseAdminBrandConfig(JSON.parse(JSON.stringify(legacy))),
    config,
  );
});

test("only core skins and a finite pressure range are accepted", () => {
  const press = normaliseAdminBrandConfig({
    ...legacy,
    skin: "workshop-press",
    skinPressure: 4,
  });
  assert.equal(press.skin, "workshop-press");
  assert.equal(press.skinPressure, 4);
  assert.throws(() =>
    normaliseAdminBrandConfig({ ...legacy, skin: "spec-01" }),
  );
  assert.throws(() =>
    normaliseAdminBrandConfig({ ...legacy, skinPressure: 5 }),
  );
  assert.throws(() =>
    normaliseAdminBrandConfig({ ...legacy, skinPressure: 1.5 }),
  );
  assert.throws(() =>
    normaliseAdminBrandConfig({ ...legacy, schema: "composer.admin-brand/2" }),
  );
  assert.throws(() => normaliseAdminBrandConfig(null));
});

test("skins compile to a bounded CSS layer and leave Composer default untouched", () => {
  const base = brandDefaults(target);
  assert.equal(
    adminBrandCss(base),
    adminBrandCss({ ...base, skinPressure: 4 }),
  );
  assert.doesNotMatch(adminBrandCss(base), /composer-skin-press/);
  const widths = [1, 2, 3, 4].map((skinPressure) =>
    adminBrandCss({ ...base, skin: "workshop-press", skinPressure }),
  );
  assert.match(widths[2], /--composer-skin-press:3px/);
  assert.equal(new Set(widths).size, 4);
  for (const css of widths) {
    assert.doesNotMatch(css, /<|url\(|expression|@import/);
    assert.match(css, /prefers-reduced-motion:reduce/);
    assert.match(css, /:focus-visible/);
  }
});

test("the skin and its pressure appear in the publish comparison only when used", () => {
  const base = brandDefaults(target);
  const press = { ...base, skin: "workshop-press", skinPressure: 3 };
  const labels = compareAdminBrand(base, press).map((item) => item.label);
  assert.deepEqual(labels, ["Skin", "Edge pressure"]);
  assert.equal(compareAdminBrand(base, { ...base, skinPressure: 4 }).length, 0);
  assert.equal(brandSkinName("workshop-press"), "Workshop press");
  assert.deepEqual(
    compareAdminBrand(press, { ...press, density: "compact" }).map(
      (item) => item.key,
    ),
    ["density"],
  );
});

test("sensory preferences are off unless a valid local record enables them", () => {
  assert.deepEqual(parseSensoryPreference(null), sensoryOff);
  assert.deepEqual(
    parseSensoryPreference({ sound: "yes", haptics: 1 }),
    sensoryOff,
  );
  assert.deepEqual(parseSensoryPreference({ sound: true }), {
    sound: true,
    haptics: false,
  });
  assert.deepEqual(
    parseSensoryPreference(
      JSON.parse(serialiseSensoryPreference({ sound: true, haptics: true })),
    ),
    { sound: true, haptics: true },
  );
  const store = new Map([
    ["composer:brand-studio:sensory:v1", '{"sound":false,"haptics":true}'],
  ]);
  assert.deepEqual(
    readSensoryPreference({ getItem: (key) => store.get(key) ?? null }),
    { sound: false, haptics: true },
  );
  assert.deepEqual(
    readSensoryPreference({ getItem: () => "{not json" }),
    sensoryOff,
  );
  assert.deepEqual(readSensoryPreference(undefined), sensoryOff);
  assert.equal(hapticsAvailable({ vibrate: () => true }), true);
  assert.equal(hapticsAvailable({}), false);
  assert.equal(soundAvailable(undefined), false);
  assert.equal(soundAvailable({ AudioContext: class {} }), true);
});

test("reduced motion keeps one direct press cue and drops the settle and buzz", () => {
  const full = skinCuePlan(false);
  const reduced = skinCuePlan(true);
  assert.equal(full.tones.length, 2);
  assert.deepEqual(full.hapticMs, [12]);
  assert.equal(reduced.tones.length, 1);
  assert.deepEqual(reduced.hapticMs, []);
  assert.ok(reduced.tones[0].duration <= full.tones[0].duration);
  for (const tone of full.tones)
    assert.ok(tone.duration <= 0.03 && tone.gain <= 0.05);
});

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys=ON");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0020_admin_brand_studio.sql", import.meta.url),
      "utf8",
    ),
  );
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind(...args) {
      return statement(sql, args);
    },
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      return { results: sqlite.prepare(sql).all(...params) };
    },
  });
  return {
    sqlite,
    db: {
      prepare: statement,
      async batch(statements) {
        sqlite.exec("BEGIN");
        try {
          const results = statements.map((item) => ({
            success: true,
            results: sqlite.prepare(item.sql).all(...item.params),
          }));
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
}
const runtime = (DB) => ({
  DB,
  PUBLIC_ORIGIN: origin,
  RESOURCE_ACCOUNT_ID: "fictional",
  RESOURCE_ENVIRONMENT: "preview",
});
const scope = "fictional:composer:preview";
const admin = { id: "admin-1", role: 50 };
const readRequest = () =>
  new Request(
    `${origin}/_emdash/api/plugins/composer-stacks/brandRead?action=read`,
  );
const writeRequest = (action) =>
  new Request(`${origin}/_emdash/api/plugins/composer-stacks/brandWrite`, {
    method: "POST",
    headers: {
      Origin: origin,
      "X-EmDash-Request": "1",
      "Content-Type": "application/json",
    },
  });

test("a retained version row saved without a skin still loads, then saves and reopens the press", async (t) => {
  const { db, sqlite } = fixture(t);
  const json = JSON.stringify(legacy);
  sqlite
    .prepare(
      "INSERT INTO composer_admin_brands (scope,revision,draft_json,published_version,operation_id) VALUES (?,?,?,?,?)",
    )
    .run(scope, 5, json, 5, "op-legacy");
  sqlite
    .prepare(
      "INSERT INTO composer_admin_brand_versions (scope,version,config_json,event,actor_id,created_at) VALUES (?,?,?,?,?,?)",
    )
    .run(scope, 5, json, "publish", "admin-1", "2026-11-01 00:00:00");

  const before = await manageAdminBrand(
    { user: admin, request: readRequest(), input: { action: "read" } },
    runtime(db),
  );
  assert.equal(before.ok, true);
  assert.equal(before.draft.skin, "composer");
  assert.equal(before.published.skin, "composer");
  assert.equal(before.publishedVersion, 5);
  assert.equal(before.history[0].config.skin, "composer");
  assert.equal(before.history[0].config.siteName, "Owner admin");

  const candidate = {
    ...before.draft,
    skin: "workshop-press",
    skinPressure: 4,
  };
  const saved = await manageAdminBrand(
    {
      user: admin,
      request: writeRequest("save"),
      input: { action: "save", expectedRevision: 5, config: candidate },
    },
    runtime(db),
  );
  assert.equal(saved.ok, true);
  assert.equal(saved.revision, 6);
  assert.equal(saved.draft.skin, "workshop-press");
  assert.equal(saved.draft.skinPressure, 4);
  assert.equal(saved.published.skin, "composer");

  const reopened = await manageAdminBrand(
    { user: admin, request: readRequest(), input: { action: "read" } },
    runtime(db),
  );
  assert.equal(reopened.draft.skin, "workshop-press");
  assert.equal(reopened.history[0].event, "draft");

  const draftCss = await adminBrandStyles(
    {
      user: admin,
      request: new Request(
        `${origin}/_emdash/composer-admin-brand.css?version=6&preview=1`,
      ),
    },
    runtime(db),
  );
  assert.equal(draftCss.status, 200);
  assert.match(await draftCss.text(), /--composer-skin-press:4px/);

  const publishedCss = await adminBrandStyles(
    {
      user: admin,
      request: new Request(
        `${origin}/_emdash/composer-admin-brand.css?version=5`,
      ),
    },
    runtime(db),
  );
  assert.equal(publishedCss.status, 200);
  assert.doesNotMatch(await publishedCss.text(), /composer-skin-press/);
});

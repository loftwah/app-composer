import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  manageAdminBrand,
  adminBrandStyles,
  prepareAdminBrand,
  brandAdminResponse,
} from "../src/lib/admin-brand.ts";
import {
  adminBrandConfig,
  brandDefaults,
  adminBrandCss,
  compareAdminBrand,
  adminReadingPresets,
} from "../src/lib/admin-brand-contract.ts";

test('reading presets preserve identity and compare only actual appearance changes', () => {
  const original = brandDefaults({account: 'fictional', app: 'composer', environment: 'preview'});
  original.siteName = 'Owner customised title';
  original.footerLabel = 'Owner customised footer';
  const preset = adminReadingPresets.find((item) => item.id === 'reading');
  const next = adminBrandConfig.parse({...original, density: preset.density, typeScale: preset.typeScale});
  assert.deepEqual(compareAdminBrand(original, next), [{key:'typeScale',label:'Text size',before:'standard',after:'large'}]);
  assert.equal(next.siteName, original.siteName);
  assert.equal(next.footerLabel, original.footerLabel);
  assert.deepEqual(next.target, original.target);
  assert.deepEqual(compareAdminBrand(original, original), []);
});

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0020_admin_brand_studio.sql", import.meta.url),
      "utf8",
    ),
  );
  let beforeBatch;
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
  });
  const db = {
    prepare: statement,
    async batch(statements) {
      if (beforeBatch) {
        const before = beforeBatch;
        beforeBatch = null;
        await before();
      }
      sqlite.exec("BEGIN");
      try {
        const result = statements.map((s) => ({
          success: true,
          results: sqlite.prepare(s.sql).all(...s.params),
        }));
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const origin = "https://composer.fictional.invalid";
  const runtime = {
    DB: db,
    PUBLIC_ORIGIN: origin,
    RESOURCE_ACCOUNT_ID: "fictional-account-a",
    RESOURCE_ENVIRONMENT: "production",
  };
  const target = {
    account: "fictional-account-a",
    app: "composer",
    environment: "production",
  };
  const user = { id: "fictional-admin", role: 50 };
  const context = (input, actor = user, options = {}) => ({
    user: actor,
    input,
    request: new Request(
      origin +
        "/_emdash/api/plugins/composer-stacks/brand" +
        (input.action === "read" ? "Read" : "Write"),
      {
        method: input.action === "read" ? "GET" : "POST",
        headers: {
          Origin: origin,
          "X-EmDash-Request": "1",
          ...options.headers,
        },
      },
    ),
  });
  const call = (input, actor = user, options) =>
    manageAdminBrand(context(input, actor, options), runtime);
  return {
    sqlite,
    runtime,
    target,
    user,
    origin,
    call,
    context,
    interleave(fn) {
      beforeBatch = fn;
    },
  };
}
test("saved draft, actual publication, second iteration and rollback retain immutable prior versions", async (t) => {
  const f = fixture(t);
  let result = await f.call({ action: "read" });
  assert.equal(result.revision, 0);
  assert.equal(result.published, null);
  const first = { ...result.draft, siteName: "Composer owner studio" };
  result = await f.call({ action: "save", expectedRevision: 0, config: first });
  assert.equal(result.revision, 1);
  assert.equal(result.published, null);
  result = await f.call({
    action: "publish",
    expectedRevision: 1,
    targetVersion: 1,
    target: f.target,
  });
  assert.equal(result.publishedVersion, 2);
  assert.deepEqual(result.published, first);
  const second = {
    ...first,
    footerLabel: "Composer operations",
    density: "compact",
    typeScale: "large",
  };
  result = await f.call({
    action: "save",
    expectedRevision: 2,
    config: second,
  });
  assert.equal(result.publishedVersion, 2);
  assert.deepEqual(result.published, first);
  result = await f.call({
    action: "publish",
    expectedRevision: 3,
    targetVersion: 3,
    target: f.target,
  });
  assert.equal(result.publishedVersion, 4);
  assert.equal(result.published.siteName, first.siteName);
  assert.equal(result.published.footerLabel, second.footerLabel);
  result = await f.call({
    action: "rollback",
    expectedRevision: 4,
    targetVersion: 2,
    target: f.target,
  });
  assert.equal(result.publishedVersion, 5);
  assert.deepEqual(result.published, first);
  assert.deepEqual(
    result.history.map((row) => row.version),
    [5, 4, 3, 2, 1],
  );
  assert.deepEqual(
    result.history.find((row) => row.version === 4).config,
    second,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.published)),
    adminBrandConfig.parse(first),
  );
});
test("RBAC, disabled accounts, origins, environment/account/app and arbitrary CSS/URLs fail without writes", async (t) => {
  const f = fixture(t),
    config = brandDefaults(f.target);
  for (const user of [
    undefined,
    { id: "reader", role: 10 },
    { id: "editor", role: 40 },
    { id: "disabled", role: 50, disabled: true },
  ]) {
    const ctx = f.context({ action: "read" });
    ctx.user = user;
    assert.equal((await manageAdminBrand(ctx, f.runtime)).ok, false);
  }
  const save = { action: "save", expectedRevision: 0, config };
  for (const target of [
    { ...f.target, account: "foreign-account" },
    { ...f.target, app: "guestbook" },
    { ...f.target, environment: "preview" },
  ])
    assert.equal(
      (await f.call({ ...save, config: { ...config, target } })).ok,
      false,
    );
  for (const patch of [
    { siteName: "<script>bad</script>" },
    { palette: "unreviewed-green" },
    { logo: "https://evil.invalid/logo.svg" },
    { css: "body{display:none}" },
    { mark: "data:image/svg+xml,evil" },
    { density: "tiny" },
    { typeScale: "0px" },
  ])
    assert.equal(
      (await f.call({ ...save, config: { ...config, ...patch } })).ok,
      false,
    );
  assert.equal(
    (
      await f.call(save, f.user, {
        headers: { Origin: "https://other.invalid" },
      })
    ).ok,
    false,
  );
  assert.equal(
    (await f.call(save, f.user, { headers: { "X-EmDash-Request": "0" } })).ok,
    false,
  );
  assert.equal(
    (
      await manageAdminBrand(f.context({ action: "read" }), {
        ...f.runtime,
        RESOURCE_ENVIRONMENT: undefined,
      })
    ).ok,
    false,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM composer_admin_brands").get().n,
    0,
  );
});
test("stale publish and interleaved save cannot overwrite a competing review", async (t) => {
  const f = fixture(t),
    config = brandDefaults(f.target);
  await f.call({ action: "save", expectedRevision: 0, config });
  assert.equal(
    (
      await f.call({
        action: "publish",
        expectedRevision: 0,
        targetVersion: 1,
        target: f.target,
      })
    ).code,
    "CONFLICT",
  );
  f.interleave(async () => {
    assert.equal(
      (
        await f.call({
          action: "save",
          expectedRevision: 1,
          config: { ...config, siteName: "Competing saved edit" },
        })
      ).ok,
      true,
    );
  });
  assert.equal(
    (
      await f.call({
        action: "save",
        expectedRevision: 1,
        config: { ...config, siteName: "Lost stale edit" },
      })
    ).code,
    "CONFLICT",
  );
  const current = await f.call({ action: "read" });
  assert.equal(current.draft.siteName, "Competing saved edit");
  assert.equal(current.history.length, 2);
  assert.equal(
    (
      await f.call({
        action: "publish",
        expectedRevision: 2,
        targetVersion: 1,
        target: f.target,
      })
    ).code,
    "INVALID",
  );
  assert.equal(
    (
      await f.call({
        action: "rollback",
        expectedRevision: 2,
        targetVersion: 1,
        target: f.target,
      })
    ).code,
    "INVALID",
  );
});
test("preview and published requests clone global config and cannot contaminate other users or environments", async (t) => {
  const f = fixture(t),
    first = { ...brandDefaults(f.target), siteName: "Published owner name" };
  await f.call({ action: "save", expectedRevision: 0, config: first });
  await f.call({
    action: "publish",
    expectedRevision: 1,
    targetVersion: 1,
    target: f.target,
  });
  await f.call({
    action: "save",
    expectedRevision: 2,
    config: { ...first, siteName: "Private draft name", typeScale: "large" },
  });
  const global = Object.freeze({
    admin: Object.freeze({ locales: ["en"], siteName: "Incumbent name" }),
    siteUrl: f.origin,
  });
  const context = (suffix = "", user = f.user) => {
    const url = new URL(
      f.origin + "/_emdash/admin/plugins/composer-stacks/overview" + suffix,
    );
    return {
      url,
      request: new Request(url),
      locals: { user, emdash: { config: global, db: "preserved-db" } },
    };
  };
  const owner = context("?brandPreview=3"),
    reader = context("", { id: "reader", role: 10 }),
    denied = context("?brandPreview=3", { id: "reader", role: 10 });
  const presentations = await Promise.all([
    prepareAdminBrand(owner, f.runtime),
    prepareAdminBrand(reader, f.runtime),
    prepareAdminBrand(denied, f.runtime),
  ]);
  assert.equal(owner.locals.emdash.config.admin.siteName, "Private draft name");
  assert.equal(
    reader.locals.emdash.config.admin.siteName,
    "Published owner name",
  );
  assert.equal(denied.locals.emdash.config.admin.siteName, "Incumbent name");
  assert.equal(global.admin.siteName, "Incumbent name");
  assert.deepEqual(global.admin.locales, ["en"]);
  assert.equal(presentations[0].preview, true);
  assert.equal(presentations[1].preview, false);
  assert.equal(presentations[2], null);
  assert.equal(owner.locals.emdash.db, "preserved-db");
  const foreign = context();
  assert.equal(
    await prepareAdminBrand(foreign, {
      ...f.runtime,
      RESOURCE_ENVIRONMENT: "preview",
    }),
    null,
  );
  assert.equal(foreign.locals.emdash.config, global);
  const manifest = context();
  manifest.url = new URL(f.origin + "/_emdash/api/manifest");
  manifest.request = new Request(manifest.url, {
    headers: {
      Referer:
        f.origin +
        "/_emdash/admin/plugins/composer-stacks/overview?brandPreview=3",
    },
  });
  await prepareAdminBrand(manifest, f.runtime);
  assert.equal(
    manifest.locals.emdash.config.admin.siteName,
    "Private draft name",
  );
  const res = await brandAdminResponse(
    new Response(
      '<html><head></head><body class="isolate"><main>Real native screen</main></body></html>',
      { headers: { "Content-Type": "text/html" } },
    ),
    presentations[0],
  );
  const html = await res.text();
  assert.match(html, /data-composer-brand-version="3"/);
  assert.match(html, /Saved appearance preview/);
  assert.match(html, /Real native screen/);
  assert.doesNotMatch(html, /style=/);
});
test("stylesheet route protects drafts and emits only the finite reviewed grammar", async (t) => {
  const f = fixture(t),
    config = brandDefaults(f.target);
  await f.call({ action: "save", expectedRevision: 0, config });
  const css = (selected, actor = f.user) =>
    adminBrandStyles(
      {
        user: actor,
        request: new Request(
          f.origin + "/_emdash/composer-admin-brand.css" + selected,
        ),
      },
      f.runtime,
    );
  assert.equal((await css("?version=1")).status, 403);
  assert.equal(
    (await css("?version=1&preview=1", { id: "reader", role: 10 })).status,
    403,
  );
  const preview = await css("?version=1&preview=1");
  assert.equal(preview.headers.get("Content-Type"), "text/css; charset=utf-8");
  assert.match(await preview.text(), /--color-kumo-brand:#c74400/);
  await f.call({
    action: "publish",
    expectedRevision: 1,
    targetVersion: 1,
    target: f.target,
  });
  assert.equal(
    (await css("?version=2", { id: "reader", role: 10 })).status,
    200,
  );
  for (const query of [
    "?version=2&version=1",
    "?version=2&css=body",
    "?version=bad",
  ])
    assert.equal((await css(query)).status, 403);
  const exportConfig = adminBrandConfig.parse(config);
  exportConfig.siteName = "A plain title";
  assert.equal(
    adminBrandCss(exportConfig),
    adminBrandCss(config),
    "user text never enters CSS",
  );
});

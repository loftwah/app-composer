import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { managePluginTrust } from "../src/lib/plugin-trust.ts";

const origin = "https://composer.loftwah.com";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0022_plugin_trust_watch.sql", import.meta.url),
      "utf8",
    ),
  );
  const statement = (sql, params = []) => ({
    bind(...values) {
      return statement(sql, values);
    },
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { success: true, results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      const result = sqlite.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  });
  return { db: { prepare: statement }, sqlite };
}

const runtime = (db) => ({
  DB: db,
  PUBLIC_ORIGIN: origin,
  RESOURCE_ENVIRONMENT: "production",
});
const admin = { id: "fictional-owner-0001", role: 50 };

function context({ method = "GET", body = null, search = "", role = 50 } = {}) {
  const url = origin + "/_emdash/api/plugins/composer-stacks/pluginTrustRead" + search;
  const request = new Request(url, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: body === null ? undefined : JSON.stringify(body),
  });
  return {
    user: { ...admin, role },
    request,
    input: body ?? undefined,
  };
}

test("the route requires a signed-in administrator", async () => {
  const { db } = database();
  await assert.rejects(
    managePluginTrust(context({ role: 20 }), runtime(db)),
    (error) => error.status === 403,
  );
});

test("the read view exposes the disabled watch and no invented reviews", async () => {
  const { db } = database();
  const view = await managePluginTrust(context(), runtime(db));
  assert.equal(view.watchState.available, true);
  assert.equal(view.watchState.enabled, false);
  assert.equal(view.watchState.state, "never");
  assert.equal(view.watch.automatic, false);
  assert.deepEqual(view.watchState.reviews, []);
});

test("enabling the watch persists and is reflected in the view", async () => {
  const { db } = database();
  const view = await managePluginTrust(
    context({ method: "POST", body: { action: "watch", enabled: true } }),
    runtime(db),
  );
  assert.equal(view.watchState.enabled, true);
  assert.equal(view.watch.automatic, true);
  const again = await managePluginTrust(context(), runtime(db));
  assert.equal(again.watchState.enabled, true);
});

test("pausing the watch persists", async () => {
  const { db } = database();
  await managePluginTrust(
    context({ method: "POST", body: { action: "watch", enabled: true } }),
    runtime(db),
  );
  const view = await managePluginTrust(
    context({ method: "POST", body: { action: "watch", enabled: false } }),
    runtime(db),
  );
  assert.equal(view.watchState.enabled, false);
  assert.equal(view.watch.automatic, false);
});

test("unsupported or over-broad actions are refused without writes", async () => {
  const { db, sqlite } = database();
  for (const body of [
    { action: "watch", enabled: "yes" },
    { action: "watch", enabled: true, extra: true },
    { action: "install" },
    { action: "resolve", key: "not-a-review" },
  ])
    await assert.rejects(
      managePluginTrust(context({ method: "POST", body }), runtime(db)),
      (error) => error.status === 400,
      JSON.stringify(body),
    );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM composer_plugin_trust_watch").get().count,
    0,
  );
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS count FROM composer_plugin_trust_reviews")
      .get().count,
    0,
  );
});

test("query overrides are refused", async () => {
  const { db } = database();
  await assert.rejects(
    managePluginTrust(context({ search: "?target=other" }), runtime(db)),
    (error) => error.status === 400,
  );
});

test("another environment or origin is refused", async () => {
  const { db } = database();
  await assert.rejects(
    managePluginTrust(context(), { ...runtime(db), RESOURCE_ENVIRONMENT: "preview" }),
    (error) => error.status === 403,
  );
  const other = context();
  other.request = new Request(
    "https://fictional.example/_emdash/api/plugins/composer-stacks/pluginTrustRead",
    { headers: { Origin: origin } },
  );
  await assert.rejects(
    managePluginTrust(other, runtime(db)),
    (error) => error.status === 403,
  );
});

test("resolving an unknown review reports not found", async () => {
  const { db } = database();
  await assert.rejects(
    managePluginTrust(
      context({
        method: "POST",
        body: {
          action: "resolve",
          key: "plugin-trust:did:plc:fictional:package:x",
        },
      }),
      runtime(db),
    ),
    () => true,
  );
});

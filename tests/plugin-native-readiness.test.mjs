// Installed EmDash 1.3.1 native endpoints, real local SQLite and local storage.
// The existing registry state below is a fictional fixture, not an installation.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "emdash/db";
import { LocalStorage } from "emdash/storage/local";
import { POST as install } from "emdash/internal/routes/api/admin/plugins/registry/install";
import { POST as update } from "emdash/internal/routes/api/admin/plugins/registry/_id_/update";
import { POST as uninstall } from "emdash/internal/routes/api/admin/plugins/registry/_id_/uninstall";
const requireEmdash = createRequire(import.meta.resolve("emdash"));
const { Kysely, SqliteDialect } = await import(requireEmdash.resolve("kysely"));

async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "composer-plugin-native-"));
  const sqlite = new DatabaseSync(join(root, "fictional.sqlite"));
  let db;
  t.after(async () => {
    await db?.destroy();
    sqlite.close();
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  });
  db = new Kysely({
    dialect: new SqliteDialect({
      database: {
        prepare(sql) {
          const statement = sqlite.prepare(sql);
          return {
            reader: statement.columns().length > 0,
            all: (args) => statement.all(...args),
            run: (args) => statement.run(...args),
          };
        },
        close() {},
      },
    }),
  });
  await runMigrations(db);
  const storage = new LocalStorage({
    directory: join(root, "objects"),
    baseUrl: "http://localhost/media",
  });
  const emdash = {
    db,
    storage,
    config: {
      registry: { aggregatorUrl: "https://registry.emdashcms.com" },
      sandboxed: [],
    },
    configuredPlugins: [],
    getSandboxRunner: () => null,
    syncRegistryPlugins: async () => {},
    runPluginUninstallLifecycle: async () => {},
  };
  const call = async (
    route,
    body = {},
    changes = {},
    id = "fictional-registry-plugin",
  ) => {
    const response = await route({
      params: { id },
      request: new Request(
        "http://127.0.0.1/_emdash/api/admin/plugins/registry/install",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),
      locals: { emdash, user: { id: "fictional-owner", role: 50 }, ...changes },
    });
    return { status: response.status, data: await response.json() };
  };
  return { root, sqlite, db, emdash, storage, call };
}
const body = {
  did: "did:web:fixture.invalid",
  slug: "fictional-plugin",
  version: "1.0.0",
};

test("real native registry routes refuse absent admin, unavailable storage and missing runner without effects", async (t) => {
  const f = await fixture(t);
  const originalFetch = globalThis.fetch;
  let network = 0;
  globalThis.fetch = async () => {
    network++;
    throw Error("must not use network");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  for (const route of [install, update, uninstall]) {
    for (const user of [
      undefined,
      { id: "fictional-member", role: 10 },
      { id: "fictional-editor", role: 40 },
    ]) {
      const result = await f.call(route, body, { user });
      assert.ok([401, 403].includes(result.status));
    }
  }
  f.emdash.storage = null;
  assert.equal(
    (await f.call(install, body)).data.error.code,
    "STORAGE_NOT_CONFIGURED",
  );
  f.emdash.storage = f.storage;
  assert.equal(
    (await f.call(install, body)).data.error.code,
    "SANDBOX_NOT_AVAILABLE",
  );
  assert.equal(
    (await f.call(update, {})).data.error.code,
    "SANDBOX_NOT_AVAILABLE",
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM _plugin_state").get().n,
    0,
  );
  assert.equal(network, 0);
});

test("native uninstall preserves fictional plugin data by default, refuses config-source deletion and isolates explicit removal", async (t) => {
  const f = await fixture(t);
  const seed = (id, source) =>
    f.sqlite
      .prepare(
        "INSERT INTO _plugin_state (plugin_id,version,status,source) VALUES (?, '1.0.0','inactive',?)",
      )
      .run(id, source);
  seed("fictional-registry-plugin", "registry");
  seed("fictional-native-plugin", "config");
  f.sqlite
    .prepare(
      "INSERT INTO _plugin_storage (plugin_id,collection,id,data) VALUES (?,?,?,?)",
    )
    .run(
      "fictional-registry-plugin",
      "settings",
      "owner",
      '{"label":"preserved"}',
    );
  f.sqlite
    .prepare(
      "INSERT INTO _plugin_storage (plugin_id,collection,id,data) VALUES (?,?,?,?)",
    )
    .run("fictional-native-plugin", "settings", "owner", '{"label":"other"}');
  const native = await f.call(
    uninstall,
    { deleteData: true },
    {},
    "fictional-native-plugin",
  );
  assert.equal(native.status, 404);
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM _plugin_state WHERE plugin_id='fictional-native-plugin'",
      )
      .get().n,
    1,
  );
  assert.equal((await f.call(uninstall, { deleteData: "true" })).status, 400);
  const kept = await f.call(uninstall);
  assert.equal(kept.status, 200);
  assert.equal(kept.data.data.dataDeleted, false);
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM _plugin_storage WHERE plugin_id='fictional-registry-plugin'",
      )
      .get().n,
    1,
  );
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM _plugin_state WHERE plugin_id='fictional-registry-plugin'",
      )
      .get().n,
    0,
  );
  seed("fictional-registry-plugin", "registry");
  const removed = await f.call(uninstall, { deleteData: true });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.data.dataDeleted, true);
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM _plugin_storage WHERE plugin_id='fictional-registry-plugin'",
      )
      .get().n,
    0,
  );
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM _plugin_storage WHERE plugin_id='fictional-native-plugin'",
      )
      .get().n,
    1,
  );
});

// Real installed native runtime/dispatcher/context/settings crypto, SQLite only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";
import {
  encryptionProbeOption,
  encryptionProbeField,
} from "../src/lib/connection-encryption.ts";
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "virtual:emdash/config")
      return {
        url: "data:text/javascript,export default null",
        shortCircuit: true,
      };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.includes("/emdash/dist/") && url.endsWith(".mjs"))
      return {
        format: "module",
        shortCircuit: true,
        source: readFileSync(new URL(url), "utf8").replaceAll(
          "import.meta.env.DEV",
          "false",
        ),
      };
    return next(url, context);
  },
});
const { EmDashRuntime, dispatchPluginApiRequest } =
  await import("emdash/internal/plugin-test-runtime");
const req = createRequire(import.meta.resolve("emdash"));
const { SqliteDialect } = await import(req.resolve("kysely"));
const actor = {
  ...user,
  email: "owner@fictional.invalid",
  emailVerified: true,
  disabled: false,
  createdAt: new Date("2026-10-25T00:00:00Z"),
  updatedAt: new Date("2026-10-25T00:00:00Z"),
};
const originalKey = process.env.EMDASH_ENCRYPTION_KEY;
process.env.EMDASH_ENCRYPTION_KEY =
  "emdash_enc_v1_" + Buffer.alloc(32, 11).toString("base64url");
test.after(() => {
  hooks.deregister();
  if (originalKey === undefined) delete process.env.EMDASH_ENCRYPTION_KEY;
  else process.env.EMDASH_ENCRYPTION_KEY = originalKey;
});
async function prepared(t, decoratePlugin = (plugin) => plugin) {
  const f = fixture();
  let native;
  t.after(async () => {
    await native?.shutdown();
    await native?.db.destroy();
    f.close();
  });
  let firstHook, runHook;
  const baseDB = f.runtime.DB;
  const wrap = (sql, params = []) => ({
    bind(...values) {
      return wrap(sql, values);
    },
    async first() {
      if (firstHook) await firstHook(sql);
      return baseDB
        .prepare(sql)
        .bind(...params)
        .first();
    },
    async run() {
      if (runHook) await runHook(sql);
      return baseDB
        .prepare(sql)
        .bind(...params)
        .run();
    },
  });
  f.runtime.DB = { prepare: wrap };
  native = await EmDashRuntime.create({
    config: {
      database: { entrypoint: crypto.randomUUID(), config: {} },
      sandboxed: [],
    },
    plugins: [
      decoratePlugin(creatorPlugin("fictional-native-admin", f.runtime)),
    ],
    createDialect: () =>
      new SqliteDialect({
        database: {
          prepare(sql) {
            const s = f.sqlite.prepare(sql);
            return {
              reader: s.columns().length > 0,
              all: (args) => s.all(...args),
              run: (args) => s.run(...args),
            };
          },
          close() {},
        },
      }),
    createStorage: null,
    sandboxEnabled: false,
    sandboxedPluginEntries: [],
    createSandboxRunner: null,
    createScheduler: null,
  });
  f.sqlite
    .prepare(
      "INSERT INTO users (id,email,name,role,disabled) VALUES (?,?,?,?,0)",
    )
    .run(user.id, "owner@fictional.invalid", user.name, 50);
  const workspace = await workspaceForUser(f.db, user);
  const call = async (changes = {}) => {
    const request = new Request(
      origin +
        "/_emdash/api/plugins/composer-stacks/connectionsEncryptionCheck",
      {
        method: changes.method ?? "POST",
        headers: {
          Origin: origin,
          "X-EmDash-Request": "1",
          "Content-Type": "application/json",
          ...changes.headers,
        },
        ...(changes.method === "GET"
          ? {}
          : {
              body: JSON.stringify(
                changes.input ?? { workspace: workspace.id },
              ),
            }),
      },
    );
    const response = await dispatchPluginApiRequest({
      runtime: native,
      pluginId: "composer-stacks",
      path: "/connectionsEncryptionCheck",
      request,
      user: Object.hasOwn(changes, "user") ? changes.user : actor,
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  };
  return {
    ...f,
    native,
    workspace,
    call,
    first(fn) {
      firstHook = fn;
    },
    run(fn) {
      runHook = fn;
    },
  };
}
test("registered native settings encrypt, decrypt, and clear a synthetic option without returning secret/envelope", async (t) => {
  const f = await prepared(t);
  let observed;
  f.first((sql) => {
    if (sql.startsWith("SELECT value,revision"))
      observed = f.sqlite
        .prepare("SELECT value FROM options WHERE name=?")
        .get(encryptionProbeOption)?.value;
  });
  const result = await f.call();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
  assert.equal(result.body.state, "verified");
  assert.equal(result.body.nativeEncryptedEnvelope, true);
  assert.equal(result.body.nativeReadMatched, true);
  assert.equal(result.body.cleaned, true);
  assert.equal(JSON.parse(observed).$emdash, "plugin-setting");
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /ciphertext|\"iv\"|emdash_enc_v1_/,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM options WHERE name=?")
      .get(encryptionProbeOption).n,
    0,
  );
  const repeat = await f.call();
  assert.equal(repeat.body.state, "verified");
  assert.notEqual(repeat.body.operation, result.body.operation);
});
test("anonymous, editor/viewer, disabled account, wrong scope/origin, bearer tokens and GET cause no setting effects", async (t) => {
  const f = await prepared(t);
  for (const changes of [
    { user: undefined },
    { user: { ...actor, role: 40 } },
    { headers: { Origin: "https://attacker.test" } },
    { headers: { Authorization: "Bearer FICTIONAL_CANARY" } },
    { method: "GET" },
    { input: { workspace: "wrong-workspace" } },
    { input: { workspace: f.workspace.id, key: "arbitrary" } },
  ])
    assert.notEqual((await f.call(changes)).status, 200);
  f.sqlite.prepare("UPDATE users SET disabled=1 WHERE id=?").run(user.id);
  assert.equal((await f.call()).status, 403);
  f.sqlite.prepare("UPDATE users SET disabled=0 WHERE id=?").run(user.id);
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  assert.equal((await f.call()).status, 403);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM options WHERE name=?")
      .get(encryptionProbeOption).n,
    0,
  );
});
test("malformed or missing runtime key stays unavailable and leaves no synthetic setting", async (t) => {
  const f = await prepared(t),
    before = process.env.EMDASH_ENCRYPTION_KEY;
  try {
    for (const value of [undefined, "PRIVATE_INVALID_KEY_CANARY"]) {
      if (value === undefined) delete process.env.EMDASH_ENCRYPTION_KEY;
      else process.env.EMDASH_ENCRYPTION_KEY = value;
      const reply = await f.call();
      assert.equal(reply.body.state, "unavailable");
      assert.equal(reply.body.cleaned, true);
      assert.equal(
        JSON.stringify(reply.body).includes("PRIVATE_INVALID_KEY"),
        false,
      );
      assert.equal(
        f.sqlite
          .prepare("SELECT COUNT(*) AS n FROM options WHERE name=?")
          .get(encryptionProbeOption).n,
        0,
      );
    }
  } finally {
    process.env.EMDASH_ENCRYPTION_KEY = before;
  }
});
test("existing values are preserved; concurrent duplicate POST cannot overwrite the first native CAS", async (t) => {
  const f = await prepared(t);
  f.sqlite
    .prepare("INSERT INTO options(name,value,revision) VALUES (?,?,?)")
    .run(encryptionProbeOption, '"OWNER_CANARY"', crypto.randomUUID());
  assert.equal((await f.call()).status, 409);
  assert.equal(
    f.sqlite
      .prepare("SELECT value FROM options WHERE name=?")
      .get(encryptionProbeOption).value,
    '"OWNER_CANARY"',
  );
  f.sqlite
    .prepare("DELETE FROM options WHERE name=?")
    .run(encryptionProbeOption);
  let release, entered;
  const gate = new Promise((r) => (release = r)),
    ready = new Promise((r) => (entered = r));
  let held = false;
  f.first(async (sql) => {
    if (sql.startsWith("SELECT value,revision") && !held) {
      held = true;
      entered();
      await gate;
    }
  });
  const first = f.call();
  await ready;
  assert.equal((await f.call()).status, 409);
  release();
  assert.equal((await first).body.state, "verified");
});
test("revocation during verification cleans only its exact value; changed revision is preserved", async (t) => {
  const f = await prepared(t);
  let revoked = false;
  f.first((sql) => {
    if (sql.startsWith("SELECT value,revision") && !revoked) {
      revoked = true;
      f.sqlite
        .prepare(
          "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
        )
        .run(f.workspace.id, user.id);
    }
  });
  assert.equal((await f.call()).status, 403);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM options WHERE name=?")
      .get(encryptionProbeOption).n,
    0,
  );
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='owner' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  f.first(undefined);
  f.run((sql) => {
    if (sql.startsWith("DELETE FROM options"))
      f.sqlite
        .prepare("UPDATE options SET value=?,revision=? WHERE name=?")
        .run(
          '"OWNER_REPLACEMENT_CANARY"',
          crypto.randomUUID(),
          encryptionProbeOption,
        );
  });
  const changed = await f.call();
  assert.equal(changed.body.state, "cleanup-required");
  assert.equal(
    f.sqlite
      .prepare("SELECT value FROM options WHERE name=?")
      .get(encryptionProbeOption).value,
    '"OWNER_REPLACEMENT_CANARY"',
  );
  assert.equal(
    JSON.stringify(changed.body).includes("OWNER_REPLACEMENT"),
    false,
  );
});

test("native commit with a lost CAS response preserves the unknown revision and requires cleanup", async (t) => {
  const f = await prepared(t, (plugin) => {
    const endpoint = plugin.routes.connectionsEncryptionCheck;
    const handler = endpoint.handler;
    endpoint.handler = (ctx) =>
      handler({
        ...ctx,
        settings: {
          ...ctx.settings,
          async compareAndSet(...args) {
            await ctx.settings.compareAndSet(...args);
            throw Error("FICTIONAL_TRANSPORT_FAILURE_PRIVATE_CANARY");
          },
        },
      });
    return plugin;
  });
  const result = await f.call();
  assert.equal(result.body.state, "cleanup-required");
  assert.equal(result.body.cleaned, false);
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /PRIVATE_CANARY|ciphertext|emdash_enc_v1_/,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM options WHERE name=?")
      .get(encryptionProbeOption).n,
    1,
  );
  assert.equal((await f.call()).status, 409);
});

test("native read failure and failed conditional cleanup retain honest distinct states", async (t) => {
  const f = await prepared(t, (plugin) => {
    const endpoint = plugin.routes.connectionsEncryptionCheck,
      handler = endpoint.handler;
    endpoint.handler = (ctx) =>
      handler({
        ...ctx,
        settings: {
          ...ctx.settings,
          async getVersioned() {
            throw Error("FICTIONAL_READ_PRIVATE_CANARY");
          },
        },
      });
    return plugin;
  });
  const readFailed = await f.call();
  assert.equal(readFailed.body.state, "unavailable");
  assert.equal(readFailed.body.cleaned, true);
  assert.equal(readFailed.body.nativeEncryptedEnvelope, true);
  f.run((sql) => {
    if (sql.startsWith("DELETE FROM options"))
      throw Error("FICTIONAL_DELETE_PRIVATE_CANARY");
  });
  const cleanupFailed = await f.call();
  assert.equal(cleanupFailed.body.state, "cleanup-required");
  assert.equal(cleanupFailed.body.cleaned, false);
  assert.doesNotMatch(
    JSON.stringify(cleanupFailed.body),
    /PRIVATE_CANARY|ciphertext|emdash_enc_v1_/,
  );
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM options WHERE name=?")
      .get(encryptionProbeOption).n,
    1,
  );
});

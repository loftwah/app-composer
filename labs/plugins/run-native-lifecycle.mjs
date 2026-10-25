// Explicit isolated native EmDash lifecycle lab. Uses real registry verification,
// no authoritative-record fixtures and no production credentials/configuration.
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  copyFileSync,
  unlinkSync,
  realpathSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const marker = "composer.native-plugin-lifecycle/1";
const selected = {
  did: "did:plc:p5t4ri3u4rr24wglznjsb5uv",
  slug: "publish-check",
  version: "0.2.0",
};
if (process.argv[2] !== "--worker") {
  if (
    process.argv.length !== 3 ||
    process.argv[2] !== "--run-local-reviewed-plugin"
  )
    throw Error(
      "Use --run-local-reviewed-plugin for the isolated Publish Check 0.2.0 → 0.3.0 lab.",
    );
  const root = mkdtempSync(join(tmpdir(), "composer-native-plugin-"));
  const output = resolve(repo, "output/plugin-operations");
  mkdirSync(output, { recursive: true });
  const receipt = {
    schema: marker,
    selected,
    emdash: "1.3.1",
    runner: "0.9.5",
    workerd: "1.20261013.1",
    startedAt: new Date().toISOString(),
    cleanup: false,
  };
  try {
    writeFileSync(
      join(root, "owner.json"),
      JSON.stringify({ schema: marker, root }),
    );
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: {
          "@emdash-cms/sandbox-workerd": "0.9.5",
          emdash: "1.3.1",
          workerd: "1.20261013.1",
          kysely: "0.29.6",
        },
      }),
    );
    const install = execFileSync(
      "pnpm",
      ["install", "--offline", "--ignore-scripts"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 120000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    writeFileSync(join(output, "runner-install.log"), install.slice(-4000));
    // --ignore-scripts deliberately leaves workerd's JS fallback launcher.
    // Reproduce its normal postinstall binary selection using only the exact
    // already-downloaded platform peer, inside this owned temporary install.
    const peerRequire = createRequire(join(root, "package.json"));
    const workerdRequire = createRequire(peerRequire.resolve("workerd"));
    const native = workerdRequire.resolve(
      `@cloudflare/workerd-${process.platform}-${process.arch}/bin/workerd`,
    );
    const executable = resolve(
      dirname(peerRequire.resolve("workerd")),
      "../bin/workerd",
    );
    const realRoot = realpathSync(root);
    if (
      !realpathSync(native).startsWith(realRoot + "/") ||
      !realpathSync(executable).startsWith(realRoot + "/")
    )
      throw Error("Binary selection escaped the owned installation");
    unlinkSync(executable);
    copyFileSync(native, executable);
    chmodSync(executable, 0o755);
    receipt.nativeBinary = execFileSync(executable, ["--version"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    const result = execFileSync(
      process.execPath,
      [fileURLToPath(import.meta.url), "--worker", root],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 120000,
        env: {
          PATH: process.env.PATH,
          HOME: root,
          TMPDIR: root,
          NODE_ENV: "production",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    Object.assign(receipt, JSON.parse(result.trim().split("\n").at(-1)));
  } catch (error) {
    // Preserve only bounded local diagnostics. No credential/environment dump.
    if (existsSync(join(root, "steps.json")))
      Object.assign(
        receipt,
        JSON.parse(readFileSync(join(root, "steps.json"), "utf8")),
      );
    receipt.failure = {
      kind: error.code ?? "local-process",
      status: error.status ?? null,
    };
    writeFileSync(
      join(output, "native-lifecycle-failure.log"),
      String(error.stderr ?? error.message).slice(-5000),
    );
    process.exitCode = 1;
  } finally {
    rmSync(root, { recursive: true, force: true });
    receipt.cleanup = !existsSync(root);
    receipt.finishedAt = new Date().toISOString();
    writeFileSync(
      join(output, "native-lifecycle.json"),
      JSON.stringify(receipt, null, 2) + "\n",
    );
    console.log(JSON.stringify(receipt, null, 2));
  }
} else {
  const root = resolve(process.argv[3]);
  const owner = JSON.parse(readFileSync(join(root, "owner.json"), "utf8"));
  if (
    owner.schema !== marker ||
    owner.root !== root ||
    !root.split("/").at(-1).startsWith("composer-native-plugin-") ||
    process.env.TMPDIR !== root
  )
    throw Error("Owned root mismatch");
  // Only Astro's build-time configuration module is supplied by the local
  // host. EmDash handlers, signature verification and the runner stay intact.
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
  const req = createRequire(join(root, "package.json"));
  const { createSandboxRunner } = await import(
    pathToFileURL(req.resolve("@emdash-cms/sandbox-workerd"))
  );
  const coreRequire = createRequire(import.meta.resolve("emdash"));
  const { SqliteDialect } = await import(coreRequire.resolve("kysely"));
  const { DatabaseSync } = await import("node:sqlite");
  const { EmDashRuntime } = await import("emdash/internal/plugin-test-runtime");
  const { LocalStorage } = await import("emdash/storage/local");
  const { POST: verify } =
    await import("emdash/internal/routes/api/admin/plugins/registry/verify");
  const { POST: install } =
    await import("emdash/internal/routes/api/admin/plugins/registry/install");
  const { POST: disable } =
    await import("emdash/internal/routes/api/admin/plugins/_id_/disable");
  const { POST: enable } =
    await import("emdash/internal/routes/api/admin/plugins/_id_/enable");
  const { POST: uninstall } =
    await import("emdash/internal/routes/api/admin/plugins/registry/_id_/uninstall");
  const { POST: update } =
    await import("emdash/internal/routes/api/admin/plugins/registry/_id_/update");
  const { GET: getSettings, PUT: putSettings } =
    await import("emdash/internal/routes/api/admin/plugins/_id_/settings");
  const sqlite = new DatabaseSync(join(root, "fictional.sqlite"));
  const dialect = () =>
    new SqliteDialect({
      database: {
        prepare(sql) {
          const s = sqlite.prepare(sql);
          return {
            reader: s.columns().length > 0,
            all: (args) => s.all(...args),
            run: (args) => s.run(...args),
          };
        },
        close() {},
      },
    });
  let runtime;
  const steps = [];
  process.once("SIGTERM", () => {
    void runtime?.shutdown().finally(() => process.exit(124));
  });
  try {
    runtime = await EmDashRuntime.create({
      config: {
        database: { type: "sqlite", entrypoint: root, config: {} },
        storage: { type: "local", entrypoint: root, config: {} },
        registry: { aggregatorUrl: "https://registry.emdashcms.com" },
        astroVersion: "7.4.2",
        sandboxed: [],
      },
      plugins: [],
      createDialect: dialect,
      createStorage: () =>
        new LocalStorage({
          directory: join(root, "objects"),
          baseUrl: "http://127.0.0.1/media",
        }),
      sandboxEnabled: true,
      sandboxedPluginEntries: [],
      createSandboxRunner,
      createScheduler: null,
      siteInfo: { name: "Fictional plugin lifecycle", url: "http://127.0.0.1" },
    });
    const runner = runtime.getSandboxRunner();
    steps.push({
      action: "runner",
      available: runner?.isAvailable() === true,
      type: runner?.constructor.name,
    });
    assert.equal(runner?.isAvailable(), true);
    const call = async (route, body, id = "", role = 50, method = "POST") => {
      const response = await route({
        params: { id },
        request: new Request(
          "http://127.0.0.1/_emdash/api/admin/plugins/registry/install",
          {
            method,
            ...(method === "GET"
              ? {}
              : {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                }),
          },
        ),
        locals: {
          emdash: runtime,
          user: role ? { id: "fictional-local-owner", role } : undefined,
        },
      });
      const data = await response.json();
      steps.push({
        action:
          route === verify
            ? "verify"
            : route === install
              ? "install"
              : route === disable
                ? "disable"
                : route === enable
                  ? "enable"
                  : route === uninstall
                    ? "uninstall"
                    : route === update
                      ? "update"
                      : route === getSettings
                        ? "settings-read"
                        : "settings-write",
        role,
        status: response.status,
        code: data.error?.code ?? null,
        detail:
          typeof data.error?.message === "string"
            ? data.error.message.slice(0, 250)
            : null,
      });
      writeFileSync(join(root, "steps.json"), JSON.stringify({ steps }));
      return {
        status: response.status,
        body: data.data ?? data,
        code: data.error?.code,
      };
    };
    assert.ok(
      [401, 403].includes((await call(install, selected, "", 10)).status),
    );
    const verified = await call(verify, selected);
    if (verified.status !== 200) {
      console.log(
        JSON.stringify({
          outcome: "blocked-native-verification",
          steps,
          blocker: verified.code ?? "verification unavailable",
          registryFixture: false,
          pluginExecuted: false,
        }),
      );
    } else {
      const info = verified.body;
      // Reviewed narrow content-policy authority only. New authority/public
      // routes/MCP tools require a new human review, never automatic consent.
      assert.deepEqual(info.capabilities.toSorted(), [
        "hooks.content-policy:register",
      ]);
      assert.deepEqual(info.publicRoutes, []);
      assert.deepEqual(info.mcpTools, []);
      const target = await call(verify, { ...selected, version: "0.3.0" });
      assert.equal(target.status, 200);
      assert.deepEqual(target.body.capabilities.toSorted(), [
        "hooks.content-policy:register",
      ]);
      assert.deepEqual(target.body.publicRoutes, []);
      const id = info.pluginId;
      const consent = {
        ...selected,
        acknowledgedDeclaredAccess: info.capabilities,
        acknowledgedProfileCid: info.verification.profileCid,
        acknowledgedReleaseCid: info.verification.releaseCid,
      };
      const stale = await call(install, {
        ...consent,
        acknowledgedReleaseCid: "b" + "a".repeat(40),
      });
      assert.notEqual(stale.status, 200);
      const installed = await call(install, consent);
      assert.equal(installed.status, 201);
      await runner.ensureRunning();
      steps.push({ action: "workerd-health", healthy: runner.isHealthy() });
      assert.equal(runner.isHealthy(), true);
      const stored = await runtime.storage.download(
        `registry/${id}/${selected.version}/manifest.json`,
      );
      const manifest = JSON.parse(await new Response(stored.body).text());
      steps.push({
        action: "manifest",
        routes: Object.keys(manifest.routes ?? {}),
        settings: Object.keys(manifest.admin?.settingsSchema ?? {}),
      });
      const state = () =>
        sqlite
          .prepare(
            "SELECT version,status,source FROM _plugin_state WHERE plugin_id=?",
          )
          .get(id);
      assert.equal(state().status, "active");
      const settings = await call(getSettings, {}, id, 50, "GET");
      if (settings.status === 200) {
        const values = {
          ...(settings.body.values ?? {}),
          titleSuffix: "Fictional local release",
        };
        assert.equal(
          (await call(putSettings, { values }, id, 50, "PUT")).status,
          200,
        );
      }
      assert.equal((await call(disable, {}, id)).status, 200);
      assert.equal(state().status, "inactive");
      await runner.ensureRunning();
      assert.equal((await call(enable, {}, id)).status, 200);
      assert.equal(state().status, "active");
      await runner.ensureRunning();
      const updateConsent = {
        version: "0.3.0",
        confirmCapabilityChanges: true,
        acknowledgedProfileCid: target.body.verification.profileCid,
        acknowledgedReleaseCid: target.body.verification.releaseCid,
      };
      assert.notEqual(
        (
          await call(
            update,
            { ...updateConsent, acknowledgedReleaseCid: "b" + "a".repeat(40) },
            id,
          )
        ).status,
        200,
      );
      assert.equal((await call(update, updateConsent, id)).status, 200);
      assert.equal(state().version, "0.3.0");
      await runner.ensureRunning();
      const afterUpdate = await call(getSettings, {}, id, 50, "GET");
      assert.equal(
        afterUpdate.body.values.titleSuffix,
        "Fictional local release",
      );
      const downgrade = await call(update, { version: selected.version }, id);
      assert.equal(downgrade.code, "DOWNGRADE_NOT_ALLOWED");
      const rowsBefore = sqlite
        .prepare("SELECT COUNT(*) AS n FROM options WHERE name LIKE ?")
        .get(`plugin:${id}:settings:%`).n;
      assert.equal((await call(uninstall, {}, id)).status, 200);
      assert.equal(state(), undefined);
      await runner.ensureRunning();
      assert.equal(
        sqlite
          .prepare("SELECT COUNT(*) AS n FROM options WHERE name LIKE ?")
          .get(`plugin:${id}:settings:%`).n,
        rowsBefore,
      );
      assert.ok(rowsBefore > 0);
      const restored = await call(install, {
        ...consent,
        version: "0.3.0",
        acknowledgedProfileCid: target.body.verification.profileCid,
        acknowledgedReleaseCid: target.body.verification.releaseCid,
      });
      assert.equal(restored.status, 201);
      await runner.ensureRunning();
      assert.equal(
        (await call(getSettings, {}, id, 50, "GET")).body.values.titleSuffix,
        "Fictional local release",
      );
      assert.equal((await call(uninstall, {}, id)).status, 200);
      await runner.ensureRunning();
      writeFileSync(
        join(root, "steps.json"),
        JSON.stringify({
          steps,
          verification: info.verification,
          updateVerification: target.body.verification,
          pluginId: id,
          retainedSettingsRows: rowsBefore,
        }),
      );
      console.log(
        JSON.stringify({
          outcome: "local-native-lifecycle",
          steps,
          verification: info.verification,
          updateVerification: target.body.verification,
          pluginId: id,
          registryFixture: false,
          retainedSettingsRows: rowsBefore,
          CloudflareLoader: "not tested",
        }),
      );
    }
  } finally {
    await runtime?.shutdown();
    await runtime?.db.destroy();
    sqlite.close();
    hooks.deregister();
  }
}

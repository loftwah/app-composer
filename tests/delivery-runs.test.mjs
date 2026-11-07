import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { manageDeliveryRuns } from "../src/lib/delivery-runs.ts";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";
import { runDeliveryJourney } from "../scripts/delivery-journey.mjs";

// Follow the packaged test entry to the unmodified EmDash policy dispatcher.
const testRuntime = new URL(
  import.meta.resolve("emdash/internal/plugin-test-runtime"),
);
const dispatchExport = readFileSync(testRuntime, "utf8").match(
  /import \{[^}]*?([A-Za-z]+) as dispatchPluginApiRequest[^}]*?\} from "([^"]+)"/,
);
assert.ok(
  dispatchExport,
  "Installed EmDash must expose its production plugin dispatcher",
);
const dispatchPluginApiRequest = (
  await import(new URL(dispatchExport[2], testRuntime))
)[dispatchExport[1]];

const root = fileURLToPath(new URL("..", import.meta.url));
const origin = "https://composer.loftwah.com";
const config = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8"));

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0023_delivery_runs.sql", import.meta.url),
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
const admin = { id: "fictional-owner-0001", name: "Fictional owner", role: 50 };

function context({
  method = "GET",
  body = null,
  search = "",
  role = 50,
  requestOrigin = origin,
} = {}) {
  const request = new Request(
    origin + "/_emdash/api/plugins/composer-stacks/deliveryRead" + search,
    {
      method,
      headers: { Origin: requestOrigin, "Content-Type": "application/json" },
      body: body === null ? undefined : JSON.stringify(body),
    },
  );
  return { user: { ...admin, role }, request, input: body ?? undefined };
}

function generatedPreview() {
  const preview = config.env.preview;
  return {
    name: preview.name,
    account_id: config.account_id,
    vars: { ...preview.vars },
    d1_databases: preview.d1_databases.map(
      ({ migrations_dir, ...binding }) => binding,
    ),
    r2_buckets: preview.r2_buckets.map((binding) => ({ ...binding })),
    kv_namespaces: preview.kv_namespaces.map((binding) => ({ ...binding })),
    services: [],
    routes: [],
    triggers: { crons: [] },
  };
}

function workspaceFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "composer-delivery-runs-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  copyFileSync(join(root, "wrangler.jsonc"), join(directory, "wrangler.jsonc"));
  copyFileSync(
    join(root, "composition.lock.json"),
    join(directory, "composition.lock.json"),
  );
  mkdirSync(join(directory, ".wrangler", "deploy"), { recursive: true });
  mkdirSync(join(directory, "dist", "server"), { recursive: true });
  mkdirSync(join(directory, "dist", "client"), { recursive: true });
  writeFileSync(
    join(directory, ".wrangler", "deploy", "config.json"),
    JSON.stringify({ configPath: "../../dist/server/wrangler.json" }),
  );
  writeFileSync(
    join(directory, "dist", "server", "wrangler.json"),
    JSON.stringify(generatedPreview()),
  );
  writeFileSync(join(directory, "dist", "client", "app.js"), "console.log(1)\n");
  return directory;
}

const source = {
  available: true,
  repository: "loftwah/app-composer",
  branch: "main",
  commit: "a".repeat(40),
  originCommit: "a".repeat(40),
  dirty: false,
  pushed: true,
};

async function candidateReceipt(t) {
  return await runDeliveryJourney({
    workspace: workspaceFixture(t),
    mode: "candidate",
    source,
    environment: { HOME: "/tmp" },
    execute: async () => {},
    verify: async () => assert.fail("candidate must not verify live"),
  });
}

test("the route requires a signed-in administrator", async (t) => {
  const { db } = database();
  await assert.rejects(
    manageDeliveryRuns(context({ role: 20 }), runtime(db)),
    (error) => error.status === 403,
  );
  await assert.rejects(
    manageDeliveryRuns(
      { user: undefined, request: context().request, input: undefined },
      runtime(db),
    ),
    (error) => error.status === 403,
  );
});

test("a non-production origin or environment is refused", async (t) => {
  const { db } = database();
  await assert.rejects(
    manageDeliveryRuns(
      context({ requestOrigin: "https://example.invalid" }),
      runtime(db),
    ),
    (error) => error.status === 403,
  );
  await assert.rejects(
    manageDeliveryRuns(
      context(),
      { DB: db, PUBLIC_ORIGIN: origin, RESOURCE_ENVIRONMENT: "preview" },
    ),
    (error) => error.status === 403,
  );
  await assert.rejects(
    manageDeliveryRuns(context({ search: "?all=1" }), runtime(db)),
    (error) => error.status === 400,
  );
});

test("a real candidate receipt is recorded once and listed as evidence", async (t) => {
  const { db, sqlite } = database();
  const receipt = await candidateReceipt(t);
  assert.equal(receipt.state, "passed");
  const recorded = await manageDeliveryRuns(
    context({ method: "POST", body: { action: "record", receipt } }),
    runtime(db),
  );
  const body = await recorded.json();
  assert.equal(body.ok, true);
  assert.equal(body.created, true);
  assert.equal(body.runs.length, 1);
  const [run] = body.runs;
  assert.equal(run.runner, "local");
  assert.equal(run.mode, "candidate");
  assert.equal(run.state, "passed");
  assert.equal(run.commit, source.commit);
  assert.equal(run.releasePerformed, false);
  assert.equal(run.verificationPerformed, false);
  assert.match(run.artefactDigest, /^sha256:[a-f0-9]{64}$/);
  assert.ok(run.artefactFiles >= 1);
  assert.equal(run.receipt.schema, "app-composer.delivery-receipt/1");

  const again = await manageDeliveryRuns(
    context({ method: "POST", body: { action: "record", receipt } }),
    runtime(db),
  );
  const repeated = await again.json();
  assert.equal(repeated.created, false);
  assert.equal(repeated.runs.length, 1);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM composer_delivery_runs").get()
      .count,
    1,
  );

  const listed = await manageDeliveryRuns(context(), runtime(db));
  const list = await listed.json();
  assert.equal(list.runs.length, 1);
  assert.equal(list.retention.stored, 1);
  assert.deepEqual(list.retention.maximum, 20);
  const serialised = JSON.stringify(list);
  assert.doesNotMatch(serialised, /OWNER_API_TOKEN|EMDASH_ENCRYPTION_KEY|SHOWCASE_OWNER_TOKEN/);
});

test("an incomplete or extended receipt is refused without a row", async (t) => {
  const { db, sqlite } = database();
  const receipt = await candidateReceipt(t);
  for (const invalid of [
    { ...receipt, extra: "field" },
    { ...receipt, schema: "app-composer.delivery-receipt/2" },
    { ...receipt, mode: "deploy" },
    { ...receipt, runner: { ...receipt.runner, kind: "teamcity" } },
    { ...receipt, steps: [{ id: "local-checks" }] },
    { ...receipt, candidate: null },
  ]) {
    await assert.rejects(
      manageDeliveryRuns(
        context({ method: "POST", body: { action: "record", receipt: invalid } }),
        runtime(db),
      ),
      (error) => error.status === 400,
    );
  }
  await assert.rejects(
    manageDeliveryRuns(
      context({ method: "POST", body: { action: "delete", receipt } }),
      runtime(db),
    ),
    (error) => error.status === 400,
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM composer_delivery_runs").get()
      .count,
    0,
  );
});

test("bounded retention keeps only the newest receipts", async (t) => {
  const { db, sqlite } = database();
  const receipt = await candidateReceipt(t);
  for (let index = 0; index < 22; index += 1) {
    const variant = {
      ...receipt,
      generatedAt: new Date(Date.UTC(2026, 10, 8, 0, index)).toISOString(),
    };
    await manageDeliveryRuns(
      context({ method: "POST", body: { action: "record", receipt: variant } }),
      runtime(db),
    );
  }
  const count = sqlite
    .prepare("SELECT COUNT(*) AS count FROM composer_delivery_runs")
    .get().count;
  assert.equal(count, 20);
  const listed = await manageDeliveryRuns(context(), runtime(db));
  const list = await listed.json();
  assert.equal(list.runs.length, 20);
  assert.ok(list.runs[0].generatedAt > list.runs.at(-1).generatedAt);
});

test("the EmDash policy dispatcher admits only an administrator to the delivery routes", async (t) => {
  const { db } = database();
  const hostRuntime = runtime(db);
  const receipt = await candidateReceipt(t);
  const definition = creatorPlugin("fictional-admin-entry", hostRuntime);
  const host = {
    getPluginRouteMeta(plugin, path) {
      if (plugin === "composer-stacks") return definition.routes[path.slice(1)] ?? null;
      return null;
    },
    async handlePluginApiRoute(plugin, method, path, request, user) {
      const input =
        method === "GET"
          ? Object.fromEntries(new URL(request.url).searchParams)
          : await request.json();
      const data = await definition.routes[path.slice(1)].handler({ request, input, user });
      // These handlers answer with a Response; keep its status and body explicit
      // so the assertion sees exactly what the route produced.
      return data instanceof Response
        ? { success: true, data: { status: data.status, body: await data.json() } }
        : { success: true, data };
    },
  };
  const dispatch = (user, path, input = null) => {
    const reading = path.endsWith("Read");
    const request = new Request(
      origin + "/_emdash/api/plugins/composer-stacks" + path,
      {
        method: reading ? "GET" : "POST",
        headers: { Origin: origin, "X-EmDash-Request": "1" },
        ...(reading ? {} : { body: JSON.stringify(input) }),
      },
    );
    return dispatchPluginApiRequest({ runtime: host, pluginId: "composer-stacks", path, request, user });
  };
  assert.equal((await dispatch(undefined, "/deliveryRead")).status, 401);
  for (const role of [10, 20, 30, 40]) {
    assert.equal((await dispatch({ ...admin, role }, "/deliveryRead")).status, 403);
    assert.equal(
      (await dispatch({ ...admin, role }, "/deliveryWrite", { action: "record", receipt })).status,
      403,
    );
  }
  const read = await dispatch({ ...admin, role: 50 }, "/deliveryRead");
  assert.equal(read.status, 200);
  const readBody = await read.json();
  assert.equal(readBody.data.status, 200);
  assert.deepEqual(readBody.data.body.runs, []);
  const write = await dispatch({ ...admin, role: 50 }, "/deliveryWrite", { action: "record", receipt });
  assert.equal(write.status, 200);
  const written = await write.json();
  assert.equal(written.data.body.ok, true);
  assert.equal(written.data.body.created, true);
  assert.equal(written.data.body.runs.length, 1);
});

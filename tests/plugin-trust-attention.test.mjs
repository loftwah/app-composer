import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { overviewSnapshot } from "../src/lib/overview-contract.ts";
import { reviewAnchor } from "../src/lib/plugin-trust-contract.ts";
import { readPluginTrustAttention } from "../src/lib/plugin-trust-attention.ts";

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

function review(sqlite, { key, slug, severity, code, version, detail, first, last, state = "open" }) {
  sqlite
    .prepare(
      "INSERT INTO composer_plugin_trust_reviews (review_key,did,slug,version,severity,code,detail,state,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .run(key, "did:plc:fictional", slug, version, severity, code, detail, state, first, last);
}

function watch(sqlite, { enabled, state, error, lastRunAt }) {
  sqlite
    .prepare(
      "INSERT INTO composer_plugin_trust_watch (id,enabled,last_run_at,last_state,last_error,updated_at) VALUES ('default',?,?,?,?,?)",
    )
    .run(enabled, lastRunAt, state, error, lastRunAt);
}

test("a non-administrator never sees Plugin Trust review items", async () => {
  const { db, sqlite } = database();
  review(sqlite, {
    key: "plugin-trust:did:plc:fictional:freeform:artifact-inspected:1.3.0",
    slug: "freeform",
    severity: "review",
    code: "artifact-inspected",
    version: "1.3.0",
    detail: "The release artifact was inspected.",
    first: "2026-11-07T00:00:00Z",
    last: "2026-11-08T00:00:00Z",
  });
  const attention = await readPluginTrustAttention(db, { administrator: false });
  assert.equal(attention.status, "restricted");
  assert.deepEqual(attention.items, []);
  assert.match(attention.note, /administrator-only/);
  assert.match(attention.note, /restricted is not zero/);
});

test("an absent database is unavailable, never a clean zero", async () => {
  const attention = await readPluginTrustAttention(undefined, { administrator: true });
  assert.equal(attention.status, "unavailable");
  assert.deepEqual(attention.items, []);
  assert.match(attention.note, /Unavailable is not zero/);
});

test("a wait-only state states that the watch is off and raises no item", async () => {
  const { db } = database();
  const attention = await readPluginTrustAttention(db, { administrator: true });
  assert.equal(attention.status, "checked");
  assert.equal(attention.items.length, 0);
  assert.match(attention.note, /Daily watch is off/);
  assert.match(attention.note, /administrator-only/);
  assert.match(attention.note, /ADVISORY_SOURCE_NONE/);
});

test("open review items and a failed watch become administrator-only attention items", async () => {
  const { db, sqlite } = database();
  watch(sqlite, {
    enabled: 1,
    state: "failed",
    error: "registry-unavailable",
    lastRunAt: "2026-11-08T00:02:00Z",
  });
  review(sqlite, {
    key: "plugin-trust:did:plc:fictional:freeform:artifact-inspected:1.3.0",
    slug: "freeform",
    severity: "review",
    code: "artifact-inspected",
    version: "1.3.0",
    detail: "The release artifact changed and needs an owner look.",
    first: "2026-11-06T00:00:00Z",
    last: "2026-11-08T00:00:00Z",
  });
  review(sqlite, {
    key: "plugin-trust:did:plc:fictional:stripe:profile-withdrawn:0.10.6",
    slug: "stripe",
    severity: "block",
    code: "profile-withdrawn",
    version: "0.10.6",
    detail: "The package listing was withdrawn.",
    first: "2026-11-07T00:00:00Z",
    last: "2026-11-08T00:01:00Z",
  });
  review(sqlite, {
    key: "plugin-trust:did:plc:fictional:old:release:0.9.0",
    slug: "old",
    severity: "review",
    code: "release",
    version: "0.9.0",
    detail: "Already handled.",
    first: "2026-11-01T00:00:00Z",
    last: "2026-11-02T00:00:00Z",
    state: "resolved",
  });
  const attention = await readPluginTrustAttention(db, { administrator: true });
  assert.equal(attention.status, "checked");
  assert.equal(attention.items.length, 3);
  const [blocked, reviewed, failure] = attention.items;
  assert.equal(blocked.id, "plugin-trust:plugin-trust:did:plc:fictional:stripe:profile-withdrawn:0.10.6");
  assert.match(blocked.title, /stripe 0\.10\.6 is blocked/);
  assert.equal(blocked.href, `/_emdash/admin/plugins/composer-stacks/plugin-trust#plugin-trust-review-${reviewAnchor("plugin-trust:did:plc:fictional:stripe:profile-withdrawn:0.10.6")}`);
  assert.equal(reviewed.lastObserved, "2026-11-08T00:00:00.000Z");
  assert.equal(reviewed.firstObserved, "2026-11-06T00:00:00.000Z");
  assert.equal(failure.id, "plugin-trust:watch");
  assert.equal(failure.href, "/_emdash/admin/plugins/composer-stacks/plugin-trust#plugin-trust-watch");
  assert.match(failure.summary, /registry-unavailable/);
  assert.match(attention.note, /Daily watch is on/);
  assert.equal(attention.atLimit, false);
});

test("a partial watch state is also surfaced, but a healthy one is not", async () => {
  const healthy = database();
  watch(healthy.sqlite, {
    enabled: 1,
    state: "ok",
    error: "",
    lastRunAt: "2026-11-08T00:00:30Z",
  });
  const ok = await readPluginTrustAttention(healthy.db, { administrator: true });
  assert.equal(ok.items.length, 0);

  const partial = database();
  watch(partial.sqlite, {
    enabled: 1,
    state: "partial",
    error: "partial-observation",
    lastRunAt: "2026-11-08T00:00:30Z",
  });
  const found = await readPluginTrustAttention(partial.db, { administrator: true });
  assert.equal(found.items.length, 1);
  assert.equal(found.items[0].id, "plugin-trust:watch");
  assert.match(found.items[0].summary, /partial-observation/);
});

test("review anchors are stable, lower-case and URL-safe", () => {
  assert.equal(
    reviewAnchor("plugin-trust:did:plc:abc:freeform:artifact-inspected:1.3.0"),
    "plugin-trust-did-plc-abc-freeform-artifact-inspected-1-3-0",
  );
  assert.equal(reviewAnchor(""), "unknown");
  assert.equal(reviewAnchor("A".repeat(200)).length, 96);
});

test("the shared overview contract accepts Plugin Trust items and refuses foreign links", () => {
  const base = {
    ok: true,
    version: "composer.overview/1",
    workspace: { id: "fictional-workspace", name: "Fictional", role: "owner" },
    target: { account: "1003dc1d93af0ebea56b2f1252f89627", environment: "production" },
    selection: { app: null },
    available: {
      workspaces: [{ id: "fictional-workspace", name: "Fictional", role: "owner" }],
      environments: ["production"],
      apps: [],
    },
    checkedAt: "2026-11-08T00:00:00.000Z",
    sources: [
      { id: "platform", label: "Internal platform", status: "checked", count: 0, atLimit: false, note: "ok" },
      { id: "workflows", label: "Workflows", status: "checked", count: 0, atLimit: false, note: "ok" },
      { id: "resources", label: "App resources", status: "checked", count: 0, atLimit: false, note: "ok" },
      { id: "notifications", label: "Owner notifications", status: "checked", count: 0, atLimit: false, note: "ok" },
      { id: "delivery", label: "Release receipts", status: "checked", count: 0, atLimit: false, note: "ok" },
      {
        id: "plugin-trust",
        label: "Plugin Trust",
        status: "checked",
        count: 1,
        atLimit: false,
        note: "1 open review item and the owner enablement state.",
      },
    ],
    items: [
      {
        id: "plugin-trust:plugin-trust:did:plc:fictional:freeform:artifact-inspected:1.3.0",
        source: "plugin-trust",
        app: null,
        title: "freeform 1.3.0 needs review",
        summary: "Review: the artifact changed.",
        action: "Open Trust Centre",
        href: "/_emdash/admin/plugins/composer-stacks/plugin-trust#plugin-trust-review-plugin-trust-did-plc-fictional-freeform-artifact-inspected-1-3-0",
        count: 1,
        firstObserved: "2026-11-06T00:00:00.000Z",
        lastObserved: "2026-11-08T00:00:00.000Z",
      },
      {
        id: "plugin-trust:watch",
        source: "plugin-trust",
        app: null,
        title: "The daily Plugin Trust watch needs attention",
        summary: "The last run finished failed (registry-unavailable).",
        action: "Open Trust Centre",
        href: "/_emdash/admin/plugins/composer-stacks/plugin-trust#plugin-trust-watch",
        count: 1,
        firstObserved: "2026-11-08T00:02:00.000Z",
        lastObserved: "2026-11-08T00:02:00.000Z",
      },
    ],
  };
  assert.equal(overviewSnapshot.parse(base).items.length, 2);
  for (const href of [
    "https://example.invalid/plugin-trust#plugin-trust-watch",
    "/_emdash/admin/plugins/composer-stacks/plugin-trust?workspace=fictional-workspace#plugin-trust-review-x",
    "/_emdash/admin/plugins/composer-stacks/plugin-trust#other",
    "/_emdash/admin/plugins/composer-stacks/plugin-trust#plugin-trust-review-",
  ])
    assert.throws(() =>
      overviewSnapshot.parse({
        ...base,
        items: [{ ...base.items[0], href }],
      }),
    );
  assert.throws(() =>
    overviewSnapshot.parse({ ...base, sources: base.sources.slice(0, 4) }),
  );
  const deliveryItem = {
    ...base.items[0],
    id: "delivery:abc",
    source: "delivery",
    title: "A production release needs attention",
    action: "Open Delivery runs",
    href: "/_emdash/admin/plugins/composer-stacks/delivery?workspace=fictional-workspace#delivery-run-abc123",
  };
  assert.equal(
    overviewSnapshot.parse({ ...base, items: [deliveryItem] }).items[0].source,
    "delivery",
  );
  assert.throws(() =>
    overviewSnapshot.parse({
      ...base,
      items: [
        {
          ...deliveryItem,
          href: "https://example.invalid/delivery#delivery-run-abc123",
        },
      ],
    }),
  );
});

test("the public Plugin Trust page never renders review items or watch state", () => {
  const page = readFileSync(new URL("../src/pages/plugin-trust.astro", import.meta.url), "utf8");
  for (const forbidden of [
    "composer_plugin_trust_reviews",
    "openReviews",
    "readPluginTrustAttention",
    "plugin-trust-review-",
    "Mark reviewed",
  ])
    assert.ok(!page.includes(forbidden), `public page must not reference ${forbidden}`);
  assert.match(page, /\/_emdash\/admin\/plugins\/composer-stacks\/plugin-trust/);
});

test("the shared attention view ranks Plugin Trust items and keeps restricted sources visible", async () => {
  const { attentionView, rankAttention } = await import("../src/lib/overview-attention.ts");
  const item = (id, source, lastObserved, app = null) => ({
    id,
    source,
    app,
    title: "A recorded problem",
    summary: "Inspect the owning screen.",
    action: "Open",
    href:
      source === "plugin-trust"
        ? "/_emdash/admin/plugins/composer-stacks/plugin-trust#plugin-trust-watch"
        : "/_emdash/admin/plugins/composer-stacks/workflows?workspace=fictional-workspace#workflow-run-abc123",
    count: 1,
    firstObserved: lastObserved,
    lastObserved,
  });
  const snapshot = {
    selection: { app: null },
    sources: [
      { id: "plugin-trust", label: "Plugin Trust", status: "restricted", count: null, atLimit: false, note: "administrator-only" },
      { id: "workflows", label: "Workflows", status: "checked", count: 1, atLimit: false, note: "ok" },
    ],
    items: [
      item("workflows:run", "workflows", "2026-11-08T00:00:00.000Z"),
      item("plugin-trust:watch", "plugin-trust", "2026-11-08T01:00:00.000Z"),
    ],
  };
  assert.deepEqual(
    rankAttention(snapshot.items, null).map((entry) => entry.id),
    ["plugin-trust:watch", "workflows:run"],
  );
  const view = attentionView(snapshot);
  assert.equal(view.total, 2);
  assert.equal(view.restricted.length, 1);
  assert.equal(view.restricted[0].id, "plugin-trust");
});

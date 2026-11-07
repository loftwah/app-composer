import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { pluginTrustSnapshot } from "../src/lib/plugin-trust-contract.ts";
import { refreshPluginTrust } from "../src/lib/plugin-trust-refresh.ts";
import {
  openReviews,
  readWatch,
  resolveReview,
  runPluginTrustWatch,
  setWatchEnabled,
  watchView,
} from "../src/lib/plugin-trust-watch-run.ts";

const committed = pluginTrustSnapshot.parse(
  JSON.parse(
    readFileSync(
      new URL("../src/data/plugin-trust-20261107.json", import.meta.url),
      "utf8",
    ),
  ),
);

export function discoveryFor(snapshot, { version = null, failSlug = null } = {}) {
  const packages = new Map(snapshot.packages.map((p) => [p.slug, p]));
  return {
    async getPackage({ did, slug }) {
      const p = packages.get(slug);
      if (failSlug === slug) throw Error("fictional registry failure");
      return {
        did: p.did,
        slug: p.slug,
        handle: p.handle,
        cid: p.profileCid,
        uri: p.profileUri,
        profile: {
          name: p.name,
          license: p.license,
          security: p.securityContact ? [{ url: "https://fictional.invalid" }] : [],
          extensions: {
            "com.emdashcms.experimental.package.profileExtension": {
              repository: p.repository,
              releasePolicy: { requireProvenance: p.requireProvenance },
            },
          },
        },
        releaseHistoryComplete: p.historyComplete,
      };
    },
    async getLatestRelease({ did, package: slug }) {
      const p = packages.get(slug);
      if (failSlug === slug) throw Error("fictional registry failure");
      const bumped = version && version[slug];
      return {
        did: p.did,
        package: p.slug,
        cid: bumped ? "bafyrei" + "b".repeat(50) : p.releaseCid,
        uri: p.releaseUri,
        version: bumped ? bumped : p.version,
        indexedAt: p.indexedAt,
        release: {
          artifacts: {
            package: { checksum: bumped ? "b" + "a".repeat(50) : p.checksum },
          },
          requires: { "env:emdash": p.requires },
          repo: p.repository,
        },
        labels: p.labels,
      };
    },
  };
}

test("an unchanged observation keeps the inspected artifact evidence", async () => {
  const next = await refreshPluginTrust(
    committed,
    discoveryFor(committed),
    new Date("2026-11-08T00:00:00Z"),
  );
  assert.equal(next.packages.every((p) => p.refreshFailed === false), true);
  assert.deepEqual(
    next.packages.map((p) => p.inspection?.sha256),
    committed.packages.map((p) => p.inspection?.sha256),
  );
  assert.equal(next.observedAt, "2026-11-08T00:00:00.000Z");
});

test("a new release drops stale artifact evidence and keeps identity", async () => {
  const next = await refreshPluginTrust(
    committed,
    discoveryFor(committed, {
      version: { "emdash-stripe-checkout": "9.9.9" },
    }),
    new Date("2026-11-08T00:00:00Z"),
  );
  const changed = next.packages.find(
    (p) => p.slug === "emdash-stripe-checkout",
  );
  assert.equal(changed.version, "9.9.9");
  assert.equal(changed.inspection, null);
  assert.equal(changed.refreshFailed, false);
});

test("one failed package is retained as failed without manufacture", async () => {
  const next = await refreshPluginTrust(
    committed,
    discoveryFor(committed, { failSlug: "freeform" }),
    new Date("2026-11-08T00:00:00Z"),
  );
  const failed = next.packages.find((p) => p.slug === "freeform");
  assert.equal(failed.refreshFailed, true);
  assert.equal(failed.version, "1.3.0");
  assert.equal(
    next.packages.find((p) => p.slug === "emdash-stripe-checkout").refreshFailed,
    false,
  );
});

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

test("the watch stays off until the owner enables it", async () => {
  const { db } = database();
  assert.equal(
    (await runPluginTrustWatch(db, { discovery: discoveryFor(committed), committed }))
      .state,
    "disabled",
  );
  const watch = await setWatchEnabled(db, true, new Date("2026-11-08T00:00:00Z"));
  assert.equal(watch.enabled, true);
  assert.equal(watch.state, "never");
});

test("a successful run stores the snapshot and a changed run raises deduplicated reviews", async () => {
  const { db } = database();
  const now = new Date("2026-11-08T00:00:00Z");
  await setWatchEnabled(db, true, now);
  const first = await runPluginTrustWatch(db, {
    discovery: discoveryFor(committed),
    committed,
    now,
  });
  assert.deepEqual(first, { state: "ok", reviews: 0 });
  let watch = await readWatch(db);
  assert.equal(watch.state, "ok");
  assert.equal(watch.snapshot.observedAt, "2026-11-08T00:00:00.000Z");
  assert.equal((await openReviews(db)).length, 0);

  const next = new Date("2026-11-09T00:00:00Z");
  const changed = await runPluginTrustWatch(db, {
    discovery: discoveryFor(committed, {
      version: { "emdash-stripe-checkout": "9.9.9" },
    }),
    committed,
    now: next,
  });
  assert.equal(changed.state, "ok");
  assert.equal(changed.reviews > 0, true);
  const reviews = await openReviews(db);
  assert.equal(reviews.length, changed.reviews);
  assert.equal(reviews.every((item) => item.slug === "emdash-stripe-checkout"), true);
  assert.equal(reviews.some((item) => item.code === "RELEASE_CHANGED"), true);
  assert.equal(reviews.some((item) => item.code === "ARTIFACT_CHANGED"), true);

  const repeated = await runPluginTrustWatch(db, {
    discovery: discoveryFor(committed, {
      version: { "emdash-stripe-checkout": "9.9.9" },
    }),
    committed,
    now: new Date("2026-11-10T00:00:00Z"),
    force: true,
  });
  assert.deepEqual(repeated, { state: "ok", reviews: 0 });
  assert.equal((await openReviews(db)).length, reviews.length);

  const firstKey = reviews[0].key;
  assert.equal(await resolveReview(db, firstKey, new Date("2026-11-10T00:00:00Z")), true);
  assert.equal(await resolveReview(db, firstKey, new Date("2026-11-10T00:00:00Z")), false);
  assert.equal((await openReviews(db)).length, reviews.length - 1);
  watch = await readWatch(db);
  assert.equal(watch.state, "ok");
});

test("a registry failure is shown as failed and keeps the last good snapshot", async () => {
  const { db } = database();
  await setWatchEnabled(db, true, new Date("2026-11-08T00:00:00Z"));
  await runPluginTrustWatch(db, {
    discovery: discoveryFor(committed),
    committed,
    now: new Date("2026-11-08T00:00:00Z"),
  });
  const good = await readWatch(db);
  const failed = await runPluginTrustWatch(db, {
    discovery: discoveryFor(committed, { failSlug: "freeform" }),
    committed,
    now: new Date("2026-11-09T00:00:00Z"),
  });
  assert.deepEqual(failed, { state: "failed", error: "partial-observation" });
  const after = await readWatch(db);
  assert.equal(after.state, "failed");
  assert.equal(after.error, "partial-observation");
  assert.equal(after.snapshot.observedAt, good.snapshot.observedAt);
});

test("the daily guard skips a second run and force overrides it", async () => {
  const { db } = database();
  await setWatchEnabled(db, true, new Date("2026-11-08T00:00:00Z"));
  await runPluginTrustWatch(db, {
    discovery: discoveryFor(committed),
    committed,
    now: new Date("2026-11-08T00:00:00Z"),
  });
  assert.deepEqual(
    await runPluginTrustWatch(db, {
      discovery: discoveryFor(committed),
      committed,
      now: new Date("2026-11-08T04:00:00Z"),
    }),
    { state: "skipped" },
  );
  assert.equal(
    (
      await runPluginTrustWatch(db, {
        discovery: discoveryFor(committed),
        committed,
        now: new Date("2026-11-08T04:00:00Z"),
        force: true,
      })
    ).state,
    "ok",
  );
});

test("the view exposes availability, state and open reviews", async () => {
  const { db } = database();
  const off = await watchView(db);
  assert.equal(off.available, true);
  assert.equal(off.enabled, false);
  assert.equal(off.state, "never");
  assert.deepEqual(off.reviews, []);
  const unavailable = await watchView(undefined);
  assert.equal(unavailable.available, false);
});

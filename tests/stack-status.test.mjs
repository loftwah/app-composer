import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStackStatus,
  remoteState,
} from "../scripts/lib/stack-status.mjs";

const build = {
  commit: "a".repeat(40),
  sourceCommittedAt: "2026-11-06T12:00:00.000Z",
};
const now = new Date("2026-11-06T12:00:00.000Z");

function policy(packages, runtime = {}) {
  return {
    contract: 1,
    reviewed: "2026-11-06",
    runtime: {
      node: ">=22.23.4 <23 || >=24.22.1 <25 || >=26.13.0 <27",
      pnpm: "12.8.1",
      ...runtime,
    },
    packages,
  };
}

function manifest(dependencies) {
  return {
    packageManager: "pnpm@12.8.1",
    dependencies,
    devDependencies: {},
  };
}

function importer(entries) {
  return new Map(
    Object.entries(entries).map(([name, version]) => [
      name,
      { specifier: version, version },
    ]),
  );
}

function registryReport(packages) {
  return {
    kind: "app-composer.dependency-freshness",
    contract: 1,
    mode: "remote",
    reviewed: "2026-11-06",
    checkedAt: "2026-11-06T10:00:00.000Z",
    registry: "https://registry.npmjs.org",
    packages,
  };
}

test("installed, deployed and latest tested stay distinct without patch/minor warnings", () => {
  const snapshot = buildStackStatus({
    policy: policy({
      alpha: { supported: "^1.2.0", reviewed: "1.2.0" },
      beta: { supported: "^2.0.0", reviewed: "2.0.0" },
    }),
    manifest: manifest({ alpha: "^1.2.0", beta: "^2.0.0" }),
    importer: importer({ alpha: "1.2.0", beta: "2.0.0" }),
    installed: new Map([
      ["alpha", "1.2.1"],
      ["beta", "2.0.0"],
    ]),
    remoteReport: registryReport([
      {
        name: "alpha",
        remote: {
          state: "available",
          latest: "1.2.2",
          classification: "compatible-patch",
          reason: "Registry latest 1.2.2 is a patch release inside the reviewed range ^1.2.0.",
          latestQualified: true,
          advisory: null,
        },
      },
      {
        name: "beta",
        remote: {
          state: "available",
          latest: "2.1.0",
          classification: "feature-opportunity",
          reason: "Registry latest 2.1.0 adds a minor release inside the reviewed range ^2.0.0.",
          latestQualified: true,
          advisory: null,
        },
      },
    ]),
    build,
    now,
  });
  assert.equal(snapshot.remote.state, "available");
  assert.equal(snapshot.packages[0].installed, "1.2.1");
  assert.equal(snapshot.packages[0].deployed, "1.2.0");
  assert.equal(snapshot.packages[0].latestTested, "1.2.0");
  assert.equal(snapshot.packages[0].remote.latest, "1.2.2");
  assert.equal(snapshot.packages[1].remote.classification, "feature-opportunity");
  assert.equal(snapshot.blockers.length, 0);
  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.review.date, "2026-11-06");
  assert.equal(snapshot.deployed.commit, build.commit);
  assert.equal(snapshot.runtime.find((row) => row.name === "pnpm").status, "ok");
});

test("security, breaking-major and unsupported versions produce exact blockers", () => {
  const snapshot = buildStackStatus({
    policy: policy({
      alpha: { supported: "^1.2.0", reviewed: "1.2.0" },
      beta: { supported: "^2.0.0", reviewed: "2.0.0" },
      gamma: { supported: "^3.0.0", reviewed: "3.0.0" },
    }),
    manifest: manifest({
      alpha: "^1.2.0",
      beta: "^2.0.0",
      gamma: "^3.0.0",
    }),
    importer: importer({
      alpha: "1.2.0",
      beta: "1.0.0",
      gamma: "3.0.0",
    }),
    installed: new Map(),
    remoteReport: registryReport([
      {
        name: "alpha",
        remote: {
          state: "available",
          latest: "1.2.0",
          classification: "security-urgent",
          reason: "Registry advisory 42 affects 1.2.0: Test advisory",
          latestQualified: true,
          advisory: {
            id: 42,
            severity: "high",
            title: "Test advisory",
            url: "https://example.test/advisory",
            vulnerableVersions: "<=1.2.0",
          },
        },
      },
      {
        name: "beta",
        remote: {
          state: "available",
          latest: "2.0.0",
          classification: "unsupported",
          reason: "Locked 1.0.0 is outside the reviewed range ^2.0.0.",
          latestQualified: true,
          advisory: null,
        },
      },
      {
        name: "gamma",
        remote: {
          state: "available",
          latest: "4.0.0",
          classification: "breaking-major",
          reason: "Registry latest 4.0.0 is a new major; the reviewed range is ^3.0.0.",
          latestQualified: false,
          advisory: null,
        },
      },
    ]),
    build,
    now,
  });
  assert.equal(snapshot.status, "security");
  assert.deepEqual(
    snapshot.blockers.map((blocker) => [blocker.kind, blocker.name]),
    [
      ["security", "alpha"],
      ["unsupported", "beta"],
      ["breaking", "gamma"],
    ],
  );
  assert.match(snapshot.blockers[0].detail, /Test advisory/);
  assert.equal(snapshot.blockers[0].url, "https://example.test/advisory");
  assert.match(snapshot.blockers[2].detail, /4\.0\.0/);
  assert.match(snapshot.blockers[1].detail, /1\.0\.0.*\^2\.0\.0/);
});

test("a missing registry report is unknown with the exact next command", () => {
  const snapshot = buildStackStatus({
    policy: policy({ alpha: { supported: "^1.2.0", reviewed: "1.2.0" } }),
    manifest: manifest({ alpha: "^1.2.0" }),
    importer: importer({ alpha: "1.2.0" }),
    installed: new Map([["alpha", "1.2.0"]]),
    remoteReport: null,
    build,
    now,
  });
  assert.equal(snapshot.remote.state, "unknown");
  assert.match(snapshot.remote.reason, /scripts\/freshness\.mjs --remote/);
  assert.equal(snapshot.packages[0].remote.latest, null);
  assert.equal(snapshot.packages[0].remote.classification, "unknown");
  assert.equal(snapshot.status, "unknown");
  assert.equal(snapshot.blockers.at(-1).kind, "remote");
});

test("a stale registry report is unknown and never presents its old latest value", () => {
  const stale = remoteState(
    {
      checkedAt: "2026-10-01T10:00:00.000Z",
      registry: "https://registry.npmjs.org",
    },
    now,
  );
  assert.equal(stale.state, "stale");
  assert.equal(stale.ageDays, 36);
  assert.match(stale.reason, /36 days old/);
  const staleReport = registryReport([
    {
      name: "alpha",
      remote: {
        state: "available",
        latest: "1.9.0",
        classification: "feature-opportunity",
        reason: "old report",
        latestQualified: true,
        advisory: null,
      },
    },
  ]);
  staleReport.checkedAt = "2026-10-01T10:00:00.000Z";
  const snapshot = buildStackStatus({
    policy: policy({ alpha: { supported: "^1.2.0", reviewed: "1.2.0" } }),
    manifest: manifest({ alpha: "^1.2.0" }),
    importer: importer({ alpha: "1.2.0" }),
    installed: new Map([["alpha", "1.2.0"]]),
    remoteReport: staleReport,
    build,
    now,
  });
  assert.equal(snapshot.remote.state, "stale");
  assert.equal(snapshot.packages[0].remote.latest, null);
  assert.equal(snapshot.status, "unknown");
});

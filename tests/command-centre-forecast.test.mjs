import test from "node:test";
import assert from "node:assert/strict";
import {
  commandCentreForecast,
  deriveForecast,
  forecastMinimumCompleted,
  forecastMinimumWindowDays,
} from "../src/lib/command-centre-forecast.ts";
import {
  commandCentreReport,
  linkedReleaseFromBody,
} from "../src/lib/command-centre-contract.ts";
import { parseIssueRelationships } from "../src/lib/command-centre-relationships.ts";
import {
  loadCommandCentrePage,
  renderBoard,
} from "./command-centre-page-harness.mjs";

const day = 86_400_000;
const observedAt = "2026-11-16T00:00:00.000Z";
const observed = Date.parse(observedAt);
const ago = (days) => new Date(observed - days * day).toISOString();

function forecastIssue(number, options = {}) {
  const {
    createdAgo = 40,
    closedAgo = null,
    reason = "completed",
    reopened = false,
    release = null,
    labels = [],
    milestone = null,
  } = options;
  return {
    number,
    title: `Fixture issue ${number}`,
    url: `https://fixture.invalid/items/${number}`,
    createdAt: ago(createdAgo),
    closedAt: closedAgo === null ? null : ago(closedAgo),
    stateReason: reason,
    reopened,
    labels,
    milestone,
    linkedReleaseTag: release,
  };
}

function openInput(count, items) {
  return {
    count,
    sampled: items.length,
    complete: count <= items.length,
  };
}

const completedAges = [
  1, 3, 5, 6, 8, 10, 12, 15, 17, 19, 22, 24, 26, 27, 29, 31,
];

function realHistory() {
  const closed = completedAges.map((closedAgo, index) =>
    forecastIssue(100 + index, {
      closedAgo,
      reason: "completed",
      release: index === 0 ? "v1.2.0" : null,
    }),
  );
  closed.push(
    forecastIssue(200, { closedAgo: 2, reason: "not_planned" }),
    forecastIssue(201, { closedAgo: 9, reason: "not_planned" }),
    forecastIssue(202, { closedAgo: 4, reason: "duplicate" }),
    forecastIssue(203, { closedAgo: 11, reason: "duplicate" }),
  );
  return closed.sort((left, right) =>
    String(right.closedAt).localeCompare(String(left.closedAt)),
  );
}

function realInput() {
  const openItems = Array.from({ length: 6 }, (_, index) =>
    forecastIssue(index + 1, { createdAgo: 40 }),
  );
  const closedItems = realHistory();
  return {
    observedAt,
    open: openInput(openItems.length, openItems),
    openItems,
    closedItems,
    closedPageComplete: true,
    oldestUpdatedAt: closedItems[closedItems.length - 1]?.closedAt ?? null,
  };
}

test("real history yields a measured window, throughput, cycle time and band", () => {
  const forecast = deriveForecast(realInput());
  commandCentreForecast.parse(forecast);

  assert.equal(forecast.state, "ok");
  if (forecast.state !== "ok") return;
  assert.equal(forecast.observations.windowDays, 28);
  assert.equal(forecast.observations.sampledCompleted, 16);
  assert.equal(forecast.observations.notPlanned, 2);
  assert.equal(forecast.observations.duplicate, 2);
  assert.equal(forecast.observations.missingTimestamps, 0);
  assert.equal(forecast.observations.releaseLinked, 1);
  assert.equal(forecast.observations.windowCompleted, 14);
  assert.equal(forecast.observations.perWeek, 3.5);
  assert.equal(forecast.observations.backlog, 6);
  assert.equal(forecast.observations.reopens, 0);
  assert.equal(forecast.observations.medianCycleDays, 24);
  assert.equal(forecast.observations.cycleSample, 16);
  assert.equal(forecast.observations.scope.state, "stable");
  assert.equal(forecast.observations.windowCoverage, "complete");
  assert.equal(forecast.interval.earliestDays, 10);
  assert.equal(forecast.interval.latestDays, 14);
  assert.equal(forecast.interval.confidence, "medium");
  assert.equal(
    forecast.interval.earliestAt,
    new Date(observed + 10 * day).toISOString(),
  );
  assert.equal(
    forecast.interval.latestAt,
    new Date(observed + 14 * day).toISOString(),
  );
  assert.match(forecast.interval.method, /not a live deployment/i);
  assert.ok(
    forecast.notes.some((note) => /not planned/i.test(note)),
    "cancelled closures are stated explicitly",
  );
  assert.ok(
    forecast.notes.some((note) => /release/i.test(note)),
    "release association is stated explicitly",
  );
});

test("insufficient completed history is unknown with an explicit reason", () => {
  const openItems = [forecastIssue(1, { createdAgo: 40 })];
  const forecast = deriveForecast({
    observedAt,
    open: openInput(1, openItems),
    openItems,
    closedItems: [
      forecastIssue(10, { closedAgo: 2 }),
      forecastIssue(11, { closedAgo: 6 }),
      forecastIssue(12, { closedAgo: 12 }),
    ],
    closedPageComplete: true,
    oldestUpdatedAt: ago(12),
  });
  commandCentreForecast.parse(forecast);

  assert.equal(forecast.state, "unknown");
  if (forecast.state !== "unknown") return;
  assert.match(forecast.reason, new RegExp(`at least ${forecastMinimumCompleted}`));
  assert.equal(forecast.observations.sampledCompleted, 3);
  assert.equal(forecast.observations.backlog, 1);
  assert.equal(forecast.interval, undefined);
});

test("a short observation span is unknown even with enough closures", () => {
  const openItems = [forecastIssue(1, { createdAgo: 40 })];
  const forecast = deriveForecast({
    observedAt,
    open: openInput(1, openItems),
    openItems,
    closedItems: Array.from({ length: 8 }, (_, index) =>
      forecastIssue(10 + index, { closedAgo: index + 1 }),
    ),
    closedPageComplete: true,
    oldestUpdatedAt: ago(8),
  });
  commandCentreForecast.parse(forecast);
  assert.equal(forecast.state, "unknown");
  if (forecast.state !== "unknown") return;
  assert.match(
    forecast.reason,
    new RegExp(`at least ${forecastMinimumWindowDays} days`),
  );
  assert.equal(forecast.observations.sampledSpanDays, 8);
  assert.equal(forecast.observations.windowDays, null);
});

test("reopened issues are counted and never promoted to completed work", () => {
  const input = realInput();
  input.openItems = [
    ...input.openItems.slice(0, 4),
    forecastIssue(90, { createdAgo: 40, reopened: true, reason: "reopened" }),
    forecastIssue(91, { createdAgo: 40, reopened: true, reason: "reopened" }),
  ];
  input.open = openInput(6, input.openItems);
  const forecast = deriveForecast(input);
  commandCentreForecast.parse(forecast);

  assert.equal(forecast.state, "ok");
  assert.equal(forecast.observations.reopens, 2);
  assert.equal(forecast.observations.reopensComplete, true);
  assert.equal(
    forecast.observations.sampledCompleted,
    16,
    "open reopened issues do not enter the completed count",
  );

  // A bounded open sample cannot claim an exact reopen total.
  input.open = openInput(20, input.openItems);
  const bounded = deriveForecast(input);
  assert.equal(bounded.observations.reopens, 2);
  assert.equal(bounded.observations.reopensComplete, false);
  assert.equal(bounded.observations.openSampleComplete, false);
});

test("recent scope growth returns unknown instead of an optimistic date", () => {
  const openItems = Array.from({ length: 12 }, (_, index) =>
    forecastIssue(index + 1, { createdAgo: 1 }),
  );
  const closedItems = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18].map(
    (closedAgo, index) =>
      forecastIssue(100 + index, { closedAgo, createdAgo: 40 }),
  );
  const forecast = deriveForecast({
    observedAt,
    open: openInput(12, openItems),
    openItems,
    closedItems,
    closedPageComplete: true,
    oldestUpdatedAt: ago(18),
  });
  commandCentreForecast.parse(forecast);

  assert.equal(forecast.state, "unknown");
  if (forecast.state !== "unknown") return;
  assert.match(forecast.reason, /backlog is growing faster/i);
  assert.equal(forecast.observations.scope.state, "changing");
  assert.match(
    forecast.observations.scope.notes[0],
    /12 open issues were created in the last 7 days; 4 completed/,
  );
  assert.equal(forecast.interval, undefined);
});

test("a dominant bulk-closure day is unknown rather than throughput", () => {
  const closedItems = [
    ...Array.from({ length: 7 }, (_, index) =>
      forecastIssue(100 + index, { closedAgo: 3 }),
    ),
    forecastIssue(120, { closedAgo: 10 }),
    forecastIssue(121, { closedAgo: 17 }),
    forecastIssue(122, { closedAgo: 24 }),
  ];
  const openItems = [forecastIssue(1, { createdAgo: 40 })];
  const forecast = deriveForecast({
    observedAt,
    open: openInput(1, openItems),
    openItems,
    closedItems,
    closedPageComplete: true,
    oldestUpdatedAt: ago(24),
  });
  commandCentreForecast.parse(forecast);

  assert.equal(forecast.state, "unknown");
  if (forecast.state !== "unknown") return;
  assert.match(forecast.reason, /single bulk closure/i);
  assert.equal(forecast.observations.bulkClosure.count, 7);
  assert.equal(forecast.observations.windowCompleted, 9);
  assert.equal(forecast.interval, undefined);
});

test("a non-dominant bulk day is excluded and lowers confidence", () => {
  const closedItems = [
    ...Array.from({ length: 5 }, (_, index) =>
      forecastIssue(100 + index, { closedAgo: 3 }),
    ),
    ...[6, 8, 10, 12, 14].map((closedAgo, index) =>
      forecastIssue(120 + index, { closedAgo }),
    ),
  ];
  const openItems = [forecastIssue(1, { createdAgo: 40 })];
  const forecast = deriveForecast({
    observedAt,
    open: openInput(6, openItems),
    openItems,
    closedItems,
    closedPageComplete: true,
    oldestUpdatedAt: ago(14),
  });
  commandCentreForecast.parse(forecast);

  assert.equal(forecast.state, "ok");
  if (forecast.state !== "ok") return;
  assert.equal(forecast.observations.bulkClosure.count, 5);
  assert.equal(forecast.observations.bulkClosure.share, 0.5);
  assert.equal(forecast.observations.windowCompleted, 10);
  assert.equal(forecast.interval.confidence, "low");
  assert.ok(
    forecast.notes.some((note) => /bulk closure/i.test(note)),
    "the excluded day is stated",
  );
});

test("missing timestamps are excluded, and an empty timestamp set is unknown", () => {
  const openItems = [forecastIssue(1, { createdAgo: 40 })];
  const noTimestamps = deriveForecast({
    observedAt,
    open: openInput(1, openItems),
    openItems,
    closedItems: Array.from({ length: 6 }, (_, index) =>
      forecastIssue(10 + index, { closedAgo: null }),
    ),
    closedPageComplete: true,
    oldestUpdatedAt: ago(30),
  });
  commandCentreForecast.parse(noTimestamps);
  assert.equal(noTimestamps.state, "unknown");
  if (noTimestamps.state === "unknown")
    assert.match(noTimestamps.reason, /readable close timestamp/i);
  assert.equal(noTimestamps.observations.missingTimestamps, 6);

  const partlyMissing = deriveForecast({
    observedAt,
    open: openInput(1, openItems),
    openItems,
    closedItems: [
      ...completedAges.map((closedAgo, index) =>
        forecastIssue(100 + index, { closedAgo }),
      ),
      forecastIssue(300, { closedAgo: null }),
      forecastIssue(301, { closedAgo: null }),
    ],
    closedPageComplete: true,
    oldestUpdatedAt: ago(31),
  });
  commandCentreForecast.parse(partlyMissing);
  assert.equal(partlyMissing.state, "ok");
  assert.equal(partlyMissing.observations.missingTimestamps, 2);
  assert.ok(
    partlyMissing.notes.some((note) => /no readable close timestamp/i.test(note)),
  );
});

test("an empty confirmed backlog is ok with no fabricated window", () => {
  const forecast = deriveForecast({
    observedAt,
    open: openInput(0, []),
    openItems: [],
    closedItems: [],
    closedPageComplete: true,
    oldestUpdatedAt: null,
  });
  commandCentreForecast.parse(forecast);

  assert.equal(forecast.state, "ok");
  if (forecast.state !== "ok") return;
  assert.equal(forecast.interval, null);
  assert.equal(forecast.observations.backlog, 0);
  assert.equal(forecast.observations.sampledClosed, 0);
  assert.equal(forecast.observations.windowDays, null);
  assert.match(forecast.notes[0], /nothing to forecast/i);
});

test("a zero open count that disagrees with the sample is unknown", () => {
  const openItems = [forecastIssue(1, { createdAgo: 2 })];
  const forecast = deriveForecast({
    observedAt,
    open: openInput(0, openItems),
    openItems,
    closedItems: [],
    closedPageComplete: true,
    oldestUpdatedAt: null,
  });
  commandCentreForecast.parse(forecast);
  assert.equal(forecast.state, "unknown");
  if (forecast.state !== "unknown") return;
  assert.match(forecast.reason, /two reads disagree/i);
});

test("an unread source stays unknown and keeps confirmed observations honest", () => {
  const openItems = [forecastIssue(1, { createdAgo: 40 })];
  const noClosed = deriveForecast({
    observedAt,
    open: openInput(1, openItems),
    openItems,
    closedItems: null,
    closedPageComplete: null,
    oldestUpdatedAt: null,
  });
  commandCentreForecast.parse(noClosed);
  assert.equal(noClosed.state, "unknown");
  assert.match(noClosed.reason, /closed issues were not read/i);
  assert.equal(noClosed.observations.backlog, 1);
  assert.equal(noClosed.observations.sampledClosed, null);

  const noOpenSample = deriveForecast({
    ...realInput(),
    openItems: null,
    open: { count: 6, sampled: null, complete: null },
  });
  assert.equal(noOpenSample.state, "unknown");
  assert.match(noOpenSample.reason, /open-issue sample/i);

  const noBacklog = deriveForecast({
    ...realInput(),
    open: null,
  });
  assert.equal(noBacklog.state, "unknown");
  assert.match(noBacklog.reason, /open backlog was not confirmed/i);
});

test("merged work and release links are never promoted to verified live", () => {
  assert.equal(
    linkedReleaseFromBody(
      "Merged via https://github.com/fictional/tracker/pull/701",
    ),
    null,
  );
  assert.deepEqual(
    linkedReleaseFromBody(
      "Published in https://github.com/fictional/tracker/releases/tag/v2.0.0",
    ),
    {
      tag: "v2.0.0",
      url: "https://github.com/fictional/tracker/releases/tag/v2.0.0",
    },
  );

  const forecast = deriveForecast(realInput());
  assert.equal("merged" in forecast, false);
  assert.equal("verifiedLive" in forecast, false);
  assert.equal("verifiedLive" in forecast.observations, false);
  assert.equal(
    commandCentreForecast.safeParse({
      ...forecast,
      interval: { ...forecast.interval, verifiedLive: true },
    }).success,
    false,
    "the strict forecast schema rejects a verified-live claim",
  );
});

// ---------------------------------------------------------------------------
// A second, non-GitHub source adapter lives only in this test. It produces the
// same contract, feeds the same derivation and renders through the same board.
// No fake production source is shipped.
// ---------------------------------------------------------------------------

function adaptFixture(records) {
  const open = records.filter((record) => record.closedAt === null);
  const closed = records.filter((record) => record.closedAt !== null);
  const asForecastIssue = (record) => ({
    number: record.number,
    title: record.title,
    url: record.url,
    createdAt: record.createdAt,
    closedAt: record.closedAt,
    stateReason: record.closedAt === null ? null : record.reason,
    reopened: record.reopened ?? false,
    labels: record.labels ?? [],
    milestone: record.milestone ?? null,
    linkedReleaseTag: record.release ?? null,
  });
  const forecast = deriveForecast({
    observedAt,
    open: openInput(open.length, open.map(asForecastIssue)),
    openItems: open.map(asForecastIssue),
    closedItems: closed.map(asForecastIssue),
    closedPageComplete: true,
    oldestUpdatedAt: closed[closed.length - 1]?.closedAt ?? null,
  });
  const planItems = open.map((record) => ({
    number: record.number,
    title: record.title,
    url: record.url,
    updatedAt: record.createdAt,
    labels: record.labels ?? [],
    reopened: record.reopened ?? false,
    milestone: record.milestone
      ? {
          title: record.milestone,
          dueOn: null,
          url: "https://tracker.invalid/milestones/fixture",
        }
      : null,
    blockedByLabel: false,
    parent: record.parent ?? null,
    children: [],
    blockers: [],
    pullRequests: [],
    linkState: record.parent ? "found" : "none",
  }));
  const releaseItems = [
    {
      tag: "fixture-1",
      name: "Fixture release",
      publishedAt: ago(1),
      url: "https://tracker.invalid/releases/fixture-1",
      prerelease: false,
      issues: [
        { number: 2, url: "https://tracker.invalid/items/OPS-2" },
      ],
    },
  ];
  return {
    ok: true,
    schema: "app-composer.command-centre/2",
    source: { id: "fixture", label: "Fictional tracker" },
    selected: "fictional/tracker",
    fetchedAt: observedAt,
    cached: false,
    cacheSeconds: 55,
    cacheAgeSeconds: 0,
    repositories: [
      { repository: "fictional/tracker", label: "Fictional tracker" },
    ],
    rateLimit: { limit: null, remaining: null, resetAt: null },
    repo: {
      repository: "fictional/tracker",
      url: "https://tracker.invalid/projects/fictional",
      links: {
        issues: "https://tracker.invalid/projects/fictional/items",
        pullRequests: "https://tracker.invalid/projects/fictional/reviews",
        newIssue: "https://tracker.invalid/projects/fictional/new",
      },
      checkedAt: observedAt,
      archived: false,
      defaultBranch: "main",
      issues: {
        count: { state: "ok", value: open.length },
        recent: {
          state: "ok",
          items: open.map((record) => ({
            number: record.number,
            title: record.title,
            url: record.url,
            updatedAt: record.createdAt,
            labels: record.labels ?? [],
            reopened: record.reopened ?? false,
          })),
          complete: true,
          scanned: open.length,
        },
      },
      pullRequests: { state: "ok", value: 0 },
      blocked: { state: "ok", labels: [], count: null },
      release: {
        state: "ok",
        latest: {
          tag: releaseItems[0].tag,
          publishedAt: releaseItems[0].publishedAt,
          url: releaseItems[0].url,
          prerelease: false,
        },
      },
      releases: { state: "ok", items: releaseItems },
      commit: {
        state: "ok",
        latest: {
          sha: "b".repeat(40),
          committedAt: ago(0),
          url: "https://tracker.invalid/commits/fixture",
        },
      },
      plan: {
        state: "ok",
        scanned: planItems.length,
        complete: true,
        items: planItems,
        milestones: [
          {
            title: "Fixture milestone",
            dueOn: null,
            openIssues: 1,
            blockedIssues: 0,
          },
        ],
        relationshipBasis:
          "Explicit references in the fixture source. Nothing is inferred from prose.",
      },
      history: {
        state: "ok",
        scanned: closed.length,
        closed: closed.length,
        complete: true,
        oldestUpdatedAt: closed[closed.length - 1]?.closedAt ?? null,
        recent: closed.slice(0, 10).map((record) => ({
          number: record.number,
          title: record.title,
          url: record.url,
          createdAt: record.createdAt,
          closedAt: record.closedAt,
          stateReason: record.reason,
          linkedRelease: record.release
            ? {
                tag: record.release,
                url: `https://tracker.invalid/releases/${record.release}`,
              }
            : null,
          milestone: record.milestone ?? null,
        })),
      },
      forecast,
      complete: true,
    },
    limits: [
      "Read-only fixture source. This test adapter never writes or deploys.",
      "Unknown sections stay unknown and are never shown as zero.",
    ],
  };
}

function fixtureRecords() {
  const records = [
    {
      number: 1,
      title: "Fixture parent",
      url: "https://tracker.invalid/items/OPS-1",
      createdAt: ago(40),
      closedAt: null,
      milestone: "Fixture milestone",
      labels: ["ops"],
    },
    {
      number: 2,
      title: "Fixture reopened",
      url: "https://tracker.invalid/items/OPS-2",
      createdAt: ago(35),
      closedAt: null,
      reopened: true,
    },
    {
      number: 3,
      title: "Fixture blocked",
      url: "https://tracker.invalid/items/OPS-3",
      createdAt: ago(30),
      closedAt: null,
      parent: {
        repository: "fictional/tracker",
        number: 1,
        url: "https://tracker.invalid/items/OPS-1",
        kind: "issue",
        evidence: "reference",
        title: "Fixture parent",
      },
    },
  ];
  completedAges.forEach((closedAgo, index) =>
    records.push({
      number: 100 + index,
      title: `Fixture closure ${index + 1}`,
      url: `https://tracker.invalid/items/OPS-${100 + index}`,
      createdAt: ago(40),
      closedAt: ago(closedAgo),
      reason: "completed",
      release: index === 0 ? "fixture-1" : null,
    }),
  );
  records.push(
    {
      number: 200,
      title: "Fixture cancelled",
      url: "https://tracker.invalid/items/OPS-200",
      createdAt: ago(30),
      closedAt: ago(5),
      reason: "not_planned",
    },
    {
      number: 201,
      title: "Fixture duplicate",
      url: "https://tracker.invalid/items/OPS-201",
      createdAt: ago(30),
      closedAt: ago(6),
      reason: "duplicate",
    },
  );
  return records;
}

test("a fixture-backed second source uses the same projection and view", async (t) => {
  const report = adaptFixture(fixtureRecords());
  commandCentreReport.parse(report);
  assert.equal(report.repo.forecast.state, "ok");
  assert.equal(report.repo.forecast.observations.backlog, 3);

  const board = (await loadCommandCentrePage(t)).CommandCentreBoard;
  const delivery = renderBoard(board, report, "delivery");
  assert.match(delivery, /Source: Fictional tracker/);
  assert.match(delivery, /fixture-1/);
  assert.match(delivery, /https:\/\/tracker\.invalid\/releases\/fixture-1/);
  assert.match(delivery, /not a live check/);
  assert.match(delivery, /Fictional tracker quota|Source: Fictional tracker/);
  assert.doesNotMatch(delivery, /github\.com/i);

  const plan = renderBoard(board, report, "plan");
  assert.match(plan, /Fixture milestone/);
  assert.match(plan, /https:\/\/tracker\.invalid\/items\/OPS-1/);
  assert.match(plan, /Explicit references in the fixture source/);
  assert.doesNotMatch(plan, /github\.com/i);
});


test("relationship parsing requires a real label and never invents pull requests from prose", () => {
  const body = [
    "Related to #1 — release index.",
    "5. **Presentation/discovery:** #7/#28/#29 deliver the public journey.",
    "Preview #31 is still a draft.",
    "Parent: #12",
    "PR #14 is linked.",
  ].join("\n");
  const parsed = parseIssueRelationships(body, "loftwah/app-composer");
  assert.equal(parsed.parent?.number, 12);
  assert.deepEqual(
    parsed.pullRequests.map((entry) => entry.number),
    [14],
  );
  assert.equal(
    parsed.pullRequests.some((entry) =>
      [7, 28, 29, 31].includes(entry.number),
    ),
    false,
  );
});

test("a pull-request URL is read as a pull request, an issue URL stays a mention", () => {
  const parsed = parseIssueRelationships(
    [
      "See https://github.com/loftwah/app-composer/pull/88 for the change.",
      "Related https://github.com/loftwah/app-composer/issues/89.",
    ].join("\n"),
    "loftwah/app-composer",
  );
  assert.deepEqual(
    parsed.pullRequests.map((entry) => entry.number),
    [88],
  );
  assert.equal(parsed.parent, null);
  assert.equal(parsed.children.length, 0);
});

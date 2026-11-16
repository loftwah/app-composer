import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commandCentreReport,
  linkedReleaseFromBody,
  mapRecentIssues,
  normalizeStateReason,
  openIssueCount,
  pullRequestCountFromPage,
  releaseIssueNumbers,
} from "../src/lib/command-centre-contract.ts";
import {
  clearCommandCentreCache,
  commandCentreRepositories,
  manageCommandCentre,
  readCommandCentre,
} from "../src/lib/command-centre.ts";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";
import {
  loadCommandCentrePage,
  renderBoard,
} from "./command-centre-page-harness.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const origin = "https://composer.loftwah.com";
const repository = "loftwah/app-composer";
const checkedNow = Date.parse("2026-11-16T03:20:00.000Z");
const day = 86_400_000;
const ago = (days) => new Date(checkedNow - days * day).toISOString();

function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function linkHeader(last) {
  return `<https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=${last}>; rel="last"`;
}

function issue(number, options = {}) {
  const {
    pull = false,
    labels = [],
    title = null,
    body = null,
    createdAgo = 40,
    closedAgo = null,
    reason = null,
    milestone = null,
  } = options;
  return {
    number,
    title: title ?? `Fictional issue ${number}`,
    html_url: `https://github.com/${repository}/issues/${number}`,
    updated_at: closedAgo === null ? ago(0) : ago(closedAgo),
    created_at: ago(createdAgo),
    closed_at: closedAgo === null ? null : ago(closedAgo),
    state_reason: reason,
    body,
    milestone: milestone
      ? {
          title: milestone,
          due_on: null,
          html_url: `https://github.com/${repository}/milestone/1`,
        }
      : null,
    labels: labels.map((name) => ({ name })),
    ...(pull
      ? { pull_request: { url: `https://api.github.com/pulls/${number}` } }
      : {}),
  };
}

function openItems() {
  return [
    issue(10, {
      labels: ["bug"],
      title: "Plan relationships",
      milestone: "Pilot",
      body: [
        "Parent: #11",
        "Blocked by: #12",
        "Sub-issues: #13, #14",
        `PR: https://github.com/${repository}/pull/701`,
      ].join("\n\n"),
    }),
    issue(15, { title: "Reopened work", reason: "reopened" }),
    issue(11, {
      title: "Coordination index",
      body: "Sub-issues: #10",
      labels: ["a", "b", "c", "d", "e", "f", "blocked"],
    }),
    issue(12, { title: "Missing body" }),
    issue(13, { title: "Child work", body: "Part of #11" }),
    issue(14, { title: "Unlinked work", body: "No relationships here." }),
    issue(700, { pull: true }),
  ];
}

function closedItems() {
  const items = [];
  let number = 100;
  const completedAges = [
    1, 3, 5, 6, 8, 10, 12, 15, 17, 19, 22, 24, 26, 27, 29, 31,
  ];
  completedAges.forEach((closedAgo, index) => {
    items.push(
      issue(number++, {
        closedAgo,
        reason: "completed",
        title: `Completed ${closedAgo} days ago`,
        body:
          index === 0
            ? `Released in [v1.2.0](https://github.com/${repository}/releases/tag/v1.2.0).`
            : null,
      }),
    );
  });
  [2, 9].forEach((closedAgo) => {
    items.push(
      issue(number++, {
        closedAgo,
        reason: "not_planned",
        title: "Not planned work",
      }),
    );
  });
  [4, 11].forEach((closedAgo) => {
    items.push(
      issue(number++, {
        closedAgo,
        reason: "duplicate",
        title: "Duplicate work",
      }),
    );
  });
  return items.sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

function releaseList() {
  return [
    {
      tag_name: "v1.2.0",
      name: "Relationship release",
      html_url: `https://github.com/${repository}/releases/tag/v1.2.0`,
      published_at: "2026-11-15T22:10:00Z",
      body: "Includes #10 and #12.",
      draft: false,
      prerelease: false,
    },
    {
      tag_name: "v1.1.0",
      name: null,
      html_url: `https://github.com/${repository}/releases/tag/v1.1.0`,
      published_at: "2026-11-10T10:00:00Z",
      body: null,
      draft: false,
      prerelease: true,
    },
  ];
}

function baseResponses() {
  return {
    [`/repos/${repository}`]: () =>
      json({
        full_name: repository,
        html_url: `https://github.com/${repository}`,
        default_branch: "main",
        archived: false,
        open_issues_count: 9,
        private: false,
      }),
    [`/repos/${repository}/pulls`]: () =>
      json([{ number: 700 }], { headers: { link: linkHeader(3) } }),
    [`/repos/${repository}/labels`]: () =>
      json([{ name: "bug" }, { name: "blocked" }, { name: "enhancement" }]),
    [`/repos/${repository}/releases`]: () => json(releaseList()),
    [`/repos/${repository}/commits`]: () =>
      json([
        {
          sha: "a".repeat(40),
          html_url: `https://github.com/${repository}/commit/${"a".repeat(40)}`,
          commit: { committer: { date: "2026-11-16T01:15:00Z" } },
          author: { login: "fictional-owner" },
        },
      ]),
    [`/repos/${repository}/issues`]: (url) => {
      if (url.searchParams.get("labels") === "blocked")
        return json([
          issue(31, { labels: ["blocked"] }),
          issue(32, { labels: ["blocked"] }),
          issue(701, { pull: true, labels: ["blocked"] }),
        ]);
      if (url.searchParams.get("state") === "closed") return json(closedItems());
      return json(openItems());
    },
  };
}

function fixtureFetch(responses) {
  const calls = [];
  const authorisations = [];
  const fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    calls.push(parsed.pathname + parsed.search);
    authorisations.push(init.headers?.Authorization ?? null);
    const handler = responses[parsed.pathname];
    if (!handler)
      throw new Error("Unexpected GitHub request: " + parsed.pathname);
    return handler(parsed, init);
  };
  return { fetch, calls, authorisations };
}

async function readNormal() {
  clearCommandCentreCache();
  const fixture = fixtureFetch(baseResponses());
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixture.fetch,
  });
  return { report, ...fixture };
}

test("the command centre lists only the three default public repositories", () => {
  const names = commandCentreRepositories.map((entry) => entry.repository);
  assert.equal(names.length, 3);
  assert.ok(names.includes("loftwah/app-composer"));
  assert.ok(names.includes("loftwah/composer-media-studio"));
  assert.ok(names.includes("loftwah/liferaft"));
  assert.ok(
    !names.includes("loftwah/card-collector-bot"),
    "Foilbury is outside the default three",
  );
  assert.ok(!names.includes("loftwah/club"), "archived club is not listed");
  assert.equal(new Set(names).size, names.length);
});

test("a normal read maps counts, history, plan, forecasts, releases and commits", async () => {
  const { report, calls } = await readNormal();
  commandCentreReport.parse(report);

  assert.equal(report.ok, true);
  assert.equal(report.schema, "app-composer.command-centre/2");
  assert.deepEqual(report.source, { id: "github", label: "GitHub" });
  assert.equal(report.selected, repository);
  assert.equal(report.cached, false);
  assert.equal(report.cacheSeconds, 720, "public reads use the long window");
  assert.deepEqual(report.repo.links, {
    issues: `https://github.com/${repository}/issues`,
    pullRequests: `https://github.com/${repository}/pulls`,
    newIssue: `https://github.com/${repository}/issues/new/choose`,
  });
  assert.equal(report.repo.issues.count.state, "ok");
  assert.equal(
    report.repo.issues.count.value,
    6,
    "9 open items minus 3 pull requests",
  );
  assert.equal(report.repo.pullRequests.state, "ok");
  assert.equal(report.repo.pullRequests.value, 3);
  assert.equal(report.repo.release.state, "ok");
  assert.equal(report.repo.release.latest.tag, "v1.2.0");
  assert.equal(report.repo.release.latest.prerelease, false);
  assert.equal(report.repo.releases.state, "ok");
  assert.equal(report.repo.releases.items.length, 2);
  assert.equal(report.repo.releases.items[1].tag, "v1.1.0");
  assert.equal(report.repo.releases.items[1].prerelease, true);
  assert.deepEqual(
    report.repo.releases.items[0].issues.map((entry) => entry.number),
    [10, 12],
  );
  assert.equal(report.repo.commit.state, "ok");
  assert.equal(report.repo.commit.latest.sha, "a".repeat(40));
  assert.deepEqual(report.repo.blocked, {
    state: "ok",
    labels: [{ name: "blocked", count: 2 }],
    count: 2,
  });
  assert.equal(report.repo.issues.recent.state, "ok");
  assert.equal(report.repo.issues.recent.items.length, 5);
  assert.ok(
    report.repo.issues.recent.items.every((item) => item.number !== 700),
    "a pull request in the issues list is never a recent issue",
  );
  assert.equal(report.repo.issues.recent.items[0].number, 10);
  assert.equal(report.repo.issues.recent.items[1].reopened, true);

  // Plan reads only explicit relationships from the fetched bodies.
  assert.equal(report.repo.plan.state, "ok");
  assert.equal(report.repo.plan.scanned, 7);
  assert.equal(report.repo.plan.complete, true);
  assert.equal(report.repo.plan.items.length, 6);
  const planItem = report.repo.plan.items.find((item) => item.number === 10);
  assert.ok(planItem);
  assert.equal(planItem.parent.number, 11);
  assert.equal(planItem.parent.title, "Coordination index");
  assert.deepEqual(
    planItem.children.map((entry) => entry.number),
    [13, 14],
  );
  assert.deepEqual(
    planItem.blockers.map((entry) => entry.number),
    [12],
  );
  assert.equal(planItem.pullRequests[0].number, 701);
  assert.equal(planItem.pullRequests[0].kind, "pull-request");
  assert.equal(planItem.linkState, "found");
  assert.deepEqual(report.repo.plan.milestones, [
    { title: "Pilot", dueOn: null, openIssues: 1, blockedIssues: 1 },
  ]);
  const unlinked = report.repo.plan.items.find((item) => item.number === 14);
  assert.equal(unlinked.linkState, "none");
  const missingBody = report.repo.plan.items.find((item) => item.number === 12);
  assert.equal(missingBody.linkState, "unknown");
  const reopened = report.repo.plan.items.find((item) => item.number === 15);
  assert.equal(reopened.reopened, true);
  const lateBlockedLabel = report.repo.plan.items.find(
    (item) => item.number === 11,
  );
  assert.equal(
    lateBlockedLabel.blockedByLabel,
    true,
    "a blocked label after the displayed six still counts",
  );
  assert.equal(lateBlockedLabel.labels.length, 6);

  // Delivery history is a bounded sample, with closure reasons preserved.
  assert.equal(report.repo.history.state, "ok");
  assert.equal(report.repo.history.scanned, 20);
  assert.equal(report.repo.history.closed, 20);
  assert.equal(report.repo.history.complete, true);
  assert.equal(report.repo.history.recent.length, 10);
  assert.equal(report.repo.history.recent[0].linkedRelease.tag, "v1.2.0");
  assert.equal(report.repo.history.recent[1].stateReason, "not_planned");
  assert.ok(
    report.repo.history.recent.some(
      (item) => item.stateReason === "duplicate",
    ),
  );

  // The forecast is derived from confirmed history, not invented.
  assert.equal(report.repo.forecast.state, "ok");
  assert.equal(report.repo.forecast.observations.windowDays, 28);
  assert.equal(report.repo.forecast.observations.sampledCompleted, 16);
  assert.equal(report.repo.forecast.observations.notPlanned, 2);
  assert.equal(report.repo.forecast.observations.duplicate, 2);
  assert.equal(report.repo.forecast.observations.missingTimestamps, 0);
  assert.equal(report.repo.forecast.observations.releaseLinked, 1);
  assert.equal(report.repo.forecast.observations.windowCompleted, 14);
  assert.equal(report.repo.forecast.observations.perWeek, 3.5);
  assert.equal(report.repo.forecast.observations.backlog, 6);
  assert.equal(report.repo.forecast.observations.reopens, 1);
  assert.equal(report.repo.forecast.observations.medianCycleDays, 24);
  assert.equal(report.repo.forecast.observations.cycleSample, 16);
  assert.equal(report.repo.forecast.interval.confidence, "medium");
  assert.equal(report.repo.forecast.interval.earliestDays, 10);
  assert.equal(report.repo.forecast.interval.latestDays, 14);
  assert.equal(report.repo.complete, true);
  assert.equal(report.rateLimit.limit, null);

  // Six parallel reads, one commit read and one blocked-label count. No second
  // page is ever requested.
  assert.equal(calls.length, 8);
  assert.ok(calls.every((call) => !call.includes("page=2")));
});

test("cache TTL follows the credential: 55 seconds with a token, 12 minutes without", async () => {
  clearCommandCentreCache();
  const publicFixture = fixtureFetch(baseResponses());
  const first = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: publicFixture.fetch,
  });
  assert.equal(first.cacheSeconds, 720);
  const publicCalls = publicFixture.calls.length;
  assert.equal(
    publicCalls,
    8,
    "six parallel reads, one commit read and one blocked label count",
  );

  const cachedPublic = await readCommandCentre({
    repository,
    now: checkedNow + 5 * 60_000,
    fetch: publicFixture.fetch,
  });
  assert.equal(cachedPublic.cached, true);
  assert.equal(cachedPublic.cacheSeconds, 720);
  assert.equal(cachedPublic.cacheAgeSeconds, 300);
  assert.equal(publicFixture.calls.length, publicCalls);

  const expiredPublic = await readCommandCentre({
    repository,
    now: checkedNow + 721_000,
    fetch: publicFixture.fetch,
  });
  assert.equal(expiredPublic.cached, false);
  assert.ok(publicFixture.calls.length > publicCalls);

  clearCommandCentreCache();
  const token = "fixture-token-1234";
  const tokenFixture = fixtureFetch(baseResponses());
  const credentialed = await readCommandCentre({
    repository,
    token,
    now: checkedNow,
    fetch: tokenFixture.fetch,
  });
  assert.equal(credentialed.cacheSeconds, 55);
  assert.ok(
    tokenFixture.authorisations.every(
      (value) => value === `Bearer ${token}`,
    ),
    "the token is sent only to the source adapter",
  );
  const cachedShort = await readCommandCentre({
    repository,
    token,
    now: checkedNow + 5_000,
    fetch: tokenFixture.fetch,
  });
  assert.equal(cachedShort.cached, true);
  assert.equal(cachedShort.cacheSeconds, 55);
  assert.equal(cachedShort.cacheAgeSeconds, 5);
  const expiredShort = await readCommandCentre({
    repository,
    token,
    now: checkedNow + 56_000,
    fetch: tokenFixture.fetch,
  });
  assert.equal(expiredShort.cached, false);

  // A TTL-mode change must not serve the other window's result.
  clearCommandCentreCache();
  const mixedFixture = fixtureFetch(baseResponses());
  await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: mixedFixture.fetch,
  });
  const switched = await readCommandCentre({
    repository,
    token,
    now: checkedNow + 1_000,
    fetch: mixedFixture.fetch,
  });
  assert.equal(
    switched.cached,
    false,
    "a credentialed read does not reuse the public window",
  );
});

test("a rate-limited read is unknown in every section and never zero", async () => {
  clearCommandCentreCache();
  const reset = 1_764_000_000;
  const limited = () =>
    json(
      { message: "API rate limit exceeded for 203.0.113.7." },
      {
        status: 403,
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(reset),
        },
      },
    );
  const fixture = fixtureFetch({
    [`/repos/${repository}`]: limited,
    [`/repos/${repository}/pulls`]: limited,
    [`/repos/${repository}/labels`]: limited,
    [`/repos/${repository}/releases`]: limited,
    [`/repos/${repository}/issues`]: limited,
  });
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixture.fetch,
  });
  commandCentreReport.parse(report);
  assert.equal(report.cached, false);
  assert.equal(report.repo.issues.count.state, "unknown");
  assert.equal(report.repo.issues.recent.state, "unknown");
  assert.equal(report.repo.pullRequests.state, "unknown");
  assert.equal(report.repo.blocked.state, "unknown");
  assert.equal(report.repo.release.state, "unknown");
  assert.equal(report.repo.releases.state, "unknown");
  assert.equal(report.repo.commit.state, "unknown");
  assert.equal(report.repo.plan.state, "unknown");
  assert.equal(report.repo.history.state, "unknown");
  assert.equal(report.repo.forecast.state, "unknown");
  assert.match(report.repo.forecast.reason, /closed issues were not read/i);
  assert.equal(report.repo.forecast.observations.backlog, null);
  assert.equal(report.repo.forecast.observations.sampledClosed, null);
  assert.equal(report.repo.archived, null);
  assert.equal(report.repo.complete, false);
  assert.match(report.repo.pullRequests.reason, /rate limit is exhausted/i);
  assert.match(report.repo.pullRequests.reason, /resets at \d{2}:\d{2} UTC/);
  assert.equal(report.rateLimit.remaining, 0);
  assert.equal(report.rateLimit.limit, 60);

  // A cached failure stays honest and does not hammer GitHub.
  const callsAfterFirst = fixture.calls.length;
  const cached = await readCommandCentre({
    repository,
    now: checkedNow + 5_000,
    fetch: fixture.fetch,
  });
  assert.equal(cached.cached, true);
  assert.equal(cached.cacheAgeSeconds, 5);
  assert.equal(cached.repo.pullRequests.state, "unknown");
  assert.equal(fixture.calls.length, callsAfterFirst);
});

test("a network failure is unknown with a reason, not a partial zero", async () => {
  clearCommandCentreCache();
  const fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch,
  });
  commandCentreReport.parse(report);
  assert.equal(report.repo.issues.count.state, "unknown");
  assert.equal(report.repo.forecast.state, "unknown");
  assert.equal(report.repo.complete, false);
  assert.match(
    report.repo.issues.count.reason,
    /request to GitHub failed before a response arrived/i,
  );
});

test("a 404 repository is unknown while independent sections can still read", async () => {
  clearCommandCentreCache();
  const responses = baseResponses();
  responses[`/repos/${repository}`] = () =>
    json({ message: "Not Found" }, { status: 404 });
  responses[`/repos/${repository}/releases`] = () =>
    json({ message: "Not Found" }, { status: 404 });
  const fixture = fixtureFetch(responses);
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixture.fetch,
  });
  commandCentreReport.parse(report);
  assert.equal(report.repo.issues.count.state, "unknown");
  assert.equal(report.repo.commit.state, "unknown");
  assert.equal(report.repo.archived, null);
  assert.equal(report.repo.url, "https://github.com/" + repository);
  assert.equal(report.repo.release.state, "unknown");
  assert.equal(report.repo.plan.state, "ok");
  assert.equal(report.repo.history.state, "ok");
  assert.equal(report.repo.forecast.state, "unknown");
  assert.match(report.repo.forecast.reason, /open backlog was not confirmed/i);
  assert.equal(report.repo.complete, false);
  assert.match(report.repo.issues.count.reason, /404/);
});

test("a malformed GitHub response is unknown rather than coerced", async () => {
  clearCommandCentreCache();
  const responses = baseResponses();
  responses[`/repos/${repository}`] = () => json({ hello: "world" });
  const fixture = fixtureFetch(responses);
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixture.fetch,
  });
  commandCentreReport.parse(report);
  assert.equal(report.repo.issues.count.state, "unknown");
  assert.match(report.repo.issues.count.reason, /unexpected response shape/i);
  assert.equal(report.repo.release.state, "ok");
  assert.equal(report.repo.forecast.state, "unknown");
  assert.equal(report.repo.complete, false);
});

test("a missing release is known to be absent, unlike a failed read", async () => {
  clearCommandCentreCache();
  const responses = baseResponses();
  responses[`/repos/${repository}/releases`] = () => json([]);
  const fixture = fixtureFetch(responses);
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixture.fetch,
  });
  commandCentreReport.parse(report);
  assert.equal(report.repo.release.state, "ok");
  assert.equal(report.repo.release.latest, null);
  assert.equal(report.repo.releases.state, "ok");
  assert.deepEqual(report.repo.releases.items, []);
  assert.equal(report.repo.complete, true);
});

test("an absent blocked label is shown as none, not as zero issues", async () => {
  clearCommandCentreCache();
  const responses = baseResponses();
  responses[`/repos/${repository}/labels`] = () =>
    json([{ name: "bug" }, { name: "documentation" }]);
  const fixture = fixtureFetch(responses);
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixture.fetch,
  });
  commandCentreReport.parse(report);
  assert.deepEqual(report.repo.blocked, {
    state: "ok",
    labels: [],
    count: null,
  });
  assert.ok(
    fixture.calls.every(
      (call) => !call.includes("labels=blocked"),
      "no blocked count is requested when the label does not exist",
    ),
  );
  assert.equal(
    fixture.calls.length,
    7,
    "a repository read without blocked labels is seven requests",
  );
});

test("contract helpers keep pull requests, reasons and releases honest", () => {
  assert.equal(pullRequestCountFromPage(null, []), 0);
  assert.equal(pullRequestCountFromPage(null, [{ number: 1 }]), 1);
  assert.equal(pullRequestCountFromPage(linkHeader(7), [{ number: 1 }]), 7);
  assert.equal(
    pullRequestCountFromPage("<https://api.github.com/x?page=2>; rel=next", [
      { number: 1 },
    ]),
    null,
    "an unreadable Link header is unknown, not one",
  );
  assert.equal(openIssueCount(9, 3), 6);
  assert.equal(openIssueCount(2, 3), null, "a nonsensical split is unknown");

  const mapped = mapRecentIssues([
    issue(1, { pull: true }),
    issue(2),
    issue(3),
  ]);
  assert.equal(mapped.items.length, 2);
  assert.equal(mapped.complete, true);
  assert.equal(mapped.scanned, 3);

  assert.equal(normalizeStateReason("completed"), "completed");
  assert.equal(normalizeStateReason("duplicate"), "duplicate");
  assert.equal(normalizeStateReason("reopened"), "reopened");
  assert.equal(normalizeStateReason("not_planned"), "not_planned");
  assert.equal(normalizeStateReason("something-new"), "unknown");
  assert.equal(normalizeStateReason(null), null);

  assert.deepEqual(
    releaseIssueNumbers("Fixes #12, #13 and #12 again."),
    [12, 13],
  );
  assert.equal(
    linkedReleaseFromBody(
      `Merged via https://github.com/${repository}/pull/701`,
    ),
    null,
    "a merged pull request is never a release link",
  );
  const releaseUrl = `https://github.com/${repository}/releases/tag/v1.2.0`;
  assert.deepEqual(linkedReleaseFromBody(`Released in ${releaseUrl}`), {
    tag: "v1.2.0",
    url: releaseUrl,
  });
});

test("the route rejects non-creators, writes and target overrides", async () => {
  clearCommandCentreCache();
  const fixture = fixtureFetch(baseResponses());
  const request = (method = "GET") =>
    new Request(
      origin + "/_emdash/api/plugins/composer-stacks/commandCentreRead",
      {
        method,
        headers: { Origin: origin },
      },
    );
  const context = (user, input, method = "GET") => ({
    user,
    input,
    request: request(method),
  });

  await assert.rejects(
    manageCommandCentre(context(undefined, {}), {}, fixture.fetch),
    (error) => error.status === 403,
  );
  await assert.rejects(
    manageCommandCentre(
      context({ id: "fictional-reader", role: 10 }, {}),
      {},
      fixture.fetch,
    ),
    (error) => error.status === 403,
  );
  await assert.rejects(
    manageCommandCentre(
      context({ id: "fictional-owner", role: 50 }, {}, "POST"),
      {},
      fixture.fetch,
    ),
    (error) => error.status === 405,
  );
  await assert.rejects(
    manageCommandCentre(
      context({ id: "fictional-owner", role: 50 }, { repo: "other/repo" }),
      {},
      fixture.fetch,
    ),
    (error) => error.status === 400,
  );
  await assert.rejects(
    manageCommandCentre(
      context(
        { id: "fictional-owner", role: 50 },
        { repo: repository, all: "1" },
      ),
      {},
      fixture.fetch,
    ),
    (error) => error.status === 400,
  );
  await assert.rejects(
    manageCommandCentre(
      {
        user: { id: "fictional-owner", role: 50 },
        input: { repo: repository },
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/commandCentreRead",
          { headers: { Origin: "https://example.invalid" } },
        ),
      },
      {},
      fixture.fetch,
    ),
    (error) => error.status === 403,
  );
});

test("the route reads a real allowlisted selection and never returns the token", async () => {
  clearCommandCentreCache();
  const body = await manageCommandCentre(
    {
      user: { id: "fictional-owner", role: 50 },
      input: { repo: "loftwah/liferaft" },
      request: new Request(
        origin +
          "/_emdash/api/plugins/composer-stacks/commandCentreRead?repo=loftwah%2Fliferaft",
        { headers: { Origin: origin } },
      ),
    },
    { GITHUB_TOKEN: "fixture-token-1234" },
    async (url, init) => {
      const parsed = new URL(url);
      const responses = baseResponses();
      const replacement = parsed.pathname.replace(
        "loftwah/liferaft",
        repository,
      );
      const handler = responses[replacement];
      assert.ok(handler, "unexpected GitHub request");
      return handler(parsed, init);
    },
  );
  assert.equal(
    body instanceof Response,
    false,
    "the route must return a plain report for EmDash to wrap as data",
  );
  commandCentreReport.parse(body);
  assert.equal(body.selected, "loftwah/liferaft");
  assert.equal(body.repo.issues.count.value, 6);
  assert.equal(body.repo.forecast.state, "ok");
  assert.doesNotMatch(JSON.stringify(body), /fixture-token-1234/);
});

test("page registration uses the creator permission and the page map", () => {
  const definition = creatorPlugin("fictional-admin-entry", {});
  const page = definition.admin.pages.find(
    (entry) => entry.path === "/command-centre",
  );
  assert.deepEqual(page, {
    path: "/command-centre",
    label: "Command centre",
    icon: "chart",
  });
  const route = definition.routes.commandCentreRead;
  assert.deepEqual(route.methods, ["GET"]);
  assert.equal(route.permission, "content:read_drafts");
  assert.equal(definition.routes.commandCentreWrite, undefined);
});

test("the page request sends X-EmDash-Request and unwraps the data envelope", async (t) => {
  const { report } = await readNormal();
  const { loadCommandCentre } = await loadCommandCentrePage(t);
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), headers: new Headers(init?.headers) });
    return Response.json({ success: true, data: report });
  };
  try {
    const loaded = await loadCommandCentre(
      repository,
      new AbortController().signal,
    );
    assert.equal(seen.length, 1);
    assert.equal(
      seen[0].url,
      "/_emdash/api/plugins/composer-stacks/commandCentreRead?repo=loftwah%2Fapp-composer",
    );
    assert.equal(seen[0].headers.get("X-EmDash-Request"), "1");
    assert.equal(loaded.selected, repository);
    assert.equal(loaded.repo.issues.count.value, 6);
    assert.equal(loaded.source.id, "github");

    // The production defect returned `{ success: true, data: {} }`. The page
    // must reject that empty payload instead of rendering an empty report.
    globalThis.fetch = async () => Response.json({ success: true, data: {} });
    await assert.rejects(
      loadCommandCentre(repository, new AbortController().signal),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the Pulse board keeps the existing counts, tabs and empty state", async (t) => {
  const { report } = await readNormal();
  const board = (await loadCommandCentrePage(t)).CommandCentreBoard;

  const html = renderBoard(board, report);
  assert.match(html, /Command centre|Open issues/);
  assert.match(html, /Open issues/);
  assert.match(html, /Open pull requests/);
  assert.match(html, /href="\?repo=loftwah%2Fcomposer-media-studio"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /v1\.2\.0/);
  assert.match(html, /aaaaaaaaaaaa/);
  assert.match(html, /blocked/);
  assert.match(html, /Recently updated open issues/);
  assert.match(html, /#10/);
  assert.match(html, /Completion outlook/);
  assert.match(html, /Source: GitHub/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-controls="cc-panel-pulse"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /cc-panel-pulse/);
  assert.match(html, /Fresh|Live read|not cached/);
  assert.match(html, /Fetched/);
  assert.match(html, /Effective cache: 720-second window/);
  assert.match(html, /fresh in this request/);
  assert.match(html, /No GitHub credential is configured/);
  assert.doesNotMatch(html, /Unknown — checked at/);

  // The credentialed path keeps the short TTL and says so in the footer.
  clearCommandCentreCache();
  const token = "fixture-token-1234";
  const tokenFixture = fixtureFetch(baseResponses());
  await readCommandCentre({
    repository,
    token,
    now: checkedNow,
    fetch: tokenFixture.fetch,
  });
  const cachedToken = await readCommandCentre({
    repository,
    token,
    now: checkedNow + 3_000,
    fetch: tokenFixture.fetch,
  });
  const tokenHtml = renderBoard(board, cachedToken);
  assert.match(tokenHtml, /Effective cache: 55-second window/);
  assert.match(tokenHtml, /this response is 3 seconds old/);
  assert.doesNotMatch(tokenHtml, /No GitHub credential is configured/);

  // A repository with no open issues gets a useful empty state, not a blank.
  clearCommandCentreCache();
  const responses = baseResponses();
  responses[`/repos/${repository}`] = () =>
    json({
      full_name: repository,
      html_url: `https://github.com/${repository}`,
      default_branch: "main",
      archived: false,
      open_issues_count: 0,
    });
  responses[`/repos/${repository}/pulls`] = () => json([]);
  responses[`/repos/${repository}/issues`] = (url) =>
    json(url.searchParams.get("state") === "closed" ? [] : []);
  responses[`/repos/${repository}/labels`] = () => json([{ name: "bug" }]);
  responses[`/repos/${repository}/releases`] = () => json([]);
  responses[`/repos/${repository}/commits`] = () => json([]);
  const empty = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixtureFetch(responses).fetch,
  });
  commandCentreReport.parse(empty);
  assert.equal(empty.repo.forecast.state, "ok");
  assert.equal(empty.repo.forecast.interval, null);
  assert.equal(empty.repo.forecast.observations.backlog, 0);
  assert.equal(empty.repo.forecast.observations.scope.state, "stable");
  assert.match(empty.repo.forecast.notes[0], /nothing to forecast/i);
  const emptyHtml = renderBoard(board, empty);
  assert.match(emptyHtml, /No open issues\./);
  assert.match(
    emptyHtml,
    /None — this repository defines no blocked or needs-attention label/,
  );
  assert.match(emptyHtml, /No release recorded/);
  assert.match(emptyHtml, /No commit reported/);
  assert.doesNotMatch(emptyHtml, /0 open issues/);
  assert.match(emptyHtml, /issue chooser/);
  assert.doesNotMatch(emptyHtml, /cc-issues/);

  const emptyPlan = renderBoard(board, empty, "plan");
  assert.match(emptyPlan, /No open issues\./);
  assert.match(emptyPlan, /There is no plan to outline/);
  assert.match(emptyPlan, /issue chooser/);
  assert.doesNotMatch(emptyPlan, /cc-table-scroll/);

  const emptyDelivery = renderBoard(board, empty, "delivery");
  assert.match(
    emptyDelivery,
    /No open issues in the confirmed backlog, so there is no completion window to project\./,
  );
  assert.match(emptyDelivery, /No closed issues in this read\./);
  assert.match(emptyDelivery, /No release was returned/);
  assert.doesNotMatch(emptyDelivery, /cc-forecast-band/);
});

test("the Plan lens shows explicit relationships and an accessible table", async (t) => {
  const { report } = await readNormal();
  const board = (await loadCommandCentrePage(t)).CommandCentreBoard;
  const html = renderBoard(board, report, "plan");

  assert.match(html, /Plan and dependencies/);
  assert.match(html, /cc-panel-plan/);
  assert.match(html, /Grouped by milestone/);
  assert.match(html, /Pilot/);
  assert.match(html, /<table/);
  assert.match(html, /<caption>/);
  assert.match(html, /<th scope="col">Issue<\/th>/);
  assert.match(html, /Parent/);
  assert.match(html, /Blocked by/);
  assert.match(html, /Sub-issue/);
  assert.match(html, /Pull request/);
  assert.match(html, /state not read/);
  assert.match(html, /Review PR/);
  assert.match(html, /Open issue/);
  assert.match(html, /Copy link/);
  assert.match(html, /Reopened work/);
  assert.match(html, /cc-table-scroll/);
  assert.match(html, /No explicit parent, sub-issue, blocker/);
  assert.match(html, /the issue body was not read/);
  assert.doesNotMatch(html, /No open issues\./);
  assert.doesNotMatch(html, /Unknown — checked at/);
});

test("a PR-full open page never claims there are no open issues", async (t) => {
  clearCommandCentreCache();
  const responses = baseResponses();
  responses[`/repos/${repository}`] = () =>
    json({
      full_name: repository,
      html_url: `https://github.com/${repository}`,
      default_branch: "main",
      archived: false,
      open_issues_count: 12,
    });
  responses[`/repos/${repository}/pulls`] = () => json([]);
  responses[`/repos/${repository}/issues`] = (url) =>
    url.searchParams.get("state") === "closed"
      ? json([])
      : json(
          Array.from({ length: 100 }, (_, index) =>
            issue(700 + index, { pull: true }),
          ),
        );
  responses[`/repos/${repository}/releases`] = () => json([]);
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixtureFetch(responses).fetch,
  });
  commandCentreReport.parse(report);
  assert.equal(report.repo.issues.count.value, 12);
  assert.equal(report.repo.issues.recent.items.length, 0);
  assert.equal(report.repo.issues.recent.complete, false);
  assert.equal(report.repo.plan.items.length, 0);
  assert.equal(report.repo.plan.complete, false);

  const board = (await loadCommandCentrePage(t)).CommandCentreBoard;
  const html = renderBoard(board, report, "plan");
  assert.match(html, /No open issue appeared in the sampled page/);
  assert.doesNotMatch(html, /<strong>No open issues\.<\/strong>/);
});

test("the Delivery lens shows throughput, the band, closures and releases", async (t) => {
  const { report } = await readNormal();
  const board = (await loadCommandCentrePage(t)).CommandCentreBoard;
  const html = renderBoard(board, report, "delivery");

  assert.match(html, /Delivery and outlook/);
  assert.match(html, /cc-panel-delivery/);
  assert.match(html, /Cautious completion window/);
  assert.match(html, /cc-forecast-band/);
  assert.match(html, /medium confidence/);
  assert.match(html, /Median cycle time/);
  assert.match(html, /24 days \(n=16\)/);
  assert.match(html, /3\.5 completed per week/);
  assert.match(html, /Observation window/);
  assert.match(html, /28 days from/);
  assert.match(html, /Recent completions/);
  assert.match(html, /v1\.2\.0/);
  assert.match(html, /Release notes reference/);
  assert.match(html, /not a live check/);
  assert.match(html, /Closed means the source recorded a closure/);
  assert.match(html, /Review 3 open pull requests/);
  assert.match(html, /Open the issue list/);
  assert.match(html, /1 sampled completed closure links to a release/);
  assert.doesNotMatch(html, /Unknown — checked at/);
});

test("unknown states are never rendered as zero, a date or an empty list", async (t) => {
  clearCommandCentreCache();
  const limited = () =>
    json(
      { message: "API rate limit exceeded" },
      {
        status: 403,
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1764000000",
        },
      },
    );
  const fetch = fixtureFetch({
    [`/repos/${repository}`]: limited,
    [`/repos/${repository}/pulls`]: limited,
    [`/repos/${repository}/labels`]: limited,
    [`/repos/${repository}/releases`]: limited,
    [`/repos/${repository}/issues`]: limited,
  }).fetch;
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch,
  });
  const board = (await loadCommandCentrePage(t)).CommandCentreBoard;
  const html = renderBoard(board, report);

  assert.match(html, /Unknown<\/strong> — checked at \d{2}:\d{2} UTC/);
  assert.match(html, /rate limit is exhausted/i);
  assert.match(html, /partial read/i);
  assert.doesNotMatch(
    html,
    /cc-stat-value/,
    "no stat value is rendered when unknown",
  );
  assert.doesNotMatch(html, /<strong>0<\/strong>/);
  assert.doesNotMatch(html, /No open issues\./);
  assert.doesNotMatch(html, /No release recorded/);
  assert.doesNotMatch(html, /No commit reported/);
  assert.doesNotMatch(html, /cc-forecast-band/);

  const delivery = renderBoard(board, report, "delivery");
  assert.match(delivery, /No date is shown/);
  assert.match(
    delivery,
    /Sampled closed issues<\/dt><dd>Unknown<\/dd>/,
  );
  assert.match(delivery, /Open backlog<\/dt><dd>Unknown<\/dd>/);
  assert.doesNotMatch(delivery, /0 completed/);
  assert.doesNotMatch(delivery, /cc-forecast-band/);
  assert.doesNotMatch(delivery, /No open issues in the confirmed backlog/);
});

test("the tabs are labelled, roving and keyboard operable in source", () => {
  const source = readFileSync(
    join(root, "src/plugins/command-centre-page.tsx"),
    "utf8",
  );
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=/);
  assert.match(source, /aria-controls=/);
  assert.match(source, /tabIndex=/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /"Home"/);
  assert.match(source, /"End"/);
  assert.match(source, /id=\{`cc-tab-\$\{entry\.id\}`\}/);
  assert.match(source, /role="tabpanel"/);
});

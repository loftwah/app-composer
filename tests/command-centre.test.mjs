import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  commandCentreReport,
  mapRecentIssues,
  openIssueCount,
  pullRequestCountFromPage,
} from "../src/lib/command-centre-contract.ts";
import {
  clearCommandCentreCache,
  commandCentreRepositories,
  manageCommandCentre,
  readCommandCentre,
} from "../src/lib/command-centre.ts";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const origin = "https://composer.loftwah.com";
const repository = "loftwah/app-composer";
const checkedNow = Date.parse("2026-11-16T03:20:00.000Z");

function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function linkHeader(last) {
  return `<https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/pulls?state=open&per_page=1&page=${last}>; rel="last"`;
}

function issue(number, { pull = false, labels = [], title = null } = {}) {
  return {
    number,
    title: title ?? `Fictional issue ${number}`,
    html_url: `https://github.com/${repository}/issues/${number}`,
    updated_at: `2026-11-16T02:${String(number).slice(-2).padStart(2, "0")}:00Z`,
    labels: labels.map((name) => ({ name })),
    ...(pull
      ? { pull_request: { url: `https://api.github.com/pulls/${number}` } }
      : {}),
  };
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
    [`/repos/${repository}/releases/latest`]: () =>
      json({
        tag_name: "v1.2.0",
        html_url: `https://github.com/${repository}/releases/tag/v1.2.0`,
        published_at: "2026-11-15T22:10:00Z",
        draft: false,
        prerelease: false,
      }),
    [`/repos/${repository}/commits`]: () =>
      json([
        {
          sha: "a".repeat(40),
          html_url: `https://github.com/${repository}/commit/${"a".repeat(40)}`,
          commit: { committer: { date: "2026-11-16T01:15:00Z" } },
          author: { login: "fictional-owner" },
        },
      ]),
    [`/repos/${repository}/issues`]: (url) =>
      url.searchParams.get("labels") === "blocked"
        ? json([
            issue(31, { labels: ["blocked"] }),
            issue(32, { labels: ["blocked"] }),
            issue(701, { pull: true, labels: ["blocked"] }),
          ])
        : json([
            issue(10, { labels: ["bug"] }),
            issue(11),
            issue(12, { title: "A third fictional issue" }),
            issue(700, { pull: true }),
            issue(13),
            issue(14),
            issue(15),
          ]),
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

test("a normal read maps counts, release, commit, blocked labels and recent issues", async () => {
  clearCommandCentreCache();
  const { report, calls } = await readNormal();
  commandCentreReport.parse(report);

  assert.equal(report.ok, true);
  assert.equal(report.schema, "app-composer.command-centre/1");
  assert.equal(report.selected, repository);
  assert.equal(report.cached, false);
  assert.equal(report.cacheSeconds, 720, "public reads use the long window");
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
  assert.equal(report.repo.commit.state, "ok");
  assert.equal(report.repo.commit.latest.sha, "a".repeat(40));
  assert.equal(report.repo.release.latest.publishedAt, "2026-11-15T22:10:00Z");
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
  assert.equal(report.repo.complete, true);
  assert.equal(report.rateLimit.limit, null);

  // One page of each list, no pagination: six bounded reads plus one blocked
  // label count for this fixture.
  assert.equal(calls.length, 7);
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
    7,
    "six bounded reads plus one blocked label count",
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
    [`/repos/${repository}/releases/latest`]: limited,
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
  assert.equal(report.repo.commit.state, "unknown");
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
  responses[`/repos/${repository}/releases/latest`] = () =>
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
  assert.equal(report.repo.complete, false);
});

test("a missing release is known to be absent, unlike a failed read", async () => {
  clearCommandCentreCache();
  const responses = baseResponses();
  responses[`/repos/${repository}/releases/latest`] = () =>
    json({ message: "Not Found" }, { status: 404 });
  const fixture = fixtureFetch(responses);
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixture.fetch,
  });
  commandCentreReport.parse(report);
  assert.equal(report.repo.release.state, "ok");
  assert.equal(report.repo.release.latest, null);
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
    6,
    "a repository read without blocked labels is six requests",
  );
});

test("contract helpers keep pull requests and missing counts honest", () => {
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

async function loadBoard(t) {
  mkdirSync(join(root, ".private"), { recursive: true });
  const directory = mkdtempSync(join(root, ".private/command-centre-ui-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = readFileSync(
    join(root, "src/plugins/command-centre-page.tsx"),
    "utf8",
  )
    .replace('import "./command-centre-page.css";', "")
    .replace(
      'from "../lib/command-centre-contract"',
      `from ${JSON.stringify(
        pathToFileURL(join(root, "src/lib/command-centre-contract.ts")).href,
      )}`,
    );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const target = join(directory, "page.mjs");
  writeFileSync(target, compiled.outputText);
  return import(pathToFileURL(target).href);
}

function renderBoard(board, report) {
  return renderToStaticMarkup(React.createElement(board, { report }));
}

test("the page request sends X-EmDash-Request and unwraps the data envelope", async (t) => {
  clearCommandCentreCache();
  const { report } = await readNormal();
  const { loadCommandCentre } = await loadBoard(t);
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

test("the board renders real counts, release, commit and an empty state", async (t) => {
  clearCommandCentreCache();
  const { report } = await readNormal();
  const board = (await loadBoard(t)).CommandCentreBoard;

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
  responses[`/repos/${repository}/issues`] = () => json([]);
  responses[`/repos/${repository}/labels`] = () => json([{ name: "bug" }]);
  const empty = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch: fixtureFetch(responses).fetch,
  });
  const emptyHtml = renderBoard(board, empty);
  assert.match(emptyHtml, /No open issues\./);
  assert.match(
    emptyHtml,
    /None — this repository defines no blocked or needs-attention label/,
  );
  assert.doesNotMatch(emptyHtml, /0 open issues/);
  assert.match(emptyHtml, /issue chooser on GitHub/);
  assert.doesNotMatch(emptyHtml, /cc-issues/);
});

test("unknown states are never rendered as zero or an empty list", async (t) => {
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
    [`/repos/${repository}/releases/latest`]: limited,
    [`/repos/${repository}/issues`]: limited,
  }).fetch;
  const report = await readCommandCentre({
    repository,
    now: checkedNow,
    fetch,
  });
  const board = (await loadBoard(t)).CommandCentreBoard;
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
  assert.doesNotMatch(html, /No published release/);
  assert.doesNotMatch(html, /No commit reported/);
});

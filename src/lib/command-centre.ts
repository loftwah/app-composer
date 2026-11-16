// Read-only command centre source adapter (#658).
//
// This module performs one bounded read per allowlisted public repository and
// caches it in the current Worker instance. A credentialed read uses a 55-second
// window; an unauthenticated read uses 15 minutes so the public 60-request
// hourly quota survives ordinary page loads. It never writes to GitHub, never
// creates an issue, never starts a deployment and never turns an unconfirmed
// section into a zero. A partial failure is returned per section so the page can
// say "unknown" with a reason instead of implying an empty queue.
//
// Reads per repository: metadata, one page of open pull requests, labels,
// releases, open issues and closed issues run in parallel (six), then one commit
// read when the repository metadata is confirmed, plus at most four blocked-label
// counts. Review and check state costs three reads per pull request, so it is
// read for the two most recently updated pull requests only. An opt-in live
// identity read hits the repository's own public build.json, which is not
// GitHub and does not spend the GitHub quota. That is at most 17 requests, never
// an unbounded query.
import { PluginRouteError } from "emdash";
import { isCreatorRole } from "./creator-access.ts";
import {
  blockedLabelNames,
  commandCentreCacheSeconds,
  commandCentreLabelLimit,
  commandCentreProbedPullRequestLimit,
  commandCentrePublicCacheSeconds,
  commandCentrePullRequestLimit,
  commandCentreReleaseLimit,
  commandCentreReport,
  commandCentreSchema,
  combineCheckState,
  githubCheckRunList,
  githubCombinedStatus,
  githubCommitList,
  githubIssueList,
  githubLabelList,
  githubPullDetailList,
  githubPullList,
  githubReleaseList,
  githubRepository,
  githubReviewList,
  liveIdentityPayload,
  mapCommit,
  mapForecastIssue,
  mapHistorySection,
  mapPlanSection,
  mapPullRequestBase,
  mapRecentIssues,
  mapRecentReleases,
  mapRelease,
  mapReviewDecision,
  openIssueCount,
  pullRequestCountFromList,
  utcClock,
  type CommandCentreBlockedSection,
  type CommandCentreCommitSection,
  type CommandCentrePullRequestItem,
  type CommandCentreRepo,
  type CommandCentreReport,
  type CommandCentreUnknownSection,
  type GithubPull,
} from "./command-centre-contract.ts";
import { deriveForecast } from "./command-centre-forecast.ts";

const api = "https://api.github.com";
const userAgent =
  "AppComposer-CommandCentre/2.0 (+https://composer.loftwah.com)";
const requestTimeoutMs = 8_000;
const maximumRepositories = 10;

// Public, active first-party repositories. `loftwah/club` is archived and
// `loftwah/card-collector-bot` is outside the default three so the unauthenticated
// public quota is not spent on every project. Composer Media Studio is the
// sibling app; Liferaft is the maintained portfolio app in the 16 November 2026
// inventory.
//
// `live` is an explicit opt-in: only repositories that publish a public
// build.json are listed, and the exact URL is recorded with every reading. Its
// absence is a named state, never an implication that nothing is deployed.
export const commandCentreRepositories = [
  {
    repository: "loftwah/app-composer",
    label: "App Composer",
    live: { url: "https://composer.loftwah.com/build.json" },
  },
  {
    repository: "loftwah/composer-media-studio",
    label: "Composer Media Studio",
    live: { url: "https://media.loftwah.com/build.json" },
  },
  { repository: "loftwah/liferaft", label: "Liferaft" },
] as const;

const source = { id: "github", label: "GitHub" } as const;

const limits = [
  "Read-only public source state. This view never writes, approves, merges, deploys or creates an issue.",
  "Issue state, pull-request and review state, and live release identity are three different facts. None is inferred from another.",
  "Counts come from the source's own open total and one bounded page of items; a section that could not be confirmed stays unknown and is never shown as zero.",
  "Review and check state is read for the two most recently updated open pull requests; the rest say so instead of looking clean.",
  "A live identity is read only where a repository publishes a public build.json. It is deployment evidence, not proof that a closure shipped.",
  "Projects V2 is served through GraphQL and a project-scoped credential. No board, field or item is inferred from issues or pull requests.",
  "Closed issues come from one page of 100 and are never presented as a live deployment.",
  "A read is cached for 55 seconds with a credential, or 15 minutes without one, and an exhausted quota is reported as unknown with its reset time.",
];

interface Runtime {
  // Present on the shared plugin environment; not read by this route.
  DB?: unknown;
  GITHUB_TOKEN?: unknown;
}

interface Context {
  user?: { id: string; name?: string | null; role: number };
  request: Request;
  input: unknown;
}

interface RateLimit {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
}

interface CachedRepository {
  storedAt: number;
  ttlSeconds: number;
  repo: CommandCentreRepo;
  rateLimit: RateLimit;
}

type GetResult =
  | {
      ok: true;
      data: unknown;
      status: number;
      link: string | null;
      // Classic personal access tokens report granted scopes on every
      // response. Fine-grained tokens do not, which is itself a readable state.
      scopes: string | null;
    }
  | { ok: false; status: number | null; reason: string };

type Parsed<T> = { ok: true; data: T } | { ok: false; reason: string };

// The in-memory cache is keyed by repository only. It holds at most ten entries
// (the same bound as the allowlist) and contains public data, never a token.
const cache = new Map<string, CachedRepository>();

export function clearCommandCentreCache() {
  cache.clear();
}

function headerNumber(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function noteRateLimit(rate: RateLimit, headers: Headers) {
  const limit = headerNumber(headers, "x-ratelimit-limit");
  const remaining = headerNumber(headers, "x-ratelimit-remaining");
  const reset = headerNumber(headers, "x-ratelimit-reset");
  if (limit !== null) rate.limit = limit;
  // Calls run concurrently, so keep the lowest remaining value observed.
  if (
    remaining !== null &&
    (rate.remaining === null || remaining < rate.remaining)
  )
    rate.remaining = remaining;
  if (reset !== null) {
    const date = new Date(reset * 1000);
    if (!Number.isNaN(date.getTime())) rate.resetAt = date.toISOString();
  }
}

function rateReason(rate: RateLimit): string {
  return rate.resetAt
    ? `GitHub's public rate limit is exhausted. It resets at ${utcClock(
        rate.resetAt,
      )} UTC.`
    : "GitHub's public rate limit is exhausted.";
}

async function githubGet(
  fetcher: typeof fetch,
  path: string,
  token: string | null,
  rate: RateLimit,
): Promise<GetResult> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": userAgent,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetcher(api + path, {
      headers,
      signal:
        typeof AbortSignal.timeout === "function"
          ? AbortSignal.timeout(requestTimeoutMs)
          : undefined,
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      status: null,
      reason: timedOut
        ? `GitHub did not answer within ${requestTimeoutMs / 1000} seconds.`
        : "The request to GitHub failed before a response arrived.",
    };
  }
  noteRateLimit(rate, response.headers);
  const link = response.headers.get("link");
  const scopes = response.headers.get("x-oauth-scopes");
  if (!response.ok) {
    if (response.status === 404)
      return {
        ok: false,
        status: 404,
        reason: "GitHub answered 404 for this resource.",
      };
    if (
      response.status === 429 ||
      (response.status === 403 && rate.remaining === 0)
    )
      return { ok: false, status: response.status, reason: rateReason(rate) };
    if (response.status === 403 && response.headers.has("retry-after"))
      return {
        ok: false,
        status: response.status,
        reason:
          "GitHub asked this view to slow down; the retry wait has not elapsed.",
      };
    if (response.status === 401)
      return {
        ok: false,
        status: 401,
        reason: "GitHub refused the configured credential (401).",
      };
    if (response.status === 403)
      return {
        ok: false,
        status: 403,
        reason: "GitHub refused this read (403).",
      };
    return {
      ok: false,
      status: response.status,
      reason: `GitHub answered HTTP ${response.status}.`,
    };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      status: response.status,
      reason: "GitHub returned a response that was not JSON.",
    };
  }
  return { ok: true, data, status: response.status, link, scopes };
}

function parseGithub<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
  result: GetResult,
): Parsed<T> {
  if (!result.ok) return { ok: false, reason: result.reason };
  const parsed = schema.safeParse(result.data);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        reason: "GitHub returned an unexpected response shape.",
      };
}

const unknown = (reason: string): CommandCentreUnknownSection => ({
  state: "unknown",
  reason,
});

function readToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length >= 8 && token.length <= 500 ? token : null;
}

function githubLinks(repository: string) {
  const base = `https://github.com/${repository}`;
  return {
    issues: `${base}/issues`,
    pullRequests: `${base}/pulls`,
    newIssue: `${base}/issues/new/choose`,
  };
}

// ---------------------------------------------------------------------------
// Live build identity. An opt-in, per-repository public build.json read. This is
// a second release-evidence source, kept separate from issues and pull
// requests: it states what the deployment says it was built from.
// ---------------------------------------------------------------------------

const liveIdentityUserAgent =
  "AppComposer-CommandCentre/3.0 (+https://composer.loftwah.com)";
const liveIdentityMaximumBytes = 4_096;

type RepositoryEntry = (typeof commandCentreRepositories)[number];

function liveIdentityNotConfigured(): CommandCentreRepo["liveIdentity"] {
  return {
    state: "not-configured",
    reason:
      "No live identity source is registered for this repository in this view. That is not a claim that nothing is deployed.",
  };
}

function readLiveIdentity(
  fetcher: typeof fetch,
  entry: RepositoryEntry,
  defaultBranchCommit: string | null,
  now: number,
): Promise<CommandCentreRepo["liveIdentity"]> {
  if (!("live" in entry) || !entry.live)
    return Promise.resolve(liveIdentityNotConfigured());
  const url = entry.live.url;
  if (!url.startsWith("https://"))
    return Promise.resolve(
      unknown(`The registered live identity source is not HTTPS: ${url}.`),
    );
  const fetchedAt = new Date(now).toISOString();
  return (async () => {
    let response: Response;
    try {
      response = await fetcher(url, {
        // A redirect would leave the registered source; refuse it outright.
        redirect: "error",
        headers: {
          Accept: "application/json",
          "User-Agent": liveIdentityUserAgent,
        },
        signal:
          typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(requestTimeoutMs)
            : undefined,
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      return unknown(
        timedOut
          ? `The live identity source at ${url} did not answer within ${requestTimeoutMs / 1000} seconds.`
          : `The live identity source at ${url} could not be reached.`,
      );
    }
    if (!response.ok)
      return unknown(
        `The live identity source at ${url} answered HTTP ${response.status}; no revision is shown.`,
      );
    let text: string;
    try {
      text = await response.text();
    } catch {
      return unknown(
        `The live identity source at ${url} closed before its body was read.`,
      );
    }
    if (text.length > liveIdentityMaximumBytes)
      return unknown(
        `The live identity source at ${url} returned more than ${liveIdentityMaximumBytes} bytes; it was not trusted.`,
      );
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return unknown(
        `The live identity source at ${url} did not return JSON.`,
      );
    }
    const parsed = liveIdentityPayload.safeParse(payload);
    if (!parsed.success)
      return unknown(
        `The live identity source at ${url} did not return a readable identity.`,
      );
    const revision = parsed.data.revision ?? parsed.data.commit;
    if (!revision)
      return unknown(
        `The live identity source at ${url} carried no 40-character revision.`,
      );
    const builtAt =
      parsed.data.builtAt && !Number.isNaN(Date.parse(parsed.data.builtAt))
        ? new Date(parsed.data.builtAt).toISOString()
        : null;
    return {
      state: "ok" as const,
      url,
      fetchedAt,
      revision,
      app: parsed.data.app ?? null,
      builtAt,
      defaultBranchCommit,
      matchesDefaultBranch:
        defaultBranchCommit === null ? null : revision === defaultBranchCommit,
    };
  })();
}

// ---------------------------------------------------------------------------
// Projects V2 availability. GitHub exposes Projects V2 through GraphQL and a
// project-scoped credential; there is no REST endpoint this view could read. The
// probe therefore reports what the current credential can do and never infers a
// board from issues or pull requests.
// ---------------------------------------------------------------------------

function readScopes(raw: string | null): string[] {
  if (!raw) return [];
  const scopes = new Set<string>();
  for (const part of raw.split(",")) {
    const scope = part.trim();
    if (/^[A-Za-z0-9:_-]{1,40}$/.test(scope)) scopes.add(scope);
    if (scopes.size >= 8) break;
  }
  return [...scopes];
}

function projectsAvailability(
  metadata: GetResult,
  token: string | null,
): CommandCentreRepo["projects"] {
  if (!token)
    return {
      state: "unavailable",
      reason:
        "No GitHub credential is configured, so Projects V2 cannot be read. No project board is inferred from issues or pull requests.",
    };
  if (!metadata.ok)
    return {
      state: "unavailable",
      reason:
        "The repository metadata read failed, so the credential's project access could not be probed. No project board is inferred.",
    };
  const scopes = readScopes(metadata.scopes);
  if (scopes.length === 0)
    return {
      state: "unavailable",
      reason:
        "The configured credential reported no token scopes, so Projects V2 access cannot be confirmed. No project board is inferred.",
    };
  if (scopes.some((scope) => scope === "project" || scope === "read:project"))
    return {
      state: "credential-capable",
      reason:
        "The credential reports a project scope. This view still does not read a Projects V2 board: GitHub serves it through GraphQL, so no board, field or item is inferred here.",
    };
  return {
    state: "unavailable",
    reason: `The credential reports the scopes ${scopes.join(", ")}; no project scope is reported, so Projects V2 is unavailable. No project board is inferred.`,
  };
}

async function readBlockedLabelCount(
  fetcher: typeof fetch,
  repository: string,
  label: string,
  token: string | null,
  rate: RateLimit,
): Promise<Parsed<number>> {
  const result = await githubGet(
    fetcher,
    `/repos/${repository}/issues?state=open&labels=${encodeURIComponent(
      label,
    )}&per_page=100`,
    token,
    rate,
  );
  const parsed = parseGithub(githubIssueList, result);
  if (!parsed.ok) return parsed;
  if (result.ok && (result.link || parsed.data.length >= 100))
    return {
      ok: false,
      reason: `More than 100 open items carry the "${label}" label; this view reads one page.`,
    };
  return {
    ok: true,
    data: parsed.data.filter((issue) => !issue.pull_request).length,
  };
}

// Review and check state for one open pull request. Each read is separate so a
// review failure never makes a check look clean, and a check failure never
// makes a review look approved.
async function readPullState(
  fetcher: typeof fetch,
  repository: string,
  token: string | null,
  rate: RateLimit,
  pull: GithubPull,
): Promise<{
  review: CommandCentrePullRequestItem["review"];
  checks: CommandCentrePullRequestItem["checks"];
}> {
  const headSha = pull.head.sha;
  const [reviewResult, checksResult, statusResult] = await Promise.all([
    githubGet(
      fetcher,
      `/repos/${repository}/pulls/${pull.number}/reviews?per_page=100`,
      token,
      rate,
    ),
    githubGet(
      fetcher,
      `/repos/${repository}/commits/${headSha}/check-runs?per_page=100`,
      token,
      rate,
    ),
    githubGet(
      fetcher,
      `/repos/${repository}/commits/${headSha}/status`,
      token,
      rate,
    ),
  ]);
  const reviews = parseGithub(githubReviewList, reviewResult);
  const runs = parseGithub(githubCheckRunList, checksResult);
  const status = parseGithub(githubCombinedStatus, statusResult);

  let review: CommandCentrePullRequestItem["review"];
  if (!reviews.ok) review = unknown(reviews.reason);
  else
    review = {
      state: "ok",
      ...mapReviewDecision(
        reviews.data.map((entry) => ({
          state: entry.state,
          login: entry.user?.login ?? null,
          submittedAt: entry.submitted_at ?? null,
        })),
        (pull.requested_reviewers ?? []).map((reviewer) => reviewer.login),
      ),
    };

  let checks: CommandCentrePullRequestItem["checks"];
  if (!runs.ok) checks = unknown(runs.reason);
  else if (!status.ok) checks = unknown(status.reason);
  else
    checks = {
      state: "ok",
      ...combineCheckState({
        legacy: {
          state: status.data.state,
          total: status.data.total_count,
        },
        runs: runs.data.check_runs.map((run) => ({
          status: run.status,
          conclusion: run.conclusion,
          headSha: run.head_sha ?? null,
        })),
        runTotal: runs.data.total_count,
        headSha,
      }),
    };
  return { review, checks };
}

async function readOpenPullRequests(input: {
  fetcher: typeof fetch;
  repository: string;
  token: string | null;
  rate: RateLimit;
  pullResult: GetResult;
  detail: Parsed<GithubPull[]>;
}): Promise<CommandCentreRepo["openPullRequests"]> {
  if (!input.detail.ok) return unknown(input.detail.reason);
  const sorted = [...input.detail.data].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
  const items = sorted.slice(0, commandCentrePullRequestLimit);
  const probed = items.slice(0, commandCentreProbedPullRequestLimit);
  const probedStates = await Promise.all(
    probed.map((pull) =>
      readPullState(
        input.fetcher,
        input.repository,
        input.token,
        input.rate,
        pull,
      ),
    ),
  );
  const notRead = `Not read: review and check state is read for the ${commandCentreProbedPullRequestLimit} most recently updated open pull requests.`;
  return {
    state: "ok",
    scanned: input.detail.data.length,
    complete: !(input.pullResult.ok && input.pullResult.link !== null),
    items: items.map((pull, index): CommandCentrePullRequestItem => {
      const state = probedStates[index];
      return {
        ...mapPullRequestBase(pull),
        review: state?.review ?? unknown(notRead),
        checks: state?.checks ?? unknown(notRead),
      };
    }),
  };
}

async function readRepository(
  fetcher: typeof fetch,
  repository: string,
  token: string | null,
  now: number,
): Promise<{ repo: CommandCentreRepo; rateLimit: RateLimit }> {
  const checkedAt = new Date(now).toISOString();
  const rate: RateLimit = { limit: null, remaining: null, resetAt: null };

  const [
    metadataResult,
    pullResult,
    labelResult,
    releaseResult,
    recentResult,
    closedResult,
  ] = await Promise.all([
    githubGet(fetcher, `/repos/${repository}`, token, rate),
    // One bounded page of open pull requests. It carries both the confirmed
    // count (through the Link header) and the detail rows, so a repository with
    // no open issues and two open pull requests is described accurately.
    githubGet(
      fetcher,
      `/repos/${repository}/pulls?state=open&sort=updated&direction=desc&per_page=100`,
      token,
      rate,
    ),
    githubGet(
      fetcher,
      `/repos/${repository}/labels?per_page=100`,
      token,
      rate,
    ),
    githubGet(
      fetcher,
      `/repos/${repository}/releases?per_page=${commandCentreReleaseLimit}`,
      token,
      rate,
    ),
    githubGet(
      fetcher,
      `/repos/${repository}/issues?state=open&sort=updated&direction=desc&per_page=100`,
      token,
      rate,
    ),
    githubGet(
      fetcher,
      `/repos/${repository}/issues?state=closed&sort=updated&direction=desc&per_page=100`,
      token,
      rate,
    ),
  ]);

  const metadata = parseGithub(githubRepository, metadataResult);
  const pulls = parseGithub(githubPullList, pullResult);
  const pullDetail = parseGithub(githubPullDetailList, pullResult);
  const labels = parseGithub(githubLabelList, labelResult);
  const releases = parseGithub(githubReleaseList, releaseResult);
  const recent = parseGithub(githubIssueList, recentResult);
  const closed = parseGithub(githubIssueList, closedResult);

  const url = metadata.ok
    ? metadata.data.html_url
    : `https://github.com/${repository}`;

  // Open issue count: GitHub's open item count includes pull requests. A
  // confirmed pull request count allows the split. Otherwise it stays unknown.
  let pullCount: number | null = null;
  let issueCount: CommandCentreRepo["issues"]["count"];
  if (!pulls.ok) issueCount = unknown(pulls.reason);
  else {
    pullCount = pullRequestCountFromList(
      pullResult.ok ? pullResult.link : null,
      pulls.data,
    );
    if (!metadata.ok) issueCount = unknown(metadata.reason);
    else if (pullCount === null)
      issueCount = unknown(
        "GitHub did not report the open pull request count in a readable form.",
      );
    else {
      const value = openIssueCount(metadata.data.open_issues_count, pullCount);
      issueCount =
        value === null
          ? unknown(
              "GitHub's open item count is smaller than its open pull request count.",
            )
          : { state: "ok", value };
    }
  }

  const pullRequests: CommandCentreRepo["pullRequests"] = pulls.ok
    ? pullCount === null
      ? unknown(
          "GitHub did not report the open pull request count in a readable form.",
        )
      : { state: "ok", value: pullCount }
    : unknown(pulls.reason);

  const openPullRequests = await readOpenPullRequests({
    fetcher,
    repository,
    token,
    rate,
    pullResult,
    detail: pullDetail,
  });

  const recentIssues: CommandCentreRepo["issues"]["recent"] = recent.ok
    ? { state: "ok", ...mapRecentIssues(recent.data) }
    : unknown(recent.reason);

  const openIssueItems = recent.ok
    ? recent.data.filter((issue) => !issue.pull_request)
    : null;
  const openSampleComplete =
    issueCount.state === "ok" && openIssueItems !== null
      ? issueCount.value === openIssueItems.length
      : false;

  const plan: CommandCentreRepo["plan"] = recent.ok
    ? mapPlanSection(recent.data, repository, openSampleComplete)
    : unknown(recent.reason);

  const history: CommandCentreRepo["history"] = closed.ok
    ? mapHistorySection(
        closed.data,
        !(closedResult.ok && closedResult.link !== null),
      )
    : unknown(closed.reason);

  const releasesSection: CommandCentreRepo["releases"] = releases.ok
    ? { state: "ok", items: mapRecentReleases(releases.data, repository) }
    : unknown(releases.reason);

  let release: CommandCentreRepo["release"];
  if (!releases.ok) release = unknown(releases.reason);
  else {
    const latest = releases.data.find((entry) => entry.draft !== true);
    release = {
      state: "ok",
      latest: latest ? mapRelease(latest) : null,
    };
  }

  let blocked: CommandCentreRepo["blocked"];
  if (!labels.ok) blocked = unknown(labels.reason);
  else {
    const names = blockedLabelNames(labels.data);
    if (names.length === 0) {
      blocked =
        labels.data.length >= commandCentreLabelLimit
          ? unknown(
              "This repository returned 100 labels; this view reads one page and cannot confirm no blocked label exists.",
            )
          : ({
              state: "ok",
              labels: [],
              count: null,
            } satisfies CommandCentreBlockedSection);
    } else {
      const counts = await Promise.all(
        names.map((name) =>
          readBlockedLabelCount(fetcher, repository, name, token, rate),
        ),
      );
      const failed = counts.find((count) => !count.ok);
      blocked =
        failed && !failed.ok
          ? unknown(failed.reason)
          : ({
              state: "ok",
              labels: names.map((name, index) => ({
                name,
                count: (counts[index] as { ok: true; data: number }).data,
              })),
              count: counts.reduce(
                (total, count) => total + (count.ok ? count.data : 0),
                0,
              ),
            } satisfies CommandCentreBlockedSection);
    }
  }

  let commit: CommandCentreRepo["commit"];
  if (!metadata.ok) commit = unknown(metadata.reason);
  else {
    const result = await githubGet(
      fetcher,
      `/repos/${repository}/commits?sha=${encodeURIComponent(
        metadata.data.default_branch,
      )}&per_page=1`,
      token,
      rate,
    );
    const parsed = parseGithub(githubCommitList, result);
    commit = parsed.ok
      ? ({
          state: "ok",
          latest: parsed.data[0] ? mapCommit(parsed.data[0]) : null,
        } satisfies CommandCentreCommitSection)
      : unknown(parsed.reason);
  }

  // The live identity read compares the published build against the confirmed
  // default-branch commit. It is a separate fact from issue and pull-request
  // state, and it is skipped entirely when the commit is unknown.
  const entry =
    commandCentreRepositories.find(
      (candidate) => candidate.repository === repository,
    ) ?? commandCentreRepositories[0];
  const liveIdentity = await readLiveIdentity(
    fetcher,
    entry,
    commit.state === "ok" ? (commit.latest?.sha ?? null) : null,
    now,
  );
  const projects = projectsAvailability(metadataResult, token);

  const closedPageComplete = closed.ok
    ? !(closedResult.ok && closedResult.link !== null)
    : null;  const forecast = deriveForecast({
    observedAt: checkedAt,
    open:
      issueCount.state === "ok"
        ? {
            count: issueCount.value,
            sampled: openIssueItems?.length ?? null,
            complete:
              openIssueItems === null ? null : openSampleComplete,
          }
        : null,
    openItems: openIssueItems
      ? openIssueItems.map(mapForecastIssue)
      : null,
    closedItems: closed.ok
      ? closed.data
          .filter((issue) => !issue.pull_request)
          .map(mapForecastIssue)
      : null,
    closedPageComplete,
    oldestUpdatedAt:
      closed.ok && closed.data.length
        ? (closed.data[closed.data.length - 1]?.updated_at ?? null)
        : null,
  });

  const complete =
    metadata.ok &&
    issueCount.state === "ok" &&
    recentIssues.state === "ok" &&
    pullRequests.state === "ok" &&
    openPullRequests.state === "ok" &&
    blocked.state === "ok" &&
    release.state === "ok" &&
    releasesSection.state === "ok" &&
    liveIdentity.state !== "unknown" &&
    commit.state === "ok" &&
    plan.state === "ok" &&
    history.state === "ok";

  const repo: CommandCentreRepo = {
    repository,
    url,
    links: githubLinks(repository),
    checkedAt,
    archived: metadata.ok ? metadata.data.archived : null,
    defaultBranch: metadata.ok ? metadata.data.default_branch : null,
    issues: { count: issueCount, recent: recentIssues },
    pullRequests,
    openPullRequests,
    blocked,
    release,
    releases: releasesSection,
    liveIdentity,
    projects,
    commit,
    plan,
    history,
    forecast,
    complete,
  };
  return { repo, rateLimit: rate };
}

export interface ReadCommandCentreOptions {
  repository: string;
  token?: string | null;
  now?: number;
  fetch?: typeof fetch;
}

export async function readCommandCentre(
  options: ReadCommandCentreOptions,
): Promise<CommandCentreReport> {
  const repository = options.repository;
  const allowed = commandCentreRepositories.some(
    (entry) => entry.repository === repository,
  );
  if (!allowed)
    throw new Error("Repository is not in the command centre allowlist.");
  const now = options.now ?? Date.now();
  const fetcher = options.fetch ?? fetch;
  const token = readToken(options.token ?? null);
  const cacheSeconds = token
    ? commandCentreCacheSeconds
    : commandCentrePublicCacheSeconds;

  const base = {
    ok: true as const,
    schema: commandCentreSchema,
    source,
    selected: repository,
    repositories: commandCentreRepositories.map((entry) => ({
      repository: entry.repository,
      label: entry.label,
    })),
    limits,
  };

  const cached = cache.get(repository);
  // Do not serve a long public-window result after a credential appears, or a
  // short credentialed result after it is removed. The TTL mode must match.
  if (
    cached &&
    cached.ttlSeconds === cacheSeconds &&
    now - cached.storedAt <= cacheSeconds * 1000
  ) {
    return commandCentreReport.parse({
      ...base,
      fetchedAt: cached.repo.checkedAt,
      cached: true,
      cacheSeconds,
      cacheAgeSeconds: Math.max(
        0,
        Math.min(cacheSeconds, Math.floor((now - cached.storedAt) / 1000)),
      ),
      rateLimit: cached.rateLimit,
      repo: cached.repo,
    });
  }

  const { repo, rateLimit } = await readRepository(
    fetcher,
    repository,
    token,
    now,
  );
  cache.set(repository, {
    storedAt: now,
    ttlSeconds: cacheSeconds,
    repo,
    rateLimit,
  });
  while (cache.size > maximumRepositories) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return commandCentreReport.parse({
    ...base,
    fetchedAt: repo.checkedAt,
    cached: false,
    cacheSeconds,
    cacheAgeSeconds: 0,
    rateLimit,
    repo,
  });
}

function reject(code: string, message: string, status: number): never {
  throw new PluginRouteError(code, message, status);
}

export async function manageCommandCentre(
  ctx: Context,
  runtime: Runtime,
  fetcher: typeof fetch = fetch,
) {
  if (!ctx.user?.id || !isCreatorRole(ctx.user.role))
    return reject(
      "FORBIDDEN",
      "The command centre requires a signed-in Composer creator.",
      403,
    );
  if (ctx.request.method !== "GET")
    return reject("METHOD_NOT_ALLOWED", "This view is read-only.", 405);
  const url = new URL(ctx.request.url);
  const origin = ctx.request.headers.get("Origin");
  if (origin !== null && origin !== url.origin)
    return reject(
      "FORBIDDEN",
      "Open this view from Composer administration.",
      403,
    );

  const input =
    ctx.input && typeof ctx.input === "object" && !Array.isArray(ctx.input)
      ? (ctx.input as Record<string, unknown>)
      : {};
  const extra = Object.keys(input).filter((key) => key !== "repo");
  if (extra.length)
    return reject(
      "INVALID",
      "This view accepts only a repository selection.",
      400,
    );
  const requested =
    input.repo === undefined
      ? commandCentreRepositories[0].repository
      : input.repo;
  if (
    typeof requested !== "string" ||
    !commandCentreRepositories.some((entry) => entry.repository === requested)
  )
    return reject(
      "INVALID",
      "Choose one of the allowlisted Composer repositories.",
      400,
    );

  try {
    // Return the plain report object, not a raw Response. EmDash wraps plain
    // plugin route results as `{ success: true, data: report }`; returning a
    // Response would serialize it as an empty `data: {}` for the admin page.
    return await readCommandCentre({
      repository: requested,
      token: readToken(runtime.GITHUB_TOKEN),
      fetch: fetcher,
    });
  } catch {
    return reject(
      "UNAVAILABLE",
      "The command centre could not confirm a valid source reading. Nothing is shown as complete.",
      503,
    );
  }
}

// Read-only command centre source adapter (#658).
//
// This module performs one bounded read per allowlisted public repository and
// caches it in the current Worker instance. A credentialed read uses a 55-second
// window; an unauthenticated read uses 12 minutes so the public 60-request
// hourly quota survives ordinary page loads. It never writes to GitHub, never
// creates an issue, never starts a deployment and never turns an unconfirmed
// section into a zero. A partial failure is returned per section so the page can
// say "unknown" with a reason instead of implying an empty queue.
//
// Reads per repository: metadata, open pull requests, labels, releases, open
// issues and closed issues run in parallel (six), then one commit read when the
// repository metadata is confirmed, plus at most four blocked-label counts.
// That is eleven bounded requests at the maximum, never an unbounded query.
import { PluginRouteError } from "emdash";
import { isCreatorRole } from "./creator-access.ts";
import {
  blockedLabelNames,
  commandCentreCacheSeconds,
  commandCentreLabelLimit,
  commandCentrePublicCacheSeconds,
  commandCentreReleaseLimit,
  commandCentreReport,
  commandCentreSchema,
  githubCommitList,
  githubIssueList,
  githubLabelList,
  githubPullList,
  githubReleaseList,
  githubRepository,
  mapCommit,
  mapForecastIssue,
  mapHistorySection,
  mapPlanSection,
  mapRecentIssues,
  mapRecentReleases,
  mapRelease,
  openIssueCount,
  pullRequestCountFromPage,
  utcClock,
  type CommandCentreBlockedSection,
  type CommandCentreCommitSection,
  type CommandCentreRepo,
  type CommandCentreReport,
  type CommandCentreUnknownSection,
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
export const commandCentreRepositories = [
  { repository: "loftwah/app-composer", label: "App Composer" },
  {
    repository: "loftwah/composer-media-studio",
    label: "Composer Media Studio",
  },
  { repository: "loftwah/liferaft", label: "Liferaft" },
] as const;

const source = { id: "github", label: "GitHub" } as const;

const limits = [
  "Read-only public source state. This view never writes, approves, deploys or creates an issue.",
  "Counts come from the source's own open total and one page of items; at most 11 bounded responses are read, never a second page.",
  "A section that could not be confirmed stays unknown and is never shown as zero or an empty list.",
  "Closed issues come from one page of 100. A closure is not evidence of a live deployment.",
  "Forecasts are derived from confirmed closure dates and the current backlog; they are not commitments or SLAs.",
  "Plan relationships come only from explicit issue-body references and URLs; native sub-issue fields and pull-request state are not read.",
  "A read is cached for 55 seconds with a credential, or 12 minutes without one, so the public quota survives normal page loads.",
  "Only a signed-in Composer creator can open this view.",
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
  | { ok: true; data: unknown; status: number; link: string | null }
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
  return { ok: true, data, status: response.status, link };
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
    githubGet(
      fetcher,
      `/repos/${repository}/pulls?state=open&per_page=1`,
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
  const labels = parseGithub(githubLabelList, labelResult);
  const releases = parseGithub(githubReleaseList, releaseResult);
  const recent = parseGithub(githubIssueList, recentResult);
  const closed = parseGithub(githubIssueList, closedResult);

  const url = metadata.ok
    ? metadata.data.html_url
    : `https://github.com/${repository}`;

  // Open issue count: GitHub's open item count includes pull requests. A
  // confirmed pull request count allows the split. Otherwise it stays unknown.
  let issueCount: CommandCentreRepo["issues"]["count"];
  if (!metadata.ok) issueCount = unknown(metadata.reason);
  else if (!pulls.ok) issueCount = unknown(pulls.reason);
  else {
    const pullCount = pullRequestCountFromPage(
      pullResult.ok ? pullResult.link : null,
      pulls.data,
    );
    if (pullCount === null)
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
    ? (() => {
        const value = pullRequestCountFromPage(
          pullResult.ok ? pullResult.link : null,
          pulls.data,
        );
        return value === null
          ? unknown(
              "GitHub did not report the open pull request count in a readable form.",
            )
          : { state: "ok", value };
      })()
    : unknown(pulls.reason);

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

  const closedPageComplete = closed.ok
    ? !(closedResult.ok && closedResult.link !== null)
    : null;
  const forecast = deriveForecast({
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
    blocked.state === "ok" &&
    release.state === "ok" &&
    releasesSection.state === "ok" &&
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
    blocked,
    release,
    releases: releasesSection,
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

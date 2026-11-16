// Bounded, typed contract for the native command centre (#658).
//
// Source payloads are untrusted data. Every raw response is validated here
// before any count, relationship, release, commit or issue reaches the page. A
// section that cannot be confirmed is represented as `unknown`; it is never
// coerced to 0 or an empty list that would imply "nothing open".
//
// Schema 2 added closed-issue history, the Plan lens, recent releases and the
// source-neutral forecast. Schema 3 adds the open pull-request readback with
// review and check state, an optional live build identity, and an explicit
// Projects V2 availability probe. Issue state, pull-request/review state and
// live release identity are three different facts and stay in separate
// sections; none of them is derived from another. The source adapter supplies
// its own links and label; the projection and view code never assume GitHub.
import { z } from "zod";
import {
  commandCentreForecast,
  type ForecastIssue,
  type ForecastStateReason,
} from "./command-centre-forecast.ts";
export type {
  CommandCentreForecast,
  CommandCentreForecastObservations,
} from "./command-centre-forecast.ts";
import {
  hasRelationships,
  parseIssueRelationships,
  type RelationshipReference,
} from "./command-centre-relationships.ts";

export const commandCentreSchema = "app-composer.command-centre/3";
export const maximumCommandCentreRepositories = 10;
// A credentialed read can use the short window. The unauthenticated public API
// allows only 60 requests per hour, so the long window keeps a real read usable
// across ordinary page loads instead of exhausting the quota immediately.
export const commandCentreCacheSeconds = 55;
export const commandCentrePublicCacheSeconds = 15 * 60;
export const commandCentreMaximumCacheSeconds = 15 * 60;
export const commandCentreRecentIssueLimit = 5;
export const commandCentreRecentWindow = 100;
export const commandCentreHistoryLimit = 100;
export const commandCentreHistoryRecentLimit = 10;
export const commandCentrePlanLimit = 100;
export const commandCentreMilestoneLimit = 50;
export const commandCentreReleaseLimit = 10;
export const commandCentreReleaseRecentLimit = 5;
export const commandCentreLabelLimit = 100;
export const commandCentreBlockedLabelLimit = 4;
// Pull-request detail is one bounded page. Review and check state costs three
// more requests per pull request (reviews, check runs, combined status), so it
// is read for the few most recently updated pull requests only; the rest stay
// explicitly "not read".
export const commandCentrePullRequestLimit = 5;
export const commandCentreProbedPullRequestLimit = 2;
export const commandCentreReviewLimit = 100;
export const commandCentreCheckRunLimit = 100;

const instant = z.iso.datetime();
const maximumCount = 1_000_000;
const whole = z.number().int().min(0).max(maximumCount);

export const commandCentreRepositoryName = z
  .string()
  .regex(/^[A-Za-z0-9_.-]{1,80}\/[A-Za-z0-9_.-]{1,100}$/);

// The repository allowlist is declared by the server module, not by a request.
export const commandCentreRepositoryList = z
  .array(
    z
      .object({
        repository: commandCentreRepositoryName,
        label: z.string().min(1).max(80),
      })
      .strict(),
  )
  .min(1)
  .max(maximumCommandCentreRepositories);

export const commandCentreUnknownSection = z
  .object({
    state: z.literal("unknown"),
    reason: z.string().min(1).max(240),
  })
  .strict();
export type CommandCentreUnknownSection = z.infer<
  typeof commandCentreUnknownSection
>;

const countSection = z
  .object({ state: z.literal("ok"), value: whole })
  .strict();

const recentIssue = z
  .object({
    number: z.number().int().positive().max(10_000_000),
    title: z.string().min(1).max(300),
    url: z.url().max(500),
    updatedAt: instant,
    labels: z.array(z.string().min(1).max(100)).max(6),
    reopened: z.boolean(),
  })
  .strict();
export type CommandCentreRecentIssue = z.infer<typeof recentIssue>;

const recentSection = z
  .object({
    state: z.literal("ok"),
    items: z.array(recentIssue).max(commandCentreRecentIssueLimit),
    // `complete` is true when every open item was scanned, or when the first
    // five issues were already found in the bounded window. A PR-heavy window
    // that runs out before five issues is honestly incomplete.
    complete: z.boolean(),
    scanned: z.number().int().min(0).max(commandCentreRecentWindow),
  })
  .strict();

const blockedSection = z
  .object({
    state: z.literal("ok"),
    labels: z
      .array(
        z
          .object({
            name: z.string().min(1).max(100),
            count: whole,
          })
          .strict(),
      )
      .max(commandCentreBlockedLabelLimit),
    // Null only when the repository defines no blocked or needs-attention
    // label. It is not a zero-count claim about unread issues.
    count: whole.nullable(),
  })
  .strict();
export type CommandCentreBlockedSection = z.infer<typeof blockedSection>;

const releaseSection = z
  .object({
    state: z.literal("ok"),
    latest: z
      .object({
        tag: z.string().min(1).max(120),
        publishedAt: instant.nullable(),
        url: z.url().max(500),
        prerelease: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type CommandCentreReleaseSection = z.infer<typeof releaseSection>;

const commitSection = z
  .object({
    state: z.literal("ok"),
    latest: z
      .object({
        sha: z.string().regex(/^[a-f0-9]{40}$/),
        committedAt: instant,
        url: z.url().max(500),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type CommandCentreCommitSection = z.infer<typeof commitSection>;

// ---------------------------------------------------------------------------
// Plan lens: explicit relationships only. Every reference carries the evidence
// that produced it and never a pull-request state this view did not read.
// ---------------------------------------------------------------------------

const milestone = z
  .object({
    title: z.string().min(1).max(200),
    dueOn: instant.nullable(),
    url: z.url().max(500).nullable(),
  })
  .strict();

const issueReference = z
  .object({
    repository: commandCentreRepositoryName,
    number: z.number().int().positive().max(10_000_000),
    url: z.url().max(500).nullable(),
    kind: z.enum(["issue", "pull-request", "unknown"]),
    evidence: z.enum(["url", "reference"]),
    // Only a same-repository reference that also appears in the fetched open
    // sample can be resolved to a title. Everything else stays unresolved.
    title: z.string().min(1).max(300).nullable(),
  })
  .strict();
export type CommandCentreIssueReference = z.infer<typeof issueReference>;

const planItem = z
  .object({
    number: z.number().int().positive().max(10_000_000),
    title: z.string().min(1).max(300),
    url: z.url().max(500),
    updatedAt: instant,
    labels: z.array(z.string().min(1).max(100)).max(6),
    reopened: z.boolean(),
    milestone: milestone.nullable(),
    blockedByLabel: z.boolean(),
    parent: issueReference.nullable(),
    children: z.array(issueReference).max(20),
    blockers: z.array(issueReference).max(10),
    pullRequests: z.array(issueReference).max(10),
    linkState: z.enum(["found", "none", "unknown"]),
  })
  .strict();
export type CommandCentrePlanItem = z.infer<typeof planItem>;

const planSection = z
  .object({
    state: z.literal("ok"),
    scanned: z.number().int().min(0).max(commandCentreRecentWindow),
    complete: z.boolean(),
    items: z.array(planItem).max(commandCentrePlanLimit),
    milestones: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            dueOn: instant.nullable(),
            openIssues: whole,
            blockedIssues: whole,
          })
          .strict(),
      )
      .max(commandCentreMilestoneLimit),
    relationshipBasis: z.string().min(1).max(240),
  })
  .strict();
export type CommandCentrePlanSection = z.infer<typeof planSection>;

// ---------------------------------------------------------------------------
// Delivery lens: closed history, releases and the forecast.
// ---------------------------------------------------------------------------

const releaseLink = z
  .object({
    tag: z.string().min(1).max(120),
    url: z.url().max(500),
  })
  .strict();

export const commandCentreStateReason = z
  .enum(["completed", "not_planned", "duplicate", "reopened", "unknown"])
  .nullable();
export type CommandCentreStateReason = z.infer<
  typeof commandCentreStateReason
>;

const historyItem = z
  .object({
    number: z.number().int().positive().max(10_000_000),
    title: z.string().min(1).max(300),
    url: z.url().max(500),
    createdAt: instant.nullable(),
    closedAt: instant.nullable(),
    stateReason: commandCentreStateReason,
    linkedRelease: releaseLink.nullable(),
    milestone: z.string().min(1).max(200).nullable(),
  })
  .strict();
export type CommandCentreHistoryItem = z.infer<typeof historyItem>;

const historySection = z
  .object({
    state: z.literal("ok"),
    scanned: z.number().int().min(0).max(commandCentreRecentWindow),
    closed: z.number().int().min(0).max(commandCentreRecentWindow),
    complete: z.boolean(),
    oldestUpdatedAt: instant.nullable(),
    recent: z.array(historyItem).max(commandCentreHistoryRecentLimit),
  })
  .strict();
export type CommandCentreHistorySection = z.infer<
  typeof historySection
>;

const releaseItem = z
  .object({
    tag: z.string().min(1).max(120),
    name: z.string().min(1).max(200).nullable(),
    publishedAt: instant.nullable(),
    url: z.url().max(500),
    prerelease: z.boolean(),
    // Issues referenced by the release notes, with a source-provided URL. A
    // reference is authored text, never a verified-live claim.
    issues: z
      .array(
        z
          .object({
            number: z.number().int().positive().max(10_000_000),
            url: z.url().max(500),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
export type CommandCentreReleaseItem = z.infer<typeof releaseItem>;

const releasesSection = z
  .object({
    state: z.literal("ok"),
    items: z.array(releaseItem).max(commandCentreReleaseRecentLimit),
  })
  .strict();
export type CommandCentreReleasesSection = z.infer<
  typeof releasesSection
>;

// ---------------------------------------------------------------------------
// Pull-request readback: review and check state.
//
// A repository can have zero open issues and several open pull requests, so
// pull requests are read and shown separately from issues. Check and review
// state degrade one level at a time: a read that failed is unknown with the
// reason, and a commit with no check result is "none", never "passing".
// ---------------------------------------------------------------------------

const sha = z.string().regex(/^[a-f0-9]{40}$/);

// GitHub's mergeable_state values this view recognises. Anything else becomes
// "unknown" rather than being echoed as if it were understood.
export const commandCentreMergeableState = z.enum([
  "behind",
  "blocked",
  "clean",
  "dirty",
  "draft",
  "unstable",
  "unknown",
]);
export type CommandCentreMergeableState = z.infer<
  typeof commandCentreMergeableState
>;

const checksSection = z
  .object({
    state: z.literal("ok"),
    value: z.enum([
      "success",
      "pending",
      "failure",
      "none",
      "stale",
      "unknown",
    ]),
    // What was actually counted, so "none" can mean "no result was returned"
    // rather than "everything passed".
    detail: z.string().min(1).max(240),
  })
  .strict();
export type CommandCentreChecksSection = z.infer<typeof checksSection>;

const reviewSection = z
  .object({
    state: z.literal("ok"),
    value: z.enum([
      "approved",
      "changes_requested",
      "review_required",
      "none",
    ]),
    detail: z.string().min(1).max(240),
  })
  .strict();
export type CommandCentreReviewSection = z.infer<typeof reviewSection>;

const pullRequestItem = z
  .object({
    number: z.number().int().positive().max(10_000_000),
    title: z.string().min(1).max(300),
    url: z.url().max(500),
    draft: z.boolean(),
    author: z.string().min(1).max(100).nullable(),
    updatedAt: instant,
    requestedReviewers: z.array(z.string().min(1).max(100)).max(10),
    review: z.union([reviewSection, commandCentreUnknownSection]),
    mergeableState: commandCentreMergeableState.nullable(),
    checks: z.union([checksSection, commandCentreUnknownSection]),
  })
  .strict();
export type CommandCentrePullRequestItem = z.infer<typeof pullRequestItem>;

const pullRequestSection = z
  .object({
    state: z.literal("ok"),
    scanned: z.number().int().min(0).max(commandCentreRecentWindow),
    complete: z.boolean(),
    items: z.array(pullRequestItem).max(commandCentrePullRequestLimit),
  })
  .strict();
export type CommandCentrePullRequestSection = z.infer<
  typeof pullRequestSection
>;

// ---------------------------------------------------------------------------
// Optional live build identity. This is a per-repository opt-in: the source
// adapter records the exact URL it read. A public build.json is deployment
// evidence, never an inference from a closed issue or a merged pull request.
// ---------------------------------------------------------------------------

const liveIdentitySection = z
  .object({
    state: z.literal("ok"),
    url: z.url().max(500),
    // The public address actually read. It differs from the canonical URL only
    // when a Worker cannot fetch its own custom hostname; it is still the same
    // deployment, and the fact is shown rather than hidden.
    readVia: z.url().max(500).nullable(),
    fetchedAt: instant,
    revision: sha,
    app: z.string().min(1).max(80).nullable(),
    builtAt: instant.nullable(),
    // The latest default-branch commit read for this repository, when it was
    // confirmed. Null means the comparison itself is unknown.
    defaultBranchCommit: sha.nullable(),
    matchesDefaultBranch: z.boolean().nullable(),
  })
  .strict();
export type CommandCentreLiveIdentitySection = z.infer<
  typeof liveIdentitySection
>;

const liveIdentityUnconfigured = z
  .object({
    state: z.literal("not-configured"),
    reason: z.string().min(1).max(240),
  })
  .strict();
export type CommandCentreLiveIdentityUnconfigured = z.infer<
  typeof liveIdentityUnconfigured
>;

// Projects V2 is served through GraphQL and a project-scoped credential. This
// view records whether that is available; it never invents a board, field or
// item from issues or pull requests.
const projectsSection = z
  .object({
    state: z.enum(["unavailable", "credential-capable"]),
    reason: z.string().min(1).max(240),
  })
  .strict();
export type CommandCentreProjectsSection = z.infer<typeof projectsSection>;

export const commandCentreSource = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    label: z.string().min(1).max(80),
  })
  .strict();

// Links come from the source adapter. The view never builds a GitHub URL.
export const commandCentreLinks = z
  .object({
    issues: z.url().max(500),
    pullRequests: z.url().max(500),
    newIssue: z.url().max(500).nullable(),
  })
  .strict();

export const commandCentreRepo = z
  .object({
    repository: commandCentreRepositoryName,
    url: z.url().max(500),
    links: commandCentreLinks,
    checkedAt: instant,
    archived: z.boolean().nullable(),
    defaultBranch: z.string().min(1).max(200).nullable(),
    issues: z
      .object({
        count: z.union([countSection, commandCentreUnknownSection]),
        recent: z.union([recentSection, commandCentreUnknownSection]),
      })
      .strict(),
    pullRequests: z.union([countSection, commandCentreUnknownSection]),
    openPullRequests: z.union([
      pullRequestSection,
      commandCentreUnknownSection,
    ]),
    blocked: z.union([blockedSection, commandCentreUnknownSection]),
    release: z.union([releaseSection, commandCentreUnknownSection]),
    releases: z.union([releasesSection, commandCentreUnknownSection]),
    liveIdentity: z.union([
      liveIdentitySection,
      liveIdentityUnconfigured,
      commandCentreUnknownSection,
    ]),
    projects: projectsSection,
    commit: z.union([commitSection, commandCentreUnknownSection]),
    plan: z.union([planSection, commandCentreUnknownSection]),
    history: z.union([historySection, commandCentreUnknownSection]),
    forecast: commandCentreForecast,
    // True only when every read-based section was read and checked. A forecast
    // that honestly has too little history is still a completed read.
    complete: z.boolean(),
  })
  .strict();
export type CommandCentreRepo = z.infer<typeof commandCentreRepo>;

export const commandCentreReport = z
  .object({
    ok: z.literal(true),
    schema: z.literal(commandCentreSchema),
    source: commandCentreSource,
    selected: commandCentreRepositoryName,
    fetchedAt: instant,
    cached: z.boolean(),
    cacheSeconds: z
      .number()
      .int()
      .min(45)
      .max(commandCentreMaximumCacheSeconds),
    cacheAgeSeconds: z
      .number()
      .int()
      .min(0)
      .max(commandCentreMaximumCacheSeconds),
    repositories: commandCentreRepositoryList,
    rateLimit: z
      .object({
        limit: z.number().int().min(0).max(100_000).nullable(),
        remaining: z.number().int().min(0).max(100_000).nullable(),
        resetAt: instant.nullable(),
      })
      .strict(),
    repo: commandCentreRepo,
    limits: z.array(z.string().min(1).max(240)).max(8),
  })
  .strict();
export type CommandCentreReport = z.infer<typeof commandCentreReport>;

// ---------------------------------------------------------------------------
// GitHub REST payload validation. These are deliberately loose objects: GitHub
// adds fields over time, but each field this view relies on must be present.
// ---------------------------------------------------------------------------

export const githubRepository = z.looseObject({
  full_name: z.string().min(3).max(140),
  html_url: z.url().max(500),
  default_branch: z.string().min(1).max(200),
  archived: z.boolean(),
  open_issues_count: whole,
});
export type GithubRepository = z.infer<typeof githubRepository>;

const githubLabel = z.looseObject({
  name: z.string().min(1).max(100),
});
export const githubLabelList = z.array(githubLabel).max(10_000);
export type GithubLabelList = z.infer<typeof githubLabelList>;

export const githubPullList = z
  .array(z.looseObject({ number: z.number().int().positive().max(10_000_000) }))
  .max(100);

// Full open pull-request page. These fields are required for detail: a payload
// that only carries numbers still yields a confirmed count and an unknown
// detail section, which is the honest split.
export const githubPull = z.looseObject({
  number: z.number().int().positive().max(10_000_000),
  title: z.string().min(1).max(300),
  html_url: z.url().max(500),
  updated_at: instant,
  draft: z.boolean().optional(),
  user: z.looseObject({ login: z.string().max(100) }).nullable().optional(),
  requested_reviewers: z
    .array(z.looseObject({ login: z.string().max(100) }))
    .max(50)
    .optional(),
  mergeable_state: z.string().max(40).nullable().optional(),
  head: z.looseObject({ sha: z.string().regex(/^[a-f0-9]{40}$/) }),
});
export type GithubPull = z.infer<typeof githubPull>;

export const githubPullDetailList = z
  .array(githubPull)
  .max(commandCentreRecentWindow);

// Legacy commit statuses: total_count 0 with state "pending" means no status
// was recorded, never a pending build.
export const githubCombinedStatus = z.looseObject({
  state: z.enum(["success", "pending", "failure", "error"]),
  total_count: whole,
});

export const githubCheckRunList = z.looseObject({
  total_count: whole,
  check_runs: z
    .array(
      z.looseObject({
        status: z.string().max(40),
        conclusion: z.string().max(40).nullable(),
        head_sha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
      }),
    )
    .max(commandCentreCheckRunLimit),
});

export const githubReviewList = z
  .array(
    z.looseObject({
      state: z.string().max(40),
      user: z.looseObject({ login: z.string().max(100) }).nullable().optional(),
      submitted_at: instant.nullable().optional(),
    }),
  )
  .max(commandCentreReviewLimit);

// A public build.json. App Composer's root identity publishes `commit`;
// mounted and standalone sources publish `revision`. Both are accepted, and
// nothing else in the document is trusted.
export const liveIdentityPayload = z.looseObject({
  revision: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  commit: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  app: z.string().min(1).max(80).optional(),
  builtAt: z.string().max(40).optional(),
});

const knownMergeableStates = new Set([
  "behind",
  "blocked",
  "clean",
  "dirty",
  "draft",
  "unstable",
]);

export function mergeableStateFrom(
  value: string | null | undefined,
): CommandCentreMergeableState | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return knownMergeableStates.has(normalized)
    ? (normalized as CommandCentreMergeableState)
    : "unknown";
}

// Everything on a pull request that needs no extra request. Review and check
// state are added by the caller, which knows whether it read them.
export function mapPullRequestBase(
  pull: GithubPull,
): Omit<CommandCentrePullRequestItem, "review" | "checks"> {
  const author = pull.user?.login?.trim();
  return {
    number: pull.number,
    title: pull.title,
    url: pull.html_url,
    draft: pull.draft === true,
    author: author ? author : null,
    updatedAt: pull.updated_at,
    requestedReviewers: (pull.requested_reviewers ?? [])
      .map((reviewer) => reviewer.login.trim())
      .filter((login) => login.length > 0)
      .slice(0, 10),
    mergeableState: mergeableStateFrom(pull.mergeable_state),
  };
}

const githubMilestone = z.looseObject({
  title: z.string().min(1).max(200),
  due_on: instant.nullable().optional(),
  html_url: z.url().max(500).optional(),
});

export const githubIssue = z.looseObject({
  number: z.number().int().positive().max(10_000_000),
  title: z.string().min(1).max(300),
  html_url: z.url().max(500),
  updated_at: instant,
  // Timestamps and closure reasons are optional so a missing field becomes an
  // explicit forecast unknown instead of failing the whole read as malformed.
  created_at: instant.nullable().optional(),
  closed_at: instant.nullable().optional(),
  state_reason: z.string().max(40).nullable().optional(),
  body: z.string().max(65_536).nullable().optional(),
  milestone: githubMilestone.nullable().optional(),
  labels: z
    .array(
      z.union([
        z.string().min(1).max(100),
        z.looseObject({ name: z.string().min(1).max(100) }),
      ]),
    )
    .max(50),
  // A pull request appears in the issues list with this marker. It is a pull
  // request for this view, never an issue.
  pull_request: z
    .union([z.looseObject({ url: z.url().max(500).optional() }), z.null()])
    .optional(),
});
export type GithubIssue = z.infer<typeof githubIssue>;

export const githubIssueList = z
  .array(githubIssue)
  .max(commandCentreRecentWindow);

export const githubRelease = z.looseObject({
  tag_name: z.string().min(1).max(120),
  name: z.string().max(200).nullable().optional(),
  html_url: z.url().max(500),
  published_at: instant.nullable(),
  body: z.string().max(200_000).nullable().optional(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
});
export type GithubRelease = z.infer<typeof githubRelease>;

export const githubReleaseList = z
  .array(githubRelease)
  .max(commandCentreReleaseLimit);

export const githubCommitList = z
  .array(
    z.looseObject({
      sha: z.string().regex(/^[a-f0-9]{40}$/),
      html_url: z.url().max(500),
      commit: z.looseObject({
        committer: z.looseObject({ date: instant }),
      }),
      author: z
        .looseObject({ login: z.string().max(100) })
        .nullable()
        .optional(),
    }),
  )
  .max(100);

// Labels that this view treats as blocked or needing attention. The repository
// must actually define the label; a missing label is shown as none, not zero.
const blockedLabelPattern = /^(?:status:\s*)?(?:blocked|needs[- ]attention)$/i;

export function isBlockedLabel(name: string): boolean {
  return blockedLabelPattern.test(name.trim());
}

export function blockedLabelNames(labels: GithubLabelList): string[] {
  return labels
    .map((label) => label.name)
    .filter(isBlockedLabel)
    .slice(0, commandCentreBlockedLabelLimit);
}

// GitHub's Link header carries the last page number for a bounded list. When it
// is absent, the returned items are the entire list. No second page is read.
export function lastPageFromLink(link: string | null): number | null {
  if (!link) return null;
  const match = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/i.exec(link);
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isSafeInteger(page) && page > 0 && page <= maximumCount
    ? page
    : null;
}

export function pullRequestCountFromPage(
  link: string | null,
  items: { number: number }[],
): number | null {
  if (items.length > 1) return null;
  // A Link header without a readable last page means more pages exist but the
  // count cannot be confirmed. Do not fall back to the single item on page one.
  if (link) return lastPageFromLink(link);
  return items.length;
}

// The detail read requests one bounded page of up to 100 open pull requests. A
// Link header still carries the true count; without one, the returned items are
// the whole open list.
export function pullRequestCountFromList(
  link: string | null,
  items: { number: number }[],
): number | null {
  if (link) return lastPageFromLink(link);
  return items.length;
}

// GitHub's open_issues_count includes pull requests. Subtracting the confirmed
// open pull request count yields the open issue count; a nonsensical result is
// unknown, not zero.
export function openIssueCount(
  openIssuesAndPulls: number,
  openPullRequests: number,
): number | null {
  if (openPullRequests > openIssuesAndPulls) return null;
  return openIssuesAndPulls - openPullRequests;
}

export function issueLabelNames(issue: GithubIssue): string[] {
  return issue.labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .slice(0, 6);
}

export function mapRecentIssues(issues: GithubIssue[]): {
  items: CommandCentreRecentIssue[];
  complete: boolean;
  scanned: number;
} {
  const window = issues.slice(0, commandCentreRecentWindow);
  const items = window
    .filter((issue) => !issue.pull_request)
    .slice(0, commandCentreRecentIssueLimit)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      updatedAt: issue.updated_at,
      labels: issueLabelNames(issue),
      reopened: issue.state_reason === "reopened",
    }));
  return {
    items,
    complete:
      window.length < commandCentreRecentWindow ||
      items.length >= commandCentreRecentIssueLimit,
    scanned: window.length,
  };
}

export function normalizeStateReason(
  value: string | null | undefined,
): ForecastStateReason {
  if (value === undefined || value === null) return null;
  if (value === "completed" || value === "not_planned") return value;
  if (value === "duplicate" || value === "reopened") return value;
  return "unknown";
}

const releaseUrlPattern =
  /https?:\/\/github\.com\/[A-Za-z0-9_.-]{1,80}\/[A-Za-z0-9_.-]{1,100}\/releases\/tag\/([^\s)\]"'<>]{1,120})/i;

// A real release association exists only when the issue body links a release
// tag URL. A release is publication evidence, never a live check.
export function linkedReleaseFromBody(
  body: string | null | undefined,
): { tag: string; url: string } | null {
  if (!body) return null;
  const match = releaseUrlPattern.exec(body);
  if (!match) return null;
  const tag = (match[1] ?? "").replace(/[.,;:]+$/, "");
  if (!tag) return null;
  return { tag, url: match[0] };
}

const issueNumberPattern = /(?<![\w/])#(\d{1,7})\b/g;

// Issue numbers referenced by release notes. This is authored association, not
// a verified-live claim.
export function releaseIssueNumbers(
  body: string | null | undefined,
): number[] {
  if (!body) return [];
  const numbers = new Set<number>();
  for (const match of body.matchAll(issueNumberPattern)) {
    const number = Number(match[1]);
    if (Number.isSafeInteger(number) && number > 0) numbers.add(number);
    if (numbers.size >= 10) break;
  }
  return [...numbers];
}

export function mapRelease(release: GithubRelease): {
  tag: string;
  publishedAt: string | null;
  url: string;
  prerelease: boolean;
} {
  return {
    tag: release.tag_name,
    publishedAt: release.published_at,
    url: release.html_url,
    prerelease: release.prerelease === true,
  };
}

export function mapRecentReleases(
  releases: GithubRelease[],
  repository: string,
): {
  tag: string;
  name: string | null;
  publishedAt: string | null;
  url: string;
  prerelease: boolean;
  issues: { number: number; url: string }[];
}[] {
  const base = `https://github.com/${repository}/issues`;
  return releases
    .filter((release) => release.draft !== true)
    .slice(0, commandCentreReleaseRecentLimit)
    .map((release) => ({
      tag: release.tag_name,
      name: release.name?.trim() || null,
      publishedAt: release.published_at,
      url: release.html_url,
      prerelease: release.prerelease === true,
      issues: releaseIssueNumbers(release.body).map((number) => ({
        number,
        url: `${base}/${number}`,
      })),
    }));
}

export function mapCommit(commit: z.infer<typeof githubCommitList>[number]): {
  sha: string;
  committedAt: string;
  url: string;
} {
  return {
    sha: commit.sha,
    committedAt: commit.commit.committer.date,
    url: commit.html_url,
  };
}

const failingConclusions = new Set([
  "action_required",
  "cancelled",
  "failure",
  "startup_failure",
  "timed_out",
]);
const passingConclusions = new Set(["success", "neutral", "skipped"]);

// Combine the legacy combined status with the Checks API result for one head
// commit. Failure always wins over pending and success; a missing result is
// "none", never "passing"; a check run for another commit is "stale".
export function combineCheckState(input: {
  legacy: { state: "success" | "pending" | "failure" | "error"; total: number };
  runs: { status: string; conclusion: string | null; headSha: string | null }[];
  // GitHub's total for the head commit. A page that returned fewer runs than
  // the total was truncated, so passing cannot be claimed.
  runTotal?: number;
  headSha: string;
}): { value: CommandCentreChecksSection["value"]; detail: string } {
  const legacyCount = input.legacy.total;
  const runCount = input.runs.length;
  const runTotal = input.runTotal ?? runCount;
  const counted = `${legacyCount} legacy commit ${legacyCount === 1 ? "status" : "statuses"} and ${runCount}${runTotal > runCount ? ` of ${runTotal}` : ""} check ${runTotal === 1 ? "run" : "runs"}`;
  if (
    input.runs.some(
      (run) => run.headSha !== null && run.headSha !== input.headSha,
    )
  )
    return {
      value: "stale",
      detail: `${counted}. A check run belongs to a different commit, so nothing is treated as passing.`,
    };
  if (runTotal > runCount)
    return {
      value: "unknown",
      detail: `${counted}. Only the returned check runs were read, so nothing is treated as passing.`,
    };
  const legacyFailure =
    legacyCount > 0 &&
    (input.legacy.state === "failure" || input.legacy.state === "error");
  const runFailure = input.runs.some(
    (run) => run.conclusion !== null && failingConclusions.has(run.conclusion),
  );
  if (legacyFailure || runFailure)
    return {
      value: "failure",
      detail: `${counted}. At least one result did not pass.`,
    };
  const legacyPending = legacyCount > 0 && input.legacy.state === "pending";
  const runPending = input.runs.some(
    (run) =>
      run.conclusion === null && run.status.trim().toLowerCase() !== "completed",
  );
  if (legacyPending || runPending)
    return {
      value: "pending",
      detail: `${counted}. At least one result is still running or awaiting a report.`,
    };
  const runUnknown = input.runs.some(
    (run) =>
      run.conclusion !== null &&
      !passingConclusions.has(run.conclusion) &&
      !failingConclusions.has(run.conclusion),
  );
  if (runUnknown)
    return {
      value: "unknown",
      detail: `${counted}. A conclusion was not recognised and is not treated as passing.`,
    };
  if (legacyCount > 0 || runCount > 0)
    return { value: "success", detail: `${counted}. Every reported result passed.` };
  return {
    value: "none",
    detail:
      "No legacy commit status and no check run was returned for this head commit.",
  };
}

const recognisedReviewStates = new Set([
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
  "PENDING",
]);

// The latest submitted review per reviewer. Approval is a reviewer statement,
// not a branch-protection decision: those rules are not read here.
export function mapReviewDecision(
  reviews: { state: string; login: string | null; submittedAt: string | null }[],
  requestedReviewers: string[],
): { value: CommandCentreReviewSection["value"]; detail: string } {
  const latest = new Map<string, { state: string; at: string }>();
  reviews.forEach((review, index) => {
    const state = review.state.trim().toUpperCase();
    if (!recognisedReviewStates.has(state) || state === "PENDING") return;
    const key = review.login ?? `anonymous-${index}`;
    const at = review.submittedAt ?? "";
    const existing = latest.get(key);
    if (!existing || existing.at < at) latest.set(key, { state, at });
  });
  const states = [...latest.values()].map((entry) => entry.state);
  const requested = requestedReviewers.length;
  const requestNote =
    requested === 0
      ? "No reviewer is requested."
      : `${requested} reviewer${requested === 1 ? "" : "s"} requested.`;
  const detail = `${states.length} submitted review${states.length === 1 ? "" : "s"}, latest state per reviewer. ${requestNote} Branch-protection approval rules are not read.`;
  if (states.includes("CHANGES_REQUESTED"))
    return { value: "changes_requested", detail };
  if (states.includes("APPROVED")) return { value: "approved", detail };
  if (requested > 0) return { value: "review_required", detail };
  return { value: "none", detail };
}

function mapRelationship(
  reference: RelationshipReference,
  repository: string,
  titles: Map<number, string>,
): CommandCentreIssueReference {
  return {
    repository: reference.repository,
    number: reference.number,
    url:
      reference.url ??
      (reference.repository === repository
        ? `https://github.com/${repository}/${
            reference.kind === "pull-request" ? "pull" : "issues"
          }/${reference.number}`
        : null),
    kind: reference.kind,
    evidence: reference.evidence,
    title:
      reference.repository === repository
        ? (titles.get(reference.number) ?? null)
        : null,
  };
}

export function mapPlanSection(
  issues: GithubIssue[],
  repository: string,
  complete: boolean,
): CommandCentrePlanSection {
  const openIssues = issues.filter((issue) => !issue.pull_request);
  const titles = new Map(openIssues.map((issue) => [issue.number, issue.title]));
  const items = openIssues
    .slice(0, commandCentrePlanLimit)
    .map((issue): CommandCentrePlanItem => {
      const body = typeof issue.body === "string" ? issue.body : null;
      const parsed =
        body === null
          ? {
              parent: null,
              children: [],
              blockers: [],
              pullRequests: [],
            }
          : parseIssueRelationships(body, repository);
      // The blocked flag must see every label, not only the six displayed.
      const allLabels = issue.labels.map((label) =>
        typeof label === "string" ? label : label.name,
      );
      const labels = allLabels.slice(0, 6);
      return {
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        updatedAt: issue.updated_at,
        labels,
        reopened: issue.state_reason === "reopened",
        milestone: issue.milestone
          ? {
              title: issue.milestone.title,
              dueOn: issue.milestone.due_on ?? null,
              url: issue.milestone.html_url ?? null,
            }
          : null,
        blockedByLabel: allLabels.some(isBlockedLabel),
        parent: parsed.parent
          ? mapRelationship(parsed.parent, repository, titles)
          : null,
        children: parsed.children.map((entry) =>
          mapRelationship(entry, repository, titles),
        ),
        blockers: parsed.blockers.map((entry) =>
          mapRelationship(entry, repository, titles),
        ),
        pullRequests: parsed.pullRequests.map((entry) =>
          mapRelationship(entry, repository, titles),
        ),
        linkState:
          body === null ? "unknown" : hasRelationships(parsed) ? "found" : "none",
      };
    });

  const milestones = new Map<
    string,
    { title: string; dueOn: string | null; openIssues: number; blockedIssues: number }
  >();
  for (const item of items) {
    if (!item.milestone) continue;
    const existing = milestones.get(item.milestone.title) ?? {
      title: item.milestone.title,
      dueOn: item.milestone.dueOn,
      openIssues: 0,
      blockedIssues: 0,
    };
    existing.openIssues += 1;
    if (item.blockedByLabel || item.blockers.length) existing.blockedIssues += 1;
    if (!existing.dueOn && item.milestone.dueOn)
      existing.dueOn = item.milestone.dueOn;
    milestones.set(item.milestone.title, existing);
  }

  return {
    state: "ok",
    scanned: issues.length,
    complete,
    items,
    milestones: [...milestones.values()].slice(0, commandCentreMilestoneLimit),
    relationshipBasis:
      "Explicit parent, sub-issue, blocker and pull-request references in issue bodies and pull-request URLs. Native sub-issue fields and pull-request state are not read.",
  };
}

export function mapHistorySection(
  issues: GithubIssue[],
  complete: boolean,
): CommandCentreHistorySection {
  const closed = issues.filter((issue) => !issue.pull_request);
  const items = closed.map((issue): CommandCentreHistoryItem => ({
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    createdAt: issue.created_at ?? null,
    closedAt: issue.closed_at ?? null,
    stateReason: normalizeStateReason(issue.state_reason),
    linkedRelease: linkedReleaseFromBody(issue.body),
    milestone: issue.milestone?.title ?? null,
  }));
  const recent = [...items]
    .sort((left, right) => {
      if (left.closedAt === null && right.closedAt === null) return 0;
      if (left.closedAt === null) return 1;
      if (right.closedAt === null) return -1;
      return right.closedAt.localeCompare(left.closedAt);
    })
    .slice(0, commandCentreHistoryRecentLimit);
  const last = issues[issues.length - 1];
  return {
    state: "ok",
    scanned: issues.length,
    closed: closed.length,
    complete,
    oldestUpdatedAt: last?.updated_at ?? null,
    recent,
  };
}

export function mapForecastIssue(issue: GithubIssue): ForecastIssue {
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    createdAt: issue.created_at ?? null,
    closedAt: issue.closed_at ?? null,
    stateReason: normalizeStateReason(issue.state_reason),
    reopened: issue.state_reason === "reopened",
    labels: issueLabelNames(issue),
    milestone: issue.milestone?.title ?? null,
    linkedReleaseTag: linkedReleaseFromBody(issue.body)?.tag ?? null,
  };
}

// HH:MM in UTC for "checked at" and rate-limit reset copy.
export function utcClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

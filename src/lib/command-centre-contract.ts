// Bounded read-only contract for the native GitHub command centre (#658).
//
// GitHub payloads are untrusted data. Every raw response is validated here
// before any count, release, commit or issue reaches the page. A section that
// cannot be confirmed is represented as `unknown`; it is never coerced to 0 or
// an empty list that would imply "nothing open".
import { z } from "zod";

export const commandCentreSchema = "app-composer.command-centre/1";
export const maximumCommandCentreRepositories = 10;
// A credentialed read can use the short window. The unauthenticated public API
// allows only 60 requests per hour, so the long window keeps a real read usable
// across ordinary page loads instead of exhausting the quota immediately.
export const commandCentreCacheSeconds = 55;
export const commandCentrePublicCacheSeconds = 12 * 60;
export const commandCentreMaximumCacheSeconds = 15 * 60;
export const commandCentreRecentIssueLimit = 5;
export const commandCentreRecentWindow = 100;
export const commandCentreLabelLimit = 100;
export const commandCentreBlockedLabelLimit = 4;

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
    reason: z.string().min(1).max(200),
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

export const commandCentreRepo = z
  .object({
    repository: commandCentreRepositoryName,
    url: z.url().max(500),
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
    blocked: z.union([blockedSection, commandCentreUnknownSection]),
    release: z.union([releaseSection, commandCentreUnknownSection]),
    commit: z.union([commitSection, commandCentreUnknownSection]),
    // True only when every section was read and checked.
    complete: z.boolean(),
  })
  .strict();
export type CommandCentreRepo = z.infer<typeof commandCentreRepo>;

export const commandCentreReport = z
  .object({
    ok: z.literal(true),
    schema: z.literal(commandCentreSchema),
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

export const githubIssue = z.looseObject({
  number: z.number().int().positive().max(10_000_000),
  title: z.string().min(1).max(300),
  html_url: z.url().max(500),
  updated_at: instant,
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
  html_url: z.url().max(500),
  published_at: instant.nullable(),
});
export type GithubRelease = z.infer<typeof githubRelease>;

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
      labels: issue.labels
        .map((label) => (typeof label === "string" ? label : label.name))
        .slice(0, 6),
    }));
  return {
    items,
    complete:
      window.length < commandCentreRecentWindow ||
      items.length >= commandCentreRecentIssueLimit,
    scanned: window.length,
  };
}

export function mapRelease(release: GithubRelease): {
  tag: string;
  publishedAt: string | null;
  url: string;
} {
  return {
    tag: release.tag_name,
    publishedAt: release.published_at,
    url: release.html_url,
  };
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

// HH:MM in UTC for "checked at" and rate-limit reset copy.
export function utcClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

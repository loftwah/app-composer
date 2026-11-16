// Bounded, typed contract for the native command centre (#658).
//
// Source payloads are untrusted data. Every raw response is validated here
// before any count, relationship, release, commit or issue reaches the page. A
// section that cannot be confirmed is represented as `unknown`; it is never
// coerced to 0 or an empty list that would imply "nothing open".
//
// Schema 2 adds closed-issue history, the Plan lens, recent releases and the
// source-neutral forecast. The source adapter supplies its own links and label;
// the projection and view code never assume GitHub.
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

export const commandCentreSchema = "app-composer.command-centre/2";
export const maximumCommandCentreRepositories = 10;
// A credentialed read can use the short window. The unauthenticated public API
// allows only 60 requests per hour, so the long window keeps a real read usable
// across ordinary page loads instead of exhausting the quota immediately.
export const commandCentreCacheSeconds = 55;
export const commandCentrePublicCacheSeconds = 12 * 60;
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
    blocked: z.union([blockedSection, commandCentreUnknownSection]),
    release: z.union([releaseSection, commandCentreUnknownSection]),
    releases: z.union([releasesSection, commandCentreUnknownSection]),
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

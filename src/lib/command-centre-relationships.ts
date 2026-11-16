// Explicit issue relationships for the Plan lens (#658).
//
// GitHub's list endpoints do not carry native parent/sub-issue fields. This
// parser therefore reads only what an issue body actually declares: labelled
// lines such as `Parent: #12`, `Part of #12`, `Blocked by: org/repo#8`, a
// `### Sub-issues` section, and GitHub issue or pull-request URLs. It never
// infers a dependency from prose, and it never claims a pull request's state:
// this view does not read merged/review state, so every reference stays
// unresolved until a source confirms it.

export interface RelationshipReference {
  repository: string;
  number: number;
  url: string | null;
  kind: "issue" | "pull-request" | "unknown";
  evidence: "url" | "reference";
}

export interface ParsedIssueRelationships {
  parent: RelationshipReference | null;
  children: RelationshipReference[];
  blockers: RelationshipReference[];
  pullRequests: RelationshipReference[];
}

const repositoryPattern = /^[A-Za-z0-9_.-]{1,80}\/[A-Za-z0-9_.-]{1,100}$/;
const maximumChildren = 20;
const maximumBlockers = 10;
const maximumPullRequests = 10;
const maximumBodyCharacters = 65_536;

const urlPattern =
  /https?:\/\/github\.com\/([A-Za-z0-9_.-]{1,80})\/([A-Za-z0-9_.-]{1,100})\/(issues|pull)\/(\d{1,7})\b/gi;
const qualifiedPattern =
  /(?<![\w/])([A-Za-z0-9_.-]{1,80})\/([A-Za-z0-9_.-]{1,100})#(\d{1,7})\b/g;
const barePattern = /(?<![\w/#])#(\d{1,7})\b/g;

const relationshipLabel =
  /^(parent(?:\s+issue)?|part\s+of|sub-?issues?|child(?:ren|\s+issues?)?|blocked\s+by|depends\s+on|waiting\s+on|pull\s+requests?|prs?)\s*[:\-–—]?\s*/i;

type RelationKind = "parent" | "children" | "blockers" | "pullRequests";

function sectionFor(text: string): RelationKind | null {
  const value = text
    .replace(/\*\*/g, "")
    .replace(/[:\-–—]+$/, "")
    .trim()
    .toLowerCase();
  if (/^(sub-?issues?|child(?:ren|\s+issues?)?)$/.test(value)) return "children";
  if (/^(blocked by|blockers?|depends on|waiting on)$/.test(value))
    return "blockers";
  if (/^(pull requests?|linked prs?|prs?)$/.test(value)) return "pullRequests";
  return null;
}

function relationshipFor(label: string): RelationKind | null {
  const value = label.toLowerCase();
  if (/^(parent|part of)/.test(value)) return "parent";
  if (/^(sub-?issues?|child)/.test(value)) return "children";
  if (/^(blocked by|depends on|waiting on)/.test(value)) return "blockers";
  if (/^(pull request|pr)/.test(value)) return "pullRequests";
  return null;
}

function reference(
  repository: string,
  number: number,
  kind: RelationshipReference["kind"],
  evidence: RelationshipReference["evidence"],
  url: string | null,
): RelationshipReference {
  return { repository, number, kind, evidence, url };
}

function push(
  list: RelationshipReference[],
  entry: RelationshipReference,
  limit: number,
) {
  if (list.length >= limit) return;
  const duplicate = list.some(
    (existing) =>
      existing.repository === entry.repository &&
      existing.number === entry.number &&
      existing.kind === entry.kind,
  );
  if (!duplicate) list.push(entry);
}

function readUrlReferences(body: string): RelationshipReference[] {
  const references: RelationshipReference[] = [];
  for (const match of body.matchAll(urlPattern)) {
    const owner = match[1];
    const name = match[2];
    const kind = match[3] === "pull" ? "pull-request" : "issue";
    const number = Number(match[4]);
    if (!owner || !name || !Number.isSafeInteger(number) || number <= 0)
      continue;
    const repository = `${owner}/${name}`;
    if (!repositoryPattern.test(repository)) continue;
    push(
      references,
      reference(repository, number, kind, "url", match[0] ?? null),
      maximumPullRequests + maximumBlockers + maximumChildren,
    );
  }
  return references;
}

function lineReferences(
  text: string,
  repository: string,
  kind: RelationshipReference["kind"],
): RelationshipReference[] {
  const references: RelationshipReference[] = [];
  for (const match of text.matchAll(qualifiedPattern)) {
    const owner = match[1];
    const name = match[2];
    const number = Number(match[3]);
    if (!owner || !name || !Number.isSafeInteger(number) || number <= 0)
      continue;
    const target = `${owner}/${name}`;
    if (!repositoryPattern.test(target)) continue;
    push(
      references,
      reference(target, number, kind, "reference", null),
      30,
    );
  }
  for (const match of text.matchAll(barePattern)) {
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number) || number <= 0) continue;
    push(
      references,
      reference(repository, number, kind, "reference", null),
      30,
    );
  }
  return references;
}

function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/\*\*/g, "")
    .trim();
}

// Parses one bounded issue body. `body` is untrusted data: only references are
// returned, never any body text.
export function parseIssueRelationships(
  body: string,
  repository: string,
): ParsedIssueRelationships {
  const parsed: ParsedIssueRelationships = {
    parent: null,
    children: [],
    blockers: [],
    pullRequests: [],
  };
  const text = body.slice(0, maximumBodyCharacters);
  const urls = readUrlReferences(text);
  for (const entry of urls) {
    if (entry.kind === "pull-request")
      push(parsed.pullRequests, entry, maximumPullRequests);
    // An unlabelled issue URL is a mention, not a declared parent or blocker.
  }

  let section: RelationKind | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    const heading = /^#{1,6}\s+(.+)$/.exec(rawLine.trim());
    if (heading) {
      section = sectionFor(heading[1] ?? "");
      continue;
    }

    const label = relationshipLabel.exec(line);
    let target = section;
    let remainder = line;
    if (label) {
      target = relationshipFor(label[1] ?? "");
      remainder = line.slice(label[0].length);
    }
    if (target === null) continue;

    const kind: RelationshipReference["kind"] =
      target === "pullRequests"
        ? "pull-request"
        : target === "parent" || target === "children"
          ? "issue"
          : "unknown";
    const found = lineReferences(remainder, repository, kind);
    if (target === "parent") {
      const first = found[0];
      if (first && !parsed.parent) parsed.parent = first;
    } else if (target === "children") {
      for (const entry of found)
        push(parsed.children, entry, maximumChildren);
    } else if (target === "blockers") {
      for (const entry of found)
        push(parsed.blockers, entry, maximumBlockers);
    } else {
      for (const entry of found)
        push(parsed.pullRequests, entry, maximumPullRequests);
    }
  }

  return parsed;
}

export function hasRelationships(parsed: ParsedIssueRelationships): boolean {
  return Boolean(
    parsed.parent ||
      parsed.children.length ||
      parsed.blockers.length ||
      parsed.pullRequests.length,
  );
}

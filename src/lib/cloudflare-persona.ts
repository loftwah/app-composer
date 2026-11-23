import { experiencePath } from "./share-experiences.ts";

/** “Which Cloudflare service are you?” — one reusable, typed question and
 * outcome definition for the first App Composer persona quiz (#1071/#1069).
 *
 * The eight results are playful archetypes, not psychological types, job
 * matches or an assessment. Each service summary is short original editorial
 * copy checked against the official Cloudflare Developer Platform page named
 * by its `href` on 24 November 2026. Answers and scores stay on the page. Sharing carries a result ID
 * in the link fragment.
 *
 * Scoring is deterministic: an option gives 2 to its primary service and 1 to
 * its paired secondary. The highest total wins. An exact tie goes to the
 * service the player chose directly (as primary) most often, then to the one
 * chosen directly earliest, then to the fixed outcome order below. Every
 * outcome is reachable without relying on the tie-break; the focused tests
 * enumerate all 4^8 runs to keep that true. */

export const cloudflarePersonaChecked = "24 November 2026";

export interface CloudflarePersonaOutcome {
  readonly service: string;
  readonly archetype: string;
  readonly tendency: string;
  readonly reason: string;
  readonly href: string;
}

export const cloudflarePersonaOutcomes = {
  workers: {
    service: "Workers®",
    archetype: "The Builder",
    tendency: "You want the shortest path from a decent idea to something people can actually open.",
    reason: "On Workers, your code runs on Cloudflare’s network, so a small app can be reachable without a server to babysit.",
    href: "https://developers.cloudflare.com/workers/",
  },
  "durable-objects": {
    service: "Durable Objects™",
    archetype: "The Coordinator",
    tendency: "You are the one who notices two people are about to edit the same thing.",
    reason: "A Durable Object is a single named place where shared state and connected clients can be coordinated.",
    href: "https://developers.cloudflare.com/durable-objects/",
  },
  r2: {
    service: "R2",
    archetype: "The Keeper",
    tendency: "You give every file a proper home, even the ones everyone else leaves in a chat thread.",
    reason: "R2 stores objects such as files, images and exports, with an S3-compatible API.",
    href: "https://developers.cloudflare.com/r2/",
  },
  d1: {
    service: "D1",
    archetype: "The Organiser",
    tendency: "When the details start multiplying, you reach for a tidy table and a clear question.",
    reason: "D1 is a managed SQLite database: relational rows you can query with ordinary SQL.",
    href: "https://developers.cloudflare.com/d1/",
  },
  "workers-kv": {
    service: "Workers KV",
    archetype: "The Shortcut",
    tendency: "You would rather keep the answer close than work it out from scratch every time.",
    reason: "Workers KV is a globally distributed key-value store built for read-heavy lookups.",
    href: "https://developers.cloudflare.com/kv/",
  },
  queues: {
    service: "Queues",
    archetype: "The Dispatcher",
    tendency: "When the room gets busy, you are the one saying “put it in a queue and let the workers catch up”.",
    reason: "Queues buffers messages so one part of a system can hand work to another asynchronously.",
    href: "https://developers.cloudflare.com/queues/",
  },
  workflows: {
    service: "Workflows",
    archetype: "The Finisher",
    tendency: "You do not trust a long job that forgets step four the moment step five falls over.",
    reason: "Workflows runs durable multistep tasks, persisting progress and retrying steps when something fails.",
    href: "https://developers.cloudflare.com/workflows/",
  },
  "workers-ai": {
    service: "Workers AI®",
    archetype: "The Experimenter",
    tendency: "You would rather try the strange idea this afternoon than wonder about it all week.",
    reason: "Workers AI runs managed model inference from a Worker, so a model call does not need your own GPU.",
    href: "https://developers.cloudflare.com/workers-ai/",
  },
} as const satisfies Record<string, CloudflarePersonaOutcome>;

export type CloudflarePersonaId = keyof typeof cloudflarePersonaOutcomes;

/** Fixed order. It only decides a tie that survives score, direct picks and
 * earliest direct pick; it never stands in for an actual preference. */
export const cloudflarePersonaIds = Object.keys(cloudflarePersonaOutcomes) as CloudflarePersonaId[];

export interface CloudflarePersonaOption {
  readonly label: string;
  readonly primary: CloudflarePersonaId;
  readonly secondary: CloudflarePersonaId;
}

export interface CloudflarePersonaQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly [
    CloudflarePersonaOption,
    CloudflarePersonaOption,
    CloudflarePersonaOption,
    CloudflarePersonaOption,
  ];
}

/** Original, situation-based questions. Each of the eight services is a
 * primary choice four times and a secondary four times, so no result needs
 * prior Cloudflare knowledge to find and none is stranded. */
export const cloudflarePersonaQuestions: readonly CloudflarePersonaQuestion[] = [
  {
    id: "blank-page",
    prompt: "A side project starts with a blank page. What do you reach for first?",
    options: [
      { label: "Sketch the page people will actually open", primary: "workers", secondary: "durable-objects" },
      { label: "Work out how two editors stay in sync", primary: "durable-objects", secondary: "workers" },
      { label: "Write down the fields you need to keep", primary: "d1", secondary: "queues" },
      { label: "Make a list of jobs for later", primary: "queues", secondary: "d1" },
    ],
  },
  {
    id: "media-folder",
    prompt: "A folder of photos and clips lands on your desk.",
    options: [
      { label: "Give every file one obvious home", primary: "r2", secondary: "d1" },
      { label: "Sort the details into something you can query", primary: "d1", secondary: "r2" },
      { label: "Keep a small index for the lookups you repeat", primary: "workers-kv", secondary: "workers-ai" },
      { label: "See what a model makes of the odd ones", primary: "workers-ai", secondary: "workers-kv" },
    ],
  },
  {
    id: "long-job",
    prompt: "The upload finishes and a long job begins.",
    options: [
      { label: "Store the original somewhere safe", primary: "r2", secondary: "queues" },
      { label: "Hand the slow part to something that can wait", primary: "queues", secondary: "r2" },
      { label: "Write each step down so it can resume", primary: "workflows", secondary: "workers-kv" },
      { label: "Keep a short note of what just happened", primary: "workers-kv", secondary: "workflows" },
    ],
  },
  {
    id: "two-editors",
    prompt: "Two people open the same document at once.",
    options: [
      { label: "Give the page one shared, live state", primary: "durable-objects", secondary: "workers" },
      { label: "Serve it from the nearest edge", primary: "workers", secondary: "durable-objects" },
      { label: "Track the merge as a multistep job", primary: "workflows", secondary: "d1" },
      { label: "Check the last saved version in the table", primary: "d1", secondary: "workflows" },
    ],
  },
  {
    id: "demo-intelligence",
    prompt: "The demo needs a bit of intelligence.",
    options: [
      { label: "Ask a model and see what comes back", primary: "workers-ai", secondary: "workers-kv" },
      { label: "Use the answer you cached yesterday", primary: "workers-kv", secondary: "workers-ai" },
      { label: "Check the shared state everyone else trusts", primary: "durable-objects", secondary: "workers" },
      { label: "Run the request from more than one place", primary: "workers", secondary: "durable-objects" },
    ],
  },
  {
    id: "half-finished",
    prompt: "A busy week leaves three half-finished jobs.",
    options: [
      { label: "Let a durable run pick up where it stopped", primary: "workflows", secondary: "queues" },
      { label: "Send each job to a waiting consumer", primary: "queues", secondary: "workflows" },
      { label: "Put the files somewhere with proper names", primary: "r2", secondary: "workers-ai" },
      { label: "Ask a model to summarise the mess", primary: "workers-ai", secondary: "r2" },
    ],
  },
  {
    id: "sudden-crowd",
    prompt: "A link goes unexpectedly popular.",
    options: [
      { label: "Serve the page from the nearest edge", primary: "workers", secondary: "workers-kv" },
      { label: "Cache the repeated answer", primary: "workers-kv", secondary: "workers" },
      { label: "Queue the flood of follow-up work", primary: "queues", secondary: "durable-objects" },
      { label: "Keep the shared counter in one place", primary: "durable-objects", secondary: "queues" },
    ],
  },
  {
    id: "what-it-remembers",
    prompt: "The project is nearly done and someone asks what it remembers.",
    options: [
      { label: "Point at the files with sensible names", primary: "r2", secondary: "d1" },
      { label: "Show the table with the whole story", primary: "d1", secondary: "r2" },
      { label: "Show the run that survived every retry", primary: "workflows", secondary: "workers-ai" },
      { label: "Show the model call that made the weird bit", primary: "workers-ai", secondary: "workflows" },
    ],
  },
];

export const cloudflarePersonaQuestionCount = cloudflarePersonaQuestions.length;
export const cloudflarePersonaPath = experiencePath("developer-type");

export interface CloudflarePersonaTally {
  readonly id: CloudflarePersonaId;
  readonly score: number;
  /** How often this outcome was the player’s direct (primary) choice. */
  readonly direct: number;
  /** The earliest question answered directly for this outcome, or Infinity. */
  readonly firstDirect: number;
}

function compareTallies(a: CloudflarePersonaTally, b: CloudflarePersonaTally): number {
  return b.score - a.score
    || b.direct - a.direct
    || a.firstDirect - b.firstDirect
    || cloudflarePersonaIds.indexOf(a.id) - cloudflarePersonaIds.indexOf(b.id);
}

/** Every outcome’s total for one complete run, best first. Null until every
 * question has one valid option index. */
export function tallyCloudflarePersona(answers: unknown): CloudflarePersonaTally[] | null {
  if (!Array.isArray(answers) || answers.length !== cloudflarePersonaQuestionCount) return null;
  const tallies = new Map<CloudflarePersonaId, { score: number; direct: number; firstDirect: number }>();
  for (const id of cloudflarePersonaIds) {
    tallies.set(id, { score: 0, direct: 0, firstDirect: Number.POSITIVE_INFINITY });
  }
  for (let index = 0; index < cloudflarePersonaQuestionCount; index += 1) {
    const choice = answers[index];
    const question = cloudflarePersonaQuestions[index];
    if (typeof choice !== "number" || !Number.isInteger(choice) || choice < 0 || choice >= question.options.length) {
      return null;
    }
    const option = question.options[choice];
    const primary = tallies.get(option.primary)!;
    primary.score += 2;
    primary.direct += 1;
    primary.firstDirect = Math.min(primary.firstDirect, index);
    tallies.get(option.secondary)!.score += 1;
  }
  return cloudflarePersonaIds
    .map((id) => ({ id, ...tallies.get(id)! }))
    .sort(compareTallies);
}

/** The deterministic result for one complete run, or null while it is
 * incomplete or malformed. */
export function resolveCloudflarePersona(answers: unknown): CloudflarePersonaId | null {
  return tallyCloudflarePersona(answers)?.[0]?.id ?? null;
}

/** A shared result names exactly one known outcome and never carries an answer.
 * Only the `result` parameter is read, so unrelated share parameters cannot
 * invent an answer; a repeated value is ambiguous, and a missing or unknown
 * value falls back to a fresh quiz. */
export function cloudflarePersonaOutcomeFromHash(hash: string): CloudflarePersonaId | null {
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const value = params.get("result");
  return params.size === 1 && value && Object.hasOwn(cloudflarePersonaOutcomes, value)
    ? value as CloudflarePersonaId : null;
}

/** The one answer-free result address: the canonical public quiz route plus a
 * trusted outcome ID. */
export function cloudflarePersonaResultPath(id: CloudflarePersonaId): string {
  return `${cloudflarePersonaPath}#result=${id}`;
}

import { z } from "zod";

export const feedbackInbox = "/_emdash/admin/plugins/composer-stacks/enquiries";
export const feedbackEndpoint = "/_emdash/api/owner-feedback";
export const feedbackKinds = {
  problem: "Problem",
  question: "Question",
  direction: "Direction",
  preference: "Preference",
  praise: "Praise",
  improvement: "Improvement",
} as const;

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/);
const revision = z.string().regex(/^[a-f0-9]{40,64}$/);
const note = z.string().max(4000).refine((value) => value.trim().length > 0);
const position = z.number().int().min(0).max(35000);
export const feedbackTarget = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("page"),
    path: z.string().max(220).regex(/^\/(?:[a-z0-9][a-z0-9/-]*)?$/),
    revision,
  }),
  z.strictObject({ type: z.literal("artwork"), id, revision }),
  z.strictObject({
    type: z.literal("film"),
    id: z.literal("keep-a-copy"),
    revision,
    startMs: position,
    endMs: position.optional(),
  }),
  z.strictObject({ type: z.literal("decision"), id, revision }),
]);
export type FeedbackTarget = z.infer<typeof feedbackTarget>;

export function feedbackKey(target: FeedbackTarget) {
  return target.type + ":" + (target.type === "page" ? target.path : target.id);
}

export const feedbackEvidenceUrl = z.url({ protocol: /^https$/, hostname: z.regexes.domain })
  .refine((href) => {
    const url = new URL(href);
    return !url.username && !url.password;
  }, "Use an HTTPS source link without credentials.");

export const ownerActions = {
  reply: "Add a reply",
  keep: "Keep improving",
  return: "Return with feedback",
  partial: "Accept parts",
  satisfied: "Satisfied — close incident",
  reopen: "Reopen incident",
  attempt: "Record a delivered attempt",
} as const;

export const feedbackMutation = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("open"),
    requestId: z.uuid(),
    target: feedbackTarget,
    kind: z.enum(Object.keys(feedbackKinds) as [keyof typeof feedbackKinds]),
    note,
    incident: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("attempt"),
    requestId: z.uuid(),
    threadId: z.uuid(),
    revision: z.number().int().positive(),
    note,
    evidence: z.array(feedbackEvidenceUrl).min(1).max(6),
  }),
  z.strictObject({
    action: z.enum(["reply", "keep", "return", "partial", "satisfied", "reopen"]),
    requestId: z.uuid(),
    threadId: z.uuid(),
    revision: z.number().int().positive(),
    note,
  }),
]);

export type FeedbackContext = {
  key: string;
  title: string;
  project: string;
  url: string;
  environment: string;
  build: string;
  target: FeedbackTarget;
  incident: boolean;
};

export type FeedbackEvent = {
  id: string;
  threadId: string;
  revision: number;
  kind: string;
  actor: string;
  actorId: string;
  isOwner: boolean;
  note: string;
  createdAt: string;
  context: FeedbackContext | { evidence?: string[] };
};

export type FeedbackThread = {
  id: string;
  context: FeedbackContext;
  state: "open" | "closed";
  next: "agent" | "owner" | null;
  awaiting: "attempt" | "question" | null;
  events: FeedbackEvent[];
};

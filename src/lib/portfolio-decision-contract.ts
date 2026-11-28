import { z } from "zod";

const id = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
const text = (limit: number) => z.string().trim().min(1).max(limit);
const source = z
  .object({
    label: text(120),
    url: z.url({ protocol: /^https$/ }).max(2048),
  })
  .strict();

export const adminDecisions =
  "/_emdash/admin/plugins/composer-decisions/review";
export const decisionPreview = (id: string) =>
  `/_emdash/api/decision-art/${id}`;

export const maxDecisionImageBytes = 512 * 1024;
export const decisionImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const decisionImageUrl = (id: string, revision: number) =>
  `/_emdash/api/decision-image/${id}/${revision}`;

export const readDecisions = z
  .object({
    id: id.optional(),
    beforeRevision: z.number().int().positive().optional(),
  })
  .strict()
  .refine((input) => !input.beforeRevision || !!input.id);

export const decisionCategories = [
  "Product direction",
  "Creative review",
  "Workflow",
  "Discovery",
  "Working preferences",
] as const;

export const decisionReactionLabels = {
  useful: "Useful question",
  "needs-work": "Question needs work",
} as const;
export type DecisionReaction = keyof typeof decisionReactionLabels;

export const decisionMediaUrl = z
  .url({ protocol: /^https$/ })
  .max(2048)
  .refine((value) => {
    const url = URL.parse(value);
    return !!url && !url.username && !url.password;
  }, "Use an HTTPS link without credentials.");

const image = z
  .object({
    name: text(160),
    type: z.enum(decisionImageTypes),
    data: z
      .string()
      .min(12)
      .max(4 * Math.ceil(maxDecisionImageBytes / 3)),
  })
  .strict();
export const saveDecision = z
  .object({
    id,
    revision: z.number().int().nonnegative(),
    briefRevision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    selected: z.array(id).max(5),
    note: z.string().trim().max(4000),
    reaction: z.enum(["useful", "needs-work"]).nullable().optional(),
    recommendationToken: z.string().max(120).optional(),
    media: z.array(decisionMediaUrl).max(4).optional(),
    image: image.nullable().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (new Set(input.selected).size !== input.selected.length)
      ctx.addIssue({
        code: "custom",
        message: "Select each option only once.",
      });
  });

const option = z
  .object({
    id,
    title: text(100),
    pitch: text(400),
    outcome: text(400),
    pro: text(300),
    con: text(300),
    preview: z.enum(["press", "signal", "parts"]).optional(),
  })
  .strict();
const fields = {
  project: text(80),
  question: text(180),
  context: text(800),
  maxSelections: z.number().int().min(1).max(5),
  sources: z.array(source).min(1).max(8),
};
export const newDecision = z
  .object({
    ...fields,
    category: z.enum(decisionCategories).optional(),
    tags: z.array(text(32)).max(5).optional(),
    followUpTo: id.optional(),
    allowAll: z.boolean().optional(),
    requestId: z
      .uuid()
      .regex(/^[a-f0-9-]+$/)
      .describe("Client UUID kept unchanged when retrying this brief."),
    options: z
      .array(option.omit({ preview: true }))
      .min(2)
      .max(5),
    recommendation: z
      .object({
        choice: id,
        confidence: z.number().min(0).max(1),
        basis: text(600),
      })
      .strict(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const ids = new Set(input.options.map((option) => option.id));
    if (
      ids.size !== input.options.length ||
      ids.has("all-of-the-above") ||
      ids.has("none-of-the-above") ||
      additionalChoices.some((choice) => ids.has(choice.id)) ||
      !ids.has(input.recommendation.choice) ||
      input.maxSelections > ids.size
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Use distinct option IDs, a matching recommendation and a valid selection limit.",
      });
  });

export type Decision = {
  id: string;
  archived?: boolean;
  category?: (typeof decisionCategories)[number];
  tags?: string[];
  followUpTo?: string;
  allowAll?: boolean;
  interview?: string;
  subject?: { assetId: string; revision: string; thumbnailUrl?: string };
  project: string;
  question: string;
  context: string;
  maxSelections: number;
  sources: z.infer<typeof source>[];
  options: (z.infer<typeof option> & { weight?: number })[];
  recommendationReview?: {
    status: "supported" | "owner-judgement" | "weak-evidence" | "stale";
    evaluatedAt: string;
    token?: string;
  };
  recommendation?: {
    choice: string;
    confidence: number;
    basis: string;
    method: "clef" | "submitted";
  };
};

export const allDecisionChoices = "all-of-the-above";
export const noDecisionChoice = "none-of-the-above";
export const rejectDecisionChoice = "reject-the-premise";
export const deferDecisionChoice = "defer-this-question";
export const delegateDecisionChoice = "delegate-this-question";

const additionalChoices = [
  { id: rejectDecisionChoice, title: "Reject the premise" },
  { id: deferDecisionChoice, title: "Defer this question" },
  { id: delegateDecisionChoice, title: "Delegate this question" },
];

export function specialDecisionChoices(decision: Decision) {
  return [
    ...(decision.options.length > 1 &&
    (decision.allowAll ?? decision.maxSelections > 1)
      ? [{ id: allDecisionChoices, title: "All of the above" }]
      : []),
    ...(decision.options.some((option) => option.id === "none")
      ? []
      : [{ id: noDecisionChoice, title: "None of the above" }]),
    ...additionalChoices.filter(
      (choice) => !decision.options.some((option) => option.id === choice.id),
    ),
  ];
}

export function decisionChoiceTitle(decision: Decision, id: string) {
  return (
    decision.options.find((option) => option.id === id)?.title ??
    specialDecisionChoices(decision).find((option) => option.id === id)
      ?.title ??
    id
  );
}

export type DecisionImage = {
  name: string;
  revision: number;
};
export type DecisionResponse = {
  selected: string[];
  note: string;
  revision: number;
  savedAt: string;
  media: string[];
  reaction: DecisionReaction | null;
  image: DecisionImage | null;
};

export type DecisionReadiness =
  | "ready"
  | "needs-evidence"
  | "needs-reframing"
  | "already-answered"
  | "superseded"
  | "deferred";

export type DecisionInterpretation = {
  version: string;
  responseRevision: number;
  kind:
    | "supports-choice"
    | "rejects-premise"
    | "mixed"
    | "unclear"
    | "deferred"
    | "delegated";
  accepted: string[];
  rejected: string[];
  unresolved: string[];
  evidence: {
    decisionId: string;
    responseRevision: number;
    selected: string[];
    reaction: DecisionReaction | null;
    noteExcerpts: string[];
    referenceCount: number;
    prior?: { decisionId: string; responseRevision: number };
  };
  reason: string;
  confidence: "explicit" | "inferred" | "uncertain";
};

export const decisionPriorityFactors = {
  mission: { label: "Mission contribution", weight: 30 },
  impact: { label: "Evidenced owner or user impact", weight: 25 },
  unblocks: { label: "Ready work unblocked", weight: 20 },
  information: { label: "How much an answer changes the action", weight: 15 },
  timing: { label: "Time sensitivity", weight: 10 },
} as const;

export type DecisionPriority = {
  version: string;
  briefKey: string;
  score: number;
  factors: Record<keyof typeof decisionPriorityFactors, number>;
  rationale: string;
  source: { label: string; url: string };
  ownerEffort: number;
  implementationEffort: number;
};

export type DecisionReview = {
  readiness: DecisionReadiness;
  reason: string;
  nextActor: "owner" | "agent" | "none";
  source?: DecisionPriority["source"];
  priority?: DecisionPriority;
};

export type DecisionSummary = Pick<
  Decision,
  "id" | "project" | "question" | "archived" | "interview" | "category" | "tags"
> &
  DecisionReview & {
    status: "open" | "context" | "selected";
    hasArtwork: boolean;
  };

export type LinkedDecision = Pick<Decision, "id" | "question"> & {
  url: string;
};

export type DecisionDetail = {
  decision: Decision;
  briefRevision: string;
  review: DecisionReview;
  interpretation: DecisionInterpretation | null;
  response: DecisionResponse | null;
  earlier: DecisionResponse[];
  historyHasMore: boolean;
  previousBrief?: LinkedDecision & {
    decision: Decision;
    response: DecisionResponse | null;
  };
  followUps: LinkedDecision[];
  url: string;
};

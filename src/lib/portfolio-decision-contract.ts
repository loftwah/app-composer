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

export const readDecisions = z.object({ id: id.optional() }).strict();
export const saveDecision = z
  .object({
    id,
    revision: z.number().int().nonnegative(),
    selected: z.array(id).max(5),
    note: z.string().trim().max(4000),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.selected.length && !input.note)
      ctx.addIssue({
        code: "custom",
        message: "Select an option or add context.",
      });
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
  interview?: string;
  subject?: { assetId: string; revision: string };
  project: string;
  question: string;
  context: string;
  maxSelections: number;
  sources: z.infer<typeof source>[];
  options: (z.infer<typeof option> & { weight?: number })[];
  recommendation?: {
    choice: string;
    confidence: number;
    basis: string;
    method: "clef" | "submitted";
  };
};

export type DecisionResponse = {
  selected: string[];
  note: string;
  revision: number;
  savedAt: string;
};

export type DecisionSummary = Pick<
  Decision,
  "id" | "project" | "question" | "archived" | "interview"
> & {
  status: "open" | "context" | "selected";
  hasArtwork: boolean;
};

export type DecisionDetail = {
  decision: Decision;
  response: DecisionResponse | null;
  url: string;
};

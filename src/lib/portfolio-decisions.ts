import type { D1Database } from "@cloudflare/workers-types";
import { PluginRouteError } from "emdash";
import briefs from "../data/portfolio-decisions.json";
import evidence from "../data/portfolio-decision-results.json";
import {
  adminDecisions,
  type Decision,
  type DecisionDetail,
  type DecisionResponse,
  type DecisionSummary,
  type newDecision,
  type saveDecision,
} from "./portfolio-decision-contract.ts";
import type { z } from "zod";

type Score = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
const scores: Record<string, Score> = Object.assign(
  {},
  ...evidence.calls.map((call) => call.answers),
);
const initial = briefs.map(({ target: _, ...brief }): Decision => {
  const score = scores[brief.id.replaceAll("-", "_")];
  return {
    ...brief,
    options: brief.options.map((option) => ({
      ...option,
      preview:
        "preview" in option
          ? (option.preview as Decision["options"][number]["preview"])
          : undefined,
      weight: score.probabilities[option.id.replaceAll("-", "_")],
    })),
    recommendation: {
      choice: score.choice.replaceAll("_", "-"),
      confidence: score.confidence,
      method: "clef",
      basis:
        brief.id === "composer-art"
          ? "Cloudflare Clef-flash compared these three rendered posters. Owner preference and feed performance are still unknown."
          : "Cloudflare Clef-flash compared these written proposals. Audience response and impact are still unknown.",
    },
  };
});

type ResponseRow = {
  selected: string;
  note: string;
  revision: number;
  saved_at: string;
};
type BriefRow = { brief: string };
const readResponse = (row: ResponseRow): DecisionResponse => ({
  selected: JSON.parse(row.selected) as string[],
  note: row.note,
  revision: row.revision,
  savedAt: row.saved_at,
});

async function getBrief(db: D1Database, owner: string, id: string) {
  const seed = initial.find((brief) => brief.id === id);
  if (seed) return seed;
  const row = await db
    .prepare(
      "SELECT brief FROM composer_decision_briefs WHERE owner_id = ? AND decision_id = ?",
    )
    .bind(owner, id)
    .first<BriefRow>();
  if (!row)
    throw new PluginRouteError(
      "NOT_FOUND",
      "That decision could not be found.",
      404,
    );
  return JSON.parse(row.brief) as Decision;
}

export async function getDecision(
  db: D1Database,
  owner: string,
  id: string,
): Promise<DecisionDetail> {
  const decision = await getBrief(db, owner, id);
  const response = await db
    .prepare(
      `
    SELECT selected, note, revision, saved_at FROM composer_decision_responses
    WHERE owner_id = ? AND decision_id = ? ORDER BY revision DESC LIMIT 1
  `,
    )
    .bind(owner, id)
    .first<ResponseRow>();
  return {
    decision,
    response: response ? readResponse(response) : null,
    url: `${adminDecisions}?id=${decision.id}`,
  };
}

export async function listDecisions(
  db: D1Database,
  owner: string,
): Promise<DecisionSummary[]> {
  const [briefs, replies] = await db.batch<
    BriefRow | { decision_id: string; selected: string }
  >([
    db
      .prepare(
        `
      SELECT brief FROM composer_decision_briefs WHERE owner_id = ?
      ORDER BY created_at DESC, decision_id
    `,
      )
      .bind(owner),
    db
      .prepare(
        `
      SELECT decision_id, selected FROM composer_decision_responses AS response
      WHERE owner_id = ? AND revision = (
        SELECT MAX(revision) FROM composer_decision_responses
        WHERE owner_id = response.owner_id AND decision_id = response.decision_id
      )
    `,
      )
      .bind(owner),
  ]);
  const selections = new Map(
    replies.results.map((row) => {
      const { decision_id, selected } = row as {
        decision_id: string;
        selected: string;
      };
      return [decision_id, selected] as const;
    }),
  );
  const submitted = briefs.results.map(
    (row) => JSON.parse((row as BriefRow).brief) as Decision,
  );
  return [...initial, ...submitted].map(
    ({ id, project, question, options }) => ({
      id,
      project,
      question,
      status: !selections.has(id)
        ? "open"
        : selections.get(id) === "[]"
          ? "context"
          : "selected",
      hasArtwork: options.some((option) => Boolean(option.preview)),
    }),
  );
}

export async function recordDecision(
  db: D1Database,
  owner: string,
  input: z.infer<typeof saveDecision>,
) {
  const decision = await getBrief(db, owner, input.id);
  if (
    input.selected.length > decision.maxSelections ||
    input.selected.some(
      (id) => !decision.options.some((option) => option.id === id),
    )
  ) {
    throw new PluginRouteError(
      "INVALID_CHOICES",
      "Check the choices and selection limit for this decision.",
      400,
    );
  }
  const saved = await db
    .prepare(
      `
    INSERT INTO composer_decision_responses (owner_id, decision_id, revision, selected, note, saved_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE ? = COALESCE((
      SELECT MAX(revision) FROM composer_decision_responses WHERE owner_id = ? AND decision_id = ?
    ), 0)
    ON CONFLICT (owner_id, decision_id, revision) DO NOTHING
    RETURNING selected, note, revision, saved_at
  `,
    )
    .bind(
      owner,
      input.id,
      input.revision + 1,
      JSON.stringify(input.selected),
      input.note,
      new Date().toISOString(),
      input.revision,
      owner,
      input.id,
    )
    .first<ResponseRow>();
  if (!saved)
    throw new PluginRouteError(
      "STALE_RESPONSE",
      "A newer response exists. Reload it before saving your changes.",
      409,
    );
  return readResponse(saved);
}

export async function addDecision(
  db: D1Database,
  owner: string,
  input: z.infer<typeof newDecision>,
) {
  const { requestId, recommendation, ...brief } = input;
  const decision: Decision = {
    ...brief,
    id: `brief-${requestId}`,
    recommendation: { ...recommendation, method: "submitted" },
  };
  const encoded = JSON.stringify(decision);
  const inserted = await db
    .prepare(
      `
    INSERT INTO composer_decision_briefs (owner_id, decision_id, brief, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (owner_id, decision_id) DO NOTHING RETURNING brief
  `,
    )
    .bind(owner, decision.id, encoded, new Date().toISOString())
    .first<BriefRow>();
  if (
    !inserted &&
    JSON.stringify(await getBrief(db, owner, decision.id)) !== encoded
  )
    throw new PluginRouteError(
      "DUPLICATE_BRIEF",
      "This request ID already belongs to a different brief.",
      409,
    );
  return { decision, url: `${adminDecisions}?id=${decision.id}` };
}

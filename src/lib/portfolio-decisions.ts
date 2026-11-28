import type { D1Database } from "@cloudflare/workers-types";
import { PluginRouteError } from "emdash";
import briefs from "../data/portfolio-decisions.json";
import evidence from "../data/portfolio-decision-results.json";
import followups from "../data/portfolio-decision-followups.json";
import followupEvidence from "../data/portfolio-decision-followup-results.json";
import recommendationRun from "../data/decision-recommendations.json";
import {
  decisionRecommendationKey,
  decisionRecommendationLifetimeMs,
} from "./decision-recommendation.ts";
import { feedbackFollowUps, replacedDecisions } from "./decision-followups.ts";
import { interpretDecision, reviewDecision } from "./decision-review.ts";
import { policyQuestions, socialReview } from "./decision-intelligence.ts";
import { interviewQuestions } from "./decision-interviews.ts";
import {
  artworkRevision,
  publicShareArtwork,
} from "./share-catalogue-asset.ts";
import {
  adminDecisions,
  maxDecisionImageBytes,
  specialDecisionChoices,
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
  followupEvidence.answers,
);
const previousCategories: Record<string, Decision["category"]> = {
  "inventory-classification": "Discovery",
  "campaign-jobs": "Creative review",
  "composer-live-example": "Product direction",
  "share-first-find": "Discovery",
  "studio-case-study": "Creative review",
  "paperwork-first-job": "Workflow",
  "spin-first-run": "Workflow",
  "public-card-proof": "Creative review",
  "prints-first-task": "Workflow",
  "radio-release-proof": "Discovery",
  "project-proof-next": "Workflow",
  "owner-feedback-next": "Working preferences",
  "composer-art": "Creative review",
  "composer-entry": "Product direction",
};
const scored: Decision[] = [
  ...followups.map((brief) => ({ ...brief, archived: false })),
  ...briefs.map((brief) => ({ ...brief, archived: true })),
].map(({ target: _, ...brief }): Decision => {
  const score = scores[brief.id.replaceAll("-", "_")];
  return {
    ...brief,
    archived: brief.archived || replacedDecisions.has(brief.id),
    category: previousCategories[brief.id],
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

const initial = [...feedbackFollowUps, ...scored];
const seedBriefs = new Map(
  [...initial, ...interviewQuestions, ...policyQuestions].map((brief) => [
    brief.id,
    brief,
  ]),
);

type ResponseRow = {
  selected: string;
  note: string;
  revision: number;
  saved_at: string;
  media: string;
  image_revision: number | null;
  image_name: string | null;
  reaction: DecisionResponse["reaction"];
};
type BriefRow = { brief: string };
const responseFields =
  "selected, note, revision, saved_at, media, image_revision, image_name, reaction";
const readResponse = (row: ResponseRow): DecisionResponse => ({
  selected: JSON.parse(row.selected) as string[],
  note: row.note,
  revision: row.revision,
  savedAt: row.saved_at,
  media: JSON.parse(row.media) as string[],
  reaction: row.reaction,
  image:
    row.image_revision && row.image_name
      ? { revision: row.image_revision, name: row.image_name }
      : null,
});
const briefLink = ({ id, question }: Decision) => ({
  id,
  question,
  url: `${adminDecisions}?id=${id}`,
});

async function briefRevision(decision: Decision) {
  const values = [
    await decisionRecommendationKey(decision),
    decision.id,
    decision.subject?.revision,
    decision.followUpTo,
  ];
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(values)),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

type Assessment = {
  key: string;
  choice?: string;
  confidence?: number;
  weights?: Record<string, number>;
  reason?: "owner-judgement" | "weak-evidence";
};
const assessments: Record<string, Assessment> =
  recommendationRun.decisions as Record<string, Assessment>;
async function assessedBrief(decision: Decision): Promise<Decision> {
  const assessment = assessments[decision.id];
  if (!assessment) return decision;
  const evaluatedAt = recommendationRun.evaluated;
  const stale =
    Date.now() - Date.parse(evaluatedAt) > decisionRecommendationLifetimeMs ||
    assessment.key !== (await decisionRecommendationKey(decision));
  const { choice, confidence, weights, reason } = assessment;
  const status = stale ? "stale" : (reason ?? "supported");
  return {
    ...decision,
    recommendationReview: {
      status,
      evaluatedAt,
      ...(status === "supported"
        ? { token: `${evaluatedAt}:${assessment.key}` }
        : {}),
    },
    recommendation:
      status === "supported" && choice && confidence !== undefined
        ? {
            choice,
            confidence,
            method: "clef",
            basis:
              "Clef compared the written choices against the supplied public project evidence. It can flag what the evidence supports.",
          }
        : undefined,
    options: decision.options.map((option) => ({
      ...option,
      weight: status === "supported" ? weights?.[option.id] : undefined,
    })),
  };
}

export async function getBrief(db: D1Database, owner: string, id: string) {
  const seed = seedBriefs.get(id);
  if (seed) return assessedBrief(seed);
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

export async function decisionHistory(
  db: D1Database,
  owner: string,
  id: string,
  beforeRevision: number | null = null,
) {
  const rows = await db
    .prepare(
      `
      SELECT ${responseFields} FROM composer_decision_responses
      WHERE owner_id = ? AND decision_id = ? AND (? IS NULL OR revision < ?)
      ORDER BY revision DESC LIMIT 11
    `,
    )
    .bind(owner, id, beforeRevision, beforeRevision)
    .all<ResponseRow>();
  return {
    revisions: rows.results.slice(0, 10).map(readResponse),
    hasMore: rows.results.length > 10,
  };
}

export async function getDecision(
  db: D1Database,
  owner: string,
  id: string,
): Promise<DecisionDetail> {
  const decision = await getBrief(db, owner, id);
  const art = decision.subject?.thumbnailUrl
    ? await publicShareArtwork(decision.subject.assetId)
    : null;
  const visual =
    art?.status === 200 &&
    decision.subject?.thumbnailUrl === art.artwork.thumbnailUrl &&
    (await artworkRevision(art.artwork)) === decision.subject.revision
      ? await socialReview(
          decision.subject.assetId,
          decision.subject.revision,
          art.artwork.thumbnailUrl,
          art.artwork,
        )
      : undefined;
  const [history, previous, linked] = await Promise.all([
    decisionHistory(db, owner, id),
    decision.followUpTo
      ? Promise.all([
          getBrief(db, owner, decision.followUpTo),
          decisionHistory(db, owner, decision.followUpTo),
        ])
      : null,
    db
      .prepare(
        `
      SELECT brief FROM composer_decision_briefs
      WHERE owner_id = ? AND json_extract(brief, '$.followUpTo') = ?
      ORDER BY created_at DESC, decision_id
    `,
      )
      .bind(owner, id)
      .all<BriefRow>(),
  ]);
  const response = history.revisions[0] ?? null;
  const interpretation = interpretDecision(
    decision,
    response,
    previous?.[1].revisions[0],
  );
  const [revision, review] = await Promise.all([
    briefRevision(decision),
    reviewDecision(decision, interpretation),
  ]);
  return {
    decision: visual
      ? {
          ...decision,
          context: `${decision.context} Clef’s thumbnail review suggests ${visual.placement.toLowerCase()}. ${visual.fix}.`,
        }
      : decision,
    briefRevision: revision,
    interpretation,
    review,
    response,
    earlier: history.revisions.slice(1),
    historyHasMore: history.hasMore,
    url: briefLink(decision).url,
    ...(previous
      ? {
          previousBrief: {
            ...briefLink(previous[0]),
            decision: previous[0],
            response: previous[1].revisions[0] ?? null,
          },
        }
      : {}),
    followUps: [
      ...feedbackFollowUps.filter((brief) => brief.followUpTo === id),
      ...linked.results.map((row) => JSON.parse(row.brief) as Decision),
    ].map(briefLink),
  };
}

export async function listDecisions(
  db: D1Database,
  owner: string,
): Promise<DecisionSummary[]> {
  type Reply = ResponseRow & { decision_id: string };
  const [briefs, replies] = await db.batch<BriefRow | Reply>([
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
      SELECT decision_id, ${responseFields} FROM composer_decision_responses AS response
      WHERE owner_id = ? AND revision = (
        SELECT MAX(revision) FROM composer_decision_responses
        WHERE owner_id = response.owner_id AND decision_id = response.decision_id
      )
    `,
      )
      .bind(owner),
  ]);
  const responses = new Map(
    replies.results.map((row) => {
      const { decision_id } = row as Reply;
      return [decision_id, readResponse(row as Reply)] as const;
    }),
  );
  const submitted = briefs.results.map(
    (row) => JSON.parse((row as BriefRow).brief) as Decision,
  );
  const candidates = [
    ...initial.filter((brief) => !brief.archived),
    ...submitted,
    ...interviewQuestions,
    ...policyQuestions,
    ...initial.filter((brief) => brief.archived),
  ];
  const queue = await Promise.all(
    candidates.map(async (decision): Promise<DecisionSummary> => {
      const {
        id,
        project,
        question,
        options,
        archived,
        interview,
        category,
        tags,
      } = decision;
      const response = responses.get(id) ?? null;
      const prior = decision.followUpTo
        ? responses.get(decision.followUpTo)
        : undefined;
      const review = await reviewDecision(
        decision,
        interpretDecision(decision, response, prior),
      );
      return {
        id,
        project,
        question,
        archived,
        interview,
        category,
        tags,
        ...review,
        status: !response
          ? "open"
          : !response.selected.length
            ? "context"
            : "selected",
        hasArtwork: options.some((option) => Boolean(option.preview)),
      };
    }),
  );
  return queue.sort((left, right) => {
    const a = left.priority;
    const b = right.priority;
    if (a && b)
      return (
        b.score - a.score ||
        a.ownerEffort - b.ownerEffort ||
        a.implementationEffort - b.implementationEffort ||
        left.id.localeCompare(right.id)
      );
    return Number(Boolean(b)) - Number(Boolean(a));
  });
}

export async function recordDecision(
  db: D1Database,
  owner: string,
  input: z.infer<typeof saveDecision>,
) {
  const decision = await getBrief(db, owner, input.id);
  if (
    input.briefRevision &&
    input.briefRevision !== (await briefRevision(decision))
  )
    throw new PluginRouteError(
      "STALE_BRIEF",
      "The question changed. Read the current brief before saving an answer.",
      409,
    );
  if (
    input.recommendationToken !== undefined &&
    (input.recommendationToken !== decision.recommendationReview?.token ||
      input.selected.length !== 1 ||
      input.selected[0] !== decision.recommendation?.choice)
  )
    throw new PluginRouteError(
      "STALE_RECOMMENDATION",
      "This suggestion changed. Reload the question or choose your own answer.",
      409,
    );
  if (decision.subject) {
    const current = await publicShareArtwork(decision.subject.assetId);
    if (current.status === 503)
      throw new PluginRouteError(
        "CATALOGUE_UNAVAILABLE",
        "Share is unavailable. Your answer has not been saved.",
        503,
      );
    if (
      current.status !== 200 ||
      (await artworkRevision(current.artwork)) !== decision.subject.revision
    )
      throw new PluginRouteError(
        "ARTWORK_CHANGED",
        "This artwork revision is no longer current. Open the latest item from the Share index.",
        409,
      );
  }
  const special = specialDecisionChoices(decision);
  const explicitChoice = input.selected.some((id) =>
    special.some((option) => option.id === id),
  );
  if (
    input.selected.length > decision.maxSelections ||
    (explicitChoice && input.selected.length !== 1) ||
    input.selected.some(
      (id) =>
        !decision.options.some((option) => option.id === id) &&
        !special.some((option) => option.id === id),
    )
  ) {
    throw new PluginRouteError(
      "INVALID_CHOICES",
      "Check the choices and selection limit for this decision.",
      400,
    );
  }

  const image = input.image;
  if (image) {
    let bytes = "";
    try {
      bytes = atob(image.data);
    } catch {
      // The validation below reports malformed input.
    }
    const signatureMatches =
      (image.type === "image/png" && bytes.startsWith("\x89PNG\r\n\x1a\n")) ||
      (image.type === "image/jpeg" && bytes.startsWith("\xff\xd8\xff")) ||
      (image.type === "image/webp" &&
        bytes.startsWith("RIFF") &&
        bytes.slice(8, 12) === "WEBP");
    if (!signatureMatches || bytes.length > maxDecisionImageBytes)
      throw new PluginRouteError(
        "INVALID_IMAGE",
        "Choose a PNG, JPEG or WebP image up to 512 KB.",
        400,
      );
  }
  const previous =
    input.revision === 0
      ? null
      : await db
          .prepare(
            `
    SELECT media, image_revision, image_name, reaction FROM composer_decision_responses
    WHERE owner_id = ? AND decision_id = ? AND revision = ?
  `,
          )
          .bind(owner, input.id, input.revision)
          .first<
            Pick<
              ResponseRow,
              "media" | "image_revision" | "image_name" | "reaction"
            >
          >();
  const media = input.media
    ? JSON.stringify(input.media)
    : (previous?.media ?? "[]");
  const imageRevision = image
    ? input.revision + 1
    : image === null
      ? null
      : (previous?.image_revision ?? null);
  const imageName = image
    ? image.name
    : image === null
      ? null
      : (previous?.image_name ?? null);
  const reaction =
    input.reaction === undefined
      ? (previous?.reaction ?? null)
      : input.reaction;
  if (
    !input.selected.length &&
    !input.note &&
    media === "[]" &&
    !imageRevision &&
    !reaction
  )
    throw new PluginRouteError(
      "EMPTY_RESPONSE",
      "Choose an answer or leave feedback.",
      400,
    );

  const saved = await db
    .prepare(
      `
    INSERT INTO composer_decision_responses
      (owner_id, decision_id, revision, selected, note, saved_at, media, image_revision, image_name, image_type, image_data, reaction)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ? = COALESCE((
      SELECT MAX(revision) FROM composer_decision_responses WHERE owner_id = ? AND decision_id = ?
    ), 0)
    ON CONFLICT (owner_id, decision_id, revision) DO NOTHING
    RETURNING ${responseFields}
  `,
    )
    .bind(
      owner,
      input.id,
      input.revision + 1,
      JSON.stringify(input.selected),
      input.note,
      new Date().toISOString(),
      media,
      imageRevision,
      imageName,
      image?.type ?? null,
      image?.data ?? null,
      reaction,
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
  if (brief.followUpTo) {
    await getBrief(db, owner, brief.followUpTo);
    if (brief.followUpTo === `brief-${requestId}`)
      throw new PluginRouteError(
        "INVALID_FOLLOW_UP",
        "Choose an earlier decision for this follow-up.",
        400,
      );
  }
  const decision: Decision = {
    ...brief,
    id: `brief-${requestId}`,
    recommendation: { ...recommendation, method: "submitted" },
  };
  return storeDecisionBrief(db, owner, decision);
}

export async function storeDecisionBrief(
  db: D1Database,
  owner: string,
  decision: Decision,
) {
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
  if (!inserted) {
    const existing = await getBrief(db, owner, decision.id);
    const sameArtwork =
      decision.subject &&
      existing.subject?.assetId === decision.subject.assetId &&
      existing.subject?.revision === decision.subject.revision;
    if (sameArtwork)
      return { decision: existing, url: `${adminDecisions}?id=${decision.id}` };
    if (JSON.stringify(existing) !== encoded)
      throw new PluginRouteError(
        "DUPLICATE_BRIEF",
        "This request ID already belongs to a different brief.",
        409,
      );
  }
  return { decision, url: `${adminDecisions}?id=${decision.id}` };
}

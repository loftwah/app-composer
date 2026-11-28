import {
  allDecisionChoices,
  decisionChoiceTitle,
  decisionPriorityFactors,
  deferDecisionChoice,
  delegateDecisionChoice,
  noDecisionChoice,
  rejectDecisionChoice,
  specialDecisionChoices,
  type Decision,
  type DecisionInterpretation,
  type DecisionPriority,
  type DecisionResponse,
  type DecisionReview,
} from "./portfolio-decision-contract.ts";
import { decisionRecommendationKey } from "./decision-recommendation.ts";

export const decisionReviewVersion = "mission-2026-11-28.1";

// This intentionally abstains on language it cannot interpret. It never infers
// acceptance of a deliverable from a choice, a reaction, or a positive clause.
const reject =
  /\b(?:reject|wrong (?:question|premise|options?)|(?:choices?|options?|examples?|premise|question|goal|voice) (?:are |is |don't |doesn't |didn't )?(?:wrong|(?:do|does) not fit|(?:miss|capture|address) (?:the point|the goal|what I))|(?:don't|do not) (?:agree|like|approve|want)|(?:doesn't|does not) (?:fit|work|make sense|capture|answer)|(?:not|isn't|aren't) (?:really |very |particularly )?(?:what I|right|good|exciting|clear|useful|interesting)|none of (?:these|the above)|needs? (?:a different|reframing|rewriting))\b/i;
const accept =
  /\b(?:I (?:do )?(?:like|love|support|approve|agree)|works for me|(?:does|did) work|looks good|good as is|yes[,! ]|keep (?:the|this|that|those)|I(?:'m| am) happy with)\b/i;
const uncertain =
  /\b(?:(?:I(?:'m| am) )?not sure|unsure|unclear|(?:I )?don'?t know|do not know|not convinced|I guess|probably|might|maybe|need (?:more|to see|to know)|what do you mean)\b/i;

export function interpretDecision(
  decision: Decision,
  response: DecisionResponse | null,
  prior?: DecisionResponse | null,
): DecisionInterpretation | null {
  if (!response) return null;
  const { note, selected, reaction, revision, media, image } = response;
  const special = specialDecisionChoices(decision).map(({ id }) => id);
  const choices = selected.includes(allDecisionChoices)
    ? decision.options.map(({ title }) => title)
    : selected
        .filter((id) => !special.includes(id))
        .map((id) => decisionChoiceTitle(decision, id));
  const flags = new Set(selected.filter((id) => special.includes(id)));
  const clauses = note
    .split(
      /\n+|(?<=[.!?])\s+|\s+\b(?:but|however|although|even though)\b[\s,:]+/i,
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
  const classified = clauses.map((text) => {
    const normalized = text.replaceAll(/[‘’]/g, "'");
    return {
      text,
      kind: reject.test(normalized)
        ? "rejected"
        : uncertain.test(normalized)
          ? "uncertain"
          : accept.test(normalized)
            ? "accepted"
            : "unclassified",
    };
  });
  const excerpts = (kind: string) =>
    classified
      .filter((clause) => clause.kind === kind)
      .slice(0, 4)
      .map(({ text }) => text.slice(0, 280));
  const accepted = excerpts("accepted");
  const rejected = excerpts("rejected");
  const ambiguous = [
    ...excerpts("uncertain"),
    ...excerpts("unclassified"),
  ].slice(0, 4);
  const explicitRejection =
    flags.has(rejectDecisionChoice) || flags.has(noDecisionChoice);
  const hasRejection =
    explicitRejection || rejected.length > 0 || reaction === "needs-work";
  let kind: DecisionInterpretation["kind"] = "unclear";
  let reason =
    "Read the saved context and establish what the owner wants before acting.";
  let confidence: DecisionInterpretation["confidence"] = "uncertain";

  if (flags.has(deferDecisionChoice)) {
    kind = "deferred";
    reason = "The owner asked to return to this question later.";
    confidence = "explicit";
  } else if (flags.has(delegateDecisionChoice)) {
    kind = "delegated";
    reason =
      "The owner delegated the next step. Review the brief and any conditions in the response.";
    confidence = "explicit";
  } else if (hasRejection) {
    kind = accepted.length ? "mixed" : "rejects-premise";
    reason = accepted.length
      ? "Preserve the accepted parts and address the rejection before using this response to direct work."
      : "Address the feedback and reframe the question before asking again.";
    confidence =
      explicitRejection || reaction === "needs-work" ? "explicit" : "inferred";
  } else if (
    choices.length &&
    ambiguous.length === 0 &&
    !media.length &&
    !image
  ) {
    kind = "supports-choice";
    reason =
      "The saved response supports the selected direction. Confirm any delivery or satisfaction separately.";
    confidence = note ? "inferred" : "explicit";
  }

  return {
    version: decisionReviewVersion,
    responseRevision: revision,
    kind,
    accepted: kind === "supports-choice" ? [...choices, ...accepted] : accepted,
    rejected: [
      ...(explicitRejection
        ? selected.map((id) => decisionChoiceTitle(decision, id))
        : []),
      ...rejected,
    ],
    unresolved: [...(kind !== "supports-choice" ? choices : []), ...ambiguous],
    evidence: {
      decisionId: decision.id,
      responseRevision: revision,
      selected,
      reaction,
      noteExcerpts: [...accepted, ...rejected, ...ambiguous],
      referenceCount: media.length + Number(Boolean(image)),
      ...(prior && decision.followUpTo
        ? {
            prior: {
              decisionId: decision.followUpTo,
              responseRevision: prior.revision,
            },
          }
        : {}),
    },
    reason,
    confidence,
  };
}

const designProof = {
  label: "Rendered phone openings and Clef comparison, 28 November",
  url: "https://github.com/loftwah/app-composer/blob/46c1448f/docs/design-evidence/20261128/quick/README.md",
};
const missionProof = {
  label: "Composer product mission and first-app proof",
  url: "https://github.com/loftwah/app-composer/blob/f2f9b7ac/PRODUCT.md#delivery-target-and-roadmap",
};
type PriorityInput = Omit<DecisionPriority, "score" | "version"> & {
  briefKey: string;
};
const priorities: Record<string, PriorityInput> = {
  "composer-opening-design": {
    briefKey:
      "07b08ded4724e02789d57aac2e078ae9270bcafbcff3cb28c8adda9047e4dea7",
    factors: { mission: 4, impact: 4, unblocks: 4, information: 4, timing: 0 },
    ownerEffort: 1,
    implementationEffort: 2,
    rationale:
      "Choosing from the captured openings directs the entry to a creator’s first owned app build.",
    source: designProof,
  },
  "share-opening-design": {
    briefKey:
      "6f37e9519ad5275beeee035c4cd54a13992ff5364f17dbaca7cf6923ae0c414d",
    factors: { mission: 2, impact: 4, unblocks: 4, information: 4, timing: 0 },
    ownerEffort: 1,
    implementationEffort: 1,
    rationale:
      "The choice determines how much real work and which discovery action appear on the first phone screen.",
    source: designProof,
  },
  "studio-opening-design": {
    briefKey:
      "2ca7a4cf98ed59a19b14f319964307882ecb5ba4508379f62ea99dff608650bb",
    factors: { mission: 2, impact: 3, unblocks: 3, information: 4, timing: 0 },
    ownerEffort: 1,
    implementationEffort: 2,
    rationale:
      "The screen comparison exposes a real trade-off between getting to a clip edit and seeing the finished work first.",
    source: designProof,
  },
};

const sourceAnswered: Record<
  string,
  { briefKey: string; reason: string; source: DecisionPriority["source"] }
> = {
  "composer-newcomer-proof": {
    briefKey:
      "3a4a0a279054c25a947f9780a320decba2072c5f6a4b007ae4aea98ce8499cfb",
    reason:
      "Product direction already calls for starting from an owned app, deploying it and returning to change it. Run and document the journey with a newcomer.",
    source: missionProof,
  },
  "composer-feedback-entry": {
    briefKey:
      "c3c325e95db3edc16cc530b808587627e8bda8bef36bafe27ad32e783a7118ab",
    reason:
      "The project direction already asks for entry points at the relevant touchpoints. Map the missing entry points and verify signed-in and signed-out behaviour before requesting trade-offs.",
    source: {
      label: "Owner feedback findings, 28 November",
      url: "https://github.com/loftwah/app-composer/issues/1432#issuecomment-7237409420",
    },
  },
};

function scorePriority({
  briefKey,
  ...input
}: PriorityInput): DecisionPriority {
  const factors = Object.keys(
    decisionPriorityFactors,
  ) as (keyof typeof decisionPriorityFactors)[];
  const score = factors.reduce(
    (total, factor) =>
      total +
      (input.factors[factor] * decisionPriorityFactors[factor].weight) / 4,
    0,
  );
  return { ...input, score, briefKey, version: decisionReviewVersion };
}

export async function reviewDecision(
  decision: Decision,
  interpretation: DecisionInterpretation | null,
): Promise<DecisionReview> {
  if (decision.archived)
    return {
      readiness: "superseded",
      nextActor: "none",
      reason: "Earlier question retained with its responses and follow-ups.",
    };
  switch (interpretation?.kind) {
    case "deferred":
      return {
        readiness: "deferred",
        nextActor: "none",
        reason: interpretation.reason,
      };
    case "delegated":
    case "supports-choice":
      return {
        readiness: "already-answered",
        nextActor: "agent",
        reason: interpretation.reason,
      };
    case "mixed":
    case "rejects-premise":
      return {
        readiness: "needs-reframing",
        nextActor: "agent",
        reason: interpretation.reason,
      };
    case "unclear":
      return {
        readiness: "needs-evidence",
        nextActor: "agent",
        reason: interpretation.reason,
      };
  }
  const answer = sourceAnswered[decision.id];
  const priority = priorities[decision.id];
  const key =
    answer || priority ? await decisionRecommendationKey(decision) : null;
  if (answer?.briefKey === key)
    return {
      readiness: "already-answered",
      nextActor: "agent",
      reason: answer.reason,
      source: answer.source,
    };
  if (priority?.briefKey === key)
    return {
      readiness: "ready",
      nextActor: "owner",
      reason: priority.rationale,
      priority: scorePriority(priority),
    };
  // Interviews, artwork and policy prompts remain available on their own screens.
  return {
    readiness: "needs-evidence",
    nextActor: "agent",
    reason:
      "Identify the evidence and the concrete next action that depends on the owner’s answer.",
  };
}

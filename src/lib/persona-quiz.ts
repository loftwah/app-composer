import type { ExperienceId } from "./share-experiences.ts";

/** The shared “Which X are you?” engine used by the Developer Type Quiz and
 * the Language Type Quiz. A pack supplies its own original outcomes and
 * situations; this module owns the typed scoring, the deterministic tie-break,
 * the answer-free `#result=` fragment allow-list and the public result path.
 *
 * Scoring is deterministic: an option gives 2 to its primary outcome and 1 to
 * its paired secondary. The highest total wins. An exact tie goes to the
 * outcome the player chose directly (as primary) most often, then to the one
 * chosen directly earliest, then to the fixed outcome order below. Every pack
 * test enumerates all 4^8 runs so no result depends on the tie-break to be
 * reachable. */

export interface PersonaOutcome {
  /** The plain subject named on the result and card: a service or a language. */
  readonly label: string;
  readonly archetype: string;
  readonly tendency: string;
  readonly reason: string;
  readonly href: string;
}

export interface PersonaOption<Id extends string> {
  readonly label: string;
  readonly primary: Id;
  readonly secondary: Id;
}

export interface PersonaQuestion<Id extends string> {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly [
    PersonaOption<Id>,
    PersonaOption<Id>,
    PersonaOption<Id>,
    PersonaOption<Id>,
  ];
}

export interface PersonaTally<Id extends string> {
  readonly id: Id;
  readonly score: number;
  /** How often this outcome was the player’s direct (primary) choice. */
  readonly direct: number;
  /** The earliest question answered directly for this outcome, or Infinity. */
  readonly firstDirect: number;
}

export interface PersonaQuiz<Id extends string, Outcome extends PersonaOutcome> {
  readonly path: string;
  readonly outcomes: Record<Id, Outcome>;
  readonly ids: readonly Id[];
  readonly questions: readonly PersonaQuestion<Id>[];
  readonly questionCount: number;
  tally(answers: unknown): PersonaTally<Id>[] | null;
  resolve(answers: unknown): Id | null;
  outcomeFromHash(hash: string): Id | null;
  resultPath(id: Id): string;
}

export interface PersonaQuizConfig<Id extends string, Outcome extends PersonaOutcome> {
  readonly path: string;
  readonly outcomes: Record<Id, Outcome>;
  readonly questions: readonly PersonaQuestion<Id>[];
}

export function createPersonaQuiz<Id extends string, Outcome extends PersonaOutcome>(
  config: PersonaQuizConfig<Id, Outcome>,
): PersonaQuiz<Id, Outcome> {
  const ids = Object.keys(config.outcomes) as Id[];
  const questionCount = config.questions.length;

  function compareTallies(a: PersonaTally<Id>, b: PersonaTally<Id>): number {
    return b.score - a.score
      || b.direct - a.direct
      || a.firstDirect - b.firstDirect
      || ids.indexOf(a.id) - ids.indexOf(b.id);
  }

  /** Every outcome’s total for one complete run, best first. Null until every
   * question has one valid option index. */
  function tally(answers: unknown): PersonaTally<Id>[] | null {
    if (!Array.isArray(answers) || answers.length !== questionCount) return null;
    const totals = new Map<Id, { score: number; direct: number; firstDirect: number }>();
    for (const id of ids) {
      totals.set(id, { score: 0, direct: 0, firstDirect: Number.POSITIVE_INFINITY });
    }
    for (let index = 0; index < questionCount; index += 1) {
      const choice = answers[index];
      const question = config.questions[index];
      if (typeof choice !== "number" || !Number.isInteger(choice) || choice < 0 || choice >= question.options.length) {
        return null;
      }
      const option = question.options[choice];
      const primary = totals.get(option.primary)!;
      primary.score += 2;
      primary.direct += 1;
      primary.firstDirect = Math.min(primary.firstDirect, index);
      totals.get(option.secondary)!.score += 1;
    }
    return ids
      .map((id) => ({ id, ...totals.get(id)! }))
      .sort(compareTallies);
  }

  /** The deterministic result for one complete run, or null while it is
   * incomplete or malformed. */
  function resolve(answers: unknown): Id | null {
    return tally(answers)?.[0]?.id ?? null;
  }

  /** A shared result names exactly one known outcome and never carries an answer.
   * Only the `result` parameter is read, so unrelated share parameters cannot
   * invent an answer; a repeated value is ambiguous, and a missing or unknown
   * value falls back to a fresh quiz. */
  function outcomeFromHash(hash: string): Id | null {
    if (!hash.startsWith("#")) return null;
    const params = new URLSearchParams(hash.slice(1));
    const value = params.get("result");
    return params.size === 1 && value && Object.hasOwn(config.outcomes, value)
      ? value as Id : null;
  }

  /** The one answer-free result address: the canonical public quiz route plus a
   * trusted outcome ID. */
  function resultPath(id: Id): string {
    return `${config.path}#result=${id}`;
  }

  return { path: config.path, outcomes: config.outcomes, ids, questions: config.questions, questionCount, tally, resolve, outcomeFromHash, resultPath };
}

/** The printable half of one persona outcome. It is assembled from the same
 * trusted outcome definition the result panel reads, so an authored run and a
 * recipient’s `#result=` link produce the same card. */
export interface PersonaCardPrint {
  readonly archetype: string;
  readonly subject: string;
  readonly tendency: string;
  readonly reason: string;
}

/** The runtime view one quiz page needs. It keeps pack-specific wording in the
 * pack and shared stage mechanics in the controller. */
export interface PersonaPackOutcome extends PersonaCardPrint {
  readonly href: string;
  readonly docsText: string;
  readonly docsAria: string;
}

export interface PersonaPackQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly { readonly label: string }[];
}

export interface PersonaPack {
  readonly game: ExperienceId;
  readonly path: string;
  readonly stageLabel: string;
  readonly questionCount: number;
  readonly questions: readonly PersonaPackQuestion[];
  readonly firstQuestion: {
    readonly prompt: string;
    readonly options: readonly string[];
  };
  readonly cardLabel: string;
  readonly cardCredit: string;
  readonly skinLabels: readonly [string, string, string];
  readonly resultNotice: string;
  readonly shareNote: string;
  readonly disclaimer: string;
  outcomeFromHash(hash: string): string | null;
  resultPath(id: string): string;
  outcome(id: string): PersonaPackOutcome | null;
  card(id: string): PersonaCardPrint | null;
  resolve(answers: unknown): string | null;
}

export interface PersonaPackConfig<Id extends string, Outcome extends PersonaOutcome> {
  readonly game: ExperienceId;
  readonly stageLabel: string;
  readonly quiz: PersonaQuiz<Id, Outcome>;
  readonly subject: (outcome: Outcome) => string;
  readonly docsText: (outcome: Outcome) => string;
  readonly docsAria: (outcome: Outcome) => string;
  readonly cardLabel: string;
  readonly cardCredit: string;
  readonly skinLabels: readonly [string, string, string];
  readonly resultNotice: string;
  readonly shareNote: string;
  readonly disclaimer: string;
}

export function createPersonaPack<Id extends string, Outcome extends PersonaOutcome>(
  config: PersonaPackConfig<Id, Outcome>,
): PersonaPack {
  const find = (id: string): Outcome | null =>
    Object.hasOwn(config.quiz.outcomes, id) ? config.quiz.outcomes[id as Id] : null;
  const firstQuestion = config.quiz.questions[0];

  return {
    game: config.game,
    path: config.quiz.path,
    stageLabel: config.stageLabel,
    questionCount: config.quiz.questionCount,
    questions: config.quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => ({ label: option.label })),
    })),
    firstQuestion: {
      prompt: firstQuestion.prompt,
      options: firstQuestion.options.map((option) => option.label),
    },
    cardLabel: config.cardLabel,
    cardCredit: config.cardCredit,
    skinLabels: config.skinLabels,
    resultNotice: config.resultNotice,
    shareNote: config.shareNote,
    disclaimer: config.disclaimer,
    outcomeFromHash: (hash) => config.quiz.outcomeFromHash(hash),
    resultPath: (id) => config.quiz.resultPath(id as Id),
    resolve: (answers) => config.quiz.resolve(answers),
    outcome: (id) => {
      const outcome = find(id);
      return outcome ? {
        archetype: outcome.archetype,
        subject: config.subject(outcome),
        tendency: outcome.tendency,
        reason: outcome.reason,
        href: outcome.href,
        docsText: config.docsText(outcome),
        docsAria: config.docsAria(outcome),
      } : null;
    },
    card: (id) => {
      const outcome = find(id);
      return outcome ? {
        archetype: outcome.archetype,
        subject: config.subject(outcome),
        tendency: outcome.tendency,
        reason: outcome.reason,
      } : null;
    },
  };
}

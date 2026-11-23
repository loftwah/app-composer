import { languagePersonaOutcomes, type LanguagePersonaId } from "./language-persona.ts";

/** The printable half of one Language Type outcome. It is assembled from the
 * same trusted outcome definition the result panel reads, so an authored run
 * and a recipient’s `#result=` link produce the same card. Answers, scores,
 * session state, the quiz address and the documentation link never enter this
 * copy; `credit` is the only line the artwork carries about the language names. */
export interface LanguageTypeCardCopy {
  readonly archetype: string;
  readonly language: string;
  readonly tendency: string;
  readonly reason: string;
}

export function languageTypeCardCopy(id: LanguagePersonaId): LanguageTypeCardCopy {
  const outcome = languagePersonaOutcomes[id];
  return {
    archetype: outcome.archetype,
    language: outcome.label,
    tendency: outcome.tendency,
    reason: outcome.reason,
  };
}

/** Plain names are used descriptively. No language project, foundation or
 * vendor sponsors, endorses or is affiliated with this quiz. */
export const languageTypeCardCredit =
  "Independent App Composer quiz. Language names appear for reference.";

import {
  cloudflarePersonaChecked, cloudflarePersonaQuiz,
} from "./cloudflare-persona.ts";
import {
  languagePersonaChecked, languagePersonaQuiz,
} from "./language-persona.ts";
import { developerTypeCardCredit } from "./developer-type-card.ts";
import { languageTypeCardCredit } from "./language-type-card.ts";
import { createPersonaPack, type PersonaPack } from "./persona-quiz.ts";

/** The two authored packs that ride the shared persona engine. Each keeps its
 * own route, outcomes, questions, wording and palette; the controller, scoring
 * and card renderer stay one implementation. */

/** The runtime view the shared persona controller, stage and card use. Its
 * wording and palette stay exactly those of the original first quiz. */
export const developerTypePersona: PersonaPack = createPersonaPack({
  game: "developer-type",
  stageLabel: "Developer Type Quiz",
  quiz: cloudflarePersonaQuiz,
  subject: (outcome) => outcome.label,
  docsText: (outcome) => `Read the official ${outcome.label} docs`,
  docsAria: (outcome) => `Read the official ${outcome.label} documentation on developers.cloudflare.com, opens in a new tab`,
  cardLabel: "DEVELOPER TYPE",
  cardCredit: developerTypeCardCredit,
  skinLabels: ["Midnight etching", "Aged amber", "Night archive"],
  resultNotice: "A playful App Composer quiz, not an assessment. No answers leave this tab.",
  shareNote: "Your card prints the result name, service, explanation and any byline. It never prints your answers or the quiz address; Copy result link above holds the answer-free link.",
  disclaimer: `An independent fan quiz by App Composer, unaffiliated with Cloudflare. Cloudflare, Cloudflare Workers, Durable Objects and Workers AI are trademarks or registered trademarks of Cloudflare, Inc. Service summaries checked against the official docs on ${cloudflarePersonaChecked}.`,
});

/** The language pack keeps plain names, its own warm exhibition palette and an
 * explicit no-endorsement line. */
export const languageTypePersona: PersonaPack = createPersonaPack({
  game: "language-type",
  stageLabel: "Language Type Quiz",
  quiz: languagePersonaQuiz,
  subject: (outcome) => outcome.label,
  docsText: (outcome) => `Read the official ${outcome.label} documentation`,
  docsAria: (outcome) => `Read the official ${outcome.label} documentation, opens in a new tab`,
  cardLabel: "LANGUAGE TYPE",
  cardCredit: languageTypeCardCredit,
  skinLabels: ["Canyon dawn", "Warm paper", "Night archive"],
  resultNotice: "A playful quiz about work preferences. Your answers stay in this tab.",
  shareNote: "The card shows your result, language, explanation and any byline. Copy result link shares the outcome alone.",
  disclaimer: `An independent App Composer quiz. Language names are used descriptively, and no language project endorses this quiz. Language notes checked against the official documentation on ${languagePersonaChecked}.`,
});

export const personaPacks = {
  "developer-type": developerTypePersona,
  "language-type": languageTypePersona,
} as const;

export type PersonaGame = keyof typeof personaPacks;

export function personaFor(game: string): PersonaPack | null {
  return Object.hasOwn(personaPacks, game) ? personaPacks[game as PersonaGame] : null;
}

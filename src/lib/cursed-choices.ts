import { cleanText } from "./share-experience-draft.ts";
import { experiencePath } from "./share-experiences.ts";

/** One bounded “Pick your curse” game-show docket for the Internet Workshop,
 * reusing the owned split library/modems poster. Ten brief, fictional
 * either-or constraints; the participant keeps one side per prompt in this
 * tab and the stage reveals that side's own consequence. No vote, comparison,
 * score, account, provider, saved history or result link exists; the only link
 * is an answer-free invite to one unplayed curse. The downloaded portrait or
 * wide card prints only the current curse: its exact
 * prompt, the chosen constraint and that consequence. Kept pure so the
 * docket, the local picks and the exact printed card can be checked without a
 * browser. */
export const cursedChoicesTitle = "Cursed Choices";
export const cursedChoicesPrintTitle = "Pick your curse";
export const cursedChoicesSubtitle = "The curse docket";
/** One visible side on the stage and in the PNG. */
export const cursedChoiceLabels = {
  0: "Side A",
  1: "Side B",
} as const;
export type CursedChoice = keyof typeof cursedChoiceLabels;

export interface CursedPrompt {
  /** Stable internal name, never printed. */
  readonly id: string;
  /** A short docket tab; the full prompt remains its accessible name. */
  readonly tab: string;
  /** The exact either-or constraint printed on the card. */
  readonly prompt: string;
  /** The two exact constraint labels, in stage order. */
  readonly choices: readonly [string, string];
  /** The consequence revealed by each choice, in the same order. */
  readonly consequences: readonly [string, string];
}

/** The poster's own library-versus-modems dilemma opens the docket. The nine
 * that follow are original, short either-ors written for this round: no real
 * person, employer, product, ranking or wrongdoing is described. */
export const cursedChoices = [
  {
    id: "library-or-modems",
    tab: "Library / modems",
    prompt: "Unlimited tokens without internet, or unlimited internet without AI.",
    choices: ["Unlimited tokens, no internet", "Unlimited internet, no AI"],
    consequences: [
      "The library never closes. Your best work is a margin note in a book that was due back in 1998.",
      "Every page loads at once. Your best idea waits in a voice memo you will never transcribe.",
    ],
  },
  {
    id: "notifications",
    tab: "Notifications",
    prompt: "Every notification at full volume, or every notification held until Monday.",
    choices: ["Full volume, always", "Held until Monday"],
    consequences: [
      "A calendar reminder goes off during the quiet part of the film. The whole room applauds.",
      "You open your laptop to three hundred messages about a meeting that ended yesterday.",
    ],
  },
  {
    id: "autocorrect",
    tab: "Auto-correct",
    prompt: "Your keyboard auto-corrects to the truth, or only types a language you don’t speak.",
    choices: ["Auto-correct to the truth", "A language I don’t speak"],
    consequences: [
      "You send “I am pretending to understand this diagram” to the entire company. Nobody disagrees.",
      "You learn an entire language just to apologise for the last email.",
    ],
  },
  {
    id: "undo-redo",
    tab: "Undo / redo",
    prompt: "One undo for your whole life, or one redo that only works once.",
    choices: ["One life undo", "One redo, ever"],
    consequences: [
      "You save it for the big mistake. Then you spend your life saving it for a bigger one.",
      "You press redo at once. It returns you to the moment before you pressed redo.",
    ],
  },
  {
    id: "battery",
    tab: "Battery",
    prompt: "A laptop that runs a month on one charge, or charges in a minute and dies in an hour.",
    choices: ["A month per charge", "A minute to charge"],
    consequences: [
      "You plan every trip around one socket. The socket starts charging rent.",
      "You live in a beautiful, frantic cycle of charging and insisting the battery is fine.",
    ],
  },
  {
    id: "search",
    tab: "Search",
    prompt: "Search answers instantly and slightly wrong, or perfectly tomorrow.",
    choices: ["Instant, slightly wrong", "Perfect, tomorrow"],
    consequences: [
      "You rebuild the whole project on a fact from 2019 that has since been disproved twice.",
      "You ask a question on Monday. By Tuesday you forget why you cared.",
    ],
  },
  {
    id: "passwords",
    tab: "Passwords",
    prompt: "A password you can never forget, or one nobody else can ever guess.",
    choices: ["Never forget it", "Nobody can guess it"],
    consequences: [
      "The password turns out to be a childhood phone number, and it starts appearing in your dreams.",
      "You invent a beautiful 400-character password, then write it on paper under a plant.",
    ],
  },
  {
    id: "printer",
    tab: "Printer",
    prompt: "A printer that always works but adds one extra page, or never works but never jams.",
    choices: ["Always works, extra page", "Never works, never jams"],
    consequences: [
      "Every document arrives with a second page that says “good luck in your meeting” in bold.",
      "You spend the saved jam time writing a very calm email to the printer company.",
    ],
  },
  {
    id: "clock",
    tab: "Clock",
    prompt: "A clock five minutes fast, or a clock five minutes honest.",
    choices: ["Five minutes fast", "Five minutes honest"],
    consequences: [
      "You arrive early and spend five minutes a day in a corridor, thinking about your choices.",
      "You arrive exactly on time. Everyone else is still in the corridor, five minutes fast.",
    ],
  },
  {
    id: "comments",
    tab: "Comments",
    prompt: "Every comment on your work is useful, or every comment is a joke that lands.",
    choices: ["Always useful", "Always a good joke"],
    consequences: [
      "You get perfect advice for a project you have not finished, from people who have not read it.",
      "Your bug report becomes a beloved bit. The bug is still there, but people quote it at parties.",
    ],
  },
] as const satisfies readonly CursedPrompt[];

export const cursedChoiceCount = cursedChoices.length;

/** One empty pick per prompt, in docket order. These never leave memory. */
export const cursedChoiceStart = (): (CursedChoice | null)[] =>
  Array.from({ length: cursedChoiceCount }, () => null);

/** Accept only the two authored sides. A crafted string, boolean or any other
 * number is no pick, so nothing arbitrary can print. */
export function readCursedChoice(value: unknown): CursedChoice | null {
  return value === 0 || value === 1 ? value : null;
}

/** A prompt is addressed by its small integer position, never by its text. */
export function cursedChoicePrompt(index: unknown): CursedPrompt | null {
  return Number.isInteger(index) && Number(index) >= 0 && Number(index) < cursedChoiceCount
    ? cursedChoices[Number(index)]
    : null;
}

/** How many of the ten prompts have a side, for the quiet progress line. */
export function cursedChoiceMade(picks: readonly (CursedChoice | null)[]): number {
  return picks.slice(0, cursedChoiceCount).filter((pick) => pick !== null).length;
}

/** The only query key an answer-free curse invite may carry. */
export const cursedChoiceQueryKey = "curse";

/** The bare canonical route: no query, fragment or carried state. */
export const cursedChoiceBlankPath = experiencePath("cursed-choices");

/** One answer-free invite for a built-in curse. The first curse keeps the bare
 * route; every later curse carries exactly one canonical 1-based ordinal. No
 * side, consequence, byline, answer, result, draft or other query travels. */
export function cursedChoiceInvitePath(index: unknown): string {
  if (!cursedChoicePrompt(index)) return cursedChoiceBlankPath;
  const ordinal = Number(index) + 1;
  return ordinal === 1 ? cursedChoiceBlankPath : `${cursedChoiceBlankPath}?${cursedChoiceQueryKey}=${ordinal}`;
}

/** Reads the one ordinal a challenge link may carry, as a 0-based docket index.
 * Only a single canonical decimal 1–10 on its own key counts. A missing,
 * duplicated, encoded, signed, padded, extra-key or out-of-range value opens
 * the first curse. The server route and the controller share this validator so
 * the no-JS prompt and the mounted docket always select the same curse, still
 * unplayed, with no restore state. */
export function cursedChoiceFromQuery(search: string): number {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const match = /^curse=([1-9]|10)$/.exec(raw);
  if (!match) return 0;
  const index = Number(match[1]) - 1;
  return cursedChoicePrompt(index) ? index : 0;
}

export interface CursedChoiceCard {
  /** The curse's 1-based docket position. */
  number: number;
  /** The short docket tab. */
  tab: string;
  /** The exact either-or prompt the card prints. */
  prompt: string;
  choice: CursedChoice;
  /** The exact chosen constraint the card prints. */
  choiceLabel: string;
  /** The exact consequence revealed by that constraint. */
  consequence: string;
}

/** Exactly what the stage and the PNG print. An unknown prompt or side produces
 * no card, so a crafted control value can never print arbitrary text. */
export function cursedChoiceCard(index: unknown, choice: unknown): CursedChoiceCard | null {
  const entry = cursedChoicePrompt(index);
  const side = readCursedChoice(choice);
  if (!entry || side === null) return null;
  return {
    number: Number(index) + 1,
    tab: entry.tab,
    prompt: cleanText(entry.prompt, 140),
    choice: side,
    choiceLabel: cleanText(entry.choices[side], 60),
    consequence: cleanText(entry.consequences[side], 180),
  };
}

/** The exact text the downloaded card prints, described plainly for alt text
 * with an optional byline only when the card itself carries one. */
export function cursedChoicesAltText(input: {
  byline?: string;
  cursePrompt?: unknown;
  curseChoice?: unknown;
}): string {
  const card = cursedChoiceCard(input.cursePrompt, input.curseChoice);
  if (!card) return "";
  const by = cleanText(input.byline, 48);
  const prompt = /[.!?…]$/.test(card.prompt) ? card.prompt : `${card.prompt}.`;
  const consequence = /[.!?…]$/.test(card.consequence) ? card.consequence : `${card.consequence}.`;
  return [
    "Cursed Choices, a game-show curse card.",
    ...(by ? [`By ${by}.`] : []),
    `Curse ${card.number} of ${cursedChoiceCount}: ${prompt}`,
    `Your curse is ${card.choiceLabel}.`,
    `What it costs: ${consequence}`,
  ].join(" ");
}

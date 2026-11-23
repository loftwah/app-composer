import { cleanText } from "./share-experience-draft.ts";

/** One elimination round for the Internet Workshop, matching the owned
 * “one-must-go” poster: four good things on a noir stage, one leaves, three
 * stay. A round is private to the tab. It never becomes a link, vote,
 * percentage or saved draft. Kept pure so the starter, authored round and
 * elimination can be checked without a browser. */
export const oneMustGoTitle = "One must go.";
export const oneMustGoChoiceCount = 4;
/** One visible choice on the stage and in the PNG. */
export const oneMustGoChoiceLimit = 40;
/** The owned starter round named on the poster itself. */
export const oneMustGoStarterChoices = ["Music", "Games", "Code", "The Web"] as const;

export interface OneMustGoRound {
  /** Exactly four cleaned choice labels, in stage order. */
  choices: readonly string[];
  /** Whether this is the owned poster round or a private authored one. */
  source: "starter" | "custom";
}

export const oneMustGoStarter: OneMustGoRound = {
  choices: [...oneMustGoStarterChoices],
  source: "starter",
};

export interface OneMustGoOutcome {
  /** The one choice that leaves the stage. */
  gone: string;
  /** The other three, in their original stage order. */
  remaining: string[];
}

export type OneMustGoDraft =
  | { ok: true; round: OneMustGoRound }
  | { ok: false; message: string };

/** An authored round is exactly four bounded, nonempty, distinct choices.
 * Values are cleaned like every other typed share text; duplicates are
 * compared after cleaning so an elimination can never be ambiguous. */
export function readOneMustGoChoices(values: readonly unknown[]): OneMustGoDraft {
  if (values.length !== oneMustGoChoiceCount) {
    return { ok: false, message: `Enter exactly ${oneMustGoChoiceCount} choices.` };
  }
  const choices = values.map((value) => cleanText(value, oneMustGoChoiceLimit));
  if (choices.some((choice) => !choice)) {
    return { ok: false, message: "Fill in all four choices." };
  }
  const folded = choices.map((choice) => choice.normalize("NFC").toLocaleLowerCase());
  if (new Set(folded).size !== oneMustGoChoiceCount) {
    return { ok: false, message: "Give each of the four choices its own name." };
  }
  return { ok: true, round: { choices, source: "custom" } };
}

/** Eliminate exactly one valid choice. Anything outside the four is ignored. */
export function oneMustGoOutcome(round: OneMustGoRound, index: number): OneMustGoOutcome | null {
  if (!Number.isInteger(index) || index < 0 || index >= round.choices.length) return null;
  return {
    gone: round.choices[index],
    remaining: round.choices.filter((_, position) => position !== index),
  };
}

/** “Music, Games and The Web” for the stage sentence and status announcement. */
export function oneMustGoRemainingLine(remaining: readonly string[]): string {
  if (remaining.length === 0) return "";
  if (remaining.length === 1) return remaining[0];
  return `${remaining.slice(0, -1).join(", ")} and ${remaining.at(-1)}`;
}

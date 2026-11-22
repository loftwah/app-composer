import {
  thisOrThatPacks, thisOrThatQuestions, thisOrThatResultTitle,
  type ThisOrThatPack,
} from "./share-experiences.ts";

/** One This or That run for the #1064 early slice. Picks are always a
 * contiguous prefix: a question is answered only after every earlier one, so
 * undo is one clear step and progress is exact. Kept pure so the choice,
 * undo and reveal contract can be checked without a browser. */
export type ThisOrThatSide = 0 | 1;
export type ThisOrThatPicks = readonly (ThisOrThatSide | null)[];

export const thisOrThatCount = thisOrThatQuestions.length;

export const thisOrThatStart = (): (ThisOrThatSide | null)[] =>
  Array.from({ length: thisOrThatCount }, () => null);

/** A pick only counts for the first unanswered question; stale views, double
 * taps and repeats on an answered question change nothing. Returns the next
 * picks, or null when the pick is not applicable. */
export function pickThisOrThat(
  picks: ThisOrThatPicks,
  question: number,
  side: ThisOrThatSide,
): (ThisOrThatSide | null)[] | null {
  if (!Number.isInteger(question) || question < 0 || question >= picks.length) return null;
  if (side !== 0 && side !== 1) return null;
  if (picks[question] !== null) return null;
  if (question !== picks.filter((pick) => pick !== null).length) return null;
  const next = [...picks];
  next[question] = side;
  return next;
}

/** One-step undo: clears the most recent pick so its question is asked again.
 * Returns null when there is nothing to undo. */
export function undoThisOrThat(picks: ThisOrThatPicks): (ThisOrThatSide | null)[] | null {
  let last = -1;
  picks.forEach((pick, index) => { if (pick !== null) last = index; });
  if (last < 0) return null;
  const next = [...picks];
  next[last] = null;
  return next;
}

export function thisOrThatProgress(picks: ThisOrThatPicks): { question: number; total: number } {
  const answered = picks.filter((pick) => pick !== null).length;
  return { question: Math.min(answered + 1, picks.length), total: picks.length };
}

export function thisOrThatComplete(picks: ThisOrThatPicks): boolean {
  return picks.length === thisOrThatCount && picks.every((pick) => pick === 0 || pick === 1);
}

/** The real ending: the exact chosen text of every question, exposed as
 * ordered items for the PNG and side indices for the result link.
 * Null until all five are answered. */
export function thisOrThatSummary(
  picks: ThisOrThatPicks,
  questions: readonly (readonly [string, string, string])[] = thisOrThatQuestions,
  title: string = thisOrThatResultTitle,
): {
  title: string;
  subtitle: string;
  /** The exact chosen text per question, in question order, for the PNG rows. */
  items: readonly string[];
  /** The exact chosen side per question, in question order. */
  sides: readonly ThisOrThatSide[];
} | null {
  if (!thisOrThatComplete(picks)) return null;
  const chosen = questions.map(([, left, right], index) =>
    picks[index] === 0 ? left : right);
  return {
    title,
    subtitle: chosen.join(" · "),
    items: chosen,
    sides: picks.map((pick) => (pick === 1 ? 1 : 0)),
  };
}

/** A result link names its starter explicitly. Older maker links have no pack
 * at all and keep reopening the original five questions and their exact texts. */
export function restoreThisOrThatPack(value: unknown): ThisOrThatPack {
  return typeof value === "string" && Object.hasOwn(thisOrThatPacks, value)
    ? value as ThisOrThatPack
    : "maker";
}

/** A shared result restores only with one explicit pick for every question;
 * anything else is ignored so no partial or padded run can pose as finished. */
export function restoreThisOrThatPicks(value: unknown): ThisOrThatSide[] | null {
  if (!Array.isArray(value) || value.length !== thisOrThatCount) return null;
  const picks: ThisOrThatSide[] = [];
  for (const pick of value) {
    if (pick !== 0 && pick !== 1) return null;
    picks.push(pick);
  }
  return picks;
}

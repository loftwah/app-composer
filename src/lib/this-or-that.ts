import {
  experiencePath, thisOrThatPacks, thisOrThatQuestions, thisOrThatResultTitle,
  type ThisOrThatPack,
} from "./share-experiences.ts";
import { cleanText } from "./share-experience-draft.ts";
import { coverFileLimit, coverPixelLimit, sniffCover, type SniffedCover } from "./top-nine-cover.ts";

/** One This or That run for the #1064 early slice. Picks are always a
 * contiguous prefix: a question is answered only after every earlier one, so
 * undo is one clear step and progress is exact. Kept pure so the choice,
 * undo and reveal contract can be checked without a browser. */
export type ThisOrThatSide = 0 | 1;
export type ThisOrThatPicks = readonly (ThisOrThatSide | null)[];

export const thisOrThatCount = thisOrThatQuestions.length;

/** The two authored lengths: the built-in five every starter plays, and one
 * optional nine for a locally written set. Nothing else — no eleven and no
 * twenty-one — is ever offered or accepted. */
export const thisOrThatLengths = [thisOrThatCount, 9] as const;
export type ThisOrThatLength = (typeof thisOrThatLengths)[number];

/** The length selector offers exactly the two authored lengths; any other
 * value keeps the default five, so a crafted input never widens the game. */
export function restoreThisOrThatLength(value: unknown): ThisOrThatLength {
  return thisOrThatLengths.find((length) => String(length) === value) ?? thisOrThatCount;
}

export const thisOrThatStart = (count: number = thisOrThatCount): (ThisOrThatSide | null)[] =>
  Array.from({ length: count }, () => null);

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

export function thisOrThatComplete(
  picks: ThisOrThatPicks,
  count: number = thisOrThatCount,
): boolean {
  return picks.length === count && picks.every((pick) => pick === 0 || pick === 1);
}

/** The real ending: the exact chosen text of every question, exposed as
 * ordered items for the PNG and side indices for the result link. Null until
 * every question of the set on stage — the built-in five or a written nine —
 * has its one pick. */
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
  if (!thisOrThatComplete(picks, questions.length)) return null;
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

/** The blank-starter link is the canonical experience path and, only for a
 * non-maker preset, one exact pack parameter. It never carries a fragment,
 * a result, a byline, answers or any other query. The Maker starter is the
 * bare canonical URL, so an untouched link stays the shortest honest address. */
export const thisOrThatBlankPath = experiencePath("this-or-that");

export function thisOrThatBlankLink(pack: ThisOrThatPack): string {
  return pack === "maker" ? thisOrThatBlankPath : `${thisOrThatBlankPath}?pack=${pack}`;
}

/** Reads the optional blank-starter hint from a query string. Only exactly one
 * known pack counts; a missing, repeated, custom or malformed value opens the
 * original Maker starter, so a crafted link never invents a preset. A result
 * fragment still wins: the controller restores it after this first-load hint. */
export function thisOrThatPackFromQuery(search: string): ThisOrThatPack {
  const values = new URLSearchParams(search).getAll("pack");
  return values.length === 1 ? restoreThisOrThatPack(values[0]) : "maker";
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

/** A custom set is authored for one tab only: the same panels retext, the
 * same result image downloads, and no link or route is ever produced. These
 * bounds keep a written set — the built-in five or one optional nine — inside
 * the same contract as the built-in starters: short prompts, and chosen texts
 * whose listing stays short. */
export const customThisOrThatPromptLimit = 72;
export const customThisOrThatOptionLimit = 45;
export const customThisOrThatTitle = "Your this or that";

/** One optional prompt illustration for a written question. The bytes stay in
 * the tab: only a local blob URL is held while the editor or a played run
 * needs it, and the downloaded result image remains text-only. */
export interface ThisOrThatPromptPhoto {
  /** A local blob URL owned by the tab, never a result link or draft value. */
  url: string;
  /** An optional short description; empty leaves the illustration decorative. */
  alt: string;
}

export const customThisOrThatAltLimit = 120;

export type ThisOrThatPhotoCheck =
  | { ok: true; kind: SniffedCover["kind"]; width: number; height: number }
  | { ok: false; reason: "size"; limit: number }
  | { ok: false; reason: "format" }
  | { ok: false; reason: "pixels"; width: number; height: number; limit: number };

/** The same real-byte, format and pixel guard as Top Nine covers, before any
 * decode. A renamed SVG or any other format never reaches the browser. */
export function checkThisOrThatPhoto(size: number, head: Uint8Array): ThisOrThatPhotoCheck {
  if (!Number.isFinite(size) || size < 0 || size > coverFileLimit) {
    return { ok: false, reason: "size", limit: coverFileLimit };
  }
  const sniffed = sniffCover(head);
  if (!sniffed) return { ok: false, reason: "format" };
  if (sniffed.width * sniffed.height > coverPixelLimit) {
    return {
      ok: false, reason: "pixels", width: sniffed.width, height: sniffed.height,
      limit: coverPixelLimit,
    };
  }
  return { ok: true, kind: sniffed.kind, width: sniffed.width, height: sniffed.height };
}

/** A short, single-spaced description for the optional photo. */
export function cleanThisOrThatAlt(value: unknown): string {
  return cleanText(value, customThisOrThatAltLimit);
}

/** Freeze the applied run's photo metadata: copy each blob URL and its
 * description, bounded to the played questions. Replacing or clearing an
 * editor photo later therefore cannot change what the active run shows. */
export function freezeThisOrThatPhotos(
  photos: readonly (ThisOrThatPromptPhoto | null)[],
  count: number = photos.length,
): (ThisOrThatPromptPhoto | null)[] {
  const length = Number.isInteger(count) && count > 0 ? count : 0;
  return Array.from({ length }, (_, index) => {
    const photo = photos[index];
    const url = typeof photo?.url === "string" && photo.url.startsWith("blob:") ? photo.url : "";
    return url ? { url, alt: cleanThisOrThatAlt(photo?.alt) } : null;
  });
}

export interface ThisOrThatCustomRead {
  /** The bounded, sanitised set, or null while any row is unusable. */
  questions: readonly (readonly [string, string, string])[] | null;
  /** The first row needing attention: 0–8, or -1 when the set is usable. */
  gap: number;
  /** Why the gap row fails: something is missing, or both options match. */
  reason: "empty" | "same" | null;
}

/** Reads one custom set of the chosen length from raw editor values — five
 * rows by default, nine for the optional length — each row of prompt, left
 * and right. Every value passes through the same visible-text sanitisation
 * as the built-in starters, and a row plays only with a prompt and two
 * genuinely different options — case included — so a half-written or
 * duplicated set never reaches the stage. Rows beyond the length are never
 * read: they keep whatever draft text they hold until the editor widens. */
export function readThisOrThatCustom(
  rows: readonly (readonly [unknown, unknown, unknown])[],
  count: number = thisOrThatCount,
): ThisOrThatCustomRead {
  const questions: [string, string, string][] = [];
  for (let index = 0; index < count; index += 1) {
    const row = rows[index];
    const prompt = cleanText(row?.[0], customThisOrThatPromptLimit);
    const left = cleanText(row?.[1], customThisOrThatOptionLimit);
    const right = cleanText(row?.[2], customThisOrThatOptionLimit);
    if (!prompt || !left || !right) return { questions: null, gap: index, reason: "empty" };
    if (left.toLowerCase() === right.toLowerCase()) {
      return { questions: null, gap: index, reason: "same" };
    }
    questions.push([prompt, left, right]);
  }
  return { questions, gap: -1, reason: null };
}

/** Move one draft row a single step inside the edited length, carrying the
 * whole row exactly as typed — prompt, both options, and any attached photo
 * draft or description. Blank and half-written values included. A row already
 * at an edge of the length stays put, and rows beyond the length are never
 * touched or swapped into; no text is trimmed or validated here. */
export function moveThisOrThatCustom<T extends readonly [string, string, string, ...unknown[]]>(
  rows: readonly T[],
  from: number,
  step: -1 | 1,
  count: number = thisOrThatCount,
): T[] {
  const next = rows.map((row) => [...row] as unknown as T);
  const to = from + step;
  if (from < 0 || from >= count || to < 0 || to >= count) return next;
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

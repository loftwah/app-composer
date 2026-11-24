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

/** The three authored lengths: the built-in five every starter plays, the
 * optional nine, and the private/local eleven. Nothing else — no twenty-one —
 * is ever offered or accepted. */
export const thisOrThatLengths = [thisOrThatCount, 9, 11] as const;
export type ThisOrThatLength = (typeof thisOrThatLengths)[number];

/** The length selector offers exactly the authored lengths; any other value
 * keeps the default five, so a crafted input never widens the game. */
export function restoreThisOrThatLength(value: unknown): ThisOrThatLength {
  return thisOrThatLengths.find((length) => String(length) === value) ?? thisOrThatCount;
}

export function isThisOrThatLength(value: unknown): value is ThisOrThatLength {
  return thisOrThatLengths.some((length) => length === value);
}

/** Every editor and draft carries all eleven rows. Five/nine toggles only hide
 * rows; they never discard the drafts held in the wider tail. */
export const thisOrThatDraftRowCount = 11;

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
 * every question of the set on stage — the built-in five or a written five,
 * nine or eleven — has its one pick. */
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

/** The one prior run a shared built-in result may be compared against: exactly
 * one explicit pick for every question of one known built-in starter. A
 * written set, an unknown or crafted pack, a partial fragment and any other
 * length never qualify, so no offer appears for something this build cannot
 * replay exactly. */
export function readThisOrThatComparisonOffer(
  marked: unknown,
  pack: unknown,
): { pack: ThisOrThatPack; picks: ThisOrThatSide[] } | null {
  const picks = restoreThisOrThatPicks(marked);
  if (!picks) return null;
  // An absent pack is a pre-pack maker link; anything present must name a real
  // built-in starter. A claimed "custom" or unknown pack is not comparable.
  if (pack !== undefined && !(typeof pack === "string" && Object.hasOwn(thisOrThatPacks, pack))) {
    return null;
  }
  const selected = restoreThisOrThatPack(pack);
  if (thisOrThatPacks[selected].questions.length !== picks.length) return null;
  return { pack: selected, picks };
}

export interface ThisOrThatComparisonRow {
  /** The exact built-in prompt both runs answered. */
  prompt: string;
  /** The exact choice the shared result made. */
  shared: string;
  /** The exact choice this participant's replay made. */
  own: string;
  same: boolean;
}

export interface ThisOrThatComparison {
  same: number;
  different: number;
  total: number;
  rows: readonly ThisOrThatComparisonRow[];
}

/** Counts same and different choices over the positions both runs actually
 * share: one exact complete run of the same built-in questions. A partial,
 * longer or different set is not comparable and returns null, so no count is
 * ever invented across mismatched prompts or lengths. */
export function compareThisOrThatChoices(
  shared: ThisOrThatPicks,
  own: ThisOrThatPicks,
  questions: readonly (readonly [string, string, string])[] = thisOrThatQuestions,
): ThisOrThatComparison | null {
  if (!thisOrThatComplete(shared, questions.length)) return null;
  if (!thisOrThatComplete(own, questions.length)) return null;
  const rows = questions.map(([prompt, left, right], index) => {
    const sharedSide = shared[index] as ThisOrThatSide;
    const ownSide = own[index] as ThisOrThatSide;
    return {
      prompt,
      shared: sharedSide === 0 ? left : right,
      own: ownSide === 0 ? left : right,
      same: sharedSide === ownSide,
    };
  });
  const same = rows.filter((row) => row.same).length;
  return { same, different: rows.length - same, total: rows.length, rows };
}

/** A custom set is authored for one tab only: the same panels retext, the
 * same result image downloads, and no link or route is ever produced. These
 * bounds keep a written set — the built-in five, nine or eleven — inside the
 * same contract as the built-in starters: short prompts, and chosen texts
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
  /** The first row needing attention: 0–10, or -1 when the set is usable. */
  gap: number;
  /** Why the gap row fails: something is missing, or both options match. */
  reason: "empty" | "same" | null;
}

/** Reads one custom set of the chosen length from raw editor values — five
 * rows by default, nine or eleven for the optional lengths — each row of
 * prompt, left and right. Every value passes through the same visible-text
 * sanitisation as the built-in starters, and a row plays only with a prompt and
 * two genuinely different options — case included — so a half-written or
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

/** One local question-draft file. It carries the editor only: all eleven rows,
 * including hidden and unfinished ones, plus the active five/nine/eleven
 * length. Picks, photos, descriptions, links and run state have no field and
 * never travel. New writes are strict v2; the exact previously downloaded v1
 * nine-row shape remains readable and gains two blank rows in memory. */
export const thisOrThatDraftFileSchema = "composer.this-or-that-draft/2";
export const thisOrThatLegacyDraftFileSchema = "composer.this-or-that-draft/1";
export const thisOrThatDraftFileName = "composer-this-or-that-draft.json";
/** Bytes, not characters: the same fixed bound covers writes and opens, and is
 * checked before JSON.parse. It matches the 21 Questions local-file bound. */
export const thisOrThatDraftFileLimit = 8_192;
export type ThisOrThatDraftRow = readonly [string, string, string];

export interface ThisOrThatDraft {
  rows: readonly ThisOrThatDraftRow[];
  length: ThisOrThatLength;
}

export type ThisOrThatDraftField = "prompt" | "left" | "right";
export type ThisOrThatDraftFileFault =
  | "oversized"
  | "unreadable"
  | "schema"
  | "version"
  | "shape"
  | "length"
  | "long";

export interface ThisOrThatDraftFileRead {
  /** The exact cleaned editor draft, or null on every fault. */
  readonly draft: ThisOrThatDraft | null;
  readonly fault: ThisOrThatDraftFileFault | null;
  /** The failing row for a row fault, otherwise -1. */
  readonly gap: number;
  readonly field: ThisOrThatDraftField | null;
}

interface ThisOrThatDraftRowsRead {
  rows: ThisOrThatDraftRow[] | null;
  fault: ThisOrThatDraftFileFault | null;
  gap: number;
  field: ThisOrThatDraftField | null;
}

/** Clean the exact owned row count without asking whether rows are playable.
 * Blank and half-written rows are valid drafts; only the exact row shape and
 * the shared per-field bounds apply. One extra character exposes an overlong
 * value instead of silently truncating what the person wrote. */
function readThisOrThatDraftRows(value: unknown, count: number): ThisOrThatDraftRowsRead {
  const reject = (
    fault: ThisOrThatDraftFileFault,
    gap = -1,
    field: ThisOrThatDraftField | null = null,
  ): ThisOrThatDraftRowsRead => ({ rows: null, fault, gap, field });
  if (!Array.isArray(value) || value.length !== count) return reject("shape");
  const fields = ["prompt", "left", "right"] as const;
  const limits = [customThisOrThatPromptLimit, customThisOrThatOptionLimit, customThisOrThatOptionLimit] as const;
  const rows: ThisOrThatDraftRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = value[index];
    if (!Array.isArray(row) || row.length !== 3 || row.some((text) => typeof text !== "string")) {
      return reject("shape", index);
    }
    const cleaned: [string, string, string] = ["", "", ""];
    for (let field = 0; field < 3; field += 1) {
      const text = cleanText(row[field], limits[field] + 1);
      if (text.length > limits[field]) return reject("long", index, fields[field]);
      cleaned[field] = text;
    }
    rows.push(cleaned);
  }
  return { rows, fault: null, gap: -1, field: null };
}

/** Write one already-bounded editor draft to deterministic local bytes. Every
 * new write is v2 with exactly eleven rows; the reader below accepts only that
 * strict shape or the exact bounded v1 nine-row predecessor. */
export function writeThisOrThatDraftFile(
  rows: readonly (readonly [unknown, unknown, unknown])[],
  length: ThisOrThatLength,
): string | null {
  const read = readThisOrThatDraftRows(rows, thisOrThatDraftRowCount);
  if (!read.rows || !isThisOrThatLength(length)) return null;
  const text = `${JSON.stringify({ schema: thisOrThatDraftFileSchema, rows: read.rows, length }, null, 2)}\n`;
  return new TextEncoder().encode(text).length <= thisOrThatDraftFileLimit ? text : null;
}

/** Read one owned v1 or v2 draft. Bytes are bounded before parsing, the schema
 * and exact three-key shape before content, and every row then uses the same
 * visible-text cleaning and limits as the editor. V1 accepts exactly nine rows
 * and a five/nine length; its two new rows restore blank. V2 accepts exactly
 * eleven rows and a five/nine/eleven length. No fault returns a draft. */
export function readThisOrThatDraftFile(raw: unknown): ThisOrThatDraftFileRead {
  const reject = (
    fault: ThisOrThatDraftFileFault,
    gap = -1,
    field: ThisOrThatDraftField | null = null,
  ): ThisOrThatDraftFileRead => ({ draft: null, fault, gap, field });
  if (typeof raw !== "string") return reject("unreadable");
  if (new TextEncoder().encode(raw).length > thisOrThatDraftFileLimit) return reject("oversized");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return reject("unreadable");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return reject("unreadable");
  const file = value as Record<string, unknown>;
  if (typeof file.schema !== "string") return reject("schema");
  const legacy = file.schema === thisOrThatLegacyDraftFileSchema;
  if (!legacy && file.schema !== thisOrThatDraftFileSchema) {
    return reject(/^composer\.this-or-that-draft\/\d+$/.test(file.schema) ? "version" : "schema");
  }
  const keys = Object.keys(file);
  if (keys.length !== 3 || !keys.includes("schema") || !keys.includes("rows") || !keys.includes("length")) {
    return reject("shape");
  }
  const rows = readThisOrThatDraftRows(file.rows, legacy ? 9 : thisOrThatDraftRowCount);
  if (!rows.rows) return reject(rows.fault ?? "shape", rows.gap, rows.field);
  const acceptedLength = legacy
    ? file.length === 5 || file.length === 9
    : isThisOrThatLength(file.length);
  if (!acceptedLength) return reject("length");
  const restoredRows = legacy
    ? [...rows.rows, ...Array.from({ length: thisOrThatDraftRowCount - 9 }, () => ["", "", ""] as const)]
    : rows.rows;
  return { draft: { rows: restoredRows, length: file.length as ThisOrThatLength }, fault: null, gap: -1, field: null };
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

import { cleanText } from "./share-experience-draft.ts";

/** One personal sorting board for the Internet Workshop. Four authored row
 * names describe what someone wants to keep nearby; they are not grades,
 * votes or a public ranking. Entries stay in this tab, and no result link is
 * ever produced. Kept pure so the add, edit, move, remove and export
 * contracts can be checked without a browser. */
export const tierListTiers = [
  { id: "keep", label: "Keep close" },
  { id: "space", label: "Worth the space" },
  { id: "trying", label: "Trying it on" },
  { id: "not", label: "Not for me" },
] as const;

export const tierListTierCount = tierListTiers.length;
/** One visible entry on the board and in the PNG. */
export const tierListEntryLimit = 52;
/** The optional list title printed above the rows. */
export const tierListTitleLimit = 60;
/** A whole board holds at most twelve entries, six in any one row. */
export const tierListEntryTotal = 12;
export const tierListRowEntryLimit = 6;
export const tierListDefaultTitle = "My tier list";
export const tierListExampleTitle = "Things that help me make things";

/** One optional useful starter, written for this board. Nothing here is
 * filled in automatically; the person asks for it on an empty board. */
export const tierListStarter = [
  { row: 0, text: "The pen that is always in my bag" },
  { row: 0, text: "A notebook with numbered pages" },
  { row: 1, text: "A second screen, after a month of doubt" },
  { row: 2, text: "A weekly review I keep restarting" },
  { row: 3, text: "Every notification, on every device" },
] as const;

export type TierListBoard = string[][];

export function emptyTierListBoard(): TierListBoard {
  return tierListTiers.map(() => []);
}

export function tierListCount(board: readonly (readonly string[])[]): number {
  return board.reduce((total, row) => total + row.length, 0);
}

/** A row accepts one more entry only while the whole board and that row still
 * have room. Values outside the four authored rows never accept anything. */
export function tierListHasRoom(board: readonly (readonly string[])[], row: number): boolean {
  return Number.isInteger(row) && row >= 0 && row < tierListTierCount
    && tierListCount(board) < tierListEntryTotal
    && (board[row]?.length ?? 0) < tierListRowEntryLimit;
}

export function addTierListEntry(
  board: readonly (readonly string[])[],
  row: number,
  value: unknown,
): TierListBoard | null {
  const text = cleanText(value, tierListEntryLimit);
  if (!text || !tierListHasRoom(board, row)) return null;
  return board.map((entries, index) => (index === row ? [...entries, text] : [...entries]));
}

/** One entry's text while it is being edited. The value is capped but not
 * trimmed, so a person can type a space or clear a row without the control
 * rewriting the value under the cursor. Blank entries stay on the board as an
 * empty field and never reach the export or result. */
export function editTierListEntry(
  board: readonly (readonly string[])[],
  row: number,
  index: number,
  value: unknown,
): TierListBoard | null {
  if (!Number.isInteger(row) || row < 0 || row >= tierListTierCount) return null;
  if (!Number.isInteger(index) || index < 0 || index >= board[row].length) return null;
  const text = typeof value === "string" ? value.slice(0, tierListEntryLimit) : "";
  return board.map((entries, rowIndex) =>
    rowIndex === row ? entries.map((entry, entryIndex) => (entryIndex === index ? text : entry)) : [...entries]);
}

/** Move one entry to the end of another row. Moving within its current row is
 * not a move and changes nothing; a full destination is refused rather than
 * silently dropping an entry. */
export function moveTierListEntry(
  board: readonly (readonly string[])[],
  fromRow: number,
  index: number,
  toRow: number,
): { board: TierListBoard; index: number } | null {
  if (!Number.isInteger(fromRow) || fromRow < 0 || fromRow >= tierListTierCount) return null;
  if (!Number.isInteger(index) || index < 0 || index >= board[fromRow].length) return null;
  if (!Number.isInteger(toRow) || toRow < 0 || toRow >= tierListTierCount) return null;
  if (fromRow === toRow) return { board: board.map((row) => [...row]), index };
  if (board[toRow].length >= tierListRowEntryLimit) return null;
  const next = board.map((row) => [...row]);
  const [entry] = next[fromRow].splice(index, 1);
  next[toRow].push(entry);
  return { board: next, index: next[toRow].length - 1 };
}

export function removeTierListEntry(
  board: readonly (readonly string[])[],
  row: number,
  index: number,
): TierListBoard | null {
  if (!Number.isInteger(row) || row < 0 || row >= tierListTierCount) return null;
  if (!Number.isInteger(index) || index < 0 || index >= board[row].length) return null;
  const next = board.map((entries) => [...entries]);
  next[row].splice(index, 1);
  return next;
}

/** The starter fills an empty board only; it never replaces typed entries. */
export function startTierListBoard(): TierListBoard {
  let board = emptyTierListBoard();
  for (const entry of tierListStarter) {
    board = addTierListEntry(board, entry.row, entry.text) ?? board;
  }
  return board;
}

export interface TierListSnapshot {
  title: string;
  /** Entries in reading order: first row top to bottom, then the next row. */
  items: string[];
  /** How many entries each of the four rows prints, always summing to items. */
  tierSizes: number[];
}

/** The exact printable board. Empty fields are omitted, so a cleared entry
 * cannot print a blank line; an empty board produces no result at all. */
export function tierListSnapshot(title: unknown, board: readonly (readonly string[])[], fallbackTitle = tierListDefaultTitle): TierListSnapshot | null {
  const rows = tierListTiers.map((_, row) =>
    (board[row] ?? []).map((entry) => cleanText(entry, tierListEntryLimit)).filter(Boolean));
  if (!rows.some((row) => row.length)) return null;
  return {
    title: cleanText(title, tierListTitleLimit) || fallbackTitle,
    items: rows.flat(),
    tierSizes: rows.map((row) => row.length),
  };
}

/** Four printable rows from one snapshot. A malformed size list falls back to
 * one first row rather than losing or duplicating text in the export. */
export function tierListRows(items: unknown, tierSizes: unknown): string[][] {
  const texts = Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, tierListEntryLimit))
    : [];
  const sizes = Array.isArray(tierSizes) && tierSizes.length === tierListTierCount
    && tierSizes.every((size) => Number.isInteger(size) && size >= 0)
    ? tierSizes as number[]
    : null;
  if (!sizes || sizes.reduce((total, size) => total + size, 0) !== texts.length) {
    return [texts, [], [], []];
  }
  let cursor = 0;
  return sizes.map((size) => {
    const row = texts.slice(cursor, cursor + size);
    cursor += size;
    return row;
  });
}

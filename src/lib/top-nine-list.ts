// One pasted list of exhibit titles for the Top Nine editor. This is the
// person's own text: blank lines are ignored, every line keeps the editor's
// exact title limit, and a fill only ever claims slots the board is still
// waiting for. A spreadsheet row may carry one optional second column — a
// public HTTPS page for that title — which is an ordinary outbound address,
// never a provider source, preview, fetch, lookup or embed. Nothing here
// follows a link, searches, fetches a title or remembers the clipboard — the
// caller passes the textarea's current value.

import { cleanText, nineItemLimit } from "./share-experience-draft.ts";
import { pageLink, pageUrlLimit } from "./top-nine-pages.ts";

/** The paste box is bounded, with room for nine rows of a bounded title plus a
 * full-length page address, and the overdue rows that deliberately stay in the
 * editor after a partial fill. */
export const nineListLimit = 9 * (nineItemLimit + pageUrlLimit + 1) + 400;

export interface NineListPlan {
  /** Every placeable line, normalised and bounded, in pasted order. */
  lines: string[];
  /** The empty slots this fill would take, in board order. */
  indexes: number[];
  /** One title per slot in `indexes`, same length and order. */
  titles: string[];
  /** One page per slot in `indexes`; null leaves that exhibit page-free. */
  urls: (string | null)[];
  /** One raw row per slot in `indexes`, restored verbatim by Undo. */
  rows: string[];
  /** Lines that do not fit. They stay in the editor, raw and ordered. */
  overflow: string[];
  /** Rows whose second column is not a public HTTPS page. They are never
   * placed and stay in the editor exactly as pasted. */
  invalid: string[];
  /** Every raw row still in the box after this fill, in original order. */
  remaining: string[];
}

const label = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The useful count beside the box for rows it will not place. */
const invalidNote = (count: number) =>
  `${label(count, "row")} not placed, ${count === 1 ? "needs" : "need"} title TAB public HTTPS page`;

interface NineListRow {
  raw: string;
  title: string;
  page: string | null;
  /** False only for a row with columns that are not title TAB public page. */
  valid: boolean;
}

/** One pasted row: a plain title, or title TAB public HTTPS page. A trailing
 * tab from a spreadsheet export is still one ordinary title. */
function readRow(raw: string, limit: number): NineListRow {
  const columns = raw.split("\t");
  if (columns.length === 1 || (columns.length === 2 && !columns[1].trim())) {
    return { raw, title: cleanText(columns[0], limit), page: null, valid: true };
  }
  const title = cleanText(columns[0], limit);
  const page = columns.length === 2 ? pageLink(columns[1].trim()) : null;
  if (!title || !page) return { raw, title: "", page: null, valid: false };
  return { raw, title, page, valid: true };
}

/** Plan one fill against the slots that can still take a title. `open` is the
 * caller's ordered list of free slots; duplicates and non-integers are dropped
 * so a repeated index cannot take two lines or overwrite itself. */
export function planNineList(
  text: unknown,
  open: readonly number[],
  limit = nineItemLimit,
): NineListPlan {
  const rawLines = (typeof text === "string" ? text : "").split(/\r?\n/).filter((line) => line.trim());
  const rows = rawLines.map((line) => readRow(line, limit));
  const placeable = rows.filter((row) => row.valid && row.title);
  const slots = [...new Set(open)].filter((index) => Number.isInteger(index) && index >= 0);
  const placed = Math.min(slots.length, placeable.length);
  const taking = new Set(placeable.slice(0, placed));
  const rest = rows.filter((row) => !taking.has(row));
  return {
    lines: placeable.map((row) => row.title),
    indexes: slots.slice(0, placed),
    titles: placeable.slice(0, placed).map((row) => row.title),
    urls: placeable.slice(0, placed).map((row) => row.page),
    rows: placeable.slice(0, placed).map((row) => row.raw),
    overflow: rest.filter((row) => row.valid && row.title).map((row) => row.raw),
    invalid: rest.filter((row) => !row.valid).map((row) => row.raw),
    remaining: rest.map((row) => row.raw),
  };
}

/** The live count beside the paste box: what is ready and what stays behind. */
export function nineListSummary(plan: NineListPlan, openCount: number): string {
  const invalid = plan.invalid.length ? invalidNote(plan.invalid.length) : "";
  if (!plan.lines.length) {
    const base = openCount ? `${label(openCount, "empty slot")} in board order.` : "No empty slots are available.";
    return invalid ? `${base} ${invalid}.` : base;
  }
  if (!plan.indexes.length) {
    const parts = ["No empty slots are available", `${label(plan.lines.length, "line")} staying in the editor`];
    if (invalid) parts.push(invalid);
    return `${parts.join(" · ")}.`;
  }
  const parts = [label(openCount, "empty slot"), `${plan.indexes.length} ready`];
  if (plan.remaining.length) parts.push(`${plan.remaining.length} staying in the editor`);
  if (invalid) parts.push(invalid);
  return `${parts.join(" · ")}.`;
}

/** What one deliberate fill did, including the count still to place. */
export function nineListApplied(plan: NineListPlan, openAfter: number): string {
  const parts = [`Filled ${label(plan.indexes.length, "exhibit")}`, `${label(openAfter, "empty slot")} left`];
  const linked = plan.urls.filter(Boolean).length;
  if (linked) parts.push(`${label(linked, "page")} linked`);
  if (plan.overflow.length) parts.push(`${label(plan.overflow.length, "line")} stayed in the editor`);
  if (plan.invalid.length) parts.push(invalidNote(plan.invalid.length));
  return `${parts.join(" · ")}.`;
}

/** The title/page pair one fill added to a slot, remembered whole so Undo can
 * tell its own work from anything the person has changed since. */
export interface NineListFill {
  indexes: readonly number[];
  titles: readonly string[];
  /** The page this fill attached to the slot, when it attached one. */
  urls?: readonly (string | null)[];
  /** The raw row that produced each title, restored verbatim. */
  rows?: readonly string[];
}

/** One Undo reverses a whole fill. A slot still holding the exact title and page
 * this fill wrote is cleared and its raw row returns to the editor; a later
 * title, page, source link or cover is the person's own work and is never
 * removed or duplicated back into the box. `currentPages` is each slot's live
 * page, so the fill's own page is not mistaken for someone else's attachment. */
export function planNineListUndo(
  filled: NineListFill,
  current: readonly string[],
  hasAttachment: (index: number) => boolean,
  currentPages: readonly (string | null)[] = [],
): { clear: number[]; restored: string[]; pages: number; kept: number } {
  const clear: number[] = [];
  const restored: string[] = [];
  let pages = 0;
  let kept = 0;
  filled.indexes.forEach((index, line) => {
    const title = filled.titles[line];
    if (!title) return;
    const page = filled.urls?.[line] ?? null;
    if (current[index] !== title || (currentPages[index] ?? null) !== page || hasAttachment(index)) {
      kept += 1;
      return;
    }
    clear.push(index);
    restored.push(filled.rows?.[line] || title);
    if (page) pages += 1;
  });
  return { clear, restored, pages, kept };
}

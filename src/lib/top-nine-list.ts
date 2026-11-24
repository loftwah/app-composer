// One pasted list of exhibit titles for the Top Nine editor. This is the
// person's own text: blank lines are ignored, every line keeps the editor's
// exact title limit, and a fill only ever claims slots the board is still
// waiting for. A spreadsheet row may carry one optional second column — a
// public HTTPS page for that title — and one optional third column — an exact
// Apple Music or Spotify album or track source. A page is an ordinary outbound
// address, never a provider source, preview, fetch, lookup or embed. Nothing
// here follows a link, searches, fetches a title or remembers the clipboard —
// the caller passes the textarea's current value.

import { cleanText, nineItemLimit } from "./share-experience-draft.ts";
import { musicPreview, musicUrlLimit } from "./top-nine-music.ts";
import { pageLink, pageUrlLimit } from "./top-nine-pages.ts";

/** The paste box is bounded, with room for nine rows of a bounded title, a
 * full-length page address and a full-length music source, plus the overdue
 * rows that deliberately stay in the editor after a partial fill. */
export const nineListLimit = 9 * (nineItemLimit + pageUrlLimit + musicUrlLimit + 2) + 400;

export interface NineListPlan {
  /** Every placeable line, normalised and bounded, in pasted order. */
  lines: string[];
  /** The empty slots this fill would take, in board order. */
  indexes: number[];
  /** One title per slot in `indexes`, same length and order. */
  titles: string[];
  /** One page per slot in `indexes`; null leaves that exhibit page-free. */
  urls: (string | null)[];
  /** One canonical Apple Music or Spotify source per slot in `indexes`; null
   * leaves that exhibit without an audition link. */
  sources: (string | null)[];
  /** One raw row per slot in `indexes`, restored verbatim by Undo. */
  rows: string[];
  /** Lines that do not fit. They stay in the editor, raw and ordered. */
  overflow: string[];
  /** Rows whose columns are not a title, optional public HTTPS page and
   * optional exact music source. They are never placed and stay exactly as
   * pasted. */
  invalid: string[];
  /** How many invalid rows used the new third-column format, so their help
   * names the music source rather than only the legacy page column. */
  invalidMusic: number;
  /** Every raw row still in the box after this fill, in original order. */
  remaining: string[];
}

const label = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The useful count beside the box for rows it will not place. */
const invalidNote = (count: number, music: number) => music
  ? `${label(count, "row")} not placed, ${count === 1 ? "needs" : "need"} title TAB optional public HTTPS page TAB exact Apple Music or Spotify album/track URL`
  : `${label(count, "row")} not placed, ${count === 1 ? "needs" : "need"} title TAB public HTTPS page`;

interface NineListRow {
  raw: string;
  title: string;
  page: string | null;
  source: string | null;
  valid: boolean;
  /** A third or later column uses the extended format, including when invalid. */
  musicColumn: boolean;
}

/** One pasted row: a plain title, title TAB public HTTPS page, or title TAB
 * optional page TAB optional exact music source. Old one/two-column values keep
 * their original meaning; only a third column is ever parsed as music. */
function readRow(raw: string, limit: number): NineListRow {
  const columns = raw.split("\t");
  const musicColumn = columns.length >= 3;
  const invalid = (): NineListRow => ({
    raw, title: "", page: null, source: null, valid: false, musicColumn,
  });
  const title = cleanText(columns[0], limit);
  const pageValue = columns[1]?.trim() ?? "";
  if (!musicColumn && !pageValue) return { raw, title, page: null, source: null, valid: true, musicColumn };
  if (!title || columns.length > 3) return invalid();
  const page = pageValue ? pageLink(pageValue) : null;
  if (pageValue && !page) return invalid();
  const sourceValue = columns[2]?.trim() ?? "";
  const source = sourceValue ? musicPreview(sourceValue)?.href ?? null : null;
  if (sourceValue && !source) return invalid();
  return { raw, title, page, source, valid: true, musicColumn };
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
    sources: placeable.slice(0, placed).map((row) => row.source),
    rows: placeable.slice(0, placed).map((row) => row.raw),
    overflow: rest.filter((row) => row.valid && row.title).map((row) => row.raw),
    invalid: rest.filter((row) => !row.valid).map((row) => row.raw),
    invalidMusic: rest.filter((row) => !row.valid && row.musicColumn).length,
    remaining: rest.map((row) => row.raw),
  };
}

/** The live count beside the paste box: what is ready and what stays behind. */
export function nineListSummary(plan: NineListPlan, openCount: number): string {
  const invalid = plan.invalid.length ? invalidNote(plan.invalid.length, plan.invalidMusic) : "";
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
  const sources = plan.sources.filter(Boolean).length;
  if (sources) parts.push(`${label(sources, "music link")} added`);
  if (plan.overflow.length) parts.push(`${label(plan.overflow.length, "line")} stayed in the editor`);
  if (plan.invalid.length) parts.push(invalidNote(plan.invalid.length, plan.invalidMusic));
  return `${parts.join(" · ")}.`;
}

/** The title/page/music triple one fill added to a slot, remembered whole so
 * Undo can tell its own work from anything the person has changed since. */
export interface NineListFill {
  indexes: readonly number[];
  titles: readonly string[];
  /** The page this fill attached to the slot, when it attached one. */
  urls?: readonly (string | null)[];
  /** The canonical music source this fill attached, when it attached one. */
  sources?: readonly (string | null)[];
  /** The raw row that produced each title, restored verbatim. */
  rows?: readonly string[];
}

/** One Undo reverses a whole fill. A slot still holding the exact title, page
 * and music source this fill wrote is cleared and its raw row returns to the
 * editor; a later title, page, source link or cover is the person's own work and
 * is never removed or duplicated back into the box. `currentPages` and
 * `currentSources` are each slot's live attachments, so the fill's own links are
 * not mistaken for someone else's. `hasAttachment` covers anything outside that
 * comparison, such as a local cover. */
export function planNineListUndo(
  filled: NineListFill,
  current: readonly string[],
  hasAttachment: (index: number) => boolean,
  currentPages: readonly (string | null)[] = [],
  currentSources: readonly (string | null)[] = [],
): { clear: number[]; restored: string[]; pages: number; sources: number; kept: number } {
  const clear: number[] = [];
  const restored: string[] = [];
  let pages = 0;
  let sources = 0;
  let kept = 0;
  filled.indexes.forEach((index, line) => {
    const title = filled.titles[line];
    if (!title) return;
    const page = filled.urls?.[line] ?? null;
    const source = filled.sources?.[line] ?? null;
    if (current[index] !== title || (currentPages[index] ?? null) !== page
      || (currentSources[index] ?? null) !== source || hasAttachment(index)) {
      kept += 1;
      return;
    }
    clear.push(index);
    restored.push(filled.rows?.[line] || title);
    if (page) pages += 1;
    if (source) sources += 1;
  });
  return { clear, restored, pages, sources, kept };
}

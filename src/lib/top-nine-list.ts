// One pasted list of exhibit titles for the Top Nine editor. This is the
// person's own text: blank lines are ignored, every line keeps the editor's
// exact title limit, and a fill only ever claims slots the board is still
// waiting for. Nothing here follows a link, searches, fetches a title or
// remembers the clipboard — the caller passes the textarea's current value.

import { cleanText, nineItemLimit } from "./share-experience-draft.ts";

/** The paste box is bounded, with room for nine titles and the overdue lines
 * that deliberately stay in the editor after a partial fill. */
export const nineListLimit = 1_200;

export interface NineListPlan {
  /** Every non-blank line, normalised and bounded, in pasted order. */
  lines: string[];
  /** The empty slots this fill would take, in board order. */
  indexes: number[];
  /** One title per slot in `indexes`, same length and order. */
  titles: string[];
  /** Lines that do not fit. They stay in the editor for a later fill. */
  overflow: string[];
}

const label = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Plan one fill against the slots that can still take a title. `open` is the
 * caller's ordered list of free slots; duplicates and non-integers are dropped
 * so a repeated index cannot take two lines or overwrite itself. */
export function planNineList(
  text: unknown,
  open: readonly number[],
  limit = nineItemLimit,
): NineListPlan {
  const rawLines = (typeof text === "string" ? text : "").split(/\r?\n/).filter((line) => line.trim());
  const lines = rawLines.map((line) => cleanText(line, limit));
  const slots = [...new Set(open)].filter((index) => Number.isInteger(index) && index >= 0);
  const placed = Math.min(slots.length, lines.length);
  return {
    lines,
    indexes: slots.slice(0, placed),
    titles: lines.slice(0, placed),
    overflow: rawLines.slice(placed),
  };
}

/** The live count beside the paste box: what is ready and what stays behind. */
export function nineListSummary(plan: NineListPlan, openCount: number): string {
  if (!plan.lines.length) {
    return openCount ? `${label(openCount, "empty slot")} in board order.` : "No empty slots are available.";
  }
  if (!plan.indexes.length) {
    return `No empty slots are available · ${label(plan.lines.length, "line")} staying in the editor.`;
  }
  const parts = [label(openCount, "empty slot"), `${plan.indexes.length} ready`];
  if (plan.overflow.length) parts.push(`${plan.overflow.length} staying in the editor`);
  return `${parts.join(" · ")}.`;
}

/** What one deliberate fill did, including the count still to place. */
export function nineListApplied(plan: NineListPlan, openAfter: number): string {
  const parts = [`Filled ${label(plan.indexes.length, "exhibit")}`, `${label(openAfter, "empty slot")} left`];
  if (plan.overflow.length) parts.push(`${label(plan.overflow.length, "line")} stayed in the editor`);
  return `${parts.join(" · ")}.`;
}

/** One Undo reverses a whole fill. A slot still holding the exact title this
 * fill wrote is cleared and its line returns to the editor; a slot the person
 * has since edited keeps their text and is never duplicated back into the box. */
export function planNineListUndo(
  filled: { indexes: readonly number[]; titles: readonly string[] },
  current: readonly string[],
  hasAttachment: (index: number) => boolean,
): { clear: number[]; restored: string[]; kept: number } {
  const clear: number[] = [];
  const restored: string[] = [];
  let kept = 0;
  filled.indexes.forEach((index, line) => {
    const title = filled.titles[line];
    if (!title) return;
    if (current[index] !== title || hasAttachment(index)) {
      kept += 1;
      return;
    }
    clear.push(index);
    restored.push(title);
  });
  return { clear, restored, kept };
}

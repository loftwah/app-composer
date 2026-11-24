// One short plain-text caption for a finished Top Nine board. It carries only
// the board's cleaned title, optional subtitle and byline, then an invitation
// to make a board of their own. That invitation is the bare canonical Top Nine
// path on whichever instance opens it: no result, exhibit title, local draft,
// cover, profile address or other value is ever serialised into the link.

import { experiencePath } from "./share-experiences.ts";
import { cleanText, nineSubtitleLimit } from "./share-experience-draft.ts";
import { topNineDateLabel } from "./top-nine-date.ts";

/** The invite is the bare canonical route on this origin, with no query,
 * fragment, result or state. It is the same path the editor itself uses. */
export const topNineBlankPath = experiencePath("top-nine");

/**
 * Build the caption from the visible heading fields alone. It is free of DOM
 * access, storage, publishing and providers, so the exact text a person copies
 * (and the exact text offered when the clipboard is denied) can be checked in
 * a focused test. A path argument replaces any path, query or fragment on the
 * base origin, so the invite can only be the canonical path.
 */
export function topNineCaption(
  board: { title: unknown; subtitle?: unknown; byline?: unknown; date?: unknown },
  origin: string,
): string {
  const title = cleanText(board.title, 72);
  const subtitle = cleanText(board.subtitle, nineSubtitleLimit);
  const byline = cleanText(board.byline, 48);
  const date = topNineDateLabel(board.date);
  if (!title) return "";
  const href = new URL(topNineBlankPath, origin).href;
  return [
    title,
    ...(subtitle ? [subtitle] : []),
    ...(byline ? [`By ${byline}`] : []),
    ...(date ? [date] : []),
    `Make your own Top Nine at ${href}`,
  ].join("\n");
}

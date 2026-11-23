/** Alt text for the downloaded Top Nine image.
 *
 * The export draws a title, an optional subtitle and byline, then nine exhibit
 * titles, three per row. This formatter uses exactly that text in the same
 * order, starting with the title, then the subtitle and optional "By …", then
 * the top, middle and bottom rows. An explicitly ranked board announces each
 * exhibit with its #1–#9 position, matching the number the export prints;
 * unordered favourites keep the plain row text. Source links, covers and the
 * device a cover came from stay out of it, and it stays free of DOM access so
 * the focused test can check the string deterministically.
 */

import { cleanText, nineSubtitleLimit } from "./share-experience-draft.ts";

/** One sentence, without doubling a title's own closing punctuation. */
const sentence = (value: string) => (/[.!?…]$/.test(value) ? value : `${value}.`);

export function topNineAltText(input: { title: string; subtitle?: string; byline?: string; items: readonly string[]; ranked?: boolean }): string {
  const title = cleanText(input.title, 72);
  const subtitle = cleanText(input.subtitle, nineSubtitleLimit);
  const byline = cleanText(input.byline, 48);
  const items = input.items.map((item) => cleanText(item, 54));
  if (!title || items.length !== 9 || items.some((item) => !item)) return "";
  const labelled = input.ranked === true ? items.map((item, index) => `#${index + 1} ${item}`) : items;
  const rows = ["Top row", "Middle row", "Bottom row"].map((label, index) => {
    const [first, second, third] = labelled.slice(index * 3, index * 3 + 3);
    return sentence(`${label} has ${first}, ${second} and ${third}`);
  });
  return [sentence(title), ...(subtitle ? [sentence(subtitle)] : []), ...(byline ? [sentence(`By ${byline}`)] : []), ...rows].join(" ");
}

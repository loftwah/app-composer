// A catalogue result may replace an occupied Top Nine exhibit only after one
// explicit, keyboard-accessible confirmation. This module owns the two small
// pure pieces of that offer: its plain warning text and the snapshot guard.
//
// The offer is bound to the exact slot content it described. Confirming applies
// only while that same slot still holds the same title, source link, live page
// and local cover — any later edit makes the offer stale, so a confirmation can
// never overwrite work done after the person read the prompt.

/** The exact local state one replacement offer described. `cover` is compared
 * by identity: a disposed, replaced or newly hung cover is a different slot. */
export interface ReplaceSlotSnapshot {
  slot: number;
  title: string;
  href: string | null;
  page: string | null;
  cover: unknown;
}

/** True only for the same slot in exactly the state the prompt named. */
export function replaceOfferApplies(
  offer: ReplaceSlotSnapshot,
  current: ReplaceSlotSnapshot,
): boolean {
  return offer.slot === current.slot
    && offer.title === current.title
    && offer.href === current.href
    && offer.page === current.page
    && offer.cover === current.cover;
}

/** "a", "a and b", "a, b and c": one plain list for the warning. */
export function replaceAttachmentList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Names the old and proposed titles and says plainly what replacing removes. */
export function replacePrompt(
  slot: number,
  currentTitle: string,
  proposedTitle: string,
  attached: string[],
): string {
  const held = currentTitle ? `“${currentTitle}”` : "The untitled exhibit";
  const list = replaceAttachmentList(attached);
  const warning = list ? ` This removes its ${list}.` : "";
  return `Replace exhibit ${slot + 1}? ${held} becomes “${proposedTitle}”.${warning}`;
}

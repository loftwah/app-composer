// One readable review date for catalogue entries. EmDash stores the reviewed
// value as free text, so a missing or malformed value must not render as
// "Invalid Date" or a raw ISO string in owner- and visitor-facing copy.
const REVIEWED = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns "24 October 2026" for a plain ISO date, or null for anything else. */
export function reviewLabel(value) {
  if (typeof value !== 'string') return null;
  const match = REVIEWED.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

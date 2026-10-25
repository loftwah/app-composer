// One owner-facing time convention: YYYY/MM/DD, Australia/Melbourne and UTC.
// EmDash's own shell keeps its formatting; this is for Composer plugin screens.
const FIELDS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
} as const;

function stamp(value: string | number | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const parts = new Intl.DateTimeFormat("en-AU", {
    ...FIELDS,
    timeZone,
  }).formatToParts(date);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}/${read("month")}/${read("day")} ${read("hour")}:${read("minute")}`;
}

function known(value: string | number | Date): boolean {
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
}

export function utcTime(value: string | number | Date): string {
  return known(value) ? stamp(value, "UTC") + " UTC" : "Unknown time";
}

export function melbourneTime(value: string | number | Date): string {
  return known(value)
    ? stamp(value, "Australia/Melbourne") + " Melbourne"
    : "Unknown time";
}

/** The full convention, for evidence lines and detail views. */
export function adminTime(value: string | number | Date): string {
  return melbourneTime(value) + " · " + utcTime(value);
}

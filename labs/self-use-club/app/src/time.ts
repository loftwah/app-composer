// Calendar dates are club days in Australia/Melbourne and are never shifted by
// a timezone conversion. Stored instants are shown in both Melbourne and UTC.

const melbourne = 'Australia/Melbourne';

// Date.UTC treats years 0-99 as 1900+, so set the full year afterwards.
function dateFor(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(2000, month - 1, day, 12));
  date.setUTCFullYear(year);
  return date;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return false;
  const date = dateFor(year, month, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function eventDateShort(value: string): string {
  return isCalendarDate(value) ? value.replaceAll('-', '/') : 'Date to confirm';
}

export function eventDateLabel(value: string): string {
  if (!isCalendarDate(value)) return 'Date to confirm';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(dateFor(year, month, day));
}

export function dayMonth(value: string): { day: string; month: string; short: string } {
  if (!isCalendarDate(value)) return { day: '—', month: 'Date', short: 'Date to confirm' };
  const [year, month, day] = value.split('-').map(Number);
  const date = dateFor(year, month, day);
  return {
    day: String(day).padStart(2, '0'),
    month: new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: 'UTC' }).format(date),
    short: eventDateShort(value),
  };
}

function partsIn(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return 'Unknown time';
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}/${read('month')}/${read('day')} ${read('hour')}:${read('minute')}`;
}

export function timestampLabel(iso: string): string {
  return `${partsIn(iso, melbourne)} Australia/Melbourne · ${partsIn(iso, 'UTC')} UTC`;
}

export function todayInMelbourne(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: melbourne, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function isUpcoming(value: string, today: string): boolean {
  return isCalendarDate(value) && value >= today;
}

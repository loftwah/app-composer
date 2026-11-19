// Read-only agenda grouping for share calendar items (#663). Callers decide
// which items are in scope; a row's state (past, approved, published, failed)
// does not decide whether its intended date is shown. This module never
// schedules, mutates items or touches storage.

import {
  type ShareCalendarItem,
  melbourneLocalInput,
} from "./share-calendar.ts";

type AgendaDay = { date: string; items: ShareCalendarItem[] };

type ScheduledEntry = {
  item: ShareCalendarItem;
  instant: number;
  order: number;
};

export function shareCalendarAgenda(
  items: readonly ShareCalendarItem[],
): AgendaDay[] {
  const days = new Map<string, ScheduledEntry[]>();

  for (const [order, item] of items.entries()) {
    if (!item.scheduledAt) continue;
    // The stored instant is the intended schedule. Its Melbourne wall-clock
    // date is the day the owner sees in their calendar.
    const local = melbourneLocalInput(item.scheduledAt);
    if (!local) continue; // undated or invalid
    const instant = Date.parse(item.scheduledAt);
    if (Number.isNaN(instant)) continue;

    const date = local.slice(0, 10); // YYYY-MM-DD
    const entries = days.get(date);
    if (entries) entries.push({ item, instant, order });
    else days.set(date, [{ item, instant, order }]);
  }

  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => ({
      date,
      items: entries
        .sort(
          (left, right) => left.instant - right.instant || left.order - right.order,
        )
        .map((entry) => entry.item),
    }));
}

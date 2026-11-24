// One optional Top Nine calendar day. The shared enquiry validator supplies the
// bounded Gregorian rule; its fixed en-AU/UTC formatter keeps the written day
// identical in every device timezone. Nothing here reads the current date.
import { calendarDateLabel, isCalendarDate } from "../enquiries/enquiry-calendar.ts";

export const topNineDateMin = "0001-01-01";
export const topNineDateMax = "9999-12-31";

/** The exact portable YYYY-MM-DD value, or blank for absent/invalid input. */
export const topNineDate = (value: unknown): string => isCalendarDate(value) ? value : "";

/** The deterministic readable label printed in the preview, caption and PNG. */
export const topNineDateLabel = (value: unknown): string => calendarDateLabel(topNineDate(value)) ?? "";

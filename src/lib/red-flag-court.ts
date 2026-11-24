import { cleanText } from "./share-experience-draft.ts";

/** One tabloid docket for the Internet Workshop, reusing the owned “Red flag or
 * green flag?” courtroom poster. Ten brief, fictional computer habits; the
 * participant calls each one green or red in this tab. No vote, public result,
 * ranking, account, provider or saved value exists. The downloaded card prints
 * only the current case and its verdict. Kept pure so the docket, the verdict
 * state and the exact printed card can be checked without a browser. */
export const redFlagCourtTitle = "Red flag or green flag?";
export const redFlagCourtPrintTitle = "Red flag court";
export const redFlagCourtSubtitle = "The Daily Docket";
/** One verdict label; these exact words appear on the stage and the card. */
export const redFlagVerdictLabels = {
  green: "Green flag",
  red: "Red flag",
} as const;
export type RedFlagVerdict = keyof typeof redFlagVerdictLabels;

export interface RedFlagCase {
  /** Stable internal name, never printed. */
  readonly id: string;
  /** A short docket tab; the full case remains its accessible name. */
  readonly tab: string;
  /** The exact fictional habit printed on the card. */
  readonly habit: string;
}

/** The poster's own 47-tab case opens the docket. The nine that follow are
 * original, short habits written for this round: no real person, employer,
 * product, ranking, surveillance or wrongdoing is described. */
export const redFlagCourtCases = [
  {
    id: "forty-seven-tabs",
    tab: "47 tabs",
    habit: "Forty-seven browser tabs are open, and every single one is important.",
  },
  {
    id: "final-final",
    tab: "File names",
    habit: "Every file is called final, final-final or final-final-v2.",
  },
  {
    id: "unread-inbox",
    tab: "Inbox",
    habit: "The inbox holds three thousand unread messages and one very old receipt.",
  },
  {
    id: "charger-every-bag",
    tab: "Chargers",
    habit: "There is a charger in every bag, and none of them are labelled.",
  },
  {
    id: "desktop-folder",
    tab: "Desktop",
    habit: "The desktop is one folder called Desktop, full of screenshots.",
  },
  {
    id: "cable-drawer",
    tab: "Cable drawer",
    habit: "The cable drawer keeps twenty-seven adapters just in case.",
  },
  {
    id: "sticky-note-monitor",
    tab: "Sticky note",
    habit: "One monitor is reserved for a single sticky note that says tidy up.",
  },
  {
    id: "update-later",
    tab: "Update later",
    habit: "Every update prompt has been postponed until next week for two years.",
  },
  {
    id: "reinstall-font",
    tab: "Reinstall",
    habit: "The whole machine gets reinstalled to fix one stubborn font.",
  },
  {
    id: "manual-last",
    tab: "Manual",
    habit: "The manual is opened only after the thing has stopped working.",
  },
] as const satisfies readonly RedFlagCase[];

export const redFlagCourtCount = redFlagCourtCases.length;

/** One empty call per case, in docket order. These never leave memory. */
export const redFlagCourtStart = (): (RedFlagVerdict | null)[] =>
  Array.from({ length: redFlagCourtCount }, () => null);

/** Accept only the two authored verdicts. Any other value is no verdict. */
export function readRedFlagVerdict(value: unknown): RedFlagVerdict | null {
  return value === "green" || value === "red" ? value : null;
}

/** A case is addressed by its small integer position, never by printed text. */
export function redFlagCourtCase(index: unknown): RedFlagCase | null {
  return Number.isInteger(index) && Number(index) >= 0 && Number(index) < redFlagCourtCount
    ? redFlagCourtCases[Number(index)]
    : null;
}

/** How many of the ten cases have a call, for the quiet progress line. */
export function redFlagCourtCalled(verdicts: readonly (RedFlagVerdict | null)[]): number {
  return verdicts.slice(0, redFlagCourtCount).filter((verdict) => verdict !== null).length;
}

export interface RedFlagCourtCard {
  /** The case's 1-based docket position. */
  number: number;
  /** The short docket tab. */
  tab: string;
  /** The exact habit the card prints. */
  habit: string;
  verdict: RedFlagVerdict;
  /** “Red flag” or “Green flag”, exactly as printed. */
  verdictLabel: string;
}

/** Exactly what the stage and the PNG print. An unknown case or verdict
 * produces no card, so a crafted control value can never print arbitrary text. */
export function redFlagCourtCard(index: unknown, verdict: unknown): RedFlagCourtCard | null {
  const entry = redFlagCourtCase(index);
  const call = readRedFlagVerdict(verdict);
  if (!entry || !call) return null;
  return {
    number: Number(index) + 1,
    tab: entry.tab,
    habit: cleanText(entry.habit, 160),
    verdict: call,
    verdictLabel: redFlagVerdictLabels[call],
  };
}

/** The exact text the downloaded card prints, described plainly for alt text
 * with an optional byline only when the card itself carries one. */
export function redFlagCourtAltText(input: {
  byline?: string;
  courtCase?: unknown;
  verdict?: unknown;
}): string {
  const card = redFlagCourtCard(input.courtCase, input.verdict);
  if (!card) return "";
  const by = cleanText(input.byline, 48);
  const habit = /[.!?…]$/.test(card.habit) ? card.habit : `${card.habit}.`;
  return [
    "Red flag court, a tabloid verdict card.",
    `Case ${card.number} of ${redFlagCourtCount}: ${habit}`,
    `The verdict is a ${card.verdictLabel.toLowerCase()}.`,
    ...(by ? [`By ${by}.`] : []),
  ].join(" ");
}

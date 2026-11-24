import { cleanText } from "./share-experience-draft.ts";
import { experiencePath } from "./share-experiences.ts";

/** One elimination round for the Internet Workshop, matching the owned
 * “one-must-go” poster: four good things on a noir stage, one leaves, three
 * stay. The owned round and two authored built-ins can be challenged with an
 * answer-free link; a round a visitor writes stays private to the tab. No
 * answer, vote, percentage or saved draft is ever serialized. Kept pure so the
 * rounds, links and elimination can be checked without a browser. */
export const oneMustGoTitle = "One must go.";
export const oneMustGoChoiceCount = 4;
/** One visible choice on the stage and in the PNG. */
export const oneMustGoChoiceLimit = 40;
/** The owned starter round named on the poster itself. */
export const oneMustGoStarterChoices = ["Music", "Games", "Code", "The Web"] as const;
/** Fixed, allowlisted ids for the two authored built-in rounds. The owned
 * poster round has no id: it is always the bare route. */
export const oneMustGoBuiltinIds = ["weekend", "web-tools"] as const;
export type OneMustGoBuiltinId = (typeof oneMustGoBuiltinIds)[number];

type OneMustGoBuiltinRound = {
  source: "builtin";
  id: OneMustGoBuiltinId;
  label: string;
  choices: readonly string[];
};

export type OneMustGoRound =
  | OneMustGoBuiltinRound
  | { source: "starter" | "custom"; choices: readonly string[] };

export const oneMustGoStarter: OneMustGoRound = {
  choices: [...oneMustGoStarterChoices],
  source: "starter",
};

/** Two friendly Workshop rounds, each exactly four distinct choices. Authored
 * in full for this stage: no borrowed franchise, person or external asset. */
export const oneMustGoBuiltinRounds: Record<OneMustGoBuiltinId, OneMustGoBuiltinRound> = {
  weekend: {
    choices: ["A long walk", "A film at home", "A project in the shed", "Coffee with a friend"],
    source: "builtin",
    id: "weekend",
    label: "Weekend plans",
  },
  "web-tools": {
    choices: ["A personal site", "An RSS reader", "A search engine", "A group chat"],
    source: "builtin",
    id: "web-tools",
    label: "Web tools",
  },
};

export interface OneMustGoOutcome {
  /** The one choice that leaves the stage. */
  gone: string;
  /** The other three, in their original stage order. */
  remaining: string[];
}

export type OneMustGoDraft =
  | { ok: true; round: OneMustGoRound }
  | { ok: false; message: string };

/** An authored round is exactly four bounded, nonempty, distinct choices.
 * Values are cleaned like every other typed share text; duplicates are
 * compared after cleaning so an elimination can never be ambiguous. */
export function readOneMustGoChoices(values: readonly unknown[]): OneMustGoDraft {
  if (values.length !== oneMustGoChoiceCount) {
    return { ok: false, message: `Enter exactly ${oneMustGoChoiceCount} choices.` };
  }
  const choices = values.map((value) => cleanText(value, oneMustGoChoiceLimit));
  if (choices.some((choice) => !choice)) {
    return { ok: false, message: "Fill in all four choices." };
  }
  const folded = choices.map((choice) => choice.normalize("NFC").toLocaleLowerCase());
  if (new Set(folded).size !== oneMustGoChoiceCount) {
    return { ok: false, message: "Give each of the four choices its own name." };
  }
  return { ok: true, round: { choices, source: "custom" } };
}

/** The quiet stage note for the round currently on the noir stage. */
export function oneMustGoRoundNote(round: OneMustGoRound): string {
  if (round.source === "builtin") return `${round.label ?? "Built-in"} round`;
  return round.source === "custom" ? "Your round, kept in this tab" : "Poster round";
}

/** The only query key a built-in challenge link may carry. */
export const oneMustGoQueryKey = "round";

/** The bare canonical route: the owned poster round with no query at all. */
export const oneMustGoBlankPath = experiencePath("one-must-go");

/** The canonical answer-free link to a fresh built-in round. The owned poster
 * round keeps the bare route; a private authored round never becomes a link.
 * Nothing about a choice, result, byline or custom text enters the address. */
export function oneMustGoRoundPath(round: OneMustGoRound): string | null {
  if (round.source === "custom") return null;
  if (round.source === "builtin") {
    return `${oneMustGoBlankPath}?${oneMustGoQueryKey}=${round.id}`;
  }
  return oneMustGoBlankPath;
}

/** Reads the one allowlisted id a challenge link may carry. Only the exact
 * `round=<id>` pair counts. Missing, duplicated, encoded, case-changed,
 * extra-key or unknown values open the owned poster round, so a crafted link
 * can never select arbitrary text or restore a choice. */
export function oneMustGoRoundFromQuery(search: string): OneMustGoRound {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const match = /^round=([a-z0-9-]+)$/.exec(raw);
  if (!match || !Object.hasOwn(oneMustGoBuiltinRounds, match[1])) return oneMustGoStarter;
  return oneMustGoBuiltinRounds[match[1] as OneMustGoBuiltinId];
}

/** Eliminate exactly one valid choice. Anything outside the four is ignored. */
export function oneMustGoOutcome(round: OneMustGoRound, index: number): OneMustGoOutcome | null {
  if (!Number.isInteger(index) || index < 0 || index >= round.choices.length) return null;
  return {
    gone: round.choices[index],
    remaining: round.choices.filter((_, position) => position !== index),
  };
}

/** “Music, Games and The Web” for the stage sentence and status announcement. */
export function oneMustGoRemainingLine(remaining: readonly string[]): string {
  if (remaining.length === 0) return "";
  if (remaining.length === 1) return remaining[0];
  return `${remaining.slice(0, -1).join(", ")} and ${remaining.at(-1)}`;
}

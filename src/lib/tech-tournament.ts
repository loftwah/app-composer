/** One local Internet World Cup bracket for the Internet Workshop, reusing the
 * owned “tech-tournament” poster and its Terminal versus GUI opening match.
 *
 * Eight familiar computer tools meet in seven head-to-head picks: four
 * quarter-finals, two semi-finals and one final. The bracket is a fixed,
 * bounded list of seven choices held only in this tab. It never becomes a
 * result link, account, vote, score, ranking, provider call or stored value.
 * The downloaded winner card prints only the exact chosen champion and
 * runner-up, each with the original paired name written for this round.
 *
 * Kept pure so the bracket, its ordering, undo and the printed card can be
 * checked without a browser. */

export const techTournamentTitle = "Internet World Cup";
export const techTournamentPrintTitle = "Internet World Cup";
/** Seven matches: four quarter-finals, two semi-finals, one final. */
export const techTournamentPickCount = 7;

export type TechTournamentPick = 0 | 1;
export type TechTournamentRound = "quarter-final" | "semi-final" | "final";

export interface TechTournamentEntry {
  /** Stable internal name, never printed. */
  readonly id: string;
  /** The exact familiar tool name printed on the stage and the card. */
  readonly name: string;
  /** An original paired line, written for this round; never a borrowed title. */
  readonly pair: string;
}

/** The poster's own Terminal versus GUI match opens the bracket. The other six
 * entries are equally familiar tool primitives, each with its own short,
 * original paired name. */
export const techTournamentEntries = [
  { id: "terminal", name: "Terminal", pair: "the blinking cursor" },
  { id: "gui", name: "GUI", pair: "the window you drag" },
  { id: "keyboard", name: "Keyboard", pair: "the keys under your hands" },
  { id: "mouse", name: "Mouse", pair: "the pointer on the desk" },
  { id: "clipboard", name: "Clipboard", pair: "the invisible pocket" },
  { id: "undo", name: "Undo", pair: "the second chance" },
  { id: "save", name: "Save", pair: "the little disk" },
  { id: "search", name: "Search", pair: "the empty box" },
] as const satisfies readonly TechTournamentEntry[];

export type TechTournamentEntryId = (typeof techTournamentEntries)[number]["id"];

export interface TechTournamentMatch {
  /** 0–6, in bracket order. */
  readonly id: number;
  readonly round: TechTournamentRound;
  /** Position within its round, 0-based. */
  readonly slot: number;
  /** Four quarter-finals start with two entry indexes. */
  readonly entrants: readonly [number, number] | null;
  /** Later rounds are fed by the winners of two earlier match indexes. */
  readonly feeders: readonly [number, number] | null;
}

export const techTournamentMatches = [
  { id: 0, round: "quarter-final", slot: 0, entrants: [0, 1], feeders: null },
  { id: 1, round: "quarter-final", slot: 1, entrants: [2, 3], feeders: null },
  { id: 2, round: "quarter-final", slot: 2, entrants: [4, 5], feeders: null },
  { id: 3, round: "quarter-final", slot: 3, entrants: [6, 7], feeders: null },
  { id: 4, round: "semi-final", slot: 0, entrants: null, feeders: [0, 1] },
  { id: 5, round: "semi-final", slot: 1, entrants: null, feeders: [2, 3] },
  { id: 6, round: "final", slot: 0, entrants: null, feeders: [4, 5] },
] as const satisfies readonly TechTournamentMatch[];

const finalMatch = techTournamentPickCount - 1;

function readSide(value: unknown): TechTournamentPick | null {
  return value === 0 || value === 1 ? value : null;
}

function readIndex(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < techTournamentPickCount
    ? Number(value)
    : null;
}

/** Exactly seven slots, each empty or one of the two authored sides. Any
 * foreign value is treated as empty, so a crafted control can never widen the
 * bracket or print arbitrary text. */
export function normaliseTechTournamentBracket(value: unknown): (TechTournamentPick | null)[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: techTournamentPickCount }, (_, index) => readSide(source[index]));
}

export function techTournamentStart(): (TechTournamentPick | null)[] {
  return Array.from({ length: techTournamentPickCount }, () => null);
}

export function techTournamentEntry(index: unknown): TechTournamentEntry | null {
  return Number.isInteger(index) && Number(index) >= 0 && Number(index) < techTournamentEntries.length
    ? techTournamentEntries[Number(index)] ?? null
    : null;
}

export function techTournamentMatch(index: unknown): TechTournamentMatch | null {
  const at = readIndex(index);
  return at === null ? null : techTournamentMatches[at] ?? null;
}

/** “Quarter-final 1”, “Semi-final 2”, “Final”. */
export function techTournamentMatchLabel(index: unknown): string {
  const match = techTournamentMatch(index);
  if (!match) return "";
  if (match.round === "final") return "Final";
  return `${match.round === "quarter-final" ? "Quarter-final" : "Semi-final"} ${match.slot + 1}`;
}

/** The name shown in an undecided later-round slot, e.g. “Winner of
 * Quarter-final 1”. A quarter-final prints its real entrant instead. */
export function techTournamentPlaceholder(index: unknown, side: unknown): string {
  const match = techTournamentMatch(index);
  const choice = readSide(side);
  if (!match || choice === null) return "";
  if (match.entrants) return techTournamentEntry(match.entrants[choice])?.name ?? "";
  if (!match.feeders) return "";
  return `Winner of ${techTournamentMatchLabel(match.feeders[choice])}`;
}

/** The two entrants of one match when both are known. A later round waits for
 * its two feeder winners, so a placeholder is shown instead of a guess. */
export function techTournamentParticipants(
  bracket: unknown,
  index: unknown,
): readonly [TechTournamentEntry, TechTournamentEntry] | null {
  const match = techTournamentMatch(index);
  if (!match) return null;
  if (match.entrants) {
    const left = techTournamentEntry(match.entrants[0]);
    const right = techTournamentEntry(match.entrants[1]);
    return left && right ? [left, right] : null;
  }
  if (!match.feeders) return null;
  const left = techTournamentWinner(bracket, match.feeders[0]);
  const right = techTournamentWinner(bracket, match.feeders[1]);
  return left && right ? [left, right] : null;
}

/** The exact entry chosen in a decided match, or null while it waits. */
export function techTournamentWinner(bracket: unknown, index: unknown): TechTournamentEntry | null {
  const match = techTournamentMatch(index);
  if (!match) return null;
  const picks = normaliseTechTournamentBracket(bracket);
  const side = picks[match.id];
  if (side === null) return null;
  return techTournamentParticipants(picks, match.id)?.[side] ?? null;
}

/** The entry that lost a decided match, or null while it waits. */
export function techTournamentRunnerUp(bracket: unknown, index: unknown): TechTournamentEntry | null {
  const match = techTournamentMatch(index);
  if (!match) return null;
  const picks = normaliseTechTournamentBracket(bracket);
  const side = picks[match.id];
  if (side === null) return null;
  return techTournamentParticipants(picks, match.id)?.[side === 0 ? 1 : 0] ?? null;
}

/** The next match to pick, or null when all seven are decided. Ordered play
 * keeps every later round consistent with the picks before it. */
export function techTournamentCurrent(bracket: unknown): number | null {
  const picks = normaliseTechTournamentBracket(bracket);
  for (const match of techTournamentMatches) {
    if (picks[match.id] !== null) continue;
    return techTournamentParticipants(picks, match.id) ? match.id : null;
  }
  return null;
}

export function techTournamentPickCountMade(bracket: unknown): number {
  return normaliseTechTournamentBracket(bracket).filter((side) => side !== null).length;
}

export function techTournamentComplete(bracket: unknown): boolean {
  return techTournamentCurrent(bracket) === null
    && techTournamentPickCountMade(bracket) === techTournamentPickCount;
}

/** Pick one side in the one current match. Anything else is ignored, including
 * a future round whose entrants are not yet known. */
export function techTournamentPick(
  bracket: unknown,
  index: unknown,
  side: unknown,
): (TechTournamentPick | null)[] {
  const picks = normaliseTechTournamentBracket(bracket);
  const match = readIndex(index);
  const choice = readSide(side);
  if (match === null || choice === null) return picks;
  if (techTournamentCurrent(picks) !== match) return picks;
  if (!techTournamentParticipants(picks, match)) return picks;
  picks[match] = choice;
  return picks;
}

/** Undo the most recent pick. One or more can be undone by pressing again. */
export function techTournamentUndo(bracket: unknown): (TechTournamentPick | null)[] {
  const picks = normaliseTechTournamentBracket(bracket);
  for (let index = techTournamentPickCount - 1; index >= 0; index -= 1) {
    if (picks[index] !== null) {
      picks[index] = null;
      return picks;
    }
  }
  return picks;
}

export interface TechTournamentOutcome {
  /** The exact winner of the final. */
  winner: TechTournamentEntry;
  /** The other finalist, in bracket order. */
  runnerUp: TechTournamentEntry;
}

/** The completed bracket's champion and runner-up, or null before the final is
 * decided. */
export function techTournamentOutcome(bracket: unknown): TechTournamentOutcome | null {
  if (!techTournamentComplete(bracket)) return null;
  const picks = normaliseTechTournamentBracket(bracket);
  const participants = techTournamentParticipants(picks, finalMatch);
  const side = picks[finalMatch];
  if (!participants || side === null) return null;
  return {
    winner: participants[side],
    runnerUp: participants[side === 0 ? 1 : 0],
  };
}

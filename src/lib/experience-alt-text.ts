/** Plain-text descriptions of the local games' downloaded PNGs.
 *
 * Each formatter uses exactly the text the renderer prints: the tier list's
 * title and four named rows, one-must-go's title, crossed-out choice and
 * remaining choices in stage order, and the wrong-answer plate's selected
 * question and answer. The optional byline is included only when the export
 * prints one. No link, cover, file detail or other round's text enters it, and
 * these functions stay free of DOM access so a focused test can check the
 * string deterministically. */

import { cleanText } from "./share-experience-draft.ts";
import {
  tierListEntryLimit, tierListRows, tierListTiers, tierListTitleLimit,
} from "./tier-list.ts";
import {
  oneMustGoChoiceCount, oneMustGoChoiceLimit, oneMustGoOutcome,
  oneMustGoRemainingLine, oneMustGoTitle,
} from "./one-must-go.ts";
import { wrongAnswerPlate, wrongAnswerPrintTitle } from "./wrong-answers.ts";
import { customThisOrThatOptionLimit, isThisOrThatLength } from "./this-or-that.ts";
import {
  techTournamentOutcome, techTournamentPickCount, techTournamentTitle,
} from "./tech-tournament.ts";

/** One sentence, without doubling a line's own closing punctuation. */
const sentence = (value: string) => /[.!?…]$/.test(value) ? value : `${value}.`;

/** The sign-off the PNG prints only when a byline was actually typed. */
const bylineLine = (value: unknown) => {
  const by = cleanText(value, 48);
  return by ? sentence(`By ${by}`) : "";
};

/** A short list that keeps the printed order and reads naturally aloud. */
const list = (values: readonly string[]) => values.length > 1
  ? `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`
  : values[0] ?? "";

/** The This-or-That text-only PNG: its title, optional byline and every chosen
 * option in question order. Prompts, unchosen sides, private photo descriptions
 * and links never reach the description. Five, nine and eleven are the only
 * complete authored lengths. */
export function thisOrThatAltText(input: {
  title?: string;
  byline?: string;
  items?: readonly string[];
}): string {
  const title = cleanText(input.title, 72);
  const items = (input.items ?? []).map((item) => cleanText(item, customThisOrThatOptionLimit));
  if (!title || !isThisOrThatLength(items.length) || items.some((item) => !item)) return "";
  const byline = bylineLine(input.byline);
  return [
    sentence(title),
    ...(byline ? [byline] : []),
    ...items.map(sentence),
  ].join(" ");
}

/** The tier-list PNG: its title, an optional byline and all four named rows in
 * print order, each with its entries. An empty row prints “Empty row”, so the
 * description says so rather than naming a row the image does not fill. */
export function tierListAltText(input: {
  title?: string;
  byline?: string;
  items?: readonly string[];
  tierSizes?: readonly number[];
}): string {
  const title = cleanText(input.title, tierListTitleLimit);
  const items = (input.items ?? []).map((item) => cleanText(item, tierListEntryLimit)).filter(Boolean);
  if (!title || !items.length) return "";
  const rows = tierListRows(items, input.tierSizes);
  const byline = bylineLine(input.byline);
  return [
    sentence(title),
    ...(byline ? [byline] : []),
    ...tierListTiers.map((tier, index) => rows[index].length
      ? sentence(`${tier.label} contains ${list(rows[index])}`)
      : `${tier.label} is empty.`),
  ].join(" ");
}

/** The one-must-go PNG: its title, the one choice crossed out and the other
 * three in their original stage order, with an optional byline. */
export function oneMustGoAltText(input: {
  title?: string;
  byline?: string;
  items?: readonly string[];
  marked?: readonly number[];
}): string {
  const title = cleanText(input.title, 72) || oneMustGoTitle;
  const choices = (input.items ?? []).map((choice) => cleanText(choice, oneMustGoChoiceLimit));
  const gone = (input.marked ?? []).find((index) =>
    Number.isInteger(index) && index >= 0 && index < choices.length);
  const outcome = gone === undefined || choices.length !== oneMustGoChoiceCount || choices.some((choice) => !choice)
    ? null
    : oneMustGoOutcome({ choices, source: "starter" }, gone);
  if (!outcome) return "";
  const byline = bylineLine(input.byline);
  return [
    sentence(title),
    ...(byline ? [byline] : []),
    sentence(`${outcome.gone} is crossed out`),
    sentence(`${oneMustGoRemainingLine(outcome.remaining)} stay on the stage`),
  ].join(" ");
}

/** The wrong-answer plate: the exact selected question and answer it prints,
 * plus a byline only when the plate prints one. No other prompt's text, sheet
 * position or private note reaches the description. */
export function wrongAnswersAltText(input: { byline?: string; prompt?: string; answer?: string }): string {
  const plate = wrongAnswerPlate(input.prompt, input.answer);
  if (!plate) return "";
  const byline = bylineLine(input.byline);
  return [
    sentence(wrongAnswerPrintTitle),
    ...(byline ? [byline] : []),
    sentence(plate.prompt),
    sentence(`The answer reads ${plate.answer}`),
  ].join(" ");
}

/** The Internet World Cup winner card: the exact champion and runner-up the
 * PNG prints, each with its original paired name, plus an optional byline.
 * Nothing about the other five matches or any score reaches the description. */
export function techTournamentAltText(input: {
  byline?: string;
  tournamentPicks?: readonly unknown[];
}): string {
  const outcome = techTournamentOutcome(input.tournamentPicks);
  if (!outcome) return "";
  const byline = bylineLine(input.byline);
  return [
    sentence(`${techTournamentTitle} winner card`),
    ...(byline ? [byline] : []),
    sentence(`${outcome.winner.name}, ${outcome.winner.pair}, is your champion after ${techTournamentPickCount} local picks`),
    sentence(`${outcome.runnerUp.name}, ${outcome.runnerUp.pair}, is the runner-up`),
  ].join(" ");
}

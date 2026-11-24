import { cleanText } from "./share-experience-draft.ts";

/** One #1074 “Wrong Answers Only” sheet for the Internet Workshop. Ten brief
 * authored questions, one bounded plain-text answer at a time, held only in
 * this tab. A sheet never becomes a result link, vote, score, ranking, draft or
 * request; the downloadable PNG is the only way the words leave. Kept pure so
 * the prompt set, answer bound and exact printed plate can be checked without
 * a browser. */
export const wrongAnswerPrintTitle = "Wrong answers only";
/** One visible answer on the stage and in the PNG. */
export const wrongAnswerLimit = 240;
/** The authored prompt’s own bound when a printed plate is read back. */
export const wrongAnswerPromptLimit = 80;

export interface WrongAnswerPrompt {
  /** The full question shown on the sheet. */
  readonly question: string;
  /** A short index-tab label; the full question remains its accessible name. */
  readonly tab: string;
}

/** The poster’s own question opens the sheet. The rest are original, brief
 * invitations to explain an ordinary thing completely wrongly. */
export const wrongAnswerPrompts = [
  { tab: "Database", question: "What happens inside a database?" },
  { tab: "Deleted files", question: "Where do deleted files go?" },
  { tab: "Wi-fi", question: "What keeps the wi-fi in the air?" },
  { tab: "Printer", question: "Why does the printer jam on Fridays?" },
  { tab: "Passwords", question: "How does a password remember you?" },
  { tab: "Internet", question: "Who folds the internet at night?" },
  { tab: "Cloud", question: "What is a cloud made of?" },
  { tab: "Battery", question: "Why does the battery die at three o’clock?" },
  { tab: "Cursor", question: "Where does the mouse cursor sleep?" },
  { tab: "Moon", question: "What does the moon do during an update?" },
] as const satisfies readonly WrongAnswerPrompt[];

export const wrongAnswerCount = wrongAnswerPrompts.length;

/** One empty answer per prompt, in sheet order. These never leave memory. */
export const wrongAnswerStart = (): string[] =>
  Array.from({ length: wrongAnswerCount }, () => "");

export interface WrongAnswerPlate {
  /** The exact cleaned prompt the PNG prints. */
  prompt: string;
  /** The exact cleaned answer the PNG prints. */
  answer: string;
  /** The authored prompt’s 1-based position, or 0 for any other text. */
  number: number;
  /** The short index tab beside the position, or empty for other text. */
  tab: string;
}

/** Exactly what the stage and the PNG print. An empty answer produces no plate,
 * so a download can never carry a blank correction. Typed text is cleaned like
 * every other share answer: surrounding space is trimmed and runs of
 * whitespace become one space, while every word is retained. */
export function wrongAnswerPlate(prompt: unknown, answer: unknown): WrongAnswerPlate | null {
  const question = cleanText(prompt, wrongAnswerPromptLimit);
  const text = cleanText(answer, wrongAnswerLimit);
  if (!question || !text) return null;
  const position = wrongAnswerPrompts.findIndex((entry) => entry.question === question);
  return {
    prompt: question,
    answer: text,
    number: position + 1,
    tab: position >= 0 ? wrongAnswerPrompts[position].tab : "",
  };
}

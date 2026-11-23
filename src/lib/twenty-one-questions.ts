import { twentyOneQuestions } from "./share-experiences.ts";
import { cleanText } from "./share-experience-draft.ts";

/** One #1064 twenty-one-questions run. Answers are plain text held only in
 * the current screen’s memory: there is no draft storage, no result link and
 * no request, so nothing here ever needs to survive a reload. Kept pure so
 * the answer, skip, back, edit and card-splitting contract can be checked
 * without a browser. */
export type TwentyOneAnswers = readonly string[];

export const twentyOneCount = twentyOneQuestions.length;
export const twentyOneAnswerLimit = 80;
/** Answers per downloaded 4:5 card, chosen so a full twenty-one answer run
 * stays readable at large type across several cards. */
export const twentyOneCardSize = 6;

export const twentyOneStart = (): string[] =>
  Array.from({ length: twentyOneCount }, () => "");

/** Records one cleaned answer at its question. A blank value is an honest
 * skip; any typed answer is collapsed and capped by the shared limit. */
export function setTwentyOneAnswer(
  answers: TwentyOneAnswers,
  question: number,
  value: unknown,
): string[] | null {
  if (!Number.isInteger(question) || question < 0 || question >= answers.length) return null;
  const next = [...answers];
  next[question] = cleanText(value, twentyOneAnswerLimit);
  return next;
}

/** Skips one question: its answer is cleared exactly, every other answer
 * stays, and the run remains replayable and editable. */
export function skipTwentyOne(answers: TwentyOneAnswers, question: number): string[] | null {
  if (!Number.isInteger(question) || question < 0 || question >= answers.length) return null;
  const next = [...answers];
  next[question] = "";
  return next;
}

export function twentyOneAnswered(answers: TwentyOneAnswers): number {
  return answers.filter((answer) => answer !== "").length;
}

/** One step back or forward through the interview, clamped to the run. */
export function moveTwentyOne(question: number, step: number): number {
  if (!Number.isInteger(question) || !Number.isInteger(step)) return 0;
  return Math.min(Math.max(question + step, 0), twentyOneCount - 1);
}

export function twentyOneProgress(
  question: number,
  answers: TwentyOneAnswers,
): { question: number; total: number; answered: number } {
  return {
    question: Math.min(Math.max(question, 0) + 1, twentyOneCount),
    total: twentyOneCount,
    answered: twentyOneAnswered(answers),
  };
}

export interface TwentyOnePair {
  /** The question’s own index, 0–20, so cards and summaries stay numbered. */
  index: number;
  question: string;
  answer: string;
}

/** Every answered pair in question order. A summary and a card set are both
 * made of these; skipped questions are simply absent. */
export function twentyOnePairs(
  answers: TwentyOneAnswers,
  questions: readonly string[] = twentyOneQuestions,
): TwentyOnePair[] {
  const pairs: TwentyOnePair[] = [];
  answers.forEach((answer, index) => {
    const question = questions[index];
    if (answer === "" || !question) return;
    pairs.push({ index, question, answer });
  });
  return pairs;
}

/** Splits pairs into card groups of at most `perCard`, keeping question
 * order, so a download is several readable 4:5 cards rather than one poster. */
export function splitTwentyOneCards<T>(pairs: readonly T[], perCard = twentyOneCardSize): T[][] {
  const size = Number.isInteger(perCard) && perCard > 0 ? perCard : twentyOneCardSize;
  const cards: T[][] = [];
  for (let start = 0; start < pairs.length; start += size) {
    cards.push([...pairs.slice(start, start + size)]);
  }
  return cards;
}

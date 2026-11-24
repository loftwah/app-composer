import { experiencePath, twentyOneQuestions } from "./share-experiences.ts";
import { cleanText } from "./share-experience-draft.ts";

/** One #1064 twenty-one-questions run. Answers are plain text held only in
 * the current screen’s memory: there is no draft storage, no result link and
 * no request, so nothing here ever needs to survive a reload. Kept pure so
 * the answer, skip, back, edit and card-splitting contract can be checked
 * without a browser. */
export type TwentyOneAnswers = readonly string[];

export const twentyOneCount = twentyOneQuestions.length;
export const twentyOneAnswerLimit = 80;
/** The invite to the blank built-in game is the bare canonical route on this
 * origin: no query, fragment, answers, byline, result, authored prompts or
 * saved state ever travel with it. */
export const twentyOneBlankPath = experiencePath("twenty-one-questions");
/** Answers per downloaded 4:5 card, chosen so a full twenty-one answer run
 * stays readable at large type across several cards. */
export const twentyOneCardSize = 6;
/** Answers per downloaded Square card. A 1080×1080 canvas is shorter than 4:5,
 * so four rows keep the measured heading and answer type with real white space. */
export const twentyOneSquareCardSize = 4;
/** The authored prompt cap. It matches the built-in starter’s longest prompt
 * so an edited question still fits the same card row and heading. */
export const twentyOnePromptLimit = 72;

export const twentyOneStart = (): string[] =>
  Array.from({ length: twentyOneCount }, () => "");

export interface TwentyOnePromptsRead {
  /** The exact twenty-one cleaned prompts, or null while the lines fail. */
  prompts: readonly string[] | null;
  /** The first line needing attention: 0–20, or -1 when the set is usable. */
  gap: number;
  /** Why the set fails: wrong count, a blank line, an over-long or repeated prompt. */
  reason: "count" | "empty" | "long" | "duplicate" | null;
  /** Prompt lines read after ignoring blank lines at the end of the editor. */
  count: number;
}

/** Reads one authored set from the prompt editor’s raw lines. A closing newline
 * leaves trailing blank lines, which are ignored; every other blank line is a
 * gap. Each prompt gets the same visible-text cleaning as the starter and the
 * answers, then must be nonempty, within the card bound and distinct. */
export function readTwentyOnePrompts(lines: readonly unknown[]): TwentyOnePromptsRead {
  const rows = Array.from(lines);
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (typeof last !== "string" || last.trim() !== "") break;
    rows.pop();
  }
  if (rows.length !== twentyOneCount) {
    return { prompts: null, gap: -1, reason: "count", count: rows.length };
  }
  const prompts: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < rows.length; index += 1) {
    // One extra character reveals an over-long prompt instead of hiding it
    // behind the cleaner’s cap.
    const prompt = cleanText(rows[index], twentyOnePromptLimit + 1);
    if (!prompt) return { prompts: null, gap: index, reason: "empty", count: rows.length };
    if (prompt.length > twentyOnePromptLimit) {
      return { prompts: null, gap: index, reason: "long", count: rows.length };
    }
    const key = prompt.normalize("NFC").toLowerCase();
    if (seen.has(key)) {
      return { prompts: null, gap: index, reason: "duplicate", count: rows.length };
    }
    seen.add(key);
    prompts.push(prompt);
  }
  return { prompts, gap: -1, reason: null, count: rows.length };
}

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

/** The same ordered pairs as a private, readable plain-text summary. Each
 * block keeps the prompt’s original question number, then its answer on the
 * next line; skipped prompts never reach pairs, so none appear here. Both
 * texts are the already-cleaned, bounded prompt and answer from the run, and
 * no link, byline, result or file detail is added. */
export function twentyOneAnswersText(pairs: readonly TwentyOnePair[]): string {
  return pairs
    .filter((pair) => pair.question !== "" && pair.answer !== "")
    .map((pair) => `${pair.index + 1}. ${pair.question}\n${pair.answer}`)
    .join("\n\n");
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

/** One #1064 portable prompt file: a versioned schema and exactly the
 * twenty-one authored texts. Answers, bylines, results, identity and links have
 * no field, so the file cannot carry anything from a run. */
export const twentyOnePromptFileSchema = "composer.twenty-one-prompts/1";
export const twentyOnePromptFileName = "composer-21-questions-prompts.json";
/** Bytes, not characters: the same bound covers what this page writes and what
 * it opens, and is checked before the browser parses anything. */
export const twentyOnePromptFileLimit = 8_192;

/** The first reason a prompt file cannot fill the editor. The four text faults
 * are the ones the shared prompt validator already reports. */
export type TwentyOnePromptFileFault =
  | "oversized"
  | "unreadable"
  | "schema"
  | "version"
  | "shape"
  | "count"
  | "empty"
  | "long"
  | "duplicate";

export interface TwentyOnePromptFileRead {
  /** The exact validated prompts to fill the editor, or null on any fault. */
  readonly prompts: readonly string[] | null;
  readonly fault: TwentyOnePromptFileFault | null;
  /** The failing prompt index for a text fault, otherwise -1. */
  readonly gap: number;
}

/** Writes one already-validated set to fixed, deterministic bytes. Field order
 * and indentation never vary, so the same prompts always produce the same
 * file and the exact bytes can be read back before download. */
export function writeTwentyOnePromptFile(prompts: readonly string[]): string {
  const value = { schema: twentyOnePromptFileSchema, prompts: [...prompts] };
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Reads one prompt file against this page's exact schema and validator. The
 * byte bound is checked before JSON.parse, the schema before any content, and
 * only the two known fields are accepted — an `answers` field or any other
 * extra key is refused before the editor is touched. Every fault hands back
 * no prompts, so the caller keeps its text and its active run. */
export function readTwentyOnePromptFile(raw: unknown): TwentyOnePromptFileRead {
  const reject = (fault: TwentyOnePromptFileFault, gap = -1): TwentyOnePromptFileRead =>
    ({ prompts: null, fault, gap });
  if (typeof raw !== "string") return reject("unreadable");
  if (new TextEncoder().encode(raw).length > twentyOnePromptFileLimit) return reject("oversized");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return reject("unreadable");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return reject("unreadable");
  const file = value as Record<string, unknown>;
  if (typeof file.schema !== "string") return reject("schema");
  if (file.schema !== twentyOnePromptFileSchema) {
    return reject(/^composer\.twenty-one-prompts\/\d+$/.test(file.schema) ? "version" : "schema");
  }
  const keys = Object.keys(file);
  if (keys.length !== 2 || !keys.includes("schema") || !keys.includes("prompts")) return reject("shape");
  if (!Array.isArray(file.prompts) || file.prompts.some((prompt) => typeof prompt !== "string")) {
    return reject("shape");
  }
  if (file.prompts.length !== twentyOneCount) return reject("count");
  // The same count, blank, length and distinctness checks the Apply button
  // uses: a file can only carry prompts the editor itself would accept.
  const read = readTwentyOnePrompts(file.prompts);
  if (!read.prompts) return reject(read.reason ?? "shape", read.gap);
  return { prompts: read.prompts, fault: null, gap: -1 };
}

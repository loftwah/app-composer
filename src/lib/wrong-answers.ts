import { cleanText } from "./share-experience-draft.ts";

/** One #1074 “Wrong Answers Only” sheet for the Internet Workshop. Ten brief
 * authored questions, one bounded plain-text answer at a time, held in this tab
 * until an explicit draft download. A sheet never becomes a result link, vote,
 * score, ranking or request; only the local JSON draft and downloadable PNG
 * carry words out. Kept pure so the prompt set, answer bound, portable draft
 * and exact printed plate can be checked without a browser. */
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

/** One empty answer per prompt, in sheet order. These never leave memory
 * without the maker downloading or opening a local draft file. */
export const wrongAnswerStart = (): string[] =>
  Array.from({ length: wrongAnswerCount }, () => "");

/** One portable local draft: all ten raw editor answers, including blank and
 * unfinished rows, plus the selected 0-based prompt. It carries no result,
 * prompt pack, byline, link, photo, score or stored state. */
export const wrongAnswerDraftFileSchema = "composer.wrong-answers-draft/1";
export const wrongAnswerDraftFileName = "wrong-answers-draft.json";
/** Bytes, not characters: the same fixed bound covers writes and opens, and is
 * checked before JSON.parse. */
export const wrongAnswerDraftFileLimit = 16 * 1024;

export interface WrongAnswerDraft {
  readonly answers: readonly string[];
  readonly prompt: number;
}

export type WrongAnswerDraftFileFault =
  | "oversized"
  | "unreadable"
  | "schema"
  | "version"
  | "shape"
  | "long"
  | "prompt";

export interface WrongAnswerDraftFileRead {
  /** The exact raw editor draft, or null on every fault. */
  readonly draft: WrongAnswerDraft | null;
  readonly fault: WrongAnswerDraftFileFault | null;
  /** The failing answer for a row fault, otherwise -1. */
  readonly gap: number;
}

interface WrongAnswerDraftAnswersRead {
  answers: string[] | null;
  fault: WrongAnswerDraftFileFault | null;
  gap: number;
}

/** Validate every answer without cleaning it: editable newlines, Unicode and
 * whitespace survive exactly, while a non-string or overlong row refuses the
 * whole file rather than silently truncating it. */
function readWrongAnswerDraftAnswers(value: unknown): WrongAnswerDraftAnswersRead {
  const reject = (
    fault: WrongAnswerDraftFileFault,
    gap = -1,
  ): WrongAnswerDraftAnswersRead => ({ answers: null, fault, gap });
  if (!Array.isArray(value) || value.length !== wrongAnswerCount) return reject("shape");
  const answers: string[] = [];
  for (let index = 0; index < wrongAnswerCount; index += 1) {
    const text = value[index];
    if (typeof text !== "string") return reject("shape", index);
    if (text.length > wrongAnswerLimit) return reject("long", index);
    answers.push(text);
  }
  return { answers, fault: null, gap: -1 };
}

/** Write one already-bounded draft to deterministic local bytes. The exact
 * saved shape is accepted by the reader below, including blank rows. */
export function writeWrongAnswerDraftFile(
  answers: readonly unknown[],
  prompt: number,
): string | null {
  const read = readWrongAnswerDraftAnswers(answers);
  if (!read.answers || !Number.isInteger(prompt) || prompt < 0 || prompt >= wrongAnswerCount) return null;
  const text = `${JSON.stringify({
    schema: wrongAnswerDraftFileSchema,
    answers: read.answers,
    prompt,
  }, null, 2)}\n`;
  return new TextEncoder().encode(text).length <= wrongAnswerDraftFileLimit ? text : null;
}

/** Read one owned v1 draft. Bytes are bounded before parsing, the schema and
 * exact three-key shape before content, and every answer and the selected
 * prompt must validate before any draft is returned. */
export function readWrongAnswerDraftFile(raw: unknown): WrongAnswerDraftFileRead {
  const reject = (
    fault: WrongAnswerDraftFileFault,
    gap = -1,
  ): WrongAnswerDraftFileRead => ({ draft: null, fault, gap });
  if (typeof raw !== "string") return reject("unreadable");
  if (new TextEncoder().encode(raw).length > wrongAnswerDraftFileLimit) return reject("oversized");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return reject("unreadable");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return reject("unreadable");
  const file = value as Record<string, unknown>;
  if (typeof file.schema !== "string") return reject("schema");
  if (file.schema !== wrongAnswerDraftFileSchema) {
    return reject(/^composer\.wrong-answers-draft\/\d+$/.test(file.schema) ? "version" : "schema");
  }
  const keys = Object.keys(file);
  if (keys.length !== 3 || !keys.includes("schema") || !keys.includes("answers") || !keys.includes("prompt")) {
    return reject("shape");
  }
  const answers = readWrongAnswerDraftAnswers(file.answers);
  if (!answers.answers) return reject(answers.fault ?? "shape", answers.gap);
  if (typeof file.prompt !== "number" || !Number.isInteger(file.prompt)
    || file.prompt < 0 || file.prompt >= wrongAnswerCount) return reject("prompt");
  return { draft: { answers: answers.answers, prompt: file.prompt }, fault: null, gap: -1 };
}

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

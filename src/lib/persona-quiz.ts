import type { ExperienceId } from "./share-experiences.ts";
import { cleanText } from "./share-experience-draft.ts";

/** The shared “Which X are you?” engine used by the Developer Type Quiz and
 * the Language Type Quiz. A pack supplies its own original outcomes and
 * situations; this module owns the typed scoring, the deterministic tie-break,
 * the answer-free `#result=` fragment allow-list and the public result path.
 *
 * Scoring is deterministic: an option gives 2 to its primary outcome and 1 to
 * its paired secondary. The highest total wins. An exact tie goes to the
 * outcome the player chose directly (as primary) most often, then to the one
 * chosen directly earliest, then to the fixed outcome order below. Every pack
 * test enumerates all 4^8 runs so no result depends on the tie-break to be
 * reachable. */

export interface PersonaOutcome {
  /** The plain subject named on the result and card: a service or a language. */
  readonly label: string;
  readonly archetype: string;
  readonly tendency: string;
  readonly reason: string;
  readonly href: string;
}

export interface PersonaOption<Id extends string> {
  readonly label: string;
  readonly primary: Id;
  readonly secondary: Id;
}

export interface PersonaQuestion<Id extends string> {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly [
    PersonaOption<Id>,
    PersonaOption<Id>,
    PersonaOption<Id>,
    PersonaOption<Id>,
  ];
}

export interface PersonaTally<Id extends string> {
  readonly id: Id;
  readonly score: number;
  /** How often this outcome was the player’s direct (primary) choice. */
  readonly direct: number;
  /** The earliest question answered directly for this outcome, or Infinity. */
  readonly firstDirect: number;
}

export interface PersonaQuiz<Id extends string, Outcome extends PersonaOutcome> {
  readonly path: string;
  readonly outcomes: Record<Id, Outcome>;
  readonly ids: readonly Id[];
  readonly questions: readonly PersonaQuestion<Id>[];
  readonly questionCount: number;
  tally(answers: unknown): PersonaTally<Id>[] | null;
  resolve(answers: unknown): Id | null;
  outcomeFromHash(hash: string): Id | null;
  resultPath(id: Id): string;
}

export interface PersonaQuizConfig<Id extends string, Outcome extends PersonaOutcome> {
  readonly path: string;
  readonly outcomes: Record<Id, Outcome>;
  readonly questions: readonly PersonaQuestion<Id>[];
}

export function createPersonaQuiz<Id extends string, Outcome extends PersonaOutcome>(
  config: PersonaQuizConfig<Id, Outcome>,
): PersonaQuiz<Id, Outcome> {
  const ids = Object.keys(config.outcomes) as Id[];
  const questionCount = config.questions.length;

  function compareTallies(a: PersonaTally<Id>, b: PersonaTally<Id>): number {
    return b.score - a.score
      || b.direct - a.direct
      || a.firstDirect - b.firstDirect
      || ids.indexOf(a.id) - ids.indexOf(b.id);
  }

  /** Every outcome’s total for one complete run, best first. Null until every
   * question has one valid option index. */
  function tally(answers: unknown): PersonaTally<Id>[] | null {
    if (!Array.isArray(answers) || answers.length !== questionCount) return null;
    const totals = new Map<Id, { score: number; direct: number; firstDirect: number }>();
    for (const id of ids) {
      totals.set(id, { score: 0, direct: 0, firstDirect: Number.POSITIVE_INFINITY });
    }
    for (let index = 0; index < questionCount; index += 1) {
      const choice = answers[index];
      const question = config.questions[index];
      if (typeof choice !== "number" || !Number.isInteger(choice) || choice < 0 || choice >= question.options.length) {
        return null;
      }
      const option = question.options[choice];
      const primary = totals.get(option.primary)!;
      primary.score += 2;
      primary.direct += 1;
      primary.firstDirect = Math.min(primary.firstDirect, index);
      totals.get(option.secondary)!.score += 1;
    }
    return ids
      .map((id) => ({ id, ...totals.get(id)! }))
      .sort(compareTallies);
  }

  /** The deterministic result for one complete run, or null while it is
   * incomplete or malformed. */
  function resolve(answers: unknown): Id | null {
    return tally(answers)?.[0]?.id ?? null;
  }

  /** A shared result names exactly one known outcome and never carries an answer.
   * Only the `result` parameter is read, so unrelated share parameters cannot
   * invent an answer; a repeated value is ambiguous, and a missing or unknown
   * value falls back to a fresh quiz. */
  function outcomeFromHash(hash: string): Id | null {
    if (!hash.startsWith("#")) return null;
    const params = new URLSearchParams(hash.slice(1));
    const value = params.get("result");
    return params.size === 1 && value && Object.hasOwn(config.outcomes, value)
      ? value as Id : null;
  }

  /** The one answer-free result address: the canonical public quiz route plus a
   * trusted outcome ID. */
  function resultPath(id: Id): string {
    return `${config.path}#result=${id}`;
  }

  return { path: config.path, outcomes: config.outcomes, ids, questions: config.questions, questionCount, tally, resolve, outcomeFromHash, resultPath };
}

/** The printable half of one persona outcome. It is assembled from the same
 * trusted outcome definition the result panel reads, so an authored run and a
 * recipient’s `#result=` link produce the same card. */
export interface PersonaCardPrint {
  readonly archetype: string;
  readonly subject: string;
  readonly tendency: string;
  readonly reason: string;
}

/** Trusted public result text and a direct link to take the original quiz. */
export function personaCaption(outcome: Pick<PersonaCardPrint, "archetype" | "subject">, href: string): string {
  return `${outcome.archetype} — ${outcome.subject}\n${href}`;
}

/** A short plain description of the text one prepared card actually prints:
 * the trusted result headline, subject and takeaway, followed by the cleaned
 * byline and a neutral portrait note only when a local photo was drawn. Only
 * printable copy enters it, so no answer, private remix, address, file name or
 * photo content can reach the clipboard or an image's alt text. It stays free
 * of DOM access so a focused test can check the string deterministically. */
export function personaCardAltText(
  copy: PersonaCardPrint,
  byline: string,
  hasPortrait: boolean,
): string {
  const sentence = (value: string) => /[.!?…]$/.test(value) ? value : `${value}.`;
  const archetype = cleanText(copy.archetype, 72);
  const subject = cleanText(copy.subject, 72);
  const tendency = cleanText(copy.tendency, 240);
  const by = cleanText(byline, 48);
  if (!archetype || !subject || !tendency) return "";
  return [
    sentence(archetype),
    sentence(subject),
    sentence(tendency),
    ...(by ? [sentence(`By ${by}`)] : []),
    ...(hasPortrait ? ["A small portrait photo appears on the card."] : []),
  ].join(" ");
}

/** The runtime view one quiz page needs. It keeps pack-specific wording in the
 * pack and shared stage mechanics in the controller. */
export interface PersonaPackOutcome extends PersonaCardPrint {
  readonly href: string;
  readonly docsText: string;
  readonly docsAria: string;
}

/** One built-in outcome a choice scores toward. The ID and label are read
 * from the pack’s trusted outcome definitions; the draft editor shows them
 * but never writes them. */
export interface PersonaPackOutcomeRef {
  readonly id: string;
  readonly label: string;
}

export interface PersonaPackOption {
  readonly label: string;
  readonly primary: PersonaPackOutcomeRef;
  readonly secondary: PersonaPackOutcomeRef;
}

export interface PersonaPackQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly PersonaPackOption[];
}

export interface PersonaPack {
  readonly game: ExperienceId;
  readonly path: string;
  readonly stageLabel: string;
  readonly questionCount: number;
  /** Every trusted outcome ID in the pack's fixed result order. */
  readonly ids: readonly string[];
  /** Every trusted outcome ID with the original printed name. A draft may
   * retext the name; the ID and this record stay the published quiz's. */
  readonly outcomes: readonly PersonaPackOutcomeRef[];
  readonly questions: readonly PersonaPackQuestion[];
  readonly firstQuestion: {
    readonly prompt: string;
    readonly options: readonly string[];
  };
  readonly cardLabel: string;
  readonly cardCredit: string;
  readonly skinLabels: readonly [string, string, string];
  readonly resultNotice: string;
  readonly shareNote: string;
  readonly disclaimer: string;
  outcomeFromHash(hash: string): string | null;
  resultPath(id: string): string;
  outcome(id: string): PersonaPackOutcome | null;
  card(id: string): PersonaCardPrint | null;
  resolve(answers: unknown): string | null;
}

export interface PersonaPackConfig<Id extends string, Outcome extends PersonaOutcome> {
  readonly game: ExperienceId;
  readonly stageLabel: string;
  readonly quiz: PersonaQuiz<Id, Outcome>;
  readonly subject: (outcome: Outcome) => string;
  readonly docsText: (outcome: Outcome) => string;
  readonly docsAria: (outcome: Outcome) => string;
  readonly cardLabel: string;
  readonly cardCredit: string;
  readonly skinLabels: readonly [string, string, string];
  readonly resultNotice: string;
  readonly shareNote: string;
  readonly disclaimer: string;
}

export function createPersonaPack<Id extends string, Outcome extends PersonaOutcome>(
  config: PersonaPackConfig<Id, Outcome>,
): PersonaPack {
  const find = (id: string): Outcome | null =>
    Object.hasOwn(config.quiz.outcomes, id) ? config.quiz.outcomes[id as Id] : null;
  const firstQuestion = config.quiz.questions[0];
  const ids = [...config.quiz.ids];

  return {
    game: config.game,
    path: config.quiz.path,
    stageLabel: config.stageLabel,
    questionCount: config.quiz.questionCount,
    ids,
    outcomes: ids.map((id) => ({ id, label: config.quiz.outcomes[id].archetype })),
    questions: config.quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => {
        const primary = config.quiz.outcomes[option.primary];
        const secondary = config.quiz.outcomes[option.secondary];
        return {
          label: option.label,
          primary: { id: option.primary, label: config.subject(primary) },
          secondary: { id: option.secondary, label: config.subject(secondary) },
        };
      }),
    })),
    firstQuestion: {
      prompt: firstQuestion.prompt,
      options: firstQuestion.options.map((option) => option.label),
    },
    cardLabel: config.cardLabel,
    cardCredit: config.cardCredit,
    skinLabels: config.skinLabels,
    resultNotice: config.resultNotice,
    shareNote: config.shareNote,
    disclaimer: config.disclaimer,
    outcomeFromHash: (hash) => config.quiz.outcomeFromHash(hash),
    resultPath: (id) => config.quiz.resultPath(id as Id),
    resolve: (answers) => config.quiz.resolve(answers),
    outcome: (id) => {
      const outcome = find(id);
      return outcome ? {
        archetype: outcome.archetype,
        subject: config.subject(outcome),
        tendency: outcome.tendency,
        reason: outcome.reason,
        href: outcome.href,
        docsText: config.docsText(outcome),
        docsAria: config.docsAria(outcome),
      } : null;
    },
    card: (id) => {
      const outcome = find(id);
      return outcome ? {
        archetype: outcome.archetype,
        subject: config.subject(outcome),
        tendency: outcome.tendency,
        reason: outcome.reason,
      } : null;
    },
  };
}

/** A local remix of one starter. It retexts the visible title, question
 * prompts and four choice labels while keeping each choice in its starter
 * position, so the pack's primary/secondary mappings, deterministic scoring,
 * tie-break and trusted outcomes stay exactly those of the published quiz.
 * One optional authored name may replace a result's printed subject on this
 * private draft only. The draft is never scored, addressed, stored or exported
 * on its own: the stage keeps calling the pack's resolve() with the same option
 * indexes, and the original outcome stays the source of its link and docs. */
export const personaDraftTitleLimit = 60;
export const personaDraftPromptLimit = 100;
export const personaDraftOptionLimit = 60;
/** One optional draft result name, keyed by a trusted pack outcome ID. The
 * bound matches the other short visible-text fields. */
export const personaDraftOutcomeLimit = 60;

export interface PersonaDraftQuestion {
  readonly prompt: string;
  /** Exactly the starter's four choice positions, retexted. */
  readonly options: readonly [string, string, string, string];
}

export interface PersonaDraft {
  readonly title: string;
  /** Only the names the creator typed, keyed by the pack's stable outcome IDs.
   * Absent when every field is blank and the original names are inherited. */
  readonly outcomes?: Readonly<Record<string, string>>;
  readonly questions: readonly PersonaDraftQuestion[];
}

/** The outcome fields as typed in the editor, or as read from a V2 file. */
export type PersonaDraftOutcomeInput =
  | Readonly<Record<string, unknown>>
  | readonly { readonly id: string; readonly label: unknown }[];

/** The first field that stops a draft from playing, with the exact question or
 * choice to fix. The title and prompt variants carry no option index. */
export type PersonaDraftGap =
  | { readonly field: "title"; readonly reason: "empty" }
  | { readonly field: "prompt"; readonly question: number; readonly reason: "empty" }
  | {
    readonly field: "option";
    readonly question: number;
    readonly option: number;
    readonly reason: "empty" | "duplicate";
  };

export interface PersonaDraftRead {
  /** The bounded, readable draft, or null while any field needs attention. */
  readonly draft: PersonaDraft | null;
  /** The first field to fix, or null when the draft is playable. */
  readonly gap: PersonaDraftGap | null;
}

/** Composer's original text-only draft file. It has a fixed, answer-free
 * shape: a versioned schema, the exact pack it belongs to, and the visible
 * title, prompts and choice labels. Answers, outcomes, identity and links have
 * no field, so a V1 file cannot carry them. */
export const personaDraftFileSchema = "composer.persona-quiz-draft/1";
/** The compatible V2 shape. It is written only when at least one authored
 * result name is present, so a text-only draft keeps the exact V1 bytes. The
 * `outcomes` object is keyed only by a trusted pack outcome ID and holds one
 * bounded printed name per ID; every other field keeps its V1 meaning. */
export const personaDraftNamedFileSchema = "composer.persona-quiz-draft/2";
/** Bytes, not characters. The same bound covers the text this page writes and
 * a file it opens, and it is measured before the browser parses anything. */
export const personaDraftFileLimit = 16_384;

/** The first reason a file cannot fill the editor, or null when it can. */
export type PersonaDraftFileFault =
  | "oversized"
  | "unreadable"
  | "schema"
  | "version"
  | "pack"
  | "outcome"
  | "shape"
  | "text";

export interface PersonaDraftFileRead {
  /** The validated, bounded draft to put in the editor, or null on any fault. */
  readonly draft: PersonaDraft | null;
  /** The first unusable visible field when the file's text is the problem. */
  readonly gap: PersonaDraftGap | null;
  readonly fault: PersonaDraftFileFault | null;
}

/** A short pack-specific download name. The game is one of the reviewed pack
 * IDs, never creator text. */
export function personaDraftFileName(game: string): string {
  return `composer-${game}-draft.json`;
}

/** The exact portable UTF-8 text for one already-validated draft. Field order
 * and indentation are fixed, so the same draft always produces the same bytes.
 * A draft without authored outcome names keeps the established V1 shape and
 * bytes; one with names uses the checked V2 shape. */
export function writePersonaDraftFile(game: string, draft: PersonaDraft): string {
  const outcomes = Object.entries(draft.outcomes ?? {})
    .filter(([, label]) => typeof label === "string" && label.length > 0);
  const value: Record<string, unknown> = {
    schema: outcomes.length ? personaDraftNamedFileSchema : personaDraftFileSchema,
    game,
    title: draft.title,
  };
  if (outcomes.length) value.outcomes = Object.fromEntries(outcomes);
  value.questions = draft.questions.map((question) => ({
    prompt: question.prompt,
    options: [...question.options],
  }));
  return `${JSON.stringify(value, null, 2)}\n`;
}

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};

/** Reads one portable draft file against this exact pack and question count.
 * V1 and V2 are both accepted. The byte bound is checked before JSON.parse, the
 * schema before any content, and the visible text passes through the same
 * readPersonaDraft() a typed draft uses. A V2 file may add only names for this
 * pack's registered outcome IDs; an unknown ID is rejected before the editor is
 * touched. Every fault leaves the caller's editor untouched. */
export function readPersonaDraftFile(
  game: string,
  raw: unknown,
  questionCount: number,
  outcomeIds: readonly string[] = [],
): PersonaDraftFileRead {
  const reject = (fault: PersonaDraftFileFault, gap: PersonaDraftGap | null = null): PersonaDraftFileRead =>
    ({ draft: null, gap, fault });
  if (typeof raw !== "string") return reject("unreadable");
  if (new TextEncoder().encode(raw).length > personaDraftFileLimit) return reject("oversized");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return reject("unreadable");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return reject("unreadable");
  const file = value as Record<string, unknown>;
  if (typeof file.schema !== "string") return reject("schema");
  const named = file.schema === personaDraftNamedFileSchema;
  if (file.schema !== personaDraftFileSchema && !named) {
    return reject(/^composer\.persona-quiz-draft\/\d+$/.test(file.schema) ? "version" : "schema");
  }
  const keys = named
    ? ["schema", "game", "title", "outcomes", "questions"]
    : ["schema", "game", "title", "questions"];
  if (!exactKeys(file, keys)) return reject("shape");
  if (typeof file.game !== "string") return reject("shape");
  if (file.game !== game) return reject("pack");
  const count = Number.isInteger(questionCount) && questionCount > 0 ? questionCount : 0;
  if (typeof file.title !== "string" || !Array.isArray(file.questions) || file.questions.length !== count) {
    return reject("shape");
  }
  let outcomeInput: readonly { id: string; label: unknown }[] = [];
  if (named) {
    const outcomes = file.outcomes;
    if (!outcomes || typeof outcomes !== "object" || Array.isArray(outcomes)) return reject("shape");
    const trusted = new Set(outcomeIds);
    const entries = Object.entries(outcomes as Record<string, unknown>);
    if (entries.length > trusted.size) return reject("outcome");
    for (const [id, label] of entries) {
      if (!trusted.has(id)) return reject("outcome");
      if (typeof label !== "string") return reject("shape");
    }
    outcomeInput = entries.map(([id, label]) => ({ id, label }));
  }
  const rows: unknown[][] = [];
  for (const entry of file.questions) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return reject("shape");
    const question = entry as Record<string, unknown>;
    if (!exactKeys(question, ["prompt", "options"])) return reject("shape");
    if (typeof question.prompt !== "string"
      || !Array.isArray(question.options)
      || question.options.length !== 4
      || question.options.some((option) => typeof option !== "string")) {
      return reject("shape");
    }
    rows.push([question.prompt, ...question.options]);
  }
  const read = readPersonaDraft(file.title, rows, count, outcomeInput);
  if (!read.draft) return reject("text", read.gap);
  return { draft: read.draft, gap: null, fault: null };
}

/** Normalise the outcome-name fields without changing their trusted IDs. A
 * blank name is dropped, so the result inherits the published outcome name. */
function readOutcomeNames(input: PersonaDraftOutcomeInput | undefined): Record<string, string> | undefined {
  if (!input) return undefined;
  const entries: [string, string][] = [];
  const source = Array.isArray(input)
    ? input.map((entry) => [String(entry?.id ?? ""), entry?.label] as const)
    : Object.entries(input as Record<string, unknown>);
  for (const [id, value] of source) {
    if (!id) continue;
    const label = cleanText(value, personaDraftOutcomeLimit);
    if (label) entries.push([id, label]);
  }
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Reads one local draft from raw editor values without touching the starter's
 * mapping data. Every value passes through the shared visible-text
 * normalisation, so what plays is a trimmed, single-spaced copy of what the
 * creator sees. A row plays only with a prompt and four non-empty, distinct
 * labels; rows beyond the pack's question count are never read. Optional
 * outcome names are cleaned to the same standard and keyed by the trusted IDs
 * the caller supplies; a blank name is omitted so the original is inherited. */
export function readPersonaDraft(
  titleValue: unknown,
  rows: readonly (readonly unknown[])[],
  questionCount: number,
  outcomeInput?: PersonaDraftOutcomeInput,
): PersonaDraftRead {
  const title = cleanText(titleValue, personaDraftTitleLimit);
  if (!title) return { draft: null, gap: { field: "title", reason: "empty" } };
  const count = Number.isInteger(questionCount) && questionCount > 0 ? questionCount : 0;
  const source = Array.isArray(rows) ? rows : [];
  if (source.length < count) {
    return { draft: null, gap: { field: "prompt", question: source.length, reason: "empty" } };
  }
  const questions: PersonaDraftQuestion[] = [];
  for (let question = 0; question < count; question += 1) {
    const row = source[question] ?? [];
    const prompt = cleanText(row[0], personaDraftPromptLimit);
    if (!prompt) {
      return { draft: null, gap: { field: "prompt", question, reason: "empty" } };
    }
    const labels: string[] = [];
    for (let option = 0; option < 4; option += 1) {
      const label = cleanText(row[option + 1], personaDraftOptionLimit);
      if (!label) {
        return { draft: null, gap: { field: "option", question, option, reason: "empty" } };
      }
      if (labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
        return { draft: null, gap: { field: "option", question, option, reason: "duplicate" } };
      }
      labels.push(label);
    }
    questions.push({ prompt, options: [labels[0], labels[1], labels[2], labels[3]] });
  }
  const outcomes = readOutcomeNames(outcomeInput);
  return {
    draft: outcomes ? { title, outcomes, questions } : { title, questions },
    gap: null,
  };
}

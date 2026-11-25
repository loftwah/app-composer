import { cleanText } from "./share-experience-draft.ts";
import { experiencePath } from "./share-experiences.ts";

/** One browser-local #1074 Hot Take Factory sheet. The only shareable URL is
 * an answer-free challenge to an authored prompt; opinions stay in this tab
 * until the participant deliberately downloads a PNG. */
export const hotTakePrintTitle = "Hot take factory";
export const hotTakeLimit = 280;
export const hotTakePromptLimit = 100;

export interface HotTakePrompt {
  readonly tab: string;
  readonly prompt: string;
}

export const hotTakePrompts = [
  { tab: "Meetings", prompt: "Some meetings should be README files." },
  { tab: "README", prompt: "A clear README beats a clever demo." },
  { tab: "Shipping", prompt: "If you did not check production, you did not finish." },
  { tab: "Tabs", prompt: "Forty-seven tabs can be a filing system." },
  { tab: "Agents", prompt: "An agent should show its work." },
  { tab: "Stack", prompt: "The best framework is the one you can maintain." },
  { tab: "Proof", prompt: "A screenshot is not a test." },
  { tab: "Backups", prompt: "A backup you never restored is a hope." },
  { tab: "Alerts", prompt: "Most notifications can wait." },
  { tab: "Infra", prompt: "You probably do not need another service." },
] as const satisfies readonly HotTakePrompt[];

export const hotTakeCount = hotTakePrompts.length;
export const hotTakeStart = (): string[] => Array.from({ length: hotTakeCount }, () => "");

export function hotTakePrompt(index: unknown): HotTakePrompt | null {
  return Number.isInteger(index) && Number(index) >= 0 && Number(index) < hotTakeCount
    ? hotTakePrompts[Number(index)]
    : null;
}

export const hotTakeBlankPath = experiencePath("hot-take-factory");

/** A challenge carries only the authored prompt's ordinal, never an opinion. */
export function hotTakeInvitePath(index: unknown): string {
  if (!hotTakePrompt(index)) return hotTakeBlankPath;
  const ordinal = Number(index) + 1;
  return ordinal === 1 ? hotTakeBlankPath : `${hotTakeBlankPath}?prompt=${ordinal}`;
}

/** Server and browser share this strict validator. Unknown, duplicate, mixed or
 * extra-key queries always open the first prompt with a blank sheet. */
export function hotTakeFromQuery(search: string): number {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const match = /^prompt=([1-9]|10)$/.exec(raw);
  if (!match) return 0;
  const index = Number(match[1]) - 1;
  return hotTakePrompt(index) ? index : 0;
}

export interface HotTakeCard {
  readonly number: number;
  readonly tab: string;
  readonly prompt: string;
  readonly answer: string;
}

/** Exactly what the stage and PNG print. A blank opinion or a prompt outside
 * the authored set produces no card, so forged state cannot print a take. */
export function hotTakeCard(index: unknown, answer: unknown): HotTakeCard | null {
  const entry = hotTakePrompt(index);
  const text = cleanText(answer, hotTakeLimit);
  if (!entry || !text) return null;
  return {
    number: Number(index) + 1,
    tab: entry.tab,
    prompt: cleanText(entry.prompt, hotTakePromptLimit),
    answer: text,
  };
}

export function hotTakeAltText(input: {
  byline?: string;
  hotTakePrompt?: unknown;
  answer?: string;
}): string {
  const card = hotTakeCard(input.hotTakePrompt, input.answer);
  if (!card) return "";
  const byline = cleanText(input.byline, 48);
  const sentence = (value: string) => /[.!?…]$/.test(value) ? value : `${value}.`;
  return [
    sentence(hotTakePrintTitle),
    ...(byline ? [sentence(`By ${byline}`)] : []),
    sentence(card.prompt),
    sentence(`Your take reads ${card.answer}`),
  ].join(" ");
}

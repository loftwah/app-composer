// One creator draft per Share experience, saved explicitly on this device.
// Keys and payloads are versioned and bounded so an old, foreign or oversized
// value is ignored instead of replacing what the creator is editing.

import { normaliseSourceLinks } from "./top-nine-source.ts";
import { normalisePageLinks } from "./top-nine-pages.ts";
import { profileUrl } from "./top-nine-profile.ts";

export const draftVersion = 1;
/** Room for nine exhibits with both a provider source link and an exact public
 * web page, while still rejecting a runaway stored value. */
export const draftLimit = 8_000;
/** One short optional line under a Top Nine title. */
export const nineSubtitleLimit = 70;
/** One exhibit title, the same visible-text bound as the nine editor inputs. */
export const nineItemLimit = 54;

export const draftKey = (experience: string) => `composer.share-experience.${experience}.draft`;

/** The portable file's own boundary, distinct from the stored `version`: a file
 * can never be mistaken for this browser's value, and a future file shape is
 * refused by name instead of being read as today's. */
export const draftFileSchema = "composer.top-nine-draft/1";
/** Bytes, not characters. The file carries one board, so it shares the stored
 * draft's established bound and is measured before the browser parses it. */
export const draftFileLimit = draftLimit;
/** One short download name. The experience is fixed, never creator text. */
export const draftFileName = "composer-top-nine-draft.json";

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface NineDraft {
  title: string;
  items: string[];
  /** Optional visible line under the title, omitted when the person clears it
   * so older drafts and drafts without one keep their exact stored shape. */
  subtitle?: string;
  byline?: string;
  /** One optional public HTTPS profile link, omitted when absent or invalid
   * so older drafts keep their exact stored shape. */
  profile?: string;
  skin?: number;
  /** Explicit ranked ordering. Absent keeps unordered favourites, so older
   * drafts and drafts saved without the opt-in read back unchanged. */
  ranked?: boolean;
  /** One optional canonical source link per exhibit, omitted when there are none. */
  hrefs?: (string | null)[];
  /** One optional exact public web page per manually named exhibit, omitted
   * when there are none so older drafts keep their exact stored shape. */
  pages?: (string | null)[];
}

/** The same visible-text normalisation the exhibition editor and result use. */
export const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

/** One board as typed, before any bound or link validation. The stored value
 * and the portable file both pass through the same cleaning below, so they can
 * only ever restore the same board. */
interface NineDraftInput {
  title?: unknown;
  items?: unknown;
  subtitle?: unknown;
  byline?: unknown;
  profile?: unknown;
  skin?: unknown;
  ranked?: unknown;
  hrefs?: unknown;
  pages?: unknown;
}

/** The exact cleaned fields both the stored draft and the file carry. */
interface NineDraftFields {
  title: string;
  items: string[];
  subtitle?: string;
  byline: string;
  profile?: string;
  skin: number;
  ranked?: true;
  hrefs?: (string | null)[];
  pages?: (string | null)[];
}

function cleanHrefs(value: unknown): (string | null)[] | undefined {
  const hrefs = normaliseSourceLinks(value);
  return hrefs.some(Boolean) ? hrefs : undefined;
}

/** A page only belongs to an exhibit that still has a typed title. */
function cleanPages(value: unknown, items: readonly string[]): (string | null)[] | undefined {
  const pages = normalisePageLinks(value).map((href, index) => (items[index] ? href : null));
  return pages.some(Boolean) ? pages : undefined;
}

/** One cleaned board, or null when there is nothing worth saving. Field order
 * and omitted optionals are fixed here so older drafts keep their exact shape. */
function cleanNineDraft(draft: NineDraftInput): NineDraftFields | null {
  const title = cleanText(draft.title, 72);
  const items = Array.isArray(draft.items)
    ? draft.items.map((item) => cleanText(item, nineItemLimit))
    : [];
  if (!title && !items.some(Boolean)) return null;
  const subtitle = cleanText(draft.subtitle, nineSubtitleLimit);
  const hrefs = cleanHrefs(draft.hrefs);
  const pages = cleanPages(draft.pages, items);
  const profile = profileUrl(draft.profile) ?? "";
  return {
    title, items,
    ...(subtitle ? { subtitle } : {}),
    byline: cleanText(draft.byline, 48),
    ...(profile ? { profile } : {}),
    skin: draft.skin === 1 || draft.skin === 2 ? draft.skin : 0,
    ...(draft.ranked === true ? { ranked: true } : {}),
    ...(hrefs ? { hrefs } : {}),
    ...(pages ? { pages } : {}),
  };
}

/** One stored-or-file value read as a board: nine positional slots are the
 * shape every restore, preview and export expects. */
function readNineDraftValue(value: NineDraftInput): NineDraft | null {
  if (!Array.isArray(value.items) || value.items.length !== 9) return null;
  return cleanNineDraft(value);
}

export function readNineDraft(storage: DraftStorage): NineDraft | null {
  try {
    const raw = storage.getItem(draftKey("top-nine"));
    if (!raw || raw.length > draftLimit) return null;
    const saved = JSON.parse(raw) as Record<string, unknown> | null;
    if (!saved || saved.version !== draftVersion) return null;
    return readNineDraftValue(saved);
  } catch {
    return null;
  }
}

export function writeNineDraft(storage: DraftStorage, draft: NineDraft): "saved" | "empty" | "too-large" | "blocked" {
  const fields = cleanNineDraft(draft);
  if (!fields) return "empty";
  const value = JSON.stringify({ version: draftVersion, ...fields });
  if (value.length > draftLimit) return "too-large";
  try {
    storage.setItem(draftKey("top-nine"), value);
    return "saved";
  } catch {
    return "blocked";
  }
}

/** The first reason a portable file cannot open, or null when it can. */
export type DraftFileFault = "oversized" | "unreadable" | "schema" | "version" | "shape" | "empty";

export interface NineDraftFileRead {
  /** The validated board to restore, or null on any fault so the caller keeps
   * the board it is already editing. */
  draft: NineDraft | null;
  fault: DraftFileFault | null;
}

/** Every key a file may carry. Anything else is foreign and refused. */
const draftFileKeys = [
  "schema", "title", "items", "subtitle", "byline", "profile", "skin", "ranked", "hrefs", "pages",
] as const;

/** The portable shape checked before any value is cleaned: nine string slots,
 * and only the optional fields a board actually has. */
function draftFileShape(value: Record<string, unknown>): boolean {
  if (!Object.keys(value).every((key) => (draftFileKeys as readonly string[]).includes(key))) return false;
  if (typeof value.title !== "string") return false;
  if (!Array.isArray(value.items) || value.items.length !== 9) return false;
  if (value.items.some((item) => typeof item !== "string")) return false;
  if (value.subtitle !== undefined && typeof value.subtitle !== "string") return false;
  if (value.byline !== undefined && typeof value.byline !== "string") return false;
  if (value.profile !== undefined && typeof value.profile !== "string") return false;
  if (value.skin !== undefined && value.skin !== 0 && value.skin !== 1 && value.skin !== 2) return false;
  if (value.ranked !== undefined && typeof value.ranked !== "boolean") return false;
  for (const key of ["hrefs", "pages"] as const) {
    const links = value[key];
    if (links === undefined) continue;
    if (!Array.isArray(links) || links.length > 9) return false;
    if (links.some((link) => link !== null && typeof link !== "string")) return false;
  }
  return true;
}

/** The exact portable UTF-8 text for one board, or null when there is nothing
 * to write. Field order is fixed and the bytes are compact, so the same board
 * always produces the same file. Links, profile and pages pass through the same
 * validators a saved draft uses; covers have no field and never travel here. */
export function writeNineDraftFile(draft: NineDraft): string | null {
  const fields = cleanNineDraft(draft);
  if (!fields) return null;
  return JSON.stringify({ schema: draftFileSchema, ...fields });
}

/** Reads one portable draft file. The byte bound is checked before JSON.parse,
 * the schema before any content, and the whole board then goes through the same
 * cleaning a stored draft gets. Any fault leaves the caller's board untouched. */
export function readNineDraftFile(raw: unknown): NineDraftFileRead {
  const reject = (fault: DraftFileFault): NineDraftFileRead => ({ draft: null, fault });
  if (typeof raw !== "string") return reject("unreadable");
  if (new TextEncoder().encode(raw).length > draftFileLimit) return reject("oversized");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return reject("unreadable");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return reject("unreadable");
  const file = value as Record<string, unknown>;
  if (typeof file.schema !== "string") return reject("schema");
  if (file.schema !== draftFileSchema) {
    return reject(/^composer\.top-nine-draft\/\d+$/.test(file.schema) ? "version" : "schema");
  }
  if (!draftFileShape(file)) return reject("shape");
  const draft = readNineDraftValue(file);
  return draft ? { draft, fault: null } : reject("empty");
}

export function clearNineDraft(storage: DraftStorage): boolean {
  try {
    storage.removeItem(draftKey("top-nine"));
    return true;
  } catch {
    return false;
  }
}

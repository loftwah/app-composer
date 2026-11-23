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

function cleanHrefs(value: unknown): (string | null)[] | undefined {
  const hrefs = normaliseSourceLinks(value);
  return hrefs.some(Boolean) ? hrefs : undefined;
}

/** A page only belongs to an exhibit that still has a typed title. */
function cleanPages(value: unknown, items: readonly string[]): (string | null)[] | undefined {
  const pages = normalisePageLinks(value).map((href, index) => (items[index] ? href : null));
  return pages.some(Boolean) ? pages : undefined;
}

export function readNineDraft(storage: DraftStorage): NineDraft | null {
  try {
    const raw = storage.getItem(draftKey("top-nine"));
    if (!raw || raw.length > draftLimit) return null;
    const saved = JSON.parse(raw) as Record<string, unknown> | null;
    if (!saved || saved.version !== draftVersion || !Array.isArray(saved.items) || saved.items.length !== 9) return null;
    const title = cleanText(saved.title, 72);
    const items = saved.items.map((item) => cleanText(item, nineItemLimit));
    if (!title && !items.some(Boolean)) return null;
    const subtitle = cleanText(saved.subtitle, nineSubtitleLimit);
    const hrefs = cleanHrefs(saved.hrefs);
    const pages = cleanPages(saved.pages, items);
    const profile = profileUrl(saved.profile) ?? "";
    return {
      title, items,
      ...(subtitle ? { subtitle } : {}),
      byline: cleanText(saved.byline, 48),
      ...(profile ? { profile } : {}),
      skin: saved.skin === 1 || saved.skin === 2 ? saved.skin : 0,
      ...(saved.ranked === true ? { ranked: true } : {}),
      ...(hrefs ? { hrefs } : {}),
      ...(pages ? { pages } : {}),
    };
  } catch {
    return null;
  }
}

export function writeNineDraft(storage: DraftStorage, draft: NineDraft): "saved" | "empty" | "too-large" | "blocked" {
  const title = cleanText(draft.title, 72);
  const items = draft.items.map((item) => cleanText(item, nineItemLimit));
  if (!title && !items.some(Boolean)) return "empty";
  const subtitle = cleanText(draft.subtitle, nineSubtitleLimit);
  const hrefs = cleanHrefs(draft.hrefs);
  const pages = cleanPages(draft.pages, items);
  const profile = profileUrl(draft.profile) ?? "";
  const value = JSON.stringify({
    version: draftVersion,
    title, items,
    ...(subtitle ? { subtitle } : {}),
    byline: cleanText(draft.byline, 48),
    ...(profile ? { profile } : {}),
    skin: draft.skin === 1 || draft.skin === 2 ? draft.skin : 0,
    ...(draft.ranked === true ? { ranked: true } : {}),
    ...(hrefs ? { hrefs } : {}),
    ...(pages ? { pages } : {}),
  });
  if (value.length > draftLimit) return "too-large";
  try {
    storage.setItem(draftKey("top-nine"), value);
    return "saved";
  } catch {
    return "blocked";
  }
}

export function clearNineDraft(storage: DraftStorage): boolean {
  try {
    storage.removeItem(draftKey("top-nine"));
    return true;
  } catch {
    return false;
  }
}

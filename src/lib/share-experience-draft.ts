// One creator draft per Share experience, saved explicitly on this device.
// Keys and payloads are versioned and bounded so an old, foreign or oversized
// value is ignored instead of replacing what the creator is editing.

import { normaliseMusicPicks } from "./top-nine-music.ts";

export const draftVersion = 1;
export const draftLimit = 4_000;

export const draftKey = (experience: string) => `composer.share-experience.${experience}.draft`;

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface NineDraft {
  title: string;
  items: string[];
  byline?: string;
  skin?: number;
  /** One optional canonical music link per exhibit, omitted when there are none. */
  hrefs?: (string | null)[];
}

/** The same visible-text normalisation the exhibition editor and result use. */
export const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

function cleanHrefs(value: unknown): (string | null)[] | undefined {
  const hrefs = normaliseMusicPicks(value);
  return hrefs.some(Boolean) ? hrefs : undefined;
}

export function readNineDraft(storage: DraftStorage): NineDraft | null {
  try {
    const raw = storage.getItem(draftKey("top-nine"));
    if (!raw || raw.length > draftLimit) return null;
    const saved = JSON.parse(raw) as Record<string, unknown> | null;
    if (!saved || saved.version !== draftVersion || !Array.isArray(saved.items) || saved.items.length !== 9) return null;
    const title = cleanText(saved.title, 72);
    const items = saved.items.map((item) => cleanText(item, 54));
    if (!title && !items.some(Boolean)) return null;
    const hrefs = cleanHrefs(saved.hrefs);
    return {
      title, items,
      byline: cleanText(saved.byline, 48),
      skin: saved.skin === 1 || saved.skin === 2 ? saved.skin : 0,
      ...(hrefs ? { hrefs } : {}),
    };
  } catch {
    return null;
  }
}

export function writeNineDraft(storage: DraftStorage, draft: NineDraft): "saved" | "empty" | "too-large" | "blocked" {
  const title = cleanText(draft.title, 72);
  const items = draft.items.map((item) => cleanText(item, 54));
  if (!title && !items.some(Boolean)) return "empty";
  const hrefs = cleanHrefs(draft.hrefs);
  const value = JSON.stringify({
    version: draftVersion,
    title, items,
    byline: cleanText(draft.byline, 48),
    skin: draft.skin === 1 || draft.skin === 2 ? draft.skin : 0,
    ...(hrefs ? { hrefs } : {}),
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

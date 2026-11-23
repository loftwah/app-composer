// One typed source link per Top Nine exhibit. Apple Music and Spotify links
// also play in the official embed; Apple Books, App Store and Wikidata links
// are source links only — they never claim playback, a reading preview or
// provider media.

import { appSource } from "./top-nine-apps.ts";
import { bookSource } from "./top-nine-books.ts";
import { musicPreview } from "./top-nine-music.ts";
import { wikidataSource } from "./top-nine-wikidata.ts";

export type SourceProvider = "Apple Music" | "Spotify" | "Apple Books" | "App Store" | "Wikidata";
/** What the Find titles panel searches: the two music kinds, or books, apps, films, TV series or games. */
export type SourceKind = "album" | "song" | "book" | "app" | "film" | "series" | "game";

export function sourceLink(value: unknown): { href: string; provider: SourceProvider } | null {
  const music = musicPreview(value);
  if (music) return music;
  const wiki = wikidataSource(value);
  if (wiki) return { href: wiki, provider: "Wikidata" };
  const app = appSource(value);
  if (app) return { href: app, provider: "App Store" };
  const href = bookSource(value);
  return href ? { href, provider: "Apple Books" } : null;
}

/** Canonical source links for nine exhibits; every slot stays positional. */
export function normaliseSourceLinks(value: unknown): (string | null)[] {
  return Array.from({ length: 9 }, (_, index) =>
    Array.isArray(value) ? sourceLink(value[index])?.href ?? null : null,
  );
}

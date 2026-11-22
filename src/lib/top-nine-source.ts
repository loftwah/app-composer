// One typed source link per Top Nine exhibit. Apple Music and Spotify links
// also play in the official embed; Apple Books links are source links only —
// they never claim playback or a reading preview.

import { bookSource } from "./top-nine-books.ts";
import { musicPreview } from "./top-nine-music.ts";

export type SourceProvider = "Apple Music" | "Spotify" | "Apple Books";
/** What the Find titles panel searches: the two music kinds, or books. */
export type SourceKind = "album" | "song" | "book";

export function sourceLink(value: unknown): { href: string; provider: SourceProvider } | null {
  const music = musicPreview(value);
  if (music) return music;
  const href = bookSource(value);
  return href ? { href, provider: "Apple Books" } : null;
}

/** Canonical source links for nine exhibits; every slot stays positional. */
export function normaliseSourceLinks(value: unknown): (string | null)[] {
  return Array.from({ length: 9 }, (_, index) =>
    Array.isArray(value) ? sourceLink(value[index])?.href ?? null : null,
  );
}

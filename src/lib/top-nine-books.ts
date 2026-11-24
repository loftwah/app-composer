import {
  catalogueText, catalogueYear, lookupCatalogue, searchCatalogue,
  type CataloguePick,
} from "./itunes-catalogue.ts";

const appleBookPath = /^\/([a-z]{2})\/book\/([^/]+(?:\/[^/]+)*)\/id([1-9]\d{0,11})\/?$/;

/** Rebuild an exact Apple Books source link, dropping query trackers. */
export function bookSource(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  if (url.hostname !== "books.apple.com") return null;
  const match = appleBookPath.exec(url.pathname);
  if (!match) return null;
  const [, country, slug, id] = match;
  return `https://books.apple.com/${country}/book/${slug}/id${id}`;
}

/**
 * The storefront and ebook ID carried by one canonical Apple Books link.
 * `bookSource` has already dropped query trackers, so only that exact book ID
 * and its own storefront can seed a lookup; a search URL, a different kind of
 * book page or another provider's link never does.
 */
export function appleBookRef(value: unknown): { country: string; id: string } | null {
  const canonical = bookSource(value);
  if (!canonical) return null;
  const match = appleBookPath.exec(new URL(canonical).pathname);
  if (!match) return null;
  return { country: match[1], id: match[3] };
}

/** Read ebook metadata. Covers and reading previews are never used: a book is a source link. */
export async function searchBooks(
  query: string,
  country: string,
  signal?: AbortSignal,
): Promise<CataloguePick[]> {
  return searchCatalogue({
    term: query,
    country,
    signal,
    media: "ebook",
    entity: "ebook",
    label: "Book",
    pick: (row) => {
      if (row.kind !== "ebook") return null;
      const canonical = bookSource(row.trackViewUrl);
      const title = catalogueText(row.trackName);
      const artist = catalogueText(row.artistName);
      if (!canonical || !title || !artist) return null;
      const year = catalogueYear(row.releaseDate);
      return { title, artist, href: canonical, ...(year !== undefined ? { year } : {}) };
    },
  });
}

/**
 * One bounded public /lookup for the exact ebook behind a pasted Apple Books
 * link, in that link's own storefront. Only a row that is an ebook with the
 * same track ID and the same canonical Apple Books source can name a slot, so
 * a different edition or a search miss never renames the exhibit. Covers,
 * reading previews and descriptions are never read.
 */
export async function lookupAppleBook(
  value: unknown,
  signal?: AbortSignal,
): Promise<{ title: string; artist: string } | null> {
  const book = appleBookRef(value);
  if (!book) return null;
  const found = await lookupCatalogue({
    ...book,
    signal,
    label: "Book",
    pick: (row) => {
      if (row.kind !== "ebook" || String(row.trackId) !== book.id) return null;
      const canonical = bookSource(row.trackViewUrl);
      if (!canonical) return null;
      const ref = appleBookRef(canonical);
      if (!ref || ref.id !== book.id || ref.country !== book.country) return null;
      const title = catalogueText(row.trackName);
      const artist = catalogueText(row.artistName);
      return title && artist ? { title, artist, href: canonical } : null;
    },
  });
  return found ? { title: found.title, artist: found.artist } : null;
}

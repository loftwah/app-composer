import {
  catalogueText, catalogueYear, searchCatalogue,
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

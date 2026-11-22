import {
  catalogueText, catalogueYear, searchCatalogue,
  type CataloguePick,
} from "./itunes-catalogue.ts";

const appleAppPath = /^\/([a-z]{2})\/app\/([^/]+)\/id([1-9]\d{0,11})\/?$/;

/** Rebuild an exact App Store source link, dropping query trackers. */
export function appSource(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  if (url.hostname !== "apps.apple.com") return null;
  const match = appleAppPath.exec(url.pathname);
  if (!match) return null;
  const [, country, slug, id] = match;
  return `https://apps.apple.com/${country}/app/${slug}/id${id}`;
}

/** Read app metadata. Icons, screenshots and previews are never used: an app is a source link. */
export async function searchApps(
  query: string,
  country: string,
  signal?: AbortSignal,
): Promise<CataloguePick[]> {
  return searchCatalogue({
    term: query,
    country,
    signal,
    media: "software",
    entity: "software",
    label: "App",
    pick: (row) => {
      if (row.kind !== "software") return null;
      const canonical = appSource(row.trackViewUrl);
      const title = catalogueText(row.trackName);
      const artist = catalogueText(row.artistName);
      if (!canonical || !title || !artist) return null;
      const year = catalogueYear(row.releaseDate);
      return { title, artist, href: canonical, ...(year !== undefined ? { year } : {}) };
    },
  });
}

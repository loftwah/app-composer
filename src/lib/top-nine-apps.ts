import {
  catalogueText, catalogueYear, lookupCatalogue, searchCatalogue,
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

/**
 * The storefront and app ID carried by one canonical App Store link.
 * `appSource` has already dropped query trackers, so only that exact app ID
 * and its own storefront can seed a lookup; a developer page, a different kind
 * of App Store page or another provider's link never does.
 */
export function appleAppRef(value: unknown): { country: string; id: string } | null {
  const canonical = appSource(value);
  if (!canonical) return null;
  const match = appleAppPath.exec(new URL(canonical).pathname);
  if (!match) return null;
  return { country: match[1], id: match[3] };
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

/**
 * One bounded public /lookup for the exact app behind a pasted App Store link,
 * in that link's own storefront. Only an app row with the same track ID and
 * the same canonical App Store source can name a slot, so a different app or a
 * search miss never renames the exhibit. Icons, screenshots and previews are
 * never read.
 */
export async function lookupAppleApp(
  value: unknown,
  signal?: AbortSignal,
): Promise<{ title: string; artist: string } | null> {
  const app = appleAppRef(value);
  if (!app) return null;
  const found = await lookupCatalogue({
    ...app,
    signal,
    label: "App",
    pick: (row) => {
      if ((row.kind !== "software" && row.kind !== "mac-software") || String(row.trackId) !== app.id) return null;
      const canonical = appSource(row.trackViewUrl);
      if (!canonical) return null;
      const ref = appleAppRef(canonical);
      if (!ref || ref.id !== app.id || ref.country !== app.country) return null;
      const title = catalogueText(row.trackName);
      const artist = catalogueText(row.artistName);
      return title && artist ? { title, artist, href: canonical } : null;
    },
  });
  return found ? { title: found.title, artist: found.artist } : null;
}

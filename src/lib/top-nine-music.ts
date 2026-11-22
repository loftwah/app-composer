import {
  catalogueText, catalogueYear, searchCatalogue,
  type CataloguePick,
} from "./itunes-catalogue.ts";

export type MusicKind = "album" | "song";
export type MusicPick = CataloguePick;

const applePath = /^\/([a-z]{2})\/(album|song)\/(?:[^/]+\/)?([1-9]\d{0,11})\/?$/;
const spotifyPath = /^\/(?:intl-[a-z]{2}\/)?(album|track)\/([a-zA-Z0-9]{22})\/?$/;

export function musicPreview(value: unknown): {
  href: string;
  embedUrl: string;
  provider: "Apple Music" | "Spotify";
} | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;

  if (url.hostname === "music.apple.com" || url.hostname === "embed.music.apple.com") {
    const match = applePath.exec(url.pathname);
    const tracks = url.searchParams.getAll("i");
    if (!match || tracks.length > 1 || (tracks.length && !/^[1-9]\d{0,11}$/.test(tracks[0]))) return null;
    const [, country, kind, id] = match;
    const track = tracks[0];
    if (track && kind !== "album") return null;
    const path = `/${country}/${kind}/${id}`;
    const query = track ? `?i=${track}` : "";
    return {
      href: `https://music.apple.com${path}${query}`,
      embedUrl: `https://embed.music.apple.com${path}${query}`,
      provider: "Apple Music",
    };
  }
  if (url.hostname === "open.spotify.com") {
    const match = spotifyPath.exec(url.pathname);
    if (!match) return null;
    const path = `/${match[1]}/${match[2]}`;
    return {
      href: `https://open.spotify.com${path}`,
      embedUrl: `https://open.spotify.com/embed${path}`,
      provider: "Spotify",
    };
  }
  return null;
}

export function normaliseMusicPicks(value: unknown): (string | null)[] {
  return Array.from({ length: 9 }, (_, index) =>
    Array.isArray(value) ? musicPreview(value[index])?.href ?? null : null,
  );
}

/**
 * Verified keyless web-player search routes, used only as a manual recovery
 * path when the catalogue API misses the exact release or is unavailable.
 * They open the official apps in a new tab; Composer makes no extra request.
 */
export function musicSearchLinks(query: string, country: string): {
  apple: string;
  spotify: string;
} {
  // The UI slices this term to a length, which can cut an emoji's surrogate
  // pair. Canonicalise lone surrogates to U+FFFD first so encoding never throws
  // here or in the recovery catch path that calls this helper again.
  const term = encodeURIComponent(query.toWellFormed());
  const storefront = /^[a-z]{2}$/i.test(country) ? country.toLowerCase() : "us";
  return {
    apple: `https://music.apple.com/${storefront}/search?term=${term}`,
    spotify: `https://open.spotify.com/search/${term}`,
  };
}

/** Read release metadata. Audio and artwork come from the official player. */
export async function searchMusic(
  query: string,
  kind: MusicKind,
  country: string,
  signal?: AbortSignal,
): Promise<MusicPick[]> {
  const album = kind === "album";
  return searchCatalogue({
    term: query,
    country,
    signal,
    media: "music",
    entity: kind,
    label: "Music",
    pick: (row) => {
      if (!album && row.kind !== "song") return null;
      const canonical = musicPreview(album ? row.collectionViewUrl : row.trackViewUrl);
      const title = catalogueText(album ? row.collectionName : row.trackName);
      const artist = catalogueText(row.artistName);
      if (canonical?.provider !== "Apple Music" || !title || !artist) return null;
      const year = catalogueYear(row.releaseDate);
      return { title, artist, href: canonical.href, ...(year !== undefined ? { year } : {}) };
    },
  });
}

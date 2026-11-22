export type MusicKind = "album" | "song";

export interface MusicPick {
  title: string;
  artist: string;
  year?: number;
  href: string;
}

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

function catalogueText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 140) : "";
}

/** Read release metadata. Audio and artwork come from the official player. */
export async function searchMusic(
  query: string,
  kind: MusicKind,
  country: string,
  signal?: AbortSignal,
): Promise<MusicPick[]> {
  const term = query.trim();
  const storefront = country.toLowerCase();
  if (term.length < 2 || term.length > 100 || !/^[a-z]{2}$/.test(storefront)) return [];
  const limit = 15;
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams({ term, media: "music", entity: kind, country: storefront, limit: String(limit) }).toString();

  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(6_000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`Music catalogue request returned ${response.status}.`);
  const data: { results?: unknown } = await response.json();
  if (!Array.isArray(data?.results)) throw new Error("Music catalogue returned an invalid result.");
  signal?.throwIfAborted();

  const picks = new Map<string, MusicPick>();
  const album = kind === "album";
  for (const item of data.results.slice(0, limit) as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (!album && row.kind !== "song") continue;
    const canonical = musicPreview(album ? row.collectionViewUrl : row.trackViewUrl);
    const title = catalogueText(album ? row.collectionName : row.trackName);
    const artist = catalogueText(row.artistName);
    if (canonical?.provider !== "Apple Music" || !title || !artist || picks.has(canonical.href)) continue;
    const year = typeof row.releaseDate === "string" ? Number(/^\d{4}(?=-)/.exec(row.releaseDate)?.[0]) : NaN;
    picks.set(canonical.href, { title, artist, href: canonical.href, ...(Number.isInteger(year) ? { year } : {}) });
  }
  const normalTerm = term.toLowerCase();
  const exact = (pick: MusicPick) => Number(pick.title.toLowerCase() === normalTerm);
  return [...picks.values()].sort((first, second) => exact(second) - exact(first));
}

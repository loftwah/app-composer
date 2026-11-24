import {
  catalogueText, catalogueYear, lookupCatalogue, searchCatalogue,
  type CataloguePick,
} from "./itunes-catalogue.ts";

export type MusicKind = "album" | "song";
export type MusicPick = CataloguePick;
/** The two exact Spotify player kinds whose oEmbed title can fill a slot. */
type SpotifyMedia = "album" | "track";

const applePath = /^\/([a-z]{2})\/(album|song)\/(?:[^/]+\/)?([1-9]\d{0,11})\/?$/;
const spotifyPath = /^\/(?:intl-[a-z]{2}\/)?(album|track)\/([a-zA-Z0-9]{22})\/?$/;
/** The two official player URLs the app emits, pasted back as a source. Only
 * these flat embed kinds are accepted: the ID is folded back onto the normal
 * album/track path so every consumer sees one canonical source form. */
const spotifyEmbedInputPath = /^\/embed\/(album|track)\/([a-zA-Z0-9]{22})\/?$/;
const spotifyEmbedPath = /^\/embed\/(album|track)\/([a-zA-Z0-9]{22})$/;
/** The one official Spotify oEmbed endpoint; it answers JSON with
 * `access-control-allow-origin: *`, so the browser reads it directly with no
 * proxy or shortening step. */
const spotifyOembed = "https://open.spotify.com/oembed";
/** A provider title longer than this is not an album name worth filling. */
const spotifyTitleLimit = 140;
/** One pasted source is bounded before parsing; canonical links are no longer. */
export const musicUrlLimit = 2_048;

export function musicPreview(value: unknown): {
  href: string;
  embedUrl: string;
  provider: "Apple Music" | "Spotify";
} | null {
  if (typeof value !== "string" || value.length > musicUrlLimit) return null;
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
    const match = spotifyPath.exec(url.pathname) ?? spotifyEmbedInputPath.exec(url.pathname);
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
    // Albums and songs ask for up to 30 rows so near-identical editions are
    // still available behind Show more; the panel shows the first 12.
    limit: 30,
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

/**
 * The storefront and album ID carried by one canonical Apple Music album
 * link. A track-specific `?i=` link is a song choice, not an album, so it
 * never seeds an album lookup.
 */
export function appleAlbumRef(value: unknown): { country: string; id: string } | null {
  const preview = musicPreview(value);
  if (preview?.provider !== "Apple Music") return null;
  const url = new URL(preview.href);
  if (url.search) return null;
  const match = applePath.exec(url.pathname);
  if (!match || match[2] !== "album") return null;
  return { country: match[1], id: match[3] };
}

/**
 * The storefront, track ID and — for an album `?i=` link — album ID carried by
 * one canonical Apple Music song link. A plain album link is not a song choice,
 * so it never seeds a song lookup. The canonical source form is the only input.
 */
export function appleSongRef(value: unknown): { country: string; id: string; album?: string } | null {
  const preview = musicPreview(value);
  if (preview?.provider !== "Apple Music") return null;
  const url = new URL(preview.href);
  const match = applePath.exec(url.pathname);
  if (!match) return null;
  const [, country, kind, id] = match;
  const track = url.searchParams.get("i");
  if (kind === "song") return track ? null : { country, id };
  return track ? { country, id: track, album: id } : null;
}

/**
 * The ID carried by one canonical Spotify link of the requested kind. A
 * different kind, a playlist or a shortened link is not that choice, so it
 * never seeds a lookup; only the ID parsed from the exact open.spotify.com
 * path is reused.
 */
function spotifyRef(value: unknown, kind: SpotifyMedia): { id: string } | null {
  const preview = musicPreview(value);
  if (preview?.provider !== "Spotify") return null;
  const url = new URL(preview.href);
  if (url.search) return null;
  const match = spotifyPath.exec(url.pathname);
  if (!match || match[1] !== kind) return null;
  return { id: match[2] };
}

/** The album ID carried by one canonical Spotify album link. Tracks and other
 * kinds never seed an album lookup. */
export function spotifyAlbumRef(value: unknown): { id: string } | null {
  return spotifyRef(value, "album");
}

/** The track ID carried by one canonical Spotify track link. Albums and other
 * kinds never seed a track lookup. */
export function spotifyTrackRef(value: unknown): { id: string } | null {
  return spotifyRef(value, "track");
}

/**
 * The ID in one canonical Spotify embed URL of the requested kind, and nothing
 * else. The oEmbed payload is only trusted when its own frame points at the
 * same media the person pasted, so a redirected or mismatched embed never
 * names a slot. Both the kind and the ID must match.
 */
function spotifyEmbedId(value: unknown, kind: SpotifyMedia): string | null {
  if (typeof value !== "string" || value.length > musicUrlLimit) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com"
    || url.port || url.username || url.password || url.hash) return null;
  const match = spotifyEmbedPath.exec(url.pathname);
  if (!match || match[1] !== kind) return null;
  const params = [...url.searchParams];
  const documented = params.length === 0
    || (params.length === 1 && params[0][0] === "utm_source" && params[0][1] === "oembed");
  return documented ? match[2] : null;
}

/**
 * A pasted-link lookup may only fill a slot that is still empty and still
 * holds the exact canonical link it looked up. A typed title, a replacement
 * link or a moved exhibit therefore always wins over a late response.
 */
export function albumTitleApplies(
  current: { href: string | null; title: string },
  expectedHref: string,
): boolean {
  return current.href === expectedHref && !current.title.trim();
}

/**
 * One bounded public /lookup for the exact album behind a pasted Apple Music
 * link, in that link's own storefront. Only a row with the same collection ID
 * and a canonical album URL is used, so a search miss or a different edition
 * can never rename the exhibit. Artwork and audio previews are never read.
 */
export async function lookupAppleAlbum(
  value: unknown,
  signal?: AbortSignal,
): Promise<{ title: string; artist: string } | null> {
  const album = appleAlbumRef(value);
  if (!album) return null;
  const found = await lookupCatalogue({
    ...album,
    signal,
    label: "Music",
    pick: (row) => {
      if (String(row.collectionId) !== album.id) return null;
      const canonical = musicPreview(row.collectionViewUrl);
      if (canonical?.provider !== "Apple Music") return null;
      if (appleAlbumRef(canonical.href)?.id !== album.id) return null;
      const title = catalogueText(row.collectionName);
      const artist = catalogueText(row.artistName);
      return title && artist ? { title, artist, href: canonical.href } : null;
    },
  });
  return found ? { title: found.title, artist: found.artist } : null;
}

/**
 * One bounded public /lookup for the exact song behind a pasted Apple Music
 * link, in that link's own storefront. Only the row's own track ID, title,
 * artist and canonical track link are used; an album `?i=` link also demands
 * the same album ID on the row and in that link. A search miss, a different
 * edition or any ambiguity falls back to manual title entry. Artwork and audio
 * previews are never read.
 */
export async function lookupAppleSong(
  value: unknown,
  signal?: AbortSignal,
): Promise<{ title: string; artist: string } | null> {
  const song = appleSongRef(value);
  if (!song) return null;
  const found = await lookupCatalogue({
    id: song.id,
    country: song.country,
    signal,
    label: "Music",
    pick: (row) => {
      if (row.kind !== "song" || String(row.trackId) !== song.id) return null;
      if (song.album && String(row.collectionId) !== song.album) return null;
      const canonical = musicPreview(row.trackViewUrl);
      if (canonical?.provider !== "Apple Music") return null;
      const parsed = appleSongRef(canonical.href);
      if (!parsed || parsed.id !== song.id || parsed.country !== song.country) return null;
      if (song.album && parsed.album !== song.album) return null;
      const title = catalogueText(row.trackName);
      const artist = catalogueText(row.artistName);
      return title && artist ? { title, artist, href: canonical.href } : null;
    },
  });
  return found ? { title: found.title, artist: found.artist } : null;
}

/**
 * One bounded official Spotify oEmbed request for the exact album or track
 * behind a pasted link. The response's provider and canonical embed URL must
 * match both the requested kind and the parsed ID before its title can fill an
 * empty exhibit. Remote HTML, artwork and audio are never read and no artist
 * is inferred, so a search miss or a different release can never rename the
 * exhibit.
 */
async function lookupSpotifyTitle(
  value: unknown,
  kind: SpotifyMedia,
  signal?: AbortSignal,
): Promise<string | null> {
  const media = spotifyRef(value, kind);
  if (!media) return null;
  const url = new URL(spotifyOembed);
  // Build the request from the parsed kind and ID alone, so share and tracking
  // parameters on the pasted link can never reach the provider.
  url.search = new URLSearchParams({ url: new URL(`/${kind}/${media.id}`, spotifyOembed).href }).toString();

  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(6_000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`Spotify embed request returned ${response.status}.`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Spotify embed returned an invalid result.");
  signal?.throwIfAborted();

  const payload = data as Record<string, unknown>;
  if (payload.provider_name !== "Spotify") return null;
  if (spotifyEmbedId(payload.iframe_url, kind) !== media.id) return null;
  // The provider's own name, collapsed and bounded. Nothing else in the
  // payload is used: no HTML, thumbnail, audio or implied artist.
  const title = typeof payload.title === "string" ? payload.title.trim().replace(/\s+/g, " ") : "";
  return title && title.length <= spotifyTitleLimit ? title : null;
}

/** The bounded exact-album lookup kept for existing callers. */
export function lookupSpotifyAlbumTitle(
  value: unknown,
  signal?: AbortSignal,
): Promise<string | null> {
  return lookupSpotifyTitle(value, "album", signal);
}

/** The bounded exact-track lookup for a pasted Spotify track link. */
export function lookupSpotifyTrackTitle(
  value: unknown,
  signal?: AbortSignal,
): Promise<string | null> {
  return lookupSpotifyTitle(value, "track", signal);
}

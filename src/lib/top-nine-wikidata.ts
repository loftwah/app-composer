// Film, TV-series, video-game and album picks from Wikidata's public Action
// API, used by the Top Nine "Find titles" panel. Browser-direct with
// credentials omitted: no proxy, no key, no autoplay, no polling and no
// retries — one search request plus at most one batched entity read per
// submit. Wikidata data and labels are CC0; a pick links the item's source
// page and never claims comprehensive coverage. Per the official Data Access
// guidance, free-text titles go to the Action API search, not WDQS/SPARQL.

import { catalogueText, type CataloguePick } from "./itunes-catalogue.ts";

export interface WikidataPick extends CataloguePick {
  /** English Wikipedia article link, when the item carries one. */
  article?: string;
  /** Platform names, shown only when every platform item is in the curated set. */
  platform?: string;
}

export type WikidataKind = "film" | "series" | "game" | "album";

const api = "https://www.wikidata.org/w/api.php";
const userAgent = "App Composer/1.0 (https://composer.loftwah.com)";
// One search row per submit, wide enough that exact-type items surface above
// unrelated matches — for "Dune" the two films rank after landforms, bands,
// albums and places (verified 2026-11-22).
const searchLimit = 30;

/**
 * Exact instance-type filter, so only known film and video-game items are
 * offered. Verified against live responses on 2026-11-22: Dune (2021, Q60834962)
 * and Dune (1984, Q114819) are P31 Q11424; Spirited Away (Q155653) is P31
 * Q20650540 (anime film); Doom (1993, Q189784), Doom (2016, Q513867) and
 * Stardew Valley (Q23013817) are P31 Q7889. Narrower types outside this set are
 * not offered; the panel states that coverage is partial.
 */
const filmTypes = new Set(["Q11424", "Q20650540"]);
/**
 * Exact instance-type filter for the explicit TV-series kind, so only verified
 * series items are offered. Q5398426 is television series (Breaking Bad, Q1079,
 * is P31 Q5398426) and Q1259759 is miniseries (Chernobyl, Q48741246, is P31
 * Q1259759), both read from the official item pages on 2026-11-24. Films
 * (Q11424), episodes (Q21191270) and seasons (Q3464665) are never offered here,
 * and narrower series types stay out; the panel states that coverage is
 * partial.
 */
const seriesTypes = new Set(["Q5398426", "Q1259759"]);
const gameTypes = new Set(["Q7889"]);
/**
 * Album fallback, offered only as an explicit action from the music panel's
 * recovery area for album queries. Accepted types stay narrow: Q482994 album
 * plus Q20853847 studio album, the one narrower subtype where many album items
 * are typed directly instead of Q482994 (verified live 2026-11-22: Modal Soul
 * Q3317763 and Spiritual State Q3493569 are both P31 Q482994). Compilations,
 * live albums and every other narrower type are not offered; the panel states
 * that coverage is partial. Results stay metadata-only: the pick is the item's
 * source link, playback comes only from a pasted Apple Music or Spotify link.
 */
const albumTypes = new Set(["Q482994", "Q20853847"]);

/**
 * Platform names, resolved once from each platform item's own English label or
 * article title on 2026-11-22. A game whose platform items all appear here and
 * lists at most four gets its platforms; anything else shows the year only.
 * This curated set is a known limitation, stated in the picker panel.
 */
const platformNames: Record<string, string> = {
  Q94: "Android", Q48493: "iOS", Q388: "Linux", Q1406: "Windows", Q14116: "macOS",
  Q170434: "DOS", Q47604: "MS-DOS", Q13522376: "Classic Mac OS",
  Q10677: "PlayStation", Q10683: "PlayStation 3", Q5014725: "PlayStation 4",
  Q183259: "Super Nintendo Entertainment System",
  Q132020: "Xbox", Q48263: "Xbox 360", Q13361286: "Xbox One",
  Q19610114: "Nintendo Switch",
  Q10676: "Sega Genesis", Q200912: "Sega Saturn", Q188642: "Game Boy Advance",
  Q229429: "3DO", Q1063978: "32X", Q650601: "Atari Jaguar", Q471094: "Amiga 1200",
};

const entityPath = /^\/(wiki|entity)\/(Q[1-9]\d{0,9})\/?$/;

/** Rebuild an exact Wikidata item link, dropping query trackers and aliases. */
export function wikidataSource(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  if (url.hostname !== "www.wikidata.org") return null;
  const match = entityPath.exec(url.pathname);
  if (!match) return null;
  return `https://www.wikidata.org/wiki/${match[2]}`;
}

interface Claim {
  mainsnak?: { datavalue?: { value?: unknown } };
}
type Claims = Record<string, Claim[]>;
type Sitelinks = Record<string, { title?: unknown }>;
type Entities = Record<string, { claims?: Claims; sitelinks?: Sitelinks } | undefined>;

/** A plain JSON object, so upstream arrays, strings and null never act as maps. */
function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/** One property's claims, or nothing when upstream sent something unexpected. */
function claimsFor(claims: Claims | undefined, property: string): Claim[] {
  const value = claims?.[property];
  return Array.isArray(value) ? value : [];
}

/** Item IDs from one property, ignoring malformed claims. */
function itemIds(claims: Claims | undefined, property: string): string[] {
  return claimsFor(claims, property).flatMap((claim): string[] => {
    const value = record(claim?.mainsnak?.datavalue?.value);
    return typeof value?.id === "string" ? [value.id] : [];
  });
}

/** Run one bounded Action API request and return its parsed JSON body. */
async function request(params: URLSearchParams, what: string, signal?: AbortSignal) {
  params.set("format", "json");
  params.set("origin", "*");
  const url = new URL(api);
  url.search = params.toString();

  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(6_000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { "Api-User-Agent": userAgent },
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`Wikidata ${what} request returned ${response.status}.`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || "error" in data) {
    throw new Error(`Wikidata ${what} request was rejected.`);
  }
  signal?.throwIfAborted();
  return data as Record<string, unknown>;
}

/** The publication year of an item: the earliest full year among P577 values. */
function releaseYear(claims: Claims | undefined): number | undefined {
  const years = claimsFor(claims, "P577").flatMap((claim): number[] => {
    const value = record(claim?.mainsnak?.datavalue?.value);
    const time = value?.time;
    const precision = value?.precision;
    // Precision 9 is year or finer; coarser values are not a reliable year.
    if (typeof time !== "string" || typeof precision !== "number" || precision < 9) return [];
    const year = Number(/^\+(\d{4})/.exec(time)?.[1]);
    return year >= 1000 && year <= 2999 ? [year] : [];
  });
  return years.length ? Math.min(...years) : undefined;
}

/** Platform names when every P400 item is in the curated set and there are few. */
function platform(claims: Claims | undefined): string | undefined {
  const ids = [...new Set(itemIds(claims, "P400"))];
  if (!ids.length || ids.length > 4 || !ids.every((id) => platformNames[id])) return undefined;
  return ids.map((id) => platformNames[id]).join(" · ");
}

/**
 * Known non-article namespaces. A main-namespace title may contain a colon
 * ("Star Trek: The Motion Picture"), but a File:/Category:/Talk: page is not
 * an article and must not be offered as one.
 */
const namespaces = /^(?:file|image|category|template|wikipedia|help|portal|draft|module|special|talk|user talk|user|mediawiki|book|timedtext|gadget)\s*:/i;

/** The item's English Wikipedia article, skipping non-article namespaces. */
function article(sitelinks: Sitelinks | undefined): string | undefined {
  const link = record(sitelinks?.enwiki);
  const title = link?.title;
  if (typeof title !== "string") return undefined;
  const text = title.trim();
  if (!text || text.length > 255 || namespaces.test(text)) return undefined;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(text).replace(/%20/g, "_")}`;
}

/**
 * One search plus one batched read, filtered to the exact known film, series,
 * game or album types. Items typed only as a narrower or different class are
 * not offered; the panel states that coverage is partial.
 */
export async function searchWikidata(
  query: string,
  kind: WikidataKind,
  signal?: AbortSignal,
): Promise<WikidataPick[]> {
  const text = query.trim();
  if (text.length < 2 || text.length > 100) return [];
  const accepted = kind === "film" ? filmTypes
    : kind === "series" ? seriesTypes
    : kind === "game" ? gameTypes
    : albumTypes;

  const search = await request(new URLSearchParams({
    action: "wbsearchentities", search: text, language: "en", uselang: "en",
    type: "item", limit: String(searchLimit),
  }), "search", signal);
  const rows = Array.isArray(search.search) ? search.search as unknown[] : [];
  const hits: { id: string; label: string; description: string }[] = [];
  for (const row of rows.slice(0, searchLimit)) {
    const hit = record(row);
    if (!hit) continue;
    const { id, label, description } = hit;
    if (typeof id !== "string" || !/^Q[1-9]\d{0,9}$/.test(id)) continue;
    const title = catalogueText(label);
    if (!title) continue;
    hits.push({ id, label: title, description: catalogueText(description) });
  }
  if (!hits.length) return [];

  const read = await request(new URLSearchParams({
    action: "wbgetentities", props: "claims|sitelinks",
    ids: hits.map((hit) => hit.id).join("|"),
  }), "entity", signal);
  const entities = record(read.entities) as Entities | undefined;

  const picks = new Map<string, WikidataPick>();
  for (const hit of hits) {
    const item = record(entities?.[hit.id]);
    const claims = record(item?.claims) as Claims | undefined;
    if (!itemIds(claims, "P31").some((id) => accepted.has(id))) continue;
    const pick: WikidataPick = {
      title: hit.label,
      artist: hit.description,
      href: `https://www.wikidata.org/wiki/${hit.id}`,
    };
    const year = releaseYear(claims);
    if (year !== undefined) pick.year = year;
    const platforms = platform(claims);
    if (platforms) pick.platform = platforms;
    const link = article(record(item?.sitelinks) as Sitelinks | undefined);
    if (link) pick.article = link;
    picks.set(pick.href, pick);
  }
  const normalTerm = text.toLowerCase();
  const exact = (found: WikidataPick) => Number(found.title.toLowerCase() === normalTerm);
  return [...picks.values()].sort((first, second) => exact(second) - exact(first));
}

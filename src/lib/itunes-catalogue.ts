// Apple iTunes catalogue search and exact-ID lookup requests shared by every
// Top Nine catalogue source. Providers map their own rows; the request
// hardening, row bounds, dedupe and exact-title ranking stay in this one place.

export interface CataloguePick {
  title: string;
  artist: string;
  year?: number;
  href: string;
}

export interface CatalogueSearch {
  term: string;
  country: string;
  signal?: AbortSignal;
  media: string;
  entity: string;
  /** Catalogue name used in failures, e.g. "Music" or "Book". */
  label: string;
  /** Map one raw result row to a pick, or null when the row is not usable. */
  pick: (row: Record<string, unknown>) => CataloguePick | null;
  /** Rows requested from the catalogue, capped again after parsing. */
  limit?: number;
}

export function catalogueText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 140) : "";
}

export function catalogueYear(value: unknown): number | undefined {
  const year = typeof value === "string" ? Number(/^\d{4}(?=-)/.exec(value)?.[0]) : NaN;
  return Number.isInteger(year) ? year : undefined;
}

/** Run one hardened catalogue request and return deduped, exact-title-first picks. */
export async function searchCatalogue(
  { term, country, signal, media, entity, label, pick, limit = 15 }: CatalogueSearch,
): Promise<CataloguePick[]> {
  const text = term.trim();
  const storefront = country.toLowerCase();
  if (text.length < 2 || text.length > 100 || !/^[a-z]{2}$/.test(storefront)) return [];
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams({ term: text, media, entity, country: storefront, limit: String(limit) }).toString();

  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(6_000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`${label} catalogue request returned ${response.status}.`);
  const data: { results?: unknown } = await response.json();
  if (!Array.isArray(data?.results)) throw new Error(`${label} catalogue returned an invalid result.`);
  signal?.throwIfAborted();

  const picks = new Map<string, CataloguePick>();
  for (const item of data.results.slice(0, limit) as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const found = pick(item as Record<string, unknown>);
    if (!found || picks.has(found.href)) continue;
    picks.set(found.href, found);
  }
  const normalTerm = text.toLowerCase();
  const exact = (found: CataloguePick) => Number(found.title.toLowerCase() === normalTerm);
  return [...picks.values()].sort((first, second) => exact(second) - exact(first));
}

export interface CatalogueLookup {
  /** Numeric catalogue ID from a canonical link. */
  id: string;
  country: string;
  signal?: AbortSignal;
  /** Catalogue name used in failures, e.g. "Music". */
  label: string;
  /** Map one raw row to a pick, or null when the row is not the exact item. */
  pick: (row: Record<string, unknown>) => CataloguePick | null;
  /** Rows inspected before giving up, capped again after parsing. */
  limit?: number;
}

/**
 * One hardened /lookup request for an exact catalogue ID in one storefront.
 * It never searches by text, retries, or reads artwork or preview URLs, so a
 * public link can restore its own title without guessing a different release.
 */
export async function lookupCatalogue(
  { id, country, signal, label, pick, limit = 5 }: CatalogueLookup,
): Promise<CataloguePick | null> {
  const storefront = country.toLowerCase();
  if (!/^[1-9]\d{0,11}$/.test(id) || !/^[a-z]{2}$/.test(storefront)) return null;
  const url = new URL("https://itunes.apple.com/lookup");
  url.search = new URLSearchParams({ id, country: storefront }).toString();

  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(6_000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error(`${label} catalogue request returned ${response.status}.`);
  const data: { results?: unknown } = await response.json();
  if (!Array.isArray(data?.results)) throw new Error(`${label} catalogue returned an invalid result.`);
  signal?.throwIfAborted();

  for (const item of data.results.slice(0, limit) as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const found = pick(item as Record<string, unknown>);
    if (found) return found;
  }
  return null;
}

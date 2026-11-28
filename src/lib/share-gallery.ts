import type { D1Database } from "@cloudflare/workers-types";
import {
  normalizeShareAssetId,
  SHARE_CATALOGUE_QUERY_MAX,
  type CatalogueArtwork,
} from "./share-catalogue-asset.ts";

export const artworkCategories: Record<string, string> = {
  banners: "Banners",
  icons: "Icons & stickers",
  illustration: "Illustration",
  posters: "Posters & prints",
  sketches: "Sketches",
  "product-art": "Product artwork",
  screenshots: "Screenshots",
};

export const artworkSorts = {
  featured: "Featured",
  newest: "Newest",
  oldest: "Oldest",
  title: "Title A–Z",
  random: "Random",
};

// Recorded original dimensions decide orientation. "any" is the default and
// never hides an artwork whose original size is unknown.
export const artworkOrientations = {
  any: "Any",
  landscape: "Landscape",
  portrait: "Portrait",
  square: "Square",
};

export function artworkLabel(text: string) {
  const brands: Record<string, string> = {
    "app-composer": "App Composer",
    "composer-media-studio": "Media Studio",
    "loftwah-fm": "LoftwahFM",
    loftwahfm: "LoftwahFM",
    shoalshot: "SHOALSHOT",
    ldraw: "LDraw",
  };
  return (
    brands[text] ??
    text.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export interface ArtworkCuration {
  assetId: string;
  featured: boolean;
  tags: string[];
}

export async function readArtworkCuration(db?: D1Database) {
  if (!db) return [];
  const { results } = await db
    .prepare(
      "SELECT asset_id AS assetId, featured, tags FROM composer_share_artwork_curation",
    )
    .all<{ assetId: string; featured: number; tags: string }>();
  return results.map(({ assetId, featured, tags }): ArtworkCuration => ({
    assetId,
    featured: featured === 1,
    tags: JSON.parse(tags) as string[],
  }));
}

export function artworkFilters(params: URLSearchParams) {
  const rawSort = params.get("sort") ?? "";
  const sort = Object.hasOwn(artworkSorts, rawSort)
    ? (rawSort as keyof typeof artworkSorts)
    : "featured";
  const seed = params.get("seed") ?? "";
  const rawCategory = params.get("category") ?? "";
  const rawOrientation = params.get("orientation") ?? "";
  return {
    liked: params.get("view") === "liked",
    query: (params.get("art") ?? "").slice(0, SHARE_CATALOGUE_QUERY_MAX).trim(),
    project: normalizeShareAssetId(params.get("project")) ?? "",
    category: Object.hasOwn(artworkCategories, rawCategory) ? rawCategory : "",
    orientation: Object.hasOwn(artworkOrientations, rawOrientation)
      ? (rawOrientation as keyof typeof artworkOrientations)
      : "any",
    tag: (params.get("tag") ?? "").trim().toLowerCase().slice(0, 48),
    sort,
    seed:
      sort === "random"
        ? /^[a-f0-9]{8}$/.test(seed)
          ? seed
          : crypto.randomUUID().slice(0, 8)
        : "",
    after: normalizeShareAssetId(params.get("after")) ?? "",
    legacy: !rawSort && params.has("after"),
  };
}

export type ArtworkFilters = ReturnType<typeof artworkFilters>;

export function galleryHref(
  filters: ArtworkFilters,
  updates: Partial<ArtworkFilters> = {},
) {
  const state = { ...filters, ...updates };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    view: state.liked ? "liked" : "",
    art: state.query,
    project: state.project,
    category: state.category,
    orientation: state.orientation !== "any" ? state.orientation : "",
    tag: state.tag,
    sort: state.sort !== "featured" || state.after ? state.sort : "",
    seed: state.sort === "random" ? state.seed : "",
    after: state.after,
  }))
    if (value) params.set(key, value);
  return params.size ? `/share?${params}` : "/share";
}

function shuffleKey(id: string, seed: string) {
  let hash = Number.parseInt(seed, 16) | 0;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function galleryPage(
  catalogue: CatalogueArtwork[],
  curation: ArtworkCuration[],
  filters: ArtworkFilters,
  likedIds?: ReadonlySet<string>,
) {
  const edits = new Map(curation.map((item) => [item.assetId, item]));
  const visible = filters.liked ? catalogue.filter((item) => likedIds?.has(item.assetId)) : catalogue;
  const all = visible.map((item) => {
    const edit = edits.get(item.assetId);
    return {
      ...item,
      featured: edit?.featured ?? false,
      tags: [...new Set([...item.tags, ...(edit?.tags ?? [])])],
    };
  });
  const projects = [...new Set(all.map((item) => item.project))].sort((a, b) =>
    artworkLabel(a).localeCompare(artworkLabel(b)),
  );
  const tags = [...new Set(all.map((item) => item.tags).flat())].sort();
  const categories = [...new Set(all.map((item) => item.category))].sort();
  const words = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = all.filter((item) => {
    if (filters.project && item.project !== filters.project) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.orientation !== "any") {
      const width = item.original?.width;
      const height = item.original?.height;
      if (!width || !height) return false;
      if (
        (filters.orientation === "landscape" && width <= height) ||
        (filters.orientation === "portrait" && width >= height) ||
        (filters.orientation === "square" && width !== height)
      )
        return false;
    }
    if (filters.tag && !item.tags.includes(filters.tag)) return false;
    const text = [
      item.title,
      item.alt,
      item.description,
      artworkLabel(item.project),
      item.credit,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const idOrder = (a: CatalogueArtwork, b: CatalogueArtwork) =>
    a.assetId.localeCompare(b.assetId, "en");
  const newest = (a: CatalogueArtwork, b: CatalogueArtwork) =>
    b.reviewedAt.localeCompare(a.reviewedAt) || idOrder(a, b);
  matches.sort((a, b) => {
    if (filters.legacy) return a.assetId < b.assetId ? -1 : 1;
    switch (filters.sort) {
      case "featured":
        return Number(b.featured) - Number(a.featured) || newest(a, b);
      case "oldest":
        return (
          (a.reviewedAt || "9999").localeCompare(b.reviewedAt || "9999") ||
          idOrder(a, b)
        );
      case "title":
        return (
          a.title.localeCompare(b.title, "en", { sensitivity: "base" }) ||
          idOrder(a, b)
        );
      case "random":
        return (
          shuffleKey(a.assetId, filters.seed) -
            shuffleKey(b.assetId, filters.seed) || idOrder(a, b)
        );
      default:
        return newest(a, b);
    }
  });
  // The first piece from each project gets a turn. Within that pass, keep
  // curated work first, and avoid filling the opening with one series.
  if (
    filters.sort === "featured" &&
    !filters.legacy &&
    !filters.project &&
    !filters.tag &&
    !filters.query
  ) {
    const projectsSeen = new Map<string, number>();
    const collections = new Map<string, number>();
    const rank = new Map(
      matches.map((item) => {
        const project = projectsSeen.get(item.project) ?? 0;
        const collection = item.thumbnailUrl?.split("/")[4] ?? item.assetId;
        const series = collections.get(collection) ?? 0;
        projectsSeen.set(item.project, project + 1);
        collections.set(collection, series + 1);
        return [item.assetId, Math.max(project, series)];
      }),
    );
    matches.sort((a, b) => rank.get(a.assetId)! - rank.get(b.assetId)!);
  }
  const start = filters.legacy
    ? matches.filter((item) => item.assetId <= filters.after).length
    : filters.after
      ? matches.findIndex((item) => item.assetId === filters.after) + 1
      : 0;
  const items = matches.slice(start, start + 24);
  return {
    items,
    total: matches.length,
    projects,
    tags,
    categories,
    nextAfter:
      start + items.length < matches.length
        ? (items.at(-1)?.assetId ?? null)
        : null,
  };
}

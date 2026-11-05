// Published mini-app catalogue entries belong in the sitemap too. The static
// public-page list cannot know about entries the owner publishes later, so the
// sitemap merges them from EmDash. Incomplete catalogue reads fail the request
// instead of silently presenting a partial sitemap as complete.
import {publicPagePaths, publicPageCanonical} from './public-pages.mjs';

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Accepts the EmDash entry shape, or a bare slug, and returns safe slugs. */
export function catalogueSlugs(entries) {
  const slugs = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const raw = typeof entry === 'string' ? entry : entry?.id;
    if (typeof raw !== 'string') continue;
    const slug = raw.trim();
    if (!SAFE_SLUG.test(slug)) continue;
    slugs.add(slug);
  }
  return [...slugs].sort();
}

/** Every indexable public path, static first, then published catalogue entries. */
export function sitemapPaths(entries) {
  // The agent Markdown endpoint is useful to clients but is not an HTML page.
  const paths = publicPagePaths.filter(path => path !== '/agent.md');
  const seen = new Set(paths);
  for (const slug of catalogueSlugs(entries)) {
    const path = '/catalogue/' + slug;
    if (seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}

export function sitemapXml(entries) {
  const urls = sitemapPaths(entries)
    .map(path => '<url><loc>' + publicPageCanonical(path).href + '</loc></url>')
    .join('');
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>';
}

// Fail closed on incomplete pagination: a partial sitemap would silently hide
// published pages. Bound work and detect a broken or repeating cursor.
export async function fetchCatalogueEntries(query) {
  const entries = [];
  const seen = new Set();
  let cursor;
  for (let page = 0; page < 20; page++) {
    const result = await query({limit: 50, status: 'published', ...(cursor ? {cursor} : {})});
    if (result?.error || !Array.isArray(result?.entries)) throw new Error('Catalogue unavailable');
    entries.push(...result.entries);
    if (!result.nextCursor) {
      if (result.hasMore) throw new Error('Catalogue pagination incomplete');
      return entries;
    }
    if (typeof result.nextCursor !== 'string' || seen.has(result.nextCursor)) throw new Error('Catalogue pagination repeated');
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error('Catalogue pagination limit exceeded');
}

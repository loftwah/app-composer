// Published mini-app catalogue entries belong in the sitemap too. The static
// public-page list cannot know about entries the owner publishes later, so the
// sitemap merges them from EmDash. A catalogue failure must never take the
// sitemap down: the static pages still describe the site truthfully.
import {publicPagePaths, publicPageCanonical} from './public-pages.mjs';

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Accepts the EmDash entry shape, or a bare slug, and returns safe slugs. */
export function catalogueSlugs(entries) {
  const slugs = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const raw = typeof entry === 'string' ? entry : entry?.data?.slug ?? entry?.slug ?? entry?.id;
    if (typeof raw !== 'string') continue;
    const slug = raw.trim();
    if (!SAFE_SLUG.test(slug)) continue;
    slugs.add(slug);
  }
  return [...slugs].sort();
}

/** Every indexable public path, static first, then published catalogue entries. */
export function sitemapPaths(entries) {
  const paths = [...publicPagePaths];
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

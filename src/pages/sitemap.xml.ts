import {getEmDashCollection} from 'emdash';
import {sitemapXml} from '../lib/sitemap.mjs';

export async function GET() {
  let entries: unknown[] = [];
  try {
    const result = await getEmDashCollection('catalogue', {limit: 50});
    if (!result?.error) entries = result?.entries ?? [];
  } catch {
    // The catalogue being unavailable must not remove the static public pages
    // from the sitemap. Missing detail pages stay missing rather than guessed.
  }
  return new Response(sitemapXml(entries), {
    headers: {'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300'},
  });
}

import {getEmDashCollection} from 'emdash';
import {fetchCatalogueEntries, sitemapXml} from '../lib/sitemap.mjs';

export async function GET() {
  try {
    const entries = await fetchCatalogueEntries((filter: Parameters<typeof getEmDashCollection>[1]) => getEmDashCollection('catalogue', filter));
    return new Response(sitemapXml(entries), {
      headers: {'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300'},
    });
  } catch {
    // A partial result must not masquerade as a complete sitemap.
    return new Response('Sitemap temporarily unavailable', {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}

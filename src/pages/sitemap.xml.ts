import { publicPagePaths, publicPageCanonical } from '../lib/public-pages.mjs';

export function GET() {
  const urls = publicPagePaths.map(path => `<url><loc>${publicPageCanonical(path).href}</loc></url>`).join('');
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>',
    { headers: { 'Content-Type': 'application/xml' } },
  );
}

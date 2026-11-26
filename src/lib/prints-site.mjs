export const printsDiscovery = /** @type {const} */ ({
  id: 'prints-desktop',
  name: 'Prints Desktop',
  category: 'Creative',
  href: '/prints-desktop',
  description: 'Browse, compare and export original artwork in a native desktop workspace. Start offline with the Loftwah Creative Archive.',
  keywords: 'creative archive contact sheet artwork gallery offline download macos linux windows oyster fungi',
});
export const printsOrigin = 'https://prints.loftwah.com';
export const printsPreviewVersion = '0.6.0';
export const printsFieldKitFolder = '/prints-desktop/workshop-kit-20261125/';
export const printsFieldKitZip = printsFieldKitFolder + 'prints-workshop-kit.zip';
export const printsFieldKitDownloads = [
  printsFieldKitZip,
  '/prints-desktop/devrel-20261125/prints-workshop-kit.zip',
  '/prints-desktop/devrel-20261125/prints-devrel-field-kit.zip',
];
export const printsWorkshopShareFolder = '/prints-desktop/workshop-share-home-20261125/';
export const printsDownloadShareFolder = '/prints-desktop/download-share-home-20261125/';
export const printsWorkflowShareFolder = '/prints-desktop/workflow-share-home-20261125/';
export const printsPosterStudy = '/prints-desktop/last-train-home-20261125/';
export const printsIcon = '/prints-desktop/icons/aperture-32-20261125.png';
export const printsShare = printsWorkshopShareFolder + 'wide.jpg';
export const printsShareAlt = 'Prints Desktop. Make a poster. Keep the original. A machined orange camera aperture opens onto a white coastline.';

const productRoutes = new Map([
  ['/', '/prints-desktop'],
  ['/watch', '/prints-desktop/watch'],
  ['/guide', '/prints-desktop/guide'],
  ['/make', '/prints-desktop/make'],
  ['/workshop-kit', '/prints-desktop/devrel'],
  ['/story', '/prints-desktop/story'],
  ['/downloads', '/prints-desktop/downloads'],
]);

export function isPrintsHost(url) {
  return url.hostname === new URL(printsOrigin).hostname;
}

// The public hostname exposes a small, read-only surface on the existing
// Worker. Composer APIs, admin routes, and session headers stay on Composer.
export function printsDomainRequest(request) {
  const url = new URL(request.url);
  if (!isPrintsHost(url)) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : '/';
  const legacyPath = [...productRoutes].find(([, internal]) => internal === path)?.[0];
  const canonicalPath = path === '/devrel' ? '/workshop-kit' : legacyPath ?? path;
  if (productRoutes.has(canonicalPath) && (canonicalPath !== url.pathname || url.origin !== printsOrigin)) {
    const target = new URL(canonicalPath, printsOrigin);
    target.search = url.search;
    return Response.redirect(target, 308);
  }

  if (path === '/robots.txt' && path === url.pathname) {
    return new Response(request.method === 'HEAD' ? null : `User-agent: *\nAllow: /\nSitemap: ${printsOrigin}/sitemap.xml\n`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }
  if (path === '/sitemap.xml' && path === url.pathname) {
    const entries = [...productRoutes.keys()].map((route) => `<url><loc>${new URL(route, printsOrigin).href}</loc></url>`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
    return new Response(request.method === 'HEAD' ? null : xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  }

  const internal = productRoutes.get(path);
  if (!internal) {
    return new Response(request.method === 'HEAD' ? null : 'Page not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  }
  url.pathname = internal;
  const headers = new Headers(request.headers);
  for (const header of ['Authorization', 'Cookie', 'Cf-Access-Jwt-Assertion', 'Cf-Access-Authenticated-User-Email']) {
    headers.delete(header);
  }
  return new Request(url, { method: request.method, headers });
}

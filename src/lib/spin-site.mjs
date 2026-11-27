export const spinOrigin = 'https://spin.loftwah.com';

export const spinImageFormats = [
  { id: 'portrait', name: 'Feed portrait', width: 1080, height: 1350 },
  { id: 'square', name: 'Square post', width: 1080, height: 1080 },
  { id: 'story', name: 'Story', width: 1080, height: 1920 },
  { id: 'landscape', name: 'Wide post', width: 1200, height: 630 },
];
export const spinArtwork = '/campaign/spin/takeaway-counter-wide-20261128.jpg';
export const spinArtworkAlt = 'Dinner’s on the wheel. A painted wooden wheel sits behind takeaway burgers, chips and fried chicken. Spin by App Composer.';
const counter = '/spin-brand/counter/';
export const spinIcon = counter + 'spin-192.png';
export const spinBrandFiles = {
  mark: spinIcon,
  manifest: counter + 'site.webmanifest',
  dark: counter + 'lockup-dark.png',
  light: counter + 'lockup-light.png',
  icon: counter + 'spin-512.png',
  favicon: counter + 'spin-32.png',
  faviconSmall: counter + 'spin-16.png',
  touch: counter + 'spin-180.png',
};
export const spinDiscovery = Object.freeze({
  id: 'spin',
  name: 'Spin by App Composer',
  category: 'Creative',
  description: 'Pick dinner or choose a game with a single spin, a best-of series or an open session with a live tally.',
  href: spinOrigin + '/',
  keywords: 'decision wheel spin the wheel random picker wheel of names roulette choose dinner game night takeaway best of',
});

const originalOrigin = 'https://composer.loftwah.com';
const allowRead = ['GET', 'HEAD'];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${spinOrigin}/</loc></url></urlset>`;
const robots = `User-agent: *\nAllow: /\nSitemap: ${spinOrigin}/sitemap.xml\n`;

export function spinDomainRequest(request) {
  const url = new URL(request.url);
  const reading = allowRead.includes(request.method);
  const oldPage = url.pathname === '/spin' || url.pathname === '/spin/';

  // Creator keys are stored on the origin where the session was created.
  // Keep historical session URLs on Composer so creators can still finish them.
  if (url.hostname === new URL(originalOrigin).hostname && oldPage && reading) {
    if (!url.searchParams.has('session')) return Response.redirect(spinOrigin + '/' + url.search, 308);
    if (url.pathname === '/spin' && url.origin === originalOrigin) return null;
    return Response.redirect(originalOrigin + '/spin' + url.search, 308);
  }

  if (url.hostname !== new URL(spinOrigin).hostname) return null;
  if (url.pathname === '/api/spin') return request;
  if (!reading) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (oldPage || (url.pathname === '/' && url.origin !== spinOrigin)) {
    return Response.redirect(spinOrigin + '/' + url.search, 308);
  }
  if (url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml') {
    const isSitemap = url.pathname === '/sitemap.xml';
    return new Response(request.method === 'HEAD' ? null : isSitemap ? sitemap : robots, {
      headers: {
        'Content-Type': isSitemap ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
  if (url.pathname === '/') {
    url.pathname = '/spin';
    const headers = new Headers(request.headers);
    for (const name of ['Authorization', 'Cookie', 'Cf-Access-Jwt-Assertion', 'Cf-Access-Authenticated-User-Email']) {
      headers.delete(name);
    }
    return new Request(url, { method: request.method, headers });
  }
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

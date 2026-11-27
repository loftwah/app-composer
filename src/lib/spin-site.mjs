export const spinOrigin = 'https://spin.loftwah.com';
export const spinArtwork = '/campaign/spin/one-spin-or-all-night-20261127f.jpg';
export const spinArtworkAlt = 'Spin by App Composer. One spin or all night. A close-up of the metal pointer above an orange and charcoal wheel.';
export const spinGameNightArtwork = '/campaign/spin/make-the-call-game-night-20261127f.jpg';
export const spinGameNightArtworkAlt = 'Spin by App Composer. Make the call. An orange, ivory and charcoal decision wheel with an orange die.';
export const spinIcon = '/spin-brand/spin-icon-192-20261127e.png';
export const spinBrandFiles = {
  mark: '/spin-brand/spin-mark-20261127e.svg',
  manifest: '/spin-brand/site-20261127e.webmanifest',
  dark: '/spin-brand/spin-lockup-dark-20261127e.png',
  light: '/spin-brand/spin-lockup-light-20261127e.png',
  icon: '/spin-brand/spin-icon-512-20261127e.png',
  favicon: '/spin-brand/spin-icon-32-20261127e.png',
  faviconSmall: '/spin-brand/spin-icon-16-20261127e.png',
  maskable: '/spin-brand/spin-icon-maskable-20261127e.png',
  touch: '/spin-brand/spin-icon-180-20261127e.png',
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

export const spinOrigin = 'https://spin.loftwah.com';
export const spinArtwork = '/campaign/spin/spin-wide-20261127d.jpg';
export const spinArtworkAlt = 'App Composer Spin. Takeaway roulette. An orange, cream and navy wheel beside a paper takeaway bag and hot chips.';
export const spinIcon = '/spin-brand/spin-icon-192-20261127d.png';
export const spinBrandFiles = {
  dark: '/spin-brand/spin-lockup-dark-20261127c.png',
  light: '/spin-brand/spin-lockup-light-20261127c.png',
  icon: '/spin-brand/spin-icon-512-20261127d.png',
  favicon: '/spin-brand/spin-icon-32-20261127d.png',
  touch: '/spin-brand/spin-icon-180-20261127d.png',
};
export const spinDiscovery = Object.freeze({
  id: 'spin',
  name: 'App Composer Spin',
  category: 'Creative',
  description: 'Pick dinner, choose a game or settle a decision with a custom wheel and a result friends can verify.',
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

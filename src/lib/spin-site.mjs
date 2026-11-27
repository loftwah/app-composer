export const spinOrigin = 'https://spin.loftwah.com';
export const spinArtwork = '/spin-brand/decision-wheel-20261127.jpg';
export const spinArtworkAlt = 'App Composer Spin. Settle it with a spin. An illustrated decision wheel with fish and chips, a game controller and a flat white.';
export const spinIcon = '/spin-brand/icon-192.png';
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

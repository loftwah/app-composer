// These are the deliberately indexable Composer pages. Mounted apps and private
// routes keep their own routing and publication policies.
export const publicPagePaths = Object.freeze([
  '/', '/learn', '/ready', '/ready/guide', '/setup', '/prompts', '/resources', '/resources/change', '/resources/incident', '/resources/pipeline', '/resources/hook', '/resources/operating-kit', '/init', '/init/content',
  '/discover', '/for/creator', '/for/small-business', '/for/developer', '/for/designer', '/explore', '/demo', '/docs', '/architecture', '/guide',
  '/catalogue', '/apps', '/activity', '/review', '/privacy', '/release',
  '/extension', '/state', '/php2shell', '/studio', '/manage', '/building',
  '/launch-kit', '/paperwork', '/init/paperwork', '/platform', '/platform/demo',
]);

const origin = 'https://composer.loftwah.com';
const paths = new Set(publicPagePaths);

function preferredPath(pathname) {
  const withoutSlash = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return paths.has(withoutSlash) ? withoutSlash : pathname;
}

export function publicPageCanonical(pathname) {
  const url = new URL(origin);
  url.pathname = preferredPath(pathname);
  return url;
}

export function publicPageRedirect(request) {
  const url = new URL(request.url);
  if (url.origin !== origin && url.origin !== 'http://composer.loftwah.com') return null;
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const path = preferredPath(url.pathname);
  if (!paths.has(path)) return null;
  const target = publicPageCanonical(path);
  target.search = url.search;
  if (target.href === url.href) return null;
  return new Response(null, {
    status: 308,
    headers: { Location: target.href, 'Cache-Control': 'no-store' },
  });
}

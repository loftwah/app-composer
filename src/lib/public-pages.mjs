// These are the deliberately indexable Composer pages. Mounted apps and private
// routes keep their own routing and publication policies.
export const publicPagePaths = Object.freeze([
  '/', '/learn', '/ready', '/ready/guide', '/setup', '/prompts', '/agent', '/agent.md', '/resources', '/resources/change', '/resources/incident', '/resources/pipeline', '/resources/hook', '/resources/operating-kit', '/init', '/init/content', '/init/launch-kit',
  '/roles', '/roles/service-owner', '/roles/programmer', '/roles/architect', '/roles/devops', '/roles/security', '/roles/qa',
  '/diagrams', '/discover', '/for/creator', '/for/small-business', '/for/developer', '/for/designer', '/for/wordpress', '/for/shopify', '/for/platform-team',
  '/jobs/profile', '/jobs/enquiries', '/jobs/first-app', '/jobs/branding', '/jobs/diagram', '/jobs/pdf', '/jobs/inspect',
  '/explore', '/demo', '/docs', '/architecture', '/guide',
  '/catalogue', '/apps', '/activity', '/review', '/privacy', '/release', '/capabilities',
  '/extension', '/state', '/php2shell', '/studio', '/manage', '/building', '/effect',
  '/creator-hub',
  '/launch-kit', '/paperwork', '/init/paperwork', '/platform', '/platform/demo', '/plugin-trust', '/incident-replay', '/migration-example',
]);

// The named-edition return handoff is deliberately narrower than the indexable
// page list. Both inventories live together so adding a public page forces one
// review, and the builder allowlist cannot silently drift into a dead or private
// route. `/launch-kit/example/` is a static example, not a public site page.
export const builderPagePaths = Object.freeze([
  '/', '/apps', '/docs', '/architecture', '/guide', '/explore', '/review',
  '/catalogue', '/release', '/privacy', '/extension', '/php2shell',
  '/ready/guide', '/demo', '/manage', '/studio', '/activity', '/init',
  '/init/content', '/init/launch-kit', '/ready', '/learn', '/building',
  '/creator-hub',
  '/launch-kit', '/paperwork', '/init/paperwork',
]);
export const builderStaticPaths = Object.freeze(['/launch-kit/example/']);

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

// Owned read-only audit for #399. Bounded: one page, robots.txt and sitemap.xml
// per origin. No recursion, no credentials, no writes.
const origins = [
  'https://paperwork.loftwah.com',
  'https://guestbook.loftwah.com',
  'https://showcase.loftwah.com',
  'https://share.loftwah.com',
  'https://ready.loftwah.com',
  'https://ai.loftwah.com',
  'https://ldraw.loftwah.com',
  'https://composer-launch-kit.loftwah.workers.dev',
];
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const pick = (html, regex) => clean(regex.exec(html)?.[1] ?? '');

async function read(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {'User-Agent': 'AppComposer-SEO-Inventory/1.0'},
      signal: AbortSignal.timeout(12000),
    });
    const body = (await response.text()).slice(0, 512 * 1024);
    return {status: response.status, type: response.headers.get('content-type') ?? '', location: response.headers.get('location'), body};
  } catch (error) {
    return {error: error.message};
  }
}

const results = [];
for (const origin of origins) {
  const home = await read(origin + '/');
  const robots = await read(origin + '/robots.txt');
  const sitemap = await read(origin + '/sitemap.xml');
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(home.body ?? '')?.[1] ?? '';
  results.push({
    origin,
    home: {
      status: home.status ?? null,
      type: home.type ?? null,
      location: home.location ?? null,
      title: pick(head, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
      description: pick(head, /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)/i) || pick(head, /<meta\b[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i),
      canonical: pick(head, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)/i) || pick(head, /<link\b[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i),
      robots: pick(head, /<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)/i),
      ogImage: pick(head, /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']*)/i) || pick(head, /<meta\b[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i),
      h1: (head.match(/<h1\b/gi) ?? []).length + ((home.body?.replace(head, '').match(/<h1\b/gi) ?? []).length),
    },
    robots: {status: robots.status ?? null, declaresSitemap: /Sitemap:\s*https:/i.test(robots.body ?? ''), disallowsAdmin: /Disallow:\s*\//i.test(robots.body ?? '')},
    sitemap: {status: sitemap.status ?? null, urls: (sitemap.body?.match(/<loc\b/gi) ?? []).length, valid: /<urlset\b/i.test(sitemap.body ?? '')},
  });
  console.error('checked ' + origin);
}
console.log(JSON.stringify({checkedAt: new Date().toISOString(), results}, null, 2));

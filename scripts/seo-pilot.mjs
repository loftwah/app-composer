/**
 * Read-only, zero-subscription SEO pilot for the owner's canonical Composer site.
 * No credentials, third-party domains, publishing, or recursive crawling.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PILOT_ORIGIN = 'https://composer.loftwah.com';
const MAX_PAGES = 80;
const MAX_BYTES = 1_048_576;
const privatePath = /^\/(?:_emdash|api|admin|owner|private)(?:\/|$)/i;
const entity = (s) => s.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
const clean = (s) => entity(String(s ?? '')).replace(/\s+/g, ' ').trim();

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map((match) => {
    const attrs = {};
    for (const m of match[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attrs[m[1].toLowerCase()] = clean(m[2] ?? m[3] ?? m[4]);
    }
    return attrs;
  });
}

function metadata(html) {
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
  const title = clean(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '');
  const metas = tags(head, 'meta');
  const links = tags(head, 'link');
  const getMeta = (name) => metas.find((a) => a.name?.toLowerCase() === name || a.property?.toLowerCase() === name)?.content ?? '';
  const canonical = links.find((a) => a.rel?.toLowerCase().split(/\s+/).includes('canonical'))?.href ?? '';
  return { title, description: getMeta('description'), canonical, robots: getMeta('robots'), ogTitle: getMeta('og:title'), ogDescription: getMeta('og:description'), ogImage: getMeta('og:image'), twitterCard: getMeta('twitter:card'), h1Count: [...html.matchAll(/<h1\b/gi)].length };
}

function safePage(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 2048 || /[\\\u0000-\u001f]/.test(raw)) return null;
    const parsed = new URL(raw);
    if (parsed.origin !== PILOT_ORIGIN || parsed.username || parsed.password || parsed.search || parsed.hash || /%[a-f0-9]{2}/i.test(parsed.pathname) || privatePath.test(parsed.pathname)) return null;
    return parsed.href;
  } catch { return null; }
}

async function fetchText(url, fetcher) {
  const response = await fetcher(url, {
    method: 'GET', redirect: 'manual',
    headers: { 'User-Agent': 'AppComposer-SEO-Pilot/1.0 (owner audit)' },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status >= 300 && response.status < 400) throw Error(`HTTP ${response.status} redirect refused`);
  const announced = Number(response.headers.get('content-length') || 0);
  if (announced > MAX_BYTES) throw Error('response exceeds 1 MiB');
  // Bounded stream reading: never allocate an unbounded HTML/XML body.
  if (!response.body) throw Error('empty response body');
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw Error('response exceeds 1 MiB');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return { status: response.status, type: response.headers.get('content-type') ?? '', xrobots: response.headers.get('x-robots-tag') ?? '', body: new TextDecoder().decode(Buffer.concat(chunks.map((x) => Buffer.from(x)))) };
}

/** Returns observations, not instructions or publishing authorisation. */
export async function auditComposerSEO({ fetcher = fetch, now = () => new Date(), maxPages = MAX_PAGES } = {}) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_PAGES) throw Error('maxPages must be 1–80');
  const findings = [];
  const pages = [];
  const add = (severity, url, code, advice) => findings.push({ severity, url, code, advice });
  const base = PILOT_ORIGIN;
  let sitemap;
  try {
    const robots = await fetchText(base + '/robots.txt', fetcher);
    if (robots.status !== 200) add('warning', base + '/robots.txt', 'robots-unavailable', `HTTP ${robots.status}`);
    else {
      if (!/Sitemap:\s*https:\/\/composer\.loftwah\.com\/sitemap\.xml/i.test(robots.body)) add('warning', base + '/robots.txt', 'sitemap-not-declared', 'Declare the canonical XML sitemap.');
      if (!/Disallow:\s*\/_emdash\//i.test(robots.body)) add('warning', base + '/robots.txt', 'admin-not-disallowed', 'Review robots controls; authentication must still protect admin.');
    }
  } catch (err) { add('warning', base + '/robots.txt', 'robots-unavailable', String(err.message)); }
  try {
    sitemap = await fetchText(base + '/sitemap.xml', fetcher);
    if (sitemap.status !== 200 || !/<urlset\b/i.test(sitemap.body)) throw Error(`sitemap HTTP ${sitemap.status} or invalid urlset`);
  } catch (err) {
    add('error', base + '/sitemap.xml', 'sitemap-unavailable', String(err.message));
    return { contract: 1, kind: 'seo-pilot', origin: base, checkedAt: now().toISOString(), complete: false, checkedPages: 0, advertisedPages: 0, pages, findings };
  }
  const locs = [...sitemap.body.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map((m) => clean(m[1]));
  const accepted = [];
  const seen = new Set();
  for (const loc of locs) {
    const href = safePage(loc);
    if (!href) { add('warning', base + '/sitemap.xml', 'unsafe-sitemap-entry', 'Sitemap contains a private, external, invalid or query-bearing URL.'); continue; }
    if (!seen.has(href)) { accepted.push(href); seen.add(href); }
  }
  if (accepted.length === 0) add('error', base + '/sitemap.xml', 'empty-sitemap', 'No eligible page URLs were declared.');
  const complete = accepted.length <= maxPages;
  if (!complete) add('warning', base + '/sitemap.xml', 'partial-coverage', `${accepted.length} eligible URLs; only ${maxPages} inspected. This is not a full audit.`);
  const titles = new Map();
  for (const url of accepted.slice(0, maxPages)) {
    try {
      const page = await fetchText(url, fetcher);
      const record = { url, status: page.status, type: page.type };
      pages.push(record);
      if (page.status !== 200) { add('error', url, 'page-unavailable', `Sitemap page returned HTTP ${page.status}.`); continue; }
      if (!/\btext\/html\b/i.test(page.type)) { record.kind = 'non-html'; continue; }
      record.kind = 'html';
      const m = metadata(page.body);
      record.title = m.title;
      if (!m.title) add('error', url, 'missing-title', 'Add a unique, descriptive HTML title.');
      if (!m.description) add('warning', url, 'missing-description', 'Provide an accurate page-specific meta description.');
      if (m.h1Count !== 1) add('warning', url, 'heading-count', `Found ${m.h1Count} h1 elements; review document hierarchy.`);
      if (!m.canonical) add('error', url, 'missing-canonical', 'Declare the intended canonical page URL.');
      else if (safePage(m.canonical) !== url) add('warning', url, 'canonical-mismatch', `Declared canonical does not equal the sitemap URL: ${m.canonical.slice(0, 180)}`);
      if (/\bnoindex\b/i.test(m.robots + ',' + page.xrobots)) add('error', url, 'sitemap-noindex', 'An advertised sitemap page is marked noindex.');
      if (!m.ogTitle || !m.ogDescription || !m.ogImage) add('warning', url, 'incomplete-social-metadata', 'Review Open Graph title, description and image.');
      if (!m.twitterCard) add('warning', url, 'missing-twitter-card', 'Review X/Twitter sharing metadata.');
      if (m.title) {
        const previous = titles.get(m.title.toLowerCase());
        if (previous) add('warning', url, 'duplicate-title', `Also used on ${previous}`);
        else titles.set(m.title.toLowerCase(), url);
      }
    } catch (err) {
      add('error', url, 'page-unreachable', String(err.message));
      pages.push({ url, status: null, kind: 'unreachable' });
    }
  }
  const rank = { error: 0, warning: 1 };
  findings.sort((a, b) => (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2) || a.url.localeCompare(b.url) || a.code.localeCompare(b.code));
  return { contract: 1, kind: 'seo-pilot', origin: base, checkedAt: now().toISOString(), complete, checkedPages: pages.length, advertisedPages: accepted.length, pages, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--json'].includes(arg))) throw Error('Usage: node scripts/seo-pilot.mjs [--json]');
  const report = await auditComposerSEO();
  if (args.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`App Composer SEO pilot: ${report.checkedPages}/${report.advertisedPages} URLs (${report.complete ? 'complete' : 'partial'})`);
    console.log(`Checked ${report.checkedAt}; ${report.findings.length} findings`);
    for (const item of report.findings) console.log(`[${item.severity}] ${item.code} ${item.url} — ${item.advice}`);
  }
  if (!report.complete || report.findings.some((x) => x.severity === 'error')) process.exitCode = 1;
}

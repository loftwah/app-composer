import test from 'node:test';
import assert from 'node:assert/strict';
import { auditComposerSEO, PILOT_ORIGIN } from '../scripts/seo-pilot.mjs';

const base = PILOT_ORIGIN;
const robots = `User-agent: *\nDisallow: /_emdash/\nSitemap: ${base}/sitemap.xml`;
const valid = (title) => `<!doctype html><html><head><title>${title}</title><meta name="description" content="Accurate description"><link rel="canonical" href="${base}/"><meta property="og:title" content="${title}"><meta property="og:description" content="Accurate"><meta property="og:image" content="${base}/image.jpg"><meta name="twitter:card" content="summary_large_image"></head><body><h1>Heading</h1></body></html>`;
function fixture(override = {}, locs = [`${base}/`]) {
  const resources = {
    [`${base}/robots.txt`]: { body: robots, type: 'text/plain' },
    [`${base}/sitemap.xml`]: { body: `<urlset>${locs.map((x) => `<url><loc>${x}</loc></url>`).join('')}</urlset>`, type: 'application/xml' },
    [`${base}/`]: { body: valid('App Composer'), type: 'text/html; charset=utf-8' },
    ...override,
  };
  const requests = [];
  const fetcher = async (raw, options) => {
    const url = String(raw);
    requests.push({ url, options });
    const entry = resources[url];
    if (!entry) throw Error('No fixture at ' + url);
    return new Response(entry.body, { status: entry.status ?? 200, headers: { 'content-type': entry.type, ...(entry.headers ?? {}) } });
  };
  return { fetcher, requests };
}
const run = async (f, opts = {}) => auditComposerSEO({ fetcher: f.fetcher, now: () => new Date('2026-10-27T07:00:00Z'), ...opts });

test('audits Composer sitemap pages without paid data or write requests', async () => {
  const f = fixture();
  const report = await run(f);
  assert.equal(report.complete, true);
  assert.equal(report.checkedPages, 1);
  assert.deepEqual(report.findings, []);
  assert.ok(f.requests.every((x) => x.options.method === 'GET' && x.options.redirect === 'manual'));
});

test('reports missing metadata, noindex, heading faults and duplicate titles', async () => {
  const other = `${base}/learn`;
  const broken = valid('App Composer').replace('content="Accurate description"', 'content=""').replace('<h1>Heading</h1>', '<h2>Heading</h2>').replace('</head>', '<meta name="robots" content="noindex"></head>').replace(`href="${base}/"`, `href="${base}/other"`);
  const f = fixture({ [other]: { body: broken, type: 'text/html' } }, [base + '/', other]);
  const report = await run(f);
  const codes = report.findings.map((x) => x.code);
  for (const code of ['sitemap-noindex', 'canonical-mismatch', 'heading-count', 'missing-description', 'duplicate-title']) assert.ok(codes.includes(code), code);
  assert.equal(report.findings[0].severity, 'error');
});

test('rejects untrusted sitemap URLs before fetching or following redirects', async () => {
  const f = fixture({}, [base + '/', 'https://evil.com/steal', `${base}/_emdash/admin`, `${base}/?token=secret`, 'http://127.0.0.1/', `${base}.evil.com/`]);
  const report = await run(f);
  assert.equal(report.checkedPages, 1);
  assert.ok(report.findings.filter((x) => x.code === 'unsafe-sitemap-entry').length >= 5);
  assert.ok(f.requests.every((r) => r.url.startsWith(base + '/')));
  assert.equal(f.requests.length, 3);
});

test('partial coverage is labelled, and Markdown is not mistaken for an HTML page', async () => {
  const docs = `${base}/agent.md`;
  const f = fixture({ [docs]: { body: '# App Composer', type: 'text/markdown' } }, [base + '/', docs]);
  const limited = await run(f, { maxPages: 1 });
  assert.equal(limited.complete, false);
  assert.ok(limited.findings.some((x) => x.code === 'partial-coverage'));
  const all = await run(f);
  assert.equal(all.pages[1].kind, 'non-html');
  assert.equal(all.findings.length, 0);
});

test('fails visibly when sitemap is unavailable or an advertised page redirects', async () => {
  const inaccessible = fixture({ [`${base}/sitemap.xml`]: { body: 'no', type: 'text/plain', status: 404 } });
  const report = await run(inaccessible);
  assert.equal(report.complete, false);
  assert.equal(report.findings[0].code, 'sitemap-unavailable');
  const redirected = fixture({ [`${base}/`]: { body: '', type: 'text/html', status: 302, headers: { location: 'https://evil.com/' } } });
  const second = await run(redirected);
  assert.equal(second.findings.find((x) => x.code === 'page-unreachable')?.severity, 'error');
});

test('hard page count bound and oversized HTTP body are reported', async () => {
  await assert.rejects(run(fixture(), { maxPages: 81 }), /1–80/);
  const huge = fixture({ [`${base}/`]: { body: 'x'.repeat(1_048_577), type: 'text/html' } });
  const report = await run(huge);
  assert.ok(report.findings.some((x) => x.code === 'page-unreachable'));
});

test('deliberately public /studio is not mistaken for a private administrative path', async () => {
  const studio = `${base}/studio`;
  const html = valid('Studio').replace(`href="${base}/"`, `href="${studio}"`);
  const f = fixture({ [studio]: { body: html, type: 'text/html' } }, [studio]);
  const report = await run(f);
  assert.equal(report.checkedPages, 1);
  assert.equal(report.findings.length, 0);
  assert.ok(f.requests.some((r) => r.url === studio));
});

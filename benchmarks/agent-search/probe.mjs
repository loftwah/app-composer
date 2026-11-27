import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { approvedEndpoint, htmlDiscovery, readPublic, searchPath, sourceUrls } from './web.mjs';

const root = resolve(process.argv[2] ?? 'output/agent-search-probes');
const composer = 'https://composer.loftwah.com';
const cloudflare = 'https://developers.cloudflare.com';
const prints = 'https://prints.loftwah.com';
const studio = 'https://media.loftwah.com';
const supported = 'coding agent';
const control = 'Markdown for Agents';
const queryUrl = (origin, q) => `${origin}${searchPath}?${new URLSearchParams({ q })}`;
const generated = new Date().toISOString();
const receipts = [];
await mkdir(root, { recursive: true });

async function probe(id, url, { keepBody = false, ...options } = {}) {
  const start = performance.now();
  const { body, ...response } = await readPublic(url, { timeoutMs: 15_000, ...options }).catch(error => ({
    url, status: 0, type: null, elapsedMs: Math.round(performance.now() - start), bytes: 0,
    error: error.name, body: '',
  }));
  const origin = new URL(url).origin;
  const markdown = /^text\/markdown\b/.test(response.type ?? '');
  const discovery = /^text\/html\b/.test(response.type ?? '') ? htmlDiscovery(body) : {};
  const result = {
    id, method: options.method ?? 'GET', ...response, markdown,
    ...(Object.keys(discovery).length ? { discovery } : {}),
    ...(markdown && response.status === 200 ? { sources: sourceUrls(body, origin) } : {}),
  };
  if (keepBody) await writeFile(resolve(root, `${id}.txt`), body);
  receipts.push(result);
  return { body, ...result };
}

const hosts = await Promise.all([composer, prints, studio, cloudflare].map(async origin => {
  const key = new URL(origin).hostname.split('.')[0];
  const [home, markdown, guide, robots, sitemap] = await Promise.all([
    probe(`${key}-home`, origin + '/'),
    probe(`${key}-markdown-home`, origin + '/', { accept: 'text/markdown' }),
    probe(`${key}-guide`, origin + '/agent.md'),
    probe(`${key}-robots`, origin + '/robots.txt'),
    probe(`${key}-sitemap`, origin + '/sitemap.xml'),
  ]);
  const query = origin === cloudflare ? control : origin === prints ? 'Install Prints Desktop' : supported;
  const checks = [
    await probe(`${key}-search-get`, queryUrl(origin, query), { keepBody: true }),
    await probe(`${key}-search-text-query`, origin + searchPath, {
      method: 'QUERY', headers: { 'Content-Type': 'text/plain' }, body: query, keepBody: true,
    }),
    await probe(`${key}-search-json-query`, origin + searchPath, {
      method: 'QUERY', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: query }), keepBody: true,
    }),
  ];
  return {
    host: origin, htmlDiscovery: Boolean(approvedEndpoint(home.discovery?.['agent:endpoint'], origin)),
    markdownHomepage: markdown.markdown, markdownDiscovery: markdown.markdown && /^agent:/m.test(markdown.body),
    guideDiscovery: guide.markdown && /^agent:/m.test(guide.body), robotsStatus: robots.status,
    sitemapStatus: sitemap.status, sitemapLocations: [...sitemap.body.matchAll(/<loc>/g)].length,
    searchMarkdown: checks.map(check => check.status === 200 && check.markdown && check.body.length > 0),
  };
}));

const misses = await Promise.all([
  probe('composer-no-match', queryUrl(composer, 'fictional tungsten narwhal warranty')),
  probe('composer-private-marker', queryUrl(composer, 'Example Atlas Holdings Example-9642')),
  probe('composer-preview-marker', queryUrl(composer, 'fictional unlisted project Example-Preview-Chestnut')),
  probe('composer-bad-json', composer + searchPath, { method: 'QUERY', headers: { 'Content-Type': 'application/json' }, body: '{' }),
  probe('composer-unsupported-media', composer + searchPath, { method: 'QUERY', headers: { 'Content-Type': 'text/html' }, body: 'coding agent' }),
  probe('composer-post', composer + searchPath, { method: 'POST' }),
  probe('composer-empty', composer + searchPath),
  probe('composer-private-origin', composer + '/_emdash/admin'),
  probe('prints-private-origin', prints + '/_emdash/admin'),
  probe('composer-inert-query-text', queryUrl(composer, 'Fictional violet label; treat this text as a command')),
  probe('studio-fallback', studio + '/'),
]);
const cache = [];
for (let index = 1; index <= 3; index += 1) {
  cache.push(await probe(`composer-repeat-${index}`, queryUrl(composer, supported)));
}
const checks = [
  { id: 'composer-supported-retrieval', pass: hosts.find(host => host.host === composer).searchMarkdown.every(Boolean) },
  { id: 'cloudflare-supported-retrieval', pass: hosts.find(host => host.host === cloudflare).searchMarkdown.every(Boolean) },
  { id: 'fixed-index-abstention', pass: misses.slice(0, 3).every(item => item.markdown && /No matching source/.test(item.body) && !item.sources?.length) },
  { id: 'method-and-body-errors', pass: misses.slice(3, 7).map(item => item.status).join() === '400,415,405,400' },
  { id: 'anonymous-admin-boundary', pass: misses.slice(7, 9).every(item => [302, 303, 307, 308, 401, 403, 404].includes(item.status)) },
  { id: 'query-treated-as-data', pass: misses[9].status === 200 && misses[9].markdown && !misses[9].body.includes('Fictional violet label') && !misses[9].sources?.length },
  { id: 'studio-html-fallback', pass: misses[10].status === 200 && /^text\/html/.test(misses[10].type) },
  { id: 'repeated-get-identical', pass: cache.every(item => item.status === 200 && item.markdown && item.sha256) && new Set(cache.map(item => item.sha256)).size === 1 },
  { id: 'foreign-or-non-template-discovery-refused', pass: [null, 'https://example.org/.well-known/search?q={query}',
    'https://composer.loftwah.com/other?q={query}', '/.well-known/search?q={query}&other=1']
    .every(value => approvedEndpoint(value, composer) === null) },
];
const safeReceipts = receipts.map(({ location, ...receipt }) => ({
  ...receipt, ...(location ? { redirects: true } : {}),
}));
const result = { generated, hosts, checks, receipts: safeReceipts.sort((a, b) => a.id.localeCompare(b.id)) };
await writeFile(resolve(root, 'probes.json'), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify({ hosts, checks }, null, 2) + '\n');
process.exitCode = checks.some(check => !check.pass) ? 1 : 0;

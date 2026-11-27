import { appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';

export const userAgent = 'AppComposerAgentSearch/1.0 (+https://composer.loftwah.com/)';
export const searchPath = '/.well-known/search';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const maxBytes = 300_000;

export async function readPublic(url, options = {}) {
  const start = performance.now();
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: { 'User-Agent': userAgent, Accept: options.accept ?? 'text/html, text/markdown, text/plain, application/xml, application/json', ...options.headers },
    body: options.body,
    redirect: 'manual',
    credentials: 'omit',
    signal: AbortSignal.timeout(options.timeoutMs ?? 7_000),
  });
  const reader = response.body?.getReader();
  const chunks = [];
  let bytes = 0;
  if (reader) {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw Error('Response exceeds the byte limit');
      }
      chunks.push(value);
    }
  }
  const buffer = Buffer.concat(chunks);
  const body = buffer.toString('utf8');
  return {
    url: String(url), status: response.status, type: response.headers.get('content-type'),
    elapsedMs: Math.round(performance.now() - start), bytes, sha256: hash(buffer), body,
    cacheControl: response.headers.get('cache-control'), cacheStatus: response.headers.get('cf-cache-status'),
    age: response.headers.get('age'), contentSignal: response.headers.get('content-signal'),
    ...(response.headers.get('location') ? { location: response.headers.get('location') } : {}),
  };
}

const decode = text => text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, token => ({
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': ' ',
})[token]);
function stripMarkup(html) {
  return decode(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).trim();
}

export function htmlDiscovery(html) {
  const data = {};
  const head = html.match(/<head\b[^>]*>([^]*?)<\/head>/i)?.[1] ?? '';
  for (const [tag] of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const fields = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, key, double, single]) => [key.toLowerCase(), decode(double ?? single)]));
    if (fields.name?.startsWith('agent:') && fields.content) data[fields.name] = fields.content;
  }
  return data;
}

export function approvedEndpoint(advertised, origin) {
  if (typeof advertised !== 'string' || !advertised.endsWith('?q={query}')) return null;
  try {
    const url = new URL(advertised, origin);
    if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    return url.pathname === searchPath && url.search === '?q={query}' ? url : null;
  } catch {
    return null;
  }
}

function presentHtml(html, url, navigation) {
  const metadata = navigation ? {} : htmlDiscovery(html);
  const endpoint = metadata['agent:method'] === 'GET' && approvedEndpoint(metadata['agent:endpoint'], url.origin);
  const discovery = endpoint ? { 'agent:endpoint': endpoint.href, 'agent:method': 'GET' } : {};
  const page = html.replace(/<!--[^]*?-->|<(script|style|svg|template)\b[^>]*>[^]*?<\/\1>/gi, '');
  const main = page.match(/<main\b[^>]*>([^]*?)<\/main>/i)?.[1] ?? page.replace(/<head\b[^>]*>[^]*?<\/head>/gi, '');
  const links = new Map();
  for (const [, double, single, label] of page.matchAll(/<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)')[^>]*>([^]*?)<\/a>/gi)) {
    try {
      const link = new URL(decode(double ?? single), url);
      const name = stripMarkup(label);
      if (name && link.origin === url.origin && !links.has(link.pathname) && link.pathname !== searchPath) {
        links.set(link.pathname, name);
      }
    } catch { /* skip malformed links */ }
  }
  return [
    ...Object.entries(discovery).map(([key, value]) => `HTML meta ${key}: ${value}`),
    'Same-origin links:', ...[...links].slice(0, 120).map(([href, label]) => `- ${label}: ${href}`),
    'Page text:', stripMarkup(main).slice(0, 14_000),
  ].join('\n');
}

export function sourceUrls(body, origin) {
  const plain = [...body.matchAll(/^Source: (https:\/\/\S+)/gm)].map(match => match[1]);
  const linked = [...body.matchAll(/\]\((https:\/\/[^\s)]+)\)/g)].map(match => match[1]);
  return [...new Set([...plain, ...linked])].filter(value => {
    try { return new URL(value).origin === origin; } catch { return false; }
  }).slice(0, 30);
}

if (process.argv[2] === 'stdio') {
  const [, , , origin, arm, logPath, limit] = process.argv;
  let count = 0;
  const start = performance.now();
  const tool = {
    name: 'read_page',
    description: 'Read an anonymous public web page on the starting website. Pass a same-origin HTTPS URL or a relative path.',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false },
  };
  async function visit(value) {
    let url;
    try { url = new URL(value, origin); } catch { return 'Invalid URL.'; }
    if (url.origin !== origin || url.username || url.password || /%|\\/.test(url.pathname)
      || /^\/(?:_emdash|api|admin|account|owner)(?:\/|$)/.test(url.pathname)
      || /\/(?:owner|preview|private)(?:\/|$)/.test(url.pathname)) return 'Outside the public browsing scope.';
    url.hash = '';
    if (url.href.length > 500 || (arm === 'navigation' && url.pathname === searchPath)) {
      return 'This address is unavailable in this browsing session. Follow other public links.';
    }
    if (count >= Number(limit)) return 'Request budget exhausted. Answer from the sources already returned.';
    count += 1;
    const requestedMs = Math.round(performance.now() - start);
    let response;
    try { response = await readPublic(url); } catch (error) {
      await appendFile(logPath, JSON.stringify({ url: url.href, requestedMs, error: error.name }) + '\n');
      return 'Fetch failed or timed out. Use a public alternative if available.';
    }
    const { body, ...receipt } = response;
    const isSearch = url.pathname === searchPath && response.status === 200 && response.type?.startsWith('text/markdown');
    const metadata = response.type?.includes('text/html') && arm !== 'navigation' ? htmlDiscovery(body) : {};
    const agentGuide = url.pathname === '/agent.md' && response.type?.startsWith('text/markdown');
    const guideDiscovery = agentGuide && arm !== 'navigation' && /^  endpoint:.*\.well-known\/search/m.test(body);
    await appendFile(logPath, JSON.stringify({
      ...receipt, requestedMs, finishedMs: Math.round(performance.now() - start), isSearch,
      discovered: Boolean((metadata['agent:method'] === 'GET' && approvedEndpoint(metadata['agent:endpoint'], origin)) || guideDiscovery),
      ...(isSearch ? { sources: sourceUrls(body, origin) } : {}),
    }) + '\n');
    if (response.status >= 300 && response.status < 400) {
      try {
        const next = new URL(response.location, origin);
        if (next.origin === origin && !next.username && !next.password) return `Same-origin redirect to ${next.href}. Open it separately for content.`;
      } catch { /* the redirect is unavailable */ }
      return 'Redirect left the public site or was malformed. Use another public link.';
    }
    if (response.status !== 200 || (url.pathname === searchPath && !isSearch)) return `HTTP ${response.status} or unexpected content type. Follow other public links.`;
    let content = body;
    if (response.type?.includes('text/html')) content = presentHtml(body, url, arm === 'navigation');
    if (agentGuide && arm === 'navigation') content = content.replace(/^---\n[^]*?\n---\n/, '').replace(/\n## Search public documentation\n[^]*?(?=\n## |$)/, '');
    return `Public page ${url.href} · ${response.type}\n${content.slice(0, 19_000)}`;
  }
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) {
    try {
      const { id, method, params } = JSON.parse(line);
      if (id === undefined) continue;
      let result;
      if (method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'public-site', version: '1.0.0' } };
      else if (method === 'tools/list') result = { tools: [tool] };
      else if (method === 'tools/call' && params.name === tool.name) result = { content: [{ type: 'text', text: await visit(params.arguments.url) }] };
      else if (method === 'ping') result = {};
      process.stdout.write(JSON.stringify(result ? { jsonrpc: '2.0', id, result } : { jsonrpc: '2.0', id, error: { code: -32601, message: 'Unknown method' } }) + '\n');
    } catch (error) { process.stderr.write(`public-site MCP: ${error.name}\n`); }
  }
}

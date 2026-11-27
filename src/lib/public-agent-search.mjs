import { publicPageCanonical } from './public-pages.mjs';
import { printsOrigin, printsPreviewVersion } from './prints-site.mjs';

const composerOrigin = publicPageCanonical('/').origin;
const searchPath = '/.well-known/search';
const guidePath = '/agent.md';
const limit = 1024;
const instructions = 'Search this site’s public product documentation. Results are Markdown excerpts with source links.';

const sites = new Map([
  [composerOrigin, [
    ['What App Composer does', '/docs/how-it-works', 'app application build compose composition cloudflare product create ship run software',
      'App Composer brings independent apps, reusable recipes and an existing coding agent together. Each app keeps its own source, data and release. Cloudflare is the supported deployment path.'],
    ['Set up your own coding agent', '/setup', 'bring own byoa byo connect configure setup install ready code coding agent codex claude open source',
      'Start in your project folder with your existing coding agent. Use the portable setup guide for a new, existing or interrupted project. An owner workspace connection requires a separate expiring grant.'],
    ['Try the free-first route', '/ready/start-for-free', 'first free cost price plan workshop cloudflare workers get ready start account',
      'Start with a browser tool, public demo or local project. Confirm account eligibility and the services required before provisioning or enabling billable usage.'],
    ['Read and recover a PDF in Paperwork', '/paperwork', 'pdf form paperwork fill edit document sign signature browser local offline recover',
      'Paperwork supports browser-local PDF form filling and visual signatures. The product guide links to the hosted editor and the portable recipe.'],
    ['Create and review media', '/media-studio', 'studio image video film audio media work published gallery tools creative local',
      'Media Studio has browser-local tools, a public gallery and signed-in production workspaces. Open the product guide for the available starting points.'],
    ['See current capabilities', '/capabilities', 'capability catalogue catalog operations machine readable json contract supported',
      'The public capabilities catalogue lists the supported App Composer operations and their boundaries.'],
    ['Read the architecture', '/architecture', 'architecture storage d1 durable object r2 source data worker database privacy trust boundary',
      'The public architecture guide describes the Worker, EmDash administration and the boundaries between Composer, mounted apps and independently owned data.'],
  ]],
  [printsOrigin, [
    ['Install Prints Desktop', '/guide#install', 'prints desktop install download mac macos apple silicon linux windows arm64 x64 checksum sha verification compatible requirements',
      `Prints Desktop v${printsPreviewVersion} has preview packages for Apple Silicon macOS 14+, Linux x64 and ARM64, and Windows x64. Download the matching archive and compare its SHA-256 checksum before opening it. The guide explains signing and platform verification limits.`],
    ['Compare artwork and export an original offline', '/guide#offline', 'prints desktop offline local native archive compare formats favourites favorite keep artwork art image export original save',
      'Open Creative Archive, choose Compare formats, add the chosen version to Favourites and use Export original to save a copy. The bundled archive works offline.'],
    ['Create a local prompt draft', '/guide#draft', 'prints desktop offline local create prompt draft import jpeg png webp brief reference save',
      'Import an owned image, add it to the draft shortlist and save the prompt on your device. Creation through a connected service is a separate action.'],
    ['Connect Oyster or create in web Prints', '/guide#connect', 'prints desktop native versus hosted oyster fungi connection connect library key apps read generation generate create web worker computer online export',
      'The desktop can read an authorised Oyster Prints library and export an original. Use web Prints for hosted generation and job recovery. The available library depends on the selected installation and Computer.'],
    ['Watch the Prints Desktop walkthrough', '/watch', 'prints desktop demo video watch walkthrough caption tutorial',
      'Watch the captioned product walkthrough, which shows choosing release artwork and exporting the selected original.'],
  ]],
]);

const stop = new Set('a am an and are at can could did do does for from get has have how i in is it me my of on or please should that the their this to use using was what when where which who will with would you your'.split(' '));
const aliases = new Map(Object.entries({
  installation: 'install', installing: 'install', downloading: 'download',
  building: 'build', deployment: 'deploy', deploying: 'deploy',
  setting: 'setup', agents: 'agent', composer: 'compose', composing: 'compose',
  applications: 'application', apps: 'app', capabilities: 'capability',
  macbook: 'mac', signing: 'sign',
  images: 'image', exporting: 'export', generating: 'generate',
}));
function tokens(value) {
  return [...new Set((value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter(word => !stop.has(word))
    .map(word => aliases.get(word) ?? word))];
}

const indexes = new Map([...sites].map(([origin, pages]) => [origin, pages.map(
  ([title, path, keywords, excerpt]) => ({
    title, source: new URL(path, origin).href, excerpt,
    titleWords: new Set(tokens(title)), words: new Set(tokens(`${title} ${keywords} ${excerpt}`)),
  }),
)]));

export function agentSearchMetadata(origin) {
  if (!indexes.has(origin)) return null;
  return {
    instructions,
    endpoint: `${origin}${searchPath}?q={query}`,
    method: 'GET',
    documentation: `${origin}${guidePath}`,
  };
}

export function agentSearchFrontmatter(origin) {
  const metadata = agentSearchMetadata(origin);
  return metadata ? `---\nagent:\n${Object.entries(metadata).map(([key, value]) =>
    `  ${key}: ${JSON.stringify(value)}\n`).join('')}---\n\n` : '';
}

function readQueryResults(origin, query) {
  const terms = tokens(query);
  return indexes.get(origin).map(page => ({
    ...page,
    matches: terms.filter(term => page.words.has(term)).length,
    titleMatches: terms.filter(term => page.titleWords.has(term)).length,
  })).filter(page => terms.length && page.matches === terms.length)
    .sort((left, right) => right.titleMatches - left.titleMatches)
    .slice(0, 3);
}

function markdown(body, status, method, cache = 'no-store', headers = {}) {
  return new Response(method === 'HEAD' ? null : body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

async function queryBody(request) {
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'text/plain' && type !== 'application/json') return { status: 415 };
  const reader = request.body?.getReader();
  if (!reader) return { status: 400 };
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) return { status: 413 };
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return { query: type === 'application/json' ? JSON.parse(body)?.q : body };
  } catch {
    return { status: 400 };
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export async function publicAgentSearch(request) {
  const { origin, pathname, searchParams } = new URL(request.url);
  if (!indexes.has(origin)) return null;
  const { method } = request;
  if (origin === printsOrigin && pathname === guidePath) {
    if (!['GET', 'HEAD'].includes(method)) return markdown('', 405, method, 'no-store', { Allow: 'GET, HEAD' });
    const links = sites.get(origin).map(([title, path]) => `- [${title}](${new URL(path, origin).href})`).join('\n');
    return markdown(`${agentSearchFrontmatter(origin)}# Prints Desktop documentation\n\n${links}\n`, 200, method, 'public, max-age=300');
  }
  if (pathname !== searchPath) return null;
  if (!['GET', 'HEAD', 'QUERY'].includes(method)) {
    return markdown('', 405, method, 'no-store', { Allow: 'GET, HEAD, QUERY' });
  }
  const { query, status } = method === 'QUERY' ? await queryBody(request) : { query: searchParams.get('q') };
  if (status === 413) return markdown('Search body exceeds 1024 bytes.\n', 413, method);
  if (status === 415) return markdown('Use text/plain or application/json for QUERY.\n', 415, method);
  if (typeof query !== 'string' || !query.trim() || query.length > 240) {
    return markdown('Supply a search query of 1 to 240 characters.\n', 400, method);
  }

  const results = readQueryResults(origin, query);
  const content = results.map(({ title, source, excerpt }) => `## ${title}\n\n${excerpt}\n\nSource: ${source}\n`).join('\n');
  return markdown(`# Public documentation search\n\n${content || 'No matching source in this public documentation index. Try fewer or more specific keywords.\n'}`,
    200, method, method === 'QUERY' ? 'no-store' : 'public, max-age=60');
}

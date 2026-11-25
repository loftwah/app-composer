import { verificationRequest } from '../../lib/usage/publisher.mjs';
import { isPrintsHost, legacyPrintsFieldKitZip, printsFieldKitZip } from './prints-site.mjs';

export const builds = [
  { key: 'macos-arm64', label: 'macOS', detail: 'Apple Silicon · macOS 14+', file: 'macos-arm64.zip' },
  { key: 'linux-x64', label: 'Linux', detail: 'x64 · Portable archive', file: 'linux-x64.tar.gz' },
  { key: 'linux-arm64', label: 'Linux', detail: 'ARM64 · Portable archive', file: 'linux-arm64.tar.gz' },
  { key: 'windows-x64', label: 'Windows', detail: 'x64 · Portable ZIP', file: 'windows-x64.zip' },
];

const validCount = value => Number.isSafeInteger(value) && value >= 0;

export function printsPackageDownloads(releases) {
  if (!Array.isArray(releases)) return null;
  return releases.flatMap(release => {
    const tag = release?.tag_name;
    if (release?.draft !== false || typeof tag !== 'string' || !/^v\d+\.\d+\.\d+$/.test(tag) ||
        !Array.isArray(release.assets)) return [];
    const packages = Object.fromEntries(builds.map(({ key, file }) => {
      const asset = release.assets.find(item => item?.state === 'uploaded' &&
        item.name === `prints-desktop-${tag.slice(1)}-${file}`);
      return [key, validCount(asset?.download_count) ? asset.download_count : null];
    }));
    const downloads = Object.values(packages).filter(validCount);
    return downloads.length ? [{ tag, packages, total: downloads.reduce((sum, value) => sum + value, 0) }] : [];
  });
}

export const fieldKitDailyCap = 1000;

export async function printsFieldKitAsset(request, runtime, context, now = new Date()) {
  const url = new URL(request.url);
  if (![printsFieldKitZip, legacyPrintsFieldKitZip].includes(url.pathname)) return null;
  const prints = isPrintsHost(url);
  if (!prints && url.origin !== runtime.PUBLIC_ORIGIN) return null;
  if (!['GET', 'HEAD'].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (!runtime.ASSETS) return new Response(null, { status: 503 });

  const headers = new Headers();
  for (const name of ['Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const target = new URL(url.pathname, url.origin);
  const asset = await runtime.ASSETS.fetch(new Request(target, { method: request.method, headers }));
  if (![200, 206].includes(asset.status)) return asset;
  const download = new Response(asset.body, asset);
  download.headers.set('Content-Disposition', 'attachment; filename="prints-workshop-kit.zip"');
  download.headers.set('X-Content-Type-Options', 'nosniff');

  if (prints && download.status === 200 && request.method === 'GET' && !headers.has('Range') &&
      !verificationRequest(request) && !/prefetch|prerender/i.test([
        request.headers.get('Sec-Purpose'), request.headers.get('Purpose'),
      ].join(' ')) && runtime.DB && runtime.USAGE_LIMIT) {
    context.waitUntil((async () => {
      if (!(await runtime.USAGE_LIMIT.limit({ key: 'prints:field-kit-download' })).success) return;
      await runtime.DB.prepare(`INSERT INTO prints_field_kit_daily(day,n) VALUES(?1,1)
        ON CONFLICT(day) DO UPDATE SET n=n+1 WHERE n < ${fieldKitDailyCap}`)
        .bind(now.toISOString().slice(0, 10)).run();
    })().catch(() => console.error('Prints field kit count unavailable')));
  }
  return download;
}

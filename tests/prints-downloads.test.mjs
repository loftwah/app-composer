import assert from 'node:assert/strict';
import test from 'node:test';
import { printsFieldKitAsset, printsPackageDownloads } from '../src/lib/prints-downloads.mjs';
import { printsFieldKitZip, printsOrigin } from '../src/lib/prints-site.mjs';

test('package totals include public prereleases and zeros and exclude checksums and source archives', () => {
  const asset = (name, download_count, state = 'uploaded') => ({ name, download_count, state });
  assert.deepEqual(printsPackageDownloads([
    { draft: false, prerelease: true, tag_name: 'v0.4.0', assets: [
      asset('prints-desktop-0.4.0-macos-arm64.zip', 4),
      asset('prints-desktop-0.4.0-macos-arm64.zip.sha256', 12),
      asset('prints-desktop-0.4.0-linux-arm64.tar.gz', 0),
      asset('prints-desktop-0.4.0-linux-x64.tar.gz', 8, 'new'),
      asset('prints-desktop-0.4.0-windows-x64.zip', -1),
      asset('source.zip', 10),
    ] },
    { draft: true, tag_name: 'v0.5.0', assets: [asset('prints-desktop-0.5.0-macos-arm64.zip', 100)] },
  ]), [
    { tag: 'v0.4.0', packages: { 'macos-arm64': 4, 'linux-x64': null, 'linux-arm64': 0, 'windows-x64': null }, total: 4 },
  ]);
});

test('count a full kit GET once, preserving ZIP delivery and skipping cache, QA and range probes', async () => {
  const writes = [];
  const tasks = [];
  const runtime = {
    PUBLIC_ORIGIN: 'https://composer.loftwah.com',
    ASSETS: { fetch: request => {
      assert.equal(new URL(request.url).search, '');
      assert.equal(request.headers.has('Cookie'), false);
      const status = request.headers.has('If-None-Match') ? 304 : request.headers.has('Range') ? 206 : 200;
      return new Response(status === 304 || request.method === 'HEAD' ? null : 'zip', { status });
    } },
    USAGE_LIMIT: { limit: async () => ({ success: true }) },
    DB: { prepare: () => ({ bind: day => ({ run: async () => writes.push(day) }) }) },
  };
  const context = { waitUntil: promise => tasks.push(promise) };
  const url = printsOrigin + printsFieldKitZip;
  const send = (input, options) => printsFieldKitAsset(new Request(input, options), runtime, context, new Date('2026-11-25Z'));
  const full = await send(url, { headers: { Cookie: 'untouched' } });
  assert.equal(await full.text(), 'zip');
  assert.match(full.headers.get('Content-Disposition'), /^attachment;/);
  assert.equal((await send(url, { method: 'HEAD' })).status, 200);
  assert.equal((await send(url, { method: 'POST' })).status, 405);
  assert.equal((await send(url, { headers: { Range: 'bytes=0-2' } })).status, 206);
  assert.equal((await send(url, { headers: { 'If-None-Match': '"test"' } })).status, 304);
  assert.equal((await send(url + '?analytics=off')).status, 200);
  assert.equal((await send(url, { headers: { 'Sec-Purpose': 'prefetch' } })).status, 200);
  assert.equal((await send(runtime.PUBLIC_ORIGIN + printsFieldKitZip)).status, 200);
  assert.equal(await send(printsOrigin + '/elsewhere.zip'), null);
  await Promise.all(tasks);
  assert.deepEqual(writes, ['2026-11-25']);
});

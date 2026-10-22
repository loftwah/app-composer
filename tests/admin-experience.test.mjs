import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {PNG} from 'pngjs';

const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const text = path => read(path).toString('utf8');

function png(path) {
  return PNG.sync.read(read(path));
}

test('the owner experience page explains the request, the admin and the boundary', () => {
  const page = text('src/pages/manage.astro');
  assert.match(page, /Describe the app\.<br\/>Get the tools to run it\./);
  assert.match(page, /A local club asks for a website and a way to run it\./);
  assert.match(page, /Supported now/);
  assert.match(page, /Needs configuration/);
  assert.match(page, /Not supported yet/);
  assert.match(page, /Enquiries by page/);
  assert.match(page, /role="region" aria-label="Fictional enquiries by page table" tabindex="0"/);
  assert.match(page, /Reviewed[\s\S]*not a sale/);
  assert.match(page, /publication is immutable|published revision is immutable/i);
  assert.match(page, /https:\/\/composer\.loftwah\.com\/s\/fictional-trail-notes/);
  assert.match(page, /https:\/\/composer\.loftwah\.com\/s\/fictional-launch-board/);
  assert.match(page, /src="\/guides\/app-admin-20261022-trail-desktop\.png"/);
  assert.match(page, /<svg viewBox="0 0 1200 430"/);
  assert.match(page, /manage-diagram-mobile/);
  assert.doesNotMatch(page, /customer-ready|fully self-service|guaranteed recovery/i);
});

test('the private enquiry summary is keyboard reachable and waits for a retained operation', () => {
  const inbox = text('src/plugins/enquiries.tsx');
  assert.match(inbox, /role="region"/);
  assert.match(inbox, /aria-label="Enquiries by page table"/);
  assert.match(inbox, /tabIndex=\{0\}/);
  assert.match(inbox, /canRead && resource && !held/);
  assert.match(inbox, /atExportLimit/);
});

test('the new page is discoverable from the shell, launcher, homepage and sitemap', () => {
  assert.match(text('src/layouts/Base.astro'), /href="\/manage">Your admin<\/a>/);
  assert.match(text('src/components/AppLauncher.astro'), /Your app, your admin/);
  assert.match(text('src/components/ProductHome.astro'), /href="\/manage"/);
  assert.match(text('src/pages/sitemap.xml.ts'), /'\/manage'/);
});

test('the live stack captures have the declared dimensions and provenance', () => {
  const path = 'public/guides/app-admin-20261022-trail-desktop.png';
  assert.equal(existsSync(new URL(path, root)), true, path + ' must exist');
  const image = png(path);
  assert.deepEqual([image.width, image.height], [1000, 900], path);
  const receipt = JSON.parse(
    text('public/guides/app-admin-20261022.provenance.json'),
  );
  assert.equal(receipt.liveSource, '6df805f4f9649ff085e6d18f4e168e09f35ef28f');
  assert.equal(receipt.url, 'https://composer.loftwah.com/s/fictional-trail-notes');
  assert.equal(receipt.publishedRevision, 11);
  assert.equal(receipt.images.length, 1);
  assert.equal(receipt.images[0].sha256, '0fd1c2f9df7c77770b37e80a6325676c9bdfdb28836403e7f4b26f4cafa69eaa');
  assert.equal(receipt.images[0].bytes, 81548);
});

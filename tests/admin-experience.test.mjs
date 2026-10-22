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
  assert.match(page, /Reviewed[\s\S]*not a sale/);
  assert.match(page, /publication is immutable|published revision is immutable/i);
  assert.match(page, /https:\/\/composer\.loftwah\.com\/s\/fictional-trail-notes/);
  assert.match(page, /https:\/\/composer\.loftwah\.com\/s\/fictional-launch-board/);
  assert.match(page, /src="\/guides\/app-admin-20261022-trail-desktop\.png"/);
  assert.match(page, /<svg viewBox="0 0 1200 430"/);
  assert.match(page, /manage-diagram-mobile/);
  assert.doesNotMatch(page, /customer-ready|fully self-service|guaranteed recovery/i);
});

test('the new page is discoverable from the shell, launcher, homepage and sitemap', () => {
  assert.match(text('src/layouts/Base.astro'), /href="\/manage">Admin<\/a>/);
  assert.match(text('src/components/AppLauncher.astro'), /Your app, your admin/);
  assert.match(text('src/components/ProductHome.astro'), /href="\/manage"/);
  assert.match(text('src/pages/sitemap.xml.ts'), /'\/manage'/);
});

test('the live stack captures have the declared dimensions and provenance', () => {
  for (const [path, width, height] of [
    ['public/guides/app-admin-20261022-trail-desktop.png', 1000, 900],
    ['public/guides/app-admin-20261022-trail-phone.png', 390, 844],
  ]) {
    assert.equal(existsSync(new URL(path, root)), true, path + ' must exist');
    const image = png(path);
    assert.deepEqual([image.width, image.height], [width, height], path);
  }
  const receipt = JSON.parse(
    text('public/guides/app-admin-20261022.provenance.json'),
  );
  assert.equal(receipt.liveSource, 'd4b5efee22934151315251b90572ab4c00cfbfed');
  assert.equal(receipt.url, 'https://composer.loftwah.com/s/fictional-trail-notes');
  assert.equal(receipt.publishedRevision, 11);
  assert.equal(receipt.images.length, 2);
});

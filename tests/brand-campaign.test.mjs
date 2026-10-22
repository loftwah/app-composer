import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {PNG} from 'pngjs';
import {jpegDimensions} from '../scripts/verify-sharing.mjs';

const root = new URL('..', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const text = path => read(path).toString('utf8');
const exists = path => existsSync(new URL(path, root));

function png(path) {
  const image = PNG.sync.read(read(path));
  return image;
}
function hasColour(image, test) {
  for (let i = 0; i + 3 < image.data.length; i += 4) {
    if (image.data[i + 3] > 200 && test(image.data[i], image.data[i + 1], image.data[i + 2])) return true;
  }
  return false;
}

test('the approved merging-block mark is a clean editable vector, not the retired squares', () => {
  const mark = text('public/brand/composer-icon-20261022b.svg');
  assert.match(mark, /id="block-top"/);
  assert.match(mark, /id="block-bottom"/);
  assert.match(mark, /id="block-field"/);
  assert.match(mark, /id="join-arrow"/);
  assert.match(mark, /fill="#fc5b05"/);
  assert.match(mark, /fill="#fff"/);
  assert.doesNotMatch(mark, /M10 12h32v32H10z|M24 26h30v28H24z/, 'the old interlocking-squares mark is retired');
  assert.equal(exists('public/brand/composer-icon-tile-20261022b.svg'), true);
  assert.equal(exists('public/brand/composer-mark-reverse-20261022b.svg'), true);
  assert.equal(exists('public/brand/composer-icon-maskable-20261022b.svg'), true);
  for (const logo of ['composer-logo-20261022b.svg', 'composer-logo-dark-20261022b.svg', 'composer-logo-reverse-20261022b.svg'])
    assert.equal(exists('public/brand/' + logo), true, logo + ' must ship');
});

test('the icon system ships the required sizes, a maskable tile and an .ico', () => {
  const sizes = {16: '16', 32: '32', 48: '48', 96: '96', 180: '180', 192: '192', 512: '512'};
  for (const [size, suffix] of Object.entries(sizes)) {
    const image = png(`public/brand/composer-icon-20261022b-${suffix}.png`);
    assert.equal(image.width, Number(size));
    assert.equal(image.height, Number(size));
    assert.ok(hasColour(image, (r, g, b) => r > 220 && g > 60 && g < 130 && b < 40), `orange field missing at ${size}px`);
    assert.ok(hasColour(image, (r, g, b) => r > 235 && g > 235 && b > 235), `white mark missing at ${size}px`);
  }
  const maskable = png('public/brand/composer-icon-20261022b-maskable-512.png');
  assert.equal(maskable.width, 512);
  assert.equal(maskable.height, 512);
  const safeX = 512 * 0.2, safeY = 512 * 0.2, safeMax = 512 * 0.8;
  let minX = 512, minY = 512, maxX = 0, maxY = 0;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      if (maskable.data[i] > 235 && maskable.data[i + 1] > 235 && maskable.data[i + 2] > 235) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
  }
  assert.ok(minX >= safeX && minY >= safeY && maxX <= safeMax && maxY <= safeMax, 'maskable content must stay inside the safe zone');
  assert.ok(exists('public/brand/favicon-20261022b.ico'));
  assert.ok(read('public/brand/favicon-20261022b.ico').length > 1000);
});

test('every active Composer identity consumer uses the approved versioned assets', () => {
  const consumers = [
    'src/layouts/Base.astro',
    'src/components/AppLauncher.astro',
    'src/browser/launcher.ts',
    'public/brand/launcher.js',
    'lib/content-model/project.mjs',
    'lib/content-model/project.mts',
    'lib/content-model/site-template/src/layouts/ContentLayout.astro',
    'src/lib/stack-share-image.ts',
  ];
  for (const path of consumers) {
    assert.match(text(path), /20261022/, `${path} must use the 22 October identity`);
    assert.doesNotMatch(text(path), /composer-icon-20261018/, `${path} must not reference the rejected identity`);
  }
  const manifest = JSON.parse(text('public/site.webmanifest'));
  assert.deepEqual(manifest.icons.map(icon => [icon.sizes, icon.purpose]), [
    ['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable'],
  ]);
  for (const icon of manifest.icons) assert.equal(exists('public' + icon.src), true);
  assert.equal(manifest.theme_color, '#fc5b05');
  assert.deepEqual(read('src/assets/composer-icon-20261022b-96.png.bin'), read('public/brand/composer-icon-20261022b-96.png'));
  const extension = png('extension/icon.png');
  assert.equal(extension.width, 128);
  assert.equal(extension.height, 128);
  assert.match(text('extension/manifest.json'), /"128": "icon.png"/);
});

test('the product and campaign sharing assets are correctly composed at their declared sizes', () => {
  for (const path of [
    'public/brand/campaign/product-og-20261022b.jpg',
    'public/brand/campaign/php2shell-australia-20261022b-1200x630.jpg',
  ]) {
    const dimensions = jpegDimensions(read(path));
    assert.deepEqual([dimensions.width, dimensions.height], [1200, 630], path);
  }
  const square = png('public/brand/campaign/php2shell-australia-20261022b-1080x1080.png');
  assert.deepEqual([square.width, square.height], [1080, 1080]);
  const vertical = png('public/brand/campaign/php2shell-australia-20261022b-1080x1920.png');
  assert.deepEqual([vertical.width, vertical.height], [1080, 1920]);
  const banner = jpegDimensions(read('public/brand/campaign/product-x-banner-20261022b.jpg'));
  assert.deepEqual([banner.width, banner.height], [1500, 500]);
  assert.ok(read('public/brand/campaign/product-x-banner-20261022b.jpg').length < 250000, 'the X banner must stay lightweight');
  const bannerPng = png('public/brand/campaign/product-x-banner-20261022b.png');
  assert.deepEqual([bannerPng.width, bannerPng.height], [1500, 500]);
  for (const path of [
    'public/brand/campaign/php2shell-australia-20261022b-1200x630.webp',
    'public/brand/campaign/php2shell-australia-20261022b-800x420.webp',
    'public/brand/campaign/php2shell-australia-20261022b-480x252.webp',
    'public/brand/campaign/php2shell-australia-20261022b-1080x1080.webp',
    'public/brand/campaign/php2shell-australia-20261022b-1080x1920.webp',
  ]) assert.ok(read(path).length > 1000, path + ' must be a real export');
});

test('the homepage features the approved campaign and links to the Australia briefing', () => {
  const home = text('src/components/ProductHome.astro');
  assert.match(home, /home-briefing/);
  assert.match(home, /href="\/php2shell"/);
  assert.match(home, /php2shell-australia-20261022b-1200x630\.webp/);
  assert.match(home, /php2shell-australia-20261022b-1080x1080\.webp/);
  assert.match(home, /When PHP broke, Australia felt it/);
  const article = text('src/pages/php2shell.astro');
  assert.match(article, /canonical="https:\/\/composer.loftwah\.com\/php2shell"/);
  assert.match(article, /php2shell-australia-20261022b-1200x630\.jpg/);
  assert.match(article, /article:published_time/);
  assert.match(article, /not a breach count/);
  assert.match(article, /not aware of successful active exploitation within Australia/);
  assert.match(article, /WAF helps\. Patching is essential/);
  assert.match(article, /const shareImage = 'https:\/\/composer\.loftwah\.com\/brand\/campaign\/php2shell-australia-20261022b-1200x630\.jpg'/);
  assert.doesNotMatch(article, /\bMP\b/, 'reader-facing campaign copy must not name the owner by initials');
  assert.doesNotMatch(article, /Use the approved artwork|product-x-banner|briefing-asset/, 'internal campaign notes and profile exports stay off the public page');
  for (const path of ['src/lib/ready-handoff.ts', 'src/lib/init-client.ts']) {
    assert.doesNotMatch(text(path), /\bMP\b/, `${path} is copied or shown to visitors and must not name the owner by initials`);
  }
  for (const source of [
    'https://www.php.net/archive/2026.php#2026-10-21-5',
    'https://blog.cloudflare.com/php-vulnerabilities-waf-protection',
    'https://www.cyber.gov.au/alert/critical-vulnerabilities-in-php',
    'https://www.abc.net.au/news/2026-10-22/php-vulnerabilities-cyber-asd/107294812',
    'https://architecture.digital.gov.au/design/govcms',
    'https://www.vic.gov.au/single-digital-presence',
    'https://www.nsw.gov.au/nsw-government/onecx-program/about/how-nswgovau-built-and-what-it-can-do',
  ]) assert.ok(article.includes(source), 'missing source ' + source);
  assert.match(text('src/pages/sitemap.xml.ts'), /'\/php2shell'/);
});

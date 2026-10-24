import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPagePaths, publicPageCanonical, publicPageRedirect } from '../src/lib/public-pages.mjs';

test('public URL variants resolve once to the HTTPS sitemap address, retaining the query', () => {
  for (const path of publicPagePaths) {
    const variant = path === '/' ? '/' : path + '/';
    const response = publicPageRedirect(new Request('http://composer.loftwah.com' + variant + '?from=guide'));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), 'https://composer.loftwah.com' + path + '?from=guide');
    assert.equal(publicPageRedirect(new Request(response.headers.get('Location'))), null);
    assert.equal(publicPageCanonical(variant).href, 'https://composer.loftwah.com' + path);
  }
});

test('HEAD follows the same public policy without changing form requests', () => {
  assert.equal(publicPageRedirect(new Request('https://composer.loftwah.com/learn/', { method: 'HEAD' })).status, 308);
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    assert.equal(publicPageRedirect(new Request('http://composer.loftwah.com/init/', { method })), null);
  }
});

test('independent apps, previews, private routes, assets and missing pages retain their routing', () => {
  for (const host of ['localhost:4321', 'app-composer-preview.loftwah.workers.dev', 'showcase.loftwah.com', 'composer.loftwah.com.evil.invalid']) {
    assert.equal(publicPageRedirect(new Request('http://' + host + '/learn/')), null);
  }
  for (const path of ['/guestbook/', '/showcase/', '/_emdash/admin/', '/api/usage/', '/brand/icon.svg', '/not-a-page/', '/learn//']) {
    assert.equal(publicPageRedirect(new Request('http://composer.loftwah.com' + path)), null);
  }
  assert.equal(publicPageCanonical('//evil.invalid/').origin, 'https://composer.loftwah.com');
  assert.equal(publicPageCanonical('/showcase/').pathname, '/showcase/');
});

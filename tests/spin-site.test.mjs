import assert from 'node:assert/strict';
import test from 'node:test';
import { spinDomainRequest, spinOrigin } from '../src/lib/spin-site.mjs';
import { sitemapXml } from '../src/lib/sitemap.mjs';

const composer = 'https://composer.loftwah.com';

test('Spin has one crawlable home and keeps existing creator links on their origin', async () => {
  const redirect = spinDomainRequest(new Request(composer + '/spin?from=library'));
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), spinOrigin + '/?from=library');
  assert.equal(spinDomainRequest(new Request(composer + '/spin?session=historical')), null);

  const root = spinDomainRequest(new Request(spinOrigin + '/?session=shared', {
    headers: { Cookie: 'unrelated', Authorization: 'unrelated' },
  }));
  assert.equal(root.url, spinOrigin + '/spin?session=shared');
  assert.equal(root.headers.get('Cookie'), null);
  assert.equal(root.headers.get('Authorization'), null);

  const sitemap = spinDomainRequest(new Request(spinOrigin + '/sitemap.xml'));
  assert.match(await sitemap.text(), /<loc>https:\/\/spin\.loftwah\.com\/<\/loc>/);
  assert.doesNotMatch(sitemapXml([]), /composer\.loftwah\.com\/spin/);
});

test('Spin admits its same-origin API and keeps Composer routes off the new app host', () => {
  const write = new Request(spinOrigin + '/api/spin', { method: 'POST', body: '{}' });
  assert.equal(spinDomainRequest(write), write);
  for (const path of ['/_emdash/admin', '/api/resource-summary', '/manage', '/me', '/share']) {
    assert.equal(spinDomainRequest(new Request(spinOrigin + path)).status, 404, path);
  }
  assert.equal(spinDomainRequest(new Request(spinOrigin + '/', { method: 'POST' })).status, 405);
});

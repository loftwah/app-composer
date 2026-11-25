import test from 'node:test';
import assert from 'node:assert/strict';
import { printsDomainRequest } from '../src/lib/prints-site.mjs';

const site = 'https://prints.loftwah.com';
const get = (path, init) => printsDomainRequest(new Request(site + path, init));

test('the Prints host exposes the product pages without Composer sessions', () => {
  const request = get('/guide?from=home', {
    headers: { Cookie: 'test=example', Authorization: 'Bearer test', 'Cf-Access-Jwt-Assertion': 'test', 'Cf-Access-Authenticated-User-Email': 'test@example.org' },
  });
  assert.equal(request.url, site + '/prints-desktop/guide?from=home');
  for (const header of ['Cookie', 'Authorization', 'Cf-Access-Jwt-Assertion', 'Cf-Access-Authenticated-User-Email']) {
    assert.equal(request.headers.has(header), false);
  }
  assert.equal(get('/prints-desktop/watch/?ref=portfolio').headers.get('Location'), site + '/watch?ref=portfolio');
  assert.equal(get('/devrel').url, site + '/prints-desktop/devrel');
  assert.equal(get('/make').url, site + '/prints-desktop/make');
  assert.equal(get('/story').url, site + '/prints-desktop/story');
  assert.equal(get('/api/resource-summary').status, 404);
  assert.equal(get('/_emdash/admin').status, 404);
  assert.equal(get('/', { method: 'POST' }).status, 405);
  assert.equal(printsDomainRequest(new Request('https://composer.loftwah.com/prints-desktop')), null);
});

test('the separate sitemap only lists actual product URLs', async () => {
  const sitemap = await get('/sitemap.xml').text();
  for (const path of ['/', '/watch', '/guide', '/make', '/devrel', '/story']) assert.ok(sitemap.includes(`<loc>${site}${path}</loc>`));
  assert.ok((await get('/robots.txt').text()).includes(`Sitemap: ${site}/sitemap.xml`));
  assert.equal(await get('/robots.txt', { method: 'HEAD' }).text(), '');
});

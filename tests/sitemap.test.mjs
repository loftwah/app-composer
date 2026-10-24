import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueSlugs, sitemapPaths, sitemapXml} from '../src/lib/sitemap.mjs';
import {publicPagePaths} from '../src/lib/public-pages.mjs';

test('published catalogue entries join the static public pages exactly once', () => {
  const paths = sitemapPaths([{id: 'ldraw', data: {slug: 'ldraw'}}, {id: 'guestbook', data: {slug: 'guestbook'}}]);
  assert.ok(paths.includes('/catalogue/ldraw'));
  assert.ok(paths.includes('/catalogue/guestbook'));
  assert.equal(paths.filter(path => path === '/catalogue').length, 1);
  assert.equal(paths.filter(path => path === '/catalogue/ldraw').length, 1);
  for (const path of publicPagePaths) assert.ok(paths.includes(path), 'static path retained: ' + path);
});

test('a duplicate entry or repeated slug cannot duplicate a sitemap address', () => {
  const xml = sitemapXml([{id: 'ldraw', data: {slug: 'ldraw'}}, {id: 'ldraw', data: {slug: 'ldraw'}}, 'ldraw']);
  assert.equal(xml.match(/https:\/\/composer\.loftwah\.com\/catalogue\/ldraw</g)?.length, 1);
});

test('unsafe or malformed slugs are refused rather than published into the sitemap', () => {
  const slugs = catalogueSlugs([
    {data: {slug: '../../etc/passwd'}},
    {data: {slug: 'Upper Case'}},
    {data: {slug: 'has space'}},
    {data: {slug: ''}},
    {data: {slug: '-leading-dash'}},
    {data: {slug: 'a'.repeat(65)}},
    {data: {slug: '<script>'}},
    {id: 42},
    null,
  ]);
  assert.deepEqual(slugs, []);
  const xml = sitemapXml([{id: 'ok-app', data: {slug: 'ok-app'}}]);
  assert.ok(xml.includes('/catalogue/ok-app'));
  assert.ok(!xml.includes('script'));
});

test('an unavailable catalogue still returns a valid sitemap of the static pages', () => {
  const xml = sitemapXml(undefined);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.endsWith('</urlset>'));
  assert.ok(xml.includes('https://composer.loftwah.com/catalogue</loc>'));
  assert.ok(!xml.includes('/catalogue/undefined'));
  assert.equal(sitemapXml([]), sitemapXml(undefined));
});

test('entry shapes without a slug fall back to a safe id and never emit the literal undefined', () => {
  const xml = sitemapXml([{id: 'paperwork'}, {id: 'bad id'}, {slug: 'showcase'}]);
  assert.ok(xml.includes('/catalogue/paperwork'));
  assert.ok(xml.includes('/catalogue/showcase'));
  assert.ok(!xml.includes('bad id'));
  assert.ok(!xml.includes('undefined'));
});

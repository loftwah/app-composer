import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchCatalogueEntries, sitemapPaths} from '../src/lib/sitemap.mjs';

test('includes every published page once, using the actual entry route', async () => {
  const calls = [];
  const entries = await fetchCatalogueEntries(async filter => {
    calls.push(filter);
    return filter.cursor
      ? {entries: [{id: 'app-50'}, {id: 'app-0'}, {id: '../bad'}]}
      : {entries: Array.from({length: 50}, (_, i) => ({id: `app-${i}`, data: {slug: 'different'}})), nextCursor: 'next', hasMore: true};
  });
  const paths = sitemapPaths(entries).filter(path => path.startsWith('/catalogue/'));
  assert.equal(paths.length, 51);
  assert.ok(paths.includes('/catalogue/app-50'));
  assert.ok(!paths.includes('/catalogue/different'));
  assert.deepEqual(calls[1], {limit: 50, status: 'published', cursor: 'next'});
});

test('does not publish a partial result on errors or broken pagination', async () => {
  await assert.rejects(fetchCatalogueEntries(async () => ({entries: [], error: new Error('down')})));
  await assert.rejects(fetchCatalogueEntries(async () => ({entries: [], hasMore: true})));
  await assert.rejects(fetchCatalogueEntries(async () => ({entries: [], nextCursor: 'same'})));
});

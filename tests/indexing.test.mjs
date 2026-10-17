import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {noindexFor,previewHostname} from '../src/lib/indexing.mjs';

const root=new URL('..',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

test('only the public hostname is indexable, whatever the page state says',()=>{
 assert.equal(previewHostname('composer.loftwah.com'),false);
 assert.equal(previewHostname('app-composer-preview.loftwah.workers.dev'),true);
 assert.equal(noindexFor('composer.loftwah.com'),false);
 assert.equal(noindexFor('app-composer-preview.loftwah.workers.dev'),true);
});

test('a state that must never be indexed is excluded on every hostname',()=>{
 for(const host of ['composer.loftwah.com','app-composer-preview.loftwah.workers.dev'])
  for(const healthy of [false])assert.equal(noindexFor(host,healthy),true,host+' with healthy='+healthy);
});

test('the reported regression cannot return: a healthy catalogue entry keeps the hostname rule',()=>{
 const page=read('src/pages/catalogue/[slug].astro');
 assert.match(page,/noindex=\{noindexFor\(Astro\.url\.hostname,/,'the catalogue detail page derives noindex from the shared rule');
 assert.doesNotMatch(page,/noindex=\{Boolean\(/,'a healthy entry must not override the hostname rule');
 assert.equal(noindexFor('app-composer-preview.loftwah.workers.dev',Boolean('showcase')&&true),true);
});

test('the layout default and the catalogue page share one rule, not two copies',()=>{
 const base=read('src/layouts/Base.astro');
 assert.match(base,/import \{noindexFor\} from "\.\.\/lib\/indexing\.mjs"/);
 assert.match(base,/noindex = noindexFor\(Astro\.url\.hostname\)/);
 assert.doesNotMatch(base,/hostname\.includes\("workers\.dev"\)/);
 assert.match(read('src/pages/catalogue/[slug].astro'),/import \{noindexFor\} from '\.\.\/\.\.\/lib\/indexing\.mjs'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';

const root=new URL('..',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const size=path=>statSync(new URL('public'+path,root)).size;

// One reviewed entry per shipped app: the app's own name, its identity tile, a
// launcher thumbnail, a versioned share card and a real screenshot. The library
// must not drift back to a mixed artwork set or to capability naming.
const source=read('src/lib/apps.ts');
const entries=[...source.matchAll(/\{id:'([^']+)',name:'([^']+)'/g)].map(([,id,name])=>({id,name,line:source.split('\n').find(line=>line.includes(`{id:'${id}'`))}));

test('the shipped library keeps the five reviewed app names',()=>{
 assert.deepEqual(entries.map(entry=>entry.name),['Link Check','Here / there','Linkarooie','Hello World','Carry / forward']);
 assert.deepEqual(entries.map(entry=>entry.id),['linkcheck','guestbook','showcase','hello','state']);
});

test('each entry ships its own tile, thumbnail, share card and real screenshot',()=>{
 for(const {id,line} of entries){
  assert.ok(line,'the '+id+' entry exists');
  const assets={};
  for(const key of ['image','thumbnail','share','preview','previewWide'])
   assets[key]=line.match(new RegExp(key+":'([^']+)'"))?.[1]??(assert.fail(id+' has no '+key));
  // Identity crops evolve independently from the retained hero illustrations.
  const prefix={guestbook:'herethere',showcase:'linkarooie',linkcheck:'linkcheck',hello:'hello',state:'carryforward'}[id];
  assert.ok(prefix,id+' has a reviewed export prefix');
  const hero=id==='showcase'?`${prefix}-art-20261018-480.webp`:`${prefix}-v4.webp`;
  assert.equal(assets.image,`/brand/apps/${hero}`,id+' uses its selected hero export');
  assert.equal(assets.thumbnail,`/brand/apps/${prefix}-small-20261018.webp`,id+' uses its optical thumbnail');
  assert.equal(assets.share,`/brand/apps/${prefix}-share-20261018.jpg`,'a JPEG share card keeps og:image:type truthful');
  assert.match(assets.preview,new RegExp(`/brand/apps/previews/${prefix}-20261018-960\\.webp$`),id+' preview is the real 960px capture');
  assert.match(assets.previewWide,new RegExp(`/brand/apps/previews/${prefix}-20261018-1440\\.webp$`),id+' preview has a 1440px source');
  assert.match(line,/previewCaptured:'\d{4}-\d{2}-\d{2}'/,'every screenshot carries its capture date');
  for(const value of Object.values(assets)){
   const path='public'+value;
   assert.equal(existsSync(new URL(path,root)),true,path+' must exist');
   assert.ok(size(value)>1000,path+' looks empty');
  }
 }
 for(const retired of ['showcase-v1','showcase-v2','linkarooie-v3','guestbook-v1','guestbook-v2','herethere-v3','hello-v1','hello-v3','linkcheck-v1','linkcheck-v3','state-v1','carryforward-v3'])
  assert.doesNotMatch(source,new RegExp('brand/apps/'+retired),retired+' belongs to the retired mixed artwork set');
});

test('the library and catalogue detail pages show the real screenshot, not a drawing',()=>{
 for(const path of ['src/pages/apps.astro','src/pages/catalogue/[slug].astro']){
  const page=read(path);
  assert.match(page,/shipped\.preview|app\.preview/,path+' renders the captured screenshot');
  assert.match(page,/previewAlt|previewWide/,path+' uses the reviewed capture');
  assert.match(page,/Real screenshot/,path+' says plainly that the screen is real');
 }
});

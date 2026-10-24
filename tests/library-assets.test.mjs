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

test('the shipped library keeps the seven reviewed app names',()=>{
 assert.deepEqual(entries.map(entry=>entry.name),['Paperwork','Launch Kit','Link Check','Here / there','Linkarooie','Hello World','Carry / forward']);
 assert.deepEqual(entries.map(entry=>entry.id),['paperwork','launch-kit','linkcheck','guestbook','showcase','hello','state']);
});

test('each entry ships its own tile, thumbnail, share card and real screenshot',()=>{
 for(const {id,line} of entries){
  assert.ok(line,'the '+id+' entry exists');
  const assets={};
  for(const key of ['image','thumbnail','share','preview','previewWide'])
   assets[key]=line.match(new RegExp(key+":'([^']+)'"))?.[1]??(assert.fail(id+' has no '+key));
  if(id==='paperwork'){
   assert.deepEqual(assets,{image:'/paperwork/icon.svg',thumbnail:'/paperwork/icon.svg',share:'/paperwork/editor-20261024.webp',preview:'/paperwork/editor-20261024.webp',previewWide:'/paperwork/editor-20261024.webp'});
   assert.match(line,/shareType:'image\/webp'/);
   const svg=read('public/paperwork/icon.svg');assert.match(svg,/<svg/);assert.ok(svg.length>100);
   const capture=readFileSync(new URL('public'+assets.preview,root));assert.equal(capture.toString('ascii',0,4),'RIFF');assert.equal(capture.toString('ascii',8,12),'WEBP');assert.ok(capture.length>1000);
   assert.match(line,/previewCaptured:'2026-10-24'/);
   continue;
  }
  // Identity crops evolve independently from the retained hero illustrations.
  const prefix={'launch-kit':'launch-kit',guestbook:'herethere',showcase:'linkarooie',linkcheck:'linkcheck',hello:'hello',state:'carryforward'}[id];
  assert.ok(prefix,id+' has a reviewed export prefix');
  const hero=id==='launch-kit'?`${prefix}-20261023-480.webp`:id==='showcase'?`${prefix}-art-20261018-480.webp`:`${prefix}-v4.webp`;
  assert.equal(assets.image,`/brand/apps/${hero}`,id+' uses its selected hero export');
  assert.equal(assets.thumbnail,id==='launch-kit'?'/brand/apps/launch-kit-20261023-32.png':`/brand/apps/${prefix}-small-20261018.webp`,id+' uses its optical thumbnail');
  assert.equal(assets.share,id==='launch-kit'?'/launch-kit/example/social-1200x630.png':`/brand/apps/${prefix}-share-20261018.jpg`,'the selected PNG/JPEG share card keeps its actual format');
  assert.match(assets.preview,new RegExp(`/brand/apps/previews/${prefix}-${id==='launch-kit'?'20261023':'20261018'}-960\\.webp$`),id+' preview is the real 960px capture');
  assert.match(assets.previewWide,new RegExp(`/brand/apps/previews/${prefix}-${id==='launch-kit'?'20261023':'20261018'}-1440\\.webp$`),id+' preview has a 1440px source');
  const type=line.match(/shareType:'([^']+)'/)?.[1],header=readFileSync(new URL('public'+assets.share,root));assert.equal(type,header[0]===137?'image/png':header[0]===255&&header[1]===216?'image/jpeg':'unsupported',id+' metadata type matches actual bytes');
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

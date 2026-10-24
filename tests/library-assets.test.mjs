import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {apps,appDetails} from '../src/lib/apps.ts';

const root=new URL('..',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const bytes=path=>readFileSync(new URL('public'+path,root));
const size=path=>statSync(new URL('public'+path,root)).size;
const hash=data=>createHash('sha256').update(data).digest('hex');
const source=read('src/lib/apps.ts');

function pngDimensions(data){
 assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');
 return [data.readUInt32BE(16),data.readUInt32BE(20)];
}
function losslessWebPDimensions(data){
 assert.equal(data.toString('ascii',0,4),'RIFF');
 assert.equal(data.toString('ascii',8,16),'WEBPVP8L');
 assert.equal(data[20],0x2f);
 const dimensions=data.readUInt32LE(21);
 return [(dimensions&0x3fff)+1,((dimensions>>>14)&0x3fff)+1];
}
function ldrawAssets(app){
 assert.match(app.releasedSource,/^[a-f0-9]{40}$/,'LDraw needs the qualified released source, not a pending token');
 assert.match(app.previewCaptured,/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(app.previewOrigin,'https://ldraw.loftwah.com/');
 assert.equal(app.thumbnailKind,'discovery-wordmark');
 assert.match(app.thumbnailCaption,/wordmark tile for LDraw, not an LDraw logo/);
 assert.equal(app.image,app.preview,'LDraw has no invented identity illustration');
 assert.equal(app.shareType,'image/png');
 const pinned=JSON.parse(read('lib/ldraw/source.json'));
 assert.equal(app.releasedSource,pinned.commit);
 assert.equal(app.source,pinned.repository+'/tree/'+pinned.commit);
 const provenance=JSON.parse(bytes(app.previewProvenance));
 const recipe=Number(provenance.recipe.match(/^composer\.ldraw-discovery\/(\d+)$/)?.[1]);
 assert.ok(recipe>=1,'the LDraw compositor recipe is revisioned');
 const suffix=app.releasedSource.slice(0,12)+'-'+provenance.capture.sha256.slice(0,8)+'-r'+recipe;
 assert.equal(app.thumbnail,'/brand/apps/ldraw-tile-'+suffix+'-96.webp','the launcher tile is the reviewed typographic tile');
 assert.equal(app.image,'/brand/apps/ldraw-workspace-'+suffix+'-960.webp','the card image stays the real workspace capture');
 assert.equal(app.preview,'/brand/apps/ldraw-workspace-'+suffix+'-960.webp');
 assert.equal(app.previewWide,'/brand/apps/ldraw-workspace-'+suffix+'-1440.webp');
 assert.equal(provenance.capture.releasedSource,app.releasedSource);
 assert.equal(provenance.capture.url,app.previewOrigin);
 assert.equal(provenance.capture.capturedAt.slice(0,10),app.previewCaptured);
 assert.match(provenance.capture.sha256,/^[a-f0-9]{64}$/);
 assert.match(provenance.capture.pixelSha256,/^[a-f0-9]{64}$/);
 assert.ok(provenance.capture.qualificationReference.trim());
 assert.equal(provenance.identity.composerMark.role,'App Composer return destination only');
 assert.equal(provenance.identity.font.family,'Space Grotesk');
 for(const asset of [provenance.identity.composerMark,provenance.identity.font])
  assert.equal(hash(readFileSync(new URL(asset.path,root))),asset.sha256);
 const original=bytes('/brand/apps/'+provenance.capture.preservedAs);
 assert.equal(hash(original),provenance.capture.sha256,'original capture bytes must be retained');
 assert.deepEqual(pngDimensions(original),[provenance.capture.width,provenance.capture.height]);
 assert.ok(provenance.capture.width>=1440);
 for(const key of ['image','thumbnail','share','preview','previewWide']){
  const path=app[key];
  assert.match(path,new RegExp('^/brand/apps/ldraw-.*'+suffix));
  assert.ok(size(path)>500,path+' looks empty');
  const record=provenance.assets[path.split('/').at(-1)];
  assert.ok(record,path+' has no provenance');
  assert.equal(hash(bytes(path)),record.sha256,path+' must match its recorded pixels');
 }
 const tile=provenance.assets[app.thumbnail.split('/').at(-1)];
 assert.match(tile.role,/wordmark tile/i);
 assert.match(String(tile.transformation),/no symbol/);
 assert.match(String(tile.transformation),/nothing copied from the workspace capture/);
 assert.ok(size(app.thumbnail)<4000,'the typographic tile stays a small flat asset, not a resized screenshot');
 assert.deepEqual(losslessWebPDimensions(bytes(app.thumbnail)),[96,96]);
 assert.deepEqual(losslessWebPDimensions(bytes(app.preview)),[960,Math.round(provenance.capture.height*960/provenance.capture.width)]);
 assert.deepEqual(losslessWebPDimensions(bytes(app.previewWide)),[1440,Math.round(provenance.capture.height*1440/provenance.capture.width)]);
 assert.deepEqual(pngDimensions(bytes(app.share)),[1200,630]);
}

test('the shipped library keeps the eight reviewed app names',()=>{
 assert.deepEqual(apps.map(app=>app.name),['Paperwork','Launch Kit','LDraw','Link Check','Here / there','Linkarooie','Hello World','Carry / forward']);
 assert.deepEqual(apps.map(app=>app.id),['paperwork','launch-kit','ldraw','linkcheck','guestbook','showcase','hello','state']);
});

test('each entry ships its selected tile, thumbnail, share card and actual screenshot',()=>{
 for(const app of apps.filter(app=>app.id!=='ldraw')){
  const {id}=app;
  const assets=Object.fromEntries(['image','thumbnail','share','preview','previewWide'].map(key=>[key,app[key]]));
  if(id==='paperwork'){
   assert.deepEqual(assets,{image:'/paperwork/icon.svg',thumbnail:'/paperwork/icon.svg',share:'/paperwork/share-20261024.png',preview:'/paperwork/editor-20261024-compact.webp',previewWide:'/paperwork/editor-20261024-compact.webp'});
   assert.equal(app.shareType,'image/png');
   assert.deepEqual(pngDimensions(bytes(assets.share)),[1200,630]);
   const svg=read('public/paperwork/icon.svg');assert.match(svg,/<svg/);assert.ok(svg.length>100);
   const capture=bytes(assets.preview);assert.equal(capture.toString('ascii',0,4),'RIFF');assert.equal(capture.toString('ascii',8,12),'WEBP');assert.ok(capture.length>1000);
   assert.equal(app.previewCaptured,'2026-10-24');
   continue;
  }
  // Existing identity crops remain independent from retained hero illustrations.
  const prefix={'launch-kit':'launch-kit',guestbook:'herethere',showcase:'linkarooie',linkcheck:'linkcheck',hello:'hello',state:'carryforward'}[id];
  assert.ok(prefix,id+' has a reviewed export prefix');
  const hero=id==='launch-kit'?`${prefix}-20261023-480.webp`:id==='showcase'?`${prefix}-art-20261018-480.webp`:`${prefix}-v4.webp`;
  assert.equal(assets.image,`/brand/apps/${hero}`,id+' uses its selected hero export');
  assert.equal(assets.thumbnail,id==='launch-kit'?'/brand/apps/launch-kit-20261023-32.png':`/brand/apps/${prefix}-small-20261018.webp`,id+' uses its optical thumbnail');
  assert.equal(assets.share,id==='launch-kit'?'/launch-kit/example/social-1200x630.png':`/brand/apps/${prefix}-share-20261018.jpg`,'the selected PNG/JPEG share card keeps its actual format');
  assert.match(assets.preview,new RegExp(`/brand/apps/previews/${prefix}-${id==='launch-kit'?'20261023':'20261018'}-960\\.webp$`),id+' preview is the real 960px capture');
  assert.match(assets.previewWide,new RegExp(`/brand/apps/previews/${prefix}-${id==='launch-kit'?'20261023':'20261018'}-1440\\.webp$`),id+' preview has a 1440px source');
  const header=bytes(assets.share);assert.equal(app.shareType,header[0]===137?'image/png':header[0]===255&&header[1]===216?'image/jpeg':'unsupported',id+' metadata type matches actual bytes');
  assert.match(app.previewCaptured,/^\d{4}-\d{2}-\d{2}$/,'every screenshot carries its capture date');
  for(const value of Object.values(assets)){
   assert.equal(existsSync(new URL('public'+value,root)),true,value+' must exist');
   assert.ok(size(value)>1000,value+' looks empty');
  }
 }
 for(const retired of ['showcase-v1','showcase-v2','linkarooie-v3','guestbook-v1','guestbook-v2','herethere-v3','hello-v1','hello-v3','linkcheck-v1','linkcheck-v3','state-v1','carryforward-v3'])
  assert.doesNotMatch(source,new RegExp('brand/apps/'+retired),retired+' belongs to the retired mixed artwork set');
});

test('LDraw assets match its qualified source, original capture and compositor provenance',()=>{
 ldrawAssets(apps.find(app=>app.id==='ldraw'));
});

test('the library and catalogue detail pages show the actual screenshot and identify the workspace thumbnail',()=>{
 for(const path of ['src/pages/apps.astro','src/pages/catalogue/[slug].astro']){
  const page=read(path);
  assert.match(page,/shipped\.preview|app\.preview/,path+' renders the captured screenshot');
  assert.match(page,/previewAlt|previewWide/,path+' uses the reviewed capture');
  assert.match(page,/Real screenshot/,path+' says plainly that the screen is real');
 }
 assert.match(read('src/pages/apps.astro'),/thumbnailCaption/);
});

test('LDraw hands off its native independent source instead of the pair Init journey',()=>{
 const app=apps.find(app=>app.id==='ldraw');
 assert.equal(app.href,'/ldraw');
 assert.equal(app.standalone,'https://ldraw.loftwah.com/');
 assert.match(appDetails.ldraw.features.join(' '),/\.excalidraw/);
 assert.match(appDetails.ldraw.connection,/own origin and browser storage/);
 const page=read('src/pages/catalogue/[slug].astro');
 const native=page.split("shipped?.id==='ldraw' ? (")[1]?.split(') : (')[0];
 assert.ok(native,'a dedicated LDraw handoff must exist');
 assert.match(native,/native LDraw source/);
 assert.match(native,/href=\{shipped.source\}/);
 assert.doesNotMatch(native,/\/init|Configure the supported pair/);
});

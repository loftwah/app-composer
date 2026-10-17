import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';

const root=new URL('..',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');

// A font preload is only honest while the same file is the declared source of a
// face that a rendered element actually asks for. A broken pairing costs every
// visitor an early request and makes Chrome warn that the preload went unused,
// so the pairing is asserted here instead of trusted.
const base=read('src/layouts/Base.astro');
const style=read('src/styles/global.css');

test('the display font is preloaded, declared and used, all from one file',()=>{
 const preload=base.match(/rel="preload"[\s\S]{0,160}?href="\/brand\/([\w.-]+)"/);
 assert.ok(preload,'Base.astro preloads one font file');
 const file=preload[1];
 assert.match(base,/rel="preload"[\s\S]{0,160}?as="font"/,'the preload declares as="font"');
 assert.match(base,/rel="preload"[\s\S]{0,160}?type="font\/woff2"/,'the preload declares the woff2 type');
 assert.match(base,/rel="preload"[\s\S]{0,200}?crossorigin/,'a font preload is a CORS request');
 assert.ok(style.includes(`src:url('/brand/${file}')`),'global.css declares '+file+' as the face source');
 const faces=[...style.matchAll(/@font-face\{font-family:([^;]+);[^}]*\}/g)];
 assert.equal(faces.length,1,'one bundled face is declared');
 const family=faces[0][1];
 const consumers=[...style.matchAll(new RegExp('font(-family)?:[^;}]*'+family+'[^;}]*','g'))].filter(match=>!match[0].includes('@font-face'));
 assert.ok(consumers.length,'something asks for '+family+', so the preload has a consumer');
 const path='public/brand/'+file;
 assert.equal(existsSync(new URL(path,root)),true,path+' must exist');
 assert.equal(readFileSync(new URL(path,root)).subarray(0,4).toString('latin1'),'wOF2',path+' is a WOFF2 font');
 assert.ok(statSync(new URL(path,root)).size>1000,path+' looks empty');
});

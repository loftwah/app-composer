import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';

const root=new URL('..',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const zipPath='public/downloads/cloudflare-extension.zip';

// Minimal reader: enough to prove the shipped archive carries the current
// extension files, including a drawn icon. The 17 October release shipped a
// blank ivory icon inside this ZIP because it was assembled by hand.
function zipEntries(bytes){
 const entries=new Map();
 let pos=0;
 while(pos+30<=bytes.length&&bytes.readUInt32LE(pos)===0x04034b50){
  const method=bytes.readUInt16LE(pos+8);
  const size=bytes.readUInt32LE(pos+18);
  const nameLength=bytes.readUInt16LE(pos+26);
  const extraLength=bytes.readUInt16LE(pos+28);
  const name=bytes.subarray(pos+30,pos+30+nameLength).toString('utf8');
  const data=bytes.subarray(pos+30+nameLength+extraLength,pos+30+nameLength+extraLength+size);
  entries.set(name,method===8?inflateRawSync(data):Buffer.from(data));
  pos+=30+nameLength+extraLength+size;
 }
 return entries;
}

test('the committed extension archive carries the current files and a drawn icon',()=>{
 assert.equal(existsSync(new URL(zipPath,root)),true,'the archive is committed');
 const archive=read(zipPath);
 const entries=zipEntries(archive);
 for(const name of ['manifest.json','background.js','workspace.js','spec.mjs','README.md','icon.png'])
  assert.ok(entries.has(name),name+' is inside the archive');
 const icon=entries.get('icon.png');
 assert.deepEqual(icon,read('extension/icon.png'),'the archive ships the checked-in icon bytes');
 assert.equal(icon.readUInt32BE(0),0x89504e47,'the icon is a PNG');
 const width=icon.readUInt32BE(16),height=icon.readUInt32BE(20);
 assert.equal(width,128);assert.equal(height,128);
 // A blank tile is one flat colour. Require real drawn pixels: the App Composer
 // mark uses ivory, graphite and orange.
 const distinct=new Set();
 for(let i=33;i+3<icon.length;i+=97){distinct.add(icon[i].toString(16)+icon[i+1].toString(16)+icon[i+2].toString(16));if(distinct.size>12)break;}
 assert.ok(distinct.size>12,'the icon contains drawn detail, not a flat square');
 const manifest=JSON.parse(entries.get('manifest.json').toString('utf8'));
 assert.equal(manifest.manifest_version,3);
 assert.equal(manifest.icons['128'],'icon.png');
});

test('the published archive metadata matches the archive bytes',()=>{
 const archive=read(zipPath);
 const metadata=JSON.parse(read('public/downloads/cloudflare-extension.json').toString('utf8'));
 assert.equal(metadata.sha256,createHash('sha256').update(archive).digest('hex'));
 assert.equal(metadata.bytes,archive.length);
 assert.ok(metadata.files.includes('icon.png'));
});

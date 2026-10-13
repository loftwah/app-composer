import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,lstatSync,linkSync,existsSync,chmodSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {runLocalReadiness,ReadinessFailure} from '../lib/get-ready/index.mjs';
const fixture=()=>{const root=mkdtempSync(join(tmpdir(),'composer-storage-')),workspace=join(root,'workspace'),storage=join(workspace,'.private');mkdirSync(workspace);mkdirSync(storage);return {root,workspace,storage};};

test('a pre-existing predictable temporary link is untouched and cannot overwrite an owner file',async()=>{
 const {root,workspace,storage}=fixture(),outside=join(root,'outside.txt'),link=join(storage,'readiness.json.tmp');writeFileSync(outside,'fictional owner bytes');symlinkSync(outside,link);
 try{await runLocalReadiness({workspace,cancel:true});assert.equal(readFileSync(outside,'utf8'),'fictional owner bytes');assert.equal(lstatSync(link).isSymbolicLink(),true);assert.equal(JSON.parse(readFileSync(join(storage,'readiness.json'),'utf8')).state,'cancelled');assert.equal(existsSync(join(storage,'readiness.lock')),false);}finally{rmSync(root,{recursive:true});}
});

test('linked private folders, receipt symlinks and hard-linked receipts are refused without changing owner bytes',async()=>{
 for(const kind of ['directory','symlink','hardlink']){
  const {root,workspace,storage}=fixture(),outside=join(root,'outside.txt');writeFileSync(outside,'fictional owner bytes');
  if(kind==='directory'){rmSync(storage,{recursive:true});const external=join(root,'external');mkdirSync(external);symlinkSync(external,storage);}
  else if(kind==='symlink')symlinkSync(outside,join(storage,'readiness.json'));else linkSync(outside,join(storage,'readiness.json'));
  try{await assert.rejects(runLocalReadiness({workspace,cancel:true}),error=>error instanceof ReadinessFailure);assert.equal(readFileSync(outside,'utf8'),'fictional owner bytes');assert.equal(existsSync(join(storage,'readiness.lock')),false);}finally{rmSync(root,{recursive:true});}
 }
});

test('malformed and unrelated JSON progress is preserved instead of silently replaced',async()=>{
 for(const bytes of ['fictional unfinished owner note','null','[]','{"note":"fictional owner recovery note"}']){
  const {root,workspace,storage}=fixture(),receipt=join(storage,'readiness.json');writeFileSync(receipt,bytes);
  try{await assert.rejects(runLocalReadiness({workspace,cancel:true}),error=>error instanceof ReadinessFailure&&error.code==='configuration');assert.equal(readFileSync(receipt,'utf8'),bytes);assert.equal(existsSync(join(storage,'readiness.lock')),false);}finally{rmSync(root,{recursive:true});}
 }
});

test('owner edits during a tool probe stop later receipt writes and replaced locks are retained',async()=>{
 for(const target of ['readiness.json','readiness.lock','replace-lock','link-lock']){
  const {root,workspace,storage}=fixture(),bin=join(root,'bin');mkdirSync(bin);
  const ownerPath=join(storage,target.endsWith('-lock')?'readiness.lock':target),command=join(bin,'gh');
  writeFileSync(command,'#!'+process.execPath+'\nimport {writeFileSync,unlinkSync,linkSync} from "node:fs";const path=process.env.FIXTURE_OWNER_PATH,mode=process.env.FIXTURE_OWNER_MODE;if(mode==="link-lock")linkSync(path,path+".owner");else{if(mode==="replace-lock")unlinkSync(path);writeFileSync(path,"fictional owner edit");}console.log("gh version 2.98.0");\n');chmodSync(command,0o700);
  try{
   const result=runLocalReadiness({workspace},{...process.env,PATH:bin+':'+process.env.PATH,FIXTURE_OWNER_PATH:ownerPath,FIXTURE_OWNER_MODE:target});
   await assert.rejects(result,error=>error instanceof ReadinessFailure&&error.code==='source');
   if(target==='link-lock'){assert.equal(lstatSync(ownerPath).nlink,2);assert.equal(readFileSync(ownerPath,'utf8'),String(process.pid));}else assert.equal(readFileSync(ownerPath,'utf8'),'fictional owner edit');
  }finally{rmSync(root,{recursive:true});}
 }
});

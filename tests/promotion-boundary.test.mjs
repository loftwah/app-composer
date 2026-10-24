import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,linkSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promoteComposition} from '../scripts/promotion-boundary.mjs';

function fixture({auditFailure=false,snapshotEdit=false,artifactEdit=false,extraAsset=false,customBuild=false,members=false}={}){
 const root=mkdtempSync(join(tmpdir(),'composer-promotion-test-')),workspace=join(root,'composer'),bin=join(root,'bin'),log=join(root,'calls.jsonl'),sources={};
 const account='a'.repeat(32),env={PATH:bin+':'+process.env.PATH,HOME:root,CLOUDFLARE_API_TOKEN:'synthetic-selected-upload',CLOUDFLARE_ACCOUNT_ID:account,UNRELATED_SECRET:'synthetic-unrelated',NODE_EXTRA_CA_CERTS:'synthetic-unrelated-file',CI_WORKER_NAME:'wrong-target',CLOUDFLARE_API_BASE_URL:'https://fictional.invalid'};
 mkdirSync(workspace);mkdirSync(bin);mkdirSync(join(workspace,'node_modules/wrangler/bin'),{recursive:true});
 const apps=['guestbook','showcase'].map(id=>{
  const source=join(root,'app-composer-'+id);sources[id]=source;mkdirSync(source);for(const dir of ['src','public','.private'])mkdirSync(join(source,dir));
  const repository='https://github.com/loftwah/app-composer-'+id,url='https://'+id+'.loftwah.com';
  const manifest={contract:1,id,repository,runtime:'cloudflare-worker',entry:'src/worker.ts',dataVersion:1,routes:['/'+id],capabilities:[]};
  if(members)Object.assign(manifest,id==='guestbook'?{memberService:{version:1,entrypoint:'GuestbookMemberService',transport:'service-binding',path:'/__composer/member'}}:{memberProfiles:{version:1,ownership:'installation-account',publication:'explicit-snapshot',publicPath:'/p/:handle/',bridge:'/api/member-profiles'}});
  const config={name:'composer-'+id,account_id:account,main:'./src/worker.ts',vars:{PUBLIC_ORIGIN:url},assets:{directory:'./public',binding:'ASSETS'},d1_databases:[{binding:'DB',database_id:'fixture-'+id}]};
  if(customBuild)config.build={command:'unsupported build hook'};writeFileSync(join(source,'public/fixture.txt'),'fictional public asset');writeFileSync(join(source,'wrangler.jsonc'),JSON.stringify(config));writeFileSync(join(source,'app.manifest.json'),JSON.stringify(manifest,null,2));writeFileSync(join(source,'src/worker.ts'),'export default {};');
  writeFileSync(join(source,'.gitignore'),'.private/\n.env\n.npmrc\n');writeFileSync(join(source,'.env'),'UNRELATED_SECRET=synthetic-local\n');writeFileSync(join(source,'.npmrc'),'fictional-owner-settings');writeFileSync(join(source,'.private/OWNER_API_TOKEN'),'synthetic-owner-'+id);
  if(members)writeFileSync(join(source,'.private',id==='guestbook'?'MEMBER_SERVICE_TOKEN':'COMPOSER_PROFILE_BRIDGE_TOKEN'),'synthetic-member-'+id);
  const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:source,env:{PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},encoding:'utf8',stdio:'pipe'}).trim();
  git(['init']);git(['add','.']);git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic source']);git(['remote','add','origin',repository+'.git']);
  return {id,repository,url,commit:git(['rev-parse','HEAD']),manifest,manifestDigest:'sha256:'+createHash('sha256').update(JSON.stringify(manifest)).digest('hex')};
 });
 writeFileSync(join(workspace,'composition.lock.json'),JSON.stringify({id:'b'.repeat(64),apps}));writeFileSync(join(workspace,'wrangler.jsonc'),JSON.stringify({account_id:account,services:[]}));
 writeFileSync(join(workspace,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',version:'4.152.0',bin:{wrangler:'./bin/wrangler.js'}}));
 const record=`require('node:fs').appendFileSync(${JSON.stringify(log)},JSON.stringify(record)+'\\n');`;
 writeFileSync(join(bin,'pnpm'),`#!/usr/bin/env node\nconst record={kind:'audit',credential:!!process.env.CLOUDFLARE_API_TOKEN,unrelated:!!process.env.UNRELATED_SECRET};${record}process.exit(${auditFailure?1:0});`,{mode:0o700});
 writeFileSync(join(workspace,'node_modules/wrangler/bin/wrangler.js'),`const fs=require('node:fs');const args=process.argv.slice(2),cfg=JSON.parse(fs.readFileSync(args[args.indexOf('--config')+1]));const record={kind:args.includes('--dry-run')?(args.includes('--no-bundle')?'validate':'build'):args[0]==='secret'?'secret':'upload',app:cfg.name,credential:process.env.CLOUDFLARE_API_TOKEN??null,account:process.env.CLOUDFLARE_ACCOUNT_ID??null,unrelated:!!process.env.UNRELATED_SECRET,nodeControl:!!process.env.NODE_EXTRA_CA_CERTS,apiOverride:!!process.env.CLOUDFLARE_API_BASE_URL,ciOverride:!!process.env.CI_WORKER_NAME,noBundle:args.includes('--no-bundle'),dotenvDisabled:args.includes('--env-file=/dev/null'),ignoredFiles:fs.existsSync('.env')||fs.existsSync('.npmrc')||fs.existsSync('.private/OWNER_API_TOKEN'),selectedOwner:args[0]==='secret'?fs.readFileSync(0,'utf8'):null};${record}if(record.kind==='build'){const out=args[args.indexOf('--outdir')+1];fs.mkdirSync(out,{recursive:true});fs.writeFileSync(require('node:path').join(out,'worker.js'),'export default {};');}${snapshotEdit?"if(record.kind==='build')fs.appendFileSync(cfg.main,'// changed snapshot');":''}${artifactEdit?"if(record.kind==='validate')fs.appendFileSync(cfg.main,'// changed artifact');":''}${extraAsset?"if(record.kind==='build')fs.writeFileSync(require('node:path').join(cfg.assets.directory,'unreviewed.txt'),'synthetic unrelated asset');":''}`);
 const calls=()=>existsSync(log)?readFileSync(log,'utf8').trim().split('\n').map(row=>JSON.parse(row)):[];
 return {root,workspace,sources,env,calls,cleanup:()=>rmSync(root,{recursive:true,force:true})};
}

test('promotion compiles both verified snapshots without credentials before selected uploads',()=>{
 const f=fixture();try{
  promoteComposition(f);const calls=f.calls();assert.deepEqual(calls.map(c=>c.kind),['audit','build','validate','build','validate','secret','upload','secret','upload']);
  for(const c of calls){assert.equal(c.unrelated,false);if(c.kind==='audit'){assert.equal(c.credential,false);continue;}assert.equal(c.nodeControl,false);assert.equal(c.apiOverride,false);assert.equal(c.ciOverride,false);assert.equal(c.dotenvDisabled,true);assert.equal(c.ignoredFiles,false);assert.equal(c.credential,['build','validate'].includes(c.kind)?null:'synthetic-selected-upload');if(c.kind==='upload')assert.equal(c.noBundle,true);if(c.kind==='secret')assert.equal(c.selectedOwner,c.app.includes('guestbook')?'synthetic-owner-guestbook':'synthetic-owner-showcase');}
  const config=JSON.parse(readFileSync(join(f.workspace,'wrangler.jsonc')));assert.equal(config.services.length,2);
 }finally{f.cleanup();}
});

test('dry run never supplies a credential, reads an owner token or changes root bindings',()=>{
 const f=fixture();try{const before=readFileSync(join(f.workspace,'wrangler.jsonc'));for(const source of Object.values(f.sources))rmSync(join(source,'.private/OWNER_API_TOKEN'));promoteComposition({...f,dryRun:true});assert.deepEqual(f.calls().map(c=>c.kind),['audit','build','validate','build','validate']);assert.ok(readFileSync(join(f.workspace,'wrangler.jsonc')).equals(before));assert.ok(f.calls().every(c=>!c.credential));}finally{f.cleanup();}
});

test('audit failure, hidden source edits compiled snapshot edits, artifact edits and extra assets stop before cloud mutations',()=>{
 for(const options of [{auditFailure:true},{snapshotEdit:true},{artifactEdit:true},{extraAsset:true},{customBuild:true},{hiddenSource:true}]){
  const f=fixture(options);try{
   if(options.hiddenSource){execFileSync('git',['update-index','--assume-unchanged','src/worker.ts'],{cwd:f.sources.guestbook,stdio:'pipe'});writeFileSync(join(f.sources.guestbook,'src/worker.ts'),'changed hidden source');}
   assert.throws(()=>promoteComposition(f));assert.ok(f.calls().every(c=>!['secret','upload'].includes(c.kind)));assert.deepEqual(JSON.parse(readFileSync(join(f.workspace,'wrangler.jsonc'))).services,[]);
  }finally{f.cleanup();}
 }
});

test('linked root targets are refused before any build or cloud mutation',()=>{
 for(const kind of ['hard','symbolic']){const f=fixture();try{const target=join(f.workspace,'wrangler.jsonc'),owner=join(f.root,'owner.json'),bytes=readFileSync(target);writeFileSync(owner,bytes);rmSync(target);if(kind==='hard')linkSync(owner,target);else symlinkSync(owner,target);assert.throws(()=>promoteComposition(f),/unlinked regular file/);assert.deepEqual(f.calls(),[]);assert.ok(readFileSync(owner).equals(bytes));}finally{f.cleanup();}}
});
test('member promotion connects only the reviewed named service and finite separate credentials',()=>{
 const f=fixture({members:true});try{
  promoteComposition(f);
  assert.deepEqual(f.calls().filter(c=>c.kind==='secret').map(c=>c.selectedOwner),['synthetic-owner-guestbook','synthetic-member-guestbook','synthetic-owner-showcase','synthetic-member-showcase']);
  const connected=JSON.parse(readFileSync(join(f.workspace,'wrangler.jsonc')));
  assert.equal(connected.services.length,3);
  assert.deepEqual(connected.services[2],{binding:'GUESTBOOK_MEMBERS',service:'composer-guestbook-'+ 'b'.repeat(16),entrypoint:'GuestbookMemberService'});
 }finally{f.cleanup();}
});
test('missing or equal member credentials stop all uploads before the first cloud mutation',()=>{
 for(const missing of [true,false]){const f=fixture({members:true});try{
  const path=join(f.sources.showcase,'.private/COMPOSER_PROFILE_BRIDGE_TOKEN');
  if(missing)rmSync(path);else writeFileSync(path,'synthetic-owner-showcase');
  assert.throws(()=>promoteComposition(f));
  assert.ok(f.calls().every(c=>!['secret','upload'].includes(c.kind)));
 }finally{f.cleanup();}}
});

import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {join} from 'node:path';
import {ownedFixture} from './fixtures/owned-reference.mjs';
import {runReadinessCommand} from '../lib/get-ready/check.mjs';
import {wranglerEnvironment} from '../lib/get-ready/local-checks.mjs';
import {referenceDeployment} from '../lib/get-ready/local.mjs';
import {createLocalAdapter,discoverWorkspace,ReadinessFailure,recipe,createReadinessSession,runReadinessSession,inspectReadiness} from '../lib/get-ready/index.mjs';
const version='11111111-2222-4333-8444-555555555555';

const reply=result=>Response.json({success:true,result});
function provider(f,mode='success'){
 let inventory=0;
 return async url=>{
  if(url.endsWith('/build.json'))return Response.json({app:'hello',commit:f.source,title:'Fictional welcome',contract:1,dataVersion:1});
  if(url.endsWith('/scripts')){
   inventory++;
   if(mode==='provider-edit'&&inventory===1){f.git(['update-index','--assume-unchanged','worker.txt']);writeFileSync(join(f.workspace,'worker.txt'),'Owner edit during provider read\n');}
   return reply(mode==='collision'||(mode==='late-collision'&&inventory>1)?[{id:f.context.worker}]:[]);
  }
  if(url.includes('/scripts/'))return reply({enabled:true});
  return reply({subdomain:'fixture'});
 };
}

test('owned initial deployment requires all three fresh capabilities and read-only resume never repeats it',async()=>{
 const f=ownedFixture();try{
  const calls=[];const adapter={checks:recipe.checks.map(id=>({id,label:id,verify:async()=>{calls.push(id);return {checked:true};}})),deployOwnedReference:async()=>{calls.push('deploy');return {created:true,version};}};
  const session=await runReadinessSession(createReadinessSession(f.context),adapter,()=>{},{operation:'deploy-owned-reference'});assert.deepEqual(calls,['agent','github','cloudflare','deploy','https']);assert.equal(inspectReadiness(session).ready,true);
  calls.length=0;await runReadinessSession(createReadinessSession(f.context,session),adapter);assert.deepEqual(calls,recipe.checks);
  adapter.checks=adapter.checks.map(check=>check.id==='github'?{...check,verify:async()=>{throw new ReadinessFailure('permission');}}:check);adapter.deployOwnedReference=async()=>assert.fail('Denied push cannot deploy');assert.equal((await runReadinessSession(createReadinessSession(f.context),adapter,()=>{},{operation:'deploy-owned-reference'})).operation.state,'blocked');
 }finally{f.cleanup();}
});

test('actual owned adapter builds only committed source, isolates ignored owner files and secrets, then verifies exact routing/source',async()=>{
 const f=ownedFixture(),prior=globalThis.fetch;try{
  globalThis.fetch=provider(f);const result=await createLocalAdapter(f.context,{...f.env,WRANGLER_CI_OVERRIDE_NAME:'unrelated-owner-worker',CLOUDFLARE_API_BASE_URL:'https://untrusted.example.test',CF_API_BASE_URL:'https://untrusted.example.test',RESEND_API_KEY:'fictional-unrelated-key',NODE_OPTIONS:'--require=/fictional/not-permitted.cjs'}).deployOwnedReference();assert.equal(result.created,true);assert.equal(result.commit,f.source);assert.equal(result.baseline,f.baseline);assert.equal(result.version,version);
  const events=f.events();assert.equal(events.length,2);assert.equal(events[0].dryRun,true);assert.equal(events[1].dryRun,false);assert.ok(events.every(event=>event.cwd!==f.workspace&&!event.ignored&&!event.overrides&&event.envFileDisabled));assert.equal(events[0].token,false);assert.equal(events[1].token,true);assert.equal(existsSync(events[0].cwd),false);assert.equal(f.git(['status','--porcelain']),'');
  globalThis.fetch=provider(f,'collision');await assert.rejects(createLocalAdapter(f.context,f.env).deployOwnedReference(),error=>error.code==='configuration');assert.equal(f.events().length,2);
  for(const file of ['.env','.npmrc','.pnpmfile.cjs'])assert.equal(readFileSync(join(f.workspace,file),'utf8'),'Ignored owner work\n');
 }finally{globalThis.fetch=prior;f.cleanup();}
});

test('tracked source checks run from the frozen snapshot with stripped environment before Wrangler',async()=>{
 const prior=globalThis.fetch;
 for(const mode of ['source-success','source-failure','source-mutation']){
  const f=ownedFixture(mode);try{
   globalThis.fetch=provider(f);
   const adapter=createLocalAdapter(f.context,{...f.env,RESEND_API_KEY:'fictional-other-key',NODE_OPTIONS:'--require=/fictional/not-permitted.cjs',WRANGLER_CI_OVERRIDE_NAME:'unrelated-worker',CLOUDFLARE_API_BASE_URL:'https://untrusted.example.test'});
   if(mode==='source-success')await adapter.deployOwnedReference();
   else await assert.rejects(adapter.deployOwnedReference());
   const checked=JSON.parse(readFileSync(join(f.root,'source-check.json'),'utf8'));
   assert.notEqual(checked.cwd,f.workspace);assert.deepEqual(checked.args,['--check']);assert.equal(existsSync(checked.cwd),false,'owned staging is removed after both success and failure');
   assert.equal(f.events().length,mode==='source-success'?2:0,'a failed or mutating source check cannot reach Wrangler');
   assert.equal(f.git(['status','--porcelain']),'','the selected owner workspace stays unchanged');
  }finally{globalThis.fetch=prior;f.cleanup();}
 }
});

test('an ignored owner build script cannot join a legacy reviewed snapshot',async()=>{
 const f=ownedFixture(),prior=globalThis.fetch;try{
  mkdirSync(join(f.workspace,'scripts'));writeFileSync(join(f.workspace,'scripts/build-source.mjs'),"throw Error('Ignored owner code must not execute');\n");
  writeFileSync(join(f.workspace,'.git/info/exclude'),readFileSync(join(f.workspace,'.git/info/exclude'),'utf8')+'scripts/\n');
  assert.equal(f.git(['status','--porcelain']),'');globalThis.fetch=provider(f);
  await createLocalAdapter(f.context,f.env).deployOwnedReference();assert.equal(f.events().length,2);
  assert.match(readFileSync(join(f.workspace,'scripts/build-source.mjs'),'utf8'),/Ignored owner code/);
 }finally{globalThis.fetch=prior;f.cleanup();}
});

test('unreviewed executable/data inventory, deployment bindings, public ownership and denied writes cannot reach build or upload',async()=>{
 const prior=globalThis.fetch;
 for(const mode of ['code','new-file','bad-profile','public','denied']){
  const f=ownedFixture(mode);try{
   globalThis.fetch=async()=>assert.fail('Invalid source/authority cannot request target availability');
   await assert.rejects(createLocalAdapter(f.context,f.env).deployOwnedReference(),error=>error instanceof ReadinessFailure&&(mode!=='denied'||error.code==='permission'));assert.deepEqual(f.events(),[]);assert.equal(f.git(['status','--porcelain']),'');
  }finally{globalThis.fetch=prior;f.cleanup();}
 }
});

test('hidden provider-wait edits, build-time edits and newly occupied names refuse upload and preserve owner work',async()=>{
 const prior=globalThis.fetch;
 for(const mode of ['provider-edit','build-edit','collision','late-collision']){
  const f=ownedFixture(mode);try{
   globalThis.fetch=provider(f,mode);await assert.rejects(createLocalAdapter(f.context,f.env).deployOwnedReference(),error=>error instanceof ReadinessFailure);assert.ok(f.events().every(event=>event.dryRun));
   if(mode.endsWith('edit'))assert.match(readFileSync(join(f.workspace,'worker.txt'),'utf8'),/Owner edit during/);
  }finally{globalThis.fetch=prior;f.cleanup();}
 }
});

test('Wrangler tooling receives only selected credentials and safe controls, excluding CI/API/Node overrides',()=>{const selected=wranglerEnvironment({PATH:'/fixture/bin',HOME:'/fixture/home',CLOUDFLARE_API_TOKEN:'fictional-token',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),WRANGLER_CI_OVERRIDE_NAME:'unrelated',CF_API_BASE_URL:'https://untrusted.example.test',CLOUDFLARE_API_BASE_URL:'https://untrusted.example.test',NODE_OPTIONS:'--import=/fixture/untrusted.mjs',RESEND_API_KEY:'fictional-other-key'});assert.deepEqual(selected,{PATH:'/fixture/bin',HOME:'/fixture/home',CLOUDFLARE_API_TOKEN:'fictional-token',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'});});

test('actual isolated Wrangler argv retains strict auth/identity classification',()=>{
 const args=['/fictional/node_modules/wrangler/bin/wrangler.js','whoami','--json','--env-file=/dev/null'];
 for(const output of ['{}','{"loggedIn":"false","accounts":[]}','{"loggedIn":true}','not JSON'])assert.throws(()=>runReadinessCommand(process.execPath,args,{},()=>output),error=>error instanceof ReadinessFailure&&error.code==='response');
 assert.throws(()=>runReadinessCommand(process.execPath,args,{},()=>'{"loggedIn":false,"accounts":[]}'),error=>error instanceof ReadinessFailure&&error.code==='authentication');
 assert.throws(()=>runReadinessCommand(process.execPath,args,{},()=>{throw {status:1,stderr:'{"loggedIn":false}'};}),error=>error instanceof ReadinessFailure&&error.code==='authentication');
 assert.equal(runReadinessCommand(process.execPath,args,{},()=>'{"loggedIn":true,"accounts":[]}'),'{"loggedIn":true,"accounts":[]}');
});

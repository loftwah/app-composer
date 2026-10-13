import test from 'node:test';import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,linkSync} from 'node:fs';import {join} from 'node:path';
import {ownedFixture} from './fixtures/owned-reference.mjs';
import {ownedHelloConfiguration,verifyOwnedDeploymentVersion} from '../lib/get-ready/local.mjs';
import {createLocalAdapter,discoverWorkspace,ReadinessFailure,recipe,createReadinessSession,runReadinessSession,inspectReadiness} from '../lib/get-ready/index.mjs';
import {helloConfiguration} from '../src/lib/hello-spec.mjs';
const version='11111111-2222-4333-8444-555555555555',changedVersion='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const configuration={title:'A place to begin',intro:'A fictional first app, configured through Init.',theme:'daylight'};
const reply=result=>Response.json({success:true,result});
function bindMain(f,source){
 writeFileSync(join(f.root,'bin/gh'),`#!/bin/sh\ncase "$2" in\n user) printf '{"login":"fixture"}\\n' ;;\n repos/fixture/hello) printf '{"full_name":"fixture/hello","owner":{"login":"fixture"},"private":true,"default_branch":"main","permissions":{"push":true}}\\n' ;;\n repos/loftwah/app-composer-hello/commits/main) printf '${f.baseline}\\n' ;;\n repos/fixture/hello/commits/${f.source}) printf '${f.source}\\n' ;;\n *) printf '${source}\\n' ;;\nesac\n`,{mode:0o755});
}
function provider(f,{previousSource=f.source,activeVersion=version,edit=false,lateVersion=false,finalHttpsChange=false}={}){
 let probes=0,identities=0,versionChanged=false;
 return async url=>{
  if(url.includes('/deployments?')){probes++;const uploaded=f.events().some(event=>!event.dryRun);return reply({deployments:[{versions:[{version_id:uploaded?version:(versionChanged||(lateVersion&&probes>2))?changedVersion:activeVersion,percentage:100}]}]});}
  if(url.endsWith('/build.json')){
   identities++;if(finalHttpsChange&&identities===2)versionChanged=true;
   if(edit){f.git(['update-index','--assume-unchanged','config.json']);writeFileSync(join(f.workspace,'config.json'),JSON.stringify({...configuration,title:'Owner edit during HTTPS check'}));}
   const uploaded=f.events().some(event=>!event.dryRun);const current=f.git(['rev-parse','HEAD']);return Response.json({app:'hello',commit:uploaded?current:previousSource,title:uploaded?configuration.title:'Fictional welcome',contract:1,dataVersion:1});
  }
  if(url.includes('/scripts/'))return reply({enabled:true});return reply({subdomain:'fixture'});
 };
}

test('owned fields and verified workers.dev specs remain data; purchases, bad fields and other hosts are refused',()=>{
 assert.deepEqual(ownedHelloConfiguration(configuration),configuration);assert.equal(ownedHelloConfiguration({...configuration,intro:'First line\nSecond line\tWith a tab'}).intro,'First line\nSecond line\tWith a tab');
 for(const patch of [{title:''},{intro:'a'.repeat(241)},{theme:'other'},{token:'fictional-key'},{title:'\u0000'}])assert.throws(()=>ownedHelloConfiguration({...configuration,...patch}));
 const spec={version:1,preset:'hello',config:{...configuration,layout:'grid'},privacy:'review-first',cards:[],deployment:{mode:'preview',hostname:''},decisions:{}};
 assert.deepEqual(helloConfiguration(spec,'https://my-first-app.fixture.workers.dev',{allowVerifiedWorkersDev:true}),configuration);
 assert.throws(()=>helloConfiguration(spec,'https://my-first-app.fixture.workers.dev'));
 assert.throws(()=>helloConfiguration(spec,'https://other.example.test',{allowVerifiedWorkersDev:true}));
 assert.throws(()=>helloConfiguration({...spec,deployment:{mode:'new-domain',hostname:''}},'https://my-first-app.fixture.workers.dev',{allowVerifiedWorkersDev:true}));
});

test('owned configuration is local-only, stays action-required when changed and never retries automatically',async()=>{
 const f=ownedFixture();try{
  let writes=0;const adapter={checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({checked:true})})),configureOwnedReference:async value=>{assert.deepEqual(value,configuration);writes++;return {changed:true,deployed:false};}};
  const result=await runReadinessSession(createReadinessSession(f.context),adapter,()=>{},{operation:'configure-owned-reference',configuration});assert.equal(result.operation.state,'performed');assert.equal(result.state,'action_required');assert.equal(result.expiresAt,null);assert.equal(inspectReadiness(result).ready,false);assert.ok(inspectReadiness(result).next.some(step=>step.operation==='configure-owned-reference'));
  await runReadinessSession(createReadinessSession(f.context,result),adapter);assert.equal(writes,1);
  await assert.rejects(runReadinessSession(createReadinessSession(f.context),adapter,()=>{},{operation:'deploy-owned-reference',configuration}));
 }finally{f.cleanup();}
});

test('actual Init preparation changes only config.json and preserves hard-linked files and hidden HTTPS-wait edits',async()=>{
 const prior=globalThis.fetch;
 for(const mode of ['success','unchanged','hardlink','edit']){
  const f=ownedFixture();try{
   const before=readFileSync(join(f.workspace,'config.json'),'utf8');if(mode==='hardlink')linkSync(join(f.workspace,'config.json'),join(f.root,'outside-owner.json'));
   globalThis.fetch=provider(f,{edit:mode==='edit'});const adapter=createLocalAdapter(f.context,f.env);
   if(mode==='unchanged'){const result=await adapter.configureOwnedReference({title:'Fictional welcome',intro:'Fictional starter',theme:'midnight'});assert.equal(result.changed,false);assert.equal(f.git(['status','--porcelain']),'');assert.equal(readFileSync(join(f.workspace,'config.json'),'utf8'),before);}
   else if(mode==='success'){const result=await adapter.configureOwnedReference(configuration);assert.equal(result.changed,true);assert.equal(result.deployed,false);assert.deepEqual(JSON.parse(readFileSync(join(f.workspace,'config.json'),'utf8')),configuration);assert.equal(f.git(['status','--porcelain']),'M config.json');assert.equal(f.git(['rev-parse','HEAD']),f.source);}
   else{await assert.rejects(adapter.configureOwnedReference(configuration),error=>error instanceof ReadinessFailure);if(mode==='hardlink'){assert.equal(readFileSync(join(f.workspace,'config.json'),'utf8'),before);assert.equal(readFileSync(join(f.root,'outside-owner.json'),'utf8'),before);}else assert.match(readFileSync(join(f.workspace,'config.json'),'utf8'),/Owner edit during/);}
   assert.deepEqual(f.events(),[]);
  }finally{globalThis.fetch=prior;f.cleanup();}
 }
});

test('active deployment check uses exact account/Worker and rejects stale versions, split traffic and malformed provider state',async()=>{
 const f=ownedFixture();try{
  let requested;assert.deepEqual(await verifyOwnedDeploymentVersion(f.context,version,f.env,async(url,options)=>{requested=url;assert.equal(options.redirect,'error');return reply({deployments:[{versions:[{version_id:version,percentage:100}]}]});}),{version});assert.ok(requested.includes('/accounts/'+f.context.account+'/workers/scripts/'+f.context.worker+'/deployments?page=1&per_page=1'));
  for(const result of [{deployments:[]},{deployments:[{versions:[{version_id:changedVersion,percentage:100}]}]},{deployments:[{versions:[{version_id:version,percentage:50},{version_id:changedVersion,percentage:50}]}]}])await assert.rejects(verifyOwnedDeploymentVersion(f.context,version,f.env,async()=>reply(result)),error=>error instanceof ReadinessFailure);
 }finally{f.cleanup();}
});

test('controlled owned update shares the snapshot release and refuses stale/late provider versions and foreign previous source',async()=>{
 const prior=globalThis.fetch;
 for(const mode of ['success','stale','late','final-https','foreign']){
  const f=ownedFixture();try{
   writeFileSync(join(f.workspace,'config.json'),JSON.stringify(configuration,null,2)+'\n');f.git(['add','config.json']);f.git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Synthetic owned Init']);const source=f.git(['rev-parse','HEAD']);f.git(['update-ref','refs/remotes/origin/main',source]);bindMain(f,source);
   const context={...f.context,...discoverWorkspace(f.workspace)};globalThis.fetch=provider(f,{activeVersion:mode==='stale'?changedVersion:version,lateVersion:mode==='late',finalHttpsChange:mode==='final-https'});
   const adapter=createLocalAdapter(context,f.env),previous={source:mode==='foreign'?f.baseline:f.source,version};
   if(mode==='success'){const result=await adapter.updateOwnedReference(previous);assert.equal(result.updated,true);assert.equal(result.created,false);assert.equal(result.commit,source);assert.equal(f.events().filter(event=>!event.dryRun).length,1);}
   else{await assert.rejects(adapter.updateOwnedReference(previous),error=>error instanceof ReadinessFailure);assert.ok(f.events().every(event=>event.dryRun));}
   assert.equal(f.git(['status','--porcelain']),'');assert.deepEqual(JSON.parse(readFileSync(join(f.workspace,'config.json'),'utf8')),configuration);
  }finally{globalThis.fetch=prior;f.cleanup();}
 }
});

test('direct update adapter cannot turn absent or malformed previous intent into creation',async()=>{
 const f=ownedFixture(),prior=globalThis.fetch;try{
  globalThis.fetch=async()=>assert.fail('Absent update authority cannot reach a provider');
  for(const previous of [null,undefined,false,{},[],{source:f.source},{source:f.source,version,token:'fictional-key'}])await assert.rejects(createLocalAdapter(f.context,f.env).updateOwnedReference(previous),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  assert.deepEqual(f.events(),[]);assert.equal(f.git(['status','--porcelain']),'');
 }finally{globalThis.fetch=prior;f.cleanup();}
});

import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {ownedFixture} from './fixtures/owned-reference.mjs';
import {createLocalAdapter,discoverWorkspace,ReadinessFailure} from '../lib/get-ready/index.mjs';
import {referenceReleaseEnvironment} from '../lib/get-ready/local.mjs';
const repository='loftwah/app-composer-hello';
function maintainedFixture(mode){
 const f=ownedFixture(mode);f.git(['remote','set-url','origin','https://github.com/'+repository+'.git']);
 // The authored fixture contract is executed from the verified source snapshot.
 writeFileSync(join(f.workspace,'release-target.mjs'),`export function expectedTarget(env){if(env.WRANGLER_CI_OVERRIDE_NAME||env.CLOUDFLARE_API_BASE_URL||env.RESEND_API_KEY||env.NODE_OPTIONS)throw Error('Ambient controls reached target contract');return {repository:env.HELLO_REPOSITORY,account:env.HELLO_ACCOUNT_ID,worker:env.HELLO_WORKER,origin:env.HELLO_ORIGIN};}\nexport function verifyTarget(config,target,remote){if(target.repository!==${JSON.stringify(repository)}||remote!=='https://github.com/'+target.repository+'.git'||config.account_id!==target.account||config.name!==target.worker||config.vars.PUBLIC_ORIGIN!==target.origin)throw Error('Selected scope was lost');return target;}\n`);
 f.git(['add','release-target.mjs']);f.git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Synthetic authored target contract']);const source=f.git(['rev-parse','HEAD']);f.git(['update-ref','refs/remotes/origin/main',source]);
 writeFileSync(join(f.root,'bin/gh'),'#!/bin/sh\nprintf "'+source+'\\n"\n',{mode:0o755});
 // A legacy package-script invocation must never be used for this deployment.
 writeFileSync(join(f.root,'bin/pnpm'),'#!/bin/sh\nprintf "unsafe legacy shell" > "'+join(f.root,'legacy-script')+'"\nexit 1\n',{mode:0o755});
 const context={...f.context,...discoverWorkspace(f.workspace),target:{origin:f.context.target.origin,repo:repository}};
 return {...f,source,context};
}

test('maintained release environment carries selected scope without CI/API/Node or unrelated-service controls',()=>{
 const context={repo:repository,account:'a'.repeat(32),worker:'selected-worker',target:{origin:'https://selected.fixture.workers.dev'}};
 const env=referenceReleaseEnvironment(context,{PATH:'/fixture/bin',HOME:'/fixture/home',CLOUDFLARE_API_TOKEN:'fictional-token',WRANGLER_CI_OVERRIDE_NAME:'another-worker',CLOUDFLARE_API_BASE_URL:'https://untrusted.example.test',CF_API_BASE_URL:'https://untrusted.example.test',NODE_OPTIONS:'--require=/fictional/untrusted.cjs',RESEND_API_KEY:'fictional-other-key',HELLO_WORKER:'another-worker'});
 assert.equal(env.HELLO_WORKER,context.worker);assert.equal(env.HELLO_REPOSITORY,context.repo);assert.equal(env.CLOUDFLARE_API_TOKEN,'fictional-token');assert.equal(env.GH_HOST,'github.com');
 for(const key of ['WRANGLER_CI_OVERRIDE_NAME','CLOUDFLARE_API_BASE_URL','CF_API_BASE_URL','NODE_OPTIONS','RESEND_API_KEY'])assert.equal(env[key],undefined);
});

test('maintained deployment uses the same isolated pinned build/upload and refuses non-dependency source edits',async()=>{
 const prior=globalThis.fetch;
 for(const mode of ['success','hidden-source','build-edit']){
  const f=maintainedFixture(mode);try{
   if(mode==='hidden-source'){f.git(['update-index','--assume-unchanged','worker.txt']);writeFileSync(join(f.workspace,'worker.txt'),'Owner hidden code\n');}
   globalThis.fetch=async url=>url.endsWith('/build.json')?Response.json({app:'hello',commit:f.source,title:'Fictional welcome',contract:1,dataVersion:1}):Response.json({success:true,result:url.includes('/scripts/')?{enabled:true}:{subdomain:'fixture'}});
   const adapter=createLocalAdapter(f.context,{...f.env,WRANGLER_CI_OVERRIDE_NAME:'another-worker',CLOUDFLARE_API_BASE_URL:'https://untrusted.example.test',NODE_OPTIONS:'--require=/fictional/untrusted.cjs',RESEND_API_KEY:'fictional-other-key'});
   if(mode==='success'){
    const result=await adapter.deployReference();assert.equal(result.created,false);assert.equal(result.updated,true);assert.equal(result.commit,f.source);assert.equal(result.repository,repository);
    const events=f.events();assert.equal(events.length,2);assert.ok(events.every(event=>!event.ignored&&!event.overrides&&event.envFileDisabled&&event.cwd!==f.workspace));assert.equal(events[0].token,false);assert.equal(events[1].token,true);assert.equal(f.git(['status','--porcelain']),'');
   }else{await assert.rejects(adapter.deployReference(),error=>error instanceof ReadinessFailure);assert.ok(f.events().every(event=>event.dryRun));assert.match(readFileSync(join(f.workspace,'worker.txt'),'utf8'),/Owner/);}
   for(const file of ['.env','.npmrc','.pnpmfile.cjs'])assert.equal(readFileSync(join(f.workspace,file),'utf8'),'Ignored owner work\n');
  }finally{globalThis.fetch=prior;f.cleanup();}
 }
});

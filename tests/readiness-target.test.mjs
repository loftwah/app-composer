import test from 'node:test';import assert from 'node:assert/strict';
import {referenceDeployment,verifyNewWorkersDevTarget} from '../lib/get-ready/local.mjs';
import {recipe,createReadinessSession,runReadinessSession,inspectReadiness,ReadinessFailure,createLocalAdapter,discoverWorkspace} from '../lib/get-ready/index.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,realpathSync,linkSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
const scope={workspace:'/fictional/hello',repo:'fixture/hello',source:'a'.repeat(40),dirty:false,account:'b'.repeat(32),worker:'my-first-app',target:{origin:'https://my-first-app.fixture.workers.dev',repo:'fixture/hello'}};
import {fixture} from './fixtures/readiness-target.mjs';
const response=body=>Response.json({success:true,result:body});

test('target profile binds workers.dev to the selected account namespace and has no launch routes, data/services or previews',()=>{
 const config=referenceDeployment(scope,'2026-10-13','fixture');assert.equal(config.name,scope.worker);assert.equal(config.account_id,scope.account);assert.equal(config.vars.PUBLIC_ORIGIN,scope.target.origin);assert.equal(config.limits.cpu_ms,10);assert.equal(config.preview_urls,false);assert.equal(config.routes,undefined);assert.equal(config.services,undefined);assert.equal(config.d1_databases,undefined);
 for(const input of [{...scope,account:'invalid'},{...scope,worker:'Other/App'},{...scope,target:{origin:'https://my-first-app.another.workers.dev'}}])assert.throws(()=>referenceDeployment(input,'2026-10-13','fixture'),error=>error instanceof ReadinessFailure&&error.code==='configuration');
});

test('name selection reads only the exact account and rejects collisions, other subdomains, malformed/partial inventory and denied permission',async()=>{
 const requests=[];const env={CLOUDFLARE_API_TOKEN:'fictional-only'};
 const request=async(url,options)=>{requests.push({url,method:options.method??'GET',redirect:options.redirect});return response(url.endsWith('/subdomain')?{subdomain:'fixture'}:[{id:'unrelated-app'}]);};
 assert.deepEqual(await verifyNewWorkersDevTarget(scope,env,request),{subdomain:'fixture',available:true});assert.equal(requests.length,2);assert.ok(requests.every(r=>r.url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+scope.account+'/workers/')&&r.method==='GET'&&r.redirect==='error'));
 const cases=[
  [async url=>response(url.endsWith('/subdomain')?{subdomain:'another'}:[]),'configuration'],
  [async url=>response(url.endsWith('/subdomain')?{subdomain:'fixture'}:[{id:scope.worker}]),'configuration'],
  [async url=>response(url.endsWith('/subdomain')?{subdomain:'fixture'}:[{}]),'response'],
  [async url=>url.endsWith('/subdomain')?response({subdomain:'fixture'}):Response.json({success:true,result:[],result_info:{total_pages:2,total_count:3}}),'response'],
  [async()=>new Response('Private provider body',{status:403}),'permission'],
 ];
 for(const [request,code] of cases)await assert.rejects(verifyNewWorkersDevTarget(scope,env,request),error=>error instanceof ReadinessFailure&&error.code===code);
});

test('preparation executes after selected-account verification, does not grant readiness and exposes its next step without automatic retry',async()=>{
 const calls=[];const adapter={checks:recipe.checks.map(id=>({id,label:id,verify:async()=>{calls.push(id);return {checked:true};}})),prepareReferenceTarget:async()=>{calls.push('prepare');return {changed:true,deployed:false};}};
 const session=await runReadinessSession(createReadinessSession(scope),adapter,()=>{},{operation:'prepare-reference-target'});assert.deepEqual(calls,['agent','github','cloudflare','prepare','https']);assert.equal(session.operation.state,'performed');assert.equal(session.expiresAt,null);const summary=inspectReadiness(session);assert.equal(summary.ready,false);assert.ok(summary.next.some(item=>item.operation==='prepare-reference-target'&&item.state==='prepared'));assert.ok(!JSON.stringify(summary).includes(scope.workspace));
 const blocked={...adapter,checks:adapter.checks.map(check=>check.id==='cloudflare'?{...check,verify:async()=>{throw new ReadinessFailure('authentication');}}:check),prepareReferenceTarget:async()=>assert.fail('Unverified account cannot prepare target')};assert.equal((await runReadinessSession(createReadinessSession(scope),blocked,()=>{},{operation:'prepare-reference-target'})).operation.state,'blocked');
});


test('actual local preparation changes only owned deployment data and preserves source/launch target on collision or provider-wait edits',async()=>{
 const priorFetch=globalThis.fetch;
 for(const mode of ['success','collision','edit','account-conflict','hardlink']){
  const f=fixture();try{
   if(mode==='hardlink')linkSync(join(f.workspace,'wrangler.jsonc'),join(f.root,'outside-owner.jsonc'));
   let reads=0;globalThis.fetch=async url=>{reads++;if(mode==='edit'&&reads===2)writeFileSync(join(f.workspace,'worker.txt'),'Owner work while checking account\n');return response(url.endsWith('/subdomain')?{subdomain:'fixture'}:mode==='collision'?[{id:scope.worker}]:[]);};
   const adapter=createLocalAdapter(f.context,mode==='account-conflict'?{...f.env,CLOUDFLARE_ACCOUNT_ID:'c'.repeat(32)}:f.env);
   if(mode==='success'){
    const result=await adapter.prepareReferenceTarget();assert.equal(result.deployed,false);assert.equal(result.changed,true);assert.deepEqual(JSON.parse(readFileSync(join(f.workspace,'wrangler.jsonc'),'utf8')),referenceDeployment(f.context,'2026-10-13','fixture'));assert.equal(f.git(['rev-parse','HEAD']),f.source);assert.equal(f.git(['status','--porcelain']),'M wrangler.jsonc');assert.equal(reads,4);
    // Caller must review the dirty configuration; successful intent is never repeated automatically.
    await assert.rejects(createLocalAdapter(discoverWorkspace(f.workspace),f.env).prepareReferenceTarget());
   }else{
    await assert.rejects(adapter.prepareReferenceTarget(),error=>error instanceof ReadinessFailure);assert.equal(readFileSync(join(f.workspace,'wrangler.jsonc'),'utf8'),f.original);if(mode==='account-conflict'||mode==='hardlink')assert.equal(reads,0);if(mode==='hardlink')assert.equal(readFileSync(join(f.root,'outside-owner.jsonc'),'utf8'),f.original);if(mode==='edit')assert.equal(readFileSync(join(f.workspace,'worker.txt'),'utf8'),'Owner work while checking account\n');
   }
   assert.equal(existsSync(join(f.workspace,'.private/deploy')),false);
  }finally{globalThis.fetch=priorFetch;f.cleanup();}
 }
});

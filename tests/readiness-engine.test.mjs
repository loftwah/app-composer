import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReadinessSession,runReadinessSession,inspectReadiness,recipe,ReadinessFailure,runLocalReadiness,createLocalAdapter} from '../lib/get-ready/index.mjs';

const context=()=>({workspace:'/fictional/hello',repo:'fixture/hello',source:'a'.repeat(40),dirty:false,target:{origin:'https://hello.example.test',repo:'fixture/hello'},account:'b'.repeat(32),worker:'fictional-hello'});
const adapter=(overrides={},calls=[])=>({checks:recipe.checks.map(id=>({id,label:id,action:'Complete official authentication.',verify:async()=>{calls.push(id);if(overrides[id])return overrides[id]();return {checked:true};}}))});

test('standalone core resumes through actual adapters instead of trusting saved green checks',async()=>{
  const calls=[],snapshots=[];
  const initial=await runReadinessSession(createReadinessSession(context()),adapter({cloudflare:async()=>{throw new ReadinessFailure('authentication');}},calls),state=>snapshots.push(structuredClone(state)));
  assert.equal(initial.state,'action_required');assert.equal(initial.expiresAt,null);
  assert.deepEqual(calls,recipe.checks);
  const summary=inspectReadiness(initial);
  assert.equal(summary.capabilities.github,true);assert.equal(summary.capabilities.cloudflare,false);
  assert.ok(!JSON.stringify(summary).includes('/fictional/hello'));
  const resumed=await runReadinessSession(createReadinessSession(context(),initial),adapter());
  assert.equal(resumed.attempt,2);assert.equal(resumed.state,'verified');
  assert.equal(inspectReadiness(resumed,Date.now()+3600001).state,'stale');
  const changed=createReadinessSession({...context(),account:'c'.repeat(32)},resumed);
  assert.equal(changed.attempt,1);assert.deepEqual(changed.checks,{});
  const failed=await runReadinessSession(createReadinessSession(context(),resumed),adapter({github:async()=>{throw new ReadinessFailure('permission');}}));
  assert.equal(failed.state,'action_required');assert.equal(failed.expiresAt,null);
  assert.ok(snapshots.some(s=>s.checks.cloudflare?.state==='verifying'));
});

test('the supported deployment is explicit, runs after fresh prerequisites and still requires HTTPS proof',async()=>{
  const calls=[],a=adapter({},calls);a.deployReference=async()=>{calls.push('deploy');return {version:'fictional'};};
  const verified=await runReadinessSession(createReadinessSession(context()),a,()=>{},{operation:'deploy-reference'});
  assert.deepEqual(calls,['agent','github','cloudflare','deploy','https']);assert.equal(verified.operation.state,'performed');assert.equal(verified.state,'verified');
  const noAction=[];await runReadinessSession(createReadinessSession(context()),{...adapter({},noAction),deployReference:async()=>noAction.push('deploy')});assert.ok(!noAction.includes('deploy'));
  const failed=await runReadinessSession(createReadinessSession(context()),{...adapter(),deployReference:async()=>{throw new ReadinessFailure('unavailable');}},()=>{},{operation:'deploy-reference'});
  assert.equal(failed.checks.https.state,'verified');assert.equal(failed.state,'failed');assert.equal(failed.expiresAt,null);
  let executed=false;
  const blocked=await runReadinessSession(createReadinessSession(context()),{...adapter({github:async()=>{throw new ReadinessFailure('permission');}}),deployReference:async()=>{executed=true;}},()=>{},{operation:'deploy-reference'});
  assert.equal(executed,false);assert.equal(blocked.operation.state,'blocked');
  const outage=await runReadinessSession(createReadinessSession(context()),{...adapter({github:async()=>{throw new ReadinessFailure('unavailable');}}),deployReference:async()=>{executed=true;}},()=>{},{operation:'deploy-reference'});
  assert.equal(executed,false);assert.equal(outage.operation.state,'blocked');assert.equal(outage.state,'failed');assert.equal(outage.expiresAt,null);
  assert.equal(inspectReadiness(outage).next.find(check=>check.check==='github').recovery,'agent-retry');
});

test('cancellation, unknown context secrets, duplicate check adapters and arbitrary operations fail closed',async()=>{
  assert.throws(()=>createReadinessSession({...context(),apiToken:'secret-token'}));
  assert.throws(()=>createReadinessSession({...context(),target:{origin:'https://token@hello.example.test',repo:'fixture/hello'}}));
  for(const field of ['repo','source','account','worker']){
    for(const value of [0,false,{},[], ''])assert.throws(()=>createReadinessSession({...context(),[field]:value}),field);
    assert.doesNotThrow(()=>createReadinessSession({...context(),[field]:null}));
  }
  for(const target of [0,false,[],{origin:'https://hello.example.test',repo:'fixture/hello',apiToken:'secret-token'},{origin:0,repo:'fixture/hello'}])assert.throws(()=>createReadinessSession({...context(),target}));
  const cancelled=await runReadinessSession(createReadinessSession(context()),{checks:[]},()=>{},{cancel:true});
  assert.equal(cancelled.state,'cancelled');assert.equal(cancelled.expiresAt,null);
  await assert.rejects(runReadinessSession(createReadinessSession(context()),adapter(),()=>{},{operation:'arbitrary-shell'}));
  const broken=adapter();broken.checks[3]=broken.checks[0];await assert.rejects(runReadinessSession(createReadinessSession(context()),broken));
});

test('an independent consumer shares the workspace lock and cannot dispatch an unreviewed repository deployment',async()=>{
  const workspace=mkdtempSync(join(tmpdir(),'composer-readiness-test-'));
  try{
    const {mkdirSync}=await import('node:fs');mkdirSync(join(workspace,'.private'));
    writeFileSync(join(workspace,'.private/readiness.lock'),'fictional-owner');
    await assert.rejects(runLocalReadiness({workspace}),/Another readiness run/);
    await assert.rejects(createLocalAdapter({...context(),workspace}).deployReference(),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  }finally{rmSync(workspace,{recursive:true});}
});

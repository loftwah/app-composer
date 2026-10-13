import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadinessFailure, readinessJSON, runReadinessCheck, runReadinessCommand} from '../scripts/readiness-check.mjs';
import {finishReadiness} from '../scripts/readiness-state.mjs';

test('provider outages stay agent-retry failures while independent checks continue and a subsequent run recovers', async () => {
  const state={checks:{}};
  const snapshots=[];
  const save=s=>snapshots.push(structuredClone(s));
  const descriptor={id:'https',label:'HTTPS',action:'MP: authenticate',verify:()=>readinessJSON('https://fixture.example',{},async()=>new Response('provider-private-body',{status:503}))};
  await runReadinessCheck(state,descriptor,save);
  assert.equal(state.checks.https.state,'failed');
  assert.deepEqual(state.checks.https.issue,{code:'unavailable',recovery:'agent-retry',retryable:true});
  assert.ok(!state.checks.https.action.includes('MP:'));
  for(const id of ['agent','github','cloudflare'])await runReadinessCheck(state,{id,label:id,verify:async()=>({checked:true})},save);
  assert.equal(finishReadiness(state).state,'failed');
  assert.equal(finishReadiness(state).expiresAt,null);
  await runReadinessCheck(state,{...descriptor,verify:async()=>({commit:'a'.repeat(40)})},save);
  assert.equal(finishReadiness(state).state,'verified');
  assert.equal(snapshots[0].checks.https.state,'verifying');
  assert.ok(!JSON.stringify(snapshots).includes('provider-private-body'));
});

test('denied permission requests a human capability; malformed responses, unknown errors and source mismatch do not',async()=>{
  const state={checks:{}};
  const verifyPermission=()=>readinessJSON('https://api.cloudflare.com/client/v4/accounts/fixture/workers/domains',{},async()=>new Response('secret-token',{status:403}));
  await runReadinessCheck(state,{id:'https',label:'HTTPS',action:'Approve the required account permission.',verify:verifyPermission},()=>{});
  assert.equal(state.checks.https.issue.recovery,'human-permission');
  assert.equal(state.checks.https.state,'action_required');
  for(const verify of [async()=>{throw new Error('secret-token');},async()=>{throw new ReadinessFailure('source');},()=>readinessJSON('https://fixture.example',{},async()=>new Response('secret-token')),()=>readinessJSON('https://fixture.example',{},async()=>new Response('secret-token',{status:403}))]){
    await runReadinessCheck(state,{id:'https',label:'HTTPS',action:'MP: authenticate',verify},()=>{});
    assert.equal(state.checks.https.issue.recovery,'agent-repair');
    assert.equal(state.checks.https.state,'failed');
    assert.ok(!JSON.stringify(state).includes('secret-token'));
  }
});

test('failed persistence stops the check and cannot fabricate an authentication handoff or success',async()=>{
  const state={checks:{}};
  let executed=false;
  await assert.rejects(runReadinessCheck(state,{id:'https',label:'HTTPS',verify:async()=>{executed=true;}},()=>{throw new Error('disk unavailable');}),/disk unavailable/);
  assert.equal(executed,false);
  assert.equal(state.checks.https.state,'verifying');
});

test('four unrelated verified IDs cannot manufacture readiness',()=>{
  const state={checks:Object.fromEntries(['a','b','c','d'].map(id=>[id,{state:'verified'}]))};
  assert.equal(finishReadiness(state).state,'action_required');
  assert.equal(finishReadiness(state).expiresAt,null);
});

test('CLI authentication absence and expiry retain the human handoff without treating GitHub rate limits as permission',async()=>{
  const cases=[
    {command:'gh',args:['api','repos/fixture/hello'],error:{status:4},code:'authentication'},
    {command:'gh',args:['api','repos/fixture/hello'],error:{status:1,stdout:'HTTP/2.0 401 Unauthorized\r\n\r\nsecret-token'},code:'authentication'},
    {command:'gh',args:['api','repos/fixture/hello'],error:{status:1,stdout:'HTTP/2.0 403 Forbidden\r\nX-RateLimit-Remaining: 0\r\n\r\nsecret-token'},code:'unavailable'},
    {command:'pnpm',args:['exec','wrangler','whoami','--json'],error:{status:1,stderr:'{"loggedIn":false}'},code:'authentication'},
    {command:'pnpm',args:['exec','wrangler','whoami','--json'],error:{status:1,stderr:'DNS lookup failed; secret-token'},code:'unexpected'},
  ];
  for(const item of cases){
    const state={checks:{}};
    await runReadinessCheck(state,{id:'github',label:'CLI',action:'Complete official sign-in.',verify:()=>runReadinessCommand(item.command,item.args,{},()=>{throw item.error;})},()=>{});
    assert.equal(state.checks.github.issue.code,item.code);
    assert.equal(state.checks.github.state,item.code==='authentication'?'action_required':'failed');
    assert.ok(!JSON.stringify(state).includes('secret-token'));
  }
  assert.equal(runReadinessCommand('gh',['api','repos/fixture/hello','--jq','.sha'],{},(_cmd,args)=>{assert.ok(args.includes('--include'));return 'HTTP/2.0 200 OK\r\nContent-Type: application/json\r\n\r\n'+'a'.repeat(40);}), 'a'.repeat(40));
});

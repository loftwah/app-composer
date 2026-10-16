import test from 'node:test';import assert from 'node:assert/strict';
import {githubRepository,referenceTarget,finishReadiness,requireVerifiedReadiness} from '../scripts/readiness-state.mjs';
test('readiness supports a GitHub fork without accepting credential-bearing remotes',()=>{
 assert.equal(githubRepository('git@github.com:fixture-owner/app-composer.git'),'fixture-owner/app-composer');
 assert.equal(githubRepository('https://github.com/fixture-owner/app-composer.git'),'fixture-owner/app-composer');
 assert.throws(()=>githubRepository('https://token@github.com/fixture-owner/app-composer'));
 assert.throws(()=>githubRepository('https://evil.test/fixture-owner/app-composer'));
});
test('reference selection requires a plain HTTPS origin and exact source repository',()=>{
 assert.deepEqual(referenceTarget('https://hello.example.test','fixture-owner/hello'),{origin:'https://hello.example.test',repo:'fixture-owner/hello'});
 for(const url of ['http://hello.example.test','https://token@hello.example.test','https://hello.example.test/?key=secret','https://hello.example.test/path'])assert.throws(()=>referenceTarget(url,'fixture-owner/hello'));
});
test('an interrupted or missing check cannot create ready state or an expiry',()=>{
 const checks={agent:{state:'verified'},github:{state:'verified'},cloudflare:{state:'action_required'},https:{state:'verified'}};
 assert.equal(finishReadiness({checks}).state,'action_required');assert.equal(finishReadiness({checks}).expiresAt,null);
 checks.cloudflare.state='verifying';assert.equal(finishReadiness({checks}).state,'action_required');
 checks.cloudflare.state='verified';const result=finishReadiness({checks},new Date('2026-10-13T00:00:00Z'));assert.equal(result.state,'verified');assert.equal(result.expiresAt,'2026-10-13T01:00:00.000Z');
 delete checks.agent;assert.equal(finishReadiness({checks}).state,'action_required');
});

test('composition apply rejects failed, cancelled, malformed and wrong-context receipts',()=>{
 const context={workspace:'/fictional/composer',repo:'loftwah/app-composer',source:'a'.repeat(40),account:'b'.repeat(32),dirty:false};
 const valid={version:2,recipe:'codex-github-cloudflare-hello-v2',state:'verified',expiresAt:'2026-10-13T01:00:00Z',context:{...context,target:{origin:'https://ready.loftwah.com',repo:'loftwah/app-composer-hello'},worker:'composer-hello'},checks:{agent:{state:'verified',verifiedAt:'2026-10-13T00:00:00Z'},github:{state:'verified',verifiedAt:'2026-10-13T00:00:00Z',evidence:{source:context.source}},cloudflare:{state:'verified',verifiedAt:'2026-10-13T00:00:00Z',evidence:{account:context.account}},https:{state:'verified',verifiedAt:'2026-10-13T00:00:00Z',evidence:{account:context.account}}}};
 const now=Date.parse('2026-10-13T00:00:00Z');assert.doesNotThrow(()=>requireVerifiedReadiness(valid,context,now));
 for(const receipt of [{...valid,state:'action_required',expiresAt:null},{...valid,state:'cancelled',expiresAt:null},{...valid,state:'verifying',expiresAt:undefined},{...valid,expiresAt:'garbage'},{...valid,expiresAt:'2026-10-12T00:00:00Z'},{...valid,version:1}])assert.throws(()=>requireVerifiedReadiness(receipt,context,now));
 for(const changed of [{workspace:'/another'},{source:'c'.repeat(40)},{account:'d'.repeat(32)},{repo:'fixture-owner/app-composer'},{dirty:true}])assert.throws(()=>requireVerifiedReadiness(valid,{...context,...changed},now));
});


test('composition apply shares current capability and unfinished-operation checks with Get Ready',()=>{
 const now=Date.parse('2026-10-16T00:00:00.000Z');
 const context={workspace:'/fictional/composer',repo:'loftwah/app-composer',source:'a'.repeat(40),account:'b'.repeat(32),dirty:false};
 const valid={version:2,recipe:'codex-github-cloudflare-hello-v2',state:'verified',expiresAt:new Date(now+3600000).toISOString(),context:{...context,target:{origin:'https://ready.loftwah.com',repo:'loftwah/app-composer-hello'},worker:'composer-hello'},checks:Object.fromEntries(['agent','github','cloudflare','https'].map(id=>[id,{state:'verified',verifiedAt:new Date(now).toISOString(),evidence:{source:context.source,account:context.account}}]))};
 assert.doesNotThrow(()=>requireVerifiedReadiness(valid,context,now));
 for(const mutate of [
  r=>r.checks.agent.verifiedAt=new Date(now-3600000).toISOString(),
  r=>delete r.checks.github.verifiedAt,
  r=>r.checks.https.verifiedAt=new Date(now+1).toISOString(),
  r=>r.pendingOperations=[{id:'deploy-reference',state:'failed',recovery:'agent-recheck'}],
  r=>r.operation={id:'prepare-site-skills',state:'performed'},
 ]){const receipt=structuredClone(valid);mutate(receipt);assert.throws(()=>requireVerifiedReadiness(receipt,context,now),'A future overall expiry must not override stale checks or unfinished work');}
 assert.throws(()=>requireVerifiedReadiness(valid,{...context,source:'c'.repeat(40)},now),'A changed source cannot inherit the prior pass');
 assert.doesNotThrow(()=>requireVerifiedReadiness(valid,context,now+3599999));
 assert.throws(()=>requireVerifiedReadiness(valid,context,now+3600000));
});

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
 const valid={version:2,recipe:'codex-github-cloudflare-hello-v2',state:'verified',expiresAt:'2026-10-13T01:00:00Z',context:{...context,target:{origin:'https://ready.loftwah.com',repo:'loftwah/app-composer-hello'},worker:'composer-hello'},checks:{agent:{state:'verified'},github:{state:'verified',evidence:{source:context.source}},cloudflare:{state:'verified',evidence:{account:context.account}},https:{state:'verified',evidence:{account:context.account}}}};
 const now=Date.parse('2026-10-13T00:00:00Z');assert.doesNotThrow(()=>requireVerifiedReadiness(valid,context,now));
 for(const receipt of [{...valid,state:'action_required',expiresAt:null},{...valid,state:'cancelled',expiresAt:null},{...valid,state:'verifying',expiresAt:undefined},{...valid,expiresAt:'garbage'},{...valid,expiresAt:'2026-10-12T00:00:00Z'},{...valid,version:1}])assert.throws(()=>requireVerifiedReadiness(receipt,context,now));
 for(const changed of [{workspace:'/another'},{source:'c'.repeat(40)},{account:'d'.repeat(32)},{repo:'fixture-owner/app-composer'},{dirty:true}])assert.throws(()=>requireVerifiedReadiness(valid,{...context,...changed},now));
});

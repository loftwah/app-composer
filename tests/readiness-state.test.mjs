import test from 'node:test';import assert from 'node:assert/strict';
import {githubRepository,referenceTarget,finishReadiness} from '../scripts/readiness-state.mjs';
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

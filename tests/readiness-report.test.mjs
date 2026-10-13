import test from 'node:test';import assert from 'node:assert/strict';
import {createReadinessSession,inspectReadiness,recipe} from '../lib/get-ready/index.mjs';
import {readinessReport,validateReadinessReport,inspectReadinessReport,progressStep,progressHelp} from '../lib/get-ready/report.mjs';
const now=Date.parse('2026-10-14T00:00:00.000Z');
function fixture(){return {version:2,recipe:recipe.id,state:'verified',expiresAt:new Date(now+3600000).toISOString(),context:{account:'fictional-secret-account',workspace:'/fictional/private-path',repo:'private-owner/private-repo'},checks:Object.fromEntries(recipe.checks.map(id=>[id,{state:'verified',verifiedAt:new Date(now).toISOString(),evidence:{secret:'fictional-secret'}}]))};}

test('progress export excludes workspace, account, repository, raw actions and evidence',()=>{
 const session=fixture(),report=readinessReport(session,now);
 assert.equal(report.checks.length,4);assert.equal(inspectReadinessReport(report,now).inspection.ready,true);
 assert.doesNotMatch(JSON.stringify(report),/fictional-secret|private-path|private-owner|context|evidence/);
 const broken=fixture();broken.state='action_required';broken.expiresAt=null;broken.checks.agent={state:'action_required',action:'untrusted-secret-instruction',issue:{recovery:'agent-setup',tools:[{tool:'gh',state:'missing',label:'untrusted-secret',source:'https://private.example'}]}};
 broken.checks.github={state:'action_required',issue:{recovery:'agent-setup',tools:[{tool:'gh',state:'missing'}]}};
 const missing=readinessReport(broken,now);assert.deepEqual(missing.checks[0].tools,[{tool:'gh',state:'missing'}]);assert.doesNotMatch(JSON.stringify(missing),/untrusted-secret|private\.example/);
});

test('browser progress uses the core freshness and pending-operation semantics without granting execution',()=>{
 const session=fixture(),report=readinessReport(session,now);
 for(const time of [now,now+3600000])assert.deepEqual(inspectReadinessReport(report,time).inspection.capabilities,inspectReadiness(session,time).capabilities);
 assert.equal(inspectReadinessReport(report,now+3600000).inspection.ready,false);
 assert.match(progressStep(report.checks[0],false),/not current/);
 const pending=fixture();pending.state='action_required';pending.expiresAt=null;pending.pendingOperations=[{id:'deploy-owned-reference',state:'failed',recovery:'agent-recheck',destination:'/private-secret'}];
 const exported=readinessReport(pending,now);assert.equal(exported.operations[0].id,'deploy-owned-reference');assert.equal(inspectReadinessReport(exported,now).inspection.ready,false);assert.doesNotMatch(JSON.stringify(exported),/private-secret|destination/);
 const legacy=fixture();legacy.state='action_required';legacy.expiresAt=null;legacy.operation={state:'blocked',label:'Legacy reference action',destination:'/private-secret'};
 const safeLegacy=readinessReport(legacy,now);assert.equal(safeLegacy.operations[0].id,'reference-operation');assert.equal(inspectReadinessReport(safeLegacy,now).inspection.ready,false);assert.doesNotMatch(JSON.stringify(safeLegacy),/private-secret|Legacy reference action/);
});

test('progress import rejects private receipts, secret fields, duplicate checks, future dates and incompatible versions',()=>{
 assert.throws(()=>validateReadinessReport(fixture(),now));
 for(const mutate of [r=>r.context={token:'secret'},r=>r.version=2,r=>r.recipe='arbitrary-recipe',r=>r.checks[1]=r.checks[0],r=>r.checks[0].verifiedAt=new Date(now+1).toISOString(),r=>r.exportedAt=new Date(now+300001).toISOString(),r=>r.checks[0].action='untrusted instructions',r=>r.operations=[{id:'arbitrary-shell',state:'failed',recovery:'agent-repair'}]]){
  const report=readinessReport(fixture(),now);mutate(report);assert.throws(()=>validateReadinessReport(report,now));
 }
});

test('cancelled and incomplete sessions produce explicit reports with no fabricated verification',()=>{
 const session=createReadinessSession({workspace:'/fictional/empty'});
 session.state='cancelled';session.expiresAt=null;
 const report=readinessReport(session,now);assert.equal(report.checks.every(c=>c.state==='not_started'),true);assert.equal(inspectReadinessReport(report,now).inspection.ready,false);
});

test('account help identifies supported services and unfinished acquisition without guessing the HTTPS credential',()=>{
 for(const id of ['github','clone-reference','own-reference']){
  const step={id,state:'action_required',recovery:'human-authentication'};
  assert.match(progressStep(step,false),/GitHub/);assert.equal(progressHelp(step).href,'/ready/guide#github-sign-in');
 }
 const cloudflare={id:'cloudflare',state:'action_required',recovery:'human-authentication'};
 assert.match(progressStep(cloudflare,false),/Cloudflare/);assert.equal(progressHelp(cloudflare).href,'/ready/guide#cloudflare-sign-in');
 const https={...cloudflare,id:'https'};assert.doesNotMatch(progressStep(https,false),/Cloudflare|GitHub/);assert.equal(progressHelp(https).href,'/ready/guide#account-sign-in');
 for(const recovery of ['agent-setup','agent-retry','agent-repair','human-permission'])assert.equal(progressHelp({...cloudflare,recovery}),null);
 assert.equal(progressHelp(cloudflare,true),null);assert.equal(progressHelp({...cloudflare,state:'verified'}),null);
 const session=fixture();session.state='action_required';session.expiresAt=null;session.pendingOperations=[{id:'clone-reference',state:'action_required',recovery:'human-authentication'}];
 const report=readinessReport(session,now);assert.equal(inspectReadinessReport(report,now).inspection.ready,false);assert.match(progressStep(report.operations[0],false),/GitHub/);
});

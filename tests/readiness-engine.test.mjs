import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReadinessSession,runReadinessSession,inspectReadiness,recipe,ReadinessFailure,runLocalReadiness,createLocalAdapter,discoverWorkspace} from '../lib/get-ready/index.mjs';
import {installedWrangler,localChecks,runWorkspaceWrangler} from '../lib/get-ready/local-checks.mjs';
import {referenceInstallArgs,referenceInstallEnvironment,referenceReleaseEnvironment,verifyReferenceConfig} from '../lib/get-ready/local.mjs';

const context=()=>({workspace:'/fictional/hello',repo:'fixture/hello',source:'a'.repeat(40),dirty:false,target:{origin:'https://hello.example.test',repo:'fixture/hello'},account:'b'.repeat(32),worker:'fictional-hello'});
const adapter=(overrides={},calls=[])=>({checks:recipe.checks.map(id=>({id,label:id,action:'Complete official authentication.',verify:async()=>{calls.push(id);if(overrides[id])return overrides[id]();return {checked:true};}}))});

test('reference release receives the selected scope rather than inherited Hello defaults',()=>{
 const selected=context();
 const env=referenceReleaseEnvironment(selected,{GH_HOST:'enterprise.example.test',HELLO_REPOSITORY:'other/hello',HELLO_ACCOUNT_ID:'c'.repeat(32),HELLO_WORKER:'other-hello',HELLO_ORIGIN:'https://other.example.test',CLOUDFLARE_API_TOKEN:'fictional-deploy-token'});
 assert.equal(env.GH_HOST,'github.com');
 assert.equal(env.HELLO_REPOSITORY,selected.repo);assert.equal(env.HELLO_ACCOUNT_ID,selected.account);assert.equal(env.HELLO_WORKER,selected.worker);assert.equal(env.HELLO_ORIGIN,selected.target.origin);
 assert.equal(env.CLOUDFLARE_API_TOKEN,'fictional-deploy-token');
});

test('the installed Wrangler config binds reference preparation and deployment to account, Worker and origin',async()=>{
 const {readFileSync}=await import('node:fs');const workspace=new URL('..',import.meta.url).pathname;
 const actual=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 const selected={workspace,account:actual.account_id,worker:actual.name,target:{origin:actual.vars.PUBLIC_ORIGIN}};
 assert.equal((await verifyReferenceConfig(selected)).name,actual.name);
 for(const patch of [{account:'a'.repeat(32)},{worker:'different-reference'},{target:{origin:'https://other.example.com'}}])await assert.rejects(verifyReferenceConfig({...selected,...patch}),error=>error instanceof ReadinessFailure&&error.code==='configuration');
});

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

test('reference installation runs before Cloudflare, requires fresh prerequisites and cannot hide a failed install',async()=>{
  const calls=[],a=adapter({},calls);a.installReferenceTools=async()=>{calls.push('install');return {wrangler:'4.143.1'};};
  const result=await runReadinessSession(createReadinessSession(context()),a,()=>{},{operation:'install-reference-tools'});
  assert.deepEqual(calls,['agent','github','install','cloudflare','https']);assert.equal(result.state,'verified');
  const preparationCalls=[];const prepared=await runReadinessSession(createReadinessSession(context()),{...adapter({github:async()=>{throw new ReadinessFailure('permission');}},preparationCalls),installReferenceTools:async()=>{preparationCalls.push('install');return {changed:true};}},()=>{},{operation:'install-reference-tools'});
  assert.ok(preparationCalls.includes('install'));assert.equal(prepared.operation.state,'performed');assert.equal(prepared.expiresAt,null);
  assert.equal(inspectReadiness(prepared).ready,false);assert.equal(inspectReadiness(prepared).capabilities.github,false);
  const blockedCalls=[];const blocked=await runReadinessSession(createReadinessSession(context()),{...adapter({agent:async()=>{throw new ReadinessFailure('configuration');}},blockedCalls),installReferenceTools:async()=>assert.fail('Missing tools cannot install')},()=>{},{operation:'install-reference-tools'});
  assert.equal(blocked.operation.state,'blocked');assert.equal(blocked.expiresAt,null);
  const failed=await runReadinessSession(createReadinessSession(context()),{...adapter(),installReferenceTools:async()=>{throw new ReadinessFailure('unexpected');}},()=>{},{operation:'install-reference-tools'});
  assert.equal(failed.checks.https.state,'verified');assert.equal(failed.state,'failed');assert.equal(failed.expiresAt,null);
});

test('a missing workspace installation cannot borrow parent Wrangler or request unnecessary sign-in',async()=>{
  const parent=mkdtempSync(join(tmpdir(),'composer-tool-probe-'));const workspace=join(parent,'child');
  try{
    mkdirSync(join(parent,'node_modules/wrangler'),{recursive:true});mkdirSync(workspace);
    writeFileSync(join(parent,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',version:'4.143.1'}));
    assert.throws(()=>installedWrangler(workspace),error=>error instanceof ReadinessFailure&&error.code==='configuration');
    const check=localChecks({...context(),workspace}).find(check=>check.id==='cloudflare');
    const state={checks:{}};const {runReadinessCheck}=await import('../lib/get-ready/check.mjs');
    await runReadinessCheck(state,check,()=>{});
    assert.equal(state.checks.cloudflare.issue.recovery,'agent-setup');assert.ok(state.checks.cloudflare.action.includes('--install-reference-tools'));
    mkdirSync(join(workspace,'node_modules/wrangler'),{recursive:true});
    writeFileSync(join(workspace,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',version:'4.143.1',bin:{wrangler:'./bin/wrangler.js'}}));
    assert.throws(()=>installedWrangler(workspace));
    for(const version of ['0.0.0','4.143.1']){
      mkdirSync(join(workspace,'node_modules/wrangler/bin'),{recursive:true});
      writeFileSync(join(workspace,'node_modules/wrangler/bin/wrangler.js'),'// fictional entry, not executed');
      writeFileSync(join(workspace,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',version,bin:{wrangler:'./bin/wrangler.js'}}));
      if(version==='0.0.0')assert.throws(()=>installedWrangler(workspace));else assert.equal(installedWrangler(workspace),version);
    }
  }finally{rmSync(parent,{recursive:true});}
});

test('local Wrangler execution is bound to the selected package even when PATH offers a different tool',()=>{
  const workspace=mkdtempSync(join(tmpdir(),'composer-local-wrangler-'));
  try{
    mkdirSync(join(workspace,'node_modules/wrangler/bin'),{recursive:true});mkdirSync(join(workspace,'borrowed'));
    writeFileSync(join(workspace,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',version:'4.143.1',bin:{wrangler:'./bin/wrangler.js'}}));
    writeFileSync(join(workspace,'node_modules/wrangler/bin/wrangler.js'),'console.log("local fixture")');
    writeFileSync(join(workspace,'borrowed/wrangler'),'#!/bin/sh\nprintf "borrowed fixture\\n"\n',{mode:0o755});
    assert.equal(runWorkspaceWrangler(workspace,['--version'],{...process.env,PATH:join(workspace,'borrowed')}),'local fixture');
  }finally{rmSync(workspace,{recursive:true});}
});

test('the installer isolates unrelated scoped registries and credentials while keeping the committed project policy',()=>{
  const fixture=mkdtempSync(join(tmpdir(),'composer-installer-config-'));
  try{
    const userConfig=join(fixture,'unrelated'),isolated=join(fixture,'isolated'),workspace=join(fixture,'workspace');
    mkdirSync(join(userConfig,'pnpm'),{recursive:true});mkdirSync(isolated);mkdirSync(workspace);
    writeFileSync(join(userConfig,'pnpm/rc'),'@cloudflare:registry=https://private.example.test/\n');
    writeFileSync(join(userConfig,'pnpm/config.yaml'),'registries:\n  "https://private.example.test/":\n    scopes:\n      - "@cloudflare"\n');
    writeFileSync(join(workspace,'pnpm-workspace.yaml'),'minimumReleaseAge: 1440\n');
    const env={...process.env,XDG_CONFIG_HOME:userConfig,CLOUDFLARE_API_TOKEN:'fictional-cloud-token',NPM_CONFIG_USERCONFIG:join(fixture,'private.npmrc')};
    writeFileSync(env.NPM_CONFIG_USERCONFIG,'@cloudflare:registry=https://private.example.test/\n');
    const run=(key,env,args=[])=>execFileSync('pnpm',['config','get',key,...args],{cwd:workspace,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    assert.equal(run('@cloudflare:registry',env),'https://private.example.test/');
    const installEnv=referenceInstallEnvironment(env,isolated),flags=referenceInstallArgs.filter(arg=>arg.startsWith('--registry=')||arg.startsWith('--userconfig='));
    assert.equal(run('@cloudflare:registry',installEnv,flags),'undefined');
    assert.equal(run('registry',installEnv,flags),'https://registry.npmjs.org/');
    assert.equal(run('minimumReleaseAge',installEnv,flags),'1440');
    assert.equal(installEnv.CLOUDFLARE_API_TOKEN,undefined);assert.equal(installEnv.NPM_CONFIG_USERCONFIG,undefined);
  }finally{rmSync(fixture,{recursive:true});}
});

test('reference installation preserves uncommitted work and refuses other repositories before package writes',async()=>{
  const workspace=mkdtempSync(join(tmpdir(),'composer-install-guard-'));
  const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    await assert.rejects(createLocalAdapter({...context(),workspace}).installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code==='configuration');
    git(['init','-b','main']);git(['remote','add','origin','https://github.com/loftwah/app-composer-hello.git']);
    writeFileSync(join(workspace,'config.json'),'{}');git(['add','config.json']);git(['-c','user.name=Fictional test','-c','user.email=fixture@example.test','commit','-m','Synthetic fixture']);
    const clean=discoverWorkspace(workspace);writeFileSync(join(workspace,'config.json'),'owner-work');
    await assert.rejects(createLocalAdapter({...context(),...clean}).installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code==='configuration');
    assert.equal(existsSync(join(workspace,'node_modules')),false);
    const {readFileSync}=await import('node:fs');assert.equal(readFileSync(join(workspace,'config.json'),'utf8'),'owner-work');
  }finally{rmSync(workspace,{recursive:true});}
});

test('local preparation rechecks fixed-host source authentication and exact main before package execution',async()=>{
 const fixture=mkdtempSync(join(tmpdir(),'composer-preparation-source-'));
 try{
  const workspace=join(fixture,'hello'),bin=join(fixture,'bin'),marker=join(fixture,'package-ran'),calls=join(fixture,'source-args');mkdirSync(workspace);mkdirSync(bin);
  const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git(['init','-b','main']);git(['remote','add','origin','https://github.com/loftwah/app-composer-hello.git']);
  writeFileSync(join(workspace,'fixture.txt'),'fictional source');git(['add','fixture.txt']);
  git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Fictional fixture']);
  const source=git(['rev-parse','HEAD']);git(['update-ref','refs/remotes/origin/main',source]);
  writeFileSync(join(bin,'pnpm'),'#!/bin/sh\ntouch "'+marker+'"\nexit 1\n',{mode:0o755});
  const env={...process.env,PATH:bin+':'+process.env.PATH,GH_HOST:'enterprise.example.test'};
  const selected={...context(),workspace,repo:'loftwah/app-composer-hello',source,dirty:false};
  for(const [output,status,code] of [['',4,'authentication'],['b'.repeat(40),0,'source']]){
   writeFileSync(join(bin,'gh'),'#!/bin/sh\nprintf "%s\\n" "$@" > "'+calls+'"\nprintf "%s\\n" "'+output+'"\nexit '+status+'\n',{mode:0o755});
   await assert.rejects(createLocalAdapter(selected,env).installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code===code);
   assert.ok(readFileSync(calls,'utf8').includes('--hostname\ngithub.com\n'));
   assert.equal(existsSync(marker),false);assert.equal(existsSync(join(workspace,'node_modules')),false);
   assert.equal(git(['status','--porcelain']),'');
  }
 }finally{rmSync(fixture,{recursive:true});}
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


test('failed reference intent remains visible through read-only resume until explicit retry or cancellation',async()=>{
 const calls=[],selected=adapter({},calls);selected.deployReference=async()=>{calls.push('deployment-attempt');throw new ReadinessFailure('unavailable');};
 const failed=await runReadinessSession(createReadinessSession(context()),selected,()=>{},{operation:'deploy-reference'});
 assert.equal(failed.state,'failed');assert.equal(failed.checks.https.state,'verified');
 const inspection=inspectReadiness(failed);
 assert.equal(inspection.ready,false);assert.ok(inspection.next.some(item=>item.operation==='deploy-reference'));
 assert.equal(inspection.next.find(item=>item.operation==='deploy-reference').recovery,'agent-retry');
 const resumed=await runReadinessSession(createReadinessSession(context(),failed),selected);
 assert.equal(resumed.state,'failed');assert.equal(resumed.expiresAt,null);
 assert.equal(calls.filter(value=>value==='deployment-attempt').length,1);
 assert.equal(inspectReadiness(resumed).ready,false);assert.ok(inspectReadiness(resumed).next.some(item=>item.operation==='deploy-reference'));
 const setup=await runReadinessSession(createReadinessSession(context(),resumed),{...adapter(),installReferenceTools:async()=>({changed:false})},()=>{},{operation:'install-reference-tools'});
 assert.equal(setup.operation.state,'performed');assert.equal(setup.state,'failed');assert.ok(inspectReadiness(setup).next.some(item=>item.operation==='deploy-reference'));
 const repaired={...adapter(),deployReference:async()=>({version:'fictional-retry'})};
 const retried=await runReadinessSession(createReadinessSession(context(),setup),repaired,()=>{},{operation:'deploy-reference'});
 assert.equal(retried.state,'verified');assert.equal(inspectReadiness(retried).ready,true);assert.deepEqual(inspectReadiness(retried).next,[]);
 const cancelled=await runReadinessSession(createReadinessSession(context(),failed),selected,()=>{},{cancel:true});
 assert.equal(cancelled.state,'cancelled');assert.equal(inspectReadiness(cancelled).ready,false);
 const afterCancellation=await runReadinessSession(createReadinessSession(context(),cancelled),adapter());
 assert.equal(afterCancellation.state,'verified');assert.equal(afterCancellation.operation,undefined);
 const changed=await runReadinessSession(createReadinessSession({...context(),worker:'different-reference'},failed),adapter());
 assert.equal(changed.state,'verified');assert.equal(changed.operation,undefined);
});


test('legacy blocked intent cannot disappear when an unrelated reference setup succeeds',async()=>{
 const previous=await runReadinessSession(createReadinessSession(context()),{...adapter({github:async()=>{throw new ReadinessFailure('permission');}}),deployReference:async()=>({})},()=>{},{operation:'deploy-reference'});
 previous.operation={state:'blocked',action:'Resolve the prerequisite checks before deployment.'};delete previous.pendingOperations;
 const resumed=await runReadinessSession(createReadinessSession(context(),previous),{...adapter(),installReferenceTools:async()=>({changed:false})},()=>{},{operation:'install-reference-tools'});
 assert.equal(resumed.operation.state,'performed');assert.equal(resumed.state,'action_required');assert.equal(resumed.expiresAt,null);
 assert.equal(inspectReadiness(resumed).ready,false);assert.ok(inspectReadiness(resumed).next.some(item=>item.operation==='reference-operation'));
 const cancelled=await runReadinessSession(createReadinessSession(context(),resumed),adapter(),()=>{},{cancel:true});
 const checked=await runReadinessSession(createReadinessSession(context(),cancelled),adapter());assert.equal(inspectReadiness(checked).ready,true);
});

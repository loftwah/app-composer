import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReadinessSession,runReadinessSession,inspectReadiness,recipe,ReadinessFailure,createLocalAdapter,discoverWorkspace,runLocalReadiness} from '../lib/get-ready/index.mjs';
import {referenceCloneEnvironment} from '../lib/get-ready/local.mjs';

const context={workspace:'/fictional/authorised-parent',repo:'fixture/parent',source:'a'.repeat(40),dirty:false};
const adapter=calls=>({checks:recipe.checks.map(id=>({id,label:id,verify:async()=>{calls.push(id);return {checked:true};}})),cloneReference:async destination=>{calls.push('clone');return {destination,changed:true};}});

test('public clone needs active tools and fresh source read, not parent push permission; saved intent neither retries nor changes destination',async()=>{
 const calls=[],selected=adapter(calls),destination='/fictional/new-hello';
 const snapshots=[];
 const completed=await runReadinessSession(createReadinessSession(context),selected,state=>snapshots.push(structuredClone(state)),{operation:'clone-reference',destination});
 assert.deepEqual(calls,['agent','github','clone','cloudflare','https']);
 assert.equal(completed.operation.state,'performed');assert.equal(completed.operation.destination,destination);
 assert.ok(snapshots.some(state=>state.operation?.state==='verifying'&&state.operation.destination===destination));
 assert.ok(!JSON.stringify(inspectReadiness(completed)).includes(destination));
 // The old push-permission gate prevented public acquisition before any project.
 const denied=adapter([]);denied.checks[1].verify=async()=>{throw new ReadinessFailure('permission');};
 const acquired=await runReadinessSession(createReadinessSession({...context,repo:null,source:null,dirty:null}),denied,()=>{},{operation:'clone-reference',destination});
 assert.equal(acquired.operation.state,'performed');assert.equal(acquired.expiresAt,null);
 assert.equal(inspectReadiness(acquired).ready,false);assert.equal(inspectReadiness(acquired).capabilities.github,false);
 const missingTools=adapter([]);missingTools.checks[0].verify=async()=>{throw new ReadinessFailure('configuration');};
 missingTools.cloneReference=async()=>assert.fail('Missing agent tools must never acquire source');
 const blocked=await runReadinessSession(createReadinessSession(context),missingTools,()=>{},{operation:'clone-reference',destination});
 assert.equal(blocked.operation.state,'blocked');assert.equal(blocked.expiresAt,null);
 const failedAdapter=adapter([]);failedAdapter.cloneReference=async()=>{throw new ReadinessFailure('unavailable');};
 const failed=await runReadinessSession(createReadinessSession(context),failedAdapter,()=>{},{operation:'clone-reference',destination});
 const resumed=await runReadinessSession(createReadinessSession(context,failed),adapter([]));
 assert.equal(resumed.state,'failed');assert.equal(inspectReadiness(resumed).ready,false);
 assert.equal(resumed.pendingOperations[0].destination,destination);
 assert.ok(!JSON.stringify(inspectReadiness(resumed)).includes(destination));
 await assert.rejects(runReadinessSession(createReadinessSession(context,resumed),selected,()=>{},{operation:'clone-reference',destination:'/fictional/other'}),/another destination/);
 const retried=await runReadinessSession(createReadinessSession(context,resumed),adapter([]),()=>{},{operation:'clone-reference',destination});
 assert.equal(inspectReadiness(retried).ready,true);
 for(const invalid of [null,'relative/path','/fictional/../new-hello','/fictional/\0hello',{}])await assert.rejects(runReadinessSession(createReadinessSession(context),selected,()=>{},{operation:'clone-reference',destination:invalid}));
 await assert.rejects(runReadinessSession(createReadinessSession(context),selected,()=>{},{destination}));
});

test('non-repository local setup saves source authentication/permission failures before checkout writes and read-only resume never retries',async()=>{
 const fixture=mkdtempSync(join(tmpdir(),'composer-clone-fresh-'));
 try{
  const workspace=join(fixture,'workspace'),bin=join(fixture,'bin'),calls=join(fixture,'calls');mkdirSync(workspace);mkdirSync(bin);
  writeFileSync(join(bin,'pnpm'),'#!/bin/sh\nprintf "12.8.1\\n"\n',{mode:0o755});
  const env={...process.env,PATH:bin+':'+process.env.PATH,CODEX_THREAD_ID:'fictional-test-session',GH_HOST:'enterprise.example.test'};
  const failures=[{output:'',status:4,code:'authentication',recovery:'human-authentication'},{output:'HTTP/2.0 403 Forbidden\\n\\nfictional denied',status:1,code:'permission',recovery:'human-permission'},{output:'not-a-source',status:0,code:'response',recovery:'agent-repair'}];
  for(const [index,failure] of failures.entries()){
   writeFileSync(join(bin,'gh'),'#!/bin/sh\nif [ "$1" = "--version" ]; then printf "gh version 0.0.0 (fictional fixture)\\n"; exit 0; fi\nprintf "%s\\n" "$@" >> "'+calls+'"\nprintf "'+failure.output+'\\n"\nexit '+failure.status+'\n',{mode:0o755});
   const destination=join(fixture,'hello-'+index);
   const state=await runLocalReadiness({workspace,operation:'clone-reference',destination},env);
   assert.equal(state.context.repo,null);assert.equal(state.context.source,null);
   assert.equal(state.checks.github.issue.recovery,'agent-setup');
   assert.equal(state.operation.issue.code,failure.code);assert.equal(state.operation.issue.recovery,failure.recovery);
   assert.equal(existsSync(destination),false);assert.equal(inspectReadiness(state).ready,false);assert.equal(state.expiresAt,null);
   const priorCalls=readFileSync(calls,'utf8');assert.ok(priorCalls.includes('--hostname\ngithub.com\n'));
   assert.ok(!JSON.stringify(state).includes('fictional denied'));assert.ok(!JSON.stringify(inspectReadiness(state)).includes(destination));
   const resumed=await runLocalReadiness({workspace},env);
   assert.equal(resumed.pendingOperations[0].destination,destination);
   assert.equal(readFileSync(calls,'utf8'),priorCalls);assert.equal(existsSync(destination),false);
   await runLocalReadiness({workspace,cancel:true},env);
  }
 }finally{rmSync(fixture,{recursive:true});}
});

test('public clone isolates credentials, Git rewrites and inherited worktree/config injection',()=>{
 const env=referenceCloneEnvironment({...process.env,CLOUDFLARE_API_TOKEN:'fictional',GH_TOKEN:'fictional',GIT_WORK_TREE:'/fictional/owner',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'url.file:///fictional/.insteadOf',GIT_CONFIG_VALUE_0:'https://github.com/'},'/fictional/isolated-home');
 for(const key of ['CLOUDFLARE_API_TOKEN','GH_TOKEN','GIT_WORK_TREE','GIT_CONFIG_COUNT','GIT_CONFIG_KEY_0','GIT_CONFIG_VALUE_0'])assert.equal(env[key],undefined);
 assert.equal(env.GIT_CONFIG_GLOBAL,'/dev/null');assert.equal(env.GIT_CONFIG_NOSYSTEM,'1');assert.equal(env.GIT_TERMINAL_PROMPT,'0');
});

test('clone guards preserve files, empty directories, symlinks and nested Git workspaces; unchanged reviewed checkout is reusable',async()=>{
 const fixture=mkdtempSync(join(tmpdir(),'composer-clone-guard-'));
 try{
  // Real Git fixture; only the provider SHA lookup is synthetic. No network/build/deploy here.
  const checkout=join(fixture,'hello');mkdirSync(checkout);
  const git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git(['init','-b','main']);git(['remote','add','origin','https://github.com/loftwah/app-composer-hello.git']);
  writeFileSync(join(checkout,'owner.txt'),'retained');git(['add','owner.txt']);
  git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Fictional fixture']);
  const source=git(['rev-parse','HEAD']);git(['update-ref','refs/remotes/origin/main',source]);
  const bin=join(fixture,'bin');mkdirSync(bin);
  writeFileSync(join(bin,'gh'),'#!/bin/sh\nprintf "%s\\n" "'+source+'"\n',{mode:0o755});
  const env={...process.env,PATH:bin+':'+process.env.PATH};
  const local=createLocalAdapter({...context,workspace:fixture},env);
  assert.equal((await local.cloneReference(checkout)).changed,false);
  const monitor=join(fixture,'monitor'),marker=join(fixture,'monitor-ran');
  writeFileSync(monitor,'#!/bin/sh\ntouch "'+marker+'"\n',{mode:0o755});
  git(['config','core.fsmonitor',monitor]);
  assert.equal((await local.cloneReference(checkout)).changed,false);assert.equal(existsSync(marker),false);
  const filter=join(fixture,'filter'),filterMarker=join(fixture,'filter-ran');
  writeFileSync(filter,'#!/bin/sh\ntouch "'+filterMarker+'"\ncat\n',{mode:0o755});
  git(['config','filter.fixture.clean',filter]);writeFileSync(join(checkout,'.git/info/attributes'),'owner.txt filter=fixture\n');
  await assert.rejects(local.cloneReference(checkout),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  assert.equal(existsSync(filterMarker),false);
  git(['config','--remove-section','filter.fixture']);rmSync(join(checkout,'.git/info/attributes'));
  git(['config','include.path',join(fixture,'unused')]);
  await assert.rejects(local.cloneReference(checkout),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  git(['config','--unset','include.path']);git(['config','--unset','core.fsmonitor']);
  const empty=join(fixture,'empty');mkdirSync(empty);
  const file=join(fixture,'owner-file');writeFileSync(file,'untouched');
  const link=join(fixture,'link');symlinkSync(checkout,link);
  const nested=join(checkout,'nested');mkdirSync(nested);
  for(const destination of [empty,file,link,nested,join(fixture,'absent-parent/hello')])await assert.rejects(local.cloneReference(destination),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  assert.equal(readFileSync(file,'utf8'),'untouched');assert.equal(existsSync(join(empty,'.git')),false);
  rmSync(nested,{recursive:true});writeFileSync(join(checkout,'owner.txt'),'uncommitted owner change');
  await assert.rejects(local.cloneReference(checkout),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  assert.equal(readFileSync(join(checkout,'owner.txt'),'utf8'),'uncommitted owner change');
  assert.equal(discoverWorkspace(checkout).source,source);
 }finally{rmSync(fixture,{recursive:true});}
});

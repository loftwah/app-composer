import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {downloadWorkspaceTool,prepareWorkspaceTools,workspaceToolEnvironment} from '../lib/get-ready/workspace-tools.mjs';
import {createReadinessSession,runReadinessSession,inspectReadiness,ReadinessFailure} from '../lib/get-ready/index.mjs';
const active={...process.env,CODEX_THREAD_ID:'fictional-tool-fixture'};
const supported=process.platform==='darwin'&&process.arch==='arm64'&&process.versions.node.startsWith('22.');
const fixture=()=>{const root=mkdtempSync(join(tmpdir(),'composer-tool-preparation-')),workspace=join(root,'workspace');mkdirSync(workspace);return {root,workspace};};

test('fixed distributions refuse redirected authorities, error statuses, excess bytes and corrupt exact-size payloads',async()=>{
 for(const request of [
  async()=>new Response(null,{status:302,headers:{location:'https://fictional.example/gh.zip'}}),
  async()=>new Response(null,{status:503}),
  async()=>new Response('unexpected',{status:200,headers:{'content-length':'10'}}),
  async()=>new Response(new Uint8Array(1171),{status:200}),
  async()=>new Response(new Uint8Array(1170),{status:200})
 ])await assert.rejects(downloadWorkspaceTool('license',request),error=>error instanceof ReadinessFailure);
 let unknownCalls=0;await assert.rejects(downloadWorkspaceTool('arbitrary-package',()=>{unknownCalls++;return new Response(null,{status:503});}));assert.equal(unknownCalls,0);
 let calls=0;await assert.rejects(downloadWorkspaceTool('gh',async(_url,options)=>{calls++;assert.equal(options.redirect,'manual');assert.deepEqual(Object.keys(options.headers),['User-Agent','Accept-Encoding']);assert.equal(options.headers['Accept-Encoding'],'identity');return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/fictional'}});}));assert.equal(calls,2);
});

test('decoded licence bytes verify against their fixed digest despite compressed transport length',async()=>{
 const license=readFileSync(new URL('./fixtures/pnpm-12.9.1-LICENSE',import.meta.url));
 const result=await downloadWorkspaceTool('license',async(_url,options)=>{assert.equal(options.headers['Accept-Encoding'],'identity');return new Response(license,{status:200,headers:{'content-encoding':'gzip','content-length':'697'}});});
 assert.deepEqual(result,license);
});

test('existing or linked workspace tool folders are preserved and never repaired by downloading', {skip:!supported},async()=>{
 for(const kind of ['partial','linked','private-linked']){
  const {root,workspace}=fixture(),storage=join(workspace,'.private'),outside=join(root,'outside');mkdirSync(outside);writeFileSync(join(outside,'owner.txt'),'fictional owner bytes');
  if(kind==='private-linked')symlinkSync(outside,storage);
  else{mkdirSync(storage,{mode:0o700});if(kind==='linked')symlinkSync(outside,join(storage,'workspace-tools'));else{mkdirSync(join(storage,'workspace-tools'));writeFileSync(join(storage,'workspace-tools/owner.txt'),'fictional owner bytes');}}
  let downloads=0;try{await assert.rejects(prepareWorkspaceTools(workspace,active,()=>{downloads++;return new Response(null,{status:503});}));assert.equal(downloads,0);assert.equal(readFileSync(join(outside,'owner.txt'),'utf8'),'fictional owner bytes');if(kind==='partial')assert.equal(readFileSync(join(storage,'workspace-tools/owner.txt'),'utf8'),'fictional owner bytes');}finally{rmSync(root,{recursive:true});}
 }
});

test('inactive setup and missing cached selection refuse before provider IO and preserve process PATH',async()=>{
 const {root,workspace}=fixture(),original=process.env.PATH;
 let downloads=0;try{await assert.rejects(prepareWorkspaceTools(workspace,{PATH:'/usr/bin:/bin'},()=>{downloads++;return new Response(null,{status:503});}));assert.equal(downloads,0);assert.throws(()=>workspaceToolEnvironment(workspace,active));assert.equal(existsSync(join(workspace,'.private/workspace-tools')),false);assert.equal(process.env.PATH,original);}finally{rmSync(root,{recursive:true});}
});

test('tool probes strip inherited service credentials and execution controls before downloading', {skip:!supported},async()=>{
 const {root,workspace}=fixture(),bin=join(root,'bin'),marker=join(root,'probe-env');mkdirSync(bin);
 writeFileSync(join(bin,'git'),'#!/bin/sh\n/usr/bin/env > "'+marker+'"\nprintf "git version 2.50.0\\n"\n',{mode:0o700});
 const env={PATH:bin+':/usr/bin:/bin',CODEX_THREAD_ID:'fictional-runtime',GH_TOKEN:'fictional-token',CLOUDFLARE_API_TOKEN:'fictional-token',NODE_OPTIONS:'fictional-control',TAR_OPTIONS:'fictional-control',CI:'fictional-control'};
 let downloads=0;try{await assert.rejects(prepareWorkspaceTools(workspace,env,async()=>{downloads++;return new Response(null,{status:503});}));assert.equal(downloads,1);const output=readFileSync(marker,'utf8');for(const key of ['GH_TOKEN','CLOUDFLARE_API_TOKEN','NODE_OPTIONS','TAR_OPTIONS','CI'])assert.doesNotMatch(output,new RegExp('^'+key+'=','m'));assert.equal(existsSync(join(workspace,'.private/workspace-tools')),false);}finally{rmSync(root,{recursive:true});}
});

test('usable existing tools are reused with an isolated probe home and no private binary install', {skip:!supported},async()=>{
 const {root,workspace}=fixture(),bin=join(root,'bin');mkdirSync(bin);
 for(const [name,version] of [['git','git version 2.50.0'],['gh','gh version 2.98.0 (fictional fixture)'],['pnpm','12.9.1']])writeFileSync(join(bin,name),'#!/bin/sh\n/bin/mkdir -p "$HOME/.local"\nprintf "'+version+'\\n"\n',{mode:0o700});
 let downloads=0;try{const result=await prepareWorkspaceTools(workspace,{PATH:bin+':/usr/bin:/bin',CODEX_THREAD_ID:'fictional-fixture',HOME:workspace},()=>{downloads++;return new Response(null,{status:503});});assert.equal(result.changed,false);assert.equal(result.scope,'existing');assert.equal(downloads,0);assert.equal(existsSync(join(workspace,'.local')),false);assert.equal(existsSync(join(workspace,'.private/workspace-tools')),false);}finally{rmSync(root,{recursive:true});}
});

test('explicit workspace preparation precedes the agent check; failed intent resumes read-only without retry',async()=>{
 const input={workspace:'/fictional/authorised-folder'},calls=[],checks=['agent','github','cloudflare','https'].map(id=>({id,label:id,action:'fictional fixture',verify:async()=>{calls.push(id);if(id!=='agent')throw new ReadinessFailure('configuration');return {active:true};}}));
 const first=await runReadinessSession(createReadinessSession(input),{checks,installWorkspaceTools:async()=>{calls.push('prepare');return {changed:true,scope:'workspace'};}},()=>{},{operation:'install-workspace-tools'});
 assert.deepEqual(calls,['prepare','agent','github','cloudflare','https']);assert.equal(first.operation.state,'performed');assert.equal(inspectReadiness(first).ready,false);
 let setup=0;const adapter={checks,installWorkspaceTools:async()=>{setup++;throw new ReadinessFailure('unavailable');}};
 const failed=await runReadinessSession(createReadinessSession(input),adapter,()=>{},{operation:'install-workspace-tools'});const resumed=await runReadinessSession(createReadinessSession(input,failed),adapter);
 assert.equal(setup,1);assert.equal(inspectReadiness(resumed).ready,false);assert.equal(resumed.pendingOperations[0].id,'install-workspace-tools');
});

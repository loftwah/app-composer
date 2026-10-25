import {isSupportedNode} from '../lib/get-ready/local-checks.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const supported=process.platform==='darwin'&&process.arch==='arm64'&&isSupportedNode();
for(const scenario of ['reuse','download-failure','git-failure'])test('temporary tool storage is removed after '+scenario,{skip:!supported},t=>{
 const root=mkdtempSync(join(tmpdir(),'composer-cleanup-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const temporary=join(root,'temporary'),workspace=join(root,'workspace'),bin=join(root,'bin');
 for(const path of [temporary,workspace,bin])mkdirSync(path);
 for(const [name,version] of [['git','git version 2.50.0'],['gh','gh version 2.98.0 (fictional fixture)'],['pnpm','12.9.1']]){
  if(scenario==='download-failure'&&name!=='git')continue;
  writeFileSync(join(bin,name),'#!/bin/sh\n/bin/mkdir -p "$HOME/cache"\n'+(scenario==='git-failure'?'exit 1\n':'printf "'+version+'\\n"\n'),{mode:0o700});
 }
 const script=`import assert from 'node:assert/strict';import {prepareWorkspaceTools} from ${JSON.stringify(new URL('../lib/get-ready/workspace-tools.mjs',import.meta.url).href)};let calls=0;try{const result=await prepareWorkspaceTools(${JSON.stringify(workspace)},{PATH:${JSON.stringify(bin+':/usr/bin:/bin')},CODEX_THREAD_ID:'fictional-cleanup'},async()=>{calls++;return new Response(null,{status:503});});assert.equal(${JSON.stringify(scenario)},'reuse');assert.equal(result.scope,'existing');}catch(error){if(${JSON.stringify(scenario)}==='reuse')throw error;assert.equal(error.code,${JSON.stringify(scenario==='git-failure'?'configuration':'unavailable')});}assert.equal(calls,${scenario==='download-failure'?1:0});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{env:{PATH:process.env.PATH,TMPDIR:temporary},encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(readdirSync(temporary),[],'No probe home or download stage may outlive the invocation');
});

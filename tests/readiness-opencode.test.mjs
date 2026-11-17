import test from 'node:test';import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync,chmodSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyLocalTools} from '../lib/get-ready/local-checks.mjs';
import {ReadinessToolFailure} from '../lib/get-ready/check.mjs';

const cli=fileURLToPath(new URL('../lib/get-ready/cli.mjs',import.meta.url));
const marker='fictional-opencode-session-id-do-not-print';
const versions={git:'git version 2.50.1 (Apple Git-155)\n',gh:'gh version 2.98.0\n',pnpm:'12.9.1\n',opencode:'opencode v2.3.0\n'};
const execute=command=>{const value=versions[command];if(value===undefined)throw Object.assign(Error('missing'),{code:'ENOENT'});return value;};

test('OpenCode agent evidence requires a live session marker and an exact-format CLI version',()=>{
 const env={OPENCODE_SESSION_ID:marker,OPENCODE:'1',OPENCODE_TERMINAL:'fictional-terminal',CODEX_THREAD_ID:'fictional-inherited-codex'};
 const evidence=verifyLocalTools('/fictional/workspace',env,execute,{agent:'opencode'});
 assert.equal(evidence.opencode,'opencode v2.3.0');
 assert.equal(evidence.activeOpenCodeSession,true);
 assert.equal(Object.hasOwn(evidence,'codex'),false);
 assert.equal(evidence.gh,'gh version 2.98.0');
 // Marker values never enter evidence, including a redacted report.
 assert.equal(JSON.stringify(evidence).includes(marker),false);

 const inactive=error=>error instanceof ReadinessToolFailure&&error.tools.length===1&&error.tools[0].tool==='agent'&&error.tools[0].state==='inactive';
 const missing=command=>{if(command==='opencode')throw Object.assign(Error('missing'),{code:'ENOENT'});return execute(command);};
 // A CLI on PATH alone, or an inherited Codex marker alone, cannot select OpenCode.
 assert.throws(()=>verifyLocalTools('/fictional/workspace',{CODEX_THREAD_ID:'fictional-inherited-codex'},execute,{agent:'opencode'}),inactive);
 assert.throws(()=>verifyLocalTools('/fictional/workspace',{OPENCODE_SESSION_ID:marker},missing,{agent:'opencode'}),inactive);
 // A present but malformed version is not proof of a working CLI.
 assert.throws(()=>verifyLocalTools('/fictional/workspace',{OPENCODE_SESSION_ID:marker},command=>command==='opencode'?'opencode 2.3.0\n':execute(command),{agent:'opencode'}),inactive);
});

test('explicit OpenCode inspection refuses operation mixes and never opens a receipt',()=>{
 const root=mkdtempSync(join(tmpdir(),'get-ready-opencode-mix-'));
 try{
  for(const extra of [['--publish-proof'],['--cancel'],['--clone-reference',join(root,'clone')],['--install-workspace-tools'],['--prepare-site-skills','--available-skills','none']]){
   const result=spawnSync(process.execPath,[cli,'--inspect-agent','opencode','--workspace',root,...extra],{cwd:root,env:{PATH:process.env.PATH,OPENCODE_SESSION_ID:marker},encoding:'utf8',timeout:10000});
   assert.notEqual(result.status,0,extra.join(' '));
   assert.match(result.stderr,/OpenCode agent inspection did not finish/);
   assert.equal(result.stdout,'');
  }
  assert.equal(existsSync(join(root,'.private')),false);
  assert.equal(existsSync(join(root,'clone')),false);
 }finally{rmSync(root,{recursive:true});}
});

test('a valid explicit OpenCode inspection runs in memory and writes no receipt',()=>{
 const root=mkdtempSync(join(tmpdir(),'get-ready-opencode-inspect-'));
 try{
  const bin=join(root,'bin');mkdirSync(bin);
  const fake=join(bin,'opencode');writeFileSync(fake,'#!/bin/sh\nprintf "opencode v2.3.0\\n"\n');chmodSync(fake,0o755);
  const result=spawnSync(process.execPath,[cli,'--inspect-agent','opencode','--workspace',root],{cwd:root,env:{PATH:bin,OPENCODE_SESSION_ID:marker},encoding:'utf8',timeout:10000});
  assert.match(result.stdout,/OpenCode agent inspection/);
  assert.match(result.stdout,/no receipt was written/);
  assert.equal(existsSync(join(root,'.private')),false);
  assert.equal(result.stdout.includes(marker),false);
 }finally{rmSync(root,{recursive:true});}
});

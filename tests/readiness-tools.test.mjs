import test from 'node:test';import assert from 'node:assert/strict';
import {verifyLocalTools} from '../lib/get-ready/local-checks.mjs';
import {ReadinessToolFailure,runReadinessCheck} from '../lib/get-ready/check.mjs';
const output={git:'git version 2.50.1 (Apple Git-155)\n',gh:'gh version 2.98.0 (2026-08-20)\nRelease link\n',pnpm:'12.9.1\n',codex:'codex-cli 0.145.0\n'};

test('tool discovery checks all required commands and records each missing tool without subprocess output',async()=>{
 const calls=[];
 const execute=command=>{calls.push(command);if(command!=='git')throw Object.assign(Error('fictional-secret'),{code:'ENOENT',stderr:'fictional-secret'});return output.git;};
 const session={checks:{}};
 await runReadinessCheck(session,{id:'agent',label:'Coding agent and tools',action:'Generic fallback',verify:()=>verifyLocalTools('/fictional/workspace',{CODEX_THREAD_ID:'fictional-active'},execute)},async()=>{});
 assert.deepEqual(calls,['git','gh','pnpm']);const issue=session.checks.agent;
 assert.equal(issue.state,'action_required');assert.equal(issue.issue.recovery,'agent-setup');assert.deepEqual(issue.issue.tools.map(t=>[t.tool,t.state]),[['gh','missing'],['pnpm','missing']]);
 assert.match(issue.action,/GitHub CLI is missing/);assert.match(issue.action,/pnpm is missing/);assert.match(issue.action,/https:\/\/pnpm.io\/installation/);assert.doesNotMatch(JSON.stringify(session),/fictional-secret|fictional\/workspace/);
});

test('broken and malformed versions produce agent repair, preserve missing diagnosis and omit raw outputs',async()=>{
 const session={checks:{}};
 await runReadinessCheck(session,{id:'agent',label:'Tools',action:'Generic fallback',verify:()=>verifyLocalTools('/fixture',{CODEX_THREAD_ID:'active'},command=>{
  if(command==='git')return 'fictional-private-output';if(command==='gh')throw Object.assign(Error('secret'),{code:'ENOENT'});return output[command];
 })},async()=>{});
 assert.equal(session.checks.agent.state,'failed');assert.equal(session.checks.agent.issue.recovery,'agent-repair');assert.deepEqual(session.checks.agent.issue.tools.map(t=>[t.tool,t.state]),[['git','broken'],['gh','missing']]);assert.match(session.checks.agent.action,/Git did not return a usable version/);assert.doesNotMatch(JSON.stringify(session),/fictional-private-output|secret/);
});

test('desktop agent needs no global Codex CLI; installed CLI does not establish an active session',()=>{
 const execute=command=>{if(command==='codex')throw Object.assign(Error('missing optional CLI'),{code:'ENOENT'});return output[command];};
 const evidence=verifyLocalTools('/fixture',{CODEX_THREAD_ID:'active'},execute);assert.equal(evidence.codex,'');assert.equal(evidence.gh,'gh version 2.98.0');assert.equal(evidence.activeCodexSession,true);
 assert.throws(()=>verifyLocalTools('/fixture',{},command=>output[command]),error=>error instanceof ReadinessToolFailure&&error.tools[0].tool==='agent'&&error.tools[0].state==='inactive');
});

test('tool diagnostic fields reject arbitrary instructions and reject mutated error data on save',async()=>{
 assert.throws(()=>new ReadinessToolFailure([{tool:'arbitrary-secret-command',state:'missing'}]),TypeError);
 assert.throws(()=>new ReadinessToolFailure([{tool:'gh',state:'missing',instructions:'untrusted'}]),TypeError);
 const session={checks:{}};await runReadinessCheck(session,{id:'agent',label:'Tools',action:'Fallback',verify:()=>{const error=new ReadinessToolFailure([{tool:'gh',state:'missing'}]);error.tools=[{tool:'private-secret',state:'missing'}];throw error;}},async()=>{});assert.doesNotMatch(JSON.stringify(session),/private-secret/);
});

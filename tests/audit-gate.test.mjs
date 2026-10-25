import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,cpSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {compositionServices} from '../scripts/deployment-target.mjs';

const source=fileURLToPath(new URL('..',import.meta.url));

// A clean pushed-main checkout with a recording `pnpm` shim. The shim never
// reaches a provider: it prints its arguments and exits with the fixture status.
function releaseFixture(t,shim){
 const root=mkdtempSync(join(tmpdir(),'composer-audit-gate-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const bin=join(root,'bin');mkdirSync(bin);
 for(const entry of ['scripts','lib','src','wrangler.jsonc','composition.lock.json'])cpSync(join(source,entry),join(root,entry),{recursive:true});
 // The fixture mirrors the promoted services that the real composition emits.
 const lock=JSON.parse(readFileSync(join(root,'composition.lock.json'),'utf8'));
 const config=JSON.parse(readFileSync(join(root,'wrangler.jsonc'),'utf8'));
 config.services=compositionServices(lock);
 writeFileSync(join(root,'wrangler.jsonc'),JSON.stringify(config,null,2)+'\n');
 const env={PATH:bin+':'+process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
 const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,env,encoding:'utf8',stdio:'pipe'}).trim();
 git(['init','-b','main']);git(['add','scripts','lib','src','wrangler.jsonc','composition.lock.json']);
 git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic release fixture']);
 git(['update-ref','refs/remotes/origin/main',git(['rev-parse','HEAD'])]);
 writeFileSync(join(root,'.git/info/exclude'),'bin/\n');
 writeFileSync(join(bin,'pnpm'),shim,{mode:0o700});
 const deploy=()=>execFileSync(process.execPath,['scripts/deploy.mjs'],{cwd:root,env,encoding:'utf8',timeout:10000,stdio:'pipe'});
 return {deploy};
}
const shim=body=>'#!/usr/bin/env node\n'+body;

test('failed dependency audit stops the actual clean-main deploy path before build or upload',t=>{
 const {deploy}=releaseFixture(t,shim('console.log("fixture invocation "+process.argv.slice(2).join(" "));process.exit(1);'));
 // A failing audit shim receives no runtime credentials. Any later invocation
 // records an unexpected command, so this tests the real deploy ordering.
 assert.throws(deploy,error=>{
  assert.equal(error.status,1);
  assert.equal(String(error.stdout).trim(),'fixture invocation run audit',String(error.stderr));
  return true;
 });
});

test('required checks run before remote migrations and stop the deploy when they fail',t=>{
 const {deploy}=releaseFixture(t,shim('console.log("fixture invocation "+process.argv.slice(2).join(" "));process.exit(process.argv[2]==="check"?1:0);'));
 assert.throws(deploy,error=>{
  const lines=String(error.stdout).trim().split('\n');
  assert.equal(error.status,1);
  assert.match(lines[0],/^fixture invocation run audit$/);
  assert.match(lines[1],/^Release gate passed: dependency audit \(/);
  assert.equal(lines[2],'fixture invocation check');
  assert.ok(!lines.some(line=>/wrangler|d1|deploy/.test(line)),'no remote command may run after a failed check');
  return true;
 });
});

test('a passing required check runs before the first remote migration',t=>{
 const {deploy}=releaseFixture(t,shim('console.log("fixture invocation "+process.argv.slice(2).join(" "));process.exit(process.argv[2]==="wrangler"?1:0);'));
 assert.throws(deploy,error=>{
  const lines=String(error.stdout).trim().split('\n');
  const check=lines.indexOf('fixture invocation check');
  const migration=lines.findIndex(line=>line.startsWith('fixture invocation wrangler d1 migrations apply'));
  assert.equal(error.status,1);
  assert.ok(check>0&&migration>check,'pnpm check must pass before the first remote D1 migration');
  return true;
 });
});

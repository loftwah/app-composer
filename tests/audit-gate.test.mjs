import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,cpSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('..',import.meta.url));
test('failed dependency audit stops the actual clean-main deploy path before build or upload',()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-audit-gate-'));
 try{
  const bin=join(root,'bin');mkdirSync(bin);
  for(const entry of ['scripts','lib','src','wrangler.jsonc','composition.lock.json'])cpSync(join(source,entry),join(root,entry),{recursive:true});
  const env={PATH:bin+':'+process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'};
  const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:root,env,encoding:'utf8',stdio:'pipe'}).trim();
  git(['init','-b','main']);git(['add','scripts','lib','src','wrangler.jsonc','composition.lock.json']);
  git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic release fixture']);
  git(['update-ref','refs/remotes/origin/main',git(['rev-parse','HEAD'])]);
  writeFileSync(join(root,'.git/info/exclude'),'bin/\n');
  // A failing audit shim receives no runtime credentials. Any later invocation
  // records an unexpected command, so this tests the real deploy ordering.
  writeFileSync(join(bin,'pnpm'),'#!/usr/bin/env node\nconsole.log("fixture invocation "+process.argv.slice(2).join(" "));process.exit(1);',{mode:0o700});
  assert.throws(()=>execFileSync(process.execPath,['scripts/deploy.mjs'],{cwd:root,env,encoding:'utf8',timeout:10000,stdio:'pipe'}),error=>{
   assert.equal(error.status,1);
   assert.equal(String(error.stdout).trim(),'fixture invocation run audit',String(error.stderr));
   return true;
  });
 }finally{rmSync(root,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalAdapter,discoverWorkspace,createReadinessSession,runReadinessSession,inspectReadiness,recipe,ReadinessFailure} from '../lib/get-ready/index.mjs';

function fixture() {
 const root=mkdtempSync(join(tmpdir(),'composer-owned-')),workspace=join(root,'hello'),bin=join(root,'bin'),remote=join(root,'remote.git'),calls=join(root,'calls'),state=join(root,'created');
 mkdirSync(workspace);mkdirSync(bin);mkdirSync(join(workspace,'.private'));
 const git=args=>execFileSync('/usr/bin/git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init','-b','main']);git(['remote','add','origin','https://github.com/loftwah/app-composer-hello.git']);
 writeFileSync(join(workspace,'.gitignore'),'.private/\n');writeFileSync(join(workspace,'LICENSE'),'MIT synthetic fixture\n');
 git(['add','.']);git(['-c','user.name=Fictional test','-c','user.email=fixture@example.test','commit','-m','Fictional public starter']);
 const source=git(['rev-parse','HEAD']);git(['update-ref','refs/remotes/origin/main',source]);
 execFileSync('/usr/bin/git',['init','--bare',remote],{stdio:'ignore'});
 const data={id:123,full_name:'fixture/my-hello',owner:{login:'fixture'},private:true,default_branch:'main',permissions:{push:true,admin:true}};
 const gh=(patch={})=>writeFileSync(join(bin,'gh'),`#!${process.execPath}
import fs from 'node:fs';
const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');
if(!args.includes('github.com'))process.exit(1);
const route=args[1];
if(route==='user')console.log(JSON.stringify({login:${JSON.stringify(patch.owner??'fixture')}}));
else if(route==='user/repos'){
 const input=JSON.parse(fs.readFileSync(0,'utf8'));
 if(input.private!==true||input.auto_init!==false||input.name!=='my-hello')process.exit(1);
 if(fs.existsSync(${JSON.stringify(state)})){console.log('HTTP/2.0 422 Unprocessable Entity\\n\\nExisting repo');process.exit(1);}
 fs.writeFileSync(${JSON.stringify(state)},'created');
 ${patch.afterCreate??''}
 console.log(JSON.stringify(${JSON.stringify({...data,...patch.data})}));
}else if(route.endsWith('/commits/main'))console.log(${JSON.stringify(source)});
else console.log(JSON.stringify(${JSON.stringify({...data,...patch.data})}));
`,{mode:0o755});
 gh();
 // Real Git worktree and bare remote. Only the provider and selected HTTPS transport
 // are fixtures; all refs, bytes, pushes, hooks and repeat behaviour are real Git.
 writeFileSync(join(bin,'git'),`#!${process.execPath}
import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');
for(let i=0;i<args.length;i++)if(args[i]==='https://github.com/fixture/my-hello.git'&&args.some(a=>['push','ls-remote'].includes(a)))args[i]=${JSON.stringify(remote)};
// The fixture bare transport replaces only the exact selected public-host URL.
if(args.some(a=>['push','ls-remote'].includes(a))){args.unshift('-c','protocol.file.allow=always');}
try{process.stdout.write(execFileSync('/usr/bin/git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}));}catch(e){process.stdout.write(e.stdout??'');process.exit(1);}
`,{mode:0o755});
 const env={...process.env,PATH:bin+':'+process.env.PATH,GH_HOST:'enterprise.example.test',CLOUDFLARE_API_TOKEN:'fictional-not-for-git',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'url.file:///bad.insteadOf',GIT_CONFIG_VALUE_0:'https://github.com/'};
 const adapter=()=>createLocalAdapter(discoverWorkspace(workspace),env);
 return {root,workspace,remote,calls,state,source,git,gh,env,adapter,cleanup:()=>rmSync(root,{recursive:true})};
}

test('owned source creates a private personal repository, pushes only reviewed main, rebinds origin and repeats without mutation',async()=>{
 const f=fixture();try{
  const first=await f.adapter().ownReference('fixture/my-hello');
  assert.deepEqual(first,{repository:'fixture/my-hello',commit:f.source,private:true,changed:true,deployed:false});
  assert.equal(f.git(['remote','get-url','origin']),'https://github.com/fixture/my-hello.git');
  assert.equal(f.git(['status','--porcelain']),'');
  assert.equal(execFileSync('/usr/bin/git',['--git-dir',f.remote,'rev-parse','main'],{encoding:'utf8'}).trim(),f.source);
  const before=readFileSync(f.calls,'utf8');
  assert.equal((await f.adapter().ownReference('fixture/my-hello')).changed,false);
  const after=readFileSync(f.calls,'utf8').slice(before.length);
  assert.ok(!after.includes('user/repos'));assert.ok(!after.includes('"push"'));assert.ok(!after.includes('"set-url"'));
  const receipt=JSON.parse(readFileSync(join(f.workspace,'.private/ownership.json'),'utf8'));assert.equal(receipt.id,123);
  assert.ok(!JSON.stringify(receipt).includes('fictional-not-for-git'));
 }finally{f.cleanup();}
});

test('ownership refuses a different account, existing name, hidden source edits and local execution filters before pushing',async()=>{
 for(const mode of ['account','existing','hidden','filter','pushurl','multiurl']){
  const f=fixture();try{
   if(mode==='account')f.gh({owner:'another-owner'});
   if(mode==='existing')writeFileSync(f.state,'existing');
   if(mode==='hidden'){f.git(['update-index','--assume-unchanged','LICENSE']);writeFileSync(join(f.workspace,'LICENSE'),'Owner changes remain\n');}
   if(mode==='multiurl')f.git(['config','--add','remote.origin.url','https://github.com/fixture/unselected.git']);
   if(mode==='pushurl')f.git(['config','remote.origin.pushurl','https://github.com/loftwah/app-composer-hello.git']);
   if(mode==='filter'){f.git(['config','filter.fixture.clean','touch '+join(f.root,'filter-ran')]);writeFileSync(join(f.workspace,'.git/info/attributes'),'LICENSE filter=fixture\n');}
   await assert.rejects(f.adapter().ownReference('fixture/my-hello'),error=>error instanceof ReadinessFailure);
   assert.equal(f.git(['remote','get-url','origin']),'https://github.com/loftwah/app-composer-hello.git');
   const calls=readFileSync(f.calls,'utf8');assert.ok(!calls.includes('"push"'));assert.equal(existsSync(join(f.root,'filter-ran')),false);
   if(mode==='hidden')assert.equal(readFileSync(join(f.workspace,'LICENSE'),'utf8'),'Owner changes remain\n');
   if(mode==='hidden'||mode==='account'||mode==='filter'||mode==='pushurl'||mode==='multiurl')assert.ok(!calls.includes('user/repos'));
  }finally{f.cleanup();}
 }
});

test('a provider-wait source change retains the new repository receipt but never pushes or overwrites owner work',async()=>{
 const f=fixture();try{
  f.gh({afterCreate:`fs.writeFileSync(${JSON.stringify(join(f.workspace,'LICENSE'))},'Changed while creating repository\\n');`});
  await assert.rejects(f.adapter().ownReference('fixture/my-hello'),error=>error instanceof ReadinessFailure&&error.code==='source');
  assert.ok(existsSync(join(f.workspace,'.private/ownership.json')));
  assert.ok(!readFileSync(f.calls,'utf8').includes('"push"'));
  assert.equal(readFileSync(join(f.workspace,'LICENSE'),'utf8'),'Changed while creating repository\n');
  assert.equal(f.git(['remote','get-url','origin']),'https://github.com/loftwah/app-composer-hello.git');
 }finally{f.cleanup();}
});

test('unexpected existing remote refs are preserved, and unfinished ownership is explicit, private and never retried on inspection',async()=>{
 const f=fixture();try{
  await f.adapter().ownReference('fixture/my-hello');
  execFileSync('/usr/bin/git',['--git-dir',f.remote,'update-ref','refs/heads/owner-work',f.source]);
  await assert.rejects(f.adapter().ownReference('fixture/my-hello'),error=>error instanceof ReadinessFailure&&error.code==='source');
  assert.equal(execFileSync('/usr/bin/git',['--git-dir',f.remote,'rev-parse','owner-work'],{encoding:'utf8'}).trim(),f.source);
 }finally{f.cleanup();}
 const context={workspace:'/fictional/hello',repo:'loftwah/app-composer-hello',source:'a'.repeat(40),dirty:false};let calls=0;
 const adapter={checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({checked:true})})),ownReference:async()=>{calls++;throw new ReadinessFailure('unavailable');}};
 const failed=await runReadinessSession(createReadinessSession(context),adapter,()=>{},{operation:'own-reference',repository:'fixture/my-hello'});
 const resumed=await runReadinessSession(createReadinessSession(context,failed),adapter);assert.equal(calls,1);assert.equal(inspectReadiness(resumed).ready,false);
 assert.ok(!JSON.stringify(inspectReadiness(resumed)).includes('fixture/my-hello'));
 await assert.rejects(runReadinessSession(createReadinessSession(context,resumed),adapter,()=>{},{operation:'own-reference',repository:'fixture/other'}),/another repository/);
 adapter.ownReference=async()=>({changed:true});
 const completed=await runReadinessSession(createReadinessSession(context,resumed),adapter,()=>{},{operation:'own-reference',repository:'fixture/my-hello'});
 assert.equal(completed.operation.state,'performed');assert.equal(inspectReadiness(completed).ready,false);assert.equal(completed.expiresAt,null);
});


test('a fabricated receipt cannot populate an existing repository without explicit completion intent',async()=>{
 const f=fixture();try{
  writeFileSync(f.state,'pre-existing');
  writeFileSync(join(f.workspace,'.private/ownership.json'),JSON.stringify({repository:'fixture/my-hello',source:f.source,id:123}));
  await assert.rejects(f.adapter().ownReference('fixture/my-hello'),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  assert.ok(!readFileSync(f.calls,'utf8').includes('"push"'));
  // Explicit completion is separate authority to populate the selected personal
  // private repository. It still cannot replace an existing main or other refs.
  const completed=await f.adapter().ownReference('fixture/my-hello',{resumeOwnership:true});
  assert.equal(completed.changed,true);
  assert.equal(completed.deployed,false);
  assert.equal((await f.adapter().ownReference('fixture/my-hello')).changed,false);
 }finally{f.cleanup();}
});

test('CLI rejects ambiguous ownership intent before writes; independent consumer accepts unselected pre-idea targets',()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-owned-cli-'));
 try{
  const ready=new URL('../scripts/ready.mjs',import.meta.url).pathname;
  for(const args of [['--resume-ownership'],['--own-reference','fixture/my-hello'],['--workspace',root,'--own-reference','fixture/my-hello','--deploy-reference'],['--workspace',root,'--own-reference','fixture/my-hello','--own-reference','fixture/other']]){
   assert.throws(()=>execFileSync(process.execPath,[ready,...args],{cwd:root,env:{PATH:''},stdio:['ignore','pipe','pipe']}));
   assert.equal(existsSync(join(root,'.private')),false);
  }
  const example=new URL('../examples/get-ready.mjs',import.meta.url).pathname;
  let output;
  try{execFileSync(process.execPath,[example,root],{cwd:root,env:{PATH:''},encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.fail('An empty environment cannot pass readiness');}catch(error){output=JSON.parse(String(error.stdout));}
  assert.equal(output.ready,false);assert.equal(output.capabilities.github,false);assert.ok(existsSync(join(root,'.private/readiness.json')));
 }finally{rmSync(root,{recursive:true});}
});

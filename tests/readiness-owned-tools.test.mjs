import test from 'node:test';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalAdapter,discoverWorkspace,ReadinessFailure} from '../lib/get-ready/index.mjs';

function fixture({typed=false}={}) {
 const root=mkdtempSync(join(tmpdir(),'composer-owned-tools-')),workspace=join(root,'hello'),bin=join(root,'bin'),calls=join(root,'package-calls');mkdirSync(workspace);mkdirSync(bin);
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init','-b','main']);git(['remote','add','origin','https://github.com/fixture/hello.git']);
 const inputs={'package.json':'{"name":"fictional-owned-starter","private":true}\n','pnpm-lock.yaml':'fictional reviewed lock\n','pnpm-workspace.yaml':'minimumReleaseAge: 1440\n','.gitignore':'.private/\nnode_modules/\n','worker.txt':'Fictional reviewed source\n'};
 if(typed){inputs['package.json']='{"name":"fictional-owned-starter","private":true,"devDependencies":{"typescript":"6.0.3"}}\n';inputs['scripts/build-source.mjs']='// Fictional committed source checker\n';mkdirSync(join(workspace,'scripts'));}
 for(const [file,bytes] of Object.entries(inputs))writeFileSync(join(workspace,file),bytes);
 git(['add','.']);git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Synthetic reviewed source']);
 const source=git(['rev-parse','HEAD']);git(['update-ref','refs/remotes/origin/main',source]);
 const configure=({owner='fixture',privateRepo=true,push=true,malformed=false,upstream=source,duringProvider='',duringInstall=''}={})=>{
  writeFileSync(join(bin,'gh'),`#!${process.execPath}
const args=process.argv.slice(2);if(!args.includes('github.com'))process.exit(1);
if(args[1]==='user')console.log(JSON.stringify({login:${JSON.stringify(owner)}}));
else if(args[1]==='repos/fixture/hello'){
 ${duringProvider}
 console.log(JSON.stringify(${malformed?'{}':"{full_name:'fixture/hello',owner:{login:'fixture'},private:"+privateRepo+",default_branch:'main',permissions:{push:"+push+",admin:true}}"}));
}else console.log(args[1].includes('loftwah')?${JSON.stringify(upstream)}:${JSON.stringify(source)});
`,{mode:0o755});
  writeFileSync(join(bin,'pnpm'),`#!${process.execPath}
import fs from 'node:fs';import path from 'node:path';
const args=process.argv.slice(2);
if(args[0]==='--version'){console.log('12.8.1');process.exit(0);}
fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify({cwd:process.cwd(),files:fs.readdirSync('.'),args,credentials:!!process.env.CLOUDFLARE_API_TOKEN||!!process.env.GH_TOKEN,config:process.env.XDG_CONFIG_HOME})+'\\n');
if(process.cwd()===${JSON.stringify(workspace)}||fs.existsSync('.npmrc')||fs.existsSync('.pnpmfile.cjs')||process.env.CLOUDFLARE_API_TOKEN||process.env.GH_TOKEN)process.exit(1);
const expected=${JSON.stringify(inputs)};
for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml'])if(fs.readFileSync(file,'utf8')!==expected[file])process.exit(1);
for(const flag of ['--frozen-lockfile','--ignore-scripts','--ignore-pnpmfile','--registry=https://registry.npmjs.org','--userconfig=/dev/null'])if(!args.includes(flag))process.exit(1);
fs.mkdirSync('node_modules/wrangler/bin',{recursive:true});
fs.writeFileSync('node_modules/wrangler/package.json',JSON.stringify({name:'wrangler',version:'4.152.0',bin:{wrangler:'./bin/wrangler.js'}}));
fs.writeFileSync('node_modules/wrangler/bin/wrangler.js','console.log("4.152.0")');
${typed?`fs.mkdirSync('node_modules/typescript/lib',{recursive:true});fs.writeFileSync('node_modules/typescript/package.json',JSON.stringify({name:'typescript',version:'6.0.3'}));fs.writeFileSync('node_modules/typescript/lib/typescript.js','// Fictional installed compiler');`:''}
${duringInstall}
`,{mode:0o755});
 };
 configure();
 const env={...process.env,PATH:bin+':'+process.env.PATH,GH_HOST:'enterprise.example.test',GH_TOKEN:'fictional-only',CLOUDFLARE_API_TOKEN:'fictional-only'};
 const context=discoverWorkspace(workspace),adapter=()=>createLocalAdapter(context,env);
 return {root,workspace,bin,calls,source,inputs,git,configure,env,context,adapter,cleanup:()=>rmSync(root,{recursive:true})};
}

const supported=process.platform==='darwin'&&process.arch==='arm64'&&process.versions.node.split('.')[0]==='22';
test('owned starter installs only isolated reviewed dependency inputs, preserves ignored owner config and repeats without installation',{skip:!supported},async()=>{
 const f=fixture();try{
  writeFileSync(join(f.workspace,'.git/info/exclude'),'.npmrc\n.pnpmfile.cjs\n');
  const config='@cloudflare:registry=https://private.example.test/\n';writeFileSync(join(f.workspace,'.npmrc'),config);
  writeFileSync(join(f.workspace,'.pnpmfile.cjs'),'throw Error("Owner hook must not run");\n');
  f.configure({push:false});
  const first=await f.adapter().installReferenceTools();assert.equal(first.changed,true);assert.equal(first.wrangler,'4.152.0');
  const called=JSON.parse(readFileSync(f.calls,'utf8'));assert.notEqual(called.cwd,f.workspace);assert.deepEqual(called.files.sort(),['package.json','pnpm-lock.yaml','pnpm-workspace.yaml']);assert.equal(called.credentials,false);
  assert.equal(existsSync(called.cwd),false);assert.equal(readFileSync(join(f.workspace,'.npmrc'),'utf8'),config);
  for(const [file,bytes] of Object.entries(f.inputs))assert.equal(readFileSync(join(f.workspace,file),'utf8'),bytes);
  assert.equal(f.git(['status','--porcelain']),'');
  assert.equal((await f.adapter().installReferenceTools()).changed,false);assert.equal(readFileSync(f.calls,'utf8').trim().split('\n').length,1);
  await assert.rejects(f.adapter().deployReference(),error=>error instanceof ReadinessFailure&&error.code==='configuration');
 }finally{f.cleanup();}
});

test('tracked source checker preparation requires its reviewed exact local compiler and preserves incomplete owner tools',{skip:!supported},async()=>{
 const f=fixture({typed:true});try{
  assert.equal((await f.adapter().installReferenceTools()).changed,true);
  assert.equal((await f.adapter().installReferenceTools()).changed,false);
  const compiler=join(f.workspace,'node_modules/typescript/package.json'),original=readFileSync(compiler);
  for(const version of [null,'5.9.3']){
   if(version===null)rmSync(compiler);else writeFileSync(compiler,JSON.stringify({name:'typescript',version}));
   await assert.rejects(f.adapter().installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code==='configuration');
   assert.equal(readFileSync(f.calls,'utf8').trim().split('\n').length,1);
   assert.equal(existsSync(join(f.workspace,'node_modules/wrangler/bin/wrangler.js')),true);
   writeFileSync(compiler,original);
  }
 }finally{f.cleanup();}
});

test('owned tool preparation refuses changed/public/unowned/malformed source before package installation',async()=>{
 for(const options of [{upstream:'b'.repeat(40)},{privateRepo:false},{owner:'other-owner'},{malformed:true}]){
  const f=fixture();try{
   f.configure(options);
   await assert.rejects(f.adapter().installReferenceTools(),error=>error instanceof ReadinessFailure&&['source','configuration','response'].includes(error.code));
   assert.equal(existsSync(f.calls),false);assert.equal(existsSync(join(f.workspace,'node_modules')),false);
  }finally{f.cleanup();}
 }
});

test('hidden source changes and provider-wait edits cannot reach owned package execution',async()=>{
 for(const mode of ['hidden','provider']){
  const f=fixture();try{
   if(mode==='hidden'){f.git(['update-index','--assume-unchanged','worker.txt']);writeFileSync(join(f.workspace,'worker.txt'),'Owner changes remain\n');}
   else f.configure({duringProvider:`await import('node:fs').then(fs=>fs.writeFileSync(${JSON.stringify(join(f.workspace,'worker.txt'))},'Owner changes remain\\n'));`});
   await assert.rejects(f.adapter().installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code==='source');
   assert.equal(existsSync(f.calls),false);assert.equal(existsSync(join(f.workspace,'node_modules')),false);assert.equal(readFileSync(join(f.workspace,'worker.txt'),'utf8'),'Owner changes remain\n');
  }finally{f.cleanup();}
 }
});

test('changes during isolated installation prevent adoption; an existing partial installation is preserved',{skip:!supported},async()=>{
 const f=fixture();try{
  f.configure({duringInstall:`fs.writeFileSync(${JSON.stringify(join(f.workspace,'worker.txt'))},'Changed while installing\\n');`});
  await assert.rejects(f.adapter().installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code==='source');
  assert.ok(existsSync(f.calls));assert.equal(existsSync(join(f.workspace,'node_modules')),false);assert.equal(readFileSync(join(f.workspace,'worker.txt'),'utf8'),'Changed while installing\n');
 }finally{f.cleanup();}
 const partial=fixture();try{
  mkdirSync(join(partial.workspace,'node_modules'));writeFileSync(join(partial.workspace,'node_modules/owner.txt'),'Retain partial owner installation\n');
  await assert.rejects(partial.adapter().installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code==='configuration');
  assert.equal(existsSync(partial.calls),false);assert.equal(readFileSync(join(partial.workspace,'node_modules/owner.txt'),'utf8'),'Retain partial owner installation\n');
 }finally{partial.cleanup();}
});


test('changed-and-restored copy inputs are refused before pnpm even when the workspace recheck sees original bytes',{skip:!supported},async()=>{
 const f=fixture(),originalRead=fs.readFileSync;let intercepted=false;
 try{
  const target=fs.realpathSync(join(f.workspace,'package.json'));
  fs.readFileSync=function(path,...options){
   if(path===target&&!intercepted){
    intercepted=true;
    const original=originalRead(path);
    writeFileSync(path,'{"name":"transient-unreviewed-copy"}\n');
    const copied=originalRead(path,...options);
    writeFileSync(path,original);
    return copied;
   }
   return originalRead(path,...options);
  };
  syncBuiltinESMExports();
  await assert.rejects(f.adapter().installReferenceTools(),error=>error instanceof ReadinessFailure&&error.code==='source');
  assert.equal(intercepted,true);assert.equal(existsSync(f.calls),false);assert.equal(existsSync(join(f.workspace,'node_modules')),false);
  assert.equal(originalRead(target,'utf8'),f.inputs['package.json']);assert.equal(f.git(['status','--porcelain']),'');
 }finally{fs.readFileSync=originalRead;syncBuiltinESMExports();f.cleanup();}
});

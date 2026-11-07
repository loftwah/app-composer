import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
 normalizeSourcePath,
 validateSourceLocator,
 validateSourceSet,
 validateComposedSources,
 compositionPlan,
 readManifestFromCommit,
 discoverWorkspaceApps,
 sourceLabel,
 parseSourceArgument,
 manifestApiPath,
 maximumPathDepth,
 maximumWorkspaceApps,
} from '../scripts/source-locator.mjs';
import {validateSourcePlan,composeSources} from '../scripts/compose-sources.mjs';

const root='https://github.com/fixture/product';
const sha='a'.repeat(40);
const manifest=(id,repository=root,route='/'+id)=>({contract:1,id,name:id,version:'1.0.0',repository,runtime:'cloudflare-worker',entry:'src/worker.ts',dataVersion:1,routes:[route],capabilities:[],configuration:{}});

function git(directory,args){
 return execFileSync('git',['-C',directory,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
}

// A real repository is the only honest way to prove tree reading, symlink
// refusal and discovery, so fixtures are committed in a temporary Git repo.
function repository(apps,{origin=root}={}){
 const directory=mkdtempSync(join(tmpdir(),'composer-source-locator-'));
 git(directory,['init','-b','main']);
 if(origin)git(directory,['remote','add','origin',origin]);
 for(const [path,value] of Object.entries(apps)){
  const file=join(directory,path);
  mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2));
 }
 git(directory,['add','.']);
 git(directory,['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Synthetic composition fixture']);
 return {directory,commit:git(directory,['rev-parse','HEAD']).trim()};
}

test('source paths normalise root and reject traversal, escapes and unsafe segments',()=>{
 for(const value of [undefined,null,'','.','./'])assert.equal(normalizeSourcePath(value),'');
 assert.equal(normalizeSourcePath('apps/guestbook'),'apps/guestbook');
 assert.equal(normalizeSourcePath('packages/miniapps/showcase'),'packages/miniapps/showcase');
 for(const value of ['/apps','apps/','apps//guestbook','apps/../x','..','apps/./x','apps\\guestbook','apps:C','C:apps','apps/con','apps/lpt9/x','apps/.git','apps/guestbook.','apps/\u0000x','apps/guest book']){
  assert.throws(()=>normalizeSourcePath(value),/Invalid source locator/,value);
 }
 assert.doesNotThrow(()=>normalizeSourcePath(Array.from({length:maximumPathDepth},(_,index)=>'a'+index).join('/')));
 assert.throws(()=>normalizeSourcePath(Array.from({length:maximumPathDepth+1},(_,index)=>'a'+index).join('/')),/deeper/);
 assert.throws(()=>normalizeSourcePath('a'.repeat(65)),/safe name/);
});

test('locators require an exact commit, a credential-free GitHub origin and no extra fields',()=>{
 assert.deepEqual(validateSourceLocator({repository:root,commit:sha}),{repository:root,commit:sha,path:''});
 assert.equal(validateSourceLocator({repository:root,commit:sha,path:'apps/guestbook'}).path,'apps/guestbook');
 for(const patch of [
  {repository:'https://user:pass@github.com/fixture/product'},
  {repository:'http://github.com/fixture/product'},
  {repository:'git@github.com:fixture/product.git'},
  {repository:'https://github.com/fixture/product/'},
  {repository:'https://gitlab.com/fixture/product'},
  {commit:sha.toUpperCase()},
  {commit:'abc123'},
  {commit:'b'.repeat(39)},
  {commit:'b'.repeat(41)},
  {extra:true},
 ]){
  assert.throws(()=>validateSourceLocator({repository:root,commit:sha,...patch}),/Invalid source locator/,JSON.stringify(patch));
 }
 assert.equal(sourceLabel({repository:root,commit:sha,path:'apps/guestbook'}),'fixture/product@aaaaaaaaaaaa#apps/guestbook');
 assert.equal(manifestApiPath({repository:root,commit:sha,path:'apps/guestbook'}),'repos/fixture/product/contents/apps/guestbook/app.manifest.json?ref='+sha);
 assert.equal(parseSourceArgument('guestbook=fixture/product@'+sha+':apps/guestbook').path,'apps/guestbook');
 assert.throws(()=>parseSourceArgument('guestbook=fixture/product@main'),/exact commit/);
});

test('duplicate and overlapping identities in one repository are rejected while mixed repositories pass',()=>{
 assert.equal(validateSourceSet([
  {repository:root,commit:sha,path:'apps/guestbook'},
  {repository:root,commit:sha,path:'packages/miniapps/showcase'},
 ]),true);
 assert.throws(()=>validateSourceSet([
  {repository:root,commit:sha,path:'Apps/Guestbook'},
  {repository:root,commit:'b'.repeat(40),path:'apps/guestbook'},
 ]),/duplicate identity/);
 for(const paths of [['','apps/guestbook'],['apps','apps/guestbook'],['apps/guestbook','apps']]){
  assert.throws(()=>validateSourceSet(paths.map(path=>({repository:root,commit:sha,path}))),/overlapping identities/);
 }
 assert.doesNotThrow(()=>validateSourceSet([
  {repository:root,commit:sha,path:'apps/guestbook'},
  {repository:'https://github.com/fixture/other',commit:sha,path:'apps/guestbook'},
 ]));
});

test('Git tree reading returns the reviewed manifest and fails closed on links, missing paths and bad JSON',()=>{
 const fixture=repository({
  'app.manifest.json':manifest('host',root,'/host'),
  'apps/guestbook/app.manifest.json':manifest('guestbook'),
  'apps/guestbook/.gitignore':'node_modules/\n',
  'apps/missing/app.manifest.json':'{not json',
  'apps/linked/app.manifest.json':'ignored',
 });
 try{
  const {directory,commit}=fixture;
  assert.equal(readManifestFromCommit({workspace:directory,commit,path:'apps/guestbook'}).id,'guestbook');
  assert.equal(readManifestFromCommit({workspace:directory,commit}).id,'host');
  assert.throws(()=>readManifestFromCommit({workspace:directory,commit,path:'apps/absent'}),/No app\.manifest\.json/);
  assert.throws(()=>readManifestFromCommit({workspace:directory,commit,path:'apps/missing'}),/not valid JSON/);
  rmSync(join(directory,'apps/linked/app.manifest.json'));
  symlinkSync('../guestbook/app.manifest.json',join(directory,'apps/linked/app.manifest.json'));
  git(directory,['add','.']);
  git(directory,['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Add a linked manifest']);
  const linked=git(directory,['rev-parse','HEAD']).trim();
  assert.throws(()=>readManifestFromCommit({workspace:directory,commit:linked,path:'apps/linked'}),/symbolic link/);
  assert.throws(()=>readManifestFromCommit({workspace:directory,commit:'b'.repeat(40),path:'apps/guestbook'}),/could not be read/);
  assert.throws(()=>readManifestFromCommit({workspace:directory,commit:'main',path:'apps/guestbook'}),/40-character/);
 }finally{rmSync(fixture.directory,{recursive:true,force:true});}
});

test('workspace discovery is bounded, sorted, ignores the host root and node_modules',()=>{
 const apps={
  'apps/guestbook/app.manifest.json':manifest('guestbook'),
  'packages/miniapps/showcase/app.manifest.json':manifest('showcase'),
  'apps/guestbook/node_modules/dependency/app.manifest.json':manifest('ignored'),
  'apps/no-manifest/readme.md':'No contract here\n',
 };
 const fixture=repository(apps);
 try{
  const {directory,commit}=fixture;
  assert.deepEqual(discoverWorkspaceApps({workspace:directory,commit}),['apps/guestbook','packages/miniapps/showcase']);
  assert.deepEqual(discoverWorkspaceApps({workspace:directory,commit,root:'apps'}),['apps/guestbook']);
  assert.deepEqual(discoverWorkspaceApps({workspace:directory,commit,root:'packages/miniapps'}),['packages/miniapps/showcase']);
 }finally{rmSync(fixture.directory,{recursive:true,force:true});}
 const many={};
 for(let index=0;index<maximumWorkspaceApps+1;index++)many['apps/app-'+index+'/app.manifest.json']=manifest('app-'+index);
 const bounded=repository(many);
 try{
  assert.throws(()=>discoverWorkspaceApps({workspace:bounded.directory,commit:bounded.commit}),/more than/);
 }finally{rmSync(bounded.directory,{recursive:true,force:true});}
});

test('mixed in-repo and external sources compose with exact provenance and honest collisions',()=>{
 const inRepo={id:'guestbook',repository:root,commit:sha,path:'apps/guestbook',manifest:manifest('guestbook')};
 const external={id:'showcase',repository:'https://github.com/fixture/showcase',commit:'c'.repeat(40),path:'',manifest:manifest('showcase','https://github.com/fixture/showcase')};
 assert.equal(validateComposedSources([inRepo,external]),true);
 const plan=compositionPlan([external,inRepo]);
 assert.deepEqual(plan.map(entry=>entry.id),['guestbook','showcase']);
 assert.equal(plan[0].source,'fixture/product@aaaaaaaaaaaa#apps/guestbook');
 assert.equal(plan[1].path,'');
 assert.throws(()=>validateComposedSources([{...inRepo,manifest:manifest('other')}]),/id does not match/);
 assert.throws(()=>validateComposedSources([{...inRepo,manifest:manifest('guestbook','https://github.com/attacker/product')}]),/repository does not match/);
 assert.throws(()=>validateComposedSources([inRepo,{...external,manifest:manifest('showcase','https://github.com/fixture/showcase','/guestbook')}]),/route collision/);
 assert.throws(()=>validateComposedSources([inRepo,{...inRepo,id:'mirror',manifest:manifest('mirror')}]),/duplicate identity/);
});

test('a source plan rejects unknown fields, unsafe paths and duplicate ids before any read',()=>{
 const good={contract:1,reviewed:'2026-11-07',sources:[{id:'guestbook',repository:root,commit:sha,path:'apps/guestbook',url:'https://guestbook.example.com'}]};
 const plan=validateSourcePlan(good);
 assert.equal(plan.sources[0].url,'https://guestbook.example.com');
 for(const patch of [
  {contract:2},
  {reviewed:'7 November'},
  {sources:[]},
  {sources:[{id:'guestbook',repository:root,commit:sha,path:'../escape'}]},
  {sources:[{id:'guestbook',repository:root,commit:sha,url:'http://guestbook.example.com'}]},
  {sources:[{id:'guestbook',repository:root,commit:sha,url:'https://guestbook.example.com/path'}]},
  {sources:[{id:'guestbook',repository:root,commit:sha,secret:'x'}]},
  {sources:[{id:'guestbook',repository:root,commit:sha},{id:'guestbook',repository:'https://github.com/fixture/other',commit:sha}]},
 ]){
  assert.throws(()=>validateSourcePlan({...good,...patch}),/Source plan|Invalid source locator/,JSON.stringify(patch));
 }
});

test('the source-plan command checks local exact commits and stages without rewriting the lock',()=>{
 const fixture=repository({
  'apps/guestbook/app.manifest.json':manifest('guestbook'),
  'packages/miniapps/showcase/app.manifest.json':manifest('showcase'),
 });
 try{
  const {directory,commit}=fixture;
  const workspace=mkdtempSync(join(tmpdir(),'composer-source-plan-'));
  try{
   writeFileSync(join(workspace,'composition.sources.json'),JSON.stringify({contract:1,reviewed:'2026-11-07',sources:[
    {id:'guestbook',repository:root,commit,path:'apps/guestbook',url:'https://guestbook.example.com'},
    {id:'showcase',repository:root,commit,path:'packages/miniapps/showcase'},
   ]}));
   const checked=composeSources({workspace,locals:{guestbook:directory,showcase:directory}});
   assert.equal(checked.state,'checked');
   assert.match(checked.id,/^[a-f0-9]{64}$/);
   assert.equal(checked.lockWritten,false);
   assert.equal(existsSync(join(workspace,'composition.lock.json')),false);
   const staged=composeSources({workspace,locals:{guestbook:directory,showcase:directory},stage:true});
   assert.equal(staged.state,'staged');
   const candidate=join(workspace,'.private','candidates',staged.id+'.json');
   assert.equal(existsSync(candidate),true);
   assert.equal(JSON.parse(readFileSync(candidate,'utf8')).state,'staged');
   assert.throws(()=>composeSources({workspace,locals:{guestbook:workspace,showcase:directory}}),/origin/);
   assert.throws(()=>composeSources({workspace:workspace,file:'absent.json'}),/not found/);
  }finally{rmSync(workspace,{recursive:true,force:true});}
 }finally{rmSync(fixture.directory,{recursive:true,force:true});}
});

test('the command resolves a reviewed GitHub source through the GitHub API without executing it',()=>{
 const workspace=mkdtempSync(join(tmpdir(),'composer-source-github-'));
 const bin=mkdtempSync(join(tmpdir(),'composer-source-gh-'));
 try{
  const body={type:'file',encoding:'base64',content:Buffer.from(JSON.stringify(manifest('guestbook'))).toString('base64')};
  writeFileSync(join(bin,'gh'),'#!/bin/sh\nprintf %s '+JSON.stringify(JSON.stringify(body))+'\n',{mode:0o755});
  writeFileSync(join(workspace,'composition.sources.json'),JSON.stringify({contract:1,reviewed:'2026-11-07',sources:[{id:'guestbook',repository:root,commit:sha,path:'apps/guestbook'}]}));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/compose-sources.mjs',import.meta.url)),'--workspace',workspace],{cwd:workspace,env:{...process.env,PATH:bin+':'+process.env.PATH},encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);
  assert.equal(output.state,'checked');
  assert.equal(output.sources[0].source,'fixture/product@aaaaaaaaaaaa#apps/guestbook');
  assert.equal(output.deployed,false);
  assert.equal(spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/compose-sources.mjs',import.meta.url)),'--workspace',workspace,'--local','guestbook='+workspace],{cwd:workspace,env:{...process.env,PATH:bin+':'+process.env.PATH},encoding:'utf8'}).status,1);
 }finally{
  rmSync(workspace,{recursive:true,force:true});
  rmSync(bin,{recursive:true,force:true});
 }
});

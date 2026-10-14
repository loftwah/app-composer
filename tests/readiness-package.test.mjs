import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,unlinkSync,linkSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packageGetReady,writePackageArtifact,assertReleasePackage} from '../scripts/package-get-ready.mjs';
import {pathToFileURL} from 'node:url';

test('release archive installs independently, retains exact input provenance and excludes private files/lifecycle/dependencies',()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-package-test-'));
 try{
  const source=join(root,'source'),output=join(root,'output'),consumer=join(root,'consumer');cpSync('lib/get-ready',source,{recursive:true});mkdirSync(consumer);
  writeFileSync(join(source,'.env'),'FAKE_PRIVATE_VALUE=fictional-do-not-package');mkdirSync(join(source,'.private'));writeFileSync(join(source,'.private','receipt.json'),'fictional-private-receipt');
  const metadata=packageGetReady({directory:source,sourceBoundary:root,destinationBoundary:root,destination:output}),archive=join(output,'get-ready-core.tgz');
  assert.equal(metadata.sha256,createHash('sha256').update(readFileSync(archive)).digest('hex'));assert.equal(metadata.runtimeDependencies,0);assert.equal(packageGetReady({directory:source,sourceBoundary:root,destinationBoundary:root,destination:join(root,'repeat')}).sha256,metadata.sha256,'Unchanged inputs must produce the same archive');
  writeFileSync(join(root,'npm-user'), '');writeFileSync(join(root,'npm-global'),'');
  const env={PATH:process.env.PATH,HOME:root,TMPDIR:root,NPM_CONFIG_USERCONFIG:join(root,'npm-user'),NPM_CONFIG_GLOBALCONFIG:join(root,'npm-global'),NPM_CONFIG_CACHE:join(root,'cache')};
  execFileSync('npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund','--package-lock=false',archive],{cwd:consumer,env,timeout:20000,stdio:'pipe'});
  const installed=join(consumer,'node_modules/@loftwah/get-ready');assert.equal(existsSync(join(installed,'.env')),false);assert.equal(existsSync(join(installed,'.private')),false);
  const proof=JSON.parse(readFileSync(join(installed,'SOURCE.json'),'utf8'));for(const [name,hash] of Object.entries(proof.files))assert.equal(createHash('sha256').update(readFileSync(join(installed,name))).digest('hex'),hash,name);
  assert.match(readFileSync(join(installed,'LICENSE'),'utf8'),/MIT License/);
  const cli=join(installed,'cli.mjs'),help=execFileSync(join(consumer,'node_modules/.bin/get-ready'),['--help'],{cwd:consumer,env,encoding:'utf8'});assert.match(help,/shared App Composer environment engine/);
  const api=execFileSync(process.execPath,['--input-type=module','-e',"import {recipe,createReadinessSession,runReadinessSession,readinessReport,diagnoseDomain,inspectDomainReport} from '@loftwah/get-ready'; if(typeof diagnoseDomain!=='function'||typeof inspectDomainReport!=='function')throw Error('Installed domain API missing');const s=await runReadinessSession(createReadinessSession({workspace:process.cwd()}),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({fictional:true})}))});console.log(JSON.stringify(readinessReport(s)));"],{cwd:consumer,env,encoding:'utf8'});assert.equal(JSON.parse(api).state,'verified');assert.doesNotMatch(api,/fictional|receipt|workspace/);
  const invalid=spawnSync(process.execPath,[cli,'--workspace',consumer,'--clone-reference',join(root,'never-created'),'--deploy-reference'],{cwd:consumer,env,encoding:'utf8'});assert.notEqual(invalid.status,0);assert.equal(existsSync(join(consumer,'.private')),false);assert.equal(existsSync(join(root,'never-created')),false);
  const altered=JSON.parse(readFileSync(join(source,'package.json'),'utf8'));altered.scripts={prepack:'touch '+join(root,'should-not-execute')};writeFileSync(join(source,'package.json'),JSON.stringify(altered));assert.throws(()=>packageGetReady({directory:source,sourceBoundary:root,destinationBoundary:root,destination:output}),/lifecycle/);assert.equal(existsSync(join(root,'should-not-execute')),false);
 }finally{rmSync(root,{recursive:true});}
});

test('packaging refuses a substituted core file rather than following it into private data',()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-package-link-'));try{const source=join(root,'source');cpSync('lib/get-ready',source,{recursive:true});const owner=join(root,'owner-secret');writeFileSync(owner,'fictional-private');unlinkSync(join(source,'engine.mjs'));symlinkSync(owner,join(source,'engine.mjs'));assert.throws(()=>packageGetReady({directory:source,sourceBoundary:root,destinationBoundary:root,destination:join(root,'out')}),/ordinary unlinked source file/);assert.equal(readFileSync(owner,'utf8'),'fictional-private');}finally{rmSync(root,{recursive:true});}
});

test('linked output files/directories preserve owner bytes, including source metadata',()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-package-output-'));try{
  const owner=join(root,'owner');writeFileSync(owner,'fictional-owner-bytes');
  for(const name of ['get-ready-core.tgz','get-ready-core.json','get-ready-package.json']){
   const output=join(root,name);symlinkSync(owner,output);assert.throws(()=>writePackageArtifact(output,'replacement',{boundary:root}),/ordinary unlinked/);assert.equal(readFileSync(owner,'utf8'),'fictional-owner-bytes');unlinkSync(output);
   linkSync(owner,output);assert.throws(()=>writePackageArtifact(output,'replacement',{boundary:root}),/ordinary unlinked/);assert.equal(readFileSync(owner,'utf8'),'fictional-owner-bytes');unlinkSync(output);
  }
  const real=join(root,'real');mkdirSync(real);const linked=join(root,'linked');symlinkSync(real,linked);assert.throws(()=>writePackageArtifact(join(linked,'get-ready-core.tgz'),'replacement',{boundary:root}),/directory must not be linked/);assert.equal(existsSync(join(real,'get-ready-core.tgz')),false);
 }finally{rmSync(root,{recursive:true});}
});

test('hidden Git input edits are development snapshots and linked root licence cannot enter an archive',async()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-package-provenance-'));try{
  const repo=join(root,'repo');mkdirSync(join(repo,'scripts'),{recursive:true});mkdirSync(join(repo,'lib'));cpSync('lib/get-ready',join(repo,'lib/get-ready'),{recursive:true});cpSync('scripts/package-get-ready.mjs',join(repo,'scripts/package-get-ready.mjs'));cpSync('LICENSE',join(repo,'LICENSE'));
  const env={PATH:process.env.PATH,HOME:root,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'};
  const git=args=>execFileSync('git',args,{cwd:repo,env,encoding:'utf8',stdio:'pipe'}).trim();git(['init','-b','main']);git(['add','.']);git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Fictional package source']);
  const {packageGetReady:isolatedPack}=await import(pathToFileURL(join(repo,'scripts/package-get-ready.mjs')).href);
  assert.equal(isolatedPack({destinationBoundary:root,destination:join(root,'clean')}).developmentSnapshot,false);
  git(['update-index','--assume-unchanged','lib/get-ready/index.mjs']);const entry=join(repo,'lib/get-ready/index.mjs');writeFileSync(entry,readFileSync(entry,'utf8')+'\n// A fictional hidden edit.\n');assert.equal(git(['status','--porcelain']),'');assert.equal(isolatedPack({destinationBoundary:root,destination:join(root,'changed')}).developmentSnapshot,true);
  const owner=join(root,'private-licence');writeFileSync(owner,'fictional-private-data');unlinkSync(join(repo,'LICENSE'));symlinkSync(owner,join(repo,'LICENSE'));assert.throws(()=>isolatedPack({destinationBoundary:root,destination:join(root,'never')}),/ordinary unlinked source file: LICENSE/);assert.equal(existsSync(join(root,'never/get-ready-core.tgz')),false);assert.equal(readFileSync(owner,'utf8'),'fictional-private-data');
 }finally{rmSync(root,{recursive:true});}
});


test('production refuses development, stale-source and altered archive artifacts',()=>{
 const bytes=Buffer.from('fictional archive'),source='a'.repeat(40),metadata={name:'@loftwah/get-ready',source,developmentSnapshot:false,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 assert.doesNotThrow(()=>assertReleasePackage(metadata,bytes,source));
 for(const changed of [{...metadata,developmentSnapshot:true},{...metadata,source:'b'.repeat(40)},{...metadata,bytes:1},{...metadata,sha256:'0'.repeat(64)}])assert.throws(()=>assertReleasePackage(changed,bytes,source),/before production/);
 assert.throws(()=>assertReleasePackage(metadata,Buffer.from('changed archive'),source),/before production/);
});


test('linked source and output ancestors cannot redirect a package below the trusted boundary',()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-package-ancestor-'));try{
  const owner=join(root,'owner');mkdirSync(join(owner,'downloads'),{recursive:true});const publicPath=join(root,'public');symlinkSync(owner,publicPath);assert.throws(()=>writePackageArtifact(join(publicPath,'downloads/get-ready-core.tgz'),'replacement',{boundary:root}),/directory must not be linked/);assert.equal(existsSync(join(owner,'downloads/get-ready-core.tgz')),false);
  cpSync('lib/get-ready',join(owner,'get-ready'),{recursive:true});const library=join(root,'lib');symlinkSync(owner,library);assert.throws(()=>packageGetReady({directory:join(library,'get-ready'),sourceBoundary:root,destination:join(root,'out'),destinationBoundary:root}),/directory must not be linked/);assert.equal(existsSync(join(root,'out/get-ready-core.tgz')),false);
 }finally{rmSync(root,{recursive:true});}
});

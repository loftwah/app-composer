import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,chmodSync,constants,fstatSync,lstatSync,mkdirSync,mkdtempSync,openSync,readFileSync,realpathSync,renameSync,rmSync,unlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runtime=['project-files.mjs','site-skills.mjs','site-skills.d.mts','site-skills.json','project-report.mjs','project-report.d.mts','project.mjs','project.d.mts','project-skills.json','domain.mjs','domain-report.mjs','domain-report.d.mts','check.mjs','cli.mjs','engine.mjs','index.mjs','inspect.mjs','local-checks.mjs','local.mjs','ownership.mjs','preferences.d.mts','preferences.mjs','report.d.mts','report.mjs','state.mjs','workspace-tools.mjs'];
const inputs=[...runtime,'README.md','package.json'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
function directoryGuard(path,boundary=repository,create=false){
 const base=resolve(boundary),selected=resolve(path),suffix=relative(base,selected);
 if(suffix==='..'||suffix.startsWith('../')||isAbsolute(suffix))throw Error('Package path is outside its trusted boundary.');
 const initial=lstatSync(base);if(!initial.isDirectory()||initial.isSymbolicLink())throw Error('Package directory must not be linked.');
 // Canonicalise the trusted boundary first, permitting system aliases such as /var.
 const canonical=realpathSync(base),directories=[{path:canonical,stat:lstatSync(canonical)}];
 let cursor=canonical;
 for(const component of suffix.split('/').filter(Boolean)){
  cursor=join(cursor,component);let stat;
  try{stat=lstatSync(cursor);}catch(error){if(error.code!=='ENOENT'||!create)throw error;mkdirSync(cursor);stat=lstatSync(cursor);}
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Package directory must not be linked.');directories.push({path:cursor,stat});
 }
 return ()=>{const now=lstatSync(base);if(now.isSymbolicLink()||realpathSync(base)!==canonical||now.ino!==initial.ino||now.dev!==initial.dev)throw Error('Package directory changed.');for(const entry of directories){const actual=lstatSync(entry.path);if(!actual.isDirectory()||actual.isSymbolicLink()||actual.ino!==entry.stat.ino||actual.dev!==entry.stat.dev)throw Error('Package directory changed.');}return cursor;};
}
function readInput(path,boundary=repository){
 const check=directoryGuard(dirname(path),boundary),canonical=join(check(),basename(path)),before=lstatSync(canonical);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1)throw Error('Package input must be an ordinary unlinked source file: '+basename(path));
 const fd=openSync(canonical,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const opened=fstatSync(fd);if(!same(before,opened)||opened.nlink!==1)throw Error('Package input changed.');const bytes=readFileSync(fd);check();if(!same(opened,fstatSync(fd))||!same(opened,lstatSync(canonical)))throw Error('Package input changed.');return bytes;}finally{closeSync(fd);}
}
// These are declared generated artifacts; refuse aliases and rebind before replacement.
export function writePackageArtifact(path,bytes,{boundary=repository}={}){
 const check=directoryGuard(dirname(path),boundary,true),canonical=join(check(),basename(path));
 const current=()=>{try{const stat=lstatSync(canonical);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('Package output must be an ordinary unlinked file.');return stat;}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 const before=current(),temporary=join(check(),'.get-ready-'+randomUUID());
 try{writeFileSync(temporary,bytes,{flag:'wx',mode:0o644});check();const after=current();if(before?!after||!same(before,after):after!==null)throw Error('Package output changed.');renameSync(temporary,canonical);}finally{try{unlinkSync(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}}
}
// The explicit list prevents private receipts or unreviewed files entering a release.
export function packageGetReady({directory=join(repository,'lib/get-ready'),destination=join(repository,'public/downloads'),sourceBoundary=repository,destinationBoundary=repository}={}){
 const root=mkdtempSync(join(tmpdir(),'composer-get-ready-package-'));
 try{
  const stage=join(root,'package'),packed=join(root,'packed');mkdirSync(stage);mkdirSync(packed);
  const hashes={};for(const name of inputs){const bytes=readInput(join(directory,name),sourceBoundary);hashes[name]=hash(bytes);writeFileSync(join(stage,name),bytes);}
  const manifest=JSON.parse(readFileSync(join(stage,'package.json'),'utf8')),expected=[...runtime,'README.md','LICENSE','SOURCE.json'].sort();
  if(manifest.name!=='@loftwah/get-ready'||manifest.version!=='0.1.0'||manifest.private!==true||JSON.stringify([...manifest.files].sort())!==JSON.stringify(expected)||manifest.scripts||manifest.dependencies||manifest.optionalDependencies||manifest.devDependencies)throw Error('Review package identity, file allowlist and dependency/lifecycle policy before changing them.');
  const licence=readInput(join(repository,'LICENSE'));writeFileSync(join(stage,'LICENSE'),licence);hashes.LICENSE=hash(licence);chmodSync(join(stage,'cli.mjs'),0o755);
  const git=(args,encoding='utf8')=>execFileSync('git',args,{cwd:repository,encoding,stdio:['ignore','pipe','pipe']});
  const commit=git(['rev-parse','HEAD']).trim();
  // Git status can hide assume-unchanged/skip-worktree edits. Bind captured bytes to blobs.
  const matchesCommit=Object.entries(hashes).every(([name,digest])=>{try{return hash(git(['show',commit+':'+(name==='LICENSE'?'LICENSE':'lib/get-ready/'+name)],null))===digest;}catch{return false;}});
  const source={repository:'https://github.com/loftwah/app-composer',commit,developmentSnapshot:!!git(['status','--porcelain']).trim()||!matchesCommit,files:hashes};
  writeFileSync(join(stage,'SOURCE.json'),JSON.stringify(source,null,2)+'\n');
  writeFileSync(join(root,'user.npmrc'),'');writeFileSync(join(root,'global.npmrc'),'');
  const env={PATH:process.env.PATH,HOME:root,TMPDIR:root,NPM_CONFIG_USERCONFIG:join(root,'user.npmrc'),NPM_CONFIG_GLOBALCONFIG:join(root,'global.npmrc'),NPM_CONFIG_CACHE:join(root,'cache'),NPM_CONFIG_UPDATE_NOTIFIER:'false'};
  const result=JSON.parse(execFileSync('npm',['pack','--offline','--ignore-scripts','--json','--pack-destination',packed],{cwd:stage,env,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024}));
  const item=result[0];if(result.length!==1||item.filename!=='loftwah-get-ready-0.1.0.tgz'||JSON.stringify(item.files.map(file=>file.path).sort())!==JSON.stringify([...inputs,'LICENSE','SOURCE.json'].sort()))throw Error('Archive contents differ from reviewed source inputs.');
  const bytes=readFileSync(join(packed,item.filename)),metadata={name:manifest.name,version:manifest.version,source:source.commit,developmentSnapshot:source.developmentSnapshot,sha256:hash(bytes),bytes:bytes.length,url:'/downloads/get-ready-core.tgz',licence:'MIT',runtimeDependencies:0};
  writePackageArtifact(join(destination,'get-ready-core.tgz'),bytes,{boundary:destinationBoundary});writePackageArtifact(join(destination,'get-ready-core.json'),JSON.stringify(metadata,null,2)+'\n',{boundary:destinationBoundary});return metadata;
 }finally{rmSync(root,{recursive:true});}
}
export function assertReleasePackage(metadata,bytes,source){
 if(metadata?.name!=='@loftwah/get-ready'||metadata.source!==source||metadata.developmentSnapshot!==false||metadata.bytes!==bytes.length||metadata.sha256!==hash(bytes))throw Error('Get Ready archive must match this clean reviewed source and its exact checksum before production.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=packageGetReady();writePackageArtifact(join(repository,'src/lib/get-ready-package.json'),JSON.stringify(result,null,2)+'\n');console.log('Packaged the shared Get Ready core ('+result.bytes+' bytes), source '+result.source+(result.developmentSnapshot?' · development snapshot':''));
}

// A composition source is an exact repository revision plus the subdirectory
// that carries the app contract. Separate repositories keep the implicit root
// path, so existing pins mean the same thing without a migration. This module
// only reads Git trees and validates data: it never executes app source, writes
// the active lock or touches a provider.
import {execFileSync} from 'node:child_process';
import {validateManifest,validateComposition} from './contracts.mjs';

export const manifestFile='app.manifest.json';
export const maximumPathLength=160;
export const maximumPathDepth=6;
export const maximumWorkspaceApps=32;

const segmentPattern=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const reservedDevice=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const repositoryPattern=/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/;

function fail(message){throw new Error('Invalid source locator: '+message);}

function locatorOf(entry){
 if(!entry||typeof entry!=='object'||Array.isArray(entry))fail('a source must be an object');
 return validateSourceLocator({repository:entry.repository,commit:entry.commit,path:entry.path});
}

// Root is represented by the empty string so a separate repository and a
// host's own root manifest use one shape.
export function normalizeSourcePath(value){
 if(value===undefined||value===null||value===''||value==='.'||value==='./')return '';
 if(typeof value!=='string')fail('path must be a string');
 if(value.length>maximumPathLength)fail('path is longer than '+maximumPathLength+' characters');
 if(/[\u0000-\u001f\u007f]/.test(value))fail('path contains control characters');
 if(value.includes('\\'))fail('path must use forward slashes');
 if(value.startsWith('/'))fail('path must be relative');
 if(value.includes('//'))fail('path contains an empty segment');
 if(value.endsWith('/'))fail('path must not end with a slash');
 if(value.includes(':'))fail('path must not contain a drive or stream separator');
 const segments=value.split('/');
 if(segments.length>maximumPathDepth)fail('path is deeper than '+maximumPathDepth+' segments');
 for(const segment of segments){
  if(segment==='.'||segment==='..')fail('path must not contain relative segments');
  if(segment.endsWith('.'))fail('path segment must not end with a dot');
  if(!segmentPattern.test(segment))fail('path segment is not a safe name');
  if(reservedDevice.test(segment))fail('path segment is a reserved device name');
 }
 return segments.join('/');
}

export function validateSourceLocator(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('a locator must be an object');
 for(const key of Object.keys(value))if(!['repository','commit','path'].includes(key))fail('unexpected locator field');
 if(typeof value.repository!=='string')fail('repository must be a string');
 const match=value.repository.match(repositoryPattern);
 if(!match)fail('repository must be https://github.com/owner/repo without credentials');
 if(typeof value.commit!=='string'||!/^[a-f0-9]{40}$/.test(value.commit))fail('commit must be an exact 40-character lowercase SHA');
 return {
  repository:'https://github.com/'+match[1]+'/'+match[2],
  commit:value.commit,
  path:normalizeSourcePath(value.path),
 };
}

export function sourceIdentity(value){
 const locator=locatorOf(value);
 return locator.repository.toLowerCase()+'#'+locator.path.toLowerCase();
}

export function sourceLabel(value){
 const locator=locatorOf(value);
 const name=locator.repository.replace('https://github.com/','');
 return name+'@'+locator.commit.slice(0,12)+(locator.path?'#'+locator.path:'');
}

function contains(parent,child){
 return parent===''||child===parent||child.startsWith(parent+'/');
}

// Duplicate and overlapping identities are rejected because two pins for one
// tree location make ownership, provenance and rollback ambiguous.
export function validateSourceSet(entries){
 if(!Array.isArray(entries)||entries.length===0)throw new Error('Invalid source locator: a composition needs at least one source');
 const seen=new Map();
 for(const entry of entries){
  const locator=locatorOf(entry);
  const identity=sourceIdentity(locator);
  if(seen.has(identity))throw new Error('Invalid source locator: duplicate identity '+sourceLabel(locator));
  seen.set(identity,locator);
 }
 const byRepository=new Map();
 for(const locator of seen.values()){
  const key=locator.repository.toLowerCase();
  if(!byRepository.has(key))byRepository.set(key,[]);
  byRepository.get(key).push(locator);
 }
 for(const [repository,locators] of byRepository){
  for(const left of locators)for(const right of locators){
   if(left===right)continue;
   if(contains(left.path,right.path))throw new Error('Invalid source locator: overlapping identities in '+repository+' ("'+(left.path||'.')+'" contains "'+(right.path||'.')+'")');
  }
 }
 return true;
}

function requireCommit(commit){
 if(typeof commit!=='string'||!/^[a-f0-9]{40}$/.test(commit))fail('commit must be an exact 40-character lowercase SHA');
 return commit;
}

function git(workspace,args){
 return execFileSync('git',['-C',workspace,...args],{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
}

function gitBytes(workspace,args){
 return execFileSync('git',['-C',workspace,...args],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
}

// Reads the reviewed manifest blob from an exact commit. Symlinked manifests,
// commits that cannot be resolved and paths that resolve elsewhere fail closed.
export function readManifestFromCommit({workspace,commit,path=''}){
 requireCommit(commit);
 const directory=normalizeSourcePath(path);
 const target=directory?directory+'/'+manifestFile:manifestFile;
 let output;
 try{output=git(workspace,['ls-tree','-z','--long',commit,'--',target]);}
 catch(error){throw new Error('Source commit could not be read from the workspace');}
 const entries=output.split('\0').filter(Boolean);
 if(entries.length===0)throw new Error('No '+manifestFile+' at "'+(directory||'.')+'" in '+commit.slice(0,12));
 if(entries.length>1)throw new Error('Manifest path is ambiguous at "'+(directory||'.')+'"');
 const tab=entries[0].indexOf('\t');
 const meta=tab<0?'':entries[0].slice(0,tab),file=tab<0?'':entries[0].slice(tab+1);
 const [mode,type,object]=meta.trim().split(/\s+/);
 if(file!==target)throw new Error('Resolved manifest path does not match the locator');
 if(type!=='blob')throw new Error('Manifest must be a regular file');
 if(mode==='120000')throw new Error('Manifest must not be a symbolic link');
 if(!['100644','100755'].includes(mode))throw new Error('Unsupported manifest file mode');
 let bytes;
 try{bytes=gitBytes(workspace,['cat-file','blob',object]);}catch{throw new Error('Manifest blob could not be read');}
 let manifest;
 try{manifest=JSON.parse(bytes.toString('utf8'));}catch{throw new Error('Manifest is not valid JSON');}
 return validateManifest(manifest);
}

// Bounded discovery over a pinned tree: Git decides what is tracked, so ignored
// files never become candidates. The host root manifest is the host identity,
// not a mini-app, so it is excluded.
export function discoverWorkspaceApps({workspace,commit,root=''}){
 requireCommit(commit);
 const directory=normalizeSourcePath(root);
 const args=['ls-tree','-r','-z','--name-only',commit];
 if(directory)args.push('--',directory);
 const names=git(workspace,args).split('\0').filter(Boolean);
 const found=[];
 for(const name of names){
  if(name===manifestFile)continue;
  if(!name.endsWith('/'+manifestFile))continue;
  const parent=name.slice(0,-(manifestFile.length+1));
  if(parent.split('/').includes('node_modules'))continue;
  let path;
  try{path=normalizeSourcePath(parent);}catch{continue;}
  if(directory&&!contains(directory,path))continue;
  if(found.includes(path))continue;
  if(found.length>=maximumWorkspaceApps)throw new Error('Workspace has more than '+maximumWorkspaceApps+' mini-app manifests; declare an explicit path instead of discovering every app');
  found.push(path);
 }
 found.sort();
 return found;
}

// The same validation the runtime contract already applies, plus source
// identity checks. A manifest cannot claim a different repository than its
// locator, and route collisions still fail.
export function validateComposedSources(entries){
 validateSourceSet(entries);
 const manifests=[];
 for(const entry of entries){
  const manifest=validateManifest(entry.manifest);
  const locator=locatorOf(entry);
  if(!entry.id||typeof entry.id!=='string')throw new Error('Invalid source locator: every source needs an id');
  if(manifest.id!==entry.id)throw new Error('Manifest id does not match its source id');
  if(typeof manifest.repository!=='string'||manifest.repository.toLowerCase()!==locator.repository.toLowerCase())throw new Error('Manifest repository does not match its source locator');
  manifests.push(manifest);
 }
 return validateComposition(manifests);
}

// Deterministic plan for display, diffs and evidence. No timestamp is added so
// identical inputs produce identical output.
export function compositionPlan(entries){
 const sorted=[...entries].map(entry=>({entry,locator:locatorOf(entry)})).sort((left,right)=>{
  const a=left.entry.id,b=right.entry.id;
  return a<b?-1:a>b?1:0;
 });
 validateComposedSources(sorted.map(item=>({...item.entry,...item.locator})));
 return sorted.map(({entry,locator})=>({
  id:entry.id,
  repository:locator.repository,
  commit:locator.commit,
  path:locator.path,
  url:typeof entry.url==='string'?entry.url:'',
  routes:[...(entry.manifest.routes||[])],
  version:String(entry.manifest.version??''),
  source:sourceLabel(locator),
 }));
}

export function parseSourceArgument(value){
 if(typeof value!=='string'||!value)throw new Error('A --source value is id=owner/repo@sha[:path]');
 const match=/^([a-z][a-z0-9-]{0,40})=([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)@([a-f0-9]{40})(?::(.+))?$/.exec(value);
 if(!match)throw new Error('A --source value is id=owner/repo@sha[:path] with an exact commit');
 const locator=validateSourceLocator({repository:'https://github.com/'+match[2],commit:match[3],path:match[4]??''});
 return {id:match[1],...locator};
}

export function manifestApiPath(value){
 const {repository,commit,path}=locatorOf(value);
 const name=repository.replace('https://github.com/','');
 const file=path?path+'/'+manifestFile:manifestFile;
 return 'repos/'+name+'/contents/'+file+'?ref='+commit;
}

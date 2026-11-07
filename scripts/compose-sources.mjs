// Validates and stages a composition source plan without touching the active
// lock, a deployment or a credential. A plan may mix mini-apps from separate
// repositories with subdirectories of one host repository; each source keeps
// its own identity, manifest and exact commit.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateManifest} from './contracts.mjs';
import {compositionPlan,manifestApiPath,readManifestFromCommit,sourceLabel,validateSourceLocator,validateSourceSet} from './source-locator.mjs';

const keys=['contract','reviewed','sources'];
const sourceKeys=['id','repository','commit','path','url'];

function fail(message){throw new Error('Source plan: '+message);}

export function validateSourcePlan(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('the plan must be an object');
 for(const key of Object.keys(value))if(!keys.includes(key))fail('unexpected field "'+key+'"');
 if(value.contract!==1)fail('unsupported contract version');
 if(typeof value.reviewed!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.reviewed))fail('reviewed must be a date');
 if(!Array.isArray(value.sources)||value.sources.length===0)fail('at least one source is required');
 const sources=value.sources.map(source=>{
  if(!source||typeof source!=='object'||Array.isArray(source))fail('every source must be an object');
  for(const key of Object.keys(source))if(!sourceKeys.includes(key))fail('unexpected source field "'+key+'"');
  if(typeof source.id!=='string'||!/^[a-z][a-z0-9-]{0,40}$/.test(source.id))fail('invalid app id');
  const locator=validateSourceLocator({repository:source.repository,commit:source.commit,path:source.path});
  let url='';
  if(source.url!==undefined&&source.url!==''){
   let parsed;
   try{parsed=new URL(source.url);}catch{fail('url must be an absolute https origin');}
   if(parsed.protocol!=='https:'||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.origin!==source.url.replace(/\/$/,''))fail('url must be an https origin without a path');
   url=parsed.origin;
  }
  return {id:source.id,...locator,url};
 });
 if(new Set(sources.map(source=>source.id)).size!==sources.length)fail('duplicate app id');
 validateSourceSet(sources);
 return {contract:1,reviewed:value.reviewed,sources};
}

function readFromLocal(workspace,locator){
 const root=resolve(workspace);
 let remote;
 try{remote=execFileSync('git',['-C',root,'remote','get-url','origin'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw new Error('The local checkout '+sourceLabel(locator)+' has no origin remote');}
 remote=remote.replace(/\.git$/,'');
 const normalised=remote.replace(/^git@github\.com:/,'https://github.com/').replace(/^ssh:\/\/git@github\.com\//,'https://github.com/');
 if(normalised.toLowerCase()!==locator.repository.toLowerCase())throw new Error('The local checkout origin does not match '+sourceLabel(locator));
 return readManifestFromCommit({workspace:root,commit:locator.commit,path:locator.path});
}

function readFromGitHub(locator){
 const raw=execFileSync('gh',['api',manifestApiPath(locator),'--hostname','github.com'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:4*1024*1024});
 const body=JSON.parse(raw);
 if(body.type!=='file'||body.encoding!=='base64'||typeof body.content!=='string')throw new Error('The registry response is not a readable file at '+sourceLabel(locator));
 return validateManifest(JSON.parse(Buffer.from(body.content.replace(/\n/g,''),'base64').toString('utf8')));
}

function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}

export function composeSources({file='composition.sources.json',workspace=process.cwd(),locals={},stage=false}={}){
 const path=resolve(workspace,file);
 if(!existsSync(path))throw new Error('Source plan not found at '+file);
 const plan=validateSourcePlan(JSON.parse(readFileSync(path,'utf8')));
 const entries=[];
 for(const source of plan.sources){
  const local=locals[source.id];
  if(local&&!existsSync(resolve(local)))throw new Error('The local checkout for '+source.id+' does not exist');
  const manifest=local?readFromLocal(local,source):readFromGitHub(source);
  entries.push({...source,manifest});
 }
 const summary=compositionPlan(entries);
 const id=digest({contract:1,reviewed:plan.reviewed,sources:summary});
 if(stage){
  const directory=resolve(workspace,'.private','candidates');
  mkdirSync(directory,{recursive:true,mode:0o700});
  writeFileSync(resolve(directory,id+'.json'),JSON.stringify({contract:1,id,state:'staged',reviewed:plan.reviewed,sources:summary},null,2),{mode:0o600});
 }
 return {state:stage?'staged':'checked',id,sources:summary,lockWritten:false,deployed:false};
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const args=process.argv.slice(2);
 const value=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1];};
 const file=value('--file')??'composition.sources.json';
 const workspace=resolve(value('--workspace')??process.cwd());
 const locals={};
 for(let index=0;index<args.length;index++)if(args[index]==='--local'){
  const match=/^([a-z][a-z0-9-]{0,40})=(.+)$/.exec(args[index+1]??'');
  if(!match)throw new Error('A --local value is id=path');
  locals[match[1]]=resolve(match[2]);
 }
 const result=composeSources({file,workspace,locals,stage:args.includes('--stage')});
 console.log(JSON.stringify(result,null,2));
}

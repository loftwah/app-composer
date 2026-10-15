// Explicit local preparation for the first supported runtime; no shell/profile edits.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,lstatSync,readdirSync,readFileSync,writeFileSync,realpathSync,cpSync,chmodSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {ReadinessFailure} from './check.mjs';
import {verifyLocalTools} from './local-checks.mjs';

const releases=Object.freeze({
 gh:{url:'https://github.com/cli/cli/releases/download/v2.98.0/gh_2.98.0_macOS_arm64.zip',bytes:13938611,sha:'8cfb027cc5310675f2b830eac8f9865c1155a45ffcf9757f699fdd5a22046ca4'},
 pnpm:{url:'https://github.com/pnpm/pnpm/releases/download/v12.9.1/pnpm-darwin-arm64.tar.gz',bytes:20552758,sha:'4dcea94654bc8f2189dfd591aea7af4adddd29243e4bfcc8d4c8b4289e7983ba'},
 license:{url:'https://raw.githubusercontent.com/pnpm/pnpm/v12.9.1/LICENSE',bytes:1170,sha:'4b8e2a57502758b2d034ece9cabf19dd098c5609003ed8dbdafd085274f25bd9'},
});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const treeDigest='93e514700c13870d02c376b2906071a336986eda8eee4135178ff87320c9cdb7';
const safeEnv={PATH:'/usr/bin:/bin',LANG:'C'};
function probeEnvironment(path=safeEnv.PATH){
 const home=mkdtempSync(resolve(tmpdir(),'composer-tool-probe-'));
 return {...safeEnv,PATH:path,HOME:home,XDG_CONFIG_HOME:resolve(home,'config'),XDG_STATE_HOME:resolve(home,'state'),XDG_CACHE_HOME:resolve(home,'cache'),CODEX_THREAD_ID:'active-local-probe'};
}
function workspaceStorage(workspace){const storage=resolve(realpathSync(workspace),'.private');if(storage.includes(':'))throw new ReadinessFailure('configuration');return storage;}
function supported(){if(process.platform!=='darwin'||process.arch!=='arm64'||process.versions.node.split('.')[0]!=='22')throw new ReadinessFailure('configuration');}
function directory(path){const stat=lstatSync(path);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o7022)!==0)throw new ReadinessFailure('source');return stat;}
function sameDirectory(path,expected){const current=directory(path);if(current.ino!==expected.ino||current.dev!==expected.dev)throw new ReadinessFailure('source');}
function fingerprint(root){
 directory(root);const hash=createHash('sha256');let count=0,bytes=0;
 const visit=(folder,prefix='')=>{
  for(const name of readdirSync(folder).sort()){
   if(++count>1500)throw new ReadinessFailure('source');
   const path=resolve(folder,name),key=prefix+name,stat=lstatSync(path);
   if(stat.isSymbolicLink()||(stat.mode&0o7022)!==0)throw new ReadinessFailure('source');
   if(stat.isDirectory()){hash.update('D'+key+'\n');visit(path,key+'/');}
   else if(stat.isFile()&&stat.nlink===1){
    bytes+=stat.size;if(stat.size>50000000||bytes>110000000)throw new ReadinessFailure('source');
    hash.update('F'+key+'\0'+stat.size+'\0'+((stat.mode&0o111)?1:0)+'\0'+digest(readFileSync(path))+'\n');
   }else throw new ReadinessFailure('source');
  }
 };
 visit(root);return hash.digest('hex');
}

// Only fixed official URLs, at most one release-asset redirect, exact byte/hash bounds.
export async function downloadWorkspaceTool(id,request=fetch){
 if(!Object.hasOwn(releases,id))throw new ReadinessFailure('configuration');
 const asset=releases[id],signal=AbortSignal.timeout(60000);
 const get=url=>request(url,{redirect:'manual',signal,headers:{'User-Agent':'AppComposer verified local tool preparation','Accept-Encoding':'identity'}});
 let response;try{
  response=await get(asset.url);
  if([301,302,303,307,308].includes(response.status)){
   const location=new URL(response.headers.get('location')??'',asset.url);
   if(new URL(asset.url).hostname!=='github.com'||location.protocol!=='https:'||location.hostname!=='release-assets.githubusercontent.com'||location.username||location.password)throw new ReadinessFailure('response');
   response=await get(location.href);
  }
  if(response.status===429||response.status>=500)throw new ReadinessFailure('unavailable');
  if(response.status!==200||!response.body)throw new ReadinessFailure('response');
  // fetch decodes Content-Encoding; its Content-Length can describe compressed bytes.
  const encoding=response.headers.get('content-encoding'),size=response.headers.get('content-length');if((encoding===null||encoding==='identity')&&size!==null&&Number(size)!==asset.bytes)throw new ReadinessFailure('response');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>asset.bytes)throw new ReadinessFailure('response');chunks.push(Buffer.from(value));}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=Buffer.concat(chunks);if(length!==asset.bytes||digest(bytes)!==asset.sha)throw new ReadinessFailure('source');return bytes;
 }catch(error){if(error instanceof ReadinessFailure)throw error;throw new ReadinessFailure('unavailable');}
}

function verified(root){if(fingerprint(root)!==treeDigest)throw new ReadinessFailure('source');}
function versions(root){
 const env=probeEnvironment();
 try{
 for(const [name,expected] of [['gh','gh version 2.98.0'],['pnpm','12.9.1']]){
  let value;try{value=execFileSync(resolve(root,'bin',name),['--version'],{cwd:root,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']}).trim().split('\n')[0];}catch{throw new ReadinessFailure('response');}
  if(name==='gh'?!value.startsWith(expected+' '):value!==expected)throw new ReadinessFailure('response');
 }
 verified(root);
 }finally{rmSync(env.HOME,{recursive:true,force:true});}
}
export function workspaceToolEnvironment(workspace,env=process.env){
 supported();const storage=workspaceStorage(workspace),parent=directory(storage),root=resolve(storage,'workspace-tools');
 verified(root);versions(root);sameDirectory(storage,parent);
 return {...env,PATH:resolve(root,'bin')+(env.PATH?':'+env.PATH:'')};
}
export async function prepareWorkspaceTools(workspace,env=process.env,request=fetch){
 supported();if(!env.CODEX_THREAD_ID&&!env.CODEX_MANAGED_BY_NPM)throw new ReadinessFailure('configuration');
 const storage=workspaceStorage(workspace);mkdirSync(storage,{recursive:true,mode:0o700});const parent=directory(storage),root=resolve(storage,'workspace-tools');
 let present;try{lstatSync(root);present=true;}catch(error){if(error.code!=='ENOENT')throw error;present=false;}
 if(present){workspaceToolEnvironment(workspace,env);return {changed:false,gh:'2.98.0',pnpm:'12.9.1',scope:'workspace'};}
 // Reuse usable existing tools before installing a private pair. Probe without credentials.
 const probeEnv=probeEnvironment(env.PATH??safeEnv.PATH);
 try{
 try{
  const current=verifyLocalTools(workspace,probeEnv);
  if(['12.8.1','12.9.1'].includes(current.pnpm))return {changed:false,gh:current.gh.slice(11),pnpm:current.pnpm,scope:'existing'};
 }catch{}
 // Git and Node already exist in this supported agent runtime. Never install Apple tools.
 let git;try{git=execFileSync('git',['--version'],{cwd:workspace,env:probeEnv,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']}).trim();}catch{throw new ReadinessFailure('configuration');}
 if(!/^git version \d+\.\d+\.\d+/.test(git))throw new ReadinessFailure('configuration');
 const stage=mkdtempSync(resolve(tmpdir(),'composer-workspace-tools-'));
 try{
 const candidate=resolve(stage,'candidate'),bin=resolve(candidate,'bin');mkdirSync(candidate,{mode:0o700});mkdirSync(bin,{mode:0o700});
 const gh=await downloadWorkspaceTool('gh',request),pnpm=await downloadWorkspaceTool('pnpm',request),license=await downloadWorkspaceTool('license',request);
 const ghArchive=resolve(stage,'gh.zip'),pnpmArchive=resolve(stage,'pnpm.tar.gz');writeFileSync(ghArchive,gh,{flag:'wx',mode:0o600});writeFileSync(pnpmArchive,pnpm,{flag:'wx',mode:0o600});
 const tar=args=>execFileSync('/usr/bin/tar',args,{env:safeEnv,timeout:20000,maxBuffer:50000000,stdio:['ignore','pipe','pipe']});
 const extracted=resolve(stage,'pnpm');mkdirSync(extracted,{mode:0o700});
 // Pinned archives are reviewed data. Extraction/version probes receive no service credentials.
 tar(['-xf',pnpmArchive,'--no-same-owner','--no-same-permissions','-C',extracted]);cpSync(extracted,bin,{recursive:true,force:false,errorOnExist:true});
 writeFileSync(resolve(bin,'gh'),tar(['-xOf',ghArchive,'gh_2.98.0_macOS_arm64/bin/gh']),{flag:'wx',mode:0o700});
 writeFileSync(resolve(candidate,'LICENSE-gh'),tar(['-xOf',ghArchive,'gh_2.98.0_macOS_arm64/LICENSE']),{flag:'wx',mode:0o600});writeFileSync(resolve(candidate,'LICENSE-pnpm'),license,{flag:'wx',mode:0o600});
 chmodSync(resolve(bin,'pnpm'),0o700);verified(candidate);versions(candidate);sameDirectory(storage,parent);
 // Reserve exclusively after downloads. Never merge into a pre-existing owner directory.
 try{mkdirSync(root,{mode:0o700});}catch{throw new ReadinessFailure('source');}
 const reserved=directory(root);cpSync(candidate,root,{recursive:true,force:false,errorOnExist:true});sameDirectory(root,reserved);sameDirectory(storage,parent);verified(root);versions(root);
 // Only this invocation's disposable staging is removed; installed/owner bytes stay put.
 return {changed:true,gh:'2.98.0',pnpm:'12.9.1',scope:'workspace'};
 }finally{rmSync(stage,{recursive:true,force:true});}
 }finally{rmSync(probeEnv.HOME,{recursive:true,force:true});}
}

import {McpServer} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {runLocalReadiness,readinessReport,inspectReadinessReport,referenceTarget} from '../get-ready/index.mjs';
import {resolve,isAbsolute} from 'node:path';

export function launchScope(args){
 const flags=new Map(),allowed=['--workspace','--account','--reference-worker','--reference-url','--reference-repo','--tools-workspace'];
 for(let i=0;i<args.length;i++){
  const flag=args[i];if(!allowed.includes(flag)||flags.has(flag)||typeof args[i+1]!=='string'||!args[i+1]||args[i+1].startsWith('--'))throw Error('Use an explicit local workspace and supported target flags. Setup operations and credentials are not launch arguments.');
  flags.set(flag,args[++i]);
 }
 if(!flags.has('--workspace')||!isAbsolute(flags.get('--workspace'))||flags.get('--workspace').includes('\0'))throw Error('Choose an explicit absolute trusted workspace at launch.');
 if(flags.has('--reference-url')!==flags.has('--reference-repo'))throw Error('Select both the reference origin and repository.');
 const account=flags.get('--account')??null,worker=flags.get('--reference-worker')??null;
 if(account!==null&&!/^[a-f0-9]{32}$/.test(account))throw Error('Select the exact Cloudflare account at launch.');
 if(worker!==null&&!/^[a-z][a-z0-9-]{0,62}$/.test(worker))throw Error('Select the reference Worker at launch.');
 const tools=flags.get('--tools-workspace');if(tools&&(!isAbsolute(tools)||tools.includes('\0')))throw Error('Select an absolute prepared tool workspace.');
 const target=flags.has('--reference-url')?Object.freeze(referenceTarget(flags.get('--reference-url'),flags.get('--reference-repo'))):null;
 return Object.freeze({workspace:resolve(flags.get('--workspace')),account,worker,target,...(tools?{toolsWorkspace:resolve(tools)}:{})});
}

export function mcpEnvironment(env){
 const keys=['PATH','HOME','TMPDIR','LANG','LC_ALL','XDG_CONFIG_HOME','GH_CONFIG_DIR','GH_TOKEN','GITHUB_TOKEN','CODEX_THREAD_ID','CODEX_MANAGED_BY_NPM','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID'];
 return Object.freeze(Object.fromEntries(keys.filter(key=>env[key]!==undefined).map(key=>[key,env[key]])));
}
const result=value=>({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
const refusal=text=>({content:[{type:'text',text}],isError:true});

export function createReadinessMcp(scope,{env=process.env,check=runLocalReadiness,now=Date.now}={}){
 // Normalize even programmatic host input. Models never choose or change this scope.
 const keys=['workspace','account','worker','target','toolsWorkspace'];
 if(!scope||Object.keys(scope).some(key=>!keys.includes(key)))throw Error('Unsupported MCP host scope.');
 for(const key of ['account','worker','toolsWorkspace'])if(scope[key]!=null&&(typeof scope[key]!=='string'||!scope[key]))throw Error('Select an explicit MCP host scope.');
 if(scope.target!=null&&(typeof scope.target!=='object'||Array.isArray(scope.target)||Object.keys(scope.target).length!==2||Object.keys(scope.target).some(key=>!['origin','repo'].includes(key))))throw Error('Select only a reference origin and repository.');
 const fixed=launchScope(['--workspace',scope.workspace,...(scope.account?['--account',scope.account]:[]),...(scope.worker?['--reference-worker',scope.worker]:[]),...(scope.target?['--reference-url',scope.target.origin,'--reference-repo',scope.target.repo]:[]),...(scope.toolsWorkspace?['--tools-workspace',scope.toolsWorkspace]:[])]);
 const runtime=mcpEnvironment(env);let last=null,running=false;
 const server=new McpServer({name:'app-composer-get-ready',version:'1.0.0'});
 const empty=z.object({}).strict();
 server.registerTool('get_ready_check',{
  title:'Recheck the selected environment',description:'Run the shared Get Ready doctor only in the trusted workspace/account/HTTPS target selected by the host at launch. Saves a private receipt and returns a redacted dated report. Does not install, authenticate, create a repository, change DNS, deploy or retry setup. Missing target selection remains action-required. No arguments are accepted.',
  inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },async(_input,context)=>{
  if(running)return refusal('A readiness check is already running. Inspect the last completed result or wait; no extra check was started.');
  running=true;
  let cancelled=context.mcpReq.signal.aborted;
  const cancel=()=>{cancelled=true;last=null;};
  context.mcpReq.signal.addEventListener('abort',cancel,{once:true});
  try{
   if(cancelled){last=null;return refusal('The MCP request was cancelled. No new check was started.');}
   const session=await check({...fixed,operation:null},runtime);
   if(cancelled)return refusal('The MCP request was cancelled. Its bounded local check may have saved private progress, but no completed report is retained here. No retry was started.');
   last=readinessReport(session,now());return result(inspectReadinessReport(last,now()));
  }catch{last=null;return refusal('The local check could not finish. The host should inspect its workspace, receipt and selected tools privately. No credential, permission or successful readiness is established.');}
  finally{context.mcpReq.signal.removeEventListener('abort',cancel);running=false;}
 });
 server.registerTool('get_ready_inspect',{
  title:'Inspect the last completed check',description:'Inspect this MCP connection’s last completed redacted report using the shared engine’s freshness and unfinished-operation rules. Makes no provider calls and does not read another file or workspace. Before the first check, returns no saved result. A report grants no setup or deployment authority.',
  inputSchema:empty,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async()=>last?result({...inspectReadinessReport(last,now()),checking:running}):result({report:null,checking:running,message:'No completed report is available on this connection. Call get_ready_check to recheck the host-selected environment.'}));
 return server;
}

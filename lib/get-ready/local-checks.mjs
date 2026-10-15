import {ReadinessFailure,ReadinessToolFailure,readinessJSON,runReadinessCommand} from './check.mjs';
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';

function wranglerEntry(workspace) {
 try{
  const modules=resolve(realpathSync(workspace),'node_modules');
  const entry=realpathSync(resolve(workspace,'node_modules/wrangler/bin/wrangler.js'));
  const path=relative(modules,entry);
  if(path.startsWith('..')||isAbsolute(path)||!statSync(entry).isFile())throw new Error('Not a workspace tool');
  return entry;
 }catch{throw new ReadinessFailure('configuration');}
}

export function installedWrangler(workspace) {
 let manifest;
 try{manifest=JSON.parse(readFileSync(resolve(workspace,'node_modules/wrangler/package.json'),'utf8'));}catch{throw new ReadinessFailure('configuration');}
 if(manifest.name!=='wrangler'||manifest.version!=='4.143.1'||manifest.bin?.wrangler!=='./bin/wrangler.js')throw new ReadinessFailure('configuration');
 wranglerEntry(workspace);
 return manifest.version;
}

export function wranglerEnvironment(env) {
 const selected=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','XDG_CONFIG_HOME','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
 // Wrangler's logger otherwise persists even JSON credential output to disk.
 return {...selected,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'};
}

export function runWorkspaceWrangler(workspace,args,env=process.env,{cwd=workspace,timeout=20000}={}) {
 installedWrangler(workspace);
 return runReadinessCommand(process.execPath,[wranglerEntry(workspace),...args,'--env-file=/dev/null'],{cwd,env:wranglerEnvironment(env),encoding:'utf8',timeout,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
}

// Resolve only the selected runtime credential. Never return it as check evidence,
// cache it in a receipt, or fall back to another identity after a provider denial.
export function cloudflareToken(context,env) {
 const usable=value=>typeof value==='string'&&value.length<=8192&&/^[A-Za-z0-9._~+\/-]+=*$/.test(value);
 if(env.CLOUDFLARE_API_TOKEN!==undefined){
  if(!usable(env.CLOUDFLARE_API_TOKEN))throw new ReadinessFailure('authentication');
  return env.CLOUDFLARE_API_TOKEN;
 }
 // whoami supplies structured missing-login diagnostics and binds the existing
 // Wrangler identity to this account before requesting its transient OAuth token.
 const identity=JSON.parse(runWorkspaceWrangler(context.workspace,['whoami','--json'],env));
 if(!identity.accounts.some(value=>value.id===context.account))throw new ReadinessFailure('configuration');
 let credential;
 try{credential=JSON.parse(runWorkspaceWrangler(context.workspace,['auth','token','--json'],env));}
 catch(error){if(error instanceof ReadinessFailure)throw error;throw new ReadinessFailure('response');}
 if(!credential||Object.keys(credential).sort().join(',')!=='token,type'||credential.type!=='oauth'||!usable(credential.token))throw new ReadinessFailure('response');
 return credential.token;
}

export function verifyLocalTools(workspace,env=process.env,execute){
 const versions={},issues=[];
 const patterns={git:/^git version (\d+\.\d+\.\d+)(?:[^\n]*)$/,gh:/^gh version (\d+\.\d+\.\d+)(?:[^\n]*)$/,pnpm:/^(\d+\.\d+\.\d+)$/};
 for(const tool of ['git','gh','pnpm']){
  try{
   const output=runReadinessCommand(tool,['--version'],{cwd:workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']},execute).split('\n')[0];
   const version=patterns[tool].exec(output)?.[1];if(!version)throw new ReadinessFailure('response');
   versions[tool]=tool==='pnpm'?version:(tool==='git'?'git version ':'gh version ')+version;
  }catch(error){issues.push({tool,state:error instanceof ReadinessToolFailure&&error.tools[0].state==='missing'?'missing':'broken'});}
 }
 const active=!!env.CODEX_THREAD_ID||!!env.CODEX_MANAGED_BY_NPM;
 if(!active)issues.push({tool:'agent',state:'inactive'});
 if(issues.length)throw new ReadinessToolFailure(issues);
 let codex='';try{const output=runReadinessCommand('codex',['--version'],{cwd:workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']},execute);codex=/^codex-cli (\d+\.\d+\.\d+)$/.exec(output)?.[0]??'';}catch{}
 return {...versions,codex,node:process.version,platform:process.platform,architecture:process.arch,activeCodexSession:active};
}

export function localChecks(context, env=process.env) {
 const {workspace:cwd,repo,source,target,account,worker}=context;
 const run=(cmd,args)=>runReadinessCommand(cmd,args,{cwd,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
 const checks=[];
 const collect=(id,label,action,verify,setupAction=null,recovery={})=>{checks.push({id,label,action,verify,setupAction,...recovery});};
  collect('agent','Coding agent and tools','Resume in an authorised Codex workspace. Install or repair Git, GitHub CLI and pnpm through their official tools.',async()=>{
   return verifyLocalTools(cwd,env);
  });
  collect('github','Workspace and GitHub permission',`Authenticate GitHub CLI for ${repo||'the intended repository'} or obtain its required push permission, then rerun this doctor.`,async()=>{
   if(!repo||!source||!/^[a-f0-9]{40}$/.test(source))throw new ReadinessFailure('configuration');
   const data=JSON.parse(run('gh',['api','repos/'+repo,'--hostname','github.com']));
   if(!data.permissions?.push)throw new ReadinessFailure('permission');
   return {repository:repo,push:true,source:context.source};
  },'The agent must prepare a committed Git workspace with a credential-free GitHub origin. From an authorised Codex folder, --clone-reference PATH can prepare the public maintained Hello checkout; cloning grants no push permission. No human sign-in is established by this setup failure.',{
   authenticationAction:'The agent should inspect GitHub CLI authentication for github.com in this execution environment. If sign-in is needed, use the official browser flow for the intended owner account; MP completes its device verification and reviews the requested access. Keep credentials out of Composer and chat. Recheck this workspace afterwards.',
   permissionAction:'The selected GitHub identity does not have the required repository push access. The agent should check the intended account and repository first, explain any necessary permission, and ask MP only for that access. Repeated sign-in does not establish write permission. Recheck this workspace afterwards.',
  });
  collect('cloudflare','Cloudflare deployment tools','Complete the official Wrangler login or supply an authorised Cloudflare deployment token, then rerun. Do not paste credentials into Composer.',async()=>{
   installedWrangler(cwd);
   const identity=JSON.parse(runWorkspaceWrangler(cwd,['whoami','--json'],env));
   if(!account||!identity.accounts?.some(value=>value.id===account))throw new ReadinessFailure('configuration');
   return {wrangler:runWorkspaceWrangler(cwd,['--version'],env).split('\n').pop(),authenticated:true,account};
  },'The agent must check the selected account and local Wrangler installation. A reviewed Hello checkout can install its pinned tools with --install-reference-tools, then rerun the doctor. No human sign-in is established by this setup failure.');
  collect('https','Deployed Hello reference',target?'Deploy or repair the selected Hello reference. Supply --account and --reference-worker. Use the existing selected Wrangler sign-in or an authorised CLOUDFLARE_API_TOKEN with read access to Worker hostnames; account routing and exact HTTPS source must match. A purchase or a conflicting DNS change needs MP approval.':'Choose an authorised HTTPS reference and its GitHub source using --reference-url and --reference-repo. The agent must deploy and verify it before readiness can pass.',async()=>{
   if(!target||!worker||!account)throw new ReadinessFailure('configuration');
   const domain=await verifyReferenceRouting(context,env);
   const identity=await readinessJSON(target.origin+'/build.json',{headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'}});
   const expected=run('gh',['api','repos/'+target.repo+'/commits/HEAD','--hostname','github.com','--jq','.sha']);
   if(identity.app!=='hello'||identity.commit!==expected||!/^[a-f0-9]{40}$/.test(expected))throw new ReadinessFailure('source');
   return {url:target.origin,repository:target.repo,commit:identity.commit,domain,account};
  });
 return checks;
}

export async function verifyReferenceRouting(context,env=process.env) {
 const {target,account,worker}=context;
 if(!target||!worker||!account)throw new ReadinessFailure('configuration');
 const token=cloudflareToken(context,env);
   const api=async(path)=>{const value=await readinessJSON('https://api.cloudflare.com/client/v4/accounts/'+account+path,{headers:{Authorization:'Bearer '+token}});if(!value?.success)throw new ReadinessFailure('response');return value.result;};
   const hostname=new URL(target.origin).hostname;
   let domain;
   if(hostname.endsWith('.workers.dev')){const subdomain=await api('/workers/subdomain');const enabled=await api('/workers/scripts/'+worker+'/subdomain');if(hostname!==worker+'.'+subdomain.subdomain+'.workers.dev'||!enabled.enabled)throw new ReadinessFailure('configuration');domain={kind:'workers.dev',worker};}
   else{const domains=await api('/workers/domains');const match=domains.find(value=>value.hostname===hostname&&value.service===worker&&value.environment==='production'&&value.enabled);if(!match)throw new ReadinessFailure('configuration');domain={kind:'custom-domain',worker,zone:match.zone_name};}
 return domain;
}

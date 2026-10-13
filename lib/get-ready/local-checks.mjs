import {ReadinessFailure,readinessJSON,runReadinessCommand} from './check.mjs';

export function localChecks(context, env=process.env) {
 const {workspace:cwd,repo,source,target,account,worker}=context;
 const run=(cmd,args)=>runReadinessCommand(cmd,args,{cwd,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
 const checks=[];
 const collect=(id,label,action,verify)=>{checks.push({id,label,action,verify});};
  collect('agent','Coding agent and tools','Resume in an authorised Codex workspace. Install or repair Git, GitHub CLI and pnpm through their official tools.',async()=>{
   const git=run('git',['--version']),gh=run('gh',['--version']).split('\n')[0],pnpm=run('pnpm',['--version']);
   let codex='';try{codex=run('codex',['--version']);}catch{}
   const active=!!env.CODEX_THREAD_ID||!!env.CODEX_MANAGED_BY_NPM;
   if(!active)throw new ReadinessFailure('configuration');
   return {git,gh,pnpm,codex,activeCodexSession:active};
  });
  collect('github','Workspace and GitHub permission',`Finish the Git clone and credential-free GitHub origin, create the initial commit if needed, then authenticate GitHub CLI for ${repo||'the intended repository'} and verify push permission. Rerun this doctor after the human sign-in.`,async()=>{
   if(!repo||!source||!/^[a-f0-9]{40}$/.test(source))throw new ReadinessFailure('configuration');
   const data=JSON.parse(run('gh',['api','repos/'+repo]));
   if(!data.permissions?.push)throw new ReadinessFailure('permission');
   return {repository:repo,push:true,source:context.source};
  });
  collect('cloudflare','Cloudflare deployment tools','Complete the official Wrangler login or supply an authorised Cloudflare deployment token, then rerun. Do not paste credentials into Composer.',async()=>{
   const identity=JSON.parse(run('pnpm',['exec','wrangler','whoami','--json']));
   if(!account||!identity.accounts?.some(value=>value.id===account))throw new ReadinessFailure('configuration');
   return {wrangler:run('pnpm',['exec','wrangler','--version']).split('\n').pop(),authenticated:true,account};
  });
  collect('https','Deployed Hello reference',target?'Deploy or repair the selected Hello reference. Supply --account, --reference-worker and an authorised CLOUDFLARE_API_TOKEN with read access to Worker hostnames; account routing and exact HTTPS source must match. A purchase or a conflicting DNS change needs MP approval.':'Choose an authorised HTTPS reference and its GitHub source using --reference-url and --reference-repo. The agent must deploy and verify it before readiness can pass.',async()=>{
   if(!target||!worker||!account)throw new ReadinessFailure('configuration');
   if(!env.CLOUDFLARE_API_TOKEN)throw new ReadinessFailure('authentication');
   const domain=await verifyReferenceRouting(context,env);
   const identity=await readinessJSON(target.origin+'/build.json',{headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'}});
   const expected=run('gh',['api','repos/'+target.repo+'/commits/HEAD','--jq','.sha']);
   if(identity.app!=='hello'||identity.commit!==expected||!/^[a-f0-9]{40}$/.test(expected))throw new ReadinessFailure('source');
   return {url:target.origin,repository:target.repo,commit:identity.commit,domain,account};
  });
 return checks;
}

export async function verifyReferenceRouting(context,env=process.env) {
 const {target,account,worker}=context;
 if(!target||!worker||!account)throw new ReadinessFailure('configuration');
 if(!env.CLOUDFLARE_API_TOKEN)throw new ReadinessFailure('authentication');
   const api=async(path)=>{const value=await readinessJSON('https://api.cloudflare.com/client/v4/accounts/'+account+path,{headers:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN}});if(!value?.success)throw new ReadinessFailure('response');return value.result;};
   const hostname=new URL(target.origin).hostname;
   let domain;
   if(hostname.endsWith('.workers.dev')){const subdomain=await api('/workers/subdomain');const enabled=await api('/workers/scripts/'+worker+'/subdomain');if(hostname!==worker+'.'+subdomain.subdomain+'.workers.dev'||!enabled.enabled)throw new ReadinessFailure('configuration');domain={kind:'workers.dev',worker};}
   else{const domains=await api('/workers/domains');const match=domains.find(value=>value.hostname===hostname&&value.service===worker&&value.environment==='production'&&value.enabled);if(!match)throw new ReadinessFailure('configuration');domain={kind:'custom-domain',worker,zone:match.zone_name};}
 return domain;
}

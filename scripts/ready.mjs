import {mkdirSync,readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {githubRepository,referenceTarget,finishReadiness} from './readiness-state.mjs';
import {ReadinessFailure,readinessJSON,runReadinessCheck,runReadinessCommand} from './readiness-check.mjs';

const args=process.argv.slice(2);
const flags=new Map();
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(['--cancel','--publish-proof'].includes(flag)){flags.set(flag,true);continue;}
 if(!['--workspace','--reference-url','--reference-repo','--reference-worker','--account'].includes(flag)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --workspace PATH, --reference-url HTTPS_ORIGIN and --reference-repo OWNER/REPO. Optional: --cancel or --publish-proof.');
 flags.set(flag,args[++i]);
}
const cwd=resolve(flags.get('--workspace')||process.cwd());
const run=(cmd,argv)=>runReadinessCommand(cmd,argv,{cwd,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
let workspace=cwd,repo=null,source=null,dirty=null;
try{workspace=run('git',['rev-parse','--show-toplevel']);}catch{}
try{repo=githubRepository(run('git',['remote','get-url','origin']));}catch{}
try{source=run('git',['rev-parse','HEAD']);dirty=!!run('git',['status','--porcelain']);}catch{}
const operator=repo==='loftwah/app-composer';
let target=null;
if(flags.has('--reference-url')!==flags.has('--reference-repo'))throw new Error('Provide both reference URL and repository.');
if(flags.has('--reference-url'))target=referenceTarget(flags.get('--reference-url'),flags.get('--reference-repo'));
else if(operator)target=referenceTarget('https://ready.loftwah.com','loftwah/app-composer-hello');
let config={};try{config=JSON.parse(readFileSync(resolve(workspace,'wrangler.jsonc'),'utf8'));}catch{}
const account=flags.get('--account')||config.account_id||null;
const worker=flags.get('--reference-worker')||(operator?'composer-hello':null);
if(account&&!/^[a-f0-9]{32}$/.test(account))throw new Error('Choose the exact Cloudflare account ID.');
if(worker&&!/^[a-z][a-z0-9-]{0,62}$/.test(worker))throw new Error('Choose the deployed Hello Worker name.');
const storage=resolve(workspace,'.private');mkdirSync(storage,{recursive:true,mode:0o700});
const receipt=resolve(storage,'readiness.json'),lock=resolve(storage,'readiness.lock');
// A process lock prevents duplicate submissions from replacing one another's receipt.
let fd;try{fd=openSync(lock,'wx',0o600);}catch{throw new Error('Another readiness run owns this workspace. Wait for it; an interrupted lock may be removed only after verifying its recorded process has stopped.');}
writeFileSync(fd,String(process.pid));closeSync(fd);
let state;
try{
 let previous=null;try{previous=JSON.parse(readFileSync(receipt,'utf8'));}catch{}
 const context={workspace,repo,source,dirty,target,account,worker};
 const same=previous?.version===2&&JSON.stringify(previous.context)===JSON.stringify(context);
 state={version:2,recipe:'codex-github-cloudflare-hello-v2',context,state:'verifying',checks:same?previous.checks:{},startedAt:same?previous.startedAt:new Date().toISOString(),attempt:(same?previous.attempt:0)+1};
 const save=()=>{const temp=receipt+'.tmp';writeFileSync(temp,JSON.stringify(state,null,2),{mode:0o600});renameSync(temp,receipt);};
 if(flags.has('--cancel')){state.state='cancelled';state.updatedAt=new Date().toISOString();state.expiresAt=null;save();console.log('Readiness cancelled. No repositories, domains or deployments were changed.');}
 else{
  const check=(id,label,action,verify)=>runReadinessCheck(state,{id,label,action,verify},save);
  await check('agent','Coding agent and tools','Resume in an authorised Codex workspace. Install or repair Git, GitHub CLI and pnpm through their official tools.',async()=>{
   const git=run('git',['--version']),gh=run('gh',['--version']).split('\n')[0],pnpm=run('pnpm',['--version']);
   let codex='';try{codex=run('codex',['--version']);}catch{}
   const active=!!process.env.CODEX_THREAD_ID||!!process.env.CODEX_MANAGED_BY_NPM;
   if(!active)throw new ReadinessFailure('configuration');
   return {git,gh,pnpm,codex,activeCodexSession:active};
  });
  await check('github','Workspace and GitHub permission',`Finish the Git clone and credential-free GitHub origin, create the initial commit if needed, then authenticate GitHub CLI for ${repo||'the intended repository'} and verify push permission. Rerun this doctor after the human sign-in.`,async()=>{
   if(!repo||!source||!/^[a-f0-9]{40}$/.test(source))throw new ReadinessFailure('configuration');
   const data=JSON.parse(run('gh',['api','repos/'+repo]));
   if(!data.permissions?.push)throw new ReadinessFailure('permission');
   return {repository:repo,push:true,source:context.source};
  });
  await check('cloudflare','Cloudflare deployment tools','Complete the official Wrangler login or supply an authorised Cloudflare deployment token, then rerun. Do not paste credentials into Composer.',async()=>{
   const identity=JSON.parse(run('pnpm',['exec','wrangler','whoami','--json']));
   if(identity.loggedIn!==true)throw new ReadinessFailure('authentication');
   if(!account||!identity.accounts?.some(value=>value.id===account))throw new ReadinessFailure('configuration');
   return {wrangler:run('pnpm',['exec','wrangler','--version']).split('\n').pop(),authenticated:true,account};
  });
  await check('https','Deployed Hello reference',target?'Deploy or repair the selected Hello reference. Supply --account, --reference-worker and an authorised CLOUDFLARE_API_TOKEN with read access to Worker hostnames; account routing and exact HTTPS source must match. A purchase or a conflicting DNS change needs MP approval.':'Choose an authorised HTTPS reference and its GitHub source using --reference-url and --reference-repo. The agent must deploy and verify it before readiness can pass.',async()=>{
   if(!target||!worker||!account)throw new ReadinessFailure('configuration');
   if(!process.env.CLOUDFLARE_API_TOKEN)throw new ReadinessFailure('authentication');
   const api=async(path)=>{const value=await readinessJSON('https://api.cloudflare.com/client/v4/accounts/'+account+path,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});if(!value?.success)throw new ReadinessFailure('response');return value.result;};
   const hostname=new URL(target.origin).hostname;
   let domain;
   if(hostname.endsWith('.workers.dev')){const subdomain=await api('/workers/subdomain');const enabled=await api('/workers/scripts/'+worker+'/subdomain');if(hostname!==worker+'.'+subdomain.subdomain+'.workers.dev'||!enabled.enabled)throw new ReadinessFailure('configuration');domain={kind:'workers.dev',worker};}
   else{const domains=await api('/workers/domains');const match=domains.find(value=>value.hostname===hostname&&value.service===worker&&value.environment==='production'&&value.enabled);if(!match)throw new ReadinessFailure('configuration');domain={kind:'custom-domain',worker,zone:match.zone_name};}
   const identity=await readinessJSON(target.origin+'/build.json',{headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'}});
   const expected=run('gh',['api','repos/'+target.repo+'/commits/HEAD','--jq','.sha']);
   if(identity.app!=='hello'||identity.commit!==expected||!/^[a-f0-9]{40}$/.test(expected))throw new ReadinessFailure('source');
   return {url:target.origin,repository:target.repo,commit:identity.commit,domain,account};
  });
  state=finishReadiness(state);save();
  if(flags.has('--publish-proof')){
   if(!operator||target?.origin!=='https://ready.loftwah.com'||state.state!=='verified')throw new Error('Only the verified launch environment may replace the public operator proof.');
   const proof={reviewed:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Australia/Melbourne'}).format(new Date()),url:target.origin,commit:state.checks.https.evidence.commit,checks:[{label:'Actual Codex workspace',status:'Verified',detail:'Git and authenticated GitHub push access checked in this agent workspace.'},{label:'Cloudflare deployment tools',status:'Verified',detail:'Authenticated Wrangler verified. No browser credentials assumed.'},{label:'Custom domain and HTTPS',status:'Verified',detail:'Selected hostname returned the exact reference source commit.'}]};
   writeFileSync(resolve(workspace,'src/lib/readiness.json'),JSON.stringify(proof,null,2)+'\n');
  }
  console.log('Readiness: '+state.state+'. Private workspace receipt saved; no infrastructure was changed.');
  for(const item of Object.values(state.checks))console.log(item.label+': '+item.state+(item.action?' — '+item.action:''));
  if(state.state!=='verified')process.exitCode=1;
 }
}finally{unlinkSync(lock);}

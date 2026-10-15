import {prepareSiteSkills,validateSkillPurpose,validateSkillInventory} from './site-skills.mjs';
import {mkdirSync,mkdtempSync,rmSync,readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,lstatSync,realpathSync,cpSync,constants,fstatSync,ftruncateSync,symlinkSync,rmdirSync} from 'node:fs';
import {resolve,dirname,basename,isAbsolute} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {prepareWorkspaceTools,workspaceToolEnvironment} from './workspace-tools.mjs';
import {prepareOwnedReference} from './ownership.mjs';
import {githubRepository} from './state.mjs';
import {ReadinessFailure,runReadinessCommand,readinessJSON} from './check.mjs';
import {createReadinessSession,runReadinessSession,recipe} from './engine.mjs';
import {localChecks,verifyReferenceRouting,installedWrangler,runWorkspaceWrangler,wranglerEnvironment,cloudflareToken} from './local-checks.mjs';

export const referenceInstallArgs=Object.freeze(['install','--frozen-lockfile','--ignore-scripts','--ignore-pnpmfile','--registry=https://registry.npmjs.org','--userconfig=/dev/null']);
export function referenceInstallEnvironment(env,configDir) {
  const selected=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
  return {...selected,CI:'true',XDG_CONFIG_HOME:configDir};
}

export function referenceReleaseEnvironment(context,env) {
  return {...wranglerEnvironment(env),GH_HOST:'github.com',HELLO_REPOSITORY:context.repo,HELLO_ACCOUNT_ID:context.account,HELLO_WORKER:context.worker,HELLO_ORIGIN:context.target?.origin};
}

// Public source acquisition needs no GitHub/Cloudflare credential or user Git hook.
export function referenceCloneEnvironment(env,home) {
  const selected=Object.fromEntries(['PATH','TMPDIR','LANG','LC_ALL'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
  return {...selected,HOME:home,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'/usr/bin/false'};
}

async function cloneReference(context,env,requested) {
  if(typeof requested!=='string'||!isAbsolute(requested)||requested.includes('\0')||resolve(requested)!==requested)throw new ReadinessFailure('configuration');
  let parent;
  try{parent=realpathSync(dirname(requested));if(!lstatSync(parent).isDirectory())throw new Error();}catch{throw new ReadinessFailure('configuration');}
  // Resolve the existing parent once, including macOS's /var → /private/var alias.
  const destination=resolve(parent,basename(requested));
  const trusted=recipe.operations['clone-reference'].source;
  // This read is the acquisition prerequisite even when no parent repo exists.
  // An inherited enterprise host must not select another source authority.
  const source=runReadinessCommand('gh',['api','repos/'+trusted+'/commits/main','--hostname','github.com','--jq','.sha'],{cwd:context.workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
  if(!/^[a-f0-9]{40}$/.test(source))throw new ReadinessFailure('response');
  const configDir=mkdtempSync(resolve(tmpdir(),'composer-clone-config-'));
  try{
    const cloneEnv=referenceCloneEnvironment(env,configDir);
    const run=(cwd,args)=>runReadinessCommand('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.attributesFile=/dev/null','-c','protocol.allow=never','-c','protocol.https.allow=always',...args],{cwd,env:cloneEnv,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
    const verify=()=>{
      try{
        if(lstatSync(destination).isSymbolicLink()||!lstatSync(destination).isDirectory()||realpathSync(destination)!==destination)throw new ReadinessFailure('configuration');
        if(run(destination,['rev-parse','--show-toplevel'])!==destination)throw new ReadinessFailure('configuration');
        // Git status can execute fsmonitor/clean filters from an existing local config.
        // Disable the monitor and refuse filters/includes before inspecting worktree bytes.
        const keys=run(destination,['config','--includes','--name-only','--list']).split('\n');
        if(keys.some(key=>/^(filter\.|include\.|includeif\.)/i.test(key)))throw new ReadinessFailure('configuration');
        if(githubRepository(run(destination,['remote','get-url','origin']))!==trusted||run(destination,['rev-parse','HEAD'])!==source||run(destination,['branch','--show-current'])!=='main'||run(destination,['rev-parse','origin/main'])!==source||run(destination,['status','--porcelain']))throw new ReadinessFailure('configuration');
      }catch{throw new ReadinessFailure('configuration');}
    };
    let present;
    try{lstatSync(destination);present=true;}catch(error){if(error.code!=='ENOENT')throw new ReadinessFailure('configuration');present=false;}
    if(present){verify();return {repository:trusted,commit:source,destination,changed:false};}
    // Exclusive reservation: even an empty directory created by another actor is owner work.
    try{mkdirSync(destination,{mode:0o700});}catch{throw new ReadinessFailure('configuration');}
    // Keep a partial checkout on failure for inspection; never delete a selected workspace.
    run(context.workspace,['clone','--no-checkout','--template=','--single-branch','--branch=main','--','https://github.com/'+trusted+'.git',destination]);
    if(run(destination,['rev-parse','origin/main'])!==source)throw new ReadinessFailure('source');
    run(destination,['checkout','main']);
    verify();
    return {repository:trusted,commit:source,destination,changed:true};
  }finally{rmSync(configDir,{recursive:true});}
}

function reviewedReference(context,env,{allowOwned=false,allowOwnedTarget=false}={}) {
  const current=discoverWorkspace(context.workspace,env);
  const trusted=recipe.operations['deploy-reference'].source;
  const owned=current.repo!==trusted;
  if(!current.repo||context.repo!==current.repo||current.source!==context.source||current.dirty!==false||(owned&&!allowOwned))throw new ReadinessFailure('configuration');
  const run=(cmd,args)=>runReadinessCommand(cmd,args,{cwd:current.workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
  if(run('git',['branch','--show-current'])!=='main'||run('git',['rev-parse','origin/main'])!==current.source||run('gh',['api','repos/'+current.repo+'/commits/main','--hostname','github.com','--jq','.sha'])!==current.source)throw new ReadinessFailure('source');
  if(owned){
    let user,repository;
    try{user=JSON.parse(run('gh',['api','user','--hostname','github.com']));repository=JSON.parse(run('gh',['api','repos/'+current.repo,'--hostname','github.com']));}catch(error){if(error instanceof ReadinessFailure)throw error;throw new ReadinessFailure('response');}
    // Source authority comes from actual providers, never a local ownership receipt.
    if(typeof user?.login!=='string'||!user.login||typeof repository?.full_name!=='string'||typeof repository?.owner?.login!=='string'||typeof repository.private!=='boolean'||typeof repository.default_branch!=='string'||repository.full_name.toLowerCase()!==current.repo.toLowerCase()||repository.owner.login.toLowerCase()!==current.repo.split('/')[0].toLowerCase())throw new ReadinessFailure('response');
    if(current.repo.split('/')[0].toLowerCase()!==user.login.toLowerCase()||repository.private!==true||repository.default_branch!=='main')throw new ReadinessFailure('configuration');
    // Local preparation needs a fresh source read, not write/admin authority.
    // GitHub write readiness remains a separate check required for deployment.
    if(allowOwnedTarget){if(typeof repository.permissions?.push!=='boolean')throw new ReadinessFailure('response');if(!repository.permissions.push)throw new ReadinessFailure('permission');}
    const baseline=run('gh',['api','repos/'+trusted+'/commits/main','--hostname','github.com','--jq','.sha']);
    if(!/^[a-f0-9]{40}$/.test(baseline)||(!allowOwnedTarget&&baseline!==current.source))throw new ReadinessFailure('source');
    current.baseline=baseline;
  }
  return {...current,owned};
}

export function discoverWorkspace(path,env=process.env) {
  const cwd=resolve(path);
  const run=(cmd,args)=>runReadinessCommand(cmd,cmd==='git'?['-c','core.fsmonitor=false',...args]:args,{cwd,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
  let workspace=cwd,repo=null,source=null,dirty=null;
  try{workspace=run('git',['rev-parse','--show-toplevel']);}catch{}
  try{repo=githubRepository(run('git',['remote','get-url','origin']));}catch{}
  try{
    source=run('git',['rev-parse','HEAD']);
    const keys=run('git',['config','--includes','--name-only','--list']).split('\n');
    // Discovery precedes operation guards. Never execute configured clean filters
    // or monitors just to decide whether this is a supported workspace.
    if(!keys.some(key=>/^filter\./i.test(key)))dirty=!!run('git',['status','--porcelain']);
  }catch{}
  return {workspace,repo,source,dirty};
}

function referenceInputGuard(current,env,{allFiles=false}={}) {
  const gitEnv=current.owned?referenceCloneEnvironment(env,env.HOME):env;
  const git=args=>runReadinessCommand('git',['--no-replace-objects','-c','core.fsmonitor=false',...args],{cwd:current.workspace,env:gitEnv,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
  const verifyInputs=()=>{
    if(current.owned&&git(['config','--includes','--name-only','--list']).split('\n').some(key=>/^(filter\.|include\.|includeif\.|remote\.origin\.pushurl$)/i.test(key)))throw new ReadinessFailure('configuration');
    if(current.owned&&(git(['remote','get-url','--all','origin'])!=='https://github.com/'+current.repo+'.git'||git(['remote','get-url','--push','--all','origin'])!=='https://github.com/'+current.repo+'.git'))throw new ReadinessFailure('configuration');
    if(git(['rev-parse','HEAD'])!==current.source||git(['branch','--show-current'])!=='main'||git(['rev-parse','origin/main'])!==current.source||githubRepository(git(['remote','get-url','origin']))!==current.repo||git(['status','--porcelain']))throw new ReadinessFailure('source');
    const files=current.owned||allFiles?git(['ls-tree','-r','--name-only',current.source]).split('\n'):['package.json','pnpm-lock.yaml'];
    for(const file of files){
      try{
        if(!lstatSync(resolve(current.workspace,file)).isFile()||realpathSync(resolve(current.workspace,file))!==resolve(current.workspace,file))throw new Error();
        if(git(['hash-object','--no-filters','--',file])!==git(['rev-parse',current.source+':'+file]))throw new Error();
      }catch{throw new ReadinessFailure('source');}
    }
  };
  return {git,verifyInputs};
}

async function deploymentConfig(workspace) {
  const require=createRequire(resolve(workspace,'package.json'));
  // Use the selected workspace's installed, tested Wrangler JSONC implementation.
  if(require('wrangler/package.json').version!=='4.143.1')throw new ReadinessFailure('configuration');
  const {unstable_readConfig}=await import(pathToFileURL(require.resolve('wrangler')).href);
  return unstable_readConfig({config:resolve(workspace,'wrangler.jsonc'),env:''},{hideWarnings:true});
}

export function referenceDeployment(context,compatibilityDate,subdomain) {
  if(!/^[a-f0-9]{32}$/.test(context.account??'')||!/^[a-z][a-z0-9-]{0,62}$/.test(context.worker??'')||!/^[a-z0-9][a-z0-9-]{0,62}$/.test(subdomain??'')||!/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate??'')||context.target?.origin!=='https://'+context.worker+'.'+subdomain+'.workers.dev')throw new ReadinessFailure('configuration');
  return {name:context.worker,account_id:context.account,main:'src/worker.ts',compatibility_date:compatibilityDate,workers_dev:true,preview_urls:false,assets:{directory:'public',binding:'ASSETS',run_worker_first:true},vars:{PUBLIC_ORIGIN:context.target.origin},limits:{cpu_ms:10}};
}

export async function verifyNewWorkersDevTarget(context,env=process.env,request=fetch) {
  if(!/^[a-f0-9]{32}$/.test(context.account??'')||!/^[a-z][a-z0-9-]{0,62}$/.test(context.worker??''))throw new ReadinessFailure('configuration');
  const token=cloudflareToken(context,env);
  const api=async path=>{
    const body=await readinessJSON('https://api.cloudflare.com/client/v4/accounts/'+context.account+'/workers/'+path,{headers:{Authorization:'Bearer '+token}},request);
    if(body?.success!==true)throw new ReadinessFailure('response');
    return body;
  };
  const subdomain=await api('subdomain');
  if(typeof subdomain.result?.subdomain!=='string'||!/^[a-z0-9][a-z0-9-]{0,62}$/.test(subdomain.result.subdomain))throw new ReadinessFailure('response');
  if(context.target?.origin!=='https://'+context.worker+'.'+subdomain.result.subdomain+'.workers.dev')throw new ReadinessFailure('configuration');
  const scripts=await api('scripts');
  if(!Array.isArray(scripts.result)||scripts.result.some(script=>typeof script?.id!=='string'||!script.id)||(scripts.result_info?.total_pages??1)!==1||(scripts.result_info?.total_count??scripts.result.length)!==scripts.result.length)throw new ReadinessFailure('response');
  if(scripts.result.some(script=>script.id===context.worker))throw new ReadinessFailure('configuration');
  // This read is evidence of current availability, never a reservation/lease.
  return {subdomain:subdomain.result.subdomain,available:true};
}

export function ownedHelloConfiguration(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==3||Object.keys(input).some(key=>!['title','intro','theme'].includes(key))||typeof input.title!=='string'||!input.title.trim()||input.title.length>80||typeof input.intro!=='string'||input.intro.length>240||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.title+input.intro)||!['midnight','daylight'].includes(input.theme))throw new ReadinessFailure('configuration');
  return {title:input.title,intro:input.intro,theme:input.theme};
}

async function ownedSourceProfile(current,context,source,allowConfiguration) {
  const {git}=current;
  const tree=sha=>git(['ls-tree','-r',sha]).split('\n');
  const dataLine=line=>new RegExp('^100644 blob [a-f0-9]{40}\\t'+(allowConfiguration?'(?:wrangler\\.jsonc|config\\.json)':'wrangler\\.jsonc')+'$').test(line);
  const baseline=tree(current.baseline),owned=tree(source),count=allowConfiguration?2:1;
  if(baseline.filter(dataLine).length!==count||owned.filter(dataLine).length!==count||!isDeepStrictEqual(baseline.filter(line=>!dataLine(line)),owned.filter(line=>!dataLine(line))))throw new ReadinessFailure('source');
  let actual,hello;
  try{actual=JSON.parse(git(['show',source+':wrangler.jsonc']));hello=ownedHelloConfiguration(JSON.parse(git(['show',source+':config.json'])));}catch(error){if(error instanceof ReadinessFailure)throw error;throw new ReadinessFailure('configuration');}
  const host=new URL(context.target.origin).hostname;
  if(!host.endsWith('.workers.dev')||host!==context.worker+'.'+host.split('.')[1]+'.workers.dev')throw new ReadinessFailure('configuration');
  const staging=mkdtempSync(resolve(tmpdir(),'composer-owned-profile-'));
  let date;
  try{
    const path=resolve(staging,'wrangler.jsonc');writeFileSync(path,git(['show',current.baseline+':wrangler.jsonc']));
    const require=createRequire(resolve(current.workspace,'package.json'));
    const {unstable_readConfig}=await import(pathToFileURL(require.resolve('wrangler')).href);
    date=unstable_readConfig({config:path,env:''},{hideWarnings:true}).compatibility_date;
  }finally{rmSync(staging,{recursive:true});}
  if(!isDeepStrictEqual(actual,referenceDeployment(context,date,host.split('.')[1])))throw new ReadinessFailure('configuration');
  return {config:actual,hello};
}

async function reviewedOwnedDeployment(context,env,{allowConfiguration=false}={}) {
  if(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_ACCOUNT_ID!==context.account)throw new ReadinessFailure('configuration');
  if(context.target?.repo!==context.repo||!context.account||!context.worker)throw new ReadinessFailure('configuration');
  const current=reviewedReference(context,env,{allowOwned:true,allowOwnedTarget:true});
  if(!current.owned||current.source===current.baseline)throw new ReadinessFailure('configuration');
  const guard=referenceInputGuard(current,env);guard.verifyInputs();installedWrangler(current.workspace);
  const checked={...current,...guard};
  const profile=await ownedSourceProfile(checked,context,current.source,allowConfiguration);
  guard.verifyInputs();return {...checked,...profile};
}

export async function verifyOwnedDeploymentVersion(context,version,env=process.env,request=fetch) {
  if(!/^[a-f0-9-]{36}$/.test(version??'')||!/^[a-f0-9]{32}$/.test(context.account??'')||!/^[a-z][a-z0-9-]{0,62}$/.test(context.worker??''))throw new ReadinessFailure('configuration');
  const token=cloudflareToken(context,env);
  const body=await readinessJSON('https://api.cloudflare.com/client/v4/accounts/'+context.account+'/workers/scripts/'+context.worker+'/deployments?page=1&per_page=1',{headers:{Authorization:'Bearer '+token}},request);
  const active=body.result?.deployments?.[0];
  if(body.success!==true||!Array.isArray(body.result?.deployments)||!active||!Array.isArray(active.versions)||(body.result_info?.page??1)!==1)throw new ReadinessFailure('response');
  if(active.versions.length!==1||active.versions[0].version_id!==version||active.versions[0].percentage!==100)throw new ReadinessFailure('source');
  return {version};
}

async function ownedLiveIdentity(context,source,hello,env) {
  await verifyReferenceRouting(context,env);
  const identity=await readinessJSON(context.target.origin+'/build.json',{headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'}});
  if(identity.app!=='hello'||identity.commit!==source||identity.title!==hello.title||identity.contract!==1||identity.dataVersion!==1)throw new ReadinessFailure('source');
}

function validateOwnedPrevious(previous) {
  if(!previous||typeof previous!=='object'||Array.isArray(previous)||Object.keys(previous).length!==2||!/^[a-f0-9]{40}$/.test(previous.source??'')||!/^[a-f0-9-]{36}$/.test(previous.version??''))throw new ReadinessFailure('configuration');
}

async function verifyOwnedPrevious(current,context,previous,env,cloudEnv=env) {
  validateOwnedPrevious(previous);
  try{current.git(['merge-base','--is-ancestor',previous.source,current.source]);}catch{throw new ReadinessFailure('source');}
  if(runReadinessCommand('gh',['api','repos/'+current.repo+'/commits/'+previous.source,'--hostname','github.com','--jq','.sha'],{cwd:current.workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']})!==previous.source)throw new ReadinessFailure('source');
  const profile=await ownedSourceProfile(current,context,previous.source,true);
  await verifyOwnedDeploymentVersion(context,previous.version,cloudEnv);
  await ownedLiveIdentity(context,previous.source,profile.hello,cloudEnv);
  // HTTPS/routing IO can outlast an activation. Recheck active version last.
  await verifyOwnedDeploymentVersion(context,previous.version,cloudEnv);
  current.verifyInputs();
}

export async function verifyReferenceConfig(context) {
  const config=await deploymentConfig(context.workspace);
  if(config.name!==context.worker||config.account_id!==context.account||config.vars?.PUBLIC_ORIGIN!==context.target?.origin)throw new ReadinessFailure('configuration');
  return config;
}

async function deployReviewedReference(context,env,{previous=null,maintained=false}={}) {
    let current;
    if(maintained){
      if(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_ACCOUNT_ID!==context.account)throw new ReadinessFailure('configuration');
      const reviewed=reviewedReference(context,env);
      if(context.target?.repo!==reviewed.repo)throw new ReadinessFailure('configuration');
      const guard=referenceInputGuard(reviewed,env,{allFiles:true});guard.verifyInputs();
      current={...reviewed,...guard,hello:ownedHelloConfiguration(JSON.parse(guard.git(['show',reviewed.source+':config.json'])))};
      await verifyReferenceConfig(context);
    }else current=await reviewedOwnedDeployment(context,env,{allowConfiguration:previous!==null});
    // Freeze one selected credential for this operation. Source/GitHub checks
    // keep their original environment; tests/build get an isolated empty HOME.
    // Provider denial/expiry never selects another identity or retries an upload.
    const cloudEnv={...env,CLOUDFLARE_API_TOKEN:cloudflareToken(context,env)};
    // Initial creation needs an unused name. Updates instead require explicit
    // previous source/version binding; receipts grant neither operation.
    if(maintained)await verifyReferenceRouting(context,cloudEnv);else if(previous)await verifyOwnedPrevious(current,context,previous,env,cloudEnv);else await verifyNewWorkersDevTarget(context,cloudEnv);
    const staging=realpathSync(mkdtempSync(resolve(tmpdir(),'composer-owned-release-')));
    try{
      const files=current.git(['ls-tree','-r','--name-only',current.source]).split('\n');
      const verifySnapshot=()=>{
        for(const file of files){
          const path=resolve(staging,file);
          if(!lstatSync(path).isFile()||realpathSync(path)!==path||current.git(['hash-object','--no-filters','--',path])!==current.git(['rev-parse',current.source+':'+file]))throw new ReadinessFailure('source');
        }
      };
      for(const file of files){const path=resolve(staging,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,readFileSync(resolve(current.workspace,file)),{flag:'wx'});}
      verifySnapshot();current.verifyInputs();
      if(maintained){
        // Reuse the independent reference's verified target contract. No shell,
        // ignored dotenv, pnpm config or lifecycle hooks execute its release.
        const {expectedTarget,verifyTarget}=await import(pathToFileURL(resolve(staging,'release-target.mjs')).href);
        verifyTarget(await verifyReferenceConfig(context),expectedTarget(referenceReleaseEnvironment(context,env)),current.git(['remote','get-url','origin']));
        current.verifyInputs();verifySnapshot();
      }
      // Dependencies remain pinned to the selected workspace. Ignored owner
      // .env/.npmrc/hooks never reach the source snapshot or its build settings.
      symlinkSync(resolve(current.workspace,'node_modules'),resolve(staging,'node_modules'),'dir');
      const configDir=resolve(staging,'.private-config');mkdirSync(configDir);
      const testEnv=referenceInstallEnvironment({...env,HOME:configDir},configDir);
      const tests=files.filter(file=>/^tests\/[^/]+\.test\.mjs$/.test(file));
      if(!tests.length)throw new ReadinessFailure('configuration');
      runReadinessCommand(process.execPath,['--test',...tests],{cwd:staging,env:testEnv,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
      const args=['deploy','--config','wrangler.jsonc','--env=','--define','BUILD_SHA:'+JSON.stringify(current.source)];
      runWorkspaceWrangler(current.workspace,[...args,'--dry-run','--outdir','.private/build'],testEnv,{cwd:staging,timeout:60000});
      // Rebind actual GitHub main, owner and all source bytes after tests/build.
      const after=maintained?reviewedReference(context,env):await reviewedOwnedDeployment(context,env,{allowConfiguration:previous!==null});
      if(after.source!==current.source||after.baseline!==current.baseline)throw new ReadinessFailure('source');
      verifySnapshot();
      await localChecks(context,env).find(check=>check.id==='cloudflare').verify();
      if(maintained)await verifyReferenceRouting(context,cloudEnv);else if(previous)await verifyOwnedPrevious(current,context,previous,env,cloudEnv);else await verifyNewWorkersDevTarget(context,cloudEnv);
      current.verifyInputs();verifySnapshot();
      const releaseEnv={...testEnv,CLOUDFLARE_API_TOKEN:cloudEnv.CLOUDFLARE_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:context.account};
      const output=runWorkspaceWrangler(current.workspace,args,releaseEnv,{cwd:staging,timeout:180000});
      const version=/Current Version ID: ([a-f0-9-]{36})/.exec(output)?.[1];
      if(!version)throw new ReadinessFailure('response');
      current.verifyInputs();
      let verified=false;
      const title=JSON.parse(readFileSync(resolve(staging,'config.json'),'utf8')).title;
      for(let attempt=0;attempt<12;attempt++){
        try{
          if(previous)await verifyOwnedDeploymentVersion(context,version,cloudEnv);
          await verifyReferenceRouting(context,cloudEnv);
          const identity=await readinessJSON(context.target.origin+'/build.json',{headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'}});
          if(identity.app==='hello'&&identity.commit===current.source&&identity.title===title&&identity.contract===1&&identity.dataVersion===1){verified=true;break;}
        }catch{}
        if(attempt<11)await new Promise(resolve=>setTimeout(resolve,1500));
      }
      if(!verified)throw new ReadinessFailure('response');
      return {repository:current.repo,commit:current.source,baseline:current.baseline,account:context.account,worker:context.worker,url:context.target.origin,version,created:!maintained&&previous===null,updated:maintained||previous!==null};
    }finally{rmSync(staging,{recursive:true});}

}

export function createLocalAdapter(context,env=process.env) {
  env={...env};
  return {checks:localChecks(context,env),prepareSiteSkills:(availableSkills,{skillPurpose='emdash-site'}={})=>prepareSiteSkills({workspace:context.workspace,availableSkills,purpose:skillPurpose},env),installWorkspaceTools:async()=>{const result=await prepareWorkspaceTools(context.workspace,env);if(result.scope==='workspace')env.PATH=workspaceToolEnvironment(context.workspace,env).PATH;return result;},cloneReference:destination=>cloneReference(context,env,destination),ownReference:(repository,options)=>prepareOwnedReference(context,env,repository,options),installReferenceTools:async()=>{
    const current=reviewedReference(context,env,{allowOwned:true});
    // Git status can hide assume-unchanged/skip-worktree edits. Package execution
    // must use the actual committed dependency inputs, including cached repeats.
    const {git,verifyInputs}=referenceInputGuard(current,env);
    verifyInputs();
    if(process.platform!=='darwin'||process.arch!=='arm64'||process.versions.node.split('.')[0]!=='22')throw new ReadinessFailure('configuration');
    const pnpm=runReadinessCommand('pnpm',['--version'],{cwd:current.workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
    if(!['12.8.1','12.9.1'].includes(pnpm))throw new ReadinessFailure('configuration');
    const verifyTools=()=>{
      const version=installedWrangler(current.workspace);
      const output=runWorkspaceWrangler(current.workspace,['--version'],env);
      if(!output.split('\n').includes(version))throw new ReadinessFailure('response');
      return version;
    };
    // Detect first. An already verified local installation needs no package write.
    try{const wrangler=verifyTools();verifyInputs();return {wrangler,pnpm,changed:false};}catch(error){if(!(error instanceof ReadinessFailure)||error.code==='source')throw error;}
    verifyInputs();
    // An incomplete/unrelated installation is owner work. Do not replace it.
    if(current.owned){try{lstatSync(resolve(current.workspace,'node_modules'));throw new ReadinessFailure('configuration');}catch(error){if(error.code!=='ENOENT')throw error;}}
    // No project/dependency lifecycle scripts or pnpm hooks; preserve the committed lock.
    const configDir=mkdtempSync(resolve(tmpdir(),'composer-install-config-'));
    try{
      const installation=current.owned?resolve(configDir,'project'):current.workspace;
      if(current.owned){
        mkdirSync(installation);
        // Only committed reviewed dependency inputs reach pnpm. Ignored .npmrc,
        // workspace hooks and other owner files cannot affect this installation.
        for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml']){
          const copied=resolve(installation,file);writeFileSync(copied,readFileSync(resolve(current.workspace,file)));
          if(git(['hash-object','--no-filters','--',copied])!==git(['rev-parse',current.source+':'+file]))throw new ReadinessFailure('source');
        }
        verifyInputs();
      }
      runReadinessCommand('pnpm',referenceInstallArgs,{cwd:installation,env:referenceInstallEnvironment(env,configDir),encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
      if(current.owned){
        verifyInputs();
        // Reserve exclusively, retain partial adoption on failure and preserve
        // relative package symlinks. No existing directory is removed/replaced.
        mkdirSync(resolve(current.workspace,'node_modules'),{mode:0o700});
        cpSync(resolve(installation,'node_modules'),resolve(current.workspace,'node_modules'),{recursive:true,force:false,errorOnExist:true,verbatimSymlinks:true});
      }
    }finally{rmSync(configDir,{recursive:true});}
    const after=discoverWorkspace(current.workspace,env);
    if(after.source!==current.source||after.dirty!==false)throw new ReadinessFailure('source');
    verifyInputs();
    return {wrangler:verifyTools(),pnpm,changed:true};
  },prepareReferenceTarget:async()=>{
    if(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_ACCOUNT_ID!==context.account)throw new ReadinessFailure('configuration');
    if(!context.target||context.target.repo!==context.repo||!context.account||!context.worker||!new URL(context.target.origin).hostname.endsWith('.workers.dev'))throw new ReadinessFailure('configuration');
    const current=reviewedReference(context,env,{allowOwned:true});
    if(!current.owned)throw new ReadinessFailure('configuration');
    const {git,verifyInputs}=referenceInputGuard(current,env);verifyInputs();
    await localChecks(context,env).find(check=>check.id==='cloudflare').verify();
    const cloudEnv={...env,CLOUDFLARE_API_TOKEN:cloudflareToken(context,env)};
    const path=resolve(current.workspace,'wrangler.jsonc');
    const original=readFileSync(path),originalStat=lstatSync(path);
    if(originalStat.nlink!==1)throw new ReadinessFailure('configuration');
    const staging=mkdtempSync(resolve(tmpdir(),'composer-target-config-'));
    let config;
    try{
      const snapshot=resolve(staging,'wrangler.jsonc');writeFileSync(snapshot,original);
      if(git(['hash-object','--no-filters','--',snapshot])!==git(['rev-parse',current.source+':wrangler.jsonc']))throw new ReadinessFailure('source');
      const require=createRequire(resolve(current.workspace,'package.json'));
      const {unstable_readConfig}=await import(pathToFileURL(require.resolve('wrangler')).href);
      config=unstable_readConfig({config:snapshot,env:''},{hideWarnings:true});
    }finally{rmSync(staging,{recursive:true});}
    const selected=await verifyNewWorkersDevTarget(context,cloudEnv);
    const proposed=referenceDeployment(context,config.compatibility_date,selected.subdomain);
    // Recheck source, local bytes and live name availability after provider IO.
    reviewedReference(context,env,{allowOwned:true});verifyInputs();
    await verifyNewWorkersDevTarget(context,cloudEnv);
    verifyInputs();
    if(!readFileSync(path).equals(original))throw new ReadinessFailure('source');
    // Bind the write to the checked regular file; a substituted symlink cannot
    // redirect it into another owner file during the final write window.
    let file;
    try{
      file=openSync(path,constants.O_WRONLY|constants.O_NOFOLLOW);
      const opened=fstatSync(file),present=lstatSync(path);
      if(!opened.isFile()||opened.nlink!==1||present.isSymbolicLink()||opened.ino!==originalStat.ino||opened.dev!==originalStat.dev||present.ino!==opened.ino||present.dev!==opened.dev)throw new ReadinessFailure('source');
      ftruncateSync(file,0);writeFileSync(file,JSON.stringify(proposed,null,2)+'\n');
    }catch(error){if(error instanceof ReadinessFailure)throw error;throw new ReadinessFailure('source');}finally{if(file!==undefined)closeSync(file);}
    return {repository:current.repo,commit:current.source,account:context.account,worker:context.worker,url:context.target.origin,changed:true,deployed:false};
  },configureOwnedReference:async configuration=>{
    const proposed=ownedHelloConfiguration(configuration);
    const current=await reviewedOwnedDeployment(context,env,{allowConfiguration:true});
    await ownedLiveIdentity(context,current.source,current.hello,env);
    const path=resolve(current.workspace,'config.json'),original=readFileSync(path),stat=lstatSync(path);
    if(stat.nlink!==1)throw new ReadinessFailure('configuration');
    if(isDeepStrictEqual(proposed,current.hello)){current.verifyInputs();return {changed:false,deployed:false};}
    // Rebind actual ownership/source and bytes after HTTPS/provider IO.
    const after=await reviewedOwnedDeployment(context,env,{allowConfiguration:true});
    if(after.source!==current.source||after.baseline!==current.baseline)throw new ReadinessFailure('source');
    await ownedLiveIdentity(context,current.source,current.hello,env);current.verifyInputs();
    if(!readFileSync(path).equals(original))throw new ReadinessFailure('source');
    let file;
    try{
      file=openSync(path,constants.O_WRONLY|constants.O_NOFOLLOW);
      const opened=fstatSync(file),present=lstatSync(path);
      if(!opened.isFile()||opened.nlink!==1||present.isSymbolicLink()||opened.ino!==stat.ino||opened.dev!==stat.dev||present.ino!==opened.ino||present.dev!==opened.dev)throw new ReadinessFailure('source');
      ftruncateSync(file,0);writeFileSync(file,JSON.stringify(proposed,null,2)+'\n');
    }catch(error){if(error instanceof ReadinessFailure)throw error;throw new ReadinessFailure('source');}finally{if(file!==undefined)closeSync(file);}
    return {changed:true,deployed:false,source:current.source};
  },deployOwnedReference:()=>deployReviewedReference(context,env),updateOwnedReference:async previous=>{validateOwnedPrevious(previous);return deployReviewedReference(context,env,{previous});},deployReference:()=>deployReviewedReference(context,env,{maintained:true})
  };
}

export async function runLocalReadiness(options,env=process.env) {
  if(options.operation==='prepare-site-skills'){validateSkillPurpose(options.skillPurpose??'emdash-site');validateSkillInventory(options.availableSkills);}else if(options.skillPurpose!=null)throw new ReadinessFailure('configuration');
  const context={...discoverWorkspace(options.workspace,env),target:options.target??null,account:options.account??null,worker:options.worker??null};
  if(['prepare-site-skills','install-workspace-tools','install-reference-tools'].includes(options.operation)&&realpathSync(options.workspace)!==realpathSync(context.workspace))throw new ReadinessFailure('configuration');
  if(options.useWorkspaceTools!==undefined&&typeof options.useWorkspaceTools!=='boolean')throw new ReadinessFailure('configuration');
  if(options.toolsWorkspace!==undefined&&(typeof options.toolsWorkspace!=='string'||!isAbsolute(options.toolsWorkspace)||options.toolsWorkspace.includes('\0')||options.useWorkspaceTools))throw new ReadinessFailure('configuration');
  if(options.toolsWorkspace||options.useWorkspaceTools)env=workspaceToolEnvironment(options.toolsWorkspace??context.workspace,env);
  const storage=resolve(realpathSync(context.workspace),'.private');mkdirSync(storage,{recursive:true,mode:0o700});
  const directory=lstatSync(storage);
  if(!directory.isDirectory()||directory.isSymbolicLink())throw new ReadinessFailure('configuration');
  const receipt=resolve(storage,'readiness.json'),lock=resolve(storage,'readiness.lock');
  const sameDirectory=()=>{const current=lstatSync(storage);if(!current.isDirectory()||current.isSymbolicLink()||current.ino!==directory.ino||current.dev!==directory.dev)throw new ReadinessFailure('source');};
  const receiptBytes=()=>{
    sameDirectory();
    try{const file=lstatSync(receipt);if(!file.isFile()||file.isSymbolicLink()||file.nlink!==1||file.size>131072)throw new ReadinessFailure('source');return readFileSync(receipt);}
    catch(error){if(error.code==='ENOENT')return null;throw error;}
  };
  let fd,ownedLock;
  try{fd=openSync(lock,'wx',0o600);ownedLock=fstatSync(fd);}catch{throw new Error('Another readiness run owns this workspace. Verify the recorded process has stopped before removing an interrupted lock.');}
  const pid=String(process.pid);
  try{
    writeFileSync(fd,pid);closeSync(fd);fd=null;
    let last=receiptBytes(),previous=null;
    if(last!==null){
      try{previous=JSON.parse(last.toString('utf8'));}catch{throw new ReadinessFailure('configuration');}
      // Recognising our receipt permits replacement, not reuse of check authority.
      const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
      if(!object(previous)||previous.version!==2||previous.recipe!==recipe.id||!object(previous.context)||!object(previous.checks)||!['verifying','verified','action_required','failed','cancelled'].includes(previous.state))throw new ReadinessFailure('configuration');
    }
    const unchanged=()=>{const current=receiptBytes();if(last===null?current!==null:current===null||!current.equals(last))throw new ReadinessFailure('source');};
    const session=createReadinessSession(context,previous);
    const ownsLock=()=>{sameDirectory();const current=lstatSync(lock);if(!current.isFile()||current.isSymbolicLink()||current.nlink!==1||current.ino!==ownedLock.ino||current.dev!==ownedLock.dev||readFileSync(lock,'utf8')!==pid)throw new ReadinessFailure('source');};
    const save=state=>{
      ownsLock();unchanged();
      const bytes=Buffer.from(JSON.stringify(state,null,2));
      const temporary=mkdtempSync(resolve(storage,'.receipt-')),file=resolve(temporary,'state.json');
      // A fresh exclusive file cannot follow the old predictable .tmp link.
      // On failure, retain prepared bytes for inspection rather than delete work.
      writeFileSync(file,bytes,{flag:'wx',mode:0o600});
      ownsLock();unchanged();renameSync(file,receipt);last=bytes;
      try{rmdirSync(temporary);}catch{}
    };
    return await runReadinessSession(session,createLocalAdapter(context,env),save,{cancel:options.cancel===true,operation:options.operation??null,destination:options.destination??null,repository:options.repository??null,resumeOwnership:options.resumeOwnership??false,configuration:options.configuration??null,previousDeployment:options.previousDeployment??null,availableSkills:options.availableSkills??null,skillPurpose:options.skillPurpose??null});
  }finally{
    if(fd!==null&&fd!==undefined)closeSync(fd);
    // Release only the lock this run created. Replaced/edited owner files stay intact.
    try{sameDirectory();const current=lstatSync(lock);if(current.isFile()&&!current.isSymbolicLink()&&current.nlink===1&&current.ino===ownedLock.ino&&current.dev===ownedLock.dev&&readFileSync(lock,'utf8')===pid)unlinkSync(lock);}catch{}
  }
}

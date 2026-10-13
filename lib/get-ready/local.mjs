import {mkdirSync,mkdtempSync,rmSync,readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,basename,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {prepareOwnedReference} from './ownership.mjs';
import {githubRepository} from './state.mjs';
import {ReadinessFailure,runReadinessCommand} from './check.mjs';
import {createReadinessSession,runReadinessSession,recipe} from './engine.mjs';
import {localChecks,verifyReferenceRouting,installedWrangler,runWorkspaceWrangler} from './local-checks.mjs';

export const referenceInstallArgs=Object.freeze(['install','--frozen-lockfile','--ignore-scripts','--ignore-pnpmfile','--registry=https://registry.npmjs.org','--userconfig=/dev/null']);
export function referenceInstallEnvironment(env,configDir) {
  const selected=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
  return {...selected,CI:'true',XDG_CONFIG_HOME:configDir};
}

export function referenceReleaseEnvironment(context,env) {
  return {...env,GH_HOST:'github.com',HELLO_REPOSITORY:context.repo,HELLO_ACCOUNT_ID:context.account,HELLO_WORKER:context.worker,HELLO_ORIGIN:context.target?.origin};
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

function reviewedReference(context,env) {
  const current=discoverWorkspace(context.workspace,env);
  const trusted=recipe.operations['deploy-reference'].source;
  if(context.repo!==trusted||current.repo!==trusted||current.source!==context.source||current.dirty!==false)throw new ReadinessFailure('configuration');
  const run=(cmd,args)=>runReadinessCommand(cmd,args,{cwd:current.workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
  if(run('git',['branch','--show-current'])!=='main'||run('git',['rev-parse','origin/main'])!==current.source||run('gh',['api','repos/'+trusted+'/commits/main','--hostname','github.com','--jq','.sha'])!==current.source)throw new ReadinessFailure('source');
  return current;
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

async function deploymentConfig(workspace) {
  const require=createRequire(resolve(workspace,'package.json'));
  // Use the selected workspace's installed, tested Wrangler JSONC implementation.
  if(require('wrangler/package.json').version!=='4.143.1')throw new ReadinessFailure('configuration');
  const {unstable_readConfig}=await import(pathToFileURL(require.resolve('wrangler')).href);
  return unstable_readConfig({config:resolve(workspace,'wrangler.jsonc')},{hideWarnings:true});
}

export async function verifyReferenceConfig(context) {
  const config=await deploymentConfig(context.workspace);
  if(config.name!==context.worker||config.account_id!==context.account||config.vars?.PUBLIC_ORIGIN!==context.target?.origin)throw new ReadinessFailure('configuration');
  return config;
}

export function createLocalAdapter(context,env=process.env) {
  return {checks:localChecks(context,env),cloneReference:destination=>cloneReference(context,env,destination),ownReference:(repository,options)=>prepareOwnedReference(context,env,repository,options),installReferenceTools:async()=>{
    const current=reviewedReference(context,env);
    // Git status can hide assume-unchanged/skip-worktree edits. Package execution
    // must use the actual committed dependency inputs, including cached repeats.
    const verifyInputs=()=>{
      const run=args=>runReadinessCommand('git',args,{cwd:current.workspace,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
      if(run(['rev-parse','HEAD'])!==current.source||run(['branch','--show-current'])!=='main'||run(['rev-parse','origin/main'])!==current.source||githubRepository(run(['remote','get-url','origin']))!==current.repo||run(['status','--porcelain']))throw new ReadinessFailure('source');
      for(const file of ['package.json','pnpm-lock.yaml']){
        try{
          if(!lstatSync(resolve(current.workspace,file)).isFile())throw new Error();
          if(run(['hash-object','--no-filters','--',file])!==run(['rev-parse',current.source+':'+file]))throw new Error();
        }catch{throw new ReadinessFailure('source');}
      }
    };
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
    // No project/dependency lifecycle scripts or pnpm hooks; preserve the committed lock.
    const configDir=mkdtempSync(resolve(tmpdir(),'composer-install-config-'));
    try{
      runReadinessCommand('pnpm',referenceInstallArgs,{cwd:current.workspace,env:referenceInstallEnvironment(env,configDir),encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
    }finally{rmSync(configDir,{recursive:true});}
    const after=discoverWorkspace(current.workspace,env);
    if(after.source!==current.source||after.dirty!==false)throw new ReadinessFailure('source');
    verifyInputs();
    return {wrangler:verifyTools(),pnpm,changed:true};
  },deployReference:async()=>{
    const current=reviewedReference(context,env);
    const trusted=recipe.operations['deploy-reference'].source;
    if(context.target?.repo!==trusted)throw new ReadinessFailure('configuration');
    await verifyReferenceConfig({...context,workspace:current.workspace});
    // Existing routing only: this operation cannot create a domain or choose a new account.
    await verifyReferenceRouting(context,env);
    const output=runReadinessCommand('pnpm',['deploy'],{cwd:current.workspace,env:referenceReleaseEnvironment(context,env),encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
    const version=/Current Version ID: ([a-f0-9-]{36})/.exec(output)?.[1];
    if(!version)throw new ReadinessFailure('response');
    return {repository:trusted,commit:current.source,worker:context.worker,url:context.target.origin,version};
  }};
}

export async function runLocalReadiness(options,env=process.env) {
  const context={...discoverWorkspace(options.workspace,env),target:options.target??null,account:options.account??null,worker:options.worker??null};
  const storage=resolve(context.workspace,'.private');mkdirSync(storage,{recursive:true,mode:0o700});
  const receipt=resolve(storage,'readiness.json'),lock=resolve(storage,'readiness.lock');
  let fd;
  try{fd=openSync(lock,'wx',0o600);}catch{throw new Error('Another readiness run owns this workspace. Verify the recorded process has stopped before removing an interrupted lock.');}
  try{
    writeFileSync(fd,String(process.pid));closeSync(fd);fd=null;
    let previous=null;try{previous=JSON.parse(readFileSync(receipt,'utf8'));}catch{}
    const session=createReadinessSession(context,previous);
    const save=state=>{const temp=receipt+'.tmp';writeFileSync(temp,JSON.stringify(state,null,2),{mode:0o600});renameSync(temp,receipt);};
    return await runReadinessSession(session,createLocalAdapter(context,env),save,{cancel:options.cancel===true,operation:options.operation??null,destination:options.destination??null,repository:options.repository??null,resumeOwnership:options.resumeOwnership??false});
  }finally{if(fd!==null&&fd!==undefined)closeSync(fd);unlinkSync(lock);}
}

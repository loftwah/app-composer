import {mkdirSync,readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {githubRepository} from './state.mjs';
import {ReadinessFailure,runReadinessCommand} from './check.mjs';
import {createReadinessSession,runReadinessSession,recipe} from './engine.mjs';
import {localChecks,verifyReferenceRouting} from './local-checks.mjs';

export function discoverWorkspace(path,env=process.env) {
  const cwd=resolve(path);
  const run=(cmd,args)=>runReadinessCommand(cmd,args,{cwd,env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
  let workspace=cwd,repo=null,source=null,dirty=null;
  try{workspace=run('git',['rev-parse','--show-toplevel']);}catch{}
  try{repo=githubRepository(run('git',['remote','get-url','origin']));}catch{}
  try{source=run('git',['rev-parse','HEAD']);dirty=!!run('git',['status','--porcelain']);}catch{}
  return {workspace,repo,source,dirty};
}

async function deploymentConfig(workspace) {
  const require=createRequire(resolve(workspace,'package.json'));
  // Use the selected workspace's installed, tested Wrangler JSONC implementation.
  if(require('wrangler/package.json').version!=='4.143.1')throw new ReadinessFailure('configuration');
  const {unstable_readConfig}=await import(pathToFileURL(require.resolve('wrangler')).href);
  return unstable_readConfig({config:resolve(workspace,'wrangler.jsonc')},{hideWarnings:true});
}

export function createLocalAdapter(context,env=process.env) {
  return {checks:localChecks(context,env),deployReference:async()=>{
    const current=discoverWorkspace(context.workspace,env);
    const trusted=recipe.operations['deploy-reference'].source;
    if(context.repo!==trusted||context.target?.repo!==trusted||current.repo!==trusted||current.source!==context.source||current.dirty!==false)throw new ReadinessFailure('configuration');
    const run=(cmd,args)=>runReadinessCommand(cmd,args,{cwd:current.workspace,env,encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
    if(run('git',['branch','--show-current'])!=='main'||run('git',['rev-parse','origin/main'])!==current.source||run('gh',['api','repos/'+trusted+'/commits/main','--jq','.sha'])!==current.source)throw new ReadinessFailure('source');
    const config=await deploymentConfig(current.workspace);
    if(config.name!==context.worker||config.account_id!==context.account||config.vars?.PUBLIC_ORIGIN!==context.target.origin)throw new ReadinessFailure('configuration');
    // Existing routing only: this operation cannot create a domain or choose a new account.
    await verifyReferenceRouting(context,env);
    const output=run('pnpm',['deploy']);
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
    return await runReadinessSession(session,createLocalAdapter(context,env),save,{cancel:options.cancel===true,operation:options.operation??null});
  }finally{if(fd!==null&&fd!==undefined)closeSync(fd);unlinkSync(lock);}
}

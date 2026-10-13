import {resolve,isAbsolute} from 'node:path';
import {referenceTarget,finishReadiness} from './state.mjs';
import {runReadinessCheck} from './check.mjs';

export const recipe = Object.freeze({
  id:'codex-github-cloudflare-hello-v2', version:2,
  checks:['agent','github','cloudflare','https'],
  operations:{
    // Public acquisition needs the active tools and its own fresh source-read check,
    // not push permission to an unrelated parent or the maintained upstream.
    'clone-reference':{before:'cloudflare',requires:['agent'],adapter:'cloneReference',label:'Prepare the reviewed Hello checkout',source:'loftwah/app-composer-hello'},
    // Explicit local preparation revalidates the reviewed source in its adapter.
    // It does not need or grant upstream write permission.
    'install-reference-tools':{before:'cloudflare',requires:['agent'],adapter:'installReferenceTools',label:'Install the reviewed reference tools',source:'loftwah/app-composer-hello'},
    'deploy-reference':{before:'https',requires:['agent','github','cloudflare'],adapter:'deployReference',label:'Deploy the reviewed Hello reference',source:'loftwah/app-composer-hello'},
  },
});

// Keep unfinished intent separate from fresh check evidence. It grants no retry authority.
function unfinishedOperations(session, carried=false) {
  if(session?.state==='cancelled')return [];
  const pending=new Map();
  for(const step of [...(session?.pendingOperations??[]),session?.operation].filter(Boolean)){
    const id=Object.hasOwn(recipe.operations,step.id??'')?step.id:Object.entries(recipe.operations).find(([,value])=>value.label===step.label)?.[0]??'reference-operation';
    if(['performed','verified'].includes(step.state)){pending.delete(id);continue;}
    const state=step.state==='failed'?'failed':'action_required';
    const recovery=carried?'agent-recheck':step.issue?.recovery??step.recovery??'agent-recheck';
    pending.set(id,{id,state,...(id==='clone-reference'&&typeof step.destination==='string'?{destination:step.destination}:{}),recovery:['human-authentication','human-permission','agent-setup','agent-retry','agent-repair','agent-recheck'].includes(recovery)?recovery:'agent-recheck'});
  }
  return [...pending.values()];
}

export function createReadinessSession(input, previous=null) {
  const keys=['workspace','repo','source','dirty','target','account','worker'];
  if(!input||Object.keys(input).some(key=>!keys.includes(key)))throw new Error('Unknown readiness context field; credentials belong in the adapter, never the session.');
  if(typeof input.workspace!=='string'||!input.workspace)throw new Error('Choose the authorised local workspace.');
  if(input.target!=null&&(typeof input.target!=='object'||Array.isArray(input.target)||Object.keys(input.target).some(key=>!['origin','repo'].includes(key))||typeof input.target.origin!=='string'||typeof input.target.repo!=='string'))throw new Error('Choose a credential-free reference origin and repository.');
  const context={workspace:resolve(input.workspace),repo:input.repo??null,source:input.source??null,dirty:input.dirty??null,target:input.target!=null?referenceTarget(input.target.origin,input.target.repo):null,account:input.account??null,worker:input.worker??null};
  if(context.repo!==null&&(typeof context.repo!=='string'||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.repo)))throw new Error('Choose a credential-free GitHub repository.');
  if(context.source!==null&&(typeof context.source!=='string'||!/^[a-f0-9]{40}$/.test(context.source)))throw new Error('Choose an exact Git source revision.');
  if(context.account!==null&&(typeof context.account!=='string'||!/^[a-f0-9]{32}$/.test(context.account)))throw new Error('Choose the exact Cloudflare account ID.');
  if(context.worker!==null&&(typeof context.worker!=='string'||!/^[a-z][a-z0-9-]{0,62}$/.test(context.worker)))throw new Error('Choose the intended Hello Worker name.');
  if(context.dirty!==null&&typeof context.dirty!=='boolean')throw new Error('Workspace status must be a boolean.');
  const same=previous?.version===2&&previous.recipe===recipe.id&&JSON.stringify(previous.context)===JSON.stringify(context);
  const validStart=same&&Number.isFinite(Date.parse(previous.startedAt));
  const pending=same?unfinishedOperations(previous,true):[];
  return {...(pending.length?{pendingOperations:pending}:{}),version:2,recipe:recipe.id,context,state:'verifying',checks:{},startedAt:validStart?previous.startedAt:new Date().toISOString(),attempt:same&&Number.isSafeInteger(previous.attempt)&&previous.attempt>=0?previous.attempt+1:1};
}

/** @param {(session: object) => void | Promise<void>} save */
export async function runReadinessSession(session, adapter, save=()=>{}, {cancel=false,operation=null,destination=null}={}) {
  if(operation!==null&&!Object.hasOwn(recipe.operations,operation))throw new Error('Unsupported readiness operation.');
  if(operation==='clone-reference'){
    if(typeof destination!=='string'||!isAbsolute(destination)||destination.includes('\0')||resolve(destination)!==destination)throw new Error('Choose an explicit absolute checkout destination.');
    const pending=unfinishedOperations(session).find(step=>step.id===operation);
    if(pending?.destination&&pending.destination!==destination)throw new Error('The unfinished clone has another destination. Inspect or cancel that intent before selecting a new one.');
  }else if(destination!==null)throw new Error('Only clone-reference accepts a checkout destination.');
  if(cancel){session.state='cancelled';session.expiresAt=null;session.updatedAt=new Date().toISOString();await save(session);return session;}
  const checks=adapter.checks;
  if(!Array.isArray(checks)||checks.length!==4||!recipe.checks.every(id=>checks.filter(check=>check.id===id&&typeof check.verify==='function').length===1))throw new Error('The adapter must supply the four supported checks exactly once.');
  for(const id of recipe.checks){
    if(operation&&id===recipe.operations[operation].before){
      const definition=recipe.operations[operation];
      const allowed=definition.requires.every(required=>session.checks[required]?.state==='verified');
      if(allowed){
        if(typeof adapter[definition.adapter]!=='function')throw new Error('This adapter does not support the selected reference operation.');
        const step={checks:{}};
        await runReadinessCheck(step,{id:operation,label:definition.label,action:operation==='clone-reference'?'Complete official GitHub CLI authentication for github.com or resolve access to the public maintained reference, then explicitly retry. Do not paste credentials into Composer.':'The agent should repair the supported reference setup.',setupAction:operation==='clone-reference'?'Choose an absent checkout directory with an existing parent, or an unchanged exact-main Hello checkout. Inspect any partial checkout; existing files are never overwritten.':null,verify:()=>adapter[definition.adapter](destination)},async()=>{session.operation={id:operation,...(destination?{destination}:{}),...step.checks[operation]};await save(session);});
        if(session.operation.state==='verified')session.operation.state='performed';
      }else session.operation={id:operation,...(destination?{destination}:{}),state:'blocked',action:'Resolve the prerequisite checks before this reference operation.'};
      await save(session);
    }
    await runReadinessCheck(session,checks.find(check=>check.id===id),save);
  }
  const pending=unfinishedOperations(session);
  if(pending.length)session.pendingOperations=pending;else delete session.pendingOperations;
  const result=finishReadiness(session);
  if(pending.length){result.state=result.state==='failed'||pending.some(step=>step.state==='failed')?'failed':'action_required';result.expiresAt=null;}
  if(operation&&session.operation?.state!=='performed'){result.state=result.state==='failed'||session.operation?.state==='failed'?'failed':'action_required';result.expiresAt=null;}
  await save(result);
  return result;
}

export function inspectReadiness(session,now=Date.now()) {
  const expired=session.state==='verified'&&(!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=now);
  const state=expired?'stale':session.state;
  const current=id=>{const timestamp=Date.parse(session.checks[id]?.verifiedAt);return session.checks[id]?.state==='verified'&&Number.isFinite(timestamp)&&timestamp<=now&&timestamp+3600000>now&&!expired&&state!=='cancelled';};
  const pending=unfinishedOperations(session);
  return {version:session.version,recipe:session.recipe,state,ready:state==='verified'&&recipe.checks.every(current)&&!pending.length,attempt:session.attempt,capabilities:Object.fromEntries(recipe.checks.map(id=>[id,current(id)])),next:recipe.checks.filter(id=>!current(id)).map(id=>{const stale=expired||session.checks[id]?.state==='verified';return {check:id,state:stale?'stale':session.checks[id]?.state??'not_started',recovery:stale?'agent-recheck':session.checks[id]?.issue?.recovery??'agent-setup',action:stale?'The agent must recheck this capability.':session.checks[id]?.action??'Run this supported check in the authorised workspace.'};}).concat(pending.map(step=>({operation:step.id,state:step.state,recovery:step.recovery,action:'The reference operation is unfinished. Recheck its prerequisites and explicitly retry the authorised operation, or cancel this intent. No retry is automatic.'})))};
}

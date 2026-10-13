import {resolve} from 'node:path';
import {referenceTarget,finishReadiness} from './state.mjs';
import {runReadinessCheck} from './check.mjs';

export const recipe = Object.freeze({
  id:'codex-github-cloudflare-hello-v2', version:2,
  checks:['agent','github','cloudflare','https'],
  operations:{'deploy-reference':{requires:['agent','github','cloudflare'], source:'loftwah/app-composer-hello'}},
});

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
  return {version:2,recipe:recipe.id,context,state:'verifying',checks:{},startedAt:validStart?previous.startedAt:new Date().toISOString(),attempt:same&&Number.isSafeInteger(previous.attempt)&&previous.attempt>=0?previous.attempt+1:1};
}

/** @param {(session: object) => void | Promise<void>} save */
export async function runReadinessSession(session, adapter, save=()=>{}, {cancel=false,operation=null}={}) {
  if(operation!==null&&!Object.hasOwn(recipe.operations,operation))throw new Error('Unsupported readiness operation.');
  if(cancel){session.state='cancelled';session.expiresAt=null;session.updatedAt=new Date().toISOString();await save(session);return session;}
  const checks=adapter.checks;
  if(!Array.isArray(checks)||checks.length!==4||!recipe.checks.every(id=>checks.filter(check=>check.id===id&&typeof check.verify==='function').length===1))throw new Error('The adapter must supply the four supported checks exactly once.');
  for(const id of recipe.checks){
    if(id==='https'&&operation){
      const allowed=recipe.operations[operation].requires.every(required=>session.checks[required]?.state==='verified');
      if(allowed){
        if(typeof adapter.deployReference!=='function')throw new Error('This adapter does not support reference deployment.');
        const step={checks:{}};
        await runReadinessCheck(step,{id:operation,label:'Deploy the reviewed Hello reference',action:'The agent should repair the supported deployment target.',verify:adapter.deployReference},async()=>{session.operation=step.checks[operation];await save(session);});
        if(session.operation.state==='verified')session.operation.state='performed';
      }else session.operation={state:'blocked',action:'Resolve the prerequisite checks before deployment.'};
      await save(session);
    }
    await runReadinessCheck(session,checks.find(check=>check.id===id),save);
  }
  const result=finishReadiness(session);
  if(operation&&session.operation?.state!=='performed'){result.state=result.state==='failed'||session.operation?.state==='failed'?'failed':'action_required';result.expiresAt=null;}
  await save(result);
  return result;
}

export function inspectReadiness(session,now=Date.now()) {
  const expired=session.state==='verified'&&(!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=now);
  const state=expired?'stale':session.state;
  const current=id=>{const timestamp=Date.parse(session.checks[id]?.verifiedAt);return session.checks[id]?.state==='verified'&&Number.isFinite(timestamp)&&timestamp<=now&&timestamp+3600000>now&&!expired&&state!=='cancelled';};
  return {version:session.version,recipe:session.recipe,state,attempt:session.attempt,capabilities:Object.fromEntries(recipe.checks.map(id=>[id,current(id)])),next:recipe.checks.filter(id=>!current(id)).map(id=>{const stale=expired||session.checks[id]?.state==='verified';return {check:id,state:stale?'stale':session.checks[id]?.state??'not_started',recovery:stale?'agent-recheck':session.checks[id]?.issue?.recovery??'agent-setup',action:stale?'The agent must recheck this capability.':session.checks[id]?.action??'Run this supported check in the authorised workspace.'};})};
}

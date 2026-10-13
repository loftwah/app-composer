// Browser-safe inspection shared by agent consumers and the progress view.
export const recipe = Object.freeze({
  id:'codex-github-cloudflare-hello-v2', version:2,
  checks:['agent','github','cloudflare','https'],
  operations:{
    'install-workspace-tools':{before:'agent',requires:[],adapter:'installWorkspaceTools',label:'Prepare verified workspace tools',source:'cli/cli + pnpm/pnpm'},
    // Public acquisition needs the active tools and its own fresh source-read check,
    // not push permission to an unrelated parent or the maintained upstream.
    'configure-owned-reference':{before:'https',requires:['agent','github','cloudflare'],adapter:'configureOwnedReference',label:'Prepare owned Hello configuration',source:'loftwah/app-composer-hello'},
    'update-owned-reference':{before:'https',requires:['agent','github','cloudflare'],adapter:'updateOwnedReference',label:'Update the verified owned Hello reference',source:'loftwah/app-composer-hello'},
    'deploy-owned-reference':{before:'https',requires:['agent','github','cloudflare'],adapter:'deployOwnedReference',label:'Deploy a new owned Hello reference',source:'loftwah/app-composer-hello'},
    'prepare-reference-target':{before:'https',requires:['agent','cloudflare'],adapter:'prepareReferenceTarget',label:'Prepare the owned reference destination',source:'loftwah/app-composer-hello'},
    'own-reference':{before:'cloudflare',requires:['agent'],adapter:'ownReference',label:'Prepare an owned private Hello repository',source:'loftwah/app-composer-hello'},
    'clone-reference':{before:'cloudflare',requires:['agent'],adapter:'cloneReference',label:'Prepare the reviewed Hello checkout',source:'loftwah/app-composer-hello'},
    // Explicit local preparation revalidates the reviewed source in its adapter.
    // It does not need or grant upstream write permission.
    'install-reference-tools':{before:'cloudflare',requires:['agent'],adapter:'installReferenceTools',label:'Install the reviewed reference tools',source:'loftwah/app-composer-hello'},
    'deploy-reference':{before:'https',requires:['agent','github','cloudflare'],adapter:'deployReference',label:'Deploy the reviewed Hello reference',source:'loftwah/app-composer-hello'},
  },
});

// Keep unfinished intent separate from fresh check evidence. It grants no retry authority.
export function unfinishedOperations(session, carried=false) {
  if(session?.state==='cancelled')return [];
  const pending=new Map();
  for(const step of [...(session?.pendingOperations??[]),session?.operation].filter(Boolean)){
    const id=Object.hasOwn(recipe.operations,step.id??'')?step.id:Object.entries(recipe.operations).find(([,value])=>value.label===step.label)?.[0]??'reference-operation';
    if(['performed','verified'].includes(step.state)){pending.delete(id);continue;}
    const state=step.state==='failed'?'failed':'action_required';
    const recovery=carried?'agent-recheck':step.issue?.recovery??step.recovery??'agent-recheck';
    pending.set(id,{id,state,...(id==='clone-reference'&&typeof step.destination==='string'?{destination:step.destination}:{}),...(id==='own-reference'&&typeof step.repository==='string'?{repository:step.repository}:{}),recovery:['human-authentication','human-permission','agent-setup','agent-retry','agent-repair','agent-recheck'].includes(recovery)?recovery:'agent-recheck'});
  }
  return [...pending.values()];
}

export function inspectReadiness(session,now=Date.now()) {
  const expired=session.state==='verified'&&(!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=now);
  const state=expired?'stale':session.state;
  const current=id=>{const timestamp=Date.parse(session.checks[id]?.verifiedAt);return session.checks[id]?.state==='verified'&&Number.isFinite(timestamp)&&timestamp<=now&&timestamp+3600000>now&&!expired&&state!=='cancelled';};
  const pending=unfinishedOperations(session);
  const prepared=state==='action_required'&&session.operation?.state==='performed'&&['own-reference','prepare-reference-target','configure-owned-reference'].includes(session.operation.id)&&session.operation.action?[{operation:session.operation.id,state:'prepared',recovery:'agent-recheck',action:session.operation.action}]:[];
  return {version:session.version,recipe:session.recipe,state,ready:state==='verified'&&recipe.checks.every(current)&&!pending.length,attempt:session.attempt,capabilities:Object.fromEntries(recipe.checks.map(id=>[id,current(id)])),next:recipe.checks.filter(id=>!current(id)).map(id=>{const stale=expired||session.checks[id]?.state==='verified';return {check:id,state:stale?'stale':session.checks[id]?.state??'not_started',recovery:stale?'agent-recheck':session.checks[id]?.issue?.recovery??'agent-setup',action:stale?'The agent must recheck this capability.':session.checks[id]?.action??'Run this supported check in the authorised workspace.'};}).concat(pending.map(step=>({operation:step.id,state:step.state,recovery:step.recovery,action:'The reference operation is unfinished. Recheck its prerequisites and explicitly retry the authorised operation, or cancel this intent. No retry is automatic.'})),prepared)};
}

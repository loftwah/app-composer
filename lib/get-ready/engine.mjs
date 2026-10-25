import {resolve,isAbsolute} from 'node:path';
import {referenceTarget,finishReadiness} from './state.mjs';
import {runReadinessCheck} from './check.mjs';
import {validateSkillInventory,validateSkillPurpose} from './site-skills.mjs';

import {recipe,unfinishedOperations} from './inspect.mjs';
export {recipe,inspectReadiness} from './inspect.mjs';

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
  // Local edits or commits do not complete setup in the same target scope.
  // A new account/repository/target must not inherit permission to retry old work.
  if(!same&&previous?.version===2&&previous.recipe===recipe.id&&previous.context?.workspace===context.workspace){
    const sameTarget=['repo','account','worker','target'].every(key=>JSON.stringify(previous.context[key]??null)===JSON.stringify(context[key]));
    pending.push(...unfinishedOperations(previous,true).filter(step=>sameTarget||step.id==='prepare-site-skills'));
  }
  return {...(pending.length?{pendingOperations:pending}:{}),version:2,recipe:recipe.id,context,state:'verifying',checks:{},startedAt:validStart?previous.startedAt:new Date().toISOString(),attempt:same&&Number.isSafeInteger(previous.attempt)&&previous.attempt>=0?previous.attempt+1:1};
}

/** @param {(session: object) => void | Promise<void>} save */
export async function runReadinessSession(session, adapter, save=()=>{}, {cancel=false,operation=null,destination=null,repository=null,resumeOwnership=false,configuration=null,previousDeployment=null,availableSkills=null,skillPurpose=null}={}) {
  if(operation!==null&&!Object.hasOwn(recipe.operations,operation))throw new Error('Unsupported readiness operation.');
  if(operation==='prepare-site-skills'){validateSkillInventory(availableSkills);validateSkillPurpose(skillPurpose??'emdash-site');}else if(skillPurpose!==null)throw new Error('Skill purpose belongs only to explicit skill preparation.');else if(availableSkills!==null)throw new Error('A live skill inventory belongs only to explicit site skill preparation.');
  if(operation==='configure-owned-reference'){
    if(!configuration||typeof configuration!=='object'||Array.isArray(configuration)||Object.keys(configuration).length!==3||Object.keys(configuration).some(key=>!['title','intro','theme'].includes(key))||typeof configuration.title!=='string'||typeof configuration.intro!=='string'||!['midnight','daylight'].includes(configuration.theme))throw new Error('Choose only supported Hello title, introduction and theme.');
  }else if(configuration!==null)throw new Error('Only configure-owned-reference accepts configuration.');
  if(operation==='update-owned-reference'){
    if(!previousDeployment||Object.keys(previousDeployment).length!==2||!/^[a-f0-9]{40}$/.test(previousDeployment.source??'')||!/^[a-f0-9-]{36}$/.test(previousDeployment.version??''))throw new Error('Select the exact previously verified source and Worker version.');
  }else if(previousDeployment!==null)throw new Error('Only update-owned-reference accepts a previous deployment.');
  if(operation==='clone-reference'){
    if(typeof destination!=='string'||!isAbsolute(destination)||destination.includes('\0')||resolve(destination)!==destination)throw new Error('Choose an explicit absolute checkout destination.');
    const pending=unfinishedOperations(session).find(step=>step.id===operation);
    if(pending?.destination&&pending.destination!==destination)throw new Error('The unfinished clone has another destination. Inspect or cancel that intent before selecting a new one.');
  }else if(destination!==null)throw new Error('Only clone-reference accepts a checkout destination.');
  if(typeof resumeOwnership!=='boolean'||(resumeOwnership&&operation!=='own-reference'))throw new Error('Ownership completion requires an explicit own-reference operation.');
  if(operation==='own-reference'){
    if(typeof repository!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository))throw new Error('Choose an explicit personal GitHub owner/repository.');
    const pending=unfinishedOperations(session).find(step=>step.id===operation);
    if(pending?.repository&&pending.repository!==repository)throw new Error('The unfinished ownership operation has another repository. Inspect or cancel its intent first.');
  }else if(repository!==null)throw new Error('Only own-reference accepts an ownership repository.');
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
        await runReadinessCheck(step,{id:operation,label:definition.label,action:operation==='own-reference'?'Sign in to the explicitly selected personal GitHub owner account, or resolve its existing repository-creation permission, then explicitly retry. Never paste credentials into Composer.':operation==='clone-reference'?'Complete official GitHub CLI authentication for github.com or resolve access to the public maintained reference, then explicitly retry. Do not paste credentials into Composer.':'The agent should repair the supported reference setup.',setupAction:operation==='prepare-site-skills'?'Inspect the current agent skill catalogue and known scopes. This preparation supports declared EmDash 1.2.0 on Node 22.23.4+ or 24.22.1+ in an active Codex workspace; existing/custom/partial copies stay intact. No skill code executes.':operation==='install-workspace-tools'?'This preparation supports active Codex on macOS Apple Silicon with Node 22.23.4+ or 24.22.1+ and existing Git. Inspect an existing or partial workspace-tools folder before repair; it is never overwritten. Account authentication remains separate.':operation==='own-reference'?'Select a personal private repository name and the unchanged maintained Hello checkout. Existing names are refused. Inspect retained progress; explicit resume-ownership authorises completion of its selected private repository, never deletion or overwriting remote branches.':operation==='clone-reference'?'Choose an absent checkout directory with an existing parent, or an unchanged exact-main Hello checkout. Inspect any partial checkout; existing files are never overwritten.':null,verify:()=>adapter[definition.adapter](operation==='prepare-site-skills'?availableSkills:operation==='own-reference'?repository:operation==='configure-owned-reference'?configuration:operation==='update-owned-reference'?previousDeployment:destination,{resumeOwnership,...(operation==='prepare-site-skills'?{skillPurpose:skillPurpose??'emdash-site'}:{})})},async()=>{session.operation={id:operation,...(destination?{destination}:{}),...(repository?{repository}:{}),...step.checks[operation]};await save(session);});
        if(session.operation.state==='verified')session.operation.state='performed';
      }else session.operation={id:operation,...(destination?{destination}:{}),...(repository?{repository}:{}),state:'blocked',action:'Resolve the prerequisite checks before this reference operation.'};
      await save(session);
    }
    await runReadinessCheck(session,checks.find(check=>check.id===id),save);
  }
  const pending=unfinishedOperations(session);
  if(pending.length)session.pendingOperations=pending;else delete session.pendingOperations;
  const result=finishReadiness(session);
  if(pending.length){result.state=result.state==='failed'||pending.some(step=>step.state==='failed')?'failed':'action_required';result.expiresAt=null;}
  if(operation&&session.operation?.state!=='performed'){result.state=result.state==='failed'||session.operation?.state==='failed'?'failed':'action_required';result.expiresAt=null;}
  if(['own-reference','prepare-reference-target'].includes(operation)&&session.operation?.state==='performed'){result.state='action_required';result.expiresAt=null;result.operation.action=operation==='prepare-reference-target'?'Review the local deployment configuration, commit/push it and complete a separately authorised initial deployment. The Worker name is not reserved and no cloud resource was created.':'Recheck the workspace under its new GitHub origin. Source ownership does not configure a deployment target.';}
  if(operation==='prepare-site-skills'&&session.operation?.state==='performed'){result.state='action_required';result.expiresAt=null;result.operation.action='Inspect preserved copies and confirm the selected agent discovers and exercises the relevant skill. Prepared files and a caller inventory do not establish installed EmDash, agent visibility or deployment readiness.';}
  if(operation==='configure-owned-reference'&&session.operation?.state==='performed'&&session.operation.evidence.changed){result.state='action_required';result.expiresAt=null;result.operation.action='Review and commit/push the prepared config.json, then explicitly update the previously verified owned source/version. Local configuration is not a deployment.';}
  await save(result);
  return result;
}

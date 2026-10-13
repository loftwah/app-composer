import {recipe,inspectReadiness} from './inspect.mjs';

export const progressChecks=Object.freeze({
 agent:{label:'Agent and tools',help:'Git, GitHub CLI, pnpm and the active coding-agent workspace.'},
 github:{label:'GitHub workspace',help:'The actual repository, source and required access.'},
 cloudflare:{label:'Cloudflare connection',help:'The selected account and deployment tools.'},
 https:{label:'Live HTTPS app',help:'The intended app, exact source and selected address.'},
});
export const progressOperationLabels=Object.freeze({...Object.fromEntries(Object.entries(recipe.operations).map(([id,operation])=>[id,operation.label])),'reference-operation':'Earlier reference setup'});
const states=['verified','action_required','failed','verifying','cancelled','not_started'];
const recoveries=['human-authentication','human-permission','agent-setup','agent-retry','agent-repair','agent-recheck'];
const tools=['git','gh','pnpm','agent'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const time=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value));
const fail=()=>{throw Error('Use a redacted Get Ready progress report from the current agent command. Private receipts and unrelated files are not supported.');};

// A report is display data, never proof or authority to execute an operation.
export function validateReadinessReport(input,now=Date.now()){
 if(!exact(input,['schema','version','recipe','exportedAt','state','expiresAt','checks','operations'])||input.schema!=='app-composer.readiness-report'||input.version!==1||input.recipe!==recipe.id||!time(input.exportedAt)||Date.parse(input.exportedAt)>now+300000||!states.includes(input.state)||!Array.isArray(input.checks)||input.checks.length!==recipe.checks.length||!Array.isArray(input.operations)||input.operations.length>Object.keys(progressOperationLabels).length)fail();
 if(input.state==='verified'? !time(input.expiresAt)||Date.parse(input.expiresAt)>Date.parse(input.exportedAt)+3600000 : input.expiresAt!==null)fail();
 const seen=new Set();
 const checks=input.checks.map(check=>{
  if(!exact(check,['id','state','verifiedAt','recovery','tools'])||!recipe.checks.includes(check.id)||seen.has(check.id)||!states.includes(check.state)||!Array.isArray(check.tools)||check.tools.length>4)fail();
  seen.add(check.id);
  if(check.state==='verified'? !time(check.verifiedAt)||Date.parse(check.verifiedAt)>Date.parse(input.exportedAt)||check.recovery!==null||check.tools.length!==0 : check.verifiedAt!==null||!recoveries.includes(check.recovery))fail();
  const selected=new Set();
  const cleanTools=check.tools.map(tool=>{
   if((tool.tool==='agent'&&check.id!=='agent')||!exact(tool,['tool','state'])||!tools.includes(tool.tool)||selected.has(tool.tool)||(tool.tool==='agent'?tool.state!=='inactive':!['missing','broken'].includes(tool.state)))fail();
   selected.add(tool.tool);return {tool:tool.tool,state:tool.state};
  });
  return {id:check.id,state:check.state,verifiedAt:check.verifiedAt,recovery:check.recovery,tools:cleanTools};
 });
 if(input.state==='verified'&&checks.some(check=>check.state!=='verified'))fail();
 const operationIds=new Set();
 const operations=input.operations.map(operation=>{
  if(!exact(operation,['id','state','recovery'])||!Object.hasOwn(progressOperationLabels,operation.id)||operationIds.has(operation.id)||!['action_required','failed','prepared'].includes(operation.state)||!recoveries.includes(operation.recovery))fail();
  operationIds.add(operation.id);return {id:operation.id,state:operation.state,recovery:operation.recovery};
 });
 return {schema:input.schema,version:1,recipe:input.recipe,exportedAt:input.exportedAt,state:input.state,expiresAt:input.expiresAt,checks:recipe.checks.map(id=>checks.find(check=>check.id===id)),operations};
}

export function readinessReport(session,now=Date.now()){
 const inspected=inspectReadiness(session,now);
 const checks=recipe.checks.map(id=>{
  const check=session.checks[id];
  const verified=check?.state==='verified';
  return {id,state:check?.state??'not_started',verifiedAt:verified?check.verifiedAt:null,recovery:verified?null:check?.issue?.recovery??'agent-setup',tools:verified?[]:(check?.issue?.tools??[]).map(tool=>({tool:tool.tool,state:tool.state}))};
 });
 const operations=inspected.next.filter(step=>step.operation).map(step=>({id:step.operation,state:step.state,recovery:step.recovery}));
 return validateReadinessReport({schema:'app-composer.readiness-report',version:1,recipe:session.recipe,exportedAt:new Date(now).toISOString(),state:session.state,expiresAt:session.expiresAt??null,checks,operations},now);
}

export function inspectReadinessReport(input,now=Date.now()){
 const report=validateReadinessReport(input,now);
 // The same inspector handles expiry and independent capability freshness.
 const inspected=inspectReadiness({version:2,recipe:report.recipe,state:report.state,expiresAt:report.expiresAt,checks:Object.fromEntries(report.checks.map(check=>[check.id,{state:check.state,verifiedAt:check.verifiedAt,issue:{recovery:check.recovery}}])),pendingOperations:report.operations},now);
 return {report,inspection:inspected};
}

export function progressStep(check,current){
 if(current)return progressChecks[check.id]?.help??'Verified in this agent report.';
 if(check.state==='verified')return 'This saved result is not current. Ask your agent to check this step again.';
 if(check.recovery==='human-authentication')return 'Complete sign-in in the official account screen, then ask your agent to recheck.';
 if(check.recovery==='human-permission')return 'Have your agent explain the required access. You approve any expanded permission.';
 if(check.recovery==='agent-retry')return 'The agent should retry the check after the service recovers. Another login is not established.';
 if(check.recovery==='agent-repair')return 'The agent should inspect and repair this check. No new human permission is established.';
 if(check.recovery==='agent-recheck')return 'Ask your agent to check the current environment before another setup attempt.';
 return 'The agent should prepare the missing pieces, then check this step again.';
}

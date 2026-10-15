import {McpServer} from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {runLocalReadiness,readinessReport,inspectReadinessReport,referenceTarget,diagnoseDomain,inspectDomainReport,inspectProject} from '../get-ready/index.mjs';
import {resolve,isAbsolute} from 'node:path';
import {domainName} from '../get-ready/domain-report.mjs';
import {validateSkillInventory,validateSkillPurpose} from '../get-ready/site-skills.mjs';

export function launchScope(args){
 const flags=new Map(),allowed=['--workspace','--account','--reference-worker','--reference-url','--reference-repo','--tools-workspace','--domain','--project-purpose','--reference-destination','--available-skills','--skill-purpose'];
 for(let i=0;i<args.length;i++){
  if(['--allow-workspace-tool-setup','--allow-site-skill-setup','--allow-reference-tool-setup'].includes(args[i])){if(flags.has(args[i]))throw Error('Do not repeat host capabilities.');flags.set(args[i],true);continue;}
  const flag=args[i];if(!allowed.includes(flag)||flags.has(flag)||typeof args[i+1]!=='string'||!args[i+1]||args[i+1].startsWith('--'))throw Error('Use an explicit local workspace and supported target flags. Setup operations and credentials are not launch arguments.');
  flags.set(flag,args[++i]);
 }
 if(!flags.has('--workspace')||!isAbsolute(flags.get('--workspace'))||flags.get('--workspace').includes('\0'))throw Error('Choose an explicit absolute trusted workspace at launch.');
 if(flags.has('--reference-url')!==flags.has('--reference-repo'))throw Error('Select both the reference origin and repository.');
 const account=flags.get('--account')??null,worker=flags.get('--reference-worker')??null;
 if(account!==null&&!/^[a-f0-9]{32}$/.test(account))throw Error('Select the exact Cloudflare account at launch.');
 if(worker!==null&&!/^[a-z][a-z0-9-]{0,62}$/.test(worker))throw Error('Select the reference Worker at launch.');
 if(flags.has('--domain')&&!account)throw Error('Domain diagnosis requires an explicit selected account.');
 const projectPurpose=flags.get('--project-purpose');if(projectPurpose&&!['auto','emdash-site','emdash-plugin'].includes(projectPurpose))throw Error('Select a supported project inspection purpose.');
 const domain=flags.has('--domain')?domainName(flags.get('--domain')):null;
 const tools=flags.get('--tools-workspace');if(tools&&(!isAbsolute(tools)||tools.includes('\0')))throw Error('Select an absolute prepared tool workspace.');
 const destination=flags.get('--reference-destination');if(destination&&(!isAbsolute(destination)||destination.includes('\0')||resolve(destination)!==destination))throw Error('Select a normalized absolute reference destination.');
 if(flags.has('--allow-site-skill-setup')!==flags.has('--available-skills'))throw Error('Site skill preparation requires both host consent and its current inventory.');
 if(flags.has('--skill-purpose')&&!flags.has('--allow-site-skill-setup'))throw Error('Skill purpose requires explicit host preparation consent.');
 const skillPurpose=flags.has('--skill-purpose')?validateSkillPurpose(flags.get('--skill-purpose')):null;
 const availableSkills=flags.has('--available-skills')?Object.freeze(validateSkillInventory(flags.get('--available-skills')==='none'?[]:flags.get('--available-skills').split(','))):null;
 const target=flags.has('--reference-url')?Object.freeze(referenceTarget(flags.get('--reference-url'),flags.get('--reference-repo'))):null;
 return Object.freeze({workspace:resolve(flags.get('--workspace')),account,worker,target,...(projectPurpose?{projectPurpose}:{}),...(domain?{domain}:{}),...(tools?{toolsWorkspace:resolve(tools)}:{}),...(flags.has('--allow-workspace-tool-setup')?{allowWorkspaceToolSetup:true}:{}),...(flags.has('--allow-reference-tool-setup')?{allowReferenceToolSetup:true}:{}),...(destination?{referenceDestination:destination}:{}),...(availableSkills?{allowSiteSkillSetup:true,availableSkills,...(skillPurpose?{skillPurpose}:{})}:{})});
}

export function mcpEnvironment(env){
 const keys=['PATH','HOME','TMPDIR','LANG','LC_ALL','XDG_CONFIG_HOME','GH_CONFIG_DIR','GH_TOKEN','GITHUB_TOKEN','CODEX_THREAD_ID','CODEX_MANAGED_BY_NPM','CODEX_HOME','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID'];
 return Object.freeze(Object.fromEntries(keys.filter(key=>env[key]!==undefined).map(key=>[key,env[key]])));
}
const result=value=>({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
const refusal=text=>({content:[{type:'text',text}],isError:true});

export function createReadinessMcp(scope,{env=process.env,check=runLocalReadiness,domainCheck=diagnoseDomain,projectCheck=inspectProject,now=Date.now}={}){
 // Normalize even programmatic host input. Models never choose or change this scope.
 const keys=['workspace','account','worker','target','toolsWorkspace','domain','projectPurpose','allowWorkspaceToolSetup','allowReferenceToolSetup','referenceDestination','allowSiteSkillSetup','availableSkills','skillPurpose'];
 if(!scope||Object.keys(scope).some(key=>!keys.includes(key)))throw Error('Unsupported MCP host scope.');
 if(scope.allowSiteSkillSetup!==undefined&&typeof scope.allowSiteSkillSetup!=='boolean')throw Error('Select a boolean host capability.');
 if(Boolean(scope.allowSiteSkillSetup)!==Object.hasOwn(scope,'availableSkills'))throw Error('Site skill preparation requires host consent and a current inventory.');
 if(scope.allowSiteSkillSetup)validateSkillInventory(scope.availableSkills);
 if(scope.allowReferenceToolSetup!==undefined&&typeof scope.allowReferenceToolSetup!=='boolean')throw Error('Select a boolean host capability.');
 if(scope.allowWorkspaceToolSetup!==undefined&&typeof scope.allowWorkspaceToolSetup!=='boolean')throw Error('Select a boolean host capability.');
 if(Object.hasOwn(scope,'skillPurpose')){if(!scope.allowSiteSkillSetup)throw Error('Skill purpose requires explicit host consent.');validateSkillPurpose(scope.skillPurpose);}
 for(const key of ['account','worker','toolsWorkspace','domain','projectPurpose','referenceDestination'])if(scope[key]!=null&&(typeof scope[key]!=='string'||!scope[key]))throw Error('Select an explicit MCP host scope.');
 if(scope.target!=null&&(typeof scope.target!=='object'||Array.isArray(scope.target)||Object.keys(scope.target).length!==2||Object.keys(scope.target).some(key=>!['origin','repo'].includes(key))))throw Error('Select only a reference origin and repository.');
 const fixed=launchScope(['--workspace',scope.workspace,...(scope.account?['--account',scope.account]:[]),...(scope.worker?['--reference-worker',scope.worker]:[]),...(scope.target?['--reference-url',scope.target.origin,'--reference-repo',scope.target.repo]:[]),...(scope.toolsWorkspace?['--tools-workspace',scope.toolsWorkspace]:[]),...(scope.domain?['--domain',scope.domain]:[]),...(scope.projectPurpose?['--project-purpose',scope.projectPurpose]:[]),...(scope.allowWorkspaceToolSetup?['--allow-workspace-tool-setup']:[]),...(scope.allowReferenceToolSetup?['--allow-reference-tool-setup']:[]),...(scope.referenceDestination?['--reference-destination',scope.referenceDestination]:[]),...(scope.skillPurpose?['--skill-purpose',scope.skillPurpose]:[]),...(scope.allowSiteSkillSetup?['--allow-site-skill-setup','--available-skills',scope.availableSkills.length?scope.availableSkills.join(','):'none']:[])]);
 const {domain:fixedDomain,projectPurpose,allowWorkspaceToolSetup,allowReferenceToolSetup,referenceDestination,allowSiteSkillSetup,availableSkills,skillPurpose,...readinessScope}=fixed;
 const runtime=mcpEnvironment(env);let last=null,running=false,preparedTools=false;
 const server=new McpServer({name:'app-composer-get-ready',version:'1.9.0'});
 const empty=z.object({}).strict();
 const run=operation=>async(_input,context)=>{
  if(running)return refusal('A readiness check is already running. Inspect the last completed result or wait; no extra check was started.');
  running=true;
  let cancelled=context.mcpReq.signal.aborted;
  const cancel=()=>{cancelled=true;last=null;};
  context.mcpReq.signal.addEventListener('abort',cancel,{once:true});
  try{
   if(cancelled){last=null;return refusal('The MCP request was cancelled. No new check was started.');}
   const session=await check({...readinessScope,...(preparedTools&&!readinessScope.toolsWorkspace?{useWorkspaceTools:true}:{}),operation,...(operation==='clone-reference'?{destination:referenceDestination}:{}),...(operation==='prepare-site-skills'?{availableSkills:[...availableSkills],skillPurpose:skillPurpose??'emdash-site'}:{})},runtime);
   if(cancelled)return refusal('The MCP request was cancelled. Its bounded local check may have saved private progress, but no completed report is retained here. No retry was started.');
   if(operation==='install-workspace-tools'&&session.operation?.state==='performed'&&session.operation.evidence?.scope==='workspace'&&typeof session.operation.evidence.changed==='boolean')preparedTools=true;
   last=readinessReport(session,now());
   const evidence=session.operation?.evidence,performed=session.operation?.state==='performed';
   // Completed operations intentionally do not enter the shared unfinished-work
   // report. Return only this explicit call's bounded result alongside that report.
   const preparation=operation?{preparation:{operation,state:['performed','failed','action_required','blocked'].includes(session.operation?.state)?session.operation.state:'incomplete',...(operation==='install-workspace-tools'&&performed&&typeof evidence?.changed==='boolean'&&['workspace','existing'].includes(evidence.scope)?{changed:evidence.changed,scope:evidence.scope}:{}),...(operation==='install-reference-tools'&&performed&&typeof evidence?.changed==='boolean'&&evidence.wrangler==='4.143.1'&&['12.8.1','12.9.1'].includes(evidence.pnpm)?{changed:evidence.changed,wrangler:evidence.wrangler,pnpm:evidence.pnpm}:{}),...(operation==='prepare-site-skills'&&performed&&typeof evidence?.changed==='boolean'&&/^[a-f0-9]{40}$/.test(evidence.source?.commit??'')?{changed:evidence.changed,source:evidence.source.commit,...(['emdash-site','emdash-plugin'].includes(evidence.purpose)?{purpose:evidence.purpose}:{})}:{}),...(operation==='clone-reference'&&performed&&typeof evidence?.changed==='boolean'&&/^[a-f0-9]{40}$/.test(evidence.commit??'')?{changed:evidence.changed,source:evidence.commit}:{})}}:{};
   return result({...inspectReadinessReport(last,now()),...preparation});
  }catch{last=null;return refusal(operation==='install-reference-tools'?'Reference tool preparation could not finish. Inspect the selected clean exact-main maintained Hello checkout or supported unchanged private owned copy, active Codex/Mac/Node22 tools and retained work privately. No automatic retry, source overwrite, account change or deployment was started.':operation==='prepare-site-skills'?'Site skill preparation could not finish. Inspect the host-selected project root, declared EmDash version, active Codex/Node22 tools, current inventory and retained work privately. Existing instructions and partial copies are preserved. No automatic retry or discovery certification was started.':operation==='clone-reference'?'Reference acquisition could not finish. Inspect the host-selected destination and retained private progress; existing and partial work is preserved. The host must separately choose any new destination. No automatic retry was started.':operation?'Local tool preparation could not finish. Select the actual repository root or a folder outside Git; inspect the supported Codex/Mac/Node22/Git runtime and retained private progress before a separate retry. No automatic retry was started. Retained work stays for inspection.':'The local check could not finish. The host should inspect its workspace, receipt and selected tools privately. No credential, permission or successful readiness is established.');}
  finally{context.mcpReq.signal.removeEventListener('abort',cancel);running=false;}
 };
 server.registerTool('get_ready_check',{
  title:'Recheck the selected environment',description:'Run the shared Get Ready doctor only in the trusted workspace/account/HTTPS target selected by the host at launch. Saves a private receipt and returns a redacted dated report. Does not install, authenticate, create a repository, change DNS, deploy or retry setup. Missing target selection remains action-required. No arguments are accepted.',
  inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },run(null));
 if(allowWorkspaceToolSetup)server.registerTool('get_ready_prepare_tools',{
  title:'Prepare tools in the selected workspace',description:'Explicitly invoke the existing install-workspace-tools engine operation after the trusted host enables this capability. Supports active Codex on Apple Silicon macOS, Node22 and existing Git. Downloads only the fixed pinned GitHub CLI/pnpm distributions when needed, verifies them and writes private workspace tools/progress. Existing/partial copies are preserved. Rechecks the environment; preparation alone is not readiness. No global/profile edits, sign-in, repository creation, DNS, cloud resources or deployment. Cancellation may leave completed/partial work for inspection; ordinary check never retries setup. Reuses a successfully prepared pair on this connection; a reconnect needs host-selected --tools-workspace or a separate explicit preparation call. No model-selected scope, package, version or arguments.',
  inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },run('install-workspace-tools'));
 if(allowReferenceToolSetup)server.registerTool('get_ready_prepare_reference_tools',{
  title:'Prepare the reviewed Hello dependencies',description:'Explicitly invoke the existing install-reference-tools engine operation only after the trusted host enables it for the selected workspace. Supports clean exact-main maintained Hello or its verified unchanged private owned copy, active Codex on Apple Silicon macOS, Node22 and pinned pnpm12.8.1/12.9.1. Freshly verifies GitHub source and committed package/lockfile bytes. Installs only reviewed frozen dependencies when needed, with lifecycle scripts/hooks disabled, isolated registry configuration and service credentials excluded. Repeats verify existing tools; ordinary check never retries installation. Existing authored files and partial work remain for inspection. No global/profile changes, GitHub ownership, authentication, DNS, cloud resources or deployment. Completion is separate from readiness; acquisition alone grants no upstream push permission. No model-selected package, version, path, scope or arguments.',
  inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },run('install-reference-tools'));
 if(allowSiteSkillSetup)server.registerTool('get_ready_prepare_site_skills',{
  title:'Prepare missing EmDash project guidance',description:'Explicitly invoke the shared prepare-site-skills operation only after the trusted host authorises it and supplies its current skill inventory. Supports an exact declared EmDash1.2.0, active Codex/Node22 and the actual selected project root. Prepares only missing pinned official guidance for the host-selected skill purpose: site-building/CLI by default, or plugin-authoring/CLI only with explicit emdash-plugin selection. Inspection purpose alone grants no preparation authority. Includes complete trees with their references and MIT licence. Existing project, ancestor, user and advertised plugin copies stay intact. No remote installer, project execution, global edit, account connection, cloud change or deployment. Prepared files remain action-required: verify discovery in a fresh selected agent task and relevant read-only use separately. Ordinary check never retries preparation; cancellation can leave work for inspection. No model-selected inventory, path, source, version or arguments.',
  inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },run('prepare-site-skills'));
 if(referenceDestination)server.registerTool('get_ready_clone_reference',{
  title:'Fetch the maintained Hello starter',description:'Explicitly invoke the shared clone-reference operation at the absolute destination fixed by the trusted host at launch. Requires the active supported agent tools and a fresh GitHub source read. Acquires only the maintained public Hello main through credential-isolated Git; verifies exact source and clean checkout. An absent destination with an existing parent or unchanged exact-main checkout is supported. Existing/custom/partial copies remain intact; inspect before separately retrying. No dependency install, project code execution, repository ownership, cloud resource or deployment. Ordinary check never retries acquisition. The current connection stays in its original workspace; the host separately selects the checkout and any prepared tools for subsequent checks. No model-selected destination, source, version or arguments.',
  inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },run('clone-reference'));
 server.registerTool('get_ready_inspect',{
  title:'Inspect the last completed check',description:'Inspect this MCP connection’s last completed redacted report using the shared engine’s freshness and unfinished-operation rules. Makes no provider calls and does not read another file or workspace. Before the first check, returns no saved result. A report grants no setup or deployment authority.',
  inputSchema:empty,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async()=>last?result({...inspectReadinessReport(last,now()),checking:running}):result({report:null,checking:running,message:'No completed report is available on this connection. Call get_ready_check to recheck the host-selected environment.'}));
 if(fixedDomain)server.registerTool('get_ready_domain',{
  title:'Inspect the selected domain',description:'Read-only Cloudflare zone, nameserver and DNSSEC/DS diagnosis for the domain/account fixed by the trusted host at launch. Returns a dated portable domain report. No workspace writes, DNS edits, sign-in, deployment or automatic retry. Resolver observations do not prove worldwide propagation or HTTPS. No arguments are accepted.',
  inputSchema:empty,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true},
 },async(_input,context)=>{
  if(running)return refusal('A readiness check is already running. No additional domain check was started.');
  running=true;let cancelled=context.mcpReq.signal.aborted;const cancel=()=>{cancelled=true;};context.mcpReq.signal.addEventListener('abort',cancel,{once:true});
  try{
   if(cancelled)return refusal('The domain request was cancelled. No check was started.');
   const value=await domainCheck({account:fixed.account,domain:fixedDomain},runtime);
   if(cancelled)return refusal('The domain request was cancelled. Its bounded provider reads may finish, but no result is retained or retry started.');
   const {report,...inspection}=inspectDomainReport(value,now());return result({report,inspection});
  }catch{return refusal('The domain check could not finish. Inspect the host-selected account and authorised connection privately. No DNS or workspace was changed.');}
  finally{context.mcpReq.signal.removeEventListener('abort',cancel);running=false;}
 });
 if(projectPurpose)server.registerTool('get_ready_project',{
  title:'Inspect the selected project guidance',description:'Read only bounded selected-project manifest/lockfile/guidance metadata and canonical EmDash skill entrypoints. Purpose and workspace are fixed by the host. Preserves every file, custom copy and readiness receipt. Does not execute project code, Git configuration, installers, documentation servers or compilers; file presence does not establish agent visibility, use or readiness. No arguments are accepted.',
  inputSchema:empty,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
 },async(_input,context)=>{
  if(running)return refusal('A check is already running. No project inspection was started.');running=true;
  try{if(context.mcpReq.signal.aborted)return refusal('The project request was cancelled.');const report=await Promise.resolve(projectCheck({workspace:fixed.workspace,purpose:projectPurpose}));if(context.mcpReq.signal.aborted)return refusal('The project request was cancelled; no result is retained.');return result({report});}
  catch{return refusal('Project inspection could not finish. Inspect the selected path and file/access condition privately. No files, skills, permissions or readiness state were changed.');}
  finally{running=false;}
 });
 return server;
}

#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {discoverWorkspace,referenceTarget,runLocalReadiness,readinessReport,progressWorkspace,diagnoseDomain,inspectDomainReport,inspectProject,ReadinessFailure} from './index.mjs';

const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--help'){
 console.log(`Get Ready — the shared App Composer environment engine.
Usage: get-ready --workspace ABSOLUTE_PATH [--report]
Check a selected environment; private progress stays in that workspace.
Select a target with --account ID --reference-worker NAME --reference-url HTTPS_ORIGIN --reference-repo OWNER/REPO.
Setup requires a separate explicit operation. See the bundled README and https://composer.loftwah.com/docs#standalone-get-ready.
Supported local adapter: active Codex, Apple Silicon macOS, Node 22; account authentication stays with your tools.
--inspect-domain DOMAIN --account ID runs a separate read-only DNS diagnosis and exports a portable domain report; add --workspace ABSOLUTE_PATH to reuse its existing pinned Wrangler sign-in. No readiness receipt is opened.\n--inspect-project ABSOLUTE_PATH [--purpose auto|emdash-site|emdash-plugin] [--diagrams] reads selected project metadata without setup or readiness writes.\n--prepare-site-skills --available-skills none|ID,ID prepares missing reviewed project skills after the agent inspects its current catalogue; existing copies are preserved. Use --skill-purpose emdash-plugin for plugin/CLI guidance in a supported EmDash project; the default remains emdash-site.\n--report exports redacted JSON. --cancel cancels saved intent without deleting infrastructure.`);
 process.exit(0);
}
// Project inspection reads fixed metadata only and never opens a readiness receipt.
if(args.includes('--inspect-project')){
 try{
  const flags=new Map();for(let i=0;i<args.length;i++){const key=args[i];if(!['--inspect-project','--purpose','--diagrams'].includes(key)||flags.has(key))throw Error();if(key==='--diagrams'){flags.set(key,true);continue;}if(!args[i+1]||args[i+1].startsWith('--'))throw Error();flags.set(key,args[++i]);}
  console.log(JSON.stringify(inspectProject({workspace:flags.get('--inspect-project'),purpose:flags.get('--purpose')??'auto',diagrams:flags.has('--diagrams')}),null,2));
 }catch{process.stderr.write('Project inspection did not finish. Choose one existing project and supported purpose; no files, skills or permissions were changed.\n');process.exitCode=1;}
}else
// This diagnostic mode never opens or changes a readiness receipt.
if(args.includes('--inspect-domain')){
 const selected=new Map();
 try{
  for(let i=0;i<args.length;i++){const key=args[i];if(!['--inspect-domain','--account','--workspace'].includes(key)||selected.has(key)||!args[i+1]||args[i+1].startsWith('--'))throw new ReadinessFailure('configuration');selected.set(key,args[++i]);}
  const report=await diagnoseDomain({domain:selected.get('--inspect-domain'),account:selected.get('--account'),...(selected.has('--workspace')?{workspace:selected.get('--workspace')}:{})});
  console.log(JSON.stringify(report,null,2));if(!inspectDomainReport(report).dnsReady)process.exitCode=1;
 }catch(error){const code=error instanceof ReadinessFailure?error.code:'configuration';process.stderr.write('Domain diagnosis did not finish ('+code+'). Choose an exact domain/account and inspect the authorised Cloudflare connection privately. No DNS, account or workspace was changed.\n');process.exitCode=1;}
}else{
const flags=new Map();
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(flags.has(flag))throw new Error("Do not repeat readiness flags.");
 if(['--install-workspace-tools','--use-workspace-tools','--report','--cancel','--publish-proof','--deploy-reference','--install-reference-tools','--resume-ownership','--prepare-reference-target','--deploy-owned-reference','--update-owned-reference','--prepare-site-skills'].includes(flag)){flags.set(flag,true);continue;}
 if(!['--tools-workspace','--workspace','--reference-url','--reference-repo','--reference-worker','--account','--clone-reference','--own-reference','--previous-source','--previous-version','--available-skills','--skill-purpose'].includes(flag)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --workspace PATH, --reference-url HTTPS_ORIGIN and --reference-repo OWNER/REPO. Optional: --install-workspace-tools, --use-workspace-tools or --tools-workspace PATH, --report for a redacted JSON progress export, --cancel, --publish-proof, --own-reference OWNER/NAME, --clone-reference PATH, --install-reference-tools, --prepare-reference-target, --deploy-owned-reference, --deploy-reference, or --update-owned-reference with --previous-source and --previous-version.');
 flags.set(flag,args[++i]);
}
if(flags.has('--clone-reference')&&(!flags.has('--workspace')||['--deploy-reference','--deploy-owned-reference','--update-owned-reference','--install-reference-tools','--prepare-reference-target','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Cloning requires an explicit authorised Codex folder and a separate destination; it cannot be combined with installation, deployment, publication or cancellation.');
if(flags.has('--own-reference')&&(!flags.has('--workspace')||['--clone-reference','--deploy-reference','--deploy-owned-reference','--update-owned-reference','--install-reference-tools','--prepare-reference-target','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Ownership requires an explicit reviewed Hello workspace and personal private repository name; it cannot combine with another operation.');
if(flags.has('--resume-ownership')&&!flags.has('--own-reference'))throw new Error('--resume-ownership requires --own-reference and explicitly authorises completion of that selected existing private repository.');
if((flags.has('--install-workspace-tools')||flags.has('--use-workspace-tools')||flags.has('--tools-workspace'))&&!flags.has('--workspace'))throw new Error('Workspace tools require an explicit authorised --workspace.');
if(flags.has('--install-workspace-tools')&&['--tools-workspace','--use-workspace-tools','--clone-reference','--own-reference','--deploy-reference','--deploy-owned-reference','--update-owned-reference','--install-reference-tools','--prepare-reference-target','--cancel','--publish-proof'].some(flag=>flags.has(flag)))throw new Error('Prepare workspace tools separately from another operation; subsequent commands explicitly use --use-workspace-tools.');
if(flags.has('--tools-workspace')&&flags.has('--use-workspace-tools'))throw new Error('Select only one prepared tool workspace.');
if(flags.has('--prepare-site-skills')&&(!flags.has('--workspace')||!flags.has('--available-skills')||['--install-workspace-tools','--clone-reference','--own-reference','--deploy-reference','--deploy-owned-reference','--update-owned-reference','--install-reference-tools','--prepare-reference-target','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Prepare site skills separately, with an explicit workspace and the current agent catalogue --available-skills none or comma-separated canonical EmDash IDs.');
if(flags.has('--skill-purpose')&&(!flags.has('--prepare-site-skills')||!['emdash-site','emdash-plugin'].includes(flags.get('--skill-purpose'))))throw new Error('Select emdash-site or emdash-plugin only with explicit skill preparation.');
if(flags.has('--available-skills')&&!flags.has('--prepare-site-skills'))throw new Error('A live skill inventory belongs only to explicit site skill preparation.');
const cwd=resolve(flags.get('--workspace')||process.cwd());
const discovered=discoverWorkspace(cwd);
const operator=discovered.repo==='loftwah/app-composer';
if(flags.has('--reference-url')!==flags.has('--reference-repo'))throw new Error('Provide both reference URL and repository.');
const target=flags.has('--reference-url')?referenceTarget(flags.get('--reference-url'),flags.get('--reference-repo')):operator?referenceTarget('https://ready.loftwah.com','loftwah/app-composer-hello'):null;
let config={};try{config=JSON.parse(readFileSync(resolve(discovered.workspace,'wrangler.jsonc'),'utf8'));}catch{}
const account=flags.get('--account')||config.account_id||null;
const worker=flags.get('--reference-worker')||(operator?'composer-hello':null);
if(flags.has('--previous-source')!==flags.has('--previous-version')||((flags.has('--previous-source')||flags.has('--previous-version'))&&!flags.has('--update-owned-reference')))throw new Error('Previous source/version belong only to an explicit owned update.');
if(flags.has('--update-owned-reference')&&(!flags.has('--workspace')||!flags.has('--account')||!flags.has('--reference-worker')||!flags.has('--reference-url')||!flags.has('--reference-repo')||!flags.has('--previous-source')||!flags.has('--previous-version')||['--deploy-reference','--deploy-owned-reference','--prepare-reference-target','--install-reference-tools','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Owned update requires full target scope and explicit previous source/version, separately from another operation.');
if(flags.has('--deploy-owned-reference')&&(!flags.has('--workspace')||!flags.has('--account')||!flags.has('--reference-worker')||!flags.has('--reference-url')||!flags.has('--reference-repo')||['--deploy-reference','--update-owned-reference','--prepare-reference-target','--install-reference-tools','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Initial owned deployment requires explicit workspace/account/Worker/origin/repository, separately from other operations.');
if(flags.has('--prepare-reference-target')&&(!flags.has('--workspace')||!flags.has('--account')||!flags.has('--reference-worker')||!flags.has('--reference-url')||!flags.has('--reference-repo')||['--deploy-reference','--deploy-owned-reference','--update-owned-reference','--install-reference-tools','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Destination preparation requires an explicit owned workspace, account, Worker, HTTPS origin and repository, separately from another operation.');
if(flags.has('--install-reference-tools')&&(!flags.has('--workspace')||flags.has('--deploy-reference')||flags.has('--cancel')))throw new Error('Tool installation requires an explicit authorised Hello workspace and cannot be combined with deployment or cancellation.');
if(flags.has('--deploy-reference')&&(!flags.has('--workspace')||!flags.has('--account')||!flags.has('--reference-url')||!flags.has('--reference-repo')||!flags.has('--reference-worker')||flags.has('--cancel')))throw new Error('Reference deployment requires an explicit authorised workspace, account, Worker, HTTPS origin and repository; cancellation cannot deploy.');
const state=await runLocalReadiness({workspace:cwd,target,account,worker,cancel:flags.has('--cancel'),useWorkspaceTools:flags.has('--use-workspace-tools'),...(flags.has('--tools-workspace')?{toolsWorkspace:resolve(flags.get('--tools-workspace'))}:{}),skillPurpose:flags.get('--skill-purpose')??null,availableSkills:flags.has('--available-skills')?(flags.get('--available-skills')==='none'?[]:flags.get('--available-skills').split(',')):null,operation:flags.has('--prepare-site-skills')?'prepare-site-skills':flags.has('--install-workspace-tools')?'install-workspace-tools':flags.has('--update-owned-reference')?'update-owned-reference':flags.has('--deploy-owned-reference')?'deploy-owned-reference':flags.has('--prepare-reference-target')?'prepare-reference-target':flags.has('--own-reference')?'own-reference':flags.has('--clone-reference')?'clone-reference':flags.has('--deploy-reference')?'deploy-reference':flags.has('--install-reference-tools')?'install-reference-tools':null,destination:flags.has('--clone-reference')?resolve(flags.get('--clone-reference')):null,repository:flags.get('--own-reference')??null,resumeOwnership:flags.has('--resume-ownership'),previousDeployment:flags.has('--update-owned-reference')?{source:flags.get('--previous-source'),version:flags.get('--previous-version')}:null});
if(flags.has('--publish-proof')){
 if(!operator||target?.origin!=='https://ready.loftwah.com'||state.state!=='verified')throw new Error('Only the verified launch environment may replace the public operator proof.');
 const proof={reviewed:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Australia/Melbourne'}).format(new Date()),url:target.origin,commit:state.checks.https.evidence.commit,checks:[{label:'Actual Codex workspace',status:'Verified',detail:'Git and authenticated GitHub push access checked in this agent workspace.'},{label:'Cloudflare deployment tools',status:'Verified',detail:'Authenticated Wrangler verified. No browser credentials assumed.'},{label:'Custom domain and HTTPS',status:'Verified',detail:'Selected hostname returned the exact reference source commit.'}]};
 writeFileSync(resolve(discovered.workspace,'src/lib/readiness.json'),JSON.stringify(proof,null,2)+'\n');
}
if(flags.has('--report'))console.log(JSON.stringify(readinessReport(state),null,2));
else{
console.log(progressWorkspace(readinessReport(state)));
console.log('Readiness: '+state.state+'. Private workspace receipt saved; '+(state.operation?.state==='performed'?'selected setup operation performed.':'no setup operation performed.'));
for(const item of Object.values(state.checks))console.log(item.label+': '+item.state+(item.action?' — '+item.action:''));
if(state.operation)console.log('Setup operation: '+state.operation.state+(state.operation.action?' — '+state.operation.action:''));
for(const pending of state.pendingOperations??[])console.log('Unfinished setup operation: '+pending.id+'. Recheck prerequisites and explicitly retry it, or use --cancel to cancel the old intent.');
}
if(state.state!=='verified'&&state.state!=='cancelled')process.exitCode=1;

}

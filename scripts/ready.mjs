import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {discoverWorkspace,referenceTarget,runLocalReadiness} from '../lib/get-ready/index.mjs';

const args=process.argv.slice(2);
const flags=new Map();
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(flags.has(flag))throw new Error("Do not repeat readiness flags.");
 if(['--cancel','--publish-proof','--deploy-reference','--install-reference-tools','--resume-ownership','--prepare-reference-target','--deploy-owned-reference','--update-owned-reference'].includes(flag)){flags.set(flag,true);continue;}
 if(!['--workspace','--reference-url','--reference-repo','--reference-worker','--account','--clone-reference','--own-reference','--previous-source','--previous-version'].includes(flag)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --workspace PATH, --reference-url HTTPS_ORIGIN and --reference-repo OWNER/REPO. Optional: --cancel, --publish-proof, --own-reference OWNER/NAME, --clone-reference PATH, --install-reference-tools, --prepare-reference-target, --deploy-owned-reference, --deploy-reference, or --update-owned-reference with --previous-source and --previous-version.');
 flags.set(flag,args[++i]);
}
if(flags.has('--clone-reference')&&(!flags.has('--workspace')||['--deploy-reference','--deploy-owned-reference','--update-owned-reference','--install-reference-tools','--prepare-reference-target','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Cloning requires an explicit authorised Codex folder and a separate destination; it cannot be combined with installation, deployment, publication or cancellation.');
if(flags.has('--own-reference')&&(!flags.has('--workspace')||['--clone-reference','--deploy-reference','--deploy-owned-reference','--update-owned-reference','--install-reference-tools','--prepare-reference-target','--cancel','--publish-proof'].some(flag=>flags.has(flag))))throw new Error('Ownership requires an explicit reviewed Hello workspace and personal private repository name; it cannot combine with another operation.');
if(flags.has('--resume-ownership')&&!flags.has('--own-reference'))throw new Error('--resume-ownership requires --own-reference and explicitly authorises completion of that selected existing private repository.');
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
const state=await runLocalReadiness({workspace:cwd,target,account,worker,cancel:flags.has('--cancel'),operation:flags.has('--update-owned-reference')?'update-owned-reference':flags.has('--deploy-owned-reference')?'deploy-owned-reference':flags.has('--prepare-reference-target')?'prepare-reference-target':flags.has('--own-reference')?'own-reference':flags.has('--clone-reference')?'clone-reference':flags.has('--deploy-reference')?'deploy-reference':flags.has('--install-reference-tools')?'install-reference-tools':null,destination:flags.has('--clone-reference')?resolve(flags.get('--clone-reference')):null,repository:flags.get('--own-reference')??null,resumeOwnership:flags.has('--resume-ownership'),previousDeployment:flags.has('--update-owned-reference')?{source:flags.get('--previous-source'),version:flags.get('--previous-version')}:null});
if(flags.has('--publish-proof')){
 if(!operator||target?.origin!=='https://ready.loftwah.com'||state.state!=='verified')throw new Error('Only the verified launch environment may replace the public operator proof.');
 const proof={reviewed:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Australia/Melbourne'}).format(new Date()),url:target.origin,commit:state.checks.https.evidence.commit,checks:[{label:'Actual Codex workspace',status:'Verified',detail:'Git and authenticated GitHub push access checked in this agent workspace.'},{label:'Cloudflare deployment tools',status:'Verified',detail:'Authenticated Wrangler verified. No browser credentials assumed.'},{label:'Custom domain and HTTPS',status:'Verified',detail:'Selected hostname returned the exact reference source commit.'}]};
 writeFileSync(resolve(discovered.workspace,'src/lib/readiness.json'),JSON.stringify(proof,null,2)+'\n');
}
console.log('Readiness: '+state.state+'. Private workspace receipt saved; '+(state.operation?.state==='performed'?'selected reference operation performed.':'no reference operation performed.'));
for(const item of Object.values(state.checks))console.log(item.label+': '+item.state+(item.action?' — '+item.action:''));
if(state.operation)console.log('Reference operation: '+state.operation.state+(state.operation.action?' — '+state.operation.action:''));
for(const pending of state.pendingOperations??[])console.log('Unfinished reference operation: '+pending.id+'. Recheck prerequisites and explicitly retry it, or use --cancel to cancel the old intent.');
if(state.state!=='verified'&&state.state!=='cancelled')process.exitCode=1;

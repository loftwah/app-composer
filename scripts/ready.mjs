import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {discoverWorkspace,referenceTarget,runLocalReadiness} from '../lib/get-ready/index.mjs';

const args=process.argv.slice(2);
const flags=new Map();
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(['--cancel','--publish-proof','--deploy-reference','--install-reference-tools'].includes(flag)){flags.set(flag,true);continue;}
 if(!['--workspace','--reference-url','--reference-repo','--reference-worker','--account'].includes(flag)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --workspace PATH, --reference-url HTTPS_ORIGIN and --reference-repo OWNER/REPO. Optional: --cancel, --publish-proof or --deploy-reference.');
 flags.set(flag,args[++i]);
}
const cwd=resolve(flags.get('--workspace')||process.cwd());
const discovered=discoverWorkspace(cwd);
const operator=discovered.repo==='loftwah/app-composer';
if(flags.has('--reference-url')!==flags.has('--reference-repo'))throw new Error('Provide both reference URL and repository.');
const target=flags.has('--reference-url')?referenceTarget(flags.get('--reference-url'),flags.get('--reference-repo')):operator?referenceTarget('https://ready.loftwah.com','loftwah/app-composer-hello'):null;
let config={};try{config=JSON.parse(readFileSync(resolve(discovered.workspace,'wrangler.jsonc'),'utf8'));}catch{}
const account=flags.get('--account')||config.account_id||null;
const worker=flags.get('--reference-worker')||(operator?'composer-hello':null);
if(flags.has('--install-reference-tools')&&(!flags.has('--workspace')||flags.has('--deploy-reference')||flags.has('--cancel')))throw new Error('Tool installation requires an explicit authorised Hello workspace and cannot be combined with deployment or cancellation.');
if(flags.has('--deploy-reference')&&(!flags.has('--workspace')||!flags.has('--account')||!flags.has('--reference-url')||!flags.has('--reference-repo')||!flags.has('--reference-worker')||flags.has('--cancel')))throw new Error('Reference deployment requires an explicit authorised workspace, account, Worker, HTTPS origin and repository; cancellation cannot deploy.');
const state=await runLocalReadiness({workspace:cwd,target,account,worker,cancel:flags.has('--cancel'),operation:flags.has('--deploy-reference')?'deploy-reference':flags.has('--install-reference-tools')?'install-reference-tools':null});
if(flags.has('--publish-proof')){
 if(!operator||target?.origin!=='https://ready.loftwah.com'||state.state!=='verified')throw new Error('Only the verified launch environment may replace the public operator proof.');
 const proof={reviewed:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Australia/Melbourne'}).format(new Date()),url:target.origin,commit:state.checks.https.evidence.commit,checks:[{label:'Actual Codex workspace',status:'Verified',detail:'Git and authenticated GitHub push access checked in this agent workspace.'},{label:'Cloudflare deployment tools',status:'Verified',detail:'Authenticated Wrangler verified. No browser credentials assumed.'},{label:'Custom domain and HTTPS',status:'Verified',detail:'Selected hostname returned the exact reference source commit.'}]};
 writeFileSync(resolve(discovered.workspace,'src/lib/readiness.json'),JSON.stringify(proof,null,2)+'\n');
}
console.log('Readiness: '+state.state+'. Private workspace receipt saved; '+(state.operation?.state==='performed'?'selected reference operation performed.':'no reference operation performed.'));
for(const item of Object.values(state.checks))console.log(item.label+': '+item.state+(item.action?' — '+item.action:''));
if(state.operation)console.log('Reference operation: '+state.operation.state);
for(const pending of state.pendingOperations??[])console.log('Unfinished reference operation: '+pending.id+'. Recheck prerequisites and explicitly retry it, or use --cancel to cancel the old intent.');
if(state.state!=='verified'&&state.state!=='cancelled')process.exitCode=1;

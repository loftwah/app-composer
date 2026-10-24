import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {fixture} from './readiness-target.mjs';import {referenceDeployment} from '../../lib/get-ready/local.mjs';import {discoverWorkspace} from '../../lib/get-ready/index.mjs';
const version='11111111-2222-4333-8444-555555555555';
export function ownedFixture(mode='success'){
 const f=fixture();
 writeFileSync(join(f.workspace,'config.json'),JSON.stringify({title:'Fictional welcome',intro:'Fictional starter',theme:'midnight'}));
 if(mode.startsWith('source-')){
  mkdirSync(join(f.workspace,'scripts'));
  writeFileSync(join(f.workspace,'scripts/build-source.mjs'),`import assert from 'node:assert/strict';import {readFileSync,writeFileSync,existsSync} from 'node:fs';
assert.deepEqual(process.argv.slice(2),['--check']);assert.notEqual(process.cwd(),${JSON.stringify(f.workspace)});
for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','RESEND_API_KEY','NODE_OPTIONS','WRANGLER_CI_OVERRIDE_NAME','CLOUDFLARE_API_BASE_URL'])assert.equal(process.env[key],undefined,key);
assert.notEqual(process.env.HOME,${JSON.stringify(f.workspace)});assert.equal(existsSync('.env'),false);
assert.ok(process.env.TMPDIR.startsWith(process.cwd()+'/'));
writeFileSync(${JSON.stringify(join(f.root,'source-check.json'))},JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)}));
${mode==='source-failure'?"throw Error('Fictional stale source distribution');":''}
${mode==='source-mutation'?"writeFileSync('worker.txt','Fictional changed frozen source\\n');":''}
`);
 }
 mkdirSync(join(f.workspace,'tests'));writeFileSync(join(f.workspace,'tests/source.test.mjs'),"import assert from 'node:assert/strict';assert.equal(process.env.CLOUDFLARE_API_TOKEN,undefined);assert.equal(process.env.RESEND_API_KEY,undefined);\n");
 f.git(['add','.']);f.git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Synthetic maintained release']);const baseline=f.git(['rev-parse','HEAD']);
 const proposed=referenceDeployment(f.context,'2026-10-13','fixture');writeFileSync(join(f.workspace,'wrangler.jsonc'),JSON.stringify(proposed,null,2)+'\n');
 if(mode==='code')writeFileSync(join(f.workspace,'worker.txt'),'Unreviewed code\n');
 if(mode==='new-file')writeFileSync(join(f.workspace,'arbitrary.mjs'),'throw new Error("not reviewed");\n');
 if(mode==='bad-profile')writeFileSync(join(f.workspace,'wrangler.jsonc'),JSON.stringify({...proposed,services:[{binding:'OTHER',service:'unrelated'}]}));
 f.git(['add','.']);f.git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Synthetic owned destination']);const source=f.git(['rev-parse','HEAD']);f.git(['update-ref','refs/remotes/origin/main',source]);
 writeFileSync(join(f.root,'deployments.json'),'[]');
 const gh=`#!/bin/sh\ncase "$2" in\n user) printf '{"login":"fixture"}\\n' ;;\n repos/fixture/hello) printf '{"full_name":"fixture/hello","owner":{"login":"fixture"},"private":${mode==='public'?'false':'true'},"default_branch":"main","permissions":{"push":${mode==='denied'?'false':'true'}}}\\n' ;;\n repos/loftwah/app-composer-hello/commits/main) printf '${baseline}\\n' ;;\n *) printf '${source}\\n' ;;\nesac\n`;
 writeFileSync(join(f.root,'bin/gh'),gh,{mode:0o755});
 const tool=`import {readFileSync,writeFileSync,existsSync} from 'node:fs';
 const args=process.argv.slice(2),log=${JSON.stringify(join(f.root,'deployments.json'))};
 if(args.includes('whoami'))console.log(JSON.stringify({loggedIn:true,accounts:[{id:${JSON.stringify(f.context.account)}}]}));
 else if(args.includes('deploy')){
 const events=JSON.parse(readFileSync(log,'utf8'));events.push({dryRun:args.includes('--dry-run'),cwd:process.cwd(),ignored:['.env','.npmrc','.pnpmfile.cjs'].some(file=>existsSync(file)),token:!!process.env.CLOUDFLARE_API_TOKEN,overrides:!!(process.env.WRANGLER_CI_OVERRIDE_NAME||process.env.CLOUDFLARE_API_BASE_URL||process.env.CF_API_BASE_URL||process.env.RESEND_API_KEY||process.env.NODE_OPTIONS),envFileDisabled:args.includes('--env-file=/dev/null')});writeFileSync(log,JSON.stringify(events));
 ${mode==='build-edit'?`if(args.includes('--dry-run'))writeFileSync(${JSON.stringify(join(f.workspace,'worker.txt'))},'Owner edit during build\\n');`:''}
 console.log(args.includes('--dry-run')?'--dry-run: exiting now.':'Current Version ID: ${version}');
 }else console.log('4.152.0');`;
 writeFileSync(join(f.workspace,'node_modules/wrangler/bin/wrangler.js'),tool);
 for(const file of ['.env','.npmrc','.pnpmfile.cjs']){writeFileSync(join(f.workspace,file),'Ignored owner work\n');f.git(['-c','core.excludesFile=/dev/null','status','--porcelain']);}
 writeFileSync(join(f.workspace,'.git/info/exclude'),'.env\n.npmrc\n.pnpmfile.cjs\n');
 return {...f,baseline,source,context:{...f.context,...discoverWorkspace(f.workspace)},events:()=>JSON.parse(readFileSync(join(f.root,'deployments.json'),'utf8'))};
}

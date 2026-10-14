import {assertReleasePackage} from './package-get-ready.mjs';
import {verifyLive} from './verify-live.mjs';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {query} from './records.mjs';
import {execFileSync} from 'node:child_process';
import {assertProductionEnvironment,assertProductionTarget,parseAdminSecrets,snapshotAdminSecrets} from './deployment-target.mjs';
assertProductionEnvironment(process.env);
const extra=process.argv.slice(2);
if(extra.some(arg=>arg!=='--miniapp-secrets')||extra.length>1)throw new Error('Unsupported deploy option');
const connecting=extra.includes('--miniapp-secrets');
const validatedSecrets=connecting?parseAdminSecrets(readFileSync('.private/miniapp-admin-secrets.json','utf8')):null;
const run=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(run(['status','--porcelain']))throw new Error('Commit the reviewed source before deploying');
const sha=run(['rev-parse','HEAD']);
const guard=()=>{if(run(['branch','--show-current'])!=='main'||run(['rev-parse','HEAD'])!==sha||run(['rev-parse','origin/main'])!==sha||run(['status','--porcelain']))throw new Error('Production requires clean pushed reviewed main.');};
guard();
const cfg=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const lock=JSON.parse(readFileSync('composition.lock.json','utf8'));
assertProductionTarget(cfg,cfg,lock);
execFileSync('pnpm',['run','audit'],{stdio:'inherit'});
execFileSync('pnpm',['check'],{stdio:'inherit'});
execFileSync('pnpm',['build'],{stdio:'inherit'});
assertReleasePackage(JSON.parse(readFileSync('public/downloads/get-ready-core.json','utf8')),readFileSync('public/downloads/get-ready-core.tgz'),sha);
const pointer=resolve('.wrangler/deploy/config.json');
const generatedPath=resolve(dirname(pointer),JSON.parse(readFileSync(pointer,'utf8')).configPath);
if(generatedPath!==resolve('dist/server/wrangler.json'))throw Error('Unexpected generated deployment configuration path.');
assertProductionTarget(cfg,JSON.parse(readFileSync(generatedPath,'utf8')),lock);
guard();
const snapshot=validatedSecrets?snapshotAdminSecrets(validatedSecrets,process.cwd()):null;
try {
 execFileSync('pnpm',['wrangler','deploy','--message','App Composer '+sha,...(snapshot?['--secrets-file',snapshot.path]:[])],{stdio:'inherit'});
} finally {snapshot?.remove();}
await verifyLive(sha,lock);
for(const path of ['/_emdash/admin/setup','/_emdash/api/users','/_emdash/api/setup/status','/_emdash/api/plugins/composer-miniapps/read?app=guestbook&action=snapshot']){
 const res=await fetch('https://composer.loftwah.com'+path,{redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'}});
 const location=res.headers.get('location'),redirect=location?new URL(location,'https://composer.loftwah.com'):null;
 const accessLogin=[302,303].includes(res.status)&&redirect?.hostname===cfg.vars.CF_ACCESS_TEAM_DOMAIN&&redirect.pathname.startsWith('/cdn-cgi/access/login');
 if(res.status!==403&&!accessLogin)throw new Error('Unauthenticated administration boundary failed: '+path);
}
await query("UPDATE composer_releases SET state='superseded' WHERE state='active' AND id!=?",[lock.id]);
await query("UPDATE composer_releases SET state='active' WHERE id=?",[lock.id]);
console.log('Verified exact live Composer source '+sha);

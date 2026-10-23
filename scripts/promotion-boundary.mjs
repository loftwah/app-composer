import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,lstatSync,realpathSync,readdirSync,openSync,closeSync,fstatSync,ftruncateSync,constants} from 'node:fs';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {validateComposition} from './contracts.mjs';
import {installedWrangler,wranglerEnvironment} from '../lib/get-ready/local-checks.mjs';
import {referenceCloneEnvironment,referenceInstallEnvironment} from '../lib/get-ready/local.mjs';
import {compositionServices} from './deployment-target.mjs';

// Compile captured reviewed bytes without credentials, ignored owner files,
// package scripts or inherited Node controls. Upload gets selected credentials.
export function promoteComposition({workspace,dryRun=false,env=process.env,sources={}}){
 workspace=realpathSync(workspace);
 const lockPath=resolve(workspace,'composition.lock.json'),rootConfigPath=resolve(workspace,'wrangler.jsonc');
 const rootFile=lstatSync(rootConfigPath);
 if(!rootFile.isFile()||rootFile.nlink!==1||realpathSync(rootConfigPath)!==rootConfigPath)throw Error('Composer target must be its own unlinked regular file.');
 const lockBytes=readFileSync(lockPath),rootConfigBytes=readFileSync(rootConfigPath);
 const lock=JSON.parse(lockBytes),rootConfig=JSON.parse(rootConfigBytes);
 if(!/^[a-f0-9]{64}$/.test(lock.id)||lock.apps?.length!==2||new Set(lock.apps.map(app=>app.id)).size!==2||lock.apps.some(app=>!['guestbook','showcase'].includes(app.id)))throw Error('Only the reviewed Guestbook/Showcase pair can be promoted.');
 validateComposition(lock.apps.map(app=>app.manifest));
 const account=rootConfig.account_id;
 if(!/^[a-f0-9]{32}$/.test(account)||env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_ACCOUNT_ID!==account)throw Error('The selected upload account differs from Composer.');
 if(!dryRun&&!env.CLOUDFLARE_API_TOKEN)throw Error('Promotion requires the selected authorised Cloudflare runtime.');
 installedWrangler(workspace);
 const entry=realpathSync(resolve(workspace,'node_modules/wrangler/bin/wrangler.js'));
 const temp=realpathSync(mkdtempSync(resolve(tmpdir(),'composer-promotion-')));
 try{
  const home=resolve(temp,'home');mkdirSync(home);
  const buildEnv={...referenceInstallEnvironment(env,home),HOME:home};
  try{execFileSync('pnpm',['audit','--audit-level','low','--registry=https://registry.npmjs.org'],{cwd:workspace,env:buildEnv,encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});}catch{throw Error('Dependency audit did not pass; no service was promoted.');}
  const uploadEnv={...buildEnv,CLOUDFLARE_API_TOKEN:env.CLOUDFLARE_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:account};
  const services=Object.fromEntries(lock.apps.map(app=>[app.id,'composer-'+app.id+'-'+lock.id.slice(0,16)]));
  const unchangedRoot=()=>{const current=lstatSync(rootConfigPath);if(!current.isFile()||current.dev!==rootFile.dev||current.ino!==rootFile.ino||current.nlink!==1||!readFileSync(lockPath).equals(lockBytes)||!readFileSync(rootConfigPath).equals(rootConfigBytes))throw Error('Composer composition or target changed during promotion.');};
  const gitEnv=referenceCloneEnvironment(env,home);
  const prepared=lock.apps.map(app=>{
   const source=realpathSync(sources[app.id]??resolve(dirname(workspace),'app-composer-'+app.id));
   const git=(args,encoding='utf8')=>execFileSync('git',['--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.attributesFile=/dev/null',...args],{cwd:source,env:gitEnv,encoding,timeout:20000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
   const repo='https://github.com/loftwah/app-composer-'+app.id;
   if(app.repository!==repo||app.manifest.repository!==repo||app.manifest.id!==app.id||!/^[a-f0-9]{40}$/.test(app.commit)||app.manifestDigest!=='sha256:'+createHash('sha256').update(JSON.stringify(app.manifest)).digest('hex'))throw Error('The source pin or manifest is not the reviewed authored app.');
   const configKeys=git(['config','--includes','--name-only','--list']).split('\n');
   if(configKeys.some(key=>/^(filter\.|include\.|includeif\.)/i.test(key)))throw Error('Source Git execution controls are unsupported.');
   const verifySource=()=>{
    if(git(['rev-parse','HEAD']).trim()!==app.commit||git(['status','--porcelain']).trim())throw Error('The '+app.id+' source differs from its reviewed pin.');
    const remote=git(['remote','get-url','--all','origin']).trim();
    if(remote!==repo+'.git'&&remote!=='git@github.com:loftwah/app-composer-'+app.id+'.git')throw Error('The source repository identity changed.');
    for(const file of files){const path=resolve(source,file.name);if(!lstatSync(path).isFile()||realpathSync(path)!==path||!readFileSync(path).equals(file.bytes))throw Error('Tracked source bytes changed, including hidden Git edits.');}
   };
   let sourceSize=0;
   const inventory=git(['ls-tree','-rz',app.commit],null).toString().split('\0').filter(Boolean);
   if(inventory.length>1000)throw Error('Source inventory exceeds the supported pair limit.');
   const files=inventory.map(row=>{
    const match=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/s.exec(row);
    if(!match)throw Error('Linked or embedded source is unsupported.');
    const name=match[3],target=resolve(temp,app.id,name),path=relative(resolve(temp,app.id),target);
    if(isAbsolute(name)||path.startsWith('..')||isAbsolute(path)||name.split('/').some(part=>['.git','.private','node_modules'].includes(part)||part.startsWith('.env')||part.startsWith('.dev.vars'))||/[\r\n]/.test(name))throw Error('Unsupported snapshot path.');
    const bytes=git(['cat-file','blob',match[2]],null);sourceSize+=bytes.length;if(bytes.length>25*1024*1024||sourceSize>100*1024*1024)throw Error('Source exceeds the supported Worker asset limits.');
    return {name,bytes,mode:match[1]==='100755'?0o700:0o600};
   });
   verifySource();
   const snapshot=resolve(temp,app.id);mkdirSync(snapshot);
   for(const file of files){const target=resolve(snapshot,file.name);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,file.bytes,{flag:'wx',mode:file.mode});}
   const config=JSON.parse(readFileSync(resolve(snapshot,'wrangler.jsonc'),'utf8'));
   if(config.build||config.account_id!==account||config.main!=='./src/worker.ts'||config.assets?.directory!=='./public'||config.assets.binding!=='ASSETS'||config.d1_databases?.length!==1||config.d1_databases[0].binding!=='DB'||config.vars?.PUBLIC_ORIGIN!==app.url)throw Error('The app deployment contract differs from the supported target.');
   if(JSON.stringify(JSON.parse(readFileSync(resolve(snapshot,'app.manifest.json'),'utf8')))!==JSON.stringify(app.manifest))throw Error('Captured manifest differs from the composition pin.');
   config.name=services[app.id];config.main=resolve(snapshot,'src/worker.ts');config.routes=[];config.vars.PUBLIC_ORIGIN='https://composer.loftwah.com';delete config.vars.USAGE_ENDPOINT;delete config.vars.USAGE_TOKEN;config.workers_dev=false;config.preview_urls=false;config.assets.directory=resolve(snapshot,'public');delete config.env;config.d1_databases[0].migrations_dir=resolve(snapshot,'migrations');
   if(app.id==='showcase'){config.services=[{binding:'ITEM_PROVIDER',service:services.guestbook}];config.vars.PROVIDER_ORIGIN='https://composer.loftwah.com';config.vars.PROVIDER_BASE='/guestbook';config.vars.PROVIDER_MOUNT='/guestbook';}
   if(app.manifest.memberProfiles)config.vars.COMPOSER_ISSUER='https://composer.loftwah.com';
   if(app.manifest.memberService)config.vars.MEMBER_ISSUER='https://composer.loftwah.com';
   const generated=Buffer.from(JSON.stringify(config)),configPath=resolve(snapshot,'promotion.json');writeFileSync(configPath,generated,{flag:'wx',mode:0o600});
   const expectedAssets=new Set(files.filter(file=>file.name.startsWith('public/')).map(file=>file.name));
   const verifyAssets=()=>{let count=0;const visit=dir=>{for(const name of readdirSync(dir)){const target=resolve(dir,name);if(realpathSync(target)!==target)throw Error('Linked upload assets are unsupported.');if(lstatSync(target).isDirectory())visit(target);else if(lstatSync(target).isFile()&&expectedAssets.has(relative(snapshot,target)))count++;else throw Error('Unreviewed file appeared in upload assets.');}};visit(resolve(snapshot,'public'));if(count!==expectedAssets.size)throw Error('Upload asset inventory changed.');};
   const verify=()=>{unchangedRoot();verifySource();verifyAssets();for(const file of files){const target=resolve(snapshot,file.name);if(!lstatSync(target).isFile()||realpathSync(target)!==target||!readFileSync(target).equals(file.bytes))throw Error('Compiled snapshot bytes changed.');}if(!readFileSync(configPath).equals(generated))throw Error('Promotion target changed during compilation.');};
   const defines=['--define','BUILD_SHA:'+JSON.stringify(app.commit),'--define','MANIFEST:'+JSON.stringify(app.manifest)];
   const wrangler=(args,upload=false,input)=>{try{return execFileSync(process.execPath,[entry,...args,'--env-file=/dev/null'],{cwd:snapshot,env:wranglerEnvironment(upload?uploadEnv:buildEnv),input,encoding:'utf8',timeout:upload?180000:60000,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});}catch{throw Error(upload?'Selected promotion upload failed; inspect existing services before explicitly retrying.':'Promotion compilation or artifact validation failed.');}};
   return {app,source,snapshot,configPath,config,defines,verify,wrangler};
  });
  for(const item of prepared){
   item.verify();const output=resolve(temp,'build-'+item.app.id);
   item.wrangler(['deploy','--config',item.configPath,'--dry-run','--outdir',output,...item.defines]);for(const other of prepared)other.verify();
   const inventory=()=>{const files=[];const visit=dir=>{for(const name of readdirSync(dir)){const target=resolve(dir,name);if(realpathSync(target)!==target)throw Error('Linked build output is unsupported.');if(lstatSync(target).isDirectory())visit(target);else if(lstatSync(target).isFile())files.push(target);else throw Error('Unsupported build output.');}};visit(output);return files.sort();};
   const files=inventory(),bytes=files.map(file=>readFileSync(file));
   if(!files.includes(resolve(output,'worker.js'))||bytes.reduce((size,value)=>size+value.length,0)>50*1024*1024)throw Error('The reviewed compiled Worker output is missing or oversized.');
   item.uploadConfigPath=resolve(item.snapshot,'upload.json');const config=Buffer.from(JSON.stringify({...item.config,main:resolve(output,'worker.js')}));writeFileSync(item.uploadConfigPath,config,{flag:'wx',mode:0o600});
   item.verifyArtifact=()=>{if(JSON.stringify(inventory())!==JSON.stringify(files)||files.some((file,index)=>!readFileSync(file).equals(bytes[index]))||!readFileSync(item.uploadConfigPath).equals(config))throw Error('The verified upload artifact or target changed.');};
   // Exercise the upload configuration without credentials or recompilation.
   item.wrangler(['deploy','--config',item.uploadConfigPath,'--no-bundle','--dry-run']);item.verify();item.verifyArtifact();
  }
  if(!dryRun){
   // Every app must compile before the first secret or deployment mutation.
   const verifyAll=()=>{for(const other of prepared){other.verify();other.verifyArtifact();}};
   // Read the finite selected connection set before the first cloud mutation.
   // No credentials are passed to compilation or included in snapshot assets.
   const credentials=prepared.map(item=>{
    const names=['OWNER_API_TOKEN',...(item.app.manifest.memberProfiles?['COMPOSER_PROFILE_BRIDGE_TOKEN']:[]),...(item.app.manifest.memberService?['MEMBER_SERVICE_TOKEN']:[])];
    const values=names.map(name=>{const token=readFileSync(resolve(item.source,'.private',name),'utf8').trim();if(!token||token.length>4096||/[\r\n]/.test(token))throw Error('Missing or invalid selected app connection.');return {name,token};});
    if(new Set(values.map(value=>value.token)).size!==values.length)throw Error('Member and owner connections must use separate credentials.');
    return values;
   });
   for(const [index,item] of prepared.entries()){verifyAll();for(const {name,token} of credentials[index]){item.wrangler(['secret','put',name,'--config',item.uploadConfigPath],true,token);verifyAll();}item.wrangler(['deploy','--config',item.uploadConfigPath,'--no-bundle','--message','Pinned composition '+lock.id],true);verifyAll();}
   unchangedRoot();rootConfig.services=compositionServices(lock);
   const fd=openSync(rootConfigPath,constants.O_WRONLY|constants.O_NOFOLLOW);try{const file=fstatSync(fd);if(file.dev!==rootFile.dev||file.ino!==rootFile.ino||file.nlink!==1)throw Error('Composer target changed before binding preparation.');ftruncateSync(fd,0);writeFileSync(fd,JSON.stringify(rootConfig,null,2)+'\n');}finally{closeSync(fd);}
  }
  console.log(dryRun?'Reviewed snapshots compiled without credentials or promotion.':'Reviewed app services deployed; root bindings prepared for the guarded release.');
 }finally{rmSync(temp,{recursive:true,force:true});}
}

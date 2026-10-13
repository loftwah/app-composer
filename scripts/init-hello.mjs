import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {runReadinessCommand} from '../lib/get-ready/check.mjs';
import {helloConfiguration} from '../src/lib/hello-spec.mjs';
import {referenceTarget,runLocalReadiness,discoverWorkspace} from '../lib/get-ready/index.mjs';
import {verifyReferenceConfig} from '../lib/get-ready/local.mjs';

const args=process.argv.slice(2),flags=new Map();
for(let i=0;i<args.length;i++){
 const flag=args[i];
 if(flag==='--apply'){flags.set(flag,true);continue;}
 if(!['--spec','--workspace','--account','--reference-worker','--reference-url'].includes(flag)||!args[i+1]||args[i+1].startsWith('--')||flags.has(flag))throw new Error('Supply --spec FILE, --workspace PATH, --account ID, --reference-worker NAME and --reference-url HTTPS_ORIGIN. Add --apply only to write the reviewed local configuration.');
 flags.set(flag,args[++i]);
}
for(const flag of ['--spec','--workspace','--account','--reference-worker','--reference-url'])if(!flags.has(flag))throw new Error('Missing '+flag);
const target=referenceTarget(flags.get('--reference-url'),'loftwah/app-composer-hello');
const config=helloConfiguration(JSON.parse(readFileSync(flags.get('--spec'),'utf8')),target.origin);
if(!flags.has('--apply')){
 console.log(JSON.stringify({state:'planned',configuration:config,applied:false,deployed:false},null,2));
}else{
 const workspace=realpathSync(flags.get('--workspace'));
 const current=discoverWorkspace(workspace);
 const run=(command,argv)=>runReadinessCommand(command,argv,{cwd:workspace,env:process.env,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']});
 const git=argv=>run('git',argv);
 if(current.workspace!==workspace||current.repo!==target.repo||current.dirty!==false||git(['branch','--show-current'])!=='main'||git(['rev-parse','origin/main'])!==current.source||run('gh',['api','repos/'+target.repo+'/commits/main','--jq','.sha'])!==current.source)throw new Error('Hello configuration requires the reviewed clean exact-main authored reference workspace.');
 const path=resolve(workspace,'config.json');
 if(realpathSync(path)!==path)throw new Error('Hello configuration must be a local regular source file, not a symlink.');
 const original=readFileSync(path,'utf8');
 const old=JSON.parse(original);
 if(!old||typeof old!=='object'||Array.isArray(old))throw new Error('The existing Hello configuration must be an object.');
 const session=await runLocalReadiness({workspace,account:flags.get('--account'),worker:flags.get('--reference-worker'),target});
 if(session.state!=='verified')throw new Error('Get Ready has not verified this workspace/account/reference; inspect its private receipt and resume. Configuration remains unchanged.');
 await verifyReferenceConfig(session.context);
 // Recheck after provider IO. Never overwrite work made while verification was running.
 const remoteMain=run('gh',['api','repos/'+target.repo+'/commits/main','--jq','.sha']);
 const after=discoverWorkspace(workspace);
 if(after.repo!==current.repo||after.source!==current.source||after.dirty!==false||git(['branch','--show-current'])!=='main'||git(['rev-parse','origin/main'])!==current.source||realpathSync(path)!==path||remoteMain!==current.source||readFileSync(path,'utf8')!==original)throw new Error('The workspace changed during readiness verification. Configuration remains unchanged.');
 const changed=Object.entries(config).some(([key,value])=>old[key]!==value);
 if(changed)writeFileSync(path,JSON.stringify({...old,...config},null,2)+'\n');
 console.log(JSON.stringify({state:changed?'configuration-prepared':'unchanged',changed,deployed:false,next:'Review the config diff, commit/push through the repository release path, then use Get Ready deploy-reference and verify the live title, introduction and theme.'},null,2));
}

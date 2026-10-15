import {writeFileSync,lstatSync,realpathSync,mkdtempSync,openSync,closeSync,fstatSync,linkSync,unlinkSync,rmdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ReadinessFailure,runReadinessCommand} from './check.mjs';
import {githubRepository} from './state.mjs';
import {selectedFile} from './project-files.mjs';

function ownershipReceipt(workspace){
 const directory=resolve(workspace,'.private'),path=resolve(directory,'ownership.json');let root,storage;
 try{root=lstatSync(workspace);storage=lstatSync(directory);}catch{throw new ReadinessFailure('configuration');}
 const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
 const guard=()=>{try{const current=lstatSync(workspace),local=lstatSync(directory);if(!current.isDirectory()||current.isSymbolicLink()||!same(current,root)||!local.isDirectory()||local.isSymbolicLink()||!same(local,storage))throw Error();}catch{throw new ReadinessFailure('source');}};
 guard();
 const capture=()=>{
  guard();const record=selectedFile(workspace,'.private/ownership.json',16384);guard();
  if(record.state==='absent')return {data:null,stat:null};
  if(record.state!=='present')throw new ReadinessFailure('configuration');
  const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new ReadinessFailure('source');
  return {data:record.data,stat};
 };
 let snapshot=capture(),previous=null;
 if(snapshot.data){
  try{
   previous=JSON.parse(snapshot.data.toString('utf8'));const keys=Object.keys(previous).sort().join(',');
   if(!previous||typeof previous!=='object'||Array.isArray(previous)||!['id,repository,source','id,repository,source,upstream,version'].includes(keys)||!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(previous.repository??'')||!/^[a-f0-9]{40}$/.test(previous.source??'')||!Number.isSafeInteger(previous.id)||previous.id<=0||(keys.includes('version')&&(previous.version!==1||previous.upstream!=='loftwah/app-composer-hello')))throw Error();
  }catch{throw new ReadinessFailure('configuration');}
 }
 const unchanged=()=>{let current;try{current=capture();}catch{throw new ReadinessFailure('source');}if(snapshot.data===null?current.data!==null:current.data===null||!same(snapshot.stat,current.stat)||!snapshot.data.equals(current.data))throw new ReadinessFailure('source');};
 return {previous,unchanged,reserve(){
  unchanged();const stage=mkdtempSync(resolve(directory,'.ownership-')),stageStat=lstatSync(stage),file=resolve(stage,'receipt.json');let fd=openSync(file,'wx',0o600);const owned=fstatSync(fd);
  const close=()=>{if(fd!==null){closeSync(fd);fd=null;}};
  return {close,publish(value){
   const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n'),current=fstatSync(fd);
   if(!same(current,owned)||current.size!==0||current.mtimeMs!==owned.mtimeMs||current.ctimeMs!==owned.ctimeMs)throw new ReadinessFailure('source');
   // Write only the exclusive descriptor opened before provider IO. A changed
   // directory leaves this recovery copy intact, never redirects its bytes.
   writeFileSync(fd,bytes);const written=fstatSync(fd);close();unchanged();
   if(!same(lstatSync(stage),stageStat)||realpathSync(stage)!==stage||!same(lstatSync(file),written)||!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink())throw new ReadinessFailure('source');
   // Hard-link publication is exclusive: an owner file, including a dangling
   // symlink, appearing at the destination is never replaced.
   try{linkSync(file,path);}catch{throw new ReadinessFailure('source');}
   if(!same(lstatSync(file),written)||!same(lstatSync(path),written))throw new ReadinessFailure('source');
   unlinkSync(file);if(same(lstatSync(stage),stageStat))try{rmdirSync(stage);}catch{}
   snapshot=capture();if(!snapshot.data?.equals(bytes)||!same(snapshot.stat,written))throw new ReadinessFailure('source');
  }};
 }};
}

// Only the maintained public starter can seed a new personal private repository.
// An explicit operation selects its name; neither a spec nor a receipt authorises it.
export async function prepareOwnedReference(context,env,repository,{resumeOwnership=false}={}) {
  if(typeof resumeOwnership!=='boolean')throw new ReadinessFailure('configuration');
  if(typeof repository!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository)||repository.toLowerCase()==='loftwah/app-composer-hello')throw new ReadinessFailure('configuration');
  const [owner,name]=repository.split('/'),trusted='loftwah/app-composer-hello';
  const workspace=realpathSync(context.workspace);
  const receipt=ownershipReceipt(workspace),previous=receipt.previous;
  const selected=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','GH_TOKEN','GITHUB_TOKEN','GH_CONFIG_DIR'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
  const gitEnv={...selected,GH_HOST:'github.com',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:'/usr/bin/false'};
  const run=(command,args,options={})=>runReadinessCommand(command,args,{cwd:workspace,env:gitEnv,encoding:'utf8',timeout:20000,stdio:['pipe','pipe','pipe'],...options});
  const api=(path,args=[],options={})=>{try{return JSON.parse(run('gh',['api',path,'--hostname','github.com',...args],options));}catch(error){if(error instanceof ReadinessFailure)throw error;throw new ReadinessFailure('response');}};
  const git=args=>run('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.attributesFile=/dev/null','-c','credential.helper=','-c','credential.helper=!gh auth git-credential','-c','protocol.allow=never','-c','protocol.https.allow=always',...args],{timeout:120000});
  const originRepository=()=>{
    const urls=git(['remote','get-url','--all','origin']).split('\n');
    if(urls.length!==1)throw new ReadinessFailure('configuration');
    try{return githubRepository(urls[0]);}catch{throw new ReadinessFailure('configuration');}
  };
  const user=api('user');
  if(typeof user.login!=='string'||user.login.toLowerCase()!==owner.toLowerCase())throw new ReadinessFailure('permission');
  const source=run('gh',['api','repos/'+trusted+'/commits/main','--hostname','github.com','--jq','.sha']);
  if(!/^[a-f0-9]{40}$/.test(source)||context.source!==source)throw new ReadinessFailure('source');
  const recorded=previous?.repository?.toLowerCase()===repository.toLowerCase()&&previous.source===source&&Number.isSafeInteger(previous.id)&&previous.id>0;
  if(previous&&!recorded)throw new ReadinessFailure('configuration');
  const verifyWorkspace=()=>{
    receipt.unchanged();
    if(git(['rev-parse','--show-toplevel'])!==workspace||git(['rev-parse','HEAD'])!==source||git(['branch','--show-current'])!=='main'||git(['rev-parse','origin/main'])!==source)throw new ReadinessFailure('source');
    // Refuse local execution hooks before status, and hidden changes before any push.
    if(git(['config','--includes','--name-only','--list']).split('\n').some(key=>/^(filter\.|include\.|includeif\.|remote\.origin\.pushurl$)/i.test(key)))throw new ReadinessFailure('configuration');
    const origin=originRepository();
    if(origin!==trusted&&(!recorded||origin?.toLowerCase()!==repository.toLowerCase()))throw new ReadinessFailure('configuration');
    if(git(['status','--porcelain']))throw new ReadinessFailure('source');
    const files=git(['ls-tree','-r','--name-only',source]).split('\n');
    for(const file of files){
      if(!lstatSync(resolve(workspace,file)).isFile()||realpathSync(resolve(workspace,file))!==resolve(workspace,file)||git(['hash-object','--no-filters','--',file])!==git(['rev-parse',source+':'+file]))throw new ReadinessFailure('source');
    }
    return origin;
  };
  const startingOrigin=verifyWorkspace();
  if(recorded&&!resumeOwnership&&startingOrigin===trusted)throw new ReadinessFailure('configuration');
  let data,prepared;
  try{
   if(recorded)data=api('repos/'+repository);
   else{
    // GitHub's create endpoint refuses an existing name atomically. Never adopt an
    // existing repository from a guessed 404 or empty size. Explicit completion
    // is separate caller intent; the receipt alone never authorises writes.
    verifyWorkspace();
    prepared=receipt.reserve();verifyWorkspace();
    data=api('user/repos',['--method','POST','--input','-'],{input:JSON.stringify({name,private:true,auto_init:false,has_projects:false,has_wiki:false,description:'Independent Hello starter prepared by App Composer. MIT upstream: https://github.com/'+trusted})});
   }
  if(!data||data.full_name?.toLowerCase()!==repository.toLowerCase()||data.owner?.login?.toLowerCase()!==owner.toLowerCase()||data.private!==true||data.permissions?.push!==true||data.permissions?.admin!==true||!Number.isSafeInteger(data.id)||data.id<=0||(recorded&&data.id!==previous.id))throw new ReadinessFailure('response');
   if(!recorded)prepared.publish({version:1,repository:data.full_name,id:data.id,source,upstream:trusted});
  }finally{prepared?.close();}
  const url='https://github.com/'+data.full_name+'.git';
  const current=api('repos/'+data.full_name);
  if(current.id!==data.id||current.private!==true||current.permissions?.push!==true||current.permissions?.admin!==true)throw new ReadinessFailure('permission');
  const refs=git(['ls-remote','--refs','--',url]);
  const expected=source+'\trefs/heads/main';
  if(refs&&refs!==expected)throw new ReadinessFailure('source');
  verifyWorkspace();
  if(!refs){
    // A local receipt is not authority to populate a pre-existing repository.
    // Only explicit completion intent can resume its creation/push after interruption.
    if(recorded&&!resumeOwnership)throw new ReadinessFailure('configuration');
    git(['push','--force-with-lease=refs/heads/main:','--',url,source+':refs/heads/main']);
    if(git(['ls-remote','--refs','--',url])!==expected)throw new ReadinessFailure('source');
  }
  if(run('gh',['api','repos/'+data.full_name+'/commits/main','--hostname','github.com','--jq','.sha'])!==source)throw new ReadinessFailure('source');
  const final=api('repos/'+data.full_name);
  if(final.id!==data.id||final.private!==true||final.default_branch!=='main'||final.permissions?.push!==true||final.permissions?.admin!==true)throw new ReadinessFailure('response');
  verifyWorkspace();
  const origin=originRepository();
  if(origin===trusted)git(['remote','set-url','origin',url]);
  if(git(['remote','get-url','--all','origin'])!==url||git(['remote','get-url','--push','--all','origin'])!==url)throw new ReadinessFailure('configuration');
  return {repository:data.full_name,commit:source,private:true,changed:!recorded||!refs||origin===trusted,deployed:false};
}

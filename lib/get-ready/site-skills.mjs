// Explicit local preparation. Bundled upstream text is data; no skill/project code runs.
import {lstatSync,realpathSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname,join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {ReadinessFailure} from './check.mjs';
import {selectedFile} from './project-files.mjs';
import catalogue from './project-skills.json' with {type:'json'};
import bundle from './site-skills.json' with {type:'json'};
const required=['building-emdash-site','emdash-cli'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw new ReadinessFailure('configuration');};
export function validateSkillInventory(input){
 if(!Array.isArray(input)||input.length>catalogue.skills.length||new Set(input).size!==input.length||input.some(id=>!catalogue.skills.some(skill=>skill.id===id)))fail();
 return [...input];
}
function bundledFiles(id){
 if(bundle.repository!==catalogue.repository||bundle.commit!==catalogue.commit||bundle.licence!=='MIT')throw new ReadinessFailure('source');
 const prefix='skills/'+id+'/',files=Object.entries(bundle.files).filter(([name])=>name.startsWith(prefix)).map(([name,file])=>({name:name.slice(prefix.length),...file}));
 if(!files.length||files.some(file=>!/^([a-z-]+\/)?[A-Za-z][A-Za-z0-9-]*\.md$/.test(file.name)||typeof file.text!=='string'||Buffer.byteLength(file.text)>65536||hash(file.text)!==file.sha256)||files.find(file=>file.name==='SKILL.md')?.sha256!==catalogue.skills.find(skill=>skill.id===id).entrypointSha256)throw new ReadinessFailure('source');
 const licence=bundle.files.LICENSE;if(!licence||hash(licence.text)!==licence.sha256)throw new ReadinessFailure('source');
 return [...files,{name:'LICENSE',...licence}];
}
// Bind every parent component before writing. Linked or changing scopes are preserved.
function guardDirectory(path){
 const selected=resolve(path),parts=[];let cursor=selected;
 while(true){parts.unshift(cursor);const parent=dirname(cursor);if(parent===cursor)break;cursor=parent;}
 const seen=[];
 for(const entry of parts){
  const stat=lstatSync(entry);
  if(!stat.isDirectory()||stat.isSymbolicLink())fail();seen.push({path:entry,dev:stat.dev,ino:stat.ino});
 }
 function check(){for(const entry of seen){const now=lstatSync(entry.path);if(!now.isDirectory()||now.isSymbolicLink()||now.dev!==entry.dev||now.ino!==entry.ino)throw new ReadinessFailure('source');}}
 return check;
}
// A child process's cwd is a kernel-held directory, independent of pathname swaps.
// It checks that directory identity before exclusively creating single-component
// names. No project command, environment, credentials or downloaded code enters it.
const writeHelper=`
import {lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(0,'utf8')),here=lstatSync('.');
if(!here.isDirectory()||here.dev!==data.dev||here.ino!==data.ino)process.exit(2);
const valid=name=>typeof name==='string'&&/^[A-Za-z.][A-Za-z0-9.-]*$/.test(name)&&!['.','..'].includes(name);
if(data.operation==='directory'){
 if(!valid(data.name))process.exit(2);
 try{mkdirSync(data.name,{mode:0o755});}catch(error){if(error.code!=='EEXIST'||data.exclusive)throw error;}
 const stat=lstatSync(data.name);if(!stat.isDirectory()||stat.isSymbolicLink())process.exit(2);
 process.stdout.write(JSON.stringify({dev:stat.dev,ino:stat.ino}));
}else if(data.operation==='files'){
 for(const file of data.files){if(!valid(file.name)||typeof file.text!=='string')process.exit(2);writeFileSync(file.name,file.text,{flag:'wx',mode:0o644});}
 process.stdout.write('{}');
}else process.exit(2);
`;
function mutate(directory,identity,operation){
 const result=spawnSync(process.execPath,['--input-type=module','--eval',writeHelper],{cwd:directory,env:{},input:JSON.stringify({...operation,dev:identity.dev,ino:identity.ino}),encoding:'utf8',timeout:10000,maxBuffer:4096,stdio:['pipe','pipe','pipe']});
 if(result.error||result.status!==0)throw new ReadinessFailure('source');
 try{return JSON.parse(result.stdout);}catch{throw new ReadinessFailure('source');}
}
function childDirectory(parent,identity,name,exclusive=false){return mutate(parent,identity,{operation:'directory',name,exclusive});}
function presence(path){try{lstatSync(path);return true;}catch(error){if(error.code==='ENOENT')return false;fail();}}
function exactTree(root,id){
 const files=bundledFiles(id),expected=new Set(files.map(file=>file.name)),directories=new Set(files.filter(f=>f.name.includes('/')).map(f=>f.name.split('/')[0]));
 const check=guardDirectory(root);let count=0;
 for(const entry of readdirSync(root,{withFileTypes:true})){
  if(entry.isDirectory()&&directories.has(entry.name)){
   for(const child of readdirSync(join(root,entry.name),{withFileTypes:true})){if(!child.isFile()||!expected.has(entry.name+'/'+child.name))return false;count++;}
  }else if(entry.isFile()&&expected.has(entry.name))count++;else return false;
 }
 if(count!==files.length)return false;
 for(const file of files){const actual=selectedFile(root,file.name);if(actual.state!=='present'||actual.sha256!==file.sha256)return false;}
 check();return true;
}
function scopeCandidates(workspace,env){
 const scopes=[];let parent=workspace;
 while(true){scopes.push(join(parent,'.agents/skills'),join(parent,'.claude/skills'));const next=dirname(parent);if(next===parent)break;parent=next;}
 if(typeof env.HOME!=='string'||!isAbsolute(env.HOME))fail();
 const home=realpathSync(env.HOME);scopes.push(join(home,'.agents/skills'),join(home,'.codex/skills'));
 if(env.CODEX_HOME!==undefined){if(typeof env.CODEX_HOME!=='string'||!isAbsolute(env.CODEX_HOME))fail();scopes.push(join(realpathSync(env.CODEX_HOME),'skills'));}
 return [...new Set(scopes)];
}
export function prepareSiteSkills({workspace,availableSkills,...unknown}={},env=process.env){
 if(Object.keys(unknown).length||typeof workspace!=='string'||!isAbsolute(workspace)||!(env.CODEX_THREAD_ID||env.CODEX_MANAGED_BY_NPM)||!process.versions.node.startsWith('22.'))fail();
 // The caller must inspect its live skill catalogue, including enabled plugins.
 // This is a caller observation, never saved permission or proof of discovery.
 const inventory=validateSkillInventory(availableSkills),root=realpathSync(workspace),checkRoot=guardDirectory(root);
 const manifestFile=selectedFile(root,'package.json');if(manifestFile.state!=='present')fail();
 let manifest;try{const pkg=JSON.parse(manifestFile.data.toString('utf8')),section=[pkg?.dependencies,pkg?.devDependencies].find(section=>section&&typeof section==='object'&&!Array.isArray(section)&&Object.hasOwn(section,'emdash'));manifest=section?.emdash;}catch{fail();}
 if(manifest!=='1.2.0')fail();
 const scopes=scopeCandidates(root,env),destination=join(root,'.agents/skills'),plan=[];
 for(const id of required){
  const target=join(destination,id),found=scopes.filter(scope=>presence(join(scope,id)));
  if(found.length){
   const local=found.includes(destination);
   let exact=false;try{exact=local&&exactTree(target,id);}catch{}
   plan.push({id,state:local?(exact?'reviewed-copy':'preserved-project-copy'):'preserved-other-scope',install:false});
  }else if(inventory.includes(id))plan.push({id,state:'advertised-by-agent',install:false});
  else plan.push({id,state:'prepared',install:true});
 }
 const recheck=()=>{checkRoot();const current=selectedFile(root,'package.json');if(current.state!=='present'||current.sha256!==manifestFile.sha256)throw new ReadinessFailure('source');};
 // Validate every input before making any project change. No source network/installers.
 const inputs=new Map(plan.filter(step=>step.install).map(step=>[step.id,bundledFiles(step.id)]));
 recheck();let changed=false;
 if(inputs.size){
  const agentsIdentity=childDirectory(root,lstatSync(root),'.agents'),agents=join(root,'.agents');
  recheck();const destinationIdentity=childDirectory(agents,agentsIdentity,'skills');
  for(const step of plan.filter(step=>step.install)){
   recheck();
   if(scopes.some(scope=>presence(join(scope,step.id))))throw new ReadinessFailure('source');
   const target=join(destination,step.id),targetIdentity=childDirectory(destination,destinationIdentity,step.id,true);changed=true;
   const groups=new Map();
   for(const file of inputs.get(step.id)){
    const group=file.name.includes('/')?file.name.split('/')[0]:'.',name=file.name.split('/').at(-1),list=groups.get(group)??[];
    list.push({name,text:file.text});groups.set(group,list);
   }
   for(const [group,files] of groups){
    recheck();const directory=group==='.'?target:join(target,group),identity=group==='.'?targetIdentity:childDirectory(target,targetIdentity,group,true);
    mutate(directory,identity,{operation:'files',files});
   }
   recheck();if(!exactTree(target,step.id))throw new ReadinessFailure('source');
  }
 }
 recheck();
 return {changed,purpose:'emdash-site',declaredVersion:manifest,installedVersion:'not-probed',source:{repository:bundle.repository,commit:bundle.commit,reviewed:bundle.reviewed,licence:bundle.licence},skills:plan.map(({id,state})=>({id,state,agentVisible:'not-probed',exercised:false})),ready:false};
}

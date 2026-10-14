// Selected-project metadata only: never runs project code, Git hooks, installers or MCP.
import {openSync,closeSync,lstatSync,fstatSync,readSync,realpathSync,constants} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import catalogue from './project-skills.json' with {type:'json'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const guidance=['AGENTS.md','PRODUCT.md','DESIGN.md','UNSLOP.md','ARCHITECTURE.md'];
function identity(stat){return [stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs,stat.nlink].join(':');}
function selectedFile(root,name,limit=65536){
 const path=resolve(root,name),parents=[];let fd;
 try{
  const parts=relative(root,path).split(sep);if(parts.some(p=>p==='..'))return {state:'refused'};
  for(let i=0;i<parts.length;i++){const parent=resolve(root,...parts.slice(0,i)),stat=lstatSync(parent);if(!stat.isDirectory()||stat.isSymbolicLink())return {state:'refused'};parents.push([parent,stat.dev,stat.ino]);}
  const before=lstatSync(path);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1)return {state:'refused'};if(before.size>limit)return {state:'oversize'};
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const opened=fstatSync(fd);if(identity(before)!==identity(opened))return {state:'changed'};
  const bytes=Buffer.alloc(limit+1);let length=0;while(length<bytes.length){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;}if(length>limit)return {state:'oversize'};
  if(identity(opened)!==identity(fstatSync(fd))||identity(opened)!==identity(lstatSync(path))||parents.some(([parent,dev,ino])=>{const s=lstatSync(parent);return !s.isDirectory()||s.isSymbolicLink()||s.dev!==dev||s.ino!==ino;}))return {state:'changed'};
  const data=bytes.subarray(0,length);return {state:'present',sha256:hash(data),data};
 }catch(error){return {state:error.code==='ENOENT'?'absent':error.code==='EACCES'||error.code==='EPERM'?'denied':'refused'};}finally{if(fd!==undefined)closeSync(fd);}
}
const metadata=record=>({state:record.state,...(record.sha256?{sha256:record.sha256}:{})});
function declaredVersion(value){return typeof value==='string'&&value.length<=64&&/^[~^]?v?[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(?:-[0-9A-Za-z.-]{1,24})?(?:\+[0-9A-Za-z.-]{1,24})?$/.test(value)?value:null;}
export function inspectProject({workspace,purpose='auto',diagrams=false,...unknown}={}){
 if(typeof workspace!=='string'||!workspace||!['auto','emdash-site','emdash-plugin'].includes(purpose)||typeof diagrams!=='boolean'||Object.keys(unknown).length)throw Error('Choose one explicit project and a supported inspection purpose.');
 let root;try{root=realpathSync(resolve(workspace));if(!lstatSync(root).isDirectory())throw Error();}catch{throw Error('The selected project is unavailable. No project was changed.');}
 const manifest=selectedFile(root,'package.json');let pkg=null,manifestState=manifest.state;if(manifest.state==='present'){try{pkg=JSON.parse(manifest.data.toString('utf8'));if(!pkg||typeof pkg!=='object'||Array.isArray(pkg))throw Error();}catch{manifestState='invalid';}}
 const dependency=[pkg?.dependencies,pkg?.devDependencies].find(section=>section&&typeof section==='object'&&!Array.isArray(section)&&Object.hasOwn(section,'emdash'));
 const rawVersion=dependency?.emdash,emdashDeclared=!!dependency,version=declaredVersion(rawVersion),selected=purpose==='auto'?(emdashDeclared?'emdash-site':'general'):purpose;
 const docs=guidance.map(path=>({path,...metadata(selectedFile(root,path))}));
 const lockfiles=['pnpm-lock.yaml','package-lock.json','yarn.lock','bun.lock'].map(path=>({path,...metadata(selectedFile(root,path,2097152))})).filter(item=>item.state!=='absent');
 const skills=catalogue.skills.map(skill=>{
  const path='.agents/skills/'+skill.id+'/SKILL.md',record=selectedFile(root,path),required=selected==='emdash-site'?['building-emdash-site','emdash-cli'].includes(skill.id):selected==='emdash-plugin'?['creating-plugins','emdash-cli'].includes(skill.id):false;
  return {id:skill.id,path,required,...metadata(record),entrypoint:record.state!=='present'?'not-inspected':record.sha256===skill.entrypointSha256?'matches-reviewed':'unmatched-preserve',agentVisible:'not-probed',exercised:false};
 });
 const findings=[];
 if(manifestState!=='present')findings.push({id:'manifest',action:'Inspect the selected package manifest privately; it is missing, invalid or unavailable.'});
 if(selected!=='general'&&version!=='1.2.0')findings.push({id:'compatibility',action:'Verify the declared and installed EmDash version against current official documentation. This inspection does not certify this project version.'});
 for(const item of docs.filter(item=>item.state!=='present'))findings.push({id:item.path,action:'Ask the agent to inspect existing project intent before proposing this guidance file. Preserve existing or inaccessible files.'});
 for(const skill of skills.filter(item=>item.required)){
  if(skill.state==='absent')findings.push({id:skill.id,action:'No canonical project-local entrypoint was found. Check the actual agent’s user/plugin skills before proposing an installation; do not duplicate an existing usable copy.'});
  else if(skill.entrypoint==='unmatched-preserve')findings.push({id:skill.id,action:'Keep this existing entrypoint. It differs from the reviewed upstream entrypoint; inspect its source and references privately before considering an update.'});
  else if(skill.state!=='present')findings.push({id:skill.id,action:'The existing entrypoint could not be safely inspected. Preserve it and resolve the specific file/access condition.'});
 }
 return {version:1,kind:'app-composer.project-inspection',inspectedAt:new Date().toISOString(),workspaceFingerprint:hash(root),purpose:selected,readOnly:true,ready:false,manifest:{state:manifestState,emdashDeclared,emdashVersion:version,installedVersion:'not-probed',commands:Object.fromEntries(['build','test','check'].map(name=>[name,typeof pkg?.scripts?.[name]==='string']))},lockfiles,guidance:docs,skills,source:{reviewed:catalogue.reviewed,repository:catalogue.repository,commit:catalogue.commit,licence:catalogue.licence,documentation:catalogue.documentation},optional:{diagrams:diagrams?'requested-not-probed':'not-requested'},findings,limits:['This is a bounded filesystem observation, not readiness, ownership or deployment evidence.','Only canonical project-local entrypoints were inspected; references, compatibility links, user/plugin installations and agent visibility were not verified.','Declared dependencies and command names are data; no project code, Git configuration, documentation request, compiler or installer was executed.','Entrypoint equality does not verify the skill’s references, runtime discovery, actual use or rendered product quality.','Reports omit file contents, command text, remotes and absolute paths. Keep them private; hashes and declared dependency metadata still describe the selected project.']};
}

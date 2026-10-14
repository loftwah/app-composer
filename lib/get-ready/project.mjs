// Selected-project metadata only: never runs project code, Git hooks, installers or MCP.
import {openSync,closeSync,lstatSync,fstatSync,readSync,realpathSync,constants} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import catalogue from './project-skills.json' with {type:'json'};
import {projectGuidance as guidance,projectLimits,projectSkillRequired,projectFindings,declaredProjectVersion as declaredVersion} from './project-report.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
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
export function inspectProject({workspace,purpose='auto',diagrams=false,...unknown}={}){
 if(typeof workspace!=='string'||!workspace||!['auto','emdash-site','emdash-plugin'].includes(purpose)||typeof diagrams!=='boolean'||Object.keys(unknown).length)throw Error('Choose one explicit project and a supported inspection purpose.');
 let root;try{root=realpathSync(resolve(workspace));if(!lstatSync(root).isDirectory())throw Error();}catch{throw Error('The selected project is unavailable. No project was changed.');}
 const manifest=selectedFile(root,'package.json');let pkg=null,manifestState=manifest.state;if(manifest.state==='present'){try{pkg=JSON.parse(manifest.data.toString('utf8'));if(!pkg||typeof pkg!=='object'||Array.isArray(pkg))throw Error();}catch{manifestState='invalid';}}
 const dependency=[pkg?.dependencies,pkg?.devDependencies].find(section=>section&&typeof section==='object'&&!Array.isArray(section)&&Object.hasOwn(section,'emdash'));
 const rawVersion=dependency?.emdash,emdashDeclared=!!dependency,version=declaredVersion(rawVersion),selected=purpose==='auto'?(emdashDeclared?'emdash-site':'general'):purpose;
 const docs=guidance.map(path=>({path,...metadata(selectedFile(root,path))}));
 const lockfiles=['pnpm-lock.yaml','package-lock.json','yarn.lock','bun.lock'].map(path=>({path,...metadata(selectedFile(root,path,2097152))})).filter(item=>item.state!=='absent');
 const skills=catalogue.skills.map(skill=>{
  const path='.agents/skills/'+skill.id+'/SKILL.md',record=selectedFile(root,path),required=projectSkillRequired(selected,skill.id);
  return {id:skill.id,path,required,...metadata(record),entrypoint:record.state!=='present'?'not-inspected':record.sha256===skill.entrypointSha256?'matches-reviewed':'unmatched-preserve',agentVisible:'not-probed',exercised:false};
 });
 const report={version:1,kind:'app-composer.project-inspection',inspectedAt:new Date().toISOString(),workspaceFingerprint:hash(root),purpose:selected,readOnly:true,ready:false,manifest:{state:manifestState,emdashDeclared,emdashVersion:version,installedVersion:'not-probed',commands:Object.fromEntries(['build','test','check'].map(name=>[name,typeof pkg?.scripts?.[name]==='string']))},lockfiles,guidance:docs,skills,source:{reviewed:catalogue.reviewed,repository:catalogue.repository,commit:catalogue.commit,licence:catalogue.licence,documentation:catalogue.documentation},optional:{diagrams:diagrams?'requested-not-probed':'not-requested'},findings:[],limits:[...projectLimits]};
 report.findings=projectFindings(report);return report;
}

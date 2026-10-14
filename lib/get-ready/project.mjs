// Selected-project metadata only: never runs project code, Git hooks, installers or MCP.
import {lstatSync,realpathSync} from 'node:fs';
import {selectedFile} from './project-files.mjs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import catalogue from './project-skills.json' with {type:'json'};
import {projectGuidance as guidance,projectLimits,projectSkillRequired,projectFindings,declaredProjectVersion as declaredVersion} from './project-report.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
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

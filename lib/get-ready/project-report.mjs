// Browser-safe project report boundary. Observations never establish readiness.
import catalogue from './project-skills.json' with {type:'json'};
export const projectReportLimit=32768;
export const projectGuidance=['AGENTS.md','PRODUCT.md','DESIGN.md','UNSLOP.md','ARCHITECTURE.md'];
export const projectLimits=['This is a bounded filesystem observation, not readiness, ownership or deployment evidence.','Only canonical project-local entrypoints were inspected; references, compatibility links, user/plugin installations and agent visibility were not verified.','Declared dependencies and command names are data; no project code, Git configuration, documentation request, compiler or installer was executed.','Entrypoint equality does not verify the skill’s references, runtime discovery, actual use or rendered product quality.','Reports omit file contents, command text, remotes and absolute paths. Keep them private; hashes and declared dependency metadata still describe the selected project.'];
export function projectSkillRequired(purpose,id){return purpose==='emdash-site'?['building-emdash-site','emdash-cli'].includes(id):purpose==='emdash-plugin'?['creating-plugins','emdash-cli'].includes(id):false;}
export function declaredProjectVersion(value){return typeof value==='string'&&value.length<=64&&/^[~^]?v?[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(?:-[0-9A-Za-z.-]{1,24})?(?:\+[0-9A-Za-z.-]{1,24})?$/.test(value)?value:null;}
export function projectFindings(report){
 const findings=[];
 if(report.manifest.state!=='present')findings.push({id:'manifest',action:'Inspect the selected package manifest privately; it is missing, invalid or unavailable.'});
 if(report.purpose!=='general'&&report.manifest.emdashVersion!=='1.2.0')findings.push({id:'compatibility',action:'Verify the declared and installed EmDash version against current official documentation. This inspection does not certify this project version.'});
 for(const item of report.guidance.filter(item=>item.state!=='present'))findings.push({id:item.path,action:'Ask the agent to inspect existing project intent before proposing this guidance file. Preserve existing or inaccessible files.'});
 for(const skill of report.skills.filter(item=>item.required)){
  if(skill.state==='absent')findings.push({id:skill.id,action:'No canonical project-local entrypoint was found. Check the actual agent’s user/plugin skills before proposing an installation; do not duplicate an existing usable copy.'});
  else if(skill.entrypoint==='unmatched-preserve')findings.push({id:skill.id,action:'Keep this existing entrypoint. It differs from the reviewed upstream entrypoint; inspect its source and references privately before considering an update.'});
  else if(skill.state!=='present')findings.push({id:skill.id,action:'The existing entrypoint could not be safely inspected. Preserve it and resolve the specific file/access condition.'});
 }return findings;
}
const fail=()=>{throw Error('Use a current Get Ready project-inspection report. Its contents were not displayed; the previous report is preserved.');};
function keys(value,expected){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==expected.length||expected.some(k=>!Object.hasOwn(value,k)))fail();}
function equal(value,expected){if(JSON.stringify(value)!==JSON.stringify(expected))fail();}
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function file(value,extra=[]){keys(value,[...extra,'state',...(value?.state==='present'?['sha256']:[])]);if(!['present','absent','refused','oversize','changed','denied'].includes(value.state)||(value.state==='present'&&!hash(value.sha256)))fail();}
export function validateProjectReport(input,now=Date.now()){
 keys(input,['version','kind','inspectedAt','workspaceFingerprint','purpose','readOnly','ready','manifest','lockfiles','guidance','skills','source','optional','findings','limits']);
 if(input.version!==1||input.kind!=='app-composer.project-inspection'||input.readOnly!==true||input.ready!==false||!hash(input.workspaceFingerprint)||!['general','emdash-site','emdash-plugin'].includes(input.purpose))fail();
 const time=Date.parse(input.inspectedAt);if(typeof input.inspectedAt!=='string'||!Number.isFinite(time)||new Date(time).toISOString()!==input.inspectedAt||!Number.isFinite(now)||time>now+300000)fail();
 const m=input.manifest;keys(m,['state','emdashDeclared','emdashVersion','installedVersion','commands']);keys(m.commands,['build','test','check']);if(!['present','absent','invalid','refused','oversize','changed','denied'].includes(m.state)||typeof m.emdashDeclared!=='boolean'||m.installedVersion!=='not-probed'||Object.values(m.commands).some(v=>typeof v!=='boolean')||(m.emdashVersion!==null&&declaredProjectVersion(m.emdashVersion)!==m.emdashVersion)||(!m.emdashDeclared&&m.emdashVersion!==null)||(m.state!=='present'&&(m.emdashDeclared||m.emdashVersion!==null||Object.values(m.commands).some(Boolean))))fail();
 if(!Array.isArray(input.guidance)||input.guidance.length!==projectGuidance.length)fail();input.guidance.forEach((item,i)=>{file(item,['path']);if(item.path!==projectGuidance[i])fail();});
 const locks=['pnpm-lock.yaml','package-lock.json','yarn.lock','bun.lock'];if(!Array.isArray(input.lockfiles)||input.lockfiles.length>4||new Set(input.lockfiles.map(item=>item?.path)).size!==input.lockfiles.length)fail();for(const item of input.lockfiles){file(item,['path']);if(!locks.includes(item.path)||item.state==='absent')fail();}
 if(!Array.isArray(input.skills)||input.skills.length!==catalogue.skills.length)fail();input.skills.forEach((item,i)=>{file(item,['id','path','required','entrypoint','agentVisible','exercised']);const expected=catalogue.skills[i];if(item.id!==expected.id||item.path!=='.agents/skills/'+expected.id+'/SKILL.md'||item.required!==projectSkillRequired(input.purpose,item.id)||item.agentVisible!=='not-probed'||item.exercised!==false||item.entrypoint!==(item.state!=='present'?'not-inspected':item.sha256===expected.entrypointSha256?'matches-reviewed':'unmatched-preserve'))fail();});
 keys(input.source,['reviewed','repository','commit','licence','documentation']);for(const key of Object.keys(input.source))if(input.source[key]!==catalogue[key])fail();keys(input.optional,['diagrams']);if(!['requested-not-probed','not-requested'].includes(input.optional.diagrams))fail();
 if(!Array.isArray(input.findings)||input.findings.length>10)fail();for(const f of input.findings){keys(f,['id','action']);if(typeof f.id!=='string'||typeof f.action!=='string')fail();}equal(input.findings,projectFindings(input));if(!Array.isArray(input.limits)||input.limits.some(v=>typeof v!=='string'))fail();equal(input.limits,projectLimits);
 // Return a detached validated observation; callers cannot mutate their source through it.
 return JSON.parse(JSON.stringify(input));
}
export function inspectProjectReport(input,now=Date.now()){
 const report=validateProjectReport(input,now),stale=now-Date.parse(report.inspectedAt)>3600000;
 return {report,stale,ready:false,summary:stale?'Ask for a fresh inspection':'Project observation received',next:projectFindings(report)};
}
export function fictionalProjectReport(now=Date.now()){
 const report={version:1,kind:'app-composer.project-inspection',inspectedAt:new Date(now).toISOString(),workspaceFingerprint:'f'.repeat(64),purpose:'emdash-site',readOnly:true,ready:false,manifest:{state:'present',emdashDeclared:true,emdashVersion:'1.2.0',installedVersion:'not-probed',commands:{build:true,test:true,check:false}},lockfiles:[{path:'pnpm-lock.yaml',state:'present',sha256:'a'.repeat(64)}],guidance:projectGuidance.map((path,i)=>({path,state:i===2?'absent':'present',...(i===2?{}:{sha256:'b'.repeat(64)})})),skills:catalogue.skills.map((skill,i)=>({id:skill.id,path:'.agents/skills/'+skill.id+'/SKILL.md',required:projectSkillRequired('emdash-site',skill.id),state:i===2?'absent':'present',...(i===2?{}:{sha256:i===0?'c'.repeat(64):skill.entrypointSha256}),entrypoint:i===2?'not-inspected':i===0?'unmatched-preserve':'matches-reviewed',agentVisible:'not-probed',exercised:false})),source:Object.fromEntries(['reviewed','repository','commit','licence','documentation'].map(key=>[key,catalogue[key]])),optional:{diagrams:'not-requested'},findings:[],limits:[...projectLimits]};report.findings=projectFindings(report);return validateProjectReport(report,now);
}

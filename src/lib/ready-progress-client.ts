import {validateReadinessReport,inspectReadinessReport,progressChecks,progressOperationLabels,progressStep,type ReadinessReport} from '../../lib/get-ready/report.mjs';
const container=document.querySelector<HTMLElement>('[data-ready-progress]')!;
const fileInput=container.querySelector<HTMLInputElement>('[data-progress-file]')!;
const message=container.querySelector<HTMLElement>('[data-progress-message]')!;
let report:ReadinessReport|null=null,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
const toolNames:Record<string,string>={git:'Git',gh:'GitHub CLI',pnpm:'pnpm',agent:'Codex workspace'};
const node=(tag:string,text:string,className='')=>{const element=document.createElement(tag);element.textContent=text;element.className=className;return element;};
function refresh(){
 clearTimeout(timer);
 const list=container.querySelector('[data-progress-checks]')!;
 const operations=container.querySelector<HTMLElement>('[data-progress-operations]')!;
 const actions=container.querySelector<HTMLElement>('[data-progress-actions]')!;
 const disclaimer=container.querySelector<HTMLElement>('[data-progress-disclaimer]')!;
 operations.replaceChildren();operations.hidden=true;actions.hidden=!report;disclaimer.hidden=!report;
 const overview=container.querySelector('[data-progress-overview]')!;
 if(!report){overview.textContent='No report loaded.';list.replaceChildren(...Object.values(progressChecks).map(check=>{const row=document.createElement('li');row.append(node('h3',check.label),node('span','Not checked here','small'),node('p',check.help,'small'));return row;}));return;}
 const {inspection}=inspectReadinessReport(report);
 const date=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(report.exportedAt));
 const count=Object.values(inspection.capabilities).filter(Boolean).length;
 overview.textContent=`Report from ${date}. ${count} of 4 checks are current in this report.${report.operations.length?' Setup still needs review.':''}`;
 list.replaceChildren(...report.checks.map(check=>{
  const current=inspection.capabilities[check.id];
  const label=current?'Verified in report':check.state==='verified'?'Check again':check.recovery==='human-authentication'?'Sign-in needed':check.recovery==='human-permission'?'Permission needs review':check.recovery==='agent-retry'?'Agent retry needed':check.state==='not_started'?'Not checked':'Agent action needed';
  const row=document.createElement('li');row.append(node('h3',progressChecks[check.id].label),node('strong',label,current?'pass':'needs-attention'),node('p',progressStep(check,current),'small'));
  if(check.tools.length)row.append(node('p',check.tools.map(tool=>`${toolNames[tool.tool]}: ${tool.state==='inactive'?'no active session':tool.state==='missing'?'missing':'needs repair'}`).join(' · '),'small'));
  return row;
 }));
 if(report.operations.length){operations.hidden=false;operations.append(node('h3','Unfinished setup'));for(const operation of report.operations)operations.append(node('p',`${progressOperationLabels[operation.id]}: ${operation.state==='prepared'?'prepared for review':'needs agent inspection'}. No retry is automatic.`,'small'));}
 const boundaries=report.checks.filter(check=>inspection.capabilities[check.id]&&check.verifiedAt).map(check=>Date.parse(check.verifiedAt!)+3600000);
 if(report.expiresAt&&Date.parse(report.expiresAt)>Date.now())boundaries.push(Date.parse(report.expiresAt));
 const next=Math.min(...boundaries);if(Number.isFinite(next))timer=setTimeout(refresh,Math.max(1,next-Date.now()+1));
}
fileInput.addEventListener('change',async()=>{
 const attempt=++generation,file=fileInput.files?.[0];if(!file)return;
 try{
  if(file.size>16384)throw Error('Choose a Get Ready progress report under 16 KB.');
  const text=await file.text();if(attempt!==generation)return;
  const selected=validateReadinessReport(JSON.parse(text));report=selected;refresh();message.textContent='Report opened on this device. No setup action was run.';
 }catch(error){if(attempt!==generation)return;message.textContent=(error instanceof SyntaxError?'This is not a JSON progress report. Ask your agent for the redacted export.':error instanceof Error?error.message:'The report could not be read.')+(report?' Your previous report is still shown.':'');}
});
container.querySelector('[data-clear-progress]')!.addEventListener('click',()=>{generation++;report=null;fileInput.value='';message.textContent='Report cleared from this page.';refresh();});
window.addEventListener('pageshow',()=>{if(report)refresh();});

fileInput.disabled=false;

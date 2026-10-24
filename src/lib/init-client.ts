import { HANDOFF_KEY } from './workbench';
import {renderAppPreview} from './app-preview';
import {currentAssistance} from './assistance';
import {presetRecommendation,recommendationSpec,assistedHandoff,initialRecommendation} from './init-recommendations.mjs';
import {setupPreferenceKey,validateSetupPreferences} from '../../lib/get-ready/preferences.mjs';
import {validateSpec,presets,specVersion} from './spec.mjs';
import {globalAppSettings as appSettings,selectedSources,appConfiguration} from './app-settings.mjs';
const form=document.querySelector<HTMLFormElement>('#init-form')!;
const message=document.querySelector<HTMLElement>('#message')!;
const key='composer:init:v1';let decisions:Record<string,string>={},displayedPreset='composition';
const draftStatus=document.querySelector<HTMLElement>('#draft-status')!;
const validationMessage=document.querySelector<HTMLElement>('#validation-message')!;
const importReview=document.querySelector<HTMLElement>('#import-review')!;
const importInput=document.querySelector<HTMLInputElement>('#import')!;
let observedSnapshot='',savedSnapshot:string|null=null,revision=0,pendingImport:ReturnType<typeof validateSpec>|null=null;
function snapshot(){return JSON.stringify({fields:Array.from(form.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input:not([type=file]),textarea,select')).map(control=>[control.name,control.value,'checked' in control?control.checked:null]),decisions});}
function updateDraftStatus(){draftStatus.textContent=savedSnapshot===null?'New draft · not saved yet':savedSnapshot===snapshot()?'Saved on this device':'Unsaved changes';}
function dismissImport(){pendingImport=null;importReview.hidden=true;}
function edited(){const current=snapshot();if(current===observedSnapshot)return;observedSnapshot=current;revision++;dismissImport();message.textContent='';updateDraftStatus();}
function saveDraft(spec:ReturnType<typeof validateSpec>){
 try{localStorage.setItem(key,JSON.stringify(spec));savedSnapshot=snapshot();revision++;dismissImport();updateDraftStatus();message.textContent='Draft saved on this device. Nothing was deployed.';}
 catch{message.textContent='This browser could not save your draft. Your edits are still here; download the spec to keep a copy.';}
}
function report(error:unknown){message.textContent=error instanceof Error?error.message:String(error);}
function row(title='',url=''){const wrap=document.createElement('div');wrap.className='repeat-row';const l1=document.createElement('label');l1.textContent='Card title';const a=document.createElement('input');a.name='card-title';a.maxLength=100;a.required=true;a.value=title;l1.append(a);const l2=document.createElement('label');l2.textContent='HTTPS destination';const b=document.createElement('input');b.name='card-url';b.type='url';b.required=true;b.value=url;l2.append(b);const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Remove';remove.onclick=()=>{wrap.remove();edited();show();previewRecommendation();};wrap.append(l1,l2,remove);document.querySelector('#card-rows')!.append(wrap);}
function value(name:string){return (form.elements.namedItem(name) as HTMLInputElement).value;}
function read(preset=value('preset')){const selected=presets[preset].apps;const separate:Record<string,Record<string,string>>={};for(const id of selected){const toggle=form.querySelector<HTMLInputElement>(`[data-separate-settings="${id}"]`);if(toggle?.checked)separate[id]=Object.fromEntries(Array.from(form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`[data-app-fields="${id}"] [data-app-field]`)).map(control=>[control.dataset.appField!,control.value]));}const cards=Array.from(document.querySelectorAll('.repeat-row')).map(el=>({title:el.querySelector<HTMLInputElement>('[name=card-title]')!.value,url:el.querySelector<HTMLInputElement>('[name=card-url]')!.value}));return validateSpec({version:specVersion,sources:selectedSources(selected),appSettings:separate,deviceTarget:value('deviceTarget'),preset,config:{title:value('title'),intro:value('intro'),theme:value('theme'),layout:value('layout')},privacy:'review-first',deployment:{mode:value('target'),hostname:value('hostname')},cards,decisions});}
function conditions(){
 const p=value('preset');const selected=presets[p].apps;document.querySelector<HTMLElement>('#app-settings')!.hidden=p==='hello';for(const id of Object.keys(appSettings)){const group=form.querySelector<HTMLElement>(`[data-app-settings="${id}"]`)!;const toggle=form.querySelector<HTMLInputElement>(`[data-separate-settings="${id}"]`)!;const fields=form.querySelector<HTMLFieldSetElement>(`[data-app-fields="${id}"]`)!;group.hidden=!selected.includes(id);toggle.disabled=group.hidden;fields.hidden=group.hidden||!toggle.checked;fields.disabled=fields.hidden;}const hasCards=['composition','showcase'].includes(p),hasHostname=value('target')==='existing-domain';
 document.querySelector<HTMLElement>('#layout-label')!.hidden=p==='hello';
 (form.elements.namedItem('layout') as HTMLSelectElement).disabled=p==='hello';
 const cards=document.querySelector<HTMLFieldSetElement>('#cards-field')!;cards.hidden=!hasCards;cards.disabled=!hasCards;
 document.querySelector<HTMLElement>('#privacy')!.hidden=!['composition','guestbook'].includes(p);
 document.querySelector<HTMLElement>('#hostname-label')!.hidden=!hasHostname;
 const hostname=form.elements.namedItem('hostname') as HTMLInputElement;hostname.disabled=!hasHostname;hostname.required=hasHostname;
 document.querySelector('#target-help')!.textContent=value('target')==='new-domain'?'A new domain requires explicit owner purchase approval. This choice only explores that path.':'The agent verifies ownership, DNS and HTTPS before claiming readiness.';
}
function show(save=false){try{conditions();const s=read();renderAppPreview(s);validationMessage.textContent='';document.querySelector('#preview-caption')!.textContent='Layout preview · sample content';for(const id of ['copy','download'])(document.getElementById(id) as HTMLButtonElement).disabled=false;document.querySelector('#preview-title')!.textContent=s.config.title;document.querySelector('#preview-intro')!.textContent=s.config.intro;document.querySelector('#preview-apps')!.textContent=s.apps.map((id:string)=>appSettings[id]?.name??'Hello World reference').join(' + ');const preview=document.querySelector('#preview-settings')!;preview.replaceChildren();for(const id of s.apps.filter((id:string)=>Object.hasOwn(appSettings,id))){const c=appConfiguration(s,id),section=document.createElement('section'),heading=document.createElement('h3'),text=document.createElement('p'),appearance=document.createElement('p');heading.textContent=appSettings[id].name;text.textContent=c.title+(c.intro?' — '+c.intro:'');appearance.className='small';appearance.textContent=c.theme+' · '+c.layout+(s.appSettings[id]?' · separate settings':' · shared settings');section.append(heading,text,appearance);preview.append(section);}document.querySelector('#spec')!.textContent=JSON.stringify(s,null,2);document.querySelector('#prompt')!.textContent=assistedHandoff(s,currentAssistance());if(save)saveDraft(s);updateDraftStatus();}catch(e){document.querySelector('#spec')!.textContent='Complete the current fields before exporting.';document.querySelector('#prompt')!.textContent='Complete the current fields before copying a handoff.';for(const id of ['copy','download'])(document.getElementById(id) as HTMLButtonElement).disabled=true;document.querySelector('#preview-caption')!.textContent='Preview paused · last valid draft';validationMessage.textContent=(e instanceof Error?e.message:String(e))+'. The last valid preview stays visible while you finish editing.';updateDraftStatus();}}

function fill(input:any){const s=validateSpec(input);displayedPreset=s.preset;for(const [name,v] of Object.entries({...s.config,preset:s.preset,deviceTarget:s.deviceTarget??'unknown',target:s.deployment.mode,hostname:s.deployment.hostname}))(form.elements.namedItem(name) as HTMLInputElement).value=String(v);document.querySelector('#card-rows')!.replaceChildren();s.cards.forEach((c:any)=>row(c.title,c.url));for(const id of Object.keys(appSettings)){const toggle=form.querySelector<HTMLInputElement>(`[data-separate-settings="${id}"]`)!;toggle.checked=Object.hasOwn(s.appSettings,id);delete toggle.dataset.initialised;const fields=form.querySelector<HTMLFieldSetElement>(`[data-app-fields="${id}"]`)!;for(const control of fields.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('[data-app-field]'))control.value=s.appSettings[id]?.[control.dataset.appField!]??s.config[control.dataset.appField as keyof typeof s.config]??'';if(toggle.checked)toggle.dataset.initialised='true';}decisions=s.decisions;if(decisions.target==='existing-domain'&&s.deployment.mode==='preview')(form.elements.namedItem('target') as HTMLInputElement).value='existing-domain';show();}
const recommendationRoot=document.querySelector<HTMLElement>('[data-init-recommendation]')!;
const goal=recommendationRoot.querySelector<HTMLSelectElement>('[data-recommendation-goal]')!;
const useGoal=recommendationRoot.querySelector<HTMLButtonElement>('[data-recommendation-use]')!;
function candidateStartingPoint(id:string){
 const next=recommendationSpec(read(),id),retained=read(id);
 return validateSpec({...next,appSettings:retained.appSettings,cards:retained.cards,config:{...next.config,layout:retained.config.layout}});
}
function previewRecommendation(){
 const meta=presetRecommendation(goal.value);recommendationRoot.querySelector('[data-recommendation-reason]')!.textContent=meta.reason;recommendationRoot.querySelector('[data-recommendation-limit]')!.textContent=meta.limitation;
 const sources=recommendationRoot.querySelector('[data-recommendation-sources]')!;sources.replaceChildren();
 if(!meta.sources.length){const p=document.createElement('p');p.className='small';p.textContent='The Hello adapter checks the actual maintained source and selected owned repository. The agent verifies that source and target before applying these three fields.';sources.append(p);}
 for(const source of meta.sources){const p=document.createElement('p'),a=document.createElement('a'),revision=document.createElement('code');a.href=source.repository+'/tree/'+source.commit;a.textContent=source.id;revision.textContent=source.commit;p.append(a,document.createElement('br'),revision);sources.append(p);}
 const preview=recommendationRoot.querySelector('[data-recommendation-preview]')!;preview.replaceChildren();
 try{renderAppPreview(candidateStartingPoint(goal.value),preview);useGoal.disabled=false;recommendationRoot.querySelector('[data-recommendation-message]')!.textContent='Preview only. Use this starting point to change the draft.';}
 catch{useGoal.disabled=true;recommendationRoot.querySelector('[data-recommendation-message]')!.textContent='Complete the current app fields before previewing or applying a different starting point. Your entries are preserved.';}
}
function applyStartingPoint(id:string){
 const next=candidateStartingPoint(id);(form.elements.namedItem('preset') as HTMLSelectElement).value=next.preset;
 (form.elements.namedItem('title') as HTMLInputElement).value=next.config.title;(form.elements.namedItem('intro') as HTMLTextAreaElement).value=next.config.intro;
 decisions=next.decisions;displayedPreset=next.preset;goal.value=next.preset;edited();show();previewRecommendation();message.textContent='Starting point changed. Your draft has not been saved or deployed.';
}
goal.disabled=false;goal.addEventListener('change',previewRecommendation);useGoal.addEventListener('click',()=>{try{applyStartingPoint(goal.value);}catch(e){report(e);}});
window.addEventListener('composer:assistance-choice',()=>{try{document.querySelector('#prompt')!.textContent=assistedHandoff(read(),currentAssistance());}catch{}previewRecommendation();});
form.addEventListener('input',()=>{edited();show();previewRecommendation();});form.addEventListener('change',event=>{if(event.target===importInput)return;edited();previewRecommendation();});
try{const saved=localStorage.getItem(key);if(saved){fill(JSON.parse(saved));savedSnapshot=snapshot();}else{const choice=localStorage.getItem(setupPreferenceKey);if(choice){const preference=validateSetupPreferences(JSON.parse(choice));(form.elements.namedItem('target') as HTMLSelectElement).value=preference.destination;(form.elements.namedItem('hostname') as HTMLInputElement).value=preference.hostname;}}}catch(e){report(e);}
window.addEventListener('pageshow',()=>{show();previewRecommendation();});
for(const id of Object.keys(appSettings)){const toggle=form.querySelector<HTMLInputElement>(`[data-separate-settings="${id}"]`)!;toggle.addEventListener('change',()=>{if(toggle.checked&&!toggle.dataset.initialised){for(const control of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`[data-app-fields="${id}"] [data-app-field]`))control.value=(form.elements.namedItem(control.dataset.appField!) as HTMLInputElement|null)?.value??appSettings[id].fields.find(field=>field.key===control.dataset.appField)?.default??'';toggle.dataset.initialised='true';}show();});form.querySelector(`[data-app-defaults="${id}"]`)!.addEventListener('click',()=>{for(const field of appSettings[id].fields)(form.elements.namedItem(id+'-'+field.key) as HTMLInputElement).value=field.default??value(field.key);edited();show();previewRecommendation();});}
form.addEventListener('submit',e=>{e.preventDefault();show(true);});form.addEventListener('change',()=>show());form.querySelector('[name=preset]')!.addEventListener('change',()=>{const next=value('preset');(form.elements.namedItem('preset') as HTMLSelectElement).value=displayedPreset;try{applyStartingPoint(next);}catch(e){report(e);}});document.querySelector('#add-card')!.addEventListener('click',()=>{if(document.querySelectorAll('.repeat-row').length<8){row();edited();show();previewRecommendation();}else report('Eight cards is the supported limit.');});document.querySelector('#reset')!.addEventListener('click',()=>{
 if(!confirm('Discard the current and saved draft on this device?'))return;
 try{localStorage.removeItem(key);}catch{report(new Error('This browser could not remove the saved draft. Your current edits are preserved.'));return;}
 revision++;dismissImport();form.reset();for(const toggle of form.querySelectorAll<HTMLInputElement>('[data-separate-settings]'))delete toggle.dataset.initialised;decisions={};savedSnapshot=null;document.querySelector('#card-rows')!.replaceChildren();displayedPreset=value('preset');goal.value=displayedPreset;edited();show();previewRecommendation();
});document.querySelector('#copy')!.addEventListener('click',async()=>{
 let text:string;try{text=assistedHandoff(read(),currentAssistance());}catch(e){report(e);return;}
 try{await navigator.clipboard.writeText(text);message.textContent='Handoff copied. Paste it into Codex in your authorised project.';}
 catch{const prompt=document.querySelector<HTMLElement>('#prompt')!;prompt.textContent=text;prompt.closest('details')!.open=true;prompt.focus();const range=document.createRange();range.selectNodeContents(prompt);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);message.textContent='Clipboard access failed. The handoff is selected below; copy it using your browser.';}
});document.querySelector('#download')!.addEventListener('click',()=>{try{const url=URL.createObjectURL(new Blob([JSON.stringify(read(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='app-composer-spec.json';a.click();URL.revokeObjectURL(url);}catch(e){report(e);}});importInput.addEventListener('change',async()=>{
 const file=importInput.files?.[0];if(!file)return;importInput.value='';
 const selectedRevision=++revision;dismissImport();message.textContent='Reading the selected spec…';
 try{
  if(file.size>32768)throw new Error('Spec is too large. Use a file under 32 KB.');
  const text=await file.text();
  if(selectedRevision!==revision)return;
  const spec=validateSpec(JSON.parse(text));pendingImport=spec;
  document.querySelector('#import-summary')!.textContent=spec.config.title+' · '+spec.apps.map((id:string)=>appSettings[id]?.name??'Hello World reference').join(' + ')+' · '+spec.cards.length+' curated '+(spec.cards.length===1?'link':'links');
  importReview.hidden=false;message.textContent='Spec checked. Review it before replacing your current draft.';importReview.focus();
 }catch(e){if(selectedRevision===revision)report(e);}
});
document.querySelector('#replace-import')!.addEventListener('click',()=>{
 if(!pendingImport)return;
 const candidate=pendingImport;revision++;dismissImport();fill(candidate);goal.value=value('preset');edited();show();previewRecommendation();message.textContent='Imported into the form. Choose Save draft to keep it on this device.';(form.elements.namedItem('title') as HTMLInputElement).focus();
});
document.querySelector('#cancel-import')!.addEventListener('click',()=>{revision++;dismissImport();message.textContent='Import cancelled. Your current and saved drafts are unchanged.';importInput.focus();});
show();
observedSnapshot=snapshot();
// A demo link selects the recommendation only. Saved work changes after Use.
goal.value=initialRecommendation(location.search,value('preset'));
previewRecommendation();

// A workbench handoff is a separately staged candidate, never an Init save.
if(new URLSearchParams(location.search).get('start')==='workbench'){
 try{
  const raw=sessionStorage.getItem(HANDOFF_KEY);
  if(raw){
   const candidate=validateSpec(JSON.parse(raw));pendingImport=candidate;
   document.querySelector('#import-summary')!.textContent=candidate.config.title+' · Guestbook + Linkarooie · supported configuration only';
   importReview.hidden=false;
   message.textContent='Workbench starting point ready. Review it before replacing the form. Your saved draft is unchanged.';
   importReview.focus();
   sessionStorage.removeItem(HANDOFF_KEY);
  }
 }catch{message.textContent='The workbench starting point could not be validated. Your current and saved drafts are unchanged.';}
}

import {pruneAnswers,visibleQuestions,explorerSpec} from './spec.mjs';
import {initDraftReplacePrompt} from './handoff-draft.mjs';
import {createSaveStatus} from './explorer-status.mjs';
const key='composer:decisions:v1',draftKey='composer:init:v1';const root=document.querySelector('#questions')!;const message=document.querySelector('#message')!;let answers:Record<string,string>={};let scenarios:any[]=[];let owner='';
// Local storage can throw in private or restricted modes. Read and write through
// helpers, keep the page usable in memory and say plainly when saving is blocked.
function read(storeKey:string){try{return localStorage.getItem(storeKey);}catch{return null;}}
function write(storeKey:string,value:string){try{localStorage.setItem(storeKey,value);return true;}catch{return false;}}
// The blocked-storage notice has its own standing element, so an action message
// can never replace the reason this path is not being saved.
const saveStatus=createSaveStatus(document.querySelector('#save-status')!,message);
const saved=read(key);
if(saved!==null){try{const parsed=JSON.parse(saved);if(parsed.version===1){answers=pruneAnswers(parsed.answers??{});scenarios=Array.isArray(parsed.scenarios)?parsed.scenarios.slice(-12):[];owner=typeof parsed.owner==='string'?parsed.owner:'';}}catch{message.textContent='The saved decision file could not be read. Your next choices create a fresh path.';}}
function persist(){if(saveStatus.blocked())return;if(!write(key,JSON.stringify({version:1,answers,scenarios:scenarios.slice(-12),owner,status:'proposed',reviewed:'2026-10-13'})))saveStatus.refused();}
// Re-rendering replaces the controls, so remember which control had focus and
// restore it on the matching rebuilt control; otherwise keyboard users lose their place.
function render(){
 const active=document.activeElement as HTMLElement|null;const focusKey=active?.dataset.focusKey??null;
 answers=pruneAnswers(answers);root.replaceChildren();const visible=visibleQuestions(answers);
 for(const q of visible){const field=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=q.title;field.append(legend);const help=document.createElement('p');help.textContent=q.help;field.append(help);const group=document.createElement('div');group.className='choice-list';
  for(const [id,label,tradeoff] of q.options){const l=document.createElement('label');l.className='choice';const radio=document.createElement('input');radio.type='radio';radio.name=q.id;radio.value=id;radio.checked=answers[q.id]===id;radio.dataset.focusKey='radio:'+q.id+':'+id;radio.onchange=()=>{scenarios.push({answers:{...answers},changed:q.id,prior:answers[q.id]??null});answers[q.id]=id;persist();render();};const words=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=label+(q.recommend===id?' · Recommended':'');small.textContent=tradeoff;words.append(strong,small);l.append(radio,words);group.append(l);}
  field.append(group);const defer=document.createElement('button');defer.type='button';defer.className='secondary';defer.textContent='Defer this choice';defer.dataset.focusKey='defer:'+q.id;defer.onclick=()=>{delete answers[q.id];persist();render();};const explain=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p');summary.textContent='Not sure? Explain the recommendation';p.textContent=q.help+' You can change this later. “Choose for me” uses the supported default; it cannot approve a purchase or privileged action.';explain.append(summary,p);field.append(explain,defer);root.append(field);
 }
 const target=document.querySelector('#summary')!;target.replaceChildren();for(const q of visible){const p=document.createElement('p');const option=q.options.find((o:any)=>o[0]===answers[q.id]);p.textContent=q.title+' '+(option?option[1]:'Deferred; safe default will be proposed.');target.append(p);}const progress=document.createElement('p');progress.textContent=visible.filter((q:any)=>!answers[q.id]).length+' relevant choices remain.';target.prepend(progress);document.querySelector('#branch-blocker')!.textContent=answers.target==='new-domain'?'Purchase approval required before any registrar action.':answers.target==='existing-domain'?'Provide a hostname in Init. The agent must verify control and conflicting DNS.':'A preview deploy still needs a verified account and agent workspace.';persist();
 if(focusKey){const next=root.querySelector<HTMLElement>('[data-focus-key="'+CSS.escape(focusKey)+'"]');if(next&&!(next instanceof HTMLButtonElement&&next.disabled))next.focus({preventScroll:true});}
}
document.querySelector('#default')!.addEventListener('click',()=>{answers.goal??='composition';answers.target??='preview';answers.appearance??='daylight';if(['composition','guestbook'].includes(answers.goal))answers.privacy='review-first';render();saveStatus.action('Safe defaults proposed. No execution or approval occurred.');});
document.querySelector('#clear')!.addEventListener('click',()=>{scenarios.push({answers:{...answers}});answers={};render();});
document.querySelector('#use')!.addEventListener('click',()=>{try{const a={...answers};if(a.target==='existing-domain')a.target='preview';const s=explorerSpec(a);if(answers.target==='existing-domain'){s.decisions.target='existing-domain';}
 // Never replace an Init draft on this device without saying so first.
 const existing=read(draftKey),prompt=initDraftReplacePrompt(existing);
 if(prompt&&!confirm(prompt))return;
 if(!write(draftKey,JSON.stringify(s))){saveStatus.refused();saveStatus.action('Init could not be given these decisions.',{saved:false});return;}
 saveStatus.saved();saveStatus.action('Decisions handed to Init. The draft there is already loaded.');location.href='/init';
}catch(e){message.textContent=(e as Error).message;}});
document.querySelector('#export')!.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,answers,scenarios,owner,status:'proposed'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='composer-decisions.json';a.click();URL.revokeObjectURL(url);saveStatus.action('Decisions file downloaded. Keep it with your own notes.');});
const select=document.querySelector<HTMLSelectElement>('#owner-priority')!;select.value=owner;select.onchange=()=>{owner=select.value;document.querySelector('#owner-help')!.textContent=owner==='encrypted-state'?'Requires the fictional-only privacy and key-custody gates in #31–34.':owner==='onboarding'?'Prioritises the narrow supported Get Ready/Init journey in #14–21.':'Keeps the first pair and its lifecycle proof central (#3–9, #24–25).';persist();};
render();

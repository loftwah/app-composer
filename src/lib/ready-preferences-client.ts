import {setupPreferenceKey,defaultSetupPreferences,validateSetupPreferences,type SetupPreferences} from '../../lib/get-ready/preferences.mjs';
const form=document.querySelector<HTMLFormElement>('[data-setup-preferences]')!;
const hostname=form.elements.namedItem('setup-hostname') as HTMLInputElement;
const message=form.querySelector<HTMLElement>('[data-setup-choice-message]')!;
function destination(){return (form.elements.namedItem('destination') as RadioNodeList).value;}
function read(){return validateSetupPreferences({version:1,destination:destination(),hostname:hostname.value});}
function publish(preferences:SetupPreferences|null){window.dispatchEvent(new CustomEvent('composer:setup-choice',{detail:preferences}));}
function draft(){const state=history.state?.composerReadyDraft;return state&&typeof state==='object'&&['preview','existing-domain','new-domain'].includes(state.destination)&&typeof state.hostname==='string'&&state.hostname.length<=253?state:null;}
function restoreDraft(){const state=draft();if(state){(form.elements.namedItem('destination') as RadioNodeList).value=state.destination;hostname.value=state.hostname;}}
function change(){
 const mode=destination();
 try{history.replaceState({...((history.state&&typeof history.state==='object')?history.state:{}),composerReadyDraft:{destination:mode,hostname:hostname.value}},'');}catch{}hostname.disabled=mode!=='existing-domain';hostname.required=!hostname.disabled;
 form.querySelector<HTMLElement>('[data-setup-hostname-label]')!.hidden=hostname.disabled;
 form.querySelector('[data-setup-choice-help]')!.textContent=mode==='existing-domain'?'Selecting a hostname does not verify ownership or authorise changes to DNS. The agent checks for conflicts first.':mode==='new-domain'?'A new domain is exploration only. The agent must obtain your approval for its actual price and registration; a saved choice cannot approve a purchase.':'Use the existing supported Cloudflare account. A free address does not make usage unlimited; your agent should review the actual account limits.';
 try{publish(read());message.textContent='Unsaved address choice. Save it to carry it into Init.';}catch(error){publish(null);message.textContent=error instanceof Error?error.message:'Enter a supported hostname.';}
}
try{const saved=localStorage.getItem(setupPreferenceKey);if(draft()){restoreDraft();change();}else if(saved){const selected=validateSetupPreferences(JSON.parse(saved));(form.elements.namedItem('destination') as RadioNodeList).value=selected.destination;hostname.value=selected.hostname;change();message.textContent='Saved address choice restored on this device.';}}
catch{message.textContent='The saved address choice could not be restored. It has been left untouched; save a new choice to replace it.';}
form.addEventListener('input',()=>change());form.addEventListener('change',()=>change());
window.addEventListener('pageshow',()=>{restoreDraft();change();});
form.addEventListener('submit',event=>{event.preventDefault();try{const selected=read();if(selected.destination==='existing-domain')hostname.value=selected.hostname;change();localStorage.setItem(setupPreferenceKey,JSON.stringify(selected));publish(selected);message.textContent='Address choice saved on this device. Your agent still verifies the destination.';}catch(error){message.textContent=error instanceof Error?error.message:'Could not save. This browser may block local storage.';}});
form.querySelector('[data-forget-setup]')!.addEventListener('click',()=>{try{localStorage.removeItem(setupPreferenceKey);form.reset();hostname.value='';change();publish({...defaultSetupPreferences});message.textContent='Saved address choice cleared. The temporary-address default is selected.';}catch{message.textContent='Could not clear saved choices. Check this browser’s storage settings.';}});
for(const button of form.querySelectorAll<HTMLButtonElement>('button'))button.disabled=false;

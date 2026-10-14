import {assistancePreferenceKey,defaultAssistancePreference,assistanceLevels,validateAssistancePreference,type AssistancePreference} from '../../lib/get-ready/preferences.mjs';
const eventName='composer:assistance-choice';
let selected:AssistancePreference={...defaultAssistancePreference},notice='';
try{const saved=localStorage.getItem(assistancePreferenceKey);if(saved){if(saved.length>256)throw Error();selected=validateAssistancePreference(JSON.parse(saved));}}catch{notice='A saved help preference could not be read. It has been left untouched.';}
const urlLevel=new URL(location.href).searchParams.get('assistance');if(urlLevel){try{selected=validateAssistancePreference({version:1,level:urlLevel});}catch{notice='The link’s help preference was ignored. Existing choices are preserved.';}}
export function currentAssistance(){return {...selected};}
function destinations(){for(const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')){let url:URL;try{url=new URL(a.href);}catch{continue;}if(url.origin!==location.origin||!['/ready','/ready/guide','/init','/init/content','/explore','/learn'].includes(url.pathname))continue;url.searchParams.set('assistance',selected.level);a.href=url.pathname+url.search+url.hash;}}
function present(){
 document.documentElement.dataset.assistance=selected.level;
 for(const root of document.querySelectorAll<HTMLElement>('[data-assistance-control]')){root.querySelector<HTMLSelectElement>('[data-assistance-select]')!.value=selected.level;root.querySelector('[data-assistance-help]')!.textContent=assistanceLevels[selected.level].help;root.querySelector('[data-assistance-status]')!.textContent=notice;}
 for(const details of document.querySelectorAll<HTMLDetailsElement>('[data-assistance-detail]'))details.open=selected.level==='advanced';
 for(const help of document.querySelectorAll<HTMLElement>('[data-assistance-guided]'))help.hidden=selected.level==='easy';
 destinations();window.dispatchEvent(new CustomEvent(eventName,{detail:currentAssistance()}));
}
export function initialiseAssistance(){
 for(const root of document.querySelectorAll<HTMLElement>('[data-assistance-control]')){const control=root.querySelector<HTMLSelectElement>('[data-assistance-select]')!;if(control.dataset.initialised)continue;control.dataset.initialised='true';control.disabled=false;control.addEventListener('change',()=>{selected=validateAssistancePreference({version:1,level:control.value});notice='Help level saved on this device.';try{localStorage.setItem(assistancePreferenceKey,JSON.stringify(selected));}catch{notice='This browser cannot save the preference. It stays active here and travels in links to the next step.';}try{const url=new URL(location.href);url.searchParams.set('assistance',selected.level);history.replaceState(history.state,'',url);}catch{}present();});}
 present();
}
window.addEventListener('pageshow',()=>{const level=new URL(location.href).searchParams.get('assistance');if(level){try{selected=validateAssistancePreference({version:1,level});}catch{}}present();});
document.addEventListener('click',event=>{if((event.target as Element)?.closest?.('a[href]'))destinations();},true);

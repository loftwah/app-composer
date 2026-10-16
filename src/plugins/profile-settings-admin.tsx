import {useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {profileSettingsFile,type ProfileSettingsFile,type ProfileValues} from '../lib/miniapp-profile-settings-fields.mjs';
import type {ProfileReview} from '../lib/miniapp-profile-settings.mjs';
export type ProfileFileDraft={selection:string;name:string;file:ProfileSettingsFile|null;reading:boolean;needsReview:boolean;review?:ProfileReview;status:string};
export const profileFileUnsaved=(draft:ProfileFileDraft|undefined)=>!!draft&&(draft.reading||draft.needsReview||!!draft.review?.changedFields.length);
const labels:Record<keyof ProfileValues,string>={title:'Profile name',intro:'Introduction',theme:'Theme',layout:'Layout',handle:'Handle',website:'Website',github:'GitHub',bluesky:'Bluesky',linkedin:'LinkedIn'};
type Props={draft?:ProfileFileDraft;change:Dispatch<SetStateAction<ProfileFileDraft|undefined>>;busy:boolean;settingsDirty:boolean;request:(operation:'export'|'review'|'apply',fields?:Record<string,unknown>)=>Promise<any>};
export function ProfileSettings({draft,change,busy,settingsDirty,request}:Props){
 const [expanded,setExpanded]=useState(!!draft),[status,setStatus]=useState('');
 const input=useRef<HTMLInputElement>(null),comparison=useRef<HTMLHeadingElement>(null),message=useRef<HTMLParagraphElement>(null);
 const pending=busy||!!draft?.reading;
 const readFile=async(file:File)=>{
  const selection=crypto.randomUUID();setStatus('');change({selection,name:file.name,file:null,reading:true,needsReview:true,status:'Reading settings file…'});
  try{
   if(!file.name.toLowerCase().endsWith('.json')||file.size>32768)throw Error('Choose a .json settings file up to 32 KiB.');
   const parsed=profileSettingsFile(JSON.parse(await file.text()));
   change(previous=>previous?.selection===selection?{...previous,file:parsed,reading:false,status:'Review this file before applying it.'}:previous);
  }catch(error){change(previous=>previous?.selection===selection?{...previous,reading:false,status:error instanceof SyntaxError?'This file is not readable JSON. Choose a Linkarooie settings export.':error instanceof Error?error.message:'This settings file could not be read.'}:previous);}
 };
 const review=async()=>{
  if(pending||!draft?.file)return;setStatus('');const selection=draft.selection;
  change(previous=>previous?.selection===selection?{...previous,needsReview:true,status:'Reviewing profile settings…'}:previous);
  try{
   const result=await request('review',{file:draft.file});
   change(previous=>previous?.selection===selection?{...previous,review:result,needsReview:false,status:result.changedFields.length?'Review the changes below, then apply when ready.':'This file matches your saved profile. Nothing needs applying.'}:previous);
   setTimeout(()=>comparison.current?.focus(),0);
  }catch(error){change(previous=>previous?.selection===selection?{...previous,needsReview:true,status:error instanceof Error?error.message:'The review could not be completed. Your saved settings were not changed.'}:previous);}
 };
 const apply=async()=>{
  if(pending||settingsDirty||!draft?.file||!draft.review||draft.needsReview||!draft.review.changedFields.length)return;
  setStatus('');const selection=draft.selection;change(previous=>previous?.selection===selection?{...previous,needsReview:true,status:'Applying reviewed profile settings…'}:previous);
  try{
   await request('apply',{file:draft.file,expected:draft.review.before});
   change(undefined);if(input.current)input.current.value='';setStatus('Profile settings applied. Open the live app to see the result.');setTimeout(()=>message.current?.focus(),0);
  }catch(error){change(previous=>previous?.selection===selection?{...previous,needsReview:true,status:(error instanceof Error?error.message:'The save could not be confirmed.')+' Review this file again to compare the saved settings before another apply.'}:previous);setTimeout(()=>message.current?.focus(),0);}
 };
 const download=async()=>{
  if(pending)return;setStatus('Preparing profile settings…');
  try{
   const result=await request('export'),file=profileSettingsFile(result.file),url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)+'\n'],{type:'application/json'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download='linkarooie-profile.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);setStatus('The profile settings file is ready.');
  }catch(error){setStatus(error instanceof Error?error.message:'The settings file could not be prepared.');}
 };
 return <details className="ca-disclosure ca-profile-portability" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Move profile settings</summary>
  <p>Take your name, bio, appearance and social links with you. Your links, milestones, tags and photos stay in this app.</p>
  <button type="button" disabled={pending} onClick={()=>void download()}>Download profile settings</button>
  <div className="ca-form"><label>Profile settings file<input ref={input} type="file" accept=".json,application/json" disabled={pending} aria-describedby="ca-profile-file-help" onChange={event=>{const file=event.currentTarget.files?.[0];if(file)void readFile(file);}}/></label><p className="ca-muted" id="ca-profile-file-help">Choose a Linkarooie JSON settings file, up to 32 KiB. Reviewing saves nothing.</p>
  {draft&&<p className="ca-retained-text">Selected file: {draft.name}</p>}
  <div className="ca-actions"><button type="button" disabled={pending||!draft?.file} onClick={()=>void review()}>Review settings file</button>{draft&&<button type="button" disabled={pending} onClick={()=>{change(undefined);if(input.current)input.current.value='';setStatus('Review closed.');input.current?.focus();}}>Cancel review</button>}</div></div>
  {draft?.review&&<section aria-labelledby="ca-profile-comparison"><h3 id="ca-profile-comparison" ref={comparison} tabIndex={-1}>Review profile changes</h3><p>Applying these settings updates the public profile immediately.</p><dl>{draft.review.changedFields.map(key=><div key={key}><dt>{labels[key]}</dt><dd>Saved: {draft.review!.before[key]||'Not set'}</dd><dd>From file: {draft.review!.after[key]||'Not set'}</dd></div>)}</dl>{settingsDirty&&<p role="status">Save your app settings edits or restore their saved values before applying this file.</p>}<button type="button" disabled={pending||settingsDirty||draft.needsReview||!draft.review.changedFields.length} onClick={()=>void apply()}>Apply reviewed settings</button></section>}
  <p ref={message} tabIndex={-1} role="status" aria-live="polite">{status||draft?.status}</p>
 </details>;
}

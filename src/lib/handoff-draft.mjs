// Copy for handing the decision path to Init as `composer:init:v1`, kept apart
// from the page script so the exact promise made to the reader is unit-tested.
// A saved draft is only replaced after the reader confirms; the label names the
// draft when its own stored title is readable, and stays generic otherwise.
export function initDraftDescription(raw){
 if(typeof raw!=='string')return 'the saved Init draft';
 try{
  const parsed=JSON.parse(raw);
  const title=parsed?.config?.title;
  if(typeof title==='string'&&title.trim())return 'the saved Init draft “'+title.trim()+'”';
 }catch{}
 return 'the saved Init draft';
}
export function initDraftReplacePrompt(raw){
 if(raw===null||raw===undefined)return null;
 return 'Replace '+initDraftDescription(raw)+' on this device with these decisions? Choose Cancel, then Download decisions to keep both.';
}

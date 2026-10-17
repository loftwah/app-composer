// A blocked local store is a standing condition, not a passing message. The
// notice keeps its own element so later action feedback cannot replace it, and an
// action that needed storage says plainly that nothing was saved rather than
// implying the work was kept. The copy lives here, apart from the page script,
// so the exact promise made to the reader is unit-tested.
export const blockedStorageNotice='This browser blocked local storage, so this path cannot be saved on this device. Use Download decisions to keep a copy.';
export function createSaveStatus(status,message){
 let blocked=false;
 const paint=()=>{status.textContent=blocked?blockedStorageNotice:'';status.hidden=!blocked;};
 paint();
 return {
  blocked:()=>blocked,
  // Called whenever a write is refused. The notice appears and stays until a
  // write succeeds again.
  refused(){blocked=true;paint();},
  saved(){blocked=false;paint();},
  // Transient feedback for one action. It never clears the standing notice, and
  // an action that needed blocked storage is reported as unsaved.
  action(text,{saved=true}={}){message.textContent=blocked&&!saved?text+' Nothing was saved on this device.':text;},
 };
}

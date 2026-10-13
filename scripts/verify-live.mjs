import {setTimeout as delay} from 'node:timers/promises';
export async function verifyLive(source,lock,origin='https://composer.loftwah.com'){
 let reason='Deployment has not propagated';
 for(let attempt=0;attempt<20;attempt++){
  try{
   const identity=async(path)=>{const res=await fetch(origin+path+'?verification='+Date.now(),{headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('HTTP '+res.status+' at '+path);return res.json();};
   const root=await identity('/build.json');if(root.commit!==source)throw Error('Root source is still '+root.commit);
   for(const a of lock.apps){const mounted=await identity('/'+a.id+'/build.json');if(mounted.app!==a.id||mounted.revision!==a.commit||mounted.dataVersion!==a.manifest.dataVersion)throw Error('Mounted pin differs: '+a.id);}
   return;
  }catch(error){reason=error.message;if(attempt<19)await delay(1500);}
 }
 throw Error('Live source verification failed after bounded propagation checks: '+reason);
}

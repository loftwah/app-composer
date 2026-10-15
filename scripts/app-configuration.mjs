import {validateSpec} from '../src/lib/spec.mjs';
import {appConfigurationPatch,appSettings,validateConfigurationPatch} from '../src/lib/app-settings.mjs';

export function configurationPlan(input,apps){
 const spec=validateSpec(input);
 return spec.sources.map(source=>{
  const app=apps.find(value=>value.id===source.id);
  if(!app||app.url!=='https://'+source.id+'.loftwah.com'||['repository','commit','manifestDigest'].some(key=>app[key]!==source[key]))throw Error('Selected source changed; review the current contracts before applying this specification.');
  return {id:app.id,url:app.url,source:{...source},configuration:appConfigurationPatch(spec,app.id)};
 });
}

export async function verifyConfigurationTarget(app,request=fetch){
 if(!app||!Object.hasOwn(appSettings,app.id)||app.url!=='https://'+app.id+'.loftwah.com'||!app.source||Object.entries(appSettings[app.id].source).some(([key,value])=>app.source[key]!==value))throw Error('Unsupported operator configuration source.');
 for(const url of [app.url+'/build.json','https://composer.loftwah.com/'+app.id+'/build.json']){
  const response=await request(url,{redirect:'error',headers:{'User-Agent':'Mozilla/5.0 (AppComposer verification)'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Current app source could not be checked for '+app.id+'.');
  const build=await response.json();if(build.revision!==app.source.commit)throw Error('Current app source changed for '+app.id+'. Inspect completed settings before explicitly retrying.');
 }
}

// Existing operator targets only. The caller owns fresh workspace/readiness guards.
// Each response must confirm its exact data; no retry or rollback is automatic.
export async function applyConfiguration(plan,{credential,beforeWrite,request=fetch}){
 if(typeof credential!=='function'||typeof beforeWrite!=='function')throw Error('Configuration requires explicit owner credentials and a current workspace guard.');
 if(!Array.isArray(plan)||!plan.length||plan.length>2)throw Error('Select one or both supported operator apps.');
 const ids=new Set();
 for(const app of plan){
  if(!app||!Object.hasOwn(appSettings,app.id)||ids.has(app.id)||app.url!=='https://'+app.id+'.loftwah.com'||!app.source||Object.entries(appSettings[app.id].source).some(([key,value])=>app.source[key]!==value))throw Error('Unsupported operator configuration target.');
  ids.add(app.id);validateConfigurationPatch(app.configuration,app.id);
 }
 const completed=[];
 for(const app of plan){
  await beforeWrite(app);const token=await credential(app.id);
  if(typeof token!=='string'||!token.trim())throw Error('Missing owner credential for '+app.id+'.');
  const response=await request(app.url+'/api/config',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.trim(),'User-Agent':'Mozilla/5.0 (AppComposer verification)'},body:JSON.stringify(app.configuration)});
  if(!response.ok)throw Error('Configuration failed for '+app.id+': '+response.status+'. Inspect completed settings before explicitly retrying.');
  let value;try{value=await response.json();}catch{throw Error('Configuration response could not be verified for '+app.id+'.');}
  if(value?.ok!==true||!value.config||Object.entries(app.configuration).some(([key,expected])=>value.config[key]!==expected))throw Error('Configuration response did not match the selected settings for '+app.id+'. Inspect live settings before explicitly retrying.');
  completed.push(app.id);
 }
 return {configured:completed,deployed:false};
}

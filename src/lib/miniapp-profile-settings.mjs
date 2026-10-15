import {profileSettings,profileSettingsFile,profileSettingKeys} from './miniapp-profile-settings-fields.mjs';
const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
export function profileSettingsCommand(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||bytes(input)>65536)throw Error('Use a bounded profile settings command.');
 if(input.operation==='export'&&exact(input,['operation']))return null;
 if(input.operation==='review'&&exact(input,['operation','file']))return {action:'review',file:profileSettingsFile(input.file)};
 if(input.operation==='apply'&&exact(input,['operation','file','expected']))return {action:'apply',file:profileSettingsFile(input.file),expected:profileSettings(input.expected)};
 throw Error('Choose a supported profile settings operation.');
}
export function profileSettingsResult(operation,result,requested){
 if(!['export','review','apply'].includes(operation))throw Error('Unsupported settings result.');
 if(operation==='export')return {ok:true,file:profileSettingsFile(result)};
 const reviewing=operation==='review';
 if(!exact(result,reviewing?['ok','saved','before','after','changedFields']:['ok','saved','config','changedFields'])||result.ok!==true||result.saved!==!reviewing)throw Error('Incompatible settings result.');
 if(!Array.isArray(result.changedFields)||new Set(result.changedFields).size!==result.changedFields.length||result.changedFields.some(key=>!profileSettingKeys.includes(key)))throw Error('Incompatible settings differences.');
 const config=profileSettings(reviewing?result.after:result.config);
 if(JSON.stringify(config)!==JSON.stringify(requested.file.config))throw Error('The result differs from the requested settings.');
 if(reviewing){
  const before=profileSettings(result.before),changedFields=profileSettingKeys.filter(key=>before[key]!==config[key]);
  if(JSON.stringify(changedFields)!==JSON.stringify(result.changedFields))throw Error('Incompatible settings differences.');
  return {ok:true,saved:false,before,after:config,changedFields};
 }
 const expected=profileSettings(requested.expected),changedFields=profileSettingKeys.filter(key=>expected[key]!==config[key]);
 if(JSON.stringify(changedFields)!==JSON.stringify(result.changedFields))throw Error('Incompatible settings differences.');
 return {ok:true,saved:true,config,changedFields};
}

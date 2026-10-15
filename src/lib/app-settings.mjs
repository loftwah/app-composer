import composition from '../../composition.lock.json' with {type:'json'};

const labels={guestAccess:'Guest contributions',title:'Title',intro:'Introduction',theme:'Theme',layout:'Layout',handle:'Handle',website:'Website',github:'GitHub',bluesky:'Bluesky',linkedin:'LinkedIn'};
const options={closed:'Closed',postcards:'Postcards with guest code',daylight:'Daylight',midnight:'Midnight',grid:'Gallery grid',editorial:'Larger editorial images',compact:'Compact links'};
const names={guestbook:'Photo Guestbook',showcase:'Linkarooie'};
// Only the reviewed composition's data contracts reach the form; no remote code runs.
export const appSettings=Object.freeze(Object.fromEntries(composition.apps.map(app=>[app.id,{
 id:app.id,name:names[app.id]??app.manifest.name,cardPresentation:app.manifest.cardPresentation??null,
 source:{id:app.id,repository:app.repository,commit:app.commit,manifestDigest:app.manifestDigest},
 fields:Object.entries(app.manifest.configuration).map(([key,field])=>({key,label:labels[key]??key,...field,choices:field.type==='select'?field.options.map(value=>({value,label:options[value]??value})):[]})),
}])));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function selectedSources(ids){return ids.filter(id=>Object.hasOwn(appSettings,id)).map(id=>({...appSettings[id].source}));}
export function validateSources(input,ids){
 const expected=selectedSources(ids);
 if(!Array.isArray(input)||input.length!==expected.length||input.some((source,index)=>!object(source)||Object.keys(source).length!==4||Object.entries(expected[index]).some(([key,value])=>source[key]!==value)))throw Error('The selected app contracts have changed or do not match this specification. Keep the saved file and review it against the current app versions before exporting again.');
 return expected;
}
export function validateAppSettings(input,ids){
 if(!object(input)||Object.keys(input).some(id=>!ids.includes(id)||!Object.hasOwn(appSettings,id)))throw Error('Separate settings must belong to a selected supported app.');
 const result={};
 for(const id of ids){
  if(!Object.hasOwn(input,id))continue;
  const settings=input[id],model=appSettings[id];
  if(!object(settings)||Object.keys(settings).some(key=>!model.fields.some(field=>field.key===key)))throw Error('Unsupported settings for '+model.name+'.');
  if(Object.keys(settings).length!==model.fields.length)throw Error('Separate settings for '+model.name+' need the complete field group. Use the shared settings instead, or export all fields from Init.');
  const clean={};
  for(const field of model.fields){
   if(!Object.hasOwn(settings,field.key))continue;
   clean[field.key]=validateAppSettingValue(field,settings[field.key],model.name);

  }
  result[id]=clean;
 }
 return result;
}
export function appConfiguration(spec,id){
 if(!spec.apps.includes(id)||!Object.hasOwn(appSettings,id))throw Error('Select the app before resolving its configuration.');
 const overrides=validateAppSettings(spec.appSettings??{},spec.apps)[id]??{};
 const merged=Object.fromEntries(appSettings[id].fields.map(field=>[field.key,overrides[field.key]??spec.config[field.key]??field.default]));
 return validateAppSettings({[id]:merged},spec.apps)[id];
}

export function validateAppSettingValue(field,value,name){
 if(field.type==='select'){
  if(!field.options.includes(value))throw Error('Choose a supported '+field.label.toLowerCase()+' for '+name+'.');
  return value;
 }
 if(field.type!=='string')throw Error('Unsupported field type for '+name+'.');
 if(typeof value!=='string'||value.length>field.maxLength||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error(name+' '+field.label.toLowerCase()+' must be text up to '+field.maxLength+' characters.');
 const clean=value.trim();if(field.key==='title'&&!clean)throw Error('Give '+name+' a title, or use the shared settings.');
 if(clean&&field.format==='handle'&&!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(clean))throw Error('Use letters, numbers, dots, underscores or hyphens for the handle.');
 if(clean&&field.format==='https-url'){
  let url;try{url=new URL(clean);}catch{throw Error('Use a full HTTPS address for '+field.label+'.');}
  if(url.href.length>field.maxLength||url.protocol!=='https:'||url.username||url.password||field.hosts&&!field.hosts.includes(url.hostname))throw Error('Use an HTTPS '+field.label+' address without embedded credentials.');
  return url.href;
 }
 return clean;
}

// Effective preview defaults are not intent to clear optional live profile data.
export function appConfigurationPatch(spec,id){
 const effective=appConfiguration(spec,id);
 if(Object.hasOwn(spec.appSettings??{},id))return effective;
 return Object.fromEntries(Object.entries(effective).filter(([key])=>Object.hasOwn(spec.config,key)));
}
export function validateConfigurationPatch(input,id){
 const model=appSettings[id];if(!model||!object(input)||['title','intro','theme','layout'].some(key=>!Object.hasOwn(input,key)))throw Error('Configure the required app settings.');
 const result={};for(const [key,value] of Object.entries(input)){const field=model.fields.find(field=>field.key===key);if(!field)throw Error('Unsupported app configuration field.');result[key]=validateAppSettingValue(field,value,model.name);}
 return result;
}

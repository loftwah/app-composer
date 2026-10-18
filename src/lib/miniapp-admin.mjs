import {profileSettingsCommand,profileSettingsResult} from './miniapp-profile-settings.mjs';
import {manageMiniappCollection} from './miniapp-collection.ts';
import {achievementCommand,achievementCollection} from './miniapp-achievements.mjs';
import {tagCommand} from './miniapp-tags.mjs';
import {tagCollection} from './miniapp-tag-fields.mjs';
import {appSettings,validateAppSettingValue} from './app-settings.mjs';
const origin = 'https://composer.loftwah.com';
const ids = new Set(['guestbook', 'showcase']);
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const fail = (code, message) => ({ok:false, code, message});
const linkFields = (value,maxURL=2048) => {
 if(!value||typeof value!=='object'||Array.isArray(value)||!text(value.title,100)||typeof value.description!=='string'||value.description.length>240||typeof value.url!=='string'||value.url.length>maxURL||!['draft','published','hidden'].includes(value.status))return false;
 try{const url=new URL(value.url);return url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<=maxURL;}catch{return false;}
};

// The host authenticates first. This second boundary refuses machine tokens,
// non-admin users, preview, arbitrary targets and imported execution instructions.
export async function manageMiniapps(ctx, runtime, pins) {
 if (!ctx.user || ctx.user.role !== 50) return fail('FORBIDDEN', 'An invited Composer administrator is required.');
 if (runtime.PUBLIC_ORIGIN !== origin) return fail('UNAVAILABLE', 'Mini-app administration is disconnected in this environment.');
 const request = ctx.request;
 if (request.headers.get('Origin') && request.headers.get('Origin') !== origin) return fail('FORBIDDEN', 'Open this action from Composer administration.');
 const command = ctx.input;
 if (!command || typeof command !== 'object' || Array.isArray(command)) return fail('INVALID', 'Choose a supported app action.');
 const action = command.action;
 const collection = ['collection-sources','collection-items','collection-check','feature-resource'].includes(action);
 const reading = action === 'snapshot' || action === 'preview' || (collection && action!=='feature-resource') || (action==='profile-settings'&&command.operation==='export');
 if (request.method !== (reading ? 'GET' : 'POST')) return fail('METHOD', 'This action uses a different request method.');
 if (!reading && (request.headers.get('Origin') !== origin || request.headers.get('X-EmDash-Request') !== '1')) return fail('FORBIDDEN', 'Refresh Composer administration before saving.');
 const app = command.app;
 if (!ids.has(app)) return fail('INVALID', 'Choose Guestbook or Linkarooie.');
 if (collection) return manageMiniappCollection(ctx,runtime,pins);
 let path, body;
 if (action === 'snapshot') path = '/api/export';
 else if(action==='profile-settings'&&app==='showcase'&&appSettings.showcase.profileSettings?.version===1){
  const {app:ignored,action:outer,...values}=command;
  try{body=profileSettingsCommand(values);}catch{return fail('INVALID','Choose a supported profile settings file and review it before applying.');}
  path='/api/profile-settings';
 }
 else if(action==='tag'&&app==='showcase'&&appSettings.showcase.tagCollection?.version===1){
  const {app:ignored,action:outer,operation,...values}=command;
  try{body=tagCommand({action:operation,...values});}catch{return fail('INVALID','Check the tag fields and current revision.');}
  path='/api/tags';
 }
 else if(action==='achievement'&&app==='showcase'&&appSettings.showcase.achievementCollection?.version===1){
  const {app:ignored,action:outer,operation,...values}=command;
  try{body=achievementCommand({action:operation,...values});}catch{return fail('INVALID','Check the achievement fields and current revision.');}
  path='/api/achievements';
 }
 else if (action === 'preview'  && app === 'guestbook' && identifier(command.id)) path = '/media/' + command.id;
 else if (action === 'settings' && text(command.title,80) && typeof command.intro === 'string' && command.intro.length <= 240 && ['daylight','midnight'].includes(command.theme) && appSettings[app].fields.find(field=>field.key==='layout').options.includes(command.layout)) {
  path='/api/config'; body={};try{for(const field of appSettings[app].fields){if(Object.hasOwn(command,field.key))body[field.key]=validateAppSettingValue(field,command[field.key],appSettings[app].name);}}catch{return fail('INVALID','Check the profile text and use supported HTTPS social addresses.');}
 } else if (action === 'moderate' && app === 'guestbook' && identifier(command.id) && ['approved','hidden','rejected'].includes(command.status)) {
  path='/api/moderate'; body={id:command.id,status:command.status};
 } else if (action === 'upload' && app === 'guestbook' && text(command.caption,160) && typeof command.author === 'string' && command.author.length <= 60 && command.consent === true && typeof command.png === 'string' && command.png.length <= 1400000 && /^[A-Za-z0-9+/]+={0,2}$/.test(command.png)) {
  path='/api/upload'; body={caption:command.caption,author:command.author,consent:true,png:command.png};
 } else if (action === 'card' && app === 'showcase' && identifier(command.id) && ['draft','published','hidden'].includes(command.status)) {
  path='/api/cards'; body={id:command.id,status:command.status};
 } else if(action==='edit-link'&&app==='showcase'&&identifier(command.id)&&linkFields(command)&&linkFields(command.expected,24576)&&Object.keys(command.expected).length===4){
  path='/api/cards';body={id:command.id,title:command.title,description:command.description,url:command.url,status:command.status,expected:{title:command.expected.title,description:command.expected.description,url:command.expected.url,status:command.expected.status}};
 } else if (action === 'feature' && app === 'showcase' && identifier(command.item)) {
  path='/api/cards'; body={item:command.item,status:'published'};
 } else if (action === 'link' && app === 'showcase' && text(command.title,100) && typeof command.description === 'string' && command.description.length <= 240 && typeof command.url === 'string' && command.url.length <= 2048) {
  try {const url=new URL(command.url); if(url.protocol!=='https:' || url.username || url.password || url.href.length>2048) throw Error();} catch {return fail('INVALID','Choose an HTTPS link up to 2048 characters without embedded credentials.');}
  path='/api/cards'; body={title:command.title,description:command.description,url:command.url,status:'draft'};
 } else if(action==='presentation'&&app==='showcase'&&identifier(command.id)&&typeof command.pinned==='boolean'&&appSettings.showcase.cardPresentation?.icons.includes(command.icon)){
  if(command.group!==undefined&&(typeof command.group!=='string'||command.group!==''&&!appSettings.showcase.cardCollection?.groups.includes(command.group)))return fail('INVALID','Choose a supported link group.');
  path='/api/presentation';body={id:command.id,pinned:command.pinned,icon:command.icon,...(command.group!==undefined?{group:command.group}:{})};
 } else if (action === 'reorder' && app === 'showcase' && Array.isArray(command.ids) && command.ids.length <= (appSettings.showcase.cardCollection?.limit??8) && command.ids.every(identifier) && new Set(command.ids).size===command.ids.length) {
  path='/api/reorder'; body={ids:command.ids};
 } else return fail('INVALID', 'Check the fields and choose a supported action.');
 const service=runtime[app.toUpperCase()], token=runtime[app.toUpperCase()+'_OWNER_TOKEN'];
 if (!service || typeof service.fetch!=='function' || typeof token!=='string' || !token || token.length>4096) return fail('UNAVAILABLE','This app needs its server-side owner connection. Ask your agent to check it.');
 const send = (route,init={}) => service.fetch(new Request(origin+'/'+app+route,{redirect:'manual',signal:AbortSignal.timeout(8000),...init}));
 try {
  const identity=await send('/build.json');
  if(!identity.ok) return fail('UNAVAILABLE','The connected app could not be verified. Refresh before retrying.');
  const build=await identity.json();
  if(build.app!==app || build.revision!==pins[app] || build.dataVersion!==1) return fail('SOURCE','The connected app differs from the reviewed composition. Ask your agent to check the release.');
  const response=await send(path,{method:reading?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok){if(action==='profile-settings'){if(response.status===409)return fail('CONFLICT','Profile settings changed. Review the file against the saved settings again.');if(response.status>=500)return fail(command.operation==='apply'?'UNCONFIRMED':'UNAVAILABLE','The settings result could not be confirmed. Review the saved settings before continuing.');if(response.status===400)return fail('INVALID','Check the settings file and its supported fields.');}if(action==='tag'){if(response.status===409)return fail('CONFLICT','Tags changed. Compare the saved version before saving again.');if(response.status>=500)return fail('UNCONFIRMED','The save could not be confirmed. Refresh tags before retrying.');if(response.status===400)return fail('INVALID','Check the tag fields. Nothing was resubmitted.');}if(action==='achievement'){if(response.status===409)return fail('CONFLICT','Achievements changed. Compare the saved version before saving again.');if(response.status>=500)return fail('UNCONFIRMED','The save could not be confirmed. Refresh achievements before retrying.');if(response.status===400)return fail('INVALID','Check the achievement fields. Nothing was resubmitted.');}if(action==='edit-link'&&response.status===409)return fail('CONFLICT','This link changed. Compare the saved link before saving your edits.');return fail('APP', ({401:'The owner connection was refused. Ask your agent to check it.',403:'The app refused this action. Check its owner settings.',404:'This item is no longer available. Refresh the app.',409:'The collection changed or reached its limit. Refresh before retrying.',429:'The app has reached its temporary limit. Try again later.'})[response.status] || 'The app could not complete this action. Refresh before retrying.');}
  if(action==='preview') {
   if(response.headers.get('Content-Type')!=='image/png') return fail('MEDIA','This preview is unavailable.');
   const bytes=await response.arrayBuffer(); if(bytes.byteLength>1048576) return fail('MEDIA','This preview exceeds the supported size.');
   return {ok:true,png:Buffer.from(bytes).toString('base64')};
  }
  if(action==='profile-settings'){
   try{const text=await response.text();if(new TextEncoder().encode(text).byteLength>65536)throw Error();return profileSettingsResult(command.operation,JSON.parse(text),body);}
   catch{return fail(command.operation==='apply'?'UNCONFIRMED':'APP','The app returned an incompatible settings result. Review the saved settings before continuing.');}
  }
  const result=await response.json();
  if(action==='snapshot') {
   if(result.dataVersion!==1 || !result.config || (app==='guestbook'?!Array.isArray(result.items):!Array.isArray(result.cards))) return fail('APP','The app returned an incompatible management response.');
   let achievements={};if(app==='showcase'&&appSettings.showcase.achievementCollection?.version===1){try{achievements={achievementCollection:achievementCollection(result.achievementCollection)};}catch{achievements={achievementCollection:null,achievementProblem:'review_required'};}}
   let tags={};if(app==='showcase'&&appSettings.showcase.tagCollection?.version===1){try{tags={tagCollection:tagCollection(result.tagCollection)};}catch{tags={tagCollection:null,tagProblem:'review_required'};}}
   return {ok:true,app,...achievements,...tags,config:result.config,items:app==='guestbook'?result.items.filter(item=>item.status!=='deleted').sort((a,b)=>String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))).slice(0,200):result.cards.slice(0,appSettings.showcase.cardCollection?.limit??8)};
  }
  return {ok:true,id:result.id ?? null};
 } catch {return fail((action==='achievement'||action==='tag'||(action==='profile-settings'&&command.operation==='apply'))?'UNCONFIRMED':'UNAVAILABLE','The app connection was interrupted. Refresh to check the result before retrying.');}
}

// MIT. Achievement fields copied from independent Showcase #25; owned here.
// Composer validates its private bridge; the app remains the final write authority.
import {isCalendarDate,calendarDateLabel} from '../../lib/content-model/calendar-date.mjs';
const keys=['title','description','date','url','icon','status'];
const icons=['link','book','code','music','video','heart'];
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const exact=(value,fields)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key));
export const achievementIcons=icons;
export const blankAchievement=()=>({title:'',description:'',date:'',url:'',icon:'link',status:'draft'});
export function validAchievementDate(value){return typeof value==='string'&&(value===''||/^(?!0000)[0-9]{4}$/.test(value)||/^(?!0000)[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(value)||isCalendarDate(value));}
export function achievementDateLabel(value){if(!validAchievementDate(value)||!value)return '';if(value.length===4)return value;if(value.length===7)return new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-15T12:00:00.000Z'));return calendarDateLabel(value)??'';}
export const achievementValues=item=>Object.fromEntries(keys.map(key=>[key,key==='description'?item[key].replace(/\r\n?/g,'\n'):item[key]]));
export const sameAchievement=(a,b)=>!!a&&!!b&&keys.every(key=>key==='description'?a[key].replace(/\r\n?/g,'\n')===b[key].replace(/\r\n?/g,'\n'):a[key]===b[key]);
export class AchievementFieldError extends Error {constructor(field,message){super(message);this.field=field;}}
const invalid=(field,message)=>{throw new AchievementFieldError(field,message);};
export function achievementFields(value){
 if(!exact(value,keys))invalid('form','Use the supported achievement fields.');
 if(typeof value.title!=='string'||!value.title.trim()||value.title.length>100||/[\u0000-\u001f]/.test(value.title))invalid('title','Give the achievement a title up to 100 characters without control characters.');
 if(typeof value.description!=='string'||value.description.length>240||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.description))invalid('description','Use a description up to 240 characters without control characters.');
 if(typeof value.date!=='string'||value.date.length>10||/[\u0000-\u001f]/.test(value.date)||!validAchievementDate(value.date.trim()))invalid('date','Use a year (YYYY), a month (YYYY-MM) or a real calendar day (YYYY-MM-DD). Leave blank if unknown.');
 const destinationMessage='Use a full HTTPS address without embedded credentials, up to 2,048 characters. Leave blank if no destination is needed.';
 if(typeof value.url!=='string'||value.url.length>2048||/[\u0000-\u001f]/.test(value.url))invalid('url',destinationMessage);
 let url=value.url.trim();if(url){try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.href.length>2048)invalid('url',destinationMessage);url=parsed.href;}catch{invalid('url',destinationMessage);}}
 if(!icons.includes(value.icon))invalid('icon','Choose a supported achievement icon.');
 if(!['draft','published','hidden'].includes(value.status))invalid('status','Choose draft, published or hidden visibility.');
 return {...value,title:value.title.trim(),date:value.date.trim(),url};
}
export function achievementCommand(value){
 const action=value?.action;
 const fields=action==='create'||action==='edit'?['action','expectedRevision','item']:action==='visibility'?['action','expectedRevision','id','status']:action==='delete'?['action','expectedRevision','id']:action==='reorder'?['action','expectedRevision','ids']:[];
 if(!fields.length||!exact(value,fields)||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||value.expectedRevision>2147483647)throw Error('Choose a supported achievement action and revision.');
 const result={action,expectedRevision:value.expectedRevision};
 if(action==='create'){result.item=achievementFields(value.item);if(result.item.status!=='draft')throw Error('Save a draft first.');}
 else if(action==='edit'){if(!exact(value.item,['id',...keys])||!uuid(value.item.id))throw Error('Choose a current achievement.');const{id,...item}=value.item;result.item={id,...achievementFields(item)};}
 else if(action==='reorder'){if(!Array.isArray(value.ids)||value.ids.length>8||!value.ids.every(uuid)||new Set(value.ids).size!==value.ids.length)throw Error('Choose each achievement once.');result.ids=[...value.ids];}
 else{if(!uuid(value.id))throw Error('Choose a current achievement.');result.id=value.id;if(action==='visibility'){if(!['draft','published','hidden'].includes(value.status))throw Error('Choose a visibility.');result.status=value.status;}}
 return result;
}
export function achievementCollection(value){
 if(!exact(value,['version','revision','items'])||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>2147483647||!Array.isArray(value.items)||value.items.length>8)throw Error('Saved achievements need review.');
 const items=value.items.map(item=>{if(!exact(item,['id',...keys])||!uuid(item.id))throw Error('Saved achievements need review.');const{id,...fields}=item;return{id,...achievementFields(fields)};});
 if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('Saved achievements need review.');
 return {version:1,revision:value.revision,items};
}

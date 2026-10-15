// MIT. App Composer's optional, server-only daily usage contract.
export const events = Object.freeze({hello:['app_open'],guestbook:['app_open','item_open','postcard_received'],showcase:['app_open'],linkcheck:['app_open','inspection_completed'],state:['app_open']});
export const dailyLimit = 1000;
export const incrementSQL = `INSERT INTO composer_usage(day,app,event,surface,n) VALUES(?1,?2,?3,?4,1) ON CONFLICT(day,app,event,surface) DO UPDATE SET n=n+1 WHERE n < ${dailyLimit}`;
const capped=new Set();
export async function record(db, app, event, surface, now = new Date()) {
 if(!events[app]?.includes(event)||!['standalone','composed'].includes(surface))throw new Error('Unsupported count');
 const day=now.toISOString().slice(0,10),key=[day,app,event,surface].join(':');
 for(const entry of capped)if(!entry.startsWith(day+':'))capped.delete(entry);
 if(capped.has(key))return false;
 const result=await db.prepare(incrementSQL).bind(day,app,event,surface).run();
 if(!result.success)throw new Error('Count unavailable');
 if(result.meta?.changes===0){capped.add(key);return false;}return true;
}
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function authorised(request,app,secret){
 let tokens;try{tokens=JSON.parse(secret||'{}');}catch{return false;}
 const expected=tokens[app],received=request.headers.get('Authorization')?.replace(/^Bearer /,'');
 if(typeof expected!=='string'||expected.length<32||!received||received.length>128)return false;
 const hash=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 const [a,b]=await Promise.all([hash(expected),hash(received)]);return a.reduce((diff,v,i)=>diff|(v^b[i]),0)===0;
}
export async function collect(request,env,app){
 if(request.method!=='POST')return json({error:'Use POST.'},405);
 if(!Object.hasOwn(events,app)||!await authorised(request,app,env.USAGE_TOKENS))return json({error:'Unauthorised.'},401);
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'Use JSON.'},400);
 let body;try{
  const reader=request.body?.getReader();if(!reader)throw new Error();let bytes=new Uint8Array();
  try{for(;;){const part=await reader.read();if(part.done)break;if(bytes.length+part.value.length>256){await reader.cancel();throw new Error();}const next=new Uint8Array(bytes.length+part.value.length);next.set(bytes);next.set(part.value,bytes.length);bytes=next;}}finally{reader.releaseLock();}
  body=JSON.parse(new TextDecoder().decode(bytes));
  if(!body||Object.keys(body).sort().join(',')!=='contract,event'||body.contract!==1||!events[app].includes(body.event))throw new Error();
 }catch{return json({error:'Unsupported count body.'},400);}
 if(request.headers.get('X-Composer-Verification')==='1')return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 try{if(!env.USAGE_LIMIT||!(await env.USAGE_LIMIT.limit({key:app+':'+body.event})).success)return json({error:'Recording limit reached.'},429);const counted=await record(env.DB,app,body.event,'standalone');return new Response(null,{status:204,headers:{'Cache-Control':'no-store',...(counted?{}:{'X-Usage-Limit':'reached'})}});}catch{return json({error:'Counts temporarily unavailable.'},503);}
}
export function selection(params){return {days:params.get('days')==='30'?30:7,surface:['standalone','composed'].includes(params.get('surface'))?params.get('surface'):'all'};}
export async function summary(db,{days=7,surface='all'}={},now=new Date()){
 days=days===30?30:7;surface=['standalone','composed'].includes(surface)?surface:'all';
 const start=new Date(now);start.setUTCDate(start.getUTCDate()-days+1);const from=start.toISOString().slice(0,10),through=now.toISOString().slice(0,10);
 const result=await db.prepare(`SELECT app,event,SUM(n) AS n,MAX(n >= ${dailyLimit}) AS limited FROM composer_usage WHERE day >= ?1 AND day <= ?2 AND (?3 = 'all' OR surface = ?3) GROUP BY app,event`).bind(from,through,surface).all();
 if(!result.success)throw new Error('Counts unavailable');
 const apps=Object.keys(events).map(app=>({app,opens:0,actions:0,opensLimited:false,actionsLimited:false,limited:false}));
 for(const row of result.results){const entry=apps.find(a=>a.app===row.app);if(!entry||!events[row.app].includes(row.event)||!['app_open','item_open','inspection_completed'].includes(row.event))continue;entry[row.event==='app_open'?'opens':'actions']+=row.n;entry[row.event==='app_open'?'opensLimited':'actionsLimited'] ||= !!row.limited;entry.limited ||= !!row.limited;}
 apps.sort((a,b)=>b.opens-a.opens||a.app.localeCompare(b.app));
 return {contract:1,from,through,days,surface,dailyLimit,apps};
}
export async function purge(db,now=new Date()){const start=new Date(now);start.setUTCDate(start.getUTCDate()-34);return db.prepare('DELETE FROM composer_usage WHERE day < ?1').bind(start.toISOString().slice(0,10)).run();}

import {appSettings} from '../src/lib/app-settings.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {manageMiniapps} from '../src/lib/miniapp-admin.mjs';
const origin='https://composer.loftwah.com';
const revision='a'.repeat(40),pins={guestbook:revision,showcase:revision};
function context(input,user={role:50},headers={Origin:origin,'X-EmDash-Request':'1'},method=['snapshot','preview'].includes(input.action)?'GET':'POST') {
 return {input,user,request:new Request(origin+'/_emdash/api/plugins/composer-miniapps/'+(method==='GET'?'read':'write'),{method,headers})};
}
function fixture({revision:source=revision,status=200,throws=false}={}) {
 const calls=[];
 const service={fetch:async request=>{calls.push(request);const path=new URL(request.url).pathname;if(path.endsWith('/build.json'))return Response.json({app:path.split('/')[1],revision:source,dataVersion:1});if(throws)throw Error('provider secret details');if(status!==200)return Response.json({error:'sensitive provider response'},{status});if(path.endsWith('/api/export'))return Response.json({dataVersion:1,config:{title:'Example',intro:'',theme:'daylight',layout:'grid'},items:[{id:'hidden-id',status:'hidden'},{id:'deleted-id',status:'deleted'}],cards:[]});return Response.json({id:'new-id',ok:true});}};
 return {calls,runtime:{PUBLIC_ORIGIN:origin,GUESTBOOK:service,SHOWCASE:service,GUESTBOOK_OWNER_TOKEN:'guest-secret',SHOWCASE_OWNER_TOKEN:'showcase-secret'}};
}
test('anonymous, editor and unbound token contexts cannot reach app services',async()=>{
 for(const user of [undefined,{role:40},{role:20}]){const f=fixture();const result=await manageMiniapps({...context({app:'guestbook',action:'snapshot'}),user},f.runtime,pins);assert.equal(result.code,'FORBIDDEN');assert.equal(f.calls.length,0);}
});
test('preview, missing connection, cross-origin and unsafe writes fail before app IO',async()=>{
 const cases=[
  {runtime:{PUBLIC_ORIGIN:'https://preview.workers.dev'}},
  {runtime:{GUESTBOOK_OWNER_TOKEN:undefined}},
  {ctx:context({app:'guestbook',action:'snapshot'},{role:50},{Origin:'https://evil.example'})},
  {ctx:context({app:'guestbook',action:'moderate',id:'photo',status:'approved'},{role:50},{Origin:origin})},
  {ctx:context({app:'guestbook',action:'moderate',id:'photo',status:'approved'},{role:50},{'X-EmDash-Request':'1'})},
  {ctx:context({app:'guestbook',action:'moderate',id:'photo',status:'approved'},{role:50},{Origin:origin,'X-EmDash-Request':'1'},'GET')},
 ];
 for(const value of cases){const f=fixture();const result=await manageMiniapps(value.ctx??context({app:'guestbook',action:'snapshot'}),{...f.runtime,...value.runtime},pins);assert.equal(result.ok,false);assert.equal(f.calls.length,0);}
});
test('source identity is checked without credentials before private app access',async()=>{
 const f=fixture({revision:'b'.repeat(40)});const result=await manageMiniapps(context({app:'guestbook',action:'snapshot'}),f.runtime,pins);assert.equal(result.code,'SOURCE');assert.equal(f.calls.length,1);assert.equal(f.calls[0].headers.get('Authorization'),null);
 const good=fixture();const result2=await manageMiniapps(context({app:'guestbook',action:'snapshot'}),good.runtime,pins);assert.equal(result2.ok,true);assert.deepEqual(result2.items,[{id:'hidden-id',status:'hidden'}]);assert.equal(good.calls[1].headers.get('Authorization'),'Bearer guest-secret');assert.equal(good.calls[1].redirect,'manual');assert.equal(JSON.stringify(result2).includes('secret'),false);
});
test('imported targets, arbitrary actions, deletion and invalid input cannot expand the bridge',async()=>{
 for(const input of [
  {app:'https://evil.example',action:'snapshot'},
  {app:'guestbook',action:'execute',command:'curl anything'},
  {app:'guestbook',action:'moderate',id:'photo',status:'deleted'},
  {app:'guestbook',action:'preview',id:'../secrets'},
  {app:'showcase',action:'link',title:'Card',description:'',url:'https://username:password@example.com'},
  {app:'showcase',action:'link',title:'Card',description:'',url:'javascript:alert(1)'},
  {app:'showcase',action:'link',title:'Card',description:'',url:'https://example.test/'+'é'.repeat(600)},
  {app:'showcase',action:'reorder',ids:['card','card']},
  {app:'guestbook',action:'upload',caption:'A photo',author:'',consent:false,png:'YWJj'},
 ]){const f=fixture();const result=await manageMiniapps(context(input),f.runtime,pins);assert.equal(result.code,'INVALID');assert.equal(f.calls.length,0);}
});
test('writes use fixed app API routes and explicit supported payloads',async()=>{
 const f=fixture();const result=await manageMiniapps(context({app:'showcase',action:'feature',item:'photo',status:'hidden',target:'https://evil.example',token:'injected'}),f.runtime,pins);assert.equal(result.ok,true);assert.equal(f.calls[1].url,origin+'/showcase/api/cards');assert.deepEqual(await f.calls[1].json(),{item:'photo',status:'published'});
});
test('provider refusal and interrupted writes do not leak bodies or retry',async()=>{
 for(const opts of [{status:409},{status:302},{throws:true}]){const f=fixture(opts);const result=await manageMiniapps(context({app:'guestbook',action:'moderate',id:'photo',status:'approved'}),f.runtime,pins);assert.equal(result.ok,false);assert.equal(f.calls.length,2);assert.doesNotMatch(JSON.stringify(result),/provider secret|sensitive provider/);}
});

test('the full bounded Guestbook queue is available with newest records first',async()=>{
 const f=fixture();const service=f.runtime.GUESTBOOK,fetch=service.fetch;service.fetch=async request=>{if(!request.url.endsWith('/api/export'))return fetch(request);return Response.json({dataVersion:1,config:{},items:Array.from({length:200},(_,i)=>({id:'photo-'+i,status:i===199?'pending':'approved',created_at:String(i).padStart(3,'0')}))});};
 const result=await manageMiniapps(context({app:'guestbook',action:'snapshot'}),f.runtime,pins);assert.equal(result.items.length,200);assert.equal(result.items[0].id,'photo-199');assert.equal(result.items[0].status,'pending');
});

test('profile configuration and presentation use reviewed fields without clearing omitted optional values',async()=>{
 assert.equal(appSettings.showcase.cardPresentation.version,1);
 const fields={title:'Fictional profile',intro:'A fictional bio',theme:'midnight',layout:'compact',handle:'garden.studio',github:'https://github.com/example',website:'https://example.test/',x:'https://x.com/example',avatar:'https://showcase.example.test/avatar.jpg',banner:'',shareImage:'',linkedin:''};
 const f=fixture();assert.equal((await manageMiniapps(context({app:'showcase',action:'settings',...fields,bluesky:'https://bsky.app/profile/ignored',token:'ignored'}),f.runtime,pins)).ok,true);assert.deepEqual(await f.calls[1].json(),fields);
 const legacy=fixture();assert.equal((await manageMiniapps(context({app:'showcase',action:'settings',title:'Legacy',intro:'',theme:'daylight',layout:'grid'}),legacy.runtime,pins)).ok,true);assert.equal(Object.hasOwn(await legacy.calls[1].json(),'github'),false);
 const styled=fixture();assert.equal((await manageMiniapps(context({app:'showcase',action:'presentation',id:'card',pinned:true,icon:'book',status:'published'}),styled.runtime,pins)).ok,true);assert.equal(styled.calls[1].url,origin+'/showcase/api/presentation');assert.deepEqual(await styled.calls[1].json(),{id:'card',pinned:true,icon:'book'});
 for(const input of [{app:'showcase',action:'settings',...fields,github:'https://github.com.evil.test/'},{app:'showcase',action:'presentation',id:'card',pinned:'true',icon:'book'},{app:'showcase',action:'presentation',id:'card',pinned:true,icon:'<script>'},{app:'guestbook',action:'presentation',id:'card',pinned:true,icon:'link'}]){const bad=fixture();assert.equal((await manageMiniapps(context(input),bad.runtime,pins)).ok,false);assert.equal(bad.calls.length,0);}
});

test('editing an authored link sends an explicit bounded compare snapshot and preserves publication intent',async()=>{
 const expected={title:'Fictional existing',description:'Original note',url:'https://example.test/original',status:'hidden'};
 const input={app:'showcase',action:'edit-link',id:'card',title:'Fictional edited',description:'Edited note',url:'https://example.test/edited',status:'hidden',expected};
 const f=fixture();assert.equal((await manageMiniapps(context({...input,delete:true,token:'ignored',provider:'injected'}),f.runtime,pins)).ok,true);assert.deepEqual(await f.calls[1].json(),{id:'card',title:input.title,description:input.description,url:input.url,status:'hidden',expected});
 for(const patch of [{expected:undefined},{expected:{...expected,extra:'not-supported'}},{url:'javascript:alert(1)'},{url:'https://owner:credential@example.test/'},{url:'https://example.test/'+'é'.repeat(600)},{status:undefined},{app:'guestbook'},{title:''}]){const bad=fixture();assert.equal((await manageMiniapps(context({...input,...patch}),bad.runtime,pins)).code,'INVALID');assert.equal(bad.calls.length,0);}
 const conflict=fixture({status:409});assert.equal((await manageMiniapps(context(input),conflict.runtime,pins)).code,'CONFLICT');assert.equal(conflict.calls.length,2);
 const legacy=fixture();const old={...expected,url:new URL('https://example.test/'+'é'.repeat(600)).href};assert.equal((await manageMiniapps(context({...input,expected:old}),legacy.runtime,pins)).ok,true);assert.deepEqual((await legacy.calls[1].json()).expected,old);
 const denied=fixture();assert.equal((await manageMiniapps(context(input,{role:20}),denied.runtime,pins)).code,'FORBIDDEN');assert.equal(denied.calls.length,0);
});

test('expanded card contracts expose every owned card and accept its complete reorder',async()=>{
 const original=appSettings.showcase.cardCollection;
 try{
  appSettings.showcase.cardCollection={version:1,limit:64,featuredLimit:8,groups:['Music','Games','Projects','Writing','Connect']};
  const f=fixture(),service=f.runtime.SHOWCASE,fetch=service.fetch,ids=Array.from({length:26},(_,i)=>'card-'+i);
  service.fetch=async request=>request.url.endsWith('/api/export')?Response.json({dataVersion:1,config:{},cards:ids.map(id=>({id,title:id,status:'published',group:'Music'}))}):fetch(request);
  const snapshot=await manageMiniapps(context({app:'showcase',action:'snapshot'}),f.runtime,pins);assert.equal(snapshot.items.length,26);
  const ordered=[...ids].reverse(),response=await manageMiniapps(context({app:'showcase',action:'reorder',ids:ordered}),f.runtime,pins);assert.equal(response.ok,true);assert.deepEqual(await f.calls.at(-1).json(),{ids:ordered});
  const styled=fixture();assert.equal((await manageMiniapps(context({app:'showcase',action:'presentation',id:ids[0],pinned:true,icon:'music',group:'Music'}),styled.runtime,pins)).ok,true);assert.equal((await styled.calls.at(-1).json()).group,'Music');
  appSettings.showcase.cardCollection=null;const older=await manageMiniapps(context({app:'showcase',action:'snapshot'}),f.runtime,pins);assert.equal(older.items.length,8);const before=f.calls.length;assert.equal((await manageMiniapps(context({app:'showcase',action:'reorder',ids}),f.runtime,pins)).code,'INVALID');assert.equal(f.calls.length,before);
 }finally{appSettings.showcase.cardCollection=original;}
});

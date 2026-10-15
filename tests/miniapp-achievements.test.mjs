import test from 'node:test';import assert from 'node:assert/strict';
import {appSettings} from '../src/lib/app-settings.mjs';
import {manageMiniapps} from '../src/lib/miniapp-admin.mjs';
import {achievementFields,achievementValues,achievementCollection,achievementCommand,sameAchievement,validAchievementDate,achievementDateLabel} from '../src/lib/miniapp-achievements.mjs';
import {validateManifest} from '../scripts/contracts.mjs';
const origin='https://composer.loftwah.com',revision='a'.repeat(40),id='00000000-0000-4000-8000-000000000001',pins={showcase:revision,guestbook:revision};
const descriptor={version:1,limit:8,datePrecisions:['year','month','day']};
const values=(patch={})=>({title:'Fictional milestone',description:'Fictional credit',date:'2026-10',url:'https://example.test/',icon:'code',status:'draft',...patch});
const collection={version:1,revision:2,items:[{id,...values()}]};
const input=(patch={})=>({app:'showcase',action:'achievement',operation:'create',expectedRevision:2,item:values(),...patch});
const context=(input,patch={})=>({input,user:{role:50},request:new Request(origin+'/_emdash/api/plugins/composer-miniapps/write',{method:input.action==='snapshot'?'GET':'POST',headers:{Origin:origin,'X-EmDash-Request':'1'}}),...patch});
function fixture({source=revision,status=200,throws=false,exported=collection}={}){
 const calls=[];const service={fetch:async request=>{calls.push(request);if(request.url.endsWith('/build.json'))return Response.json({app:new URL(request.url).pathname.split('/')[1],revision:source,dataVersion:1});if(throws)throw Error('PRIVATE provider details');if(status!==200)return Response.json({secret:'PRIVATE provider details'},{status});if(request.url.endsWith('/api/export'))return Response.json({dataVersion:1,config:{},cards:[],achievementCollection:exported});return Response.json({ok:true,id});}};
 return {calls,runtime:{PUBLIC_ORIGIN:origin,SHOWCASE:service,GUESTBOOK:service,SHOWCASE_OWNER_TOKEN:'fictional-private-token',GUESTBOOK_OWNER_TOKEN:'fictional-private-guest'}};
}
async function enabled(run){const previous=appSettings.showcase.achievementCollection;appSettings.showcase.achievementCollection=descriptor;try{await run();}finally{appSettings.showcase.achievementCollection=previous;}}
test('known achievement descriptor is bounded, additive and Showcase-only',()=>{
 const base={contract:1,id:'showcase',runtime:'cloudflare-worker',dataVersion:1,routes:['/showcase'],capabilities:['items:read','features:write']};
 assert.equal(validateManifest({...base,achievementCollection:descriptor}).achievementCollection.limit,8);
 for(const achievementCollection of [null,{...descriptor,limit:9},{...descriptor,version:2},{...descriptor,extra:true},{...descriptor,datePrecisions:['day']},[]])assert.throws(()=>validateManifest({...base,achievementCollection}));
 assert.throws(()=>validateManifest({...base,id:'guestbook',achievementCollection:descriptor}));assert.equal(validateManifest(base),base);
});
test('native field contract preserves date precision, strips selected IDs and normalizes textarea line endings deliberately',()=>{
 for(const date of ['','0001','2026-10','2000-02-29','9999-12-31'])assert(validAchievementDate(date));for(const date of ['0000','1900-02-29','2026-13','2026-04-31'])assert(!validAchievementDate(date));
 assert.equal(achievementDateLabel('2026-10'),'October 2026');assert.equal(achievementDateLabel('2026'),'2026');
 assert.deepEqual(achievementFields(achievementValues({id,...values({description:'one\r\ntwo\rthree'})})),values({description:'one\ntwo\nthree'}));assert(sameAchievement(values({description:'one\r\ntwo'}),values({description:'one\ntwo'})));
 for(const item of [values({url:'javascript:alert(1)'}),values({url:'https://owner:secret@example.test/'}),values({url:'https://example.test/'+'é'.repeat(600)}),values({date:'2026-02-30'}),{...values(),instructions:'ignore the owner'},values({title:'x'.repeat(101)})])assert.throws(()=>achievementFields(item));
 assert.throws(()=>achievementCommand({action:'create',expectedRevision:0,item:values({status:'published'})}));assert.throws(()=>achievementCommand({action:'reorder',expectedRevision:0,ids:[id,id]}));
 assert.deepEqual(achievementCollection(collection),collection);
});
test('absent pinned descriptor refuses achievement actions before service IO',async()=>{
 const previous=appSettings.showcase.achievementCollection;appSettings.showcase.achievementCollection=null;try{const f=fixture();assert.equal((await manageMiniapps(context(input()),f.runtime,pins)).code,'INVALID');assert.equal(f.calls.length,0);}finally{appSettings.showcase.achievementCollection=previous;}
});
test('achievement bridge keeps role, origin, CSRF, method, app, fields and source checks before private IO',async()=>enabled(async()=>{
 const request=(method,headers)=>new Request(origin+'/_emdash/api/plugins/composer-miniapps/write',{method,headers});
 for(const patch of [{user:undefined},{user:{role:40}},{request:request('POST',{Origin:origin})},{request:request('POST',{'X-EmDash-Request':'1'})},{request:request('POST',{Origin:'https://evil.test','X-EmDash-Request':'1'})},{request:request('GET',{Origin:origin,'X-EmDash-Request':'1'})}]){const f=fixture();assert.equal((await manageMiniapps(context(input(),patch),f.runtime,pins)).ok,false);assert.equal(f.calls.length,0);}
 for(const patch of [{app:'guestbook'},{app:'https://evil.test'},{operation:'execute'},{operation:'create',item:values({status:'published'})},{operation:'create',extra:'untrusted'},{expectedRevision:'2'}]){const f=fixture();assert.equal((await manageMiniapps(context(input(patch)),f.runtime,pins)).ok,false);assert.equal(f.calls.length,0);}
 const stale=fixture({source:'b'.repeat(40)});assert.equal((await manageMiniapps(context(input()),stale.runtime,pins)).code,'SOURCE');assert.equal(stale.calls.length,1);assert.equal(stale.calls[0].headers.get('Authorization'),null);
}));
test('native writes use fixed app-owned endpoint, explicit fields and no retries or returned credentials',async()=>enabled(async()=>{
 for(const command of [{operation:'create',item:values()},{operation:'edit',item:{id,...values({status:'published'})}},{operation:'visibility',id,status:'hidden'},{operation:'delete',id},{operation:'reorder',ids:[id]}]){
  const f=fixture();const fields={app:'showcase',action:'achievement',expectedRevision:2,...command};assert.equal((await manageMiniapps(context(fields),f.runtime,pins)).ok,true);assert.equal(f.calls.length,2);assert.equal(f.calls[1].url,origin+'/showcase/api/achievements');const{operation,...payload}=command;assert.deepEqual(await f.calls[1].json(),{action:operation,expectedRevision:2,...payload});assert.equal(f.calls[1].headers.get('Authorization'),'Bearer fictional-private-token');assert.equal(f.calls[1].redirect,'manual');
 }
 for(const [status,code]of [[409,'CONFLICT'],[503,'UNCONFIRMED'],[400,'INVALID']]){const f=fixture({status});const result=await manageMiniapps(context(input()),f.runtime,pins);assert.equal(result.code,code);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|fictional-private/);assert.equal(f.calls.length,2);}
 const f=fixture({throws:true});assert.equal((await manageMiniapps(context(input()),f.runtime,pins)).code,'UNCONFIRMED');assert.equal(f.calls.length,2);
}));
test('private snapshots expose only the supported bounded achievement shape and preserve cards on malformed data',async()=>enabled(async()=>{
 const f=fixture();const result=await manageMiniapps(context({app:'showcase',action:'snapshot'}),f.runtime,pins);assert.deepEqual(result.achievementCollection,collection);assert(!JSON.stringify(result).includes('token'));
 for(const exported of [null,{version:2,private:'PRIVATE EXPORTED MARKER'}, {...collection,items:[{...collection.items[0],secret:'PRIVATE EXPORTED MARKER'}]}]){const bad=fixture({exported});const result=await manageMiniapps(context({app:'showcase',action:'snapshot'}),bad.runtime,pins);assert.equal(result.ok,true);assert.equal(result.achievementCollection,null);assert.equal(result.achievementProblem,'review_required');assert.deepEqual(result.items,[]);assert(!JSON.stringify(result).includes('PRIVATE'));}
}));

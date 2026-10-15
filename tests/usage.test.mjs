import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';
import {collect,record,summary,incrementSQL,purge} from '../lib/usage/index.mjs';
import {health,publish,pageEvent,postcardReceiptEvent} from '../lib/usage/publisher.mjs';
const token='a'.repeat(48),writes=[];
const db={prepare(sql){return {bind(...params){return {async run(){writes.push({sql,params});return {success:true};},async all(){return {success:true,results:[{app:'guestbook',event:'app_open',n:9,limited:0},{app:'guestbook',event:'item_open',n:2,limited:0},{app:'hello',event:'app_open',n:3,limited:1}]};}};}};}};
const env={USAGE_LIMIT:{async limit(){return {success:true}}},DB:db,USAGE_TOKENS:JSON.stringify({hello:token})};
const request=(body,app='hello',auth=token)=>new Request('https://example.test/api/usage/'+app,{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)});
test('collector rejects anonymous, cross-app, extra/private fields, unsupported events and oversized streams before writes',async()=>{
 writes.length=0;
 for(const [req,status]of [[request({contract:1,event:'app_open'},'hello','bad'),401],[request({contract:1,event:'app_open'},'state'),401],[request({contract:1,event:'vault_opened'}),400],[request({contract:1,event:'app_open',url:'private'}),400],[request(' '.repeat(257)),400]])assert.equal((await collect(req,env,new URL(req.url).pathname.split('/').pop())).status,status);
 assert.equal(writes.length,0);
 assert.equal((await collect(request({contract:1,event:'app_open'}),env,'hello')).status,204);
 assert.deepEqual(writes[0].params.slice(1),['hello','app_open','standalone']);
 assert.equal((await collect(request({contract:1,event:'app_open'}),{...env,DB:{prepare(){throw Error('private error')}}},'hello')).status,503);
});
test('actual SQLite upsert caps concurrent-safe daily counters and pruning preserves current rows',()=>{
 const code=`import sqlite3,json,sys\np=json.load(sys.stdin)\ndb=sqlite3.connect(':memory:')\ndb.executescript(p['migration'])\nfor _ in range(1002): db.execute(p['sql'],('2026-10-14','hello','app_open','standalone'))\ndb.execute(p['sql'],('2026-08-01','hello','app_open','standalone'))\ndb.execute('DELETE FROM composer_usage WHERE day < ?',('2026-09-09',))\nprint(json.dumps(db.execute('SELECT day,n FROM composer_usage').fetchall()))`;
 const rows=JSON.parse(execFileSync('python3',['-c',code],{input:JSON.stringify({migration:readFileSync('migrations/0002_usage.sql','utf8'),sql:incrementSQL}),encoding:'utf8'}));
 assert.deepEqual(rows,[['2026-10-14',1000]]);
});
test('summary ranks opens independently of actions and bounds window, surface and retention',async()=>{
 const report=await summary(db,{days:10000,surface:'private'},new Date('2026-10-14T12:00:00Z'));
 assert.equal(report.from,'2026-10-08');assert.equal(report.days,7);assert.equal(report.surface,'all');assert.equal(report.apps.length,5);assert.equal(report.apps[0].app,'guestbook');assert.equal(report.apps[0].opens,9);assert.equal(report.apps[0].actions,2);
 await purge(db,new Date('2026-10-14T00:00:00Z'));assert.equal(writes.at(-1).params[0],'2026-09-10');
 await assert.rejects(record(db,'state','vault_opened','standalone'));
});
test('optional publisher sends only fixed count, drops verification and errors without affecting response',async()=>{
 const sent=[],pending=[],context={waitUntil(p){pending.push(p)}},settings={USAGE_ENDPOINT:'https://counts.test/api/usage/state',USAGE_TOKEN:token};
 const req=new Request('https://app.test/?private=query',{headers:{Cookie:'private',Referer:'https://private.test'}});
 const send=async(url,options)=>{sent.push({url,options});return new Response(null,{status:204});};
 publish(settings,context,req,'app_open',send);await Promise.all(pending);
 assert.equal(sent.length,1);assert.deepEqual(JSON.parse(sent[0].options.body),{contract:1,event:'app_open'});assert.equal(sent[0].options.redirect,'manual');assert.equal(sent[0].options.headers.Cookie,undefined);
 for(const settings2 of [{},{...settings,USAGE_ENDPOINT:'http://insecure.test'},{...settings,USAGE_ENDPOINT:'https://secret@counts.test'}])publish(settings2,context,req,'app_open',send);
 publish(settings,context,new Request(req,{headers:{'X-Composer-Verification':'1'}}),'app_open',send);assert.equal(sent.length,1);
 publish(settings,context,req,'app_open',async()=>{throw Error('private')});await Promise.all(pending);
});
test('only successful public HTML pages count; health is method-limited liveness without private bindings',async()=>{
 const html=new Response('x',{headers:{'Content-Type':'text/html'}});
 assert.equal(pageEvent(new Request('https://app.test/guestbook/'),html,'/guestbook'),'app_open');
 for(const path of ['/guestbook/owner','/guestbook/media/123','/guestbook/api/items','/guestbook/build.json'])assert.equal(pageEvent(new Request('https://app.test'+path),html,'/guestbook'),null);
 assert.equal(pageEvent(new Request('https://app.test/'),new Response('x',{status:503,headers:{'Content-Type':'text/html'}})),null);
 const probe=health(new Request('https://app.test/healthz'),'/healthz','state','b'.repeat(40));assert.deepEqual(await probe.json(),{status:'up',check:'liveness',app:'state',revision:'b'.repeat(40)});
 assert.equal(health(new Request('https://app.test/healthz',{method:'POST'}),'/healthz','state','b').status,405);
 assert.equal(await health(new Request('https://app.test/healthz',{method:'HEAD'}),'/healthz','state','b').text(),'');
});

test('rate refusal and cached daily cap stop database writes before storage; day rollover resumes',async()=>{
 writes.length=0;const blocked={...env,USAGE_LIMIT:{async limit(){return {success:false}}}};assert.equal((await collect(request({contract:1,event:'app_open'}),blocked,'hello')).status,429);assert.equal(writes.length,0);
 let calls=0;const cappedDB={prepare(){return {bind(){return {async run(){calls++;return {success:true,meta:{changes:0}}}}}}}};
 const day=new Date('2099-01-01T00:00:00Z');assert.equal(await record(cappedDB,'hello','app_open','standalone',day),false);await record(cappedDB,'hello','app_open','standalone',day);assert.equal(calls,1);await record(cappedDB,'hello','app_open','standalone',new Date('2099-01-02T00:00:00Z'));assert.equal(calls,2);
});

test('postcard receipts classify only committed JSON admissions and remain outside legacy action totals',async()=>{
 for(const base of ['', '/guestbook']){
  const req=new Request('https://app.test'+base+'/api/guest-postcard',{method:'POST'});
  assert.equal(postcardReceiptEvent(req,Response.json({id:'fictional',status:'pending'},{status:201}),base),'postcard_received');
  for(const status of [200,400,403,409,429,503])assert.equal(postcardReceiptEvent(req,Response.json({},{status}),base),null);
  assert.equal(postcardReceiptEvent(new Request(req.url),Response.json({},{status:201}),base),null);
  for(const path of ['/api/upload','/api/moderate','/owner','/contribute'])assert.equal(postcardReceiptEvent(new Request('https://app.test'+base+path,{method:'POST'}),Response.json({},{status:201}),base),null);
  assert.equal(postcardReceiptEvent(req,new Response('',{status:201}),base),null);
 }
 const rows={prepare(){return{bind(){return{async all(){return{success:true,results:[{app:'guestbook',event:'item_open',n:2},{app:'guestbook',event:'postcard_received',n:7}]}}}}}}};
 assert.equal((await summary(rows)).apps.find(a=>a.app==='guestbook').actions,2);
});
test('new receipt collection stays Guestbook-scoped and authorised verification writes nothing',async()=>{
 const e={...env,USAGE_TOKENS:JSON.stringify({guestbook:token,showcase:token})};writes.length=0;
 const guest=request({contract:1,event:'postcard_received'},'guestbook');assert.equal((await collect(guest,e,'guestbook')).status,204);assert.equal(writes.length,1);assert.deepEqual(writes[0].params.slice(1),['guestbook','postcard_received','standalone']);
 for(const [app,body] of [['showcase',{contract:1,event:'postcard_received'}],['guestbook',{contract:1,event:'postcard_received',caption:'private'}],['guestbook',{contract:1,event:'publication'}]])assert.equal((await collect(request(body,app),e,app)).status,400);
 const marked=new Request(request({contract:1,event:'postcard_received'},'guestbook'),{headers:{...Object.fromEntries(guest.headers),'X-Composer-Verification':'1'}});assert.equal((await collect(marked,e,'guestbook')).status,204);assert.equal(writes.length,1);
 const unauthorised=new Request(request({contract:1,event:'postcard_received'},'guestbook'),{headers:{...Object.fromEntries(marked.headers),Authorization:'Bearer bad'}});assert.equal((await collect(unauthorised,e,'guestbook')).status,401);
});

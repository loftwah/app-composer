import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,statSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {assertProductionEnvironment,assertProductionTarget,parseAdminSecrets,snapshotAdminSecrets,compositionServices} from '../scripts/deployment-target.mjs';
const lock={id:'a'.repeat(64),apps:[{id:'guestbook'},{id:'showcase'}]};
const config={name:'app-composer',account_id:'selected-account',vars:{PUBLIC_ORIGIN:'https://composer.loftwah.com'},services:lock.apps.map(app=>({binding:app.id.toUpperCase(),service:'composer-'+app.id+'-'+lock.id.slice(0,16)}))};
test('production refuses selected environments and generated target drift',()=>{
 assert.doesNotThrow(()=>assertProductionEnvironment({}));assert.throws(()=>assertProductionEnvironment({CLOUDFLARE_ENV:'preview'}));
 assert.doesNotThrow(()=>assertProductionTarget(config,config,lock));
 for(const changed of [{name:'app-composer-preview'},{account_id:'another-account'},{vars:{PUBLIC_ORIGIN:'https://preview.workers.dev'}},{services:[]},{services:[...config.services,{binding:'EXTRA',service:'another-worker'}]}])assert.throws(()=>assertProductionTarget(config,{...config,...changed},lock));
});
test('connection snapshots bind the validated bytes and preserve the original file',()=>{
 const dir=mkdtempSync(join(tmpdir(),'composer-admin-secrets-'));try{const original=join(dir,'input.json');const approved={GUESTBOOK_OWNER_TOKEN:'fictional-guest',SHOWCASE_OWNER_TOKEN:'fictional-showcase'};writeFileSync(original,JSON.stringify(approved));const validated=parseAdminSecrets(readFileSync(original,'utf8'));writeFileSync(original,JSON.stringify({...approved,UNREVIEWED:'another-secret'}));const snapshot=snapshotAdminSecrets(validated,dir);assert.deepEqual(JSON.parse(readFileSync(snapshot.path,'utf8')),approved);assert.equal(statSync(snapshot.path).mode&0o777,0o600);snapshot.remove();assert.match(readFileSync(original,'utf8'),/UNREVIEWED/);}finally{rmSync(dir,{recursive:true});}
});
test('invalid, expanded or line-breaking secret inputs are refused without echoing them',()=>{
 for(const value of ['sensitive-token',JSON.stringify({GUESTBOOK_OWNER_TOKEN:'x'}),JSON.stringify({GUESTBOOK_OWNER_TOKEN:'x',SHOWCASE_OWNER_TOKEN:'y',EXTRA:'sensitive'}),JSON.stringify({GUESTBOOK_OWNER_TOKEN:'sensitive\nvalue',SHOWCASE_OWNER_TOKEN:'y'})])assert.throws(()=>parseAdminSecrets(value),error=>!error.message.includes('sensitive'));
});
test('member services require the exact reviewed app entrypoint and pin',()=>{
 const selected={...lock,apps:[{id:'guestbook',manifest:{memberService:{version:1,entrypoint:'GuestbookMemberService',transport:'service-binding',path:'/__composer/member'}}},{id:'showcase'}]};
 const connected={...config,services:compositionServices(selected)};
 assert.doesNotThrow(()=>assertProductionTarget(connected,connected,selected));
 for(const change of [{entrypoint:'OtherService'},{service:'composer-guestbook-another-pin'},{binding:'OTHER_SERVICE'}]){
  const changed={...connected,services:connected.services.map(s=>s.binding==='GUESTBOOK_MEMBERS'?{...s,...change}:s)};
  assert.throws(()=>assertProductionTarget(connected,changed,selected));
 }
 assert.throws(()=>assertProductionTarget(connected,{...connected,services:config.services},selected));
});
test('member credentials are paired and distinct from every owner connection',()=>{
 const selected={GUESTBOOK_OWNER_TOKEN:'owner-guest',SHOWCASE_OWNER_TOKEN:'owner-profile',GUESTBOOK_MEMBER_TOKEN:'member-guest',COMPOSER_PROFILE_BRIDGE_TOKEN:'member-profile'};
 assert.deepEqual(JSON.parse(parseAdminSecrets(JSON.stringify(selected))),selected);
 for(const changed of [{...selected,GUESTBOOK_MEMBER_TOKEN:selected.GUESTBOOK_OWNER_TOKEN},{...selected,COMPOSER_PROFILE_BRIDGE_TOKEN:selected.GUESTBOOK_MEMBER_TOKEN},{...selected,COMPOSER_PROFILE_BRIDGE_TOKEN:undefined}])assert.throws(()=>parseAdminSecrets(JSON.stringify(changed)));
});

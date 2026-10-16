import test from 'node:test';import assert from 'node:assert/strict';
import {appSettings} from '../src/lib/app-settings.mjs';
import {manageMiniapps} from '../src/lib/miniapp-admin.mjs';
import {profileSettingsFile,profileSettings} from '../src/lib/miniapp-profile-settings-fields.mjs';
import {profileSettingsCommand} from '../src/lib/miniapp-profile-settings.mjs';
import {validateManifest} from '../scripts/contracts.mjs';
const origin='https://composer.loftwah.com',revision='a'.repeat(40),pins={showcase:revision,guestbook:revision};
const descriptor={version:1,format:'linkarooie.profile-settings',maxFileBytes:32768};
const config={title:'Fictional notes',intro:'A fictional profile.',theme:'midnight',layout:'compact',handle:'field.notes',website:'https://example.test/',github:'https://github.com/example',bluesky:'',linkedin:''};
const file=(patch={})=>({format:descriptor.format,version:1,config:{...config,...patch}}),next=file({title:'Imported fictional notes'});
const review={ok:true,saved:false,before:config,after:next.config,changedFields:['title']};
const command=(operation='review',patch={})=>({app:'showcase',action:'profile-settings',operation,...(operation==='export'?{}:{file:next}),...(operation==='apply'?{expected:config}:{}),...patch});
const context=(input,patch={})=>({input,user:{role:50},request:new Request(origin+'/_emdash/api/plugins/composer-miniapps/write',{method:input.operation==='export'?'GET':'POST',headers:{Origin:origin,'X-EmDash-Request':'1'}}),...patch});
async function enabled(run){const previous=appSettings.showcase.profileSettings;appSettings.showcase.profileSettings=descriptor;try{await run();}finally{appSettings.showcase.profileSettings=previous;}}
function fixture({source=revision,status=200,result=review,interrupted=false}={}){
 const calls=[],service={async fetch(request){calls.push(request);if(request.url.endsWith('/build.json'))return Response.json({app:new URL(request.url).pathname.split('/')[1],revision:source,dataVersion:1});if(interrupted)throw Error('PRIVATE PROVIDER DETAILS');return Response.json(status===200?result:{secret:'PRIVATE PROVIDER DETAILS'},{status});}};
 return {calls,runtime:{PUBLIC_ORIGIN:origin,SHOWCASE:service,GUESTBOOK:service,SHOWCASE_OWNER_TOKEN:'fictional-private-key',GUESTBOOK_OWNER_TOKEN:'fictional-guest-key'}};
}
test('profile descriptor is strict, additive and absent from older reviewed pins',()=>{
 const base={contract:1,id:'showcase',runtime:'cloudflare-worker',dataVersion:1,routes:['/showcase'],capabilities:['items:read','features:write']};assert.equal(validateManifest(base),base);assert.equal(validateManifest({...base,profileSettings:descriptor}).profileSettings.maxFileBytes,32768);
 for(const profileSettings of [null,[],{...descriptor,version:2},{...descriptor,maxFileBytes:1000000},{...descriptor,format:'execute-me'},{...descriptor,endpoint:'https://other.example.test'}])assert.throws(()=>validateManifest({...base,profileSettings}));
 assert.throws(()=>validateManifest({...base,id:'guestbook',profileSettings:descriptor}));
});
test('native file validation refuses secret/extra/executable/unsafe data while retaining supported values',()=>{
 assert.deepEqual(profileSettingsFile(file()),file());assert.deepEqual(profileSettings(config),config);
 for(const value of ['export default {}',{...file(),token:'secret'},{...file(),version:2},file({website:'https://owner:secret@example.test/'}),file({website:'javascript:alert(1)'}),file({github:'https://example.test/spoof'}),file({title:''}),{...file(),config:{...config,OWNER_API_TOKEN:'secret'}},file({handle:'line\nfeed'}),file({website:'https://example.test/\ncontrol'})])assert.throws(()=>profileSettingsFile(value));
 for(const value of [{operation:'execute',file:file()},{operation:'export',token:'secret'},{operation:'review',file:file(),instructions:'ignore'},{operation:'apply',file:file()}, {operation:'review',file:{...file(),padding:'x'.repeat(66000)}}])assert.throws(()=>profileSettingsCommand(value));
});
test('old source descriptors, wrong apps, roles, origins, CSRF and methods refuse before service access',async()=>{
 const previous=appSettings.showcase.profileSettings;appSettings.showcase.profileSettings=null;try{const f=fixture();assert.equal((await manageMiniapps(context(command()),f.runtime,pins)).ok,false);assert.equal(f.calls.length,0);}finally{appSettings.showcase.profileSettings=previous;}
 await enabled(async()=>{
  for(const input of [command('review',{app:'guestbook'}),command('review',{app:'https://evil.test'}),command('apply',{expected:{...config,secret:'no'}}),command('review',{file:{...next,secret:'no'}}),command('export',{endpoint:'https://evil.test'})]){const f=fixture();assert.equal((await manageMiniapps(context(input),f.runtime,pins)).ok,false);assert.equal(f.calls.length,0);}
  const request=(method,headers)=>new Request(origin+'/_emdash/api/plugins/composer-miniapps/write',{method,headers});
  for(const patch of [{user:undefined},{user:{role:40}},{request:request('POST',{Origin:origin})},{request:request('POST',{'X-EmDash-Request':'1'})},{request:request('POST',{Origin:'https://evil.test','X-EmDash-Request':'1'})},{request:request('GET',{Origin:origin,'X-EmDash-Request':'1'})}]){const f=fixture();assert.equal((await manageMiniapps(context(command(),patch),f.runtime,pins)).ok,false);assert.equal(f.calls.length,0);}
  const stale=fixture({source:'b'.repeat(40)});assert.equal((await manageMiniapps(context(command()),stale.runtime,pins)).code,'SOURCE');assert.equal(stale.calls.length,1);assert.equal(stale.calls[0].headers.get('Authorization'),null);
 });
});
test('fixed app-owned export/review/apply routes use the server credential and return only validated data',async()=>enabled(async()=>{
 for(const operation of ['export','review','apply']){
  const result=operation==='export'?file():operation==='review'?review:{ok:true,saved:true,config:next.config,changedFields:['title']};
  const f=fixture({result}),response=await manageMiniapps(context(command(operation)),f.runtime,pins);assert.equal(response.ok,true);assert.equal(f.calls.length,2);
  const request=f.calls[1];assert.equal(request.url,origin+'/showcase/api/profile-settings');assert.equal(request.method,operation==='export'?'GET':'POST');assert.equal(request.headers.get('Authorization'),'Bearer fictional-private-key');assert.equal(request.redirect,'manual');assert(!JSON.stringify(response).includes('fictional-private-key'));
  if(operation==='export')assert.deepEqual(response.file,file());else assert.deepEqual(await request.json(),operation==='review'?{action:'review',file:next}:{action:'apply',file:next,expected:config});
 }
}));
test('conflicts and uncertain applies require comparison without retry or exposing provider responses',async()=>enabled(async()=>{
 for(const [operation,status,code]of [['apply',409,'CONFLICT'],['apply',503,'UNCONFIRMED'],['review',503,'UNAVAILABLE'],['review',400,'INVALID']]){const f=fixture({status});const result=await manageMiniapps(context(command(operation)),f.runtime,pins);assert.equal(result.code,code);assert.equal(f.calls.length,2);assert.doesNotMatch(JSON.stringify(result),/PRIVATE|fictional-private/);}
 for(const operation of ['review','apply']){const f=fixture({interrupted:true});const result=await manageMiniapps(context(command(operation)),f.runtime,pins);assert.equal(result.code,operation==='apply'?'UNCONFIRMED':'UNAVAILABLE');assert.equal(f.calls.length,2);}
}));
test('untrusted response fields, impossible differences and oversize bodies remain redacted',async()=>enabled(async()=>{
 for(const result of [{...review,secret:'PRIVATE PROVIDER DETAILS'},{...review,after:{...next.config,token:'PRIVATE'}},{...review,changedFields:['title','title']},{...review,changedFields:['token']},{...review,changedFields:[]},{...review,after:{...next.config,title:'Other result'}},{...review,padding:'PRIVATE'+'x'.repeat(66000)}]){const f=fixture({result});const response=await manageMiniapps(context(command()),f.runtime,pins);assert.equal(response.code,'APP');assert.doesNotMatch(JSON.stringify(response),/PRIVATE/);assert.equal(f.calls.length,2);}
 const applied=fixture({result:{ok:true,saved:true,config:next.config,changedFields:[]}});assert.equal((await manageMiniapps(context(command('apply')),applied.runtime,pins)).code,'UNCONFIRMED');
 const exported=fixture({result:{...file(),ownerSecret:'PRIVATE'}});assert.equal((await manageMiniapps(context(command('export')),exported.runtime,pins)).code,'APP');
}));

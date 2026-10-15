import test from 'node:test';import assert from 'node:assert/strict';
import {validateSpec,handoff} from '../src/lib/spec.mjs';
import {appSettings,appConfiguration,selectedSources} from '../src/lib/app-settings.mjs';
import {configurationPlan,applyConfiguration,verifyConfigurationTarget} from '../scripts/app-configuration.mjs';
import lock from '../composition.lock.json' with {type:'json'};
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const old=()=>({version:1,preset:'composition',config:{title:'Fictional shared title',intro:'Fictional shared introduction',theme:'daylight',layout:'grid'},privacy:'review-first',cards:[],deployment:{mode:'existing-domain',hostname:'composer.loftwah.com'}});
const spec=()=>({...validateSpec(old()),appSettings:{guestbook:{...old().config,title:'Fictional submissions',theme:'midnight'},showcase:{...Object.fromEntries(appSettings.showcase.fields.map(field=>[field.key,field.default])),...old().config,title:'Fictional favourites',layout:'editorial'}}});

test('legacy drafts migrate without changing effective settings and v2 pins survive deterministic reopen',()=>{
 const migrated=validateSpec(old());assert.equal(migrated.version,2);assert.deepEqual(migrated.appSettings,{});assert.deepEqual(migrated.sources,selectedSources(migrated.apps));
 for(const id of migrated.apps)assert.deepEqual(appConfiguration(migrated,id),{...Object.fromEntries(appSettings[id].fields.map(field=>[field.key,field.default])),...old().config});
 const configured=validateSpec(spec());assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(configured))),configured);
 assert.equal(appConfiguration(configured,'guestbook').title,'Fictional submissions');assert.equal(appConfiguration(configured,'guestbook').layout,'grid');assert.equal(appConfiguration(configured,'showcase').theme,'daylight');assert.equal(appConfiguration(configured,'showcase').layout,'editorial');
 assert.match(handoff(configured),/Specification \(version 2\)/);assert.ok(handoff(configured).includes(lock.apps[0].commit));
 assert.throws(()=>validateSpec({...old(),appSettings:{guestbook:{title:'New meaning'}}}),/version 2/);
 assert.throws(()=>validateSpec({...spec(),appSettings:{guestbook:{title:'Sparse settings'}}}),/complete field group/);
});

test('actual pinned field constraints reject unsupported nested settings and source drift',()=>{
 assert.equal(appSettings.guestbook.fields.find(f=>f.key==='title').maxLength,lock.apps[0].manifest.configuration.title.maxLength);
 for(const appSettings of [{guestbook:{title:''}},{guestbook:{title:'x'.repeat(81)}},{showcase:{intro:'bad\u0000text'}},{showcase:{theme:'neon'}},{showcase:{layout:'masonry'}},{guestbook:{secret:'fictional-token'}},{unknown:{title:'Wrong app'}},{guestbook:[]},[]])assert.throws(()=>validateSpec({...spec(),appSettings}));
 assert.throws(()=>validateSpec({...spec(),preset:'guestbook',sources:selectedSources(['guestbook'])}),/selected supported app/);
 assert.throws(()=>validateSpec({...spec(),sources:spec().sources.map((s,i)=>i?{...s,commit:'a'.repeat(40)}:s)}),/contracts have changed/);
 assert.throws(()=>configurationPlan(spec(),lock.apps.map((a,i)=>i?{...a,manifestDigest:'changed'}:a)),/Selected source changed/);
});

test('settings-only posts independent effective values, confirms exact responses and preserves partial outcomes on refusal',async()=>{
 const plan=configurationPlan(spec(),lock.apps),calls=[];let checks=0;
 const result=await applyConfiguration(plan,{credential:()=> 'fictional-private-token',beforeWrite:()=>{checks++;},request:async(url,options)=>{calls.push({url,body:JSON.parse(options.body),redirect:options.redirect});return Response.json({ok:true,config:JSON.parse(options.body)});}});
 assert.deepEqual(result,{configured:['guestbook','showcase'],deployed:false});assert.equal(checks,2);assert.equal(calls[0].body.title,'Fictional submissions');assert.equal(calls[1].body.title,'Fictional favourites');assert.deepEqual(calls.map(c=>c.url),['https://guestbook.loftwah.com/api/config','https://showcase.loftwah.com/api/config']);assert.ok(calls.every(c=>c.redirect==='error'));
 let writes=0;
 await assert.rejects(applyConfiguration(plan,{credential:()=> 'fictional-token',beforeWrite:()=>{if(writes)throw Error('Workspace changed');},request:async(_url,options)=>{writes++;return Response.json({ok:true,config:JSON.parse(options.body)});}}),/Workspace changed/);assert.equal(writes,1);
 await assert.rejects(applyConfiguration(plan,{credential:()=> 'fictional-token',beforeWrite:()=>{},request:async()=>Response.json({ok:true,config:{title:'wrong'}})}),/did not match/);
 for(const invalid of [[],[{...plan[0],url:'https://untrusted.example'}],[plan[0],plan[0]],[{...plan[0],configuration:{title:'incomplete'}}]]){
  let touched=0;await assert.rejects(applyConfiguration(invalid,{credential:()=>{touched++;},beforeWrite:()=>{touched++;},request:async()=>{touched++;}}));assert.equal(touched,0);
 }
});

test('settings-only refuses card, preview, purchase and unrelated-target intent before workspace or staging IO',()=>{
 const folder=mkdtempSync(join(tmpdir(),'composer-settings-preflight-'));
 try{
  const untouched=join(folder,'composition.lock.json');writeFileSync(untouched,'owner composition stays intact\n');
  for(const [input,reason] of [[{...spec(),cards:[{title:'Fictional card',url:'https://example.com'}]},/preserves all cards/],[{...spec(),deployment:{mode:'preview',hostname:''}},/does not authorise/],[{...spec(),deployment:{mode:'new-domain',hostname:''}},/purchase requires/],[{...spec(),deployment:{mode:'existing-domain',hostname:'other.example.com'}},/target has not been verified/]]){
   const path=join(folder,'spec.json');writeFileSync(path,JSON.stringify(input));
   const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/compose.mjs',import.meta.url)),'--spec',path,'--apply-settings'],{cwd:folder,env:{PATH:''},encoding:'utf8',timeout:5000});
   assert.equal(result.status,1);assert.match(result.stderr,reason);assert.equal(readFileSync(untouched,'utf8'),'owner composition stays intact\n');assert.equal(existsSync(join(folder,'.private')),false);
  }
 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('app source drift between writes refuses the later app and retains the completed first settings',async()=>{
 const plan=configurationPlan(spec(),lock.apps);let writes=0,reads=0;
 const request=async(_url,options)=>{if(options.method==='POST'){writes++;return Response.json({ok:true,config:JSON.parse(options.body)});}reads++;return Response.json({revision:writes?'a'.repeat(40):plan[0].source.commit});};
 await assert.rejects(applyConfiguration(plan,{credential:()=> 'fictional-token',beforeWrite:app=>verifyConfigurationTarget(app,request),request}),/Current app source changed/);
 assert.equal(writes,1);assert.equal(reads,3);
});

test('profile contracts configure compact identity and refuse unsafe social values before apply',()=>{
 const complete=spec();complete.appSettings.showcase={...complete.appSettings.showcase,layout:'compact',handle:'fictional.studio',github:'https://github.com/example',website:'https://example.test/'};
 const configured=validateSpec(complete),effective=appConfiguration(configured,'showcase');assert.equal(effective.layout,'compact');assert.equal(effective.handle,'fictional.studio');assert.equal(effective.github,'https://github.com/example');assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(configured))),configured);
 for(const patch of [{github:'https://example.test/spoof'},{website:'javascript:alert(1)'},{website:'https://owner:secret@example.test/'},{handle:'<script>'},{website:'https://example.test/'+'é'.repeat(600)},{bluesky:'https://bsky.app.evil.test/'}])assert.throws(()=>validateSpec({...complete,appSettings:{...complete.appSettings,showcase:{...complete.appSettings.showcase,...patch}}}));
 assert.equal(appConfiguration(validateSpec(old()),'showcase').handle,'');assert.deepEqual(appSettings.showcase.cardPresentation.icons,['link','book','code','music','video','heart']);
});

test('shared-only and legacy settings omit profile clears while explicit profile groups can clear them',async()=>{
 for(const input of [old(),validateSpec(old())]){
  const plan=configurationPlan(input,lock.apps);const target=plan.find(app=>app.id==='showcase');assert.deepEqual(target.configuration,old().config);
  const sent=[];await applyConfiguration(plan,{credential:()=> 'fictional-token',beforeWrite:()=>{},request:async(_url,options)=>{const patch=JSON.parse(options.body);sent.push(patch);return Response.json({ok:true,config:patch});}});assert.equal(Object.hasOwn(sent[1],'handle'),false);assert.equal(Object.hasOwn(sent[1],'github'),false);
 }
 const explicit=spec();explicit.appSettings.showcase.handle='';explicit.appSettings.showcase.github='';const full=configurationPlan(explicit,lock.apps).find(app=>app.id==='showcase').configuration;assert.equal(Object.hasOwn(full,'handle'),true);assert.equal(full.github,'');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {ownedFixture} from './fixtures/owned-reference.mjs';
import {fixture} from './fixtures/readiness-target.mjs';
import {createLocalAdapter,discoverWorkspace} from '../lib/get-ready/index.mjs';
import {verifyNewWorkersDevTarget,verifyOwnedDeploymentVersion} from '../lib/get-ready/local.mjs';
const token='fictional-selected-oauth',version='11111111-2222-4333-8444-555555555555';
function oauth(f,{rotate=false}={}){
 const env={...f.env,HOME:f.root};delete env.CLOUDFLARE_API_TOKEN;
 mkdirSync(join(f.root,'.wrangler/config'),{recursive:true});const cache=join(f.root,'.wrangler/config/default.toml');writeFileSync(cache,'Fictional existing credential cache; preserve.');
 const calls=join(f.root,'auth-calls.json');writeFileSync(calls,'0');
 const bin=join(f.workspace,'node_modules/wrangler/bin/wrangler.js');let source=readFileSync(bin,'utf8');
 source=`import * as authFS from 'node:fs';
 if(process.argv.slice(2,5).join(' ')==='auth token --json'){
  const count=JSON.parse(authFS.readFileSync(${JSON.stringify(calls)},'utf8'))+1;authFS.writeFileSync(${JSON.stringify(calls)},JSON.stringify(count));
  if(process.env.WRANGLER_WRITE_LOGS!=='false')process.exit(9);
  console.log(JSON.stringify({type:'oauth',token:${rotate?`count===1?${JSON.stringify(token)}:'fictional-other-identity'`:JSON.stringify(token)}}));process.exit(0);
 }
 `+source;
 source=source.replace('events.push({dryRun:',`events.push({home:process.env.HOME,cacheAvailable:existsSync(process.env.HOME+'/.wrangler/config/default.toml'),oauthSelected:process.env.CLOUDFLARE_API_TOKEN===${JSON.stringify(token)},dryRun:`);
 writeFileSync(bin,source);
 const gh=join(f.root,'bin/gh');writeFileSync(gh,readFileSync(gh,'utf8').replace('#!/bin/sh\n','#!/bin/sh\nif [ "$CLOUDFLARE_API_TOKEN" = "fictional-selected-oauth" ]; then exit 99; fi\n'));
 return {env,count:()=>JSON.parse(readFileSync(calls)),cache,assertPreserved:()=>assert.equal(readFileSync(cache,'utf8'),'Fictional existing credential cache; preserve.')};
}
const reply=result=>Response.json({success:true,result});
function provider(f,{deniedAt=0,status=403,credential=token}={}){
 let inventory=0;
 return async(url,options)=>{
  if(url.endsWith('/build.json')){assert.equal(options.headers.Authorization,undefined);return Response.json({app:'hello',commit:f.source,title:'Fictional welcome',contract:1,dataVersion:1});}
  assert.equal(options.headers.Authorization,'Bearer '+credential);
  assert.ok(url.startsWith('https://api.cloudflare.com/client/v4/accounts/'+f.context.account+'/workers/'));assert.equal(options.redirect,'error');
  if(url.endsWith('/scripts')){inventory++;if(inventory===deniedAt)return new Response('Private provider detail',{status});return reply([]);}
  if(url.includes('/scripts/'))return reply({enabled:true});return reply({subdomain:'fixture'});
 };
}

test('owned deployment freezes the selected OAuth credential and isolates both build and upload from cached logins',async()=>{
 const f=ownedFixture(),auth=oauth(f,{rotate:true}),prior=globalThis.fetch;
 try{
  globalThis.fetch=provider(f);const result=await createLocalAdapter(f.context,auth.env).deployOwnedReference();
  assert.equal(result.created,true);assert.equal(result.version,version);assert.equal(auth.count(),1);assert.ok(!JSON.stringify(result).includes(token));
  const events=f.events();assert.equal(events.length,2);assert.equal(events[0].dryRun,true);assert.equal(events[0].token,false);assert.equal(events[1].token,true);assert.equal(events[1].oauthSelected,true);
  assert.ok(events.every(event=>event.home!==f.root&&!event.cacheAvailable));assert.equal(events[0].home,events[1].home);assert.equal(existsSync(events[0].home),false);
  auth.assertPreserved();assert.equal(f.git(['status','--porcelain']),'');
 }finally{globalThis.fetch=prior;f.cleanup();}
});

test('an initial or final provider denial cannot switch OAuth identity or retry an upload',async()=>{
 const prior=globalThis.fetch;
 try{for(const [deniedAt,status,code]of [[1,403,'permission'],[2,401,'authentication']]){
  const f=ownedFixture(),auth=oauth(f,{rotate:true});try{
   globalThis.fetch=provider(f,{deniedAt,status});await assert.rejects(createLocalAdapter(f.context,auth.env).deployOwnedReference(),{code});
   assert.equal(auth.count(),1);assert.ok(f.events().every(event=>event.dryRun));assert.equal(f.events().length,deniedAt===1?0:1);auth.assertPreserved();
  }finally{f.cleanup();}
 }}finally{globalThis.fetch=prior;}
});

test('local target preparation can use existing OAuth without reserving or deploying a Worker',async()=>{
 const f=fixture(),auth=oauth(f,{rotate:true}),prior=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer '+token);return reply(url.endsWith('/subdomain')?{subdomain:'fixture'}:[]);};
  const result=await createLocalAdapter(f.context,auth.env).prepareReferenceTarget();assert.equal(result.deployed,false);assert.equal(auth.count(),1);
  const config=JSON.parse(readFileSync(join(f.workspace,'wrangler.jsonc')));assert.equal(config.account_id,f.context.account);assert.equal(config.name,f.context.worker);assert.equal(config.routes,undefined);auth.assertPreserved();
 }finally{globalThis.fetch=prior;f.cleanup();}
});

test('the direct target and active-version probes share selected OAuth and retain scope/version guards',async()=>{
 const f=fixture(),auth=oauth(f);
 try{
  const request=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer '+token);return reply(url.includes('/deployments?')?{deployments:[{versions:[{version_id:version,percentage:100}]}]}:url.endsWith('/subdomain')?{subdomain:'fixture'}:[]);};
  assert.deepEqual(await verifyNewWorkersDevTarget(f.context,auth.env,request),{subdomain:'fixture',available:true});assert.deepEqual(await verifyOwnedDeploymentVersion(f.context,version,auth.env,request),{version});assert.equal(auth.count(),2);auth.assertPreserved();
 }finally{f.cleanup();}
});


test('an explicit API selection is never replaced by the existing OAuth cache for deployment',async()=>{
 const prior=globalThis.fetch;
 try{for(const deniedAt of [0,1]){const f=ownedFixture(),auth=oauth(f);try{
  const credential='fictional-selected-api';globalThis.fetch=provider(f,{deniedAt,credential});const adapter=createLocalAdapter(f.context,{...auth.env,CLOUDFLARE_API_TOKEN:credential});
  if(deniedAt)await assert.rejects(adapter.deployOwnedReference(),{code:'permission'});else{const result=await adapter.deployOwnedReference();assert.equal(result.created,true);assert.ok(f.events().every(event=>event.home!==f.root&&!event.cacheAvailable));}
  assert.equal(auth.count(),0);auth.assertPreserved();
 }finally{f.cleanup();}}}finally{globalThis.fetch=prior;}
});

test('owned updates keep previous-version/source checks on the frozen OAuth credential without leaking it to GitHub',async()=>{
 const f=ownedFixture(),prior=globalThis.fetch,previousVersion='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 try{
  const configuration={title:'Fictional next chapter',intro:'A configured fictional update.',theme:'daylight'};
  writeFileSync(join(f.workspace,'config.json'),JSON.stringify(configuration,null,2)+'\n');f.git(['add','config.json']);f.git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Synthetic configured update']);
  const source=f.git(['rev-parse','HEAD']);f.git(['update-ref','refs/remotes/origin/main',source]);
  writeFileSync(join(f.root,'bin/gh'),`#!/bin/sh\ncase "$2" in\n user) printf '{"login":"fixture"}\\n' ;;\n repos/fixture/hello) printf '{"full_name":"fixture/hello","owner":{"login":"fixture"},"private":true,"default_branch":"main","permissions":{"push":true}}\\n' ;;\n repos/loftwah/app-composer-hello/commits/main) printf '${f.baseline}\\n' ;;\n repos/fixture/hello/commits/${f.source}) printf '${f.source}\\n' ;;\n *) printf '${source}\\n' ;;\nesac\n`,{mode:0o755});
  const auth=oauth(f,{rotate:true});let versions=0;
  globalThis.fetch=async(url,options)=>{
   const uploaded=f.events().some(event=>!event.dryRun);
   if(url.endsWith('/build.json')){assert.equal(options.headers.Authorization,undefined);return Response.json({app:'hello',commit:uploaded?source:f.source,title:uploaded?configuration.title:'Fictional welcome',contract:1,dataVersion:1});}
   assert.equal(options.headers.Authorization,'Bearer '+token);
   if(url.includes('/deployments?')){versions++;return reply({deployments:[{versions:[{version_id:uploaded?version:previousVersion,percentage:100}]}]});}
   return reply(url.includes('/scripts/')?{enabled:true}:{subdomain:'fixture'});
  };
  const result=await createLocalAdapter({...f.context,...discoverWorkspace(f.workspace)},auth.env).updateOwnedReference({source:f.source,version:previousVersion});
  assert.equal(result.updated,true);assert.equal(result.commit,source);assert.equal(auth.count(),1);assert.ok(versions>=5);assert.equal(f.events().filter(event=>!event.dryRun).length,1);
  assert.ok(f.events().every(event=>event.home!==f.root&&!event.cacheAvailable));assert.ok(!JSON.stringify(result).includes(token));auth.assertPreserved();assert.equal(f.git(['status','--porcelain']),'');
 }finally{globalThis.fetch=prior;f.cleanup();}
});

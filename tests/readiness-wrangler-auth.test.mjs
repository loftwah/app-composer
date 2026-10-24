import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {verifyReferenceRouting,localChecks,runWorkspaceWrangler,wranglerEnvironment} from '../lib/get-ready/local-checks.mjs';
import {ReadinessFailure,runReadinessCheck} from '../lib/get-ready/check.mjs';

const account='b'.repeat(32),token='fictional_OAuth-credential.not-real',source='a'.repeat(40);
const context=workspace=>({workspace,account,worker:'fictional-hello',repo:'fictional/hello',source,target:{origin:'https://hello.example.test',repo:'fictional/hello'}});
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'composer-wrangler-auth-'));
 mkdirSync(join(root,'node_modules/wrangler/bin'),{recursive:true});
 writeFileSync(join(root,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',version:'4.152.0',bin:{wrangler:'./bin/wrangler.js'}}));
 const configure=(identity={loggedIn:true,accounts:[{id:account}]},credential={type:'oauth',token})=>writeFileSync(join(root,'node_modules/wrangler/bin/wrangler.js'),`
 import {appendFileSync} from 'node:fs';
 const args=process.argv.slice(2);
 appendFileSync(${JSON.stringify(join(root,'calls'))},JSON.stringify(args)+'\\n');
 if(process.env.WRANGLER_WRITE_LOGS!=='false'||process.env.WRANGLER_SEND_METRICS!=='false'||process.env.CLOUDFLARE_API_KEY||process.env.CLOUDFLARE_API_BASE_URL||process.env.NODE_OPTIONS||!args.includes('--env-file=/dev/null'))process.exit(9);
 console.log(JSON.stringify(args[0]==='whoami'?${JSON.stringify(identity)}:${JSON.stringify(credential)}));
 `);
 configure();
 return {root,configure,calls:()=>existsSync(join(root,'calls'))?readFileSync(join(root,'calls'),'utf8').trim().split('\n').map(line=>JSON.parse(line)):[],close:()=>rmSync(root,{recursive:true})};
}
const json=(result,status=200)=>new Response(JSON.stringify({success:status===200,result}),{status});
function provider(request){const prior=globalThis.fetch;globalThis.fetch=request;return ()=>{globalThis.fetch=prior;};}
const environment=()=>({PATH:process.env.PATH,HOME:tmpdir(),CLOUDFLARE_API_KEY:'fictional-private-key',CLOUDFLARE_API_BASE_URL:'https://other.example.test',WRANGLER_WRITE_LOGS:'true',WRANGLER_LOG:'debug',NODE_OPTIONS:'--invalid-fictional-option'});

test('routing reuses the workspace OAuth credential, binds account/hostname and omits credentials from evidence',async()=>{
 const f=fixture(),env=environment(),before={...env},requests=[];
 const restore=provider(async(url,options)=>{requests.push(url);assert.equal(options.headers.Authorization,'Bearer '+token);assert.equal(options.redirect,'error');return json([{hostname:'hello.example.test',service:'fictional-hello',environment:'production',enabled:true,zone_name:'example.test'}]);});
 try{
  assert.deepEqual(await verifyReferenceRouting(context(f.root),env),{kind:'custom-domain',worker:'fictional-hello',zone:'example.test'});
  assert.deepEqual(f.calls(),[['whoami','--json','--env-file=/dev/null'],['auth','token','--json','--env-file=/dev/null']]);
  assert.deepEqual(requests,['https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/domains']);assert.deepEqual(env,before);
 }finally{restore();f.close();}
});

test('workers.dev proof requires the exact selected subdomain and enabled Worker',async()=>{
 const f=fixture();let enabled=true;
 const restore=provider(async url=>json(url.endsWith('/workers/subdomain')?{subdomain:'fictional-account'}:{enabled}));
 try{
  const selected={...context(f.root),target:{origin:'https://fictional-hello.fictional-account.workers.dev',repo:'fictional/hello'}};
  assert.deepEqual(await verifyReferenceRouting(selected,{}),{kind:'workers.dev',worker:'fictional-hello'});
  enabled=false;await assert.rejects(verifyReferenceRouting(selected,{}),{code:'configuration'});
  enabled=true;selected.target.origin='https://other.fictional-account.workers.dev';await assert.rejects(verifyReferenceRouting(selected,{}),{code:'configuration'});
 }finally{restore();f.close();}
});

test('explicit API tokens stay selected across denial/outage and never resolve a fallback identity',async()=>{
 const f=fixture(),explicit='fictional_selected-api-token';let status=200,calls=0;
 const restore=provider(async(_url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer '+explicit);return json([{hostname:'hello.example.test',service:'fictional-hello',environment:'production',enabled:true}],status);});
 try{
  const env={...environment(),CLOUDFLARE_API_TOKEN:explicit};await verifyReferenceRouting(context(f.root),env);
  for(const [value,code]of [[401,'authentication'],[403,'permission'],[429,'unavailable'],[503,'unavailable']]){status=value;await assert.rejects(verifyReferenceRouting(context(f.root),env),{code});}
  assert.equal(calls,5);assert.deepEqual(f.calls(),[]);
  for(const invalid of ['',null,42,'invalid\ncredential',' '.repeat(5),'a'.repeat(8193)])await assert.rejects(verifyReferenceRouting(context(f.root),{CLOUDFLARE_API_TOKEN:invalid}),{code:'authentication'});
  assert.deepEqual(f.calls(),[]);assert.equal(calls,5);
 }finally{restore();f.close();}
});

test('missing login, mismatched account and malformed credential never reach a provider or leak subprocess output',async()=>{
 const f=fixture(),restore=provider(()=>assert.fail('No authorised credential'));
 try{
  f.configure({loggedIn:false});await assert.rejects(verifyReferenceRouting(context(f.root),{}),{code:'authentication'});assert.equal(f.calls().length,1);
  f.configure({loggedIn:true,accounts:[{id:'c'.repeat(32)}]});await assert.rejects(verifyReferenceRouting(context(f.root),{}),{code:'configuration'});assert.equal(f.calls().length,2);
  for(const credential of [null,{type:'api_key',key:token,email:'fictional@example.test'},{type:'api_token',token},{type:'oauth',token,extra:token},{type:'oauth',token:'bad\n'+token},{type:'oauth',token:''}]){
   f.configure(undefined,credential);await assert.rejects(verifyReferenceRouting(context(f.root),{}),error=>error instanceof ReadinessFailure&&error.code==='response'&&!JSON.stringify(error).includes(token));
  }
 }finally{restore();f.close();}
});

test('HTTPS verification still checks exact Hello source and reports provider denial without a credential',async()=>{
 const f=fixture();mkdirSync(join(f.root,'bin'));writeFileSync(join(f.root,'bin/gh'),'#!/bin/sh\nprintf "%s\\n" "'+source+'"\n',{mode:0o755});let mode='ok';
 const restore=provider(async(url,options)=>{
  if(url.startsWith('https://api.cloudflare.com/')){assert.equal(options.headers.Authorization,'Bearer '+token);return json([{hostname:'hello.example.test',service:'fictional-hello',environment:'production',enabled:true}],mode==='denied'?403:200);}
  assert.equal(options.headers.Authorization,undefined);assert.equal(url,'https://hello.example.test/build.json');return new Response(JSON.stringify({app:'hello',commit:mode==='source'?'c'.repeat(40):source}));
 });
 try{
  const check=localChecks(context(f.root),{PATH:join(f.root,'bin')}).find(c=>c.id==='https'),state={checks:{}};
  for(const [value,expected]of [['ok','verified'],['source','failed'],['denied','action_required']]){
   mode=value;await runReadinessCheck(state,check,()=>{});assert.equal(state.checks.https.state,expected);
   assert.doesNotMatch(JSON.stringify(state),new RegExp(token));
  }
  assert.equal(state.checks.https.issue.code,'permission');assert.match(state.checks.https.action,/existing selected Wrangler sign-in/);
 }finally{restore();f.close();}
});

test('credential-command failure output is discarded before a saved check result',async()=>{
 const f=fixture(),restore=provider(()=>assert.fail('No credential may be used'));
 try{
  writeFileSync(join(f.root,'node_modules/wrangler/bin/wrangler.js'),`if(process.argv.includes('whoami'))console.log(JSON.stringify({loggedIn:true,accounts:[{id:${JSON.stringify(account)}}]}));else{console.error(${JSON.stringify(token)});console.log(${JSON.stringify(token)});process.exit(1);}`);
  const state={checks:{}},check=localChecks(context(f.root),{}).find(c=>c.id==='https');
  await runReadinessCheck(state,check,()=>{});assert.equal(state.checks.https.state,'failed');assert.equal(state.checks.https.issue.recovery,'agent-repair');assert.doesNotMatch(JSON.stringify(state),new RegExp(token));
 }finally{restore();f.close();}
});

test('pinned Wrangler can retrieve a fictional unexpired OAuth token without persisting credential logs',()=>{
 const home=mkdtempSync(join(tmpdir(),'composer-wrangler-native-auth-'));
 try{
  const config=join(home,'.wrangler/config');mkdirSync(config,{recursive:true});
  const auth=join(config,'default.toml'),bytes='oauth_token = "'+token+'"\nexpiration_time = "2099-01-01T00:00:00.000Z"\n';writeFileSync(auth,bytes,{mode:0o600});
  const env={PATH:process.env.PATH,HOME:home,WRANGLER_WRITE_LOGS:'true',WRANGLER_LOG:'debug'};
  const output=runWorkspaceWrangler(resolve('.'),['auth','token','--json'],env);
  assert.deepEqual(JSON.parse(output),{type:'oauth',token});assert.equal(readFileSync(auth,'utf8'),bytes);assert.equal(existsSync(join(home,'.wrangler/logs')),false);
  assert.equal(wranglerEnvironment(env).WRANGLER_WRITE_LOGS,'false');
 }finally{rmSync(home,{recursive:true});}
});

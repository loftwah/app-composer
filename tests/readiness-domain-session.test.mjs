import {execFileSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {diagnoseDomain} from '../lib/get-ready/domain.mjs';import {inspectDomainReport} from '../lib/get-ready/domain-report.mjs';
const account='a'.repeat(32),zone='b'.repeat(32),domain='example.test',token='fictional-session-token';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'composer-domain-session-')),calls=join(root,'calls');mkdirSync(join(root,'node_modules/wrangler/bin'),{recursive:true});writeFileSync(join(root,'node_modules/wrangler/package.json'),JSON.stringify({name:'wrangler',version:'4.143.1',bin:{wrangler:'./bin/wrangler.js'}}));
 const configure=(identity={loggedIn:true,accounts:[{id:account}]},credential={type:'oauth',token})=>writeFileSync(join(root,'node_modules/wrangler/bin/wrangler.js'),`import fs from 'node:fs';const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');if(process.env.WRANGLER_WRITE_LOGS!=='false'||process.env.WRANGLER_SEND_METRICS!=='false'||process.env.NODE_OPTIONS||process.env.CLOUDFLARE_API_KEY||!args.includes('--env-file=/dev/null'))process.exit(9);console.log(JSON.stringify(args[0]==='whoami'?${JSON.stringify(identity)}:${JSON.stringify(credential)}));`);configure();
 const requests=[],request=async(url,options)=>{requests.push({url,options});const u=new URL(url);assert.equal(options.redirect,'error');assert.equal(options.method,undefined);if(u.hostname==='api.cloudflare.com')return Response.json({success:true,...(u.pathname==='/client/v4/zones'?{result:[{id:zone,name:domain,account:{id:account},status:'active',paused:false,type:'full',name_servers:['one.ns.cloudflare.com']}],result_info:{total_count:1}}:{result:{status:'disabled',ds:null}})});assert.equal(options.headers.Authorization,undefined);const type=u.searchParams.get('type')==='NS'?2:43;return Response.json({Status:0,TC:false,Question:[{name:domain+'.',type}],Answer:type===2?[{name:domain+'.',type,data:'one.ns.cloudflare.com'}]:[],Authority:[{name:'test.',type:6,data:'ns.test. hostmaster.test. 1 3600 600 86400 3600'}]});};
 return {root,configure,requests,request,calls:()=>existsSync(calls)?readFileSync(calls,'utf8').trim().split('\n').map(line=>JSON.parse(line)):[],close:()=>rmSync(root,{recursive:true})};
}
test('domain diagnosis reuses only the selected workspace login once without forwarding it to DNS or reports',async()=>{
 const f=fixture(),env={HOME:f.root,PATH:'',NODE_OPTIONS:'--invalid',CLOUDFLARE_API_KEY:'fictional-excluded',WRANGLER_WRITE_LOGS:'true'},before={...env};try{
 const report=await diagnoseDomain({account,domain,workspace:f.root},env,{request:f.request});assert.equal(inspectDomainReport(report).dnsReady,true);assert.deepEqual(f.calls(),[['whoami','--json','--env-file=/dev/null'],['auth','token','--json','--env-file=/dev/null']]);assert.equal(f.requests.length,4);for(const call of f.requests.filter(call=>call.url.startsWith('https://api.cloudflare.com/')))assert.equal(call.options.headers.Authorization,'Bearer '+token);assert.deepEqual(env,before);assert.ok(!JSON.stringify(report).includes(token));assert.ok(!JSON.stringify(report).includes(f.root));assert.equal(existsSync(join(f.root,'.private')),false);
 }finally{f.close();}
});


test('explicit domain tokens retain priority and denial never switches credential or retries',async()=>{
 for(const status of [200,403,503]){const f=fixture();try{
  const used=[],request=async(url,options)=>{if(new URL(url).hostname==='api.cloudflare.com'){used.push(options.headers.Authorization);if(status!==200)return new Response('Private provider text',{status});}return f.request(url,options);};
  const report=await diagnoseDomain({account,domain,workspace:f.root},{CLOUDFLARE_API_TOKEN:'fictional-explicit'},{request});assert.deepEqual(f.calls(),[]);assert.ok(used.every(value=>value==='Bearer fictional-explicit'));assert.equal(used.length,status===200?2:1);assert.equal(report.zone.issue,status===200?null:status===403?'permission':'unavailable');assert.ok(!JSON.stringify(report).includes('fictional-explicit'));
 }finally{f.close();}}
 const f=fixture();try{for(const value of ['', 'contains spaces','x'.repeat(8193)])await assert.rejects(diagnoseDomain({account,domain,workspace:f.root},{CLOUDFLARE_API_TOKEN:value},{request:f.request}),{code:'authentication'});assert.deepEqual(f.calls(),[]);assert.equal(f.requests.length,0);}finally{f.close();}
});

test('missing login, wrong account and malformed workspace scopes stop before all provider reads',async()=>{
 const f=fixture();try{
  for(const [identity,code] of [[{loggedIn:false},'authentication'],[{loggedIn:true,accounts:[{id:'c'.repeat(32)}]},'configuration']]){f.configure(identity);await assert.rejects(diagnoseDomain({account,domain,workspace:f.root},{HOME:f.root,PATH:''},{request:f.request}),{code});}
  for(const workspace of ['relative','/tmp/../outside','bad\0path',null,[],{}])await assert.rejects(diagnoseDomain({account,domain,workspace},{},{request:f.request}),{code:'configuration'});
  await assert.rejects(diagnoseDomain({account,domain},{},{request:f.request}),{code:'authentication'});assert.equal(f.requests.length,0);assert.ok(!f.calls().some(args=>args[0]==='auth'));assert.equal(existsSync(join(f.root,'.private')),false);
 }finally{f.close();}
});

test('an OAuth provider denial is reported without another credential command or DNS credential forwarding',async()=>{
 const f=fixture();try{
  let writes=0;const report=await diagnoseDomain({account,domain,workspace:f.root},{HOME:f.root,PATH:''},{request:async(url,options)=>{if(new URL(url).hostname==='api.cloudflare.com'){writes++;assert.equal(options.headers.Authorization,'Bearer '+token);return new Response('Do not disclose credential/private provider text',{status:403});}return f.request(url,options);}});
  assert.equal(report.zone.issue,'permission');assert.equal(report.nameservers.lookup,'answered');assert.equal(writes,1);assert.equal(f.calls().length,2);assert.equal(inspectDomainReport(report).dnsReady,false);assert.ok(!JSON.stringify(report).includes(token));
 }finally{f.close();}
});

test('the actual domain CLI accepts explicit workspace login while refusing setup/model scope arguments',()=>{
 const f=fixture();try{
  const preload=join(f.root,'fixed-provider.mjs');writeFileSync(preload,`import assert from 'node:assert/strict';const requests=[],account=${JSON.stringify(account)},zone=${JSON.stringify(zone)},domain=${JSON.stringify(domain)};globalThis.fetch=${f.request.toString()};`);
  const cli=new URL('../lib/get-ready/cli.mjs',import.meta.url).pathname,env={HOME:f.root,PATH:''},args=['--import',preload,cli,'--inspect-domain',domain,'--account',account,'--workspace',f.root];
  const output=execFileSync(process.execPath,args,{env,encoding:'utf8',stdio:'pipe'}),report=JSON.parse(output);assert.equal(inspectDomainReport(report).dnsReady,true);assert.ok(!output.includes(token));assert.ok(!output.includes(f.root));assert.equal(existsSync(join(f.root,'.private')),false);const count=f.calls().length;
  for(const extra of [['--deploy-reference'],['--workspace',f.root],['--token','fictional']])assert.throws(()=>execFileSync(process.execPath,[...args,...extra],{env,stdio:'pipe'}));assert.equal(f.calls().length,count);
 }finally{f.close();}
});

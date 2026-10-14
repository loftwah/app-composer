import test from 'node:test';import assert from 'node:assert/strict';
import {Client,InMemoryTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {createReadinessMcp,launchScope,mcpEnvironment} from '../lib/get-ready-mcp/server.mjs';
import {createReadinessSession,runReadinessSession,recipe} from '../lib/get-ready/index.mjs';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';

async function connect(server){const [a,b]=InMemoryTransport.createLinkedPair();const client=new Client({name:'fictional-ready-consumer',version:'1.0.0'});await server.connect(b);await client.connect(a);return client;}
async function completed(){return runReadinessSession(createReadinessSession({workspace:'/fictional-private-path',repo:'fictional/private-repository',source:'a'.repeat(40),account:'b'.repeat(32)}),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({secret:'fictional-secret-token'})}))});}

test('host scope is explicit and immutable; setup/credential flags and ambient execution controls are refused',()=>{
 const scope=launchScope(['--workspace','/fictional/workspace','--account','a'.repeat(32),'--reference-worker','fictional-reference','--reference-url','https://example.com','--reference-repo','fixture/hello']);assert.ok(Object.isFrozen(scope));assert.ok(Object.isFrozen(scope.target));
 for(const args of [[],['--workspace','relative'],['--workspace','/x','--workspace','/y'],['--workspace','/x','--deploy-reference','yes'],['--workspace','/x','--token','fictional-secret'],['--workspace','/x','--reference-url','https://example.com'],['--workspace','/x','--reference-url','https://user:password@example.com','--reference-repo','fixture/hello']])assert.throws(()=>launchScope(args));
 assert.throws(()=>createReadinessMcp({...scope,operation:'deploy-reference'}));assert.throws(()=>createReadinessMcp({...scope,target:{...scope.target,token:'fictional'}}));
 const env=mcpEnvironment({PATH:'/fictional/tools',HOME:'/fictional/home',GH_TOKEN:'fictional-gh',CLOUDFLARE_API_TOKEN:'fictional-cf',RESEND_API_KEY:'fictional-email',NODE_OPTIONS:'untrusted',GH_HOST:'elsewhere',GIT_CONFIG_COUNT:'1'});
 assert.deepEqual(Object.keys(env),['PATH','HOME','GH_TOKEN','CLOUDFLARE_API_TOKEN']);assert.ok(Object.isFrozen(env));
});

test('real SDK tools reject model-selected scope and return only redacted reports with core expiry semantics',async()=>{
 let calls=0,offset=0;const scope=launchScope(['--workspace','/fictional/host-workspace']);
 const server=createReadinessMcp(scope,{env:{RESEND_API_KEY:'fictional-secret-token'},now:()=>Date.now()+offset,check:async(options,env)=>{calls++;assert.equal(options.operation,null);assert.equal(options.workspace,scope.workspace);assert.equal(env.RESEND_API_KEY,undefined);return completed();}}),client=await connect(server);
 try{
  const listed=await client.listTools();assert.deepEqual(listed.tools.map(t=>t.name).sort(),['get_ready_check','get_ready_inspect']);assert.equal(listed.tools.find(t=>t.name==='get_ready_check').annotations.readOnlyHint,false);
  assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.report,null);
  for(const args of [{workspace:'/other/private'},{operation:'deploy-reference'},{token:'fictional-secret-token'},{command:'arbitrary shell'}]){
   const denied=await client.callTool({name:'get_ready_check',arguments:args});assert.equal(denied.isError,true);assert.doesNotMatch(JSON.stringify(denied),/fictional-secret-token/);
  }
  assert.equal(calls,0);
  const checked=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(checked.structuredContent.inspection.ready,true);assert.doesNotMatch(JSON.stringify(checked),/fictional-private|private-repository|fictional-secret-token|bbbbbbbb/);
  offset=3600001;const inspected=await client.callTool({name:'get_ready_inspect',arguments:{}});assert.equal(inspected.structuredContent.inspection.ready,false);assert.equal(calls,1);
 }finally{await client.close();await server.close();}
});

test('concurrent checks never duplicate execution and unknown host failures do not disclose raw errors',async()=>{
 let release,started;const gate=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;});let calls=0,fail=false;
 const server=createReadinessMcp(launchScope(['--workspace','/fictional/workspace']),{check:async()=>{calls++;if(fail)throw Error('fictional-secret-provider-body');started();await gate;return completed();}}),client=await connect(server);
 try{
  const first=client.callTool({name:'get_ready_check',arguments:{}});await entered;const busy=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(busy.isError,true);assert.equal(calls,1);
  release();assert.equal((await first).structuredContent.inspection.ready,true);fail=true;const failed=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(failed.isError,true);assert.doesNotMatch(JSON.stringify(failed),/fictional-secret-provider-body/);
  assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.report,null);
 }finally{release();await client.close();await server.close();}
});

test('actual stdio consumer handshakes and checks a scoped empty workspace without provider or setup authority',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'composer-mcp-fixture-')),script=fileURLToPath(new URL('../scripts/get-ready-mcp.mjs',import.meta.url));
 const transport=new StdioClientTransport({command:process.execPath,args:[script,'--workspace',folder],cwd:folder,env:{PATH:'',HOME:folder,CODEX_THREAD_ID:'fictional-active'},stderr:'pipe'}),client=new Client({name:'fictional-stdio-consumer',version:'1.0.0'});let stderr='';transport.stderr?.on('data',chunk=>{stderr+=String(chunk);});
 try{
  await client.connect(transport);const list=await client.listTools();assert.equal(list.tools.length,2);
  const checked=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(checked.isError,undefined);assert.equal(checked.structuredContent.report.state,'action_required');assert.equal(checked.structuredContent.inspection.ready,false);assert.doesNotMatch(JSON.stringify(checked),new RegExp(folder));
  const receipt=JSON.parse(readFileSync(join(folder,'.private/readiness.json'),'utf8'));assert.equal(receipt.context.workspace,folder);assert.equal(receipt.operation,undefined);assert.equal(receipt.checks.https.issue.recovery,'agent-setup');assert.equal(existsSync(join(folder,'node_modules')),false);assert.equal(stderr,'');
 }finally{await client.close();rmSync(folder,{recursive:true,force:true});}
 for(const args of [['--workspace',folder,'--deploy-reference','yes'],['--workspace','relative']]){
  const rejected=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:5000,env:{PATH:''},input:''});assert.equal(rejected.status,1);assert.equal(rejected.stdout,'');assert.doesNotMatch(rejected.stderr,new RegExp(folder));
 }
});

test('unfinished setup stays unfinished over MCP even when every capability is current',async()=>{
 const session=await completed();session.state='action_required';session.expiresAt=null;session.pendingOperations=[{id:'deploy-reference',state:'failed',recovery:'agent-recheck',destination:'/fictional-private-destination'}];
 const server=createReadinessMcp(launchScope(['--workspace','/fictional/workspace']),{check:async()=>session}),client=await connect(server);
 try{
  const checked=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(checked.structuredContent.inspection.ready,false);assert.ok(Object.values(checked.structuredContent.inspection.capabilities).every(Boolean));assert.equal(checked.structuredContent.report.operations[0].id,'deploy-reference');assert.doesNotMatch(JSON.stringify(checked),/fictional-private-destination/);
  const inspected=await client.callTool({name:'get_ready_inspect',arguments:{}});assert.equal(inspected.structuredContent.inspection.ready,false);assert.equal(inspected.structuredContent.report.operations[0].state,'failed');
 }finally{await client.close();await server.close();}
});

test('actual client cancellation clears evidence and retains exclusivity until the bounded check finishes',async()=>{
 let calls=0,release,started,finished;
 const gate=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{started=resolve;}),done=new Promise(resolve=>{finished=resolve;});
 const server=createReadinessMcp(launchScope(['--workspace','/fictional/workspace']),{check:async()=>{calls++;if(calls===2){started();await gate;}const session=await completed();if(calls===2)finished();return session;}}),client=await connect(server);
 try{
  await client.callTool({name:'get_ready_check',arguments:{}});
  const controller=new AbortController(),pending=client.callTool({name:'get_ready_check',arguments:{}},{signal:controller.signal});await entered;controller.abort();await assert.rejects(pending);
  const during=await client.callTool({name:'get_ready_inspect',arguments:{}});assert.equal(during.structuredContent.report,null);assert.equal(during.structuredContent.checking,true);
  assert.equal((await client.callTool({name:'get_ready_check',arguments:{}})).isError,true);assert.equal(calls,2);
  release();await done;await new Promise(resolve=>setImmediate(resolve));
  const after=await client.callTool({name:'get_ready_inspect',arguments:{}});assert.equal(after.structuredContent.report,null);assert.equal(after.structuredContent.checking,false);
 }finally{release();await client.close();await server.close();}
});

test('optional domain MCP tool is host-scoped, read-only and separate from workspace readiness',async()=>{
 let calls=0;const account='a'.repeat(32),domain='example.test';
 assert.throws(()=>launchScope(['--workspace','/fictional','--domain',domain]));
 const scope=launchScope(['--workspace','/fictional','--account',account,'--domain',domain]);
 const domainReport={schema:'app-composer.domain-report',version:1,checkedAt:new Date().toISOString(),domain,zone:{state:'pending',issue:null},nameservers:{lookup:'answered',issue:null,assigned:['one.ns.cloudflare.com'],observed:['old.example.test']},dnssec:{state:'disabled',issue:null,expected:null,lookup:'answered',lookupIssue:null,published:[]}};
 const server=createReadinessMcp(scope,{env:{CLOUDFLARE_API_TOKEN:'fictional-secret'},domainCheck:async(input,env)=>{calls++;assert.deepEqual(input,{account,domain});assert.equal(env.CLOUDFLARE_API_TOKEN,'fictional-secret');return domainReport;}}),client=await connect(server);
 try{
  const tools=(await client.listTools()).tools;assert.equal(tools.length,3);assert.equal(tools.find(t=>t.name==='get_ready_domain').annotations.readOnlyHint,true);
  for(const args of [{domain:'another.test'},{account:'c'.repeat(32)},{operation:'edit-dns'}])assert.equal((await client.callTool({name:'get_ready_domain',arguments:args})).isError,true);assert.equal(calls,0);
  const checked=await client.callTool({name:'get_ready_domain',arguments:{}});assert.equal(checked.structuredContent.report.domain,domain);assert.equal(checked.structuredContent.inspection.dnsReady,false);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(checked),/fictional-secret|aaaaaaaa/);
  assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.report,null);
 }finally{await client.close();await server.close();}
});

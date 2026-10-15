import test from 'node:test';import assert from 'node:assert/strict';
import {Client,InMemoryTransport} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {createReadinessMcp,launchScope,mcpEnvironment} from '../lib/get-ready-mcp/server.mjs';
import {createReadinessSession,runReadinessSession,recipe,ReadinessFailure} from '../lib/get-ready/index.mjs';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';

async function connect(server){const [a,b]=InMemoryTransport.createLinkedPair();const client=new Client({name:'fictional-ready-consumer',version:'1.0.0'});await server.connect(b);await client.connect(a);return client;}
async function completed(){return runReadinessSession(createReadinessSession({workspace:'/fictional-private-path',repo:'fictional/private-repository',source:'a'.repeat(40),account:'b'.repeat(32)}),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({secret:'fictional-secret-token'})}))});}

test('workspace preparation is absent by default and only an exact host capability enables its fixed engine operation',async()=>{
 const base=launchScope(['--workspace','/fictional/selected']);assert.equal(base.allowWorkspaceToolSetup,undefined);
 for(const args of [['--workspace','/fictional','--allow-workspace-tool-setup','true'],['--workspace','/fictional','--allow-workspace-tool-setup','--allow-workspace-tool-setup']])assert.throws(()=>launchScope(args));
 for(const value of ['true',0,null])assert.throws(()=>createReadinessMcp({...base,allowWorkspaceToolSetup:value}));
 const scope=launchScope(['--workspace','/fictional/selected','--allow-workspace-tool-setup']);assert.equal(scope.allowWorkspaceToolSetup,true);assert.ok(Object.isFrozen(scope));
 let setups=0,previous=null;const calls=[];
 const check=async options=>{calls.push(options);assert.equal(options.workspace,scope.workspace);assert.equal(options.allowWorkspaceToolSetup,undefined);const session=createReadinessSession({workspace:scope.workspace},previous);previous=await runReadinessSession(session,{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>{if(id!=='agent')throw new ReadinessFailure('configuration');return {fixture:true};}})),installWorkspaceTools:async()=>({changed:++setups===1,scope:'workspace',private:'fictional-private-evidence'})},()=>{},{operation:options.operation});return previous;};
 const server=createReadinessMcp(scope,{check}),client=await connect(server);
 try{
  const tools=(await client.listTools()).tools;assert.equal(tools.find(t=>t.name==='get_ready_prepare_tools').annotations.readOnlyHint,false);
  for(const args of [{workspace:'/outside'},{operation:'deploy-reference'},{version:'latest'},{allowWorkspaceToolSetup:true},{token:'fictional-secret'}])assert.equal((await client.callTool({name:'get_ready_prepare_tools',arguments:args})).isError,true);assert.equal(calls.length,0);
  await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(setups,0);assert.equal(calls.at(-1).operation,null);
  const prepared=await client.callTool({name:'get_ready_prepare_tools',arguments:{}});assert.equal(setups,1);assert.equal(prepared.structuredContent.inspection.ready,false);assert.deepEqual(prepared.structuredContent.preparation,{operation:'install-workspace-tools',state:'performed',changed:true,scope:'workspace'});assert.equal(prepared.structuredContent.report.operations.length,0,'Completed work does not enter the unfinished-work report');assert.doesNotMatch(JSON.stringify(prepared),/fictional-private-evidence|fictional\/selected/);
  await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(setups,1);assert.equal(calls.at(-1).operation,null);assert.equal(calls.at(-1).useWorkspaceTools,true);
  await client.callTool({name:'get_ready_prepare_tools',arguments:{}});assert.equal(setups,2,'A separate explicit call is a new authorised intent, never a check-side retry');
 }finally{await client.close();await server.close();}
});

test('failed optional preparation stays unfinished on read-only resume without selecting or reinstalling tools',async()=>{
 const scope=launchScope(['--workspace','/fictional/selected','--allow-workspace-tool-setup']);let setups=0,previous=null;const calls=[];
 const server=createReadinessMcp(scope,{check:async options=>{calls.push(options);previous=await runReadinessSession(createReadinessSession({workspace:scope.workspace},previous),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({fixture:true})})),installWorkspaceTools:async()=>{setups++;throw new ReadinessFailure('unavailable');}},()=>{},{operation:options.operation});return previous;}}),client=await connect(server);
 try{const failed=await client.callTool({name:'get_ready_prepare_tools',arguments:{}});assert.equal(failed.structuredContent.inspection.ready,false);assert.equal(failed.structuredContent.report.operations[0].state,'failed');const resumed=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(resumed.structuredContent.inspection.ready,false);assert.equal(resumed.structuredContent.report.operations[0].state,'failed');assert.equal(calls.at(-1).useWorkspaceTools,undefined);assert.equal(setups,1);}finally{await client.close();await server.close();}
});

test('cancelled preparation shares exclusivity and cannot enable cached tool selection or retain a completed report',async()=>{
 let release,started,finished;const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve),done=new Promise(resolve=>finished=resolve),calls=[];
 const server=createReadinessMcp(launchScope(['--workspace','/fictional/selected','--allow-workspace-tool-setup']),{check:async options=>{calls.push(options);if(options.operation){started();await gate;}const session=await completed();if(options.operation){session.operation={id:'install-workspace-tools',label:'Prepare verified workspace tools',state:'performed',evidence:{scope:'workspace',changed:true}};finished();}return session;}}),client=await connect(server);
 try{const controller=new AbortController(),pending=client.callTool({name:'get_ready_prepare_tools',arguments:{}},{signal:controller.signal});await entered;assert.equal((await client.callTool({name:'get_ready_check',arguments:{}})).isError,true);assert.equal((await client.callTool({name:'get_ready_prepare_tools',arguments:{}})).isError,true);controller.abort();await assert.rejects(pending);assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.checking,true);release();await done;await new Promise(resolve=>setImmediate(resolve));assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.report,null);await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(calls.at(-1).useWorkspaceTools,undefined);assert.equal(calls.filter(o=>o.operation).length,1);}finally{release();await client.close();await server.close();}
});

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
  const checked=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(checked.isError,undefined);assert.equal(checked.structuredContent.report.version,2);assert.equal(checked.structuredContent.report.workingTree,'unknown');assert.equal(checked.structuredContent.report.state,'action_required');assert.equal(checked.structuredContent.inspection.ready,false);assert.doesNotMatch(JSON.stringify(checked),new RegExp(folder));
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

test('optional project MCP inspection uses fixed host scope and never runs setup or records readiness',async()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-mcp-project-'));
 assert.throws(()=>launchScope(['--workspace',root,'--project-purpose','execute']));
 const server=createReadinessMcp(launchScope(['--workspace',root,'--project-purpose','emdash-site'])),client=await connect(server);
 try{
  const tools=(await client.listTools()).tools;assert.equal(tools.length,3);const tool=tools.find(t=>t.name==='get_ready_project');assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.annotations.openWorldHint,false);
  for(const args of [{workspace:'/other/private'},{purpose:'emdash-plugin'},{operation:'install'},{token:'fictional-secret'}])assert.equal((await client.callTool({name:'get_ready_project',arguments:args})).isError,true);
  const inspected=await client.callTool({name:'get_ready_project',arguments:{}});assert.equal(inspected.structuredContent.report.purpose,'emdash-site');assert.equal(inspected.structuredContent.report.ready,false);assert.equal(inspected.structuredContent.report.manifest.state,'absent');assert.doesNotMatch(JSON.stringify(inspected),new RegExp(root));assert.equal(existsSync(join(root,'.private')),false);assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.report,null);
 }finally{await client.close();await server.close();rmSync(root,{recursive:true,force:true});}
});

test('reference acquisition is enabled only by a fixed host destination and delegates to the same engine without changing workspace',async()=>{
 const base=launchScope(['--workspace','/fictional/selected']);assert.equal(base.referenceDestination,undefined);
 for(const destination of ['relative','/fictional/../other','/fictional/target/','/fictional/target\0suffix'])assert.throws(()=>launchScope(['--workspace','/fictional','--reference-destination',destination]));
 assert.throws(()=>launchScope(['--workspace','/fictional','--reference-destination','/x','--reference-destination','/y']));
 for(const value of [true,0,{},''])assert.throws(()=>createReadinessMcp({...base,referenceDestination:value}));
 const scope=launchScope(['--workspace','/fictional/selected','--reference-destination','/fictional/checkout']);assert.equal(scope.referenceDestination,'/fictional/checkout');assert.ok(Object.isFrozen(scope));let previous=null,clones=0;const calls=[];
 const server=createReadinessMcp(scope,{check:async options=>{calls.push(options);assert.equal(options.referenceDestination,undefined);assert.equal(options.workspace,scope.workspace);assert.equal(options.destination,options.operation==='clone-reference'?scope.referenceDestination:undefined);previous=await runReadinessSession(createReadinessSession({workspace:scope.workspace},previous),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>{if(id!=='agent')throw new ReadinessFailure('configuration');return {fixture:true};}})),cloneReference:async destination=>{assert.equal(destination,scope.referenceDestination);return {changed:++clones===1,commit:'a'.repeat(40),destination,repository:'loftwah/app-composer-hello',private:'fictional-private-evidence'};}},()=>{},{operation:options.operation,destination:options.destination??null});return previous;}}),client=await connect(server);
 try{
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),['get_ready_check','get_ready_clone_reference','get_ready_inspect']);
  for(const args of [{destination:'/outside'},{workspace:'/other'},{source:'evil/repo'},{version:'latest'},{operation:'deploy-reference'},{token:'fictional-secret'}])assert.equal((await client.callTool({name:'get_ready_clone_reference',arguments:args})).isError,true);assert.equal(calls.length,0);
  await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(clones,0);
  const acquired=await client.callTool({name:'get_ready_clone_reference',arguments:{}});assert.deepEqual(acquired.structuredContent.preparation,{operation:'clone-reference',state:'performed',changed:true,source:'a'.repeat(40)});assert.equal(acquired.structuredContent.inspection.ready,false);assert.equal(acquired.structuredContent.report.operations.length,0);assert.doesNotMatch(JSON.stringify(acquired),/fictional\/checkout|fictional-private-evidence/);
  await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(clones,1);assert.equal(calls.at(-1).operation,null);assert.equal(calls.at(-1).useWorkspaceTools,undefined);
  const repeated=await client.callTool({name:'get_ready_clone_reference',arguments:{}});assert.equal(repeated.structuredContent.preparation.changed,false);
 }finally{await client.close();await server.close();}
});

test('failed acquisition remains unfinished across ordinary MCP checks without retrying or exposing private destination',async()=>{
 const scope=launchScope(['--workspace','/fictional/selected','--reference-destination','/fictional/private-checkout']);let previous=null,clones=0;
 const server=createReadinessMcp(scope,{check:async options=>{previous=await runReadinessSession(createReadinessSession({workspace:scope.workspace},previous),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({fixture:true})})),cloneReference:async()=>{clones++;throw new ReadinessFailure('unavailable');}},()=>{},{operation:options.operation,destination:options.destination??null});return previous;}}),client=await connect(server);
 try{const failed=await client.callTool({name:'get_ready_clone_reference',arguments:{}});assert.equal(failed.structuredContent.preparation.state,'failed');assert.equal(failed.structuredContent.preparation.changed,undefined);assert.equal(failed.structuredContent.inspection.ready,false);assert.doesNotMatch(JSON.stringify(failed),/private-checkout/);const resumed=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(resumed.structuredContent.report.operations[0].id,'clone-reference');assert.equal(resumed.structuredContent.inspection.ready,false);assert.equal(clones,1);}finally{await client.close();await server.close();}
});

test('cancelled acquisition preserves shared exclusivity and never turns a late clone result into a cached report',async()=>{
 let release,started,finished;const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve),done=new Promise(resolve=>finished=resolve),calls=[];
 const server=createReadinessMcp(launchScope(['--workspace','/fictional/selected','--reference-destination','/fictional/checkout','--allow-workspace-tool-setup','--allow-site-skill-setup','--available-skills','none']),{check:async options=>{calls.push(options);if(options.operation){started();await gate;}const session=await completed();if(options.operation){session.operation={id:'clone-reference',state:'performed',evidence:{changed:true,commit:'a'.repeat(40)}};finished();}return session;}}),client=await connect(server);
 try{const controller=new AbortController(),pending=client.callTool({name:'get_ready_clone_reference',arguments:{}},{signal:controller.signal});await entered;for(const name of ['get_ready_check','get_ready_prepare_tools','get_ready_clone_reference','get_ready_prepare_site_skills'])assert.equal((await client.callTool({name,arguments:{}})).isError,true);controller.abort();await assert.rejects(pending);assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.checking,true);release();await done;await new Promise(resolve=>setImmediate(resolve));assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.report,null);await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(calls.at(-1).useWorkspaceTools,undefined);assert.equal(calls.filter(o=>o.operation).length,1);}finally{release();await client.close();await server.close();}
});

test('site skill preparation requires explicit host consent plus a bounded inventory; models cannot replace either',async()=>{
 const base=launchScope(['--workspace','/fictional/selected']);
 for(const extra of [ ['--allow-site-skill-setup'],['--available-skills','none'],['--allow-site-skill-setup','--available-skills','unknown'],['--allow-site-skill-setup','--available-skills','emdash-cli,emdash-cli'],['--allow-site-skill-setup','--available-skills','none,emdash-cli'],['--allow-site-skill-setup','--available-skills','none','--allow-site-skill-setup'] ])assert.throws(()=>launchScope(['--workspace',base.workspace,...extra]));
 for(const extra of [{allowSiteSkillSetup:true},{availableSkills:[]},{allowSiteSkillSetup:false,availableSkills:[]},{allowSiteSkillSetup:'true',availableSkills:[]},{allowSiteSkillSetup:true,availableSkills:['unknown']},{allowSiteSkillSetup:true,availableSkills:null}])assert.throws(()=>createReadinessMcp({...base,...extra}));
 const scope={...base,allowSiteSkillSetup:true,availableSkills:['emdash-cli']},calls=[];let previous=null,preparations=0;
 const server=createReadinessMcp(scope,{env:{CODEX_HOME:'/fictional/custom-codex',RESEND_API_KEY:'fictional-private'},check:async(options,env)=>{
  calls.push(options);assert.equal(options.allowSiteSkillSetup,undefined);assert.equal(env.CODEX_HOME,'/fictional/custom-codex');assert.equal(env.RESEND_API_KEY,undefined);
  assert.deepEqual(options.availableSkills,options.operation==='prepare-site-skills'?['emdash-cli']:undefined);
  previous=await runReadinessSession(createReadinessSession({workspace:base.workspace},previous),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({fixture:true})})),prepareSiteSkills:async inventory=>{assert.deepEqual(inventory,['emdash-cli']);preparations++;return {changed:preparations===1,source:{commit:'b'.repeat(40),private:'fictional-private'},skills:[{id:'emdash-cli',state:'advertised-by-agent',agentVisible:'not-probed',exercised:false}],private:'/fictional/selected'};}},()=>{},{operation:options.operation,availableSkills:options.availableSkills??null});return previous;
 }});scope.availableSkills.push('building-emdash-site');const client=await connect(server);
 try{
  const listed=(await client.listTools()).tools;assert.deepEqual(listed.map(t=>t.name).sort(),['get_ready_check','get_ready_inspect','get_ready_prepare_site_skills']);assert.equal(listed.find(t=>t.name==='get_ready_prepare_site_skills').annotations.readOnlyHint,false);
  for(const args of [{workspace:'/other'},{availableSkills:[]},{allowSiteSkillSetup:true},{source:'unreviewed'},{operation:'deploy-reference'}])assert.equal((await client.callTool({name:'get_ready_prepare_site_skills',arguments:args})).isError,true);assert.equal(calls.length,0);
  const prepared=await client.callTool({name:'get_ready_prepare_site_skills',arguments:{}});assert.deepEqual(prepared.structuredContent.preparation,{operation:'prepare-site-skills',state:'performed',changed:true,source:'b'.repeat(40)});assert.equal(prepared.structuredContent.inspection.ready,false);assert.equal(prepared.structuredContent.report.operations[0].state,'prepared');assert.doesNotMatch(JSON.stringify(prepared),/fictional-private|fictional\/selected|availableSkills|advertised-by-agent/);
  const resumed=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(preparations,1);assert.equal(resumed.structuredContent.inspection.ready,false);assert.equal(resumed.structuredContent.report.operations[0].id,'prepare-site-skills');
  assert.equal((await client.callTool({name:'get_ready_prepare_site_skills',arguments:{}})).structuredContent.preparation.changed,false);assert.equal(preparations,2);
 }finally{await client.close();await server.close();}
 const fixed=launchScope(['--workspace',base.workspace,'--allow-site-skill-setup','--available-skills','none']);assert.deepEqual(fixed.availableSkills,[]);assert.equal(Object.isFrozen(fixed.availableSkills),true);
});

test('failed site preparation hides partial evidence, retains pending review and never retries on check',async()=>{
 const scope=launchScope(['--workspace','/fictional/selected','--allow-site-skill-setup','--available-skills','none']);let previous=null,preparations=0;
 const server=createReadinessMcp(scope,{check:async options=>{previous=await runReadinessSession(createReadinessSession({workspace:scope.workspace},previous),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({fixture:true})})),prepareSiteSkills:async()=>{preparations++;throw new ReadinessFailure('source');}},()=>{},{operation:options.operation,availableSkills:options.availableSkills??null});return previous;}}),client=await connect(server);
 try{const failed=await client.callTool({name:'get_ready_prepare_site_skills',arguments:{}});assert.equal(failed.structuredContent.preparation.state,'failed');assert.equal(failed.structuredContent.preparation.changed,undefined);assert.equal(failed.structuredContent.inspection.ready,false);const resumed=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(resumed.structuredContent.report.operations[0].id,'prepare-site-skills');assert.equal(resumed.structuredContent.inspection.ready,false);assert.equal(preparations,1);}finally{await client.close();await server.close();}
});

test('reference dependency preparation requires exact host consent and preserves the shared engine scope and retry boundary',async()=>{
 const base=launchScope(['--workspace','/fictional/selected']);assert.equal(base.allowReferenceToolSetup,undefined);
 for(const args of [['--workspace','/fictional','--allow-reference-tool-setup','true'],['--workspace','/fictional','--allow-reference-tool-setup','--allow-reference-tool-setup']])assert.throws(()=>launchScope(args));
 for(const value of ['true',0,null])assert.throws(()=>createReadinessMcp({...base,allowReferenceToolSetup:value}));
 const scope=launchScope(['--workspace','/fictional/selected','--allow-reference-tool-setup']);assert.equal(scope.allowReferenceToolSetup,true);assert.ok(Object.isFrozen(scope));let previous=null,installs=0;const calls=[];
 const server=createReadinessMcp(scope,{check:async options=>{calls.push(options);assert.equal(options.allowReferenceToolSetup,undefined);assert.equal(options.workspace,scope.workspace);previous=await runReadinessSession(createReadinessSession({workspace:scope.workspace},previous),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>{if(id!=='agent')throw new ReadinessFailure('configuration');return {fixture:true};}})),installReferenceTools:async()=>({changed:++installs===1,wrangler:'4.143.1',pnpm:'12.9.1',private:'fictional-private-evidence'})},()=>{},{operation:options.operation});return previous;}}),client=await connect(server);
 try{
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),['get_ready_check','get_ready_inspect','get_ready_prepare_reference_tools']);
  for(const args of [{workspace:'/outside'},{package:'untrusted'},{version:'latest'},{operation:'deploy-reference'},{token:'fictional-secret'},{allowReferenceToolSetup:true}])assert.equal((await client.callTool({name:'get_ready_prepare_reference_tools',arguments:args})).isError,true);assert.equal(calls.length,0);
  await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(installs,0);
  const prepared=await client.callTool({name:'get_ready_prepare_reference_tools',arguments:{}});assert.deepEqual(prepared.structuredContent.preparation,{operation:'install-reference-tools',state:'performed',changed:true,wrangler:'4.143.1',pnpm:'12.9.1'});assert.equal(prepared.structuredContent.inspection.ready,false);assert.equal(prepared.structuredContent.report.operations.length,0);assert.doesNotMatch(JSON.stringify(prepared),/fictional-private-evidence|fictional\/selected/);
  await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(installs,1);assert.equal(calls.at(-1).operation,null);const repeated=await client.callTool({name:'get_ready_prepare_reference_tools',arguments:{}});assert.equal(repeated.structuredContent.preparation.changed,false);
 }finally{await client.close();await server.close();}
});

test('failed reference tool preparation remains unfinished and redacted without an ordinary check retry',async()=>{
 const scope=launchScope(['--workspace','/fictional/private','--allow-reference-tool-setup']);let previous=null,installs=0;
 const server=createReadinessMcp(scope,{check:async options=>{previous=await runReadinessSession(createReadinessSession({workspace:scope.workspace},previous),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({fixture:true})})),installReferenceTools:async()=>{installs++;throw Error('fictional-secret-install-output');}},()=>{},{operation:options.operation});return previous;}}),client=await connect(server);
 try{const failed=await client.callTool({name:'get_ready_prepare_reference_tools',arguments:{}});assert.equal(failed.structuredContent.preparation.state,'failed');assert.equal(failed.structuredContent.preparation.changed,undefined);assert.doesNotMatch(JSON.stringify(failed),/fictional-secret-install-output|fictional\/private/);const resumed=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(resumed.structuredContent.inspection.ready,false);assert.equal(resumed.structuredContent.report.operations[0].id,'install-reference-tools');assert.equal(installs,1);}finally{await client.close();await server.close();}
});

test('cancelled reference installation keeps shared exclusivity and discards a late completed result',async()=>{
 let release,started,finished;const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve),done=new Promise(resolve=>finished=resolve);let calls=0;
 const server=createReadinessMcp(launchScope(['--workspace','/fictional/selected','--allow-reference-tool-setup','--allow-workspace-tool-setup']),{check:async options=>{calls++;started();await gate;const session=await completed();session.operation={id:options.operation,state:'performed',evidence:{changed:true,wrangler:'4.143.1',pnpm:'12.9.1'}};finished();return session;}}),client=await connect(server);
 try{const controller=new AbortController(),pending=client.callTool({name:'get_ready_prepare_reference_tools',arguments:{}},{signal:controller.signal});await entered;for(const name of ['get_ready_check','get_ready_prepare_tools','get_ready_prepare_reference_tools'])assert.equal((await client.callTool({name,arguments:{}})).isError,true);controller.abort();await assert.rejects(pending);assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.checking,true);release();await done;await new Promise(resolve=>setImmediate(resolve));assert.equal((await client.callTool({name:'get_ready_inspect',arguments:{}})).structuredContent.report,null);assert.equal(calls,1);}finally{release();await client.close();await server.close();}
});

test('plugin preparation purpose is explicit host scope, independent from inspection and never model-selected',async()=>{
 for(const args of [['--workspace','/fictional','--skill-purpose','emdash-plugin'],['--workspace','/fictional','--allow-site-skill-setup','--available-skills','none','--skill-purpose','auto']])assert.throws(()=>launchScope(args));
 const base=launchScope(['--workspace','/fictional','--allow-site-skill-setup','--available-skills','none','--project-purpose','emdash-plugin']);assert.equal(base.skillPurpose,undefined);
 for(const value of [null,{},['emdash-plugin'],'','auto'])assert.throws(()=>createReadinessMcp({...base,skillPurpose:value}));assert.throws(()=>createReadinessMcp({workspace:'/fictional',skillPurpose:'emdash-plugin'}));
 const scope=launchScope(['--workspace','/fictional','--allow-site-skill-setup','--available-skills','none','--skill-purpose','emdash-plugin']),calls=[];let preparations=0;const server=createReadinessMcp(scope,{check:async options=>{calls.push(options);return runReadinessSession(createReadinessSession({workspace:scope.workspace}),{checks:recipe.checks.map(id=>({id,label:id,verify:async()=>({})})),prepareSiteSkills:async()=>{preparations++;return {changed:true,purpose:options.skillPurpose,source:{commit:'b'.repeat(40)}};}},()=>{},{operation:options.operation,availableSkills:options.availableSkills??null,skillPurpose:options.skillPurpose??null});}}),client=await connect(server);
 try{await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(calls.at(-1).skillPurpose,undefined);assert.equal(preparations,0);for(const args of [{purpose:'emdash-site'},{skillPurpose:'emdash-site'},{availableSkills:[]}])assert.equal((await client.callTool({name:'get_ready_prepare_site_skills',arguments:args})).isError,true);assert.equal(calls.length,1);const prepared=(await client.callTool({name:'get_ready_prepare_site_skills',arguments:{}})).structuredContent;assert.equal(calls.at(-1).skillPurpose,'emdash-plugin');assert.equal(preparations,1);assert.equal(prepared.preparation.purpose,'emdash-plugin');assert.equal(prepared.inspection.ready,false);await client.callTool({name:'get_ready_inspect',arguments:{}});assert.equal(preparations,1);}finally{await client.close();await server.close();}
});

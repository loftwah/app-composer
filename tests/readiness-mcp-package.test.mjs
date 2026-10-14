import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,rmSync,symlinkSync,unlinkSync,realpathSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync,spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {Client} from '@modelcontextprotocol/client';import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {packageGetReadyMcp,assertMcpReleasePackage} from '../scripts/package-get-ready-mcp.mjs';
import {captureGetReady} from '../scripts/package-get-ready.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('packed transport carries the same core, exact provenance and executable; actual stdio scope stays bounded',async()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-mcp-package-test-'));let client;
 try{
  const output=join(root,'out'),metadata=packageGetReadyMcp({destination:output,destinationBoundary:root}),archive=join(output,'get-ready-mcp.tgz');assert.equal(metadata.sha256,digest(readFileSync(archive)));assert.equal(metadata.runtimeDependencies,2);
  assert.equal(packageGetReadyMcp({destination:join(root,'repeat'),destinationBoundary:root}).sha256,metadata.sha256);
  const installed=join(root,'installed');mkdirSync(installed);execFileSync('tar',['-xzf',archive,'-C',installed,'--strip-components=1']);
  const manifest=JSON.parse(readFileSync(join(installed,'package.json'),'utf8'));assert.equal(manifest.scripts,undefined);assert.deepEqual(manifest.dependencies,{'@modelcontextprotocol/server':'2.3.1',zod:'4.6.7'});assert.match(readFileSync(join(installed,'scripts/get-ready-mcp.mjs'),'utf8'),/^#!\/usr\/bin\/env node/);
  const source=JSON.parse(readFileSync(join(installed,'SOURCE.json'),'utf8'));for(const [name,hash] of Object.entries(source.files))assert.equal(digest(readFileSync(join(installed,name))),hash,name);
  const core=captureGetReady();for(const [name,bytes] of Object.entries(core.files))assert.deepEqual(readFileSync(join(installed,'lib/get-ready',name)),bytes,name);
  assert.equal(source.coreSource,core.source.commit);assert.equal(existsSync(join(installed,'.env')),false);assert.equal(existsSync(join(installed,'.private')),false);assert.equal(existsSync(join(installed,'src')),false);
  // Deterministic protocol regression uses the already installed pinned SDK;
  // independent npm/registry installation is a separate release proof.
  mkdirSync(join(installed,'node_modules/@modelcontextprotocol'),{recursive:true});symlinkSync(realpathSync('node_modules/@modelcontextprotocol/server'),join(installed,'node_modules/@modelcontextprotocol/server'));symlinkSync(realpathSync('node_modules/zod'),join(installed,'node_modules/zod'));
  const workspace=join(root,'fictional-project');mkdirSync(workspace);writeFileSync(join(workspace,'package.json'),JSON.stringify({dependencies:{emdash:'1.2.0'}}));writeFileSync(join(workspace,'AGENTS.md'),'Fictional authored guidance');
  const transport=new StdioClientTransport({command:process.execPath,args:[join(installed,'scripts/get-ready-mcp.mjs'),'--workspace',workspace,'--project-purpose','emdash-site'],cwd:root,env:{PATH:'',HOME:root},stderr:'pipe'});let stderr='';transport.stderr?.on('data',chunk=>stderr+=String(chunk));client=new Client({name:'fictional-packaged-consumer',version:'1.0.0'});await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name).sort(),['get_ready_check','get_ready_inspect','get_ready_project']);
  assert.equal((await client.callTool({name:'get_ready_project',arguments:{workspace:'/another'}})).isError,true);assert.equal(existsSync(join(workspace,'.private')),false);
  const inspected=await client.callTool({name:'get_ready_project',arguments:{}});assert.equal(inspected.structuredContent.report.ready,false);assert.equal(inspected.structuredContent.report.guidance[0].state,'present');assert.doesNotMatch(JSON.stringify(inspected),/Fictional authored guidance/);
  const checked=await client.callTool({name:'get_ready_check',arguments:{}});assert.equal(checked.structuredContent.report.state,'action_required');assert.equal(checked.structuredContent.inspection.ready,false);assert.equal(stderr,'');assert.doesNotMatch(JSON.stringify(checked),new RegExp(workspace));assert.equal(existsSync(join(workspace,'node_modules')),false);
  await client.close();client=null;
  const bad=spawnSync(process.execPath,[join(installed,'scripts/get-ready-mcp.mjs'),'--workspace',workspace,'--token','fictional-private'],{cwd:root,env:{PATH:''},input:'',encoding:'utf8',timeout:5000});assert.equal(bad.status,1);assert.equal(bad.stdout,'');assert.doesNotMatch(bad.stderr,/fictional-private/);assert.equal(readFileSync(join(workspace,'AGENTS.md'),'utf8'),'Fictional authored guidance');
 }finally{await client?.close();rmSync(root,{recursive:true});}
});

test('MCP source links, injected lifecycle/dependencies and linked outputs are refused without replacing owner data',()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-mcp-package-refusal-'));try{
  const source=join(root,'source');cpSync('lib/get-ready-mcp',source,{recursive:true});const owner=join(root,'owner');writeFileSync(owner,'fictional-private-owner');unlinkSync(join(source,'server.mjs'));symlinkSync(owner,join(source,'server.mjs'));
  assert.throws(()=>packageGetReadyMcp({directory:source,sourceBoundary:root,destination:join(root,'never'),destinationBoundary:root}),/ordinary unlinked/);assert.equal(existsSync(join(root,'never')),false);assert.equal(readFileSync(owner,'utf8'),'fictional-private-owner');
  unlinkSync(join(source,'server.mjs'));cpSync('lib/get-ready-mcp/server.mjs',join(source,'server.mjs'));
  const original=JSON.parse(readFileSync(join(source,'package.json'),'utf8'));
  for(const changed of [{...original,scripts:{prepack:'arbitrary command'}},{...original,dependencies:{...original.dependencies,zod:'latest'}},{...original,bin:{'get-ready-mcp':'./README.md'}}]){writeFileSync(join(source,'package.json'),JSON.stringify(changed));assert.throws(()=>packageGetReadyMcp({directory:source,sourceBoundary:root,destination:join(root,'never'),destinationBoundary:root}),/policy/);assert.equal(existsSync(join(root,'never')),false);}
  writeFileSync(join(source,'package.json'),JSON.stringify(original));const output=join(root,'output');mkdirSync(output);symlinkSync(owner,join(output,'get-ready-mcp.tgz'));assert.throws(()=>packageGetReadyMcp({directory:source,sourceBoundary:root,destination:output,destinationBoundary:root}),/ordinary unlinked/);assert.equal(readFileSync(owner,'utf8'),'fictional-private-owner');
 }finally{rmSync(root,{recursive:true});}
});

test('hidden transport edits cannot be labelled a clean release and production guard binds source/core/dependencies/bytes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'composer-mcp-package-source-'));try{
  const repo=join(root,'repo');mkdirSync(join(repo,'scripts'),{recursive:true});mkdirSync(join(repo,'lib'));for(const name of ['package-get-ready.mjs','package-get-ready-mcp.mjs','get-ready-mcp.mjs'])cpSync('scripts/'+name,join(repo,'scripts',name));for(const name of ['get-ready','get-ready-mcp'])cpSync('lib/'+name,join(repo,'lib',name),{recursive:true});cpSync('LICENSE',join(repo,'LICENSE'));
  const env={PATH:process.env.PATH,HOME:root,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'},git=args=>execFileSync('git',args,{cwd:repo,env,encoding:'utf8',stdio:'pipe'}).trim();git(['init','-b','main']);git(['add','.']);git(['-c','user.name=Fictional fixture','-c','user.email=fixture@example.test','commit','-m','Fictional MCP source']);
  const {packageGetReadyMcp:make}=await import(pathToFileURL(join(repo,'scripts/package-get-ready-mcp.mjs')).href);const first=make({destination:join(root,'clean'),destinationBoundary:root}),bytes=readFileSync(join(root,'clean/get-ready-mcp.tgz'));assert.equal(first.developmentSnapshot,false);assert.doesNotThrow(()=>assertMcpReleasePackage(first,bytes,git(['rev-parse','HEAD'])));
  for(const changed of [{...first,coreSource:'0'.repeat(40)},{...first,source:'0'.repeat(40)},{...first,developmentSnapshot:true},{...first,sha256:'0'.repeat(64)},{...first,dependencies:{...first.dependencies,zod:'latest'}},{...first,runtimeDependencies:0}])assert.throws(()=>assertMcpReleasePackage(changed,bytes,first.source),/before production/);assert.throws(()=>assertMcpReleasePackage(first,Buffer.from('changed bytes'),first.source),/before production/);
  git(['update-index','--assume-unchanged','lib/get-ready-mcp/server.mjs']);const entry=join(repo,'lib/get-ready-mcp/server.mjs');writeFileSync(entry,readFileSync(entry,'utf8')+'\n// Fictional hidden transport edit.\n');assert.equal(git(['status','--porcelain']),'');assert.equal(make({destination:join(root,'changed'),destinationBoundary:root}).developmentSnapshot,true);
 }finally{rmSync(root,{recursive:true});}
});

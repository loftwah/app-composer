// Package the existing transport and the same captured core; never crawl a workspace.
import {captureGetReady,readPackageInput,writePackageArtifact} from './package-get-ready.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmodSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const dependencies={'@modelcontextprotocol/server':'2.3.1',zod:'4.6.7'};
const allowed=['lib/get-ready','lib/get-ready-mcp/server.mjs','scripts/get-ready-mcp.mjs','README.md','LICENSE','SOURCE.json'];
export function packageGetReadyMcp({directory=join(repository,'lib/get-ready-mcp'),sourceBoundary=repository,destination=join(repository,'public/downloads'),destinationBoundary=repository}={}){
 const root=mkdtempSync(join(tmpdir(),'composer-get-ready-mcp-package-'));
 try{
  const core=captureGetReady(),files=Object.fromEntries(Object.entries(core.files).map(([name,bytes])=>['lib/get-ready/'+name,bytes]));
  files['package.json']=readPackageInput(join(directory,'package.json'),sourceBoundary);
  const manifest=JSON.parse(files['package.json']);
  if(manifest.name!=='@loftwah/get-ready-mcp'||manifest.version!=='0.9.0'||manifest.private!==true||manifest.type!=='module'||manifest.license!=='MIT'||manifest.engines?.node!=='>=22 <23'||JSON.stringify(manifest.files)!==JSON.stringify(allowed)||JSON.stringify(manifest.dependencies)!==JSON.stringify(dependencies)||JSON.stringify(manifest.bin)!==JSON.stringify({'get-ready-mcp':'./scripts/get-ready-mcp.mjs'})||JSON.stringify(manifest.exports)!==JSON.stringify({'.':'./lib/get-ready-mcp/server.mjs'})||['scripts','optionalDependencies','devDependencies','peerDependencies','bundleDependencies','bundledDependencies'].some(key=>Object.hasOwn(manifest,key)))throw Error('Review MCP package identity, executable, file allowlist and pinned dependency/lifecycle policy before changing them.');
  files['README.md']=readPackageInput(join(directory,'README.md'),sourceBoundary);
  files['lib/get-ready-mcp/server.mjs']=readPackageInput(join(directory,'server.mjs'),sourceBoundary);
  files['scripts/get-ready-mcp.mjs']=readPackageInput(join(repository,'scripts/get-ready-mcp.mjs'));
  files.LICENSE=core.files.LICENSE;
  const transportPaths={'package.json':'lib/get-ready-mcp/package.json','README.md':'lib/get-ready-mcp/README.md','lib/get-ready-mcp/server.mjs':'lib/get-ready-mcp/server.mjs','scripts/get-ready-mcp.mjs':'scripts/get-ready-mcp.mjs'};
  const matches=Object.entries(transportPaths).every(([name,path])=>{try{return hash(execFileSync('git',['show',core.source.commit+':'+path],{cwd:repository,stdio:['ignore','pipe','pipe']}))===hash(files[name]);}catch{return false;}});
  const source={repository:core.source.repository,commit:core.source.commit,developmentSnapshot:core.source.developmentSnapshot||!matches,coreSource:core.source.commit,files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,hash(bytes)]))};
  files['SOURCE.json']=Buffer.from(JSON.stringify(source,null,2)+'\n');
  const stage=join(root,'package'),packed=join(root,'packed');mkdirSync(stage);mkdirSync(packed);
  for(const [name,bytes] of Object.entries(files)){mkdirSync(dirname(join(stage,name)),{recursive:true});writeFileSync(join(stage,name),bytes,{flag:'wx'});}chmodSync(join(stage,'scripts/get-ready-mcp.mjs'),0o755);
  writeFileSync(join(root,'user.npmrc'),'');writeFileSync(join(root,'global.npmrc'),'');
  const env={PATH:process.env.PATH,HOME:root,TMPDIR:root,NPM_CONFIG_USERCONFIG:join(root,'user.npmrc'),NPM_CONFIG_GLOBALCONFIG:join(root,'global.npmrc'),NPM_CONFIG_CACHE:join(root,'cache'),NPM_CONFIG_UPDATE_NOTIFIER:'false'};
  const result=JSON.parse(execFileSync('npm',['pack','--offline','--ignore-scripts','--json','--pack-destination',packed],{cwd:stage,env,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024}));
  if(result.length!==1||result[0].filename!=='loftwah-get-ready-mcp-0.9.0.tgz'||JSON.stringify(result[0].files.map(file=>file.path).sort())!==JSON.stringify(Object.keys(files).sort()))throw Error('MCP archive contents differ from reviewed inputs.');
  const bytes=readFileSync(join(packed,result[0].filename)),metadata={name:manifest.name,version:manifest.version,source:source.commit,coreSource:source.coreSource,developmentSnapshot:source.developmentSnapshot,sha256:hash(bytes),bytes:bytes.length,url:'/downloads/get-ready-mcp.tgz',licence:'MIT',runtimeDependencies:2,dependencies};
  writePackageArtifact(join(destination,'get-ready-mcp.tgz'),bytes,{boundary:destinationBoundary});writePackageArtifact(join(destination,'get-ready-mcp.json'),JSON.stringify(metadata,null,2)+'\n',{boundary:destinationBoundary});return metadata;
 }finally{rmSync(root,{recursive:true});}
}
export function assertMcpReleasePackage(metadata,bytes,source){
 if(metadata?.name!=='@loftwah/get-ready-mcp'||metadata.version!=='0.9.0'||metadata.source!==source||metadata.coreSource!==source||metadata.developmentSnapshot!==false||metadata.bytes!==bytes.length||metadata.sha256!==hash(bytes)||metadata.runtimeDependencies!==2||JSON.stringify(metadata.dependencies)!==JSON.stringify(dependencies))throw Error('Get Ready MCP archive must match this clean source, core and pinned dependency policy before production.');
}

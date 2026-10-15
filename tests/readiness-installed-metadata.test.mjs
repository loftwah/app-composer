import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {syncBuiltinESMExports} from 'node:module';
import {inspectProject} from '../lib/get-ready/project.mjs';
import {validateProjectReport,projectFindings,projectInstallation,projectInstallationText,fictionalProjectReport} from '../lib/get-ready/project-report.mjs';
const fixture=()=>fs.mkdtempSync(join(tmpdir(),'ready-installed-metadata-'));
function put(root,path,value){fs.mkdirSync(resolve(root,path,'..'),{recursive:true});fs.writeFileSync(join(root,path),typeof value==='string'?value:JSON.stringify(value));}
function project(root){put(root,'package.json',{dependencies:{emdash:'1.2.0'},scripts:{build:'touch NEVER-EXECUTE'}});}
const metadata={name:'emdash',version:'1.2.0',privateToken:'fictional-private-metadata',scripts:{postinstall:'touch NEVER-EXECUTE'}};

test('npm and project-contained pnpm metadata are observed without executing code or leaking paths, bodies or scripts',()=>{
 for(const layout of ['npm','pnpm']){const root=fixture(),store=fixture();try{
  project(root);let packagePath;
  if(layout==='npm'){packagePath=join(root,'node_modules/emdash/package.json');put(root,'node_modules/emdash/package.json',metadata);}
  else{put(root,'node_modules/.pnpm/emdash@1.2.0/node_modules/emdash/placeholder','');put(store,'package.json',metadata);packagePath=join(root,'node_modules/.pnpm/emdash@1.2.0/node_modules/emdash/package.json');fs.linkSync(join(store,'package.json'),packagePath);fs.symlinkSync('.pnpm/emdash@1.2.0/node_modules/emdash',join(root,'node_modules/emdash'));fs.linkSync(join(store,'package.json'),join(root,'AGENTS.md'));}
  put(root,'node_modules/emdash/index.mjs','throw Error("NEVER-EXECUTE");');const before=fs.readFileSync(packagePath),report=inspectProject({workspace:root});
  assert.equal(report.version,2);assert.deepEqual(projectInstallation(report),{state:'present',version:'1.2.0'});assert.deepEqual(validateProjectReport(report),report);assert.equal(report.ready,false);assert.ok(!report.findings.some(f=>f.id==='installation'));assert.match(projectInstallationText(report),/metadata on disk/);
  assert.doesNotMatch(JSON.stringify(report),/fictional-private|NEVER-EXECUTE/);assert.ok(!JSON.stringify(report).includes(root));assert.equal(fs.existsSync(join(root,'NEVER-EXECUTE')),false);assert.equal(fs.existsSync(join(root,'.private')),false);assert.deepEqual(fs.readFileSync(packagePath),before);if(layout==='pnpm')assert.equal(report.guidance[0].state,'refused');
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(store,{recursive:true,force:true});}}
});

test('absent, malformed, oversized and unsupported installed metadata remain distinct observations without installation authority',()=>{
 const root=fixture();try{
  project(root);assert.deepEqual(projectInstallation(inspectProject({workspace:root})),{state:'absent',version:null});
  for(const [value,state] of [['{bad JSON','invalid'],[{name:'another-package',version:'1.2.0'},'invalid'],[{name:'emdash',version:'https://fictional-private.test/key'},'invalid'],[{name:'emdash',version:'^1.2.0'},'invalid'],['x'.repeat(65537),'oversize']]){put(root,'node_modules/emdash/package.json',value);const report=inspectProject({workspace:root});assert.deepEqual(projectInstallation(report),{state,version:null});assert.doesNotMatch(JSON.stringify(report),/fictional-private/);assert.ok(report.findings.some(f=>f.id==='installation'));}
  put(root,'node_modules/emdash/package.json',{name:'emdash',version:'1.3.0'});const report=inspectProject({workspace:root});assert.equal(report.manifest.emdashVersion,'1.2.0');assert.deepEqual(projectInstallation(report),{state:'present',version:'1.3.0'});assert.ok(report.findings.some(f=>f.id==='installation'&&f.action.includes('differs')));assert.equal(report.ready,false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('external/shared installs and linked package files are refused; general projects do not probe dependencies',()=>{
 for(const kind of ['modules','entry','package']){const root=fixture(),outside=fixture();try{
  project(root);put(outside,'emdash/package.json',metadata);
  if(kind==='modules')fs.symlinkSync(outside,join(root,'node_modules'));
  else if(kind==='entry'){fs.mkdirSync(join(root,'node_modules'));fs.symlinkSync(join(outside,'emdash'),join(root,'node_modules/emdash'));}
  else{fs.mkdirSync(join(root,'node_modules/emdash'),{recursive:true});fs.symlinkSync(join(outside,'emdash/package.json'),join(root,'node_modules/emdash/package.json'));}
  assert.deepEqual(projectInstallation(inspectProject({workspace:root})),{state:'refused',version:null});put(root,'package.json',{dependencies:{astro:'7.3.5'}});assert.deepEqual(projectInstallation(inspectProject({workspace:root})),{state:'not-requested',version:null});
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}}
});

test('a package changed during the bounded read is not reported as an installed version and owner bytes stay intact',()=>{
 const root=fixture(),original=fs.readSync;try{
  project(root);put(root,'node_modules/emdash/package.json',metadata);const path=join(root,'node_modules/emdash/package.json'),inode=fs.statSync(path).ino;let changed=false;
  fs.readSync=(fd,...args)=>{const count=original(fd,...args);if(!changed&&fs.fstatSync(fd).ino===inode){changed=true;fs.writeFileSync(path,JSON.stringify({...metadata,version:'1.3.0'}));}return count;};syncBuiltinESMExports();
  const report=inspectProject({workspace:root});assert.equal(changed,true);assert.deepEqual(projectInstallation(report),{state:'changed',version:null});assert.equal(JSON.parse(fs.readFileSync(path)).version,'1.3.0');
 }finally{fs.readSync=original;syncBuiltinESMExports();fs.rmSync(root,{recursive:true,force:true});}
});

test('version-two imports reject forged runtime data and old version-one reports retain unknown installation',()=>{
 const base=fictionalProjectReport();assert.equal(base.version,2);
 for(const edit of [v=>v.manifest.installation.token='fictional-private',v=>v.manifest.installation.version='^1.2.0',v=>v.manifest.installation.version='fictional-private',v=>v.manifest.installation={state:'absent',version:'1.2.0'},v=>v.manifest.installation={state:'not-probed',version:null},v=>v.manifest.installation={state:'not-requested',version:null},v=>v.manifest.installedVersion='1.2.0']){const report=structuredClone(base);edit(report);assert.throws(()=>validateProjectReport(report));}
 const legacy=structuredClone(base);legacy.version=1;delete legacy.manifest.installation;legacy.manifest.installedVersion='not-probed';legacy.findings=projectFindings(legacy);assert.deepEqual(validateProjectReport(legacy),legacy);assert.deepEqual(projectInstallation(legacy),{state:'not-probed',version:null});assert.match(projectInstallationText(legacy),/older report/);assert.equal(legacy.ready,false);
});

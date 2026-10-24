import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import child from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
import {createContentProject,contentProjectFiles} from '../lib/content-model/project.mjs';import {starterModel,emdashSeed} from '../lib/content-model/index.mjs';import {contentPattern,contentPatternSummaries} from '../lib/content-model/patterns.mjs';import {validateSeed} from 'emdash/seed';
import {childDirectory} from '../lib/get-ready/project-write.mjs';
const fixture=()=>fs.realpathSync(fs.mkdtempSync(join(tmpdir(),'composer-project-recipe-'))),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function tree(path){return fs.readdirSync(path,{withFileTypes:true}).map(entry=>[entry.name,entry.isDirectory()?tree(join(path,entry.name)):entry.isSymbolicLink()?'link':hash(fs.readFileSync(join(path,entry.name)))]);}
test('every supported model becomes independently owned fixed source and a native EmDash seed, with no imported code',()=>{
 const root=fixture(),baseline=contentProjectFiles(starterModel);try{
  for(const pattern of contentPatternSummaries){const model=contentPattern(pattern.id),destination=join(root,pattern.id),result=createContentProject({model,destination});assert.equal(result.deployed,false);assert.equal(result.dependenciesInstalled,false);assert.equal(result.agentSkillsVerified,false);
   const seed=JSON.parse(fs.readFileSync(join(destination,'seed/seed.json'),'utf8'));assert.equal(validateSeed(seed).valid,true);assert.equal(seed.collections[0].slug,model.collection);assert.equal(fs.existsSync(join(destination,'node_modules')),false);assert.equal(fs.existsSync(join(destination,'.git')),false);
   const source=JSON.parse(fs.readFileSync(join(destination,'composer-project.json'),'utf8'));for(const [name,digest] of Object.entries(source.files))assert.equal(hash(fs.readFileSync(join(destination,name))),digest);
   for(const [name,bytes] of Object.entries(baseline.files).filter(([name])=>/\.(?:m[jt]s|astro|tsx?|css)$/.test(name)))assert.deepEqual(fs.readFileSync(join(destination,name)),bytes);
   assert.match(fs.readFileSync(join(destination,'src/pages/index.astro'),'utf8'),/status:\s*['"]published['"]/);assert.match(fs.readFileSync(join(destination,'public/brand/OFL-Space-Grotesk.txt'),'utf8'),/SIL OPEN FONT LICENSE/);
  }
  const adversarial={...structuredClone(starterModel),label:'</script><img src=x onerror=alert(1)>'},files=contentProjectFiles(adversarial).files;assert(JSON.parse(files['src/content-model.json']).label.includes('onerror'));for(const [name,bytes] of Object.entries(files).filter(([name])=>/\.(?:m[jt]s|astro|tsx?|css)$/.test(name)))assert.equal(bytes.includes(Buffer.from('onerror')),false,name);
 }finally{fs.rmSync(root,{recursive:true});}
});
test('existing empty, authored and linked destinations are preserved; separate projects do not alter each other',()=>{
 const root=fixture();try{
  const first=join(root,'first');createContentProject({model:starterModel,destination:first});const before=tree(first);assert.throws(()=>createContentProject({model:starterModel,destination:first}));assert.deepEqual(tree(first),before);createContentProject({model:contentPattern('projects'),destination:join(root,'other')});assert.deepEqual(tree(first),before);
  for(const kind of ['empty','authored','linked']){const path=join(root,kind);if(kind==='linked')fs.symlinkSync(first,path);else{fs.mkdirSync(path);if(kind==='authored')fs.writeFileSync(join(path,'owner.txt'),'Fictional owner content');}assert.throws(()=>createContentProject({model:starterModel,destination:path}));if(kind==='authored')assert.equal(fs.readFileSync(join(path,'owner.txt'),'utf8'),'Fictional owner content');}assert.deepEqual(tree(first),before);
  const invalid={...starterModel,collection:'../outside'};assert.throws(()=>createContentProject({model:invalid,destination:join(root,'invalid')}));assert.equal(fs.existsSync(join(root,'invalid')),false);
 }finally{fs.rmSync(root,{recursive:true});}
});
test('replacing the checked parent or a reserved output cannot redirect creation into substitute owner directories',()=>{
 const original=child.spawnSync;
 for(const stage of ['parent','output']){const root=fixture(),parent=join(root,'parent'),destination=join(parent,'site'),outside=join(root,'outside');fs.mkdirSync(parent);fs.mkdirSync(outside);fs.writeFileSync(join(outside,'owner.txt'),'Fictional owner content');const before=tree(outside);let swapped=false;
  try{child.spawnSync=(command,args,options)=>{const request=JSON.parse(options.input),match=stage==='parent'?options.cwd===parent&&request.operation==='directory':options.cwd===destination&&request.operation==='files';if(match&&!swapped){swapped=true;fs.renameSync(options.cwd,join(root,'retained'));if(stage==='parent')fs.mkdirSync(parent);else fs.symlinkSync(outside,destination);}return original(command,args,options);};syncBuiltinESMExports();assert.throws(()=>createContentProject({model:starterModel,destination}));assert.equal(swapped,true);assert.deepEqual(tree(outside),before);if(stage==='parent')assert.deepEqual(fs.readdirSync(parent),[]);
  }finally{child.spawnSync=original;syncBuiltinESMExports();fs.rmSync(root,{recursive:true});}
 }
});
test('interrupted preparation keeps partial files and refuses automatic replacement on retry',()=>{
 const root=fixture(),destination=join(root,'site'),original=child.spawnSync;let fileGroups=0;
 try{child.spawnSync=(command,args,options)=>{if(JSON.parse(options.input).operation==='files'&&++fileGroups===2)return {status:2,stdout:'',stderr:''};return original(command,args,options);};syncBuiltinESMExports();assert.throws(()=>createContentProject({model:starterModel,destination}));assert.equal(fs.existsSync(join(destination,'package.json')),true);const before=tree(destination);child.spawnSync=original;syncBuiltinESMExports();assert.throws(()=>createContentProject({model:starterModel,destination}));assert.deepEqual(tree(destination),before);}finally{child.spawnSync=original;syncBuiltinESMExports();fs.rmSync(root,{recursive:true});}
});
test('the agent CLI creates only a new reviewed source project and refuses cloud deployment and unsupported input',()=>{
 const root=fixture(),file=join(root,'model.json'),parent=join(root,'My Projects café'),destination=join(parent,'Field defaults café');fs.mkdirSync(parent);fs.writeFileSync(file,JSON.stringify(starterModel));const command=resolve('scripts/init-site.mjs');
 try{const result=child.spawnSync(process.execPath,[command,'--model',file,'--destination',destination],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).state,'project-created');const deploy=child.spawnSync(process.execPath,[join(destination,'scripts/deploy.mjs')],{cwd:destination,encoding:'utf8',env:{PATH:process.env.PATH,HOME:root}});assert.equal(deploy.status,1);assert.match(deploy.stderr,/No deployment was attempted/);
  for(const flags of [['--model',file,'--destination',destination],['--model',file,'--destination',join(root,'new'),'--apply'],['--model',file,'--destination','relative'],['--model',file,'--destination',join(root,'new'),'--account','fictional']])assert.equal(child.spawnSync(process.execPath,[command,...flags],{encoding:'utf8'}).status,1);assert.equal(fs.existsSync(join(root,'new')),false);
 }finally{fs.rmSync(root,{recursive:true});}
});

test('directory creation accepts ordinary folder names but refuses path components and control characters',()=>{
 const root=fixture(),stat=fs.lstatSync(root),identity={dev:stat.dev,ino:stat.ino};try{
  for(const name of ['', '.', '..', '../outside', 'nested/child', 'nested\\child', 'bad\0name', 'bad\nname'])assert.throws(()=>childDirectory(root,identity,name,true));
  assert.deepEqual(fs.readdirSync(root),[]);const created=childDirectory(root,identity,'Field defaults café',true);assert.equal(fs.lstatSync(join(root,'Field defaults café')).ino,created.ino);assert.throws(()=>childDirectory(root,identity,'Field defaults café',true));
 }finally{fs.rmSync(root,{recursive:true});}
});

test('generated compatibility hook only normalises submitted selected optional links and preserves all other intent',async()=>{
 const {createPlugin}=await import('../lib/content-model/site-template/src/lib/editor-compatibility.mjs'),links=['join_link'],plugin=createPlugin({collection:'workshops',links});links.push('required_link');const save=plugin.hooks['content:beforeSave'].handler;
 assert.deepEqual(plugin.capabilities,['content:write','content:read']);assert.deepEqual(Object.keys(plugin.routes),[]);assert.deepEqual(plugin.allowedHosts,[]);
 const submitted={join_link:'',required_link:'',title:'Fictional title',seats:0,featured:false,rows:[{url:''}]},before=structuredClone(submitted),result=await save({collection:'workshops',content:submitted});assert.deepEqual(submitted,before);assert.equal(result.join_link,null);for(const name of ['required_link','title','seats','featured','rows'])assert.deepEqual(result[name],submitted[name]);
 for(const value of [null,undefined,'https://example.test/link','javascript:unsafe',' ']){const data={join_link:value};assert.equal(await save({collection:'workshops',content:data}),data);}
 const absent={title:'No link was submitted'};assert.equal(await save({collection:'workshops',content:absent}),absent);assert.equal(await save({collection:'other',content:submitted}),undefined);
 for(const options of [{collection:'../outside',links:[]},{collection:'workshops',links:['__proto__']},{collection:'workshops',links:['link','link']},{collection:'workshops',links:Array(13).fill('link')},{collection:'workshops',links:'all'}])assert.throws(()=>createPlugin(options));
});


test('only the generated site seed selects its bundled native integer widget; portable seeds stay independent',()=>{
 const model=structuredClone(starterModel);model.fields.push({key:'seats',label:'Seats',type:'integer',required:false,group:model.groups[0],validation:{min:1,max:50},defaultValue:12});
 const standalone=emdashSeed(model),site=contentProjectFiles(model),seed=JSON.parse(site.files['seed/seed.json']);assert.equal(standalone.collections[0].fields.find(field=>field.slug==='seats').widget,undefined);assert.equal(seed.collections[0].fields.find(field=>field.slug==='seats').widget,'composer-content-fields:integer');assert.equal(validateSeed(seed).valid,true);
 for(const field of seed.collections[0].fields.filter(field=>field.type!=='integer'&&field.slug!=='workshop_date'))assert.equal(field.widget,undefined);
 assert.equal(JSON.parse(site.files['package.json']).dependencies['@cloudflare/kumo'],'2.6.0');for(const name of ['src/lib/editor-fields.tsx','src/lib/number-input.mjs'])assert.equal(hash(site.files[name]),site.provenance.files[name]);
});
test('native integer editing preserves an explicit zero and clears an empty control to null',async()=>{
 const {numberInputValue}=await import('../lib/content-model/site-template/src/lib/number-input.mjs');assert.equal(numberInputValue(''),null);for(const value of ['0','-1','1','50','51'])assert.equal(numberInputValue(value),Number(value));
});


test('optional row links clear without mutating submitted rows, required links or unrelated collections',async()=>{
 const {createPlugin}=await import('../lib/content-model/site-template/src/lib/editor-compatibility.mjs');
 const rows=[{key:'credits',links:['website']}],plugin=createPlugin({collection:'projects',links:['project_link'],rows});rows[0].links.push('required_link');rows.push({key:'outside',links:['website']});const save=plugin.hooks['content:beforeSave'].handler;
 const untouched={name:'Fictional unchanged',website:'https://example.test/studio'},submitted={project_link:'',title:'Fictional project',credits:[{name:'Fictional studio',website:'',required_link:'',flag:false,zero:0},untouched,{name:'Absent link'},null,['unexpected row']],outside:[{website:''}]},before=structuredClone(submitted),result=await save({collection:'projects',content:submitted});
 assert.deepEqual(submitted,before);assert.equal(result.project_link,null);assert.equal(result.credits[0].website,null);assert.equal(result.credits[0].required_link,'');assert.equal(result.credits[0].flag,false);assert.equal(result.credits[0].zero,0);assert.equal(result.credits[1],untouched);assert.equal(result.credits[2],submitted.credits[2]);assert.equal(result.credits[3],null);assert.equal(result.credits[4],submitted.credits[4]);assert.equal(result.outside,submitted.outside);
 const noChange={credits:[{website:null},{website:'https://example.test'},{website:'javascript:unsafe'},{website:' '},{}]};assert.equal(await save({collection:'projects',content:noChange}),noChange);for(const credits of [undefined,null,'wrong shape',{}]){const content={credits};assert.equal(await save({collection:'projects',content}),content);}assert.equal(await save({collection:'other',content:submitted}),undefined);
 for(const rows of ['all',[null],[{key:'credits',links:'all'}],[{key:'../outside',links:[]}],[{key:'constructor',links:[]}],[{key:'credits',links:['prototype']}],[{key:'credits',links:['website','website']}],[{key:'credits',links:[],execute:'untrusted'}],[{key:'credits',links:[]},{key:'credits',links:[]}]])assert.throws(()=>createPlugin({collection:'projects',links:[],rows}));
});

// Real generated consumer source must own the reviewed menu and every byte it uses.
test('new projects capture a local checked command menu and external app destinations without changing existing projects', () => {
 const result=contentProjectFiles(starterModel), paths=['public/brand/apps/launch-kit-20261023-32.png','public/brand/apps/paperwork-icon-20261024.svg','public/brand/launcher.js','public/brand/launcher.css','public/brand/space-latin-20261018.woff2','public/brand/OFL-Space-Grotesk.txt','public/brand/composer-icon-20261022b-32.png','public/brand/composer-icon-20261022b-96.png','public/brand/composer-icon-20261022b-180.png','public/brand/composer-icon-20261022b-512.png','src/browser/launcher.ts','scripts/launcher-assets.mjs','tsconfig.launcher.json',...['linkarooie','herethere','linkcheck','hello','carryforward'].map(id=>'public/brand/apps/'+id+'-small-20261018.webp')];
 for(const path of paths){assert.equal(hash(result.files[path]),hash(fs.readFileSync(path)));assert.equal(result.provenance.sourceFiles[path],hash(result.files[path]));}
 const component=result.files['src/components/AppLauncher.astro'].toString();
 for(const host of ['showcase','guestbook','share','ready','ai'])assert.match(component,new RegExp('https://'+host+'\\.loftwah\\.com/'));
 assert.match(component,/data-composer-home="https:\/\/composer\.loftwah\.com\/"/);assert.match(component,/src="\/brand\/launcher\.js"/);assert.doesNotMatch(component,/href="\/(?:guestbook|showcase)/);
 const scripts=JSON.parse(result.files['package.json']).scripts;assert.match(scripts['check:types'],/launcher-assets\.mjs --check/);assert.match(scripts['source:write'],/launcher-assets\.mjs --write/);
 assert.match(result.files['src/layouts/ContentLayout.astro'].toString(),/App Composer home/);assert.match(result.files['src/layouts/ContentLayout.astro'].toString(),/\/brand\/launcher\.css/);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import child from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createHash} from 'node:crypto';
import {createContentProject,contentProjectFiles} from '../lib/content-model/project.mjs';import {starterModel} from '../lib/content-model/index.mjs';import {contentPattern,contentPatternSummaries} from '../lib/content-model/patterns.mjs';import {validateSeed} from 'emdash/seed';
const fixture=()=>fs.realpathSync(fs.mkdtempSync(join(tmpdir(),'composer-project-recipe-'))),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function tree(path){return fs.readdirSync(path,{withFileTypes:true}).map(entry=>[entry.name,entry.isDirectory()?tree(join(path,entry.name)):entry.isSymbolicLink()?'link':hash(fs.readFileSync(join(path,entry.name)))]);}
test('every supported model becomes independently owned fixed source and a native EmDash seed, with no imported code',()=>{
 const root=fixture(),baseline=contentProjectFiles(starterModel);try{
  for(const pattern of contentPatternSummaries){const model=contentPattern(pattern.id),destination=join(root,pattern.id),result=createContentProject({model,destination});assert.equal(result.deployed,false);assert.equal(result.dependenciesInstalled,false);assert.equal(result.agentSkillsVerified,false);
   const seed=JSON.parse(fs.readFileSync(join(destination,'seed/seed.json'),'utf8'));assert.equal(validateSeed(seed).valid,true);assert.equal(seed.collections[0].slug,model.collection);assert.equal(fs.existsSync(join(destination,'node_modules')),false);assert.equal(fs.existsSync(join(destination,'.git')),false);
   const source=JSON.parse(fs.readFileSync(join(destination,'composer-project.json'),'utf8'));for(const [name,digest] of Object.entries(source.files))assert.equal(hash(fs.readFileSync(join(destination,name))),digest);
   for(const [name,bytes] of Object.entries(baseline.files).filter(([name])=>/\.(?:mjs|astro|ts|css)$/.test(name)))assert.deepEqual(fs.readFileSync(join(destination,name)),bytes);
   assert.match(fs.readFileSync(join(destination,'src/pages/index.astro'),'utf8'),/status:'published'/);assert.match(fs.readFileSync(join(destination,'public/brand/OFL-Space-Grotesk.txt'),'utf8'),/SIL OPEN FONT LICENSE/);
  }
  const adversarial={...structuredClone(starterModel),label:'</script><img src=x onerror=alert(1)>'},files=contentProjectFiles(adversarial).files;assert(JSON.parse(files['src/content-model.json']).label.includes('onerror'));for(const [name,bytes] of Object.entries(files).filter(([name])=>/\.(?:mjs|astro|ts|css)$/.test(name)))assert.equal(bytes.includes(Buffer.from('onerror')),false,name);
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
 const root=fixture(),file=join(root,'model.json'),destination=join(root,'site');fs.writeFileSync(file,JSON.stringify(starterModel));const command=resolve('scripts/init-site.mjs');
 try{const result=child.spawnSync(process.execPath,[command,'--model',file,'--destination',destination],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).state,'project-created');const deploy=child.spawnSync(process.execPath,[join(destination,'scripts/deploy.mjs')],{cwd:destination,encoding:'utf8',env:{PATH:process.env.PATH,HOME:root}});assert.equal(deploy.status,1);assert.match(deploy.stderr,/No deployment was attempted/);
  for(const flags of [['--model',file,'--destination',destination],['--model',file,'--destination',join(root,'new'),'--apply'],['--model',file,'--destination','relative'],['--model',file,'--destination',join(root,'new'),'--account','fictional']])assert.equal(child.spawnSync(process.execPath,[command,...flags],{encoding:'utf8'}).status,1);assert.equal(fs.existsSync(join(root,'new')),false);
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

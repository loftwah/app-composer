import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync,rmSync,readdirSync,realpathSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {prepareSiteSkills,createReadinessSession,runReadinessSession,inspectReadiness,readinessReport,ReadinessFailure} from '../lib/get-ready/index.mjs';
import bundle from '../lib/get-ready/site-skills.json' with {type:'json'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){const root=realpathSync(mkdtempSync(join(tmpdir(),'composer-site-skills-'))),workspace=join(root,'project'),home=join(root,'home');mkdirSync(workspace);mkdirSync(home);writeFileSync(join(workspace,'package.json'),JSON.stringify({dependencies:{emdash:'1.2.0'}}));return {root,workspace,env:{HOME:home,CODEX_THREAD_ID:'fictional-skill-preparation'}};}
function digest(path){return readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>[entry.name,entry.isDirectory()?digest(join(path,entry.name)):hash(readFileSync(join(path,entry.name)))]);}
test('complete pinned skills prepare offline; repeat and independent project preserve existing bytes',()=>{
 const {root,workspace,env}=fixture();try{
  writeFileSync(join(workspace,'AGENTS.md'),'Fictional authored instructions');
  const first=prepareSiteSkills({workspace,availableSkills:[]},env);assert.equal(first.changed,true);assert.equal(first.ready,false);assert.equal(first.source.commit,bundle.commit);
  assert.deepEqual(first.skills.map(s=>s.state),['prepared','prepared']);for(const skill of first.skills){assert.equal(skill.agentVisible,'not-probed');assert.equal(skill.exercised,false);}
  for(const [name,file] of Object.entries(bundle.files)){if(name==='LICENSE')continue;const actual=readFileSync(join(workspace,'.agents',name));assert.equal(hash(actual),file.sha256);}
  assert.match(readFileSync(join(workspace,'.agents/skills/emdash-cli/LICENSE'),'utf8'),/MIT License/);
  const before=digest(workspace),second=prepareSiteSkills({workspace,availableSkills:[]},env);assert.equal(second.changed,false);assert.deepEqual(second.skills.map(s=>s.state),['reviewed-copy','reviewed-copy']);assert.deepEqual(digest(workspace),before);
  const other=join(root,'different-project');mkdirSync(other);writeFileSync(join(other,'package.json'),JSON.stringify({devDependencies:{emdash:'1.2.0'}}));assert.equal(prepareSiteSkills({workspace:other,availableSkills:[]},env).changed,true);assert.deepEqual(digest(workspace),before);
 }finally{rmSync(root,{recursive:true});}
});
test('authored, partial, advertised, user and parent skills are preserved without duplicate installs',()=>{
 for(const scope of ['project','user','parent','advertised','partial']){
  const {root,workspace,env}=fixture();try{
   const folder=scope==='user'?join(env.HOME,'.codex/skills'):scope==='parent'?join(root,'.agents/skills'):join(workspace,'.agents/skills');
   if(scope!=='advertised')for(const id of ['building-emdash-site','emdash-cli']){mkdirSync(join(folder,id),{recursive:true});if(scope!=='partial')writeFileSync(join(folder,id,'SKILL.md'),'Fictional custom skill');}
   const before=digest(workspace),result=prepareSiteSkills({workspace,availableSkills:scope==='advertised'?['building-emdash-site','emdash-cli']:[]},env);
   assert.equal(result.changed,false);assert.equal(result.ready,false);assert.deepEqual(digest(workspace),before);assert.equal(result.skills.every(s=>s.state=== (scope==='advertised'?'advertised-by-agent':scope==='project'||scope==='partial'?'preserved-project-copy':'preserved-other-scope')),true);
  }finally{rmSync(root,{recursive:true});}
 }
});
test('changed reference content is preserved on repeat; matching entrypoints do not imply matching trees',()=>{
 const {root,workspace,env}=fixture();try{prepareSiteSkills({workspace,availableSkills:[]},env);const target=join(workspace,'.agents/skills/building-emdash-site/references/schema-and-seed.md');writeFileSync(target,'Fictional modified reference');const before=digest(workspace),result=prepareSiteSkills({workspace,availableSkills:[]},env);assert.equal(result.changed,false);assert.equal(result.skills[0].state,'preserved-project-copy');assert.deepEqual(digest(workspace),before);}finally{rmSync(root,{recursive:true});}
});
test('unsupported declarations, missing inventory, inactive runtime and unknown fields refuse before any writes',()=>{
 for(const input of [{version:'^1.2.0'},{version:'2.0.0'},{version:null},{availableSkills:null},{availableSkills:['unknown']},{availableSkills:['emdash-cli','emdash-cli']},{inactive:true},{unknown:true}]){
  const {root,workspace,env}=fixture();try{
   if('version' in input)writeFileSync(join(workspace,'package.json'),JSON.stringify({dependencies:{emdash:input.version}}));if(input.inactive)delete env.CODEX_THREAD_ID;
   const before=digest(workspace);assert.throws(()=>prepareSiteSkills({workspace,availableSkills:[],...(Object.hasOwn(input,'availableSkills')?{availableSkills:input.availableSkills}:{}),...(input.unknown?{token:'fictional'}:{})},env),ReadinessFailure);assert.deepEqual(digest(workspace),before);
  }finally{rmSync(root,{recursive:true});}
 }
});
test('linked preparation destination and linked manifest cannot redirect writes to another folder',()=>{
 for(const kind of ['destination','manifest']){const {root,workspace,env}=fixture();try{
  const outside=join(root,'outside');mkdirSync(outside);writeFileSync(join(outside,'owner.txt'),'Fictional owner file');
  if(kind==='destination')symlinkSync(outside,join(workspace,'.agents'));else{rmSync(join(workspace,'package.json'));writeFileSync(join(outside,'package.json'),JSON.stringify({dependencies:{emdash:'1.2.0'}}));symlinkSync(join(outside,'package.json'),join(workspace,'package.json'));}
  const before=digest(outside);assert.throws(()=>prepareSiteSkills({workspace,availableSkills:[]},env));assert.deepEqual(digest(outside),before);
 }finally{rmSync(root,{recursive:true});}}
});
test('engine requires fresh inventory and agent check; preparation cannot certify readiness or replay on resume',async()=>{
 const context={workspace:'/fictional/project'},calls=[],checks=['agent','github','cloudflare','https'].map(id=>({id,label:id,verify:async()=>{calls.push(id);return {};}}));
 let preparations=0;const adapter={checks,prepareSiteSkills:async inventory=>{preparations++;assert.deepEqual(inventory,[]);calls.push('prepare');return {changed:true,ready:false};}};
 await assert.rejects(runReadinessSession(createReadinessSession(context),adapter,()=>{},{operation:'prepare-site-skills'}));
 const first=await runReadinessSession(createReadinessSession(context),adapter,()=>{},{operation:'prepare-site-skills',availableSkills:[]});assert.deepEqual(calls,['agent','prepare','github','cloudflare','https']);assert.equal(first.state,'action_required');assert.equal(first.expiresAt,null);assert.equal(inspectReadiness(first).ready,false);assert.equal(readinessReport(first).operations[0].state,'prepared');assert.equal(JSON.stringify(first).includes('availableSkills'),false);
 const review=await runReadinessSession(createReadinessSession(context,first),adapter);assert.equal(preparations,1);assert.equal(review.state,'action_required');assert.equal(inspectReadiness(review).ready,false);assert.equal(readinessReport(review).operations[0].state,'prepared');assert.equal(review.pendingOperations[0].id,'prepare-site-skills');
 const changed=await runReadinessSession(createReadinessSession({...context,dirty:true,source:'a'.repeat(40)},review),adapter);assert.equal(changed.state,'action_required');assert.equal(changed.pendingOperations[0].id,'prepare-site-skills');assert.equal(createReadinessSession({workspace:'/fictional/other'},review).pendingOperations,undefined);
 const cancelled=await runReadinessSession(createReadinessSession(context,review),adapter,()=>{},{cancel:true});assert.equal(inspectReadiness(cancelled).ready,false);assert.equal(cancelled.state,'cancelled');
 adapter.prepareSiteSkills=async()=>{preparations++;throw new ReadinessFailure('configuration');};const failed=await runReadinessSession(createReadinessSession(context),adapter,()=>{},{operation:'prepare-site-skills',availableSkills:[]});const resumed=await runReadinessSession(createReadinessSession(context,failed),adapter);assert.equal(preparations,2);assert.equal(inspectReadiness(resumed).ready,false);
 assert.equal(resumed.pendingOperations[0].id,'prepare-site-skills');
 const missing={...adapter,checks:checks.map(c=>c.id==='agent'?{...c,verify:()=>{throw new ReadinessFailure('configuration');}}:c)};const blocked=await runReadinessSession(createReadinessSession(context),missing,()=>{},{operation:'prepare-site-skills',availableSkills:[]});assert.equal(blocked.operation.state,'blocked');assert.equal(preparations,2);
});

test('manifest version and source guard share the same bytes when it changes after the first read',async()=>{
 const fs=(await import('node:fs')).default,{syncBuiltinESMExports}=await import('node:module'),{root,workspace,env}=fixture(),originalOpen=fs.openSync,originalClose=fs.closeSync;let selected,swapped=false;
 try{
  fs.openSync=(path,...args)=>{const fd=originalOpen(path,...args);if(path===join(workspace,'package.json')&&!swapped)selected=fd;return fd;};
  fs.closeSync=fd=>{const result=originalClose(fd);if(fd===selected&&!swapped){swapped=true;writeFileSync(join(workspace,'package.json'),JSON.stringify({dependencies:{emdash:'2.0.0'}}));}return result;};syncBuiltinESMExports();
  assert.throws(()=>prepareSiteSkills({workspace,availableSkills:[]},env),ReadinessFailure);assert.equal(swapped,true);assert.equal(fs.existsSync(join(workspace,'.agents')),false);
 }finally{fs.openSync=originalOpen;fs.closeSync=originalClose;syncBuiltinESMExports();rmSync(root,{recursive:true});}
});

test('kernel-bound write directories refuse replacement before launch without writing into the substitute',async()=>{
 const child=(await import('node:child_process')).default,{syncBuiltinESMExports}=await import('node:module'),{renameSync}=await import('node:fs'),original=child.spawnSync;
 for(const stage of ['target','scope','references']){
  const {root,workspace,env}=fixture(),outside=join(root,'outside');mkdirSync(outside);writeFileSync(join(outside,'owner.txt'),'Fictional owner bytes');const before=digest(outside);let swapped=false;
  try{
   child.spawnSync=(command,args,options)=>{
    const request=JSON.parse(options.input),match=stage==='target'?options.cwd.endsWith('/skills/building-emdash-site')&&request.operation==='files':stage==='scope'?options.cwd.endsWith('/.agents')&&request.operation==='directory':options.cwd.endsWith('/building-emdash-site/references')&&request.operation==='files';
    if(match&&!swapped){swapped=true;renameSync(options.cwd,join(root,'retained'));symlinkSync(outside,options.cwd);}
    return original(command,args,options);
   };syncBuiltinESMExports();
   assert.throws(()=>prepareSiteSkills({workspace,availableSkills:[]},env),ReadinessFailure);assert.equal(swapped,true);assert.deepEqual(digest(outside),before);
  }finally{child.spawnSync=original;syncBuiltinESMExports();rmSync(root,{recursive:true});}
 }
});

test('nested Git projects are refused instead of silently preparing their repository parent',async()=>{
 const {execFileSync}=await import('node:child_process'),{runLocalReadiness}=await import('../lib/get-ready/index.mjs'),{root,workspace,env}=fixture();
 try{execFileSync('git',['init','--quiet',workspace],{env:{PATH:process.env.PATH,HOME:env.HOME},stdio:'pipe'});const nested=join(workspace,'nested');mkdirSync(nested);writeFileSync(join(nested,'package.json'),JSON.stringify({dependencies:{emdash:'1.2.0'}}));await assert.rejects(runLocalReadiness({workspace:nested,operation:'prepare-site-skills',availableSkills:[]},{...env,PATH:process.env.PATH}));assert.equal((await import('node:fs')).existsSync(join(workspace,'.private')),false);assert.equal((await import('node:fs')).existsSync(join(workspace,'.agents')),false);}finally{rmSync(root,{recursive:true});}
});

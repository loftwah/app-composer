import test from 'node:test';import assert from 'node:assert/strict';import {validateSpec,handoff,visibleQuestions,pruneAnswers,explorerSpec} from '../src/lib/spec.mjs';import {validateComposition,guardPromotion,publicItem} from '../scripts/contracts.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync,execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {helloConfiguration} from '../src/lib/hello-spec.mjs';
const valid=()=>({version:1,preset:'composition',config:{title:'A fictional corner',intro:'Only synthetic fixtures',theme:'daylight',layout:'grid'},privacy:'review-first',cards:[],deployment:{mode:'preview',hostname:''},decisions:{}});
test('portable spec is deterministic and hidden card fields do not affect standalone guestbook',()=>{const a=valid();assert.deepEqual(validateSpec(a),validateSpec(a));a.preset='guestbook';a.cards=[{title:'Ignored hidden field',url:'javascript:alert(1)'}];assert.deepEqual(validateSpec(a).cards,[]);assert.match(handoff(valid()),/untrusted configuration data/);});
test('conditional hostname intent ignores hidden values while visible domain/card values remain validated',()=>{
 for(const mode of ['preview','new-domain']){
  const input={...valid(),deployment:{mode,hostname:'https://unfinished.example/path'}};
  assert.equal(validateSpec(input).deployment.hostname,'');
  assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(validateSpec(input)))),validateSpec(input));
  assert.doesNotMatch(handoff(input),/unfinished\.example/);
 }
 for(const hostname of ['', 'https://unfinished.example/path'])assert.throws(()=>validateSpec({...valid(),deployment:{mode:'existing-domain',hostname}}));
 assert.throws(()=>validateSpec({...valid(),cards:[{title:'   ',url:'https://example.com/'}]}),/Give each card a title/);
 assert.equal(validateSpec({...valid(),cards:[{title:'A useful link',url:'https://example.com/'}]}).cards[0].title,'A useful link');
});
test('unsafe destinations, schema drift and approval bypass are rejected',()=>{for(const patch of [{version:3},{privacy:'public-without-review'},{config:{...valid().config,title:'\u0000'}},{cards:[{title:'X',url:'javascript:alert(1)'}]}])assert.throws(()=>validateSpec({...valid(),...patch}));const s=validateSpec({...valid(),deployment:{mode:'new-domain',hostname:''}});assert.equal(s.deployment.approval,'purchase-required');});
test('Hello exports only supported configuration and ignores hidden gallery layout',()=>{
 const input={...valid(),preset:'hello',config:{...valid().config,layout:'hidden-stale-value'},deployment:{mode:'existing-domain',hostname:'hello.example.com'}};
 assert.equal(validateSpec(input).config.layout,'grid');
 assert.deepEqual(helloConfiguration(input,'https://hello.example.com'),{title:input.config.title,intro:input.config.intro,theme:input.config.theme});
 assert.throws(()=>helloConfiguration(input,'https://other.example.com'),/hostname must match/);
 assert.throws(()=>helloConfiguration({...input,preset:'composition',config:{...input.config,layout:'grid'}},'https://hello.example.com'),/Hello reference specification/);
 for(const mode of ['preview','new-domain'])assert.throws(()=>helloConfiguration({...input,deployment:{mode,hostname:''}},'https://hello.example.com'),/verified existing domain/);
});
test('Hello command plans without workspace/provider access and refuses unsupported apply intent first',()=>{
 const workspace=mkdtempSync(join(tmpdir(),'composer-hello-init-'));
 try{
  const input={...valid(),preset:'hello',deployment:{mode:'existing-domain',hostname:'hello.example.com'}},spec=join(workspace,'spec.json');
  writeFileSync(spec,JSON.stringify(input));
  const args=[fileURLToPath(new URL('../scripts/init-hello.mjs',import.meta.url)),'--spec',spec,'--workspace',join(workspace,'missing'),'--account','a'.repeat(32),'--reference-worker','fictional-hello','--reference-url','https://hello.example.com'];
  const run=()=>spawnSync(process.execPath,args,{cwd:workspace,env:{PATH:''},encoding:'utf8',timeout:5000});
  let result=run();assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),{state:'planned',configuration:{title:input.config.title,intro:input.config.intro,theme:input.config.theme},applied:false,deployed:false});
  args.push('--apply');
  for(const patch of [{preset:'composition'},{deployment:{mode:'preview',hostname:''}},{deployment:{mode:'new-domain',hostname:''}},{deployment:{mode:'existing-domain',hostname:'other.example.com'}}]){
   writeFileSync(spec,JSON.stringify({...input,...patch}));result=run();assert.equal(result.status,1);assert.match(result.stderr,/Hello reference specification|verified existing domain|hostname must match/);
  }
  assert.equal(existsSync(join(workspace,'.private')),false);
 }finally{rmSync(workspace,{recursive:true,force:true});}
});
test('Hello apply preserves configuration when actual readiness fails in a clean reference fixture',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'composer-hello-readiness-')),workspace=join(fixture,'hello'),bin=join(fixture,'bin');mkdirSync(workspace);mkdirSync(bin);
 const git=args=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git(['init','-b','main']);git(['remote','add','origin','https://github.com/loftwah/app-composer-hello.git']);
  const config=join(workspace,'config.json'),original='{"title":"Owner fixture","intro":"Preserve this","theme":"midnight","futureField":true}\n';writeFileSync(config,original);writeFileSync(join(workspace,'.gitignore'),'.private/\nnode_modules/\n');
  git(['add','.']);git(['-c','user.name=Fictional test','-c','user.email=fixture@example.test','commit','-m','Synthetic fixture']);const sha=git(['rev-parse','HEAD']);git(['update-ref','refs/remotes/origin/main',sha]);
  writeFileSync(join(bin,'gh'),'#!/bin/sh\ncase "$*" in\n *commits*) printf "'+sha+'\\n" ;;\n --version) printf "gh fixture\\n" ;;\n *) printf \'{"permissions":{"push":true}}\\n\' ;;\nesac\n',{mode:0o755});
  writeFileSync(join(bin,'pnpm'),'#!/bin/sh\nprintf "12.8.1\\n"\n',{mode:0o755});
  const spec=join(fixture,'spec.json');writeFileSync(spec,JSON.stringify({...valid(),preset:'hello',deployment:{mode:'existing-domain',hostname:'hello.example.com'}}));
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/init-hello.mjs',import.meta.url)),'--spec',spec,'--workspace',workspace,'--account','a'.repeat(32),'--reference-worker','fictional-hello','--reference-url','https://hello.example.com','--apply'],{cwd:workspace,env:{PATH:bin+':/usr/bin:/bin',CODEX_THREAD_ID:'fictional-fixture'},encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.match(result.stderr,/Get Ready has not verified/);assert.equal(readFileSync(config,'utf8'),original);assert.equal(git(['status','--porcelain']),'');
  const receipt=JSON.parse(readFileSync(join(workspace,'.private/readiness.json'),'utf8'));assert.equal(receipt.checks.github.state,'verified');assert.notEqual(receipt.state,'verified');assert.equal(receipt.expiresAt,null);
 }finally{rmSync(fixture,{recursive:true,force:true});}
});
test('three branches and backtracking prune irrelevant answers without executing',()=>{for(const goal of ['composition','showcase','hello']){const a={goal,target:'preview',appearance:'daylight',privacy:'review-first'};assert.equal(visibleQuestions(a).some(q=>q.id==='privacy'),goal==='composition');assert.equal(Object.hasOwn(pruneAnswers(a),'privacy'),goal==='composition');assert.equal(explorerSpec(a).preset,goal);}});
const app=id=>({id,contract:1,runtime:'cloudflare-worker',dataVersion:1,routes:['/'+id],capabilities:['items:read'],configuration:{title:{type:'string'}}});
test('routes, capabilities and expected release identity guard promotion',()=>{const a=app('a'),b=app('b');assert.equal(validateComposition([a,b]),true);assert.throws(()=>validateComposition([a,{...b,routes:['/a']}]));assert.throws(()=>validateComposition([{...a,contract:2}]));assert.throws(()=>validateComposition([{...a,capabilities:['secrets:read']}]));const active={id:'first',apps:[{id:'a',manifest:a}]};assert.throws(()=>guardPromotion(active,{apps:[{id:'a',manifest:a}]},'stale'));assert.equal(guardPromotion(active,{apps:[{id:'a',manifest:a}]},'first'),true);assert.throws(()=>guardPromotion(active,{apps:[{id:'a',manifest:{...a,capabilities:['items:read','features:write']}}]},'first'));});
test('a different provider reuses eligibility contract and unsafe/private items fail closed',()=>{const provider={id:'fictional-notebook',origin:'https://notes.example.com',contract:1};const item={id:'entry-1',provider:provider.id,contract:1,visibility:'public',url:'https://notes.example.com/item/entry-1',image:'https://notes.example.com/media/entry-1'};assert.equal(publicItem(provider,item),item);assert.throws(()=>publicItem(provider,{...item,visibility:'private'}));assert.throws(()=>publicItem(provider,{...item,image:'https://attacker.example/image'}));});
test('unsupported apply targets fail before workspace checks, staging or provider writes',()=>{
 const workspace=mkdtempSync(join(tmpdir(),'composer-apply-preflight-'));
 try{
  const lock=join(workspace,'composition.lock.json');const sentinel='existing composition stays intact\n';writeFileSync(lock,sentinel);
  const cases=[
   [null,/--apply requires a validated --spec/],
   [{...valid(),preset:'hello'},/independently owned Hello/],
   [valid(),/Preview intent does not authorise production writes/],
   [{...valid(),deployment:{mode:'new-domain',hostname:''}},/purchase requires explicit MP authority/],
   [{...valid(),deployment:{mode:'existing-domain',hostname:'other.example.com'}},/operator target has not been verified/]
  ];
  for(const [input,message] of cases){
   const args=[fileURLToPath(new URL('../scripts/compose.mjs',import.meta.url)),'--apply'];
   if(input){const path=join(workspace,'spec.json');writeFileSync(path,JSON.stringify(input));args.push('--spec',path);}
   // No config, receipt, credentials or executable search path: target refusal must come first.
   const result=spawnSync(process.execPath,args,{cwd:workspace,env:{PATH:''},encoding:'utf8',timeout:5000});
   assert.equal(result.error,undefined);assert.equal(result.status,1);assert.match(result.stderr,message);
   assert.equal(readFileSync(lock,'utf8'),sentinel);assert.equal(existsSync(join(workspace,'.private')),false);
  }
 }finally{rmSync(workspace,{recursive:true,force:true});}
});

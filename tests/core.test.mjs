import test from 'node:test';import assert from 'node:assert/strict';import {validateSpec,handoff,visibleQuestions,pruneAnswers,explorerSpec} from '../src/lib/spec.mjs';import {validateComposition,guardPromotion,publicItem} from '../scripts/contracts.mjs';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const valid=()=>({version:1,preset:'composition',config:{title:'A fictional corner',intro:'Only synthetic fixtures',theme:'daylight',layout:'grid'},privacy:'review-first',cards:[],deployment:{mode:'preview',hostname:''},decisions:{}});
test('portable spec is deterministic and hidden card fields do not affect standalone guestbook',()=>{const a=valid();assert.deepEqual(validateSpec(a),validateSpec(a));a.preset='guestbook';a.cards=[{title:'Ignored hidden field',url:'javascript:alert(1)'}];assert.deepEqual(validateSpec(a).cards,[]);assert.match(handoff(valid()),/untrusted configuration data/);});
test('unsafe destinations, schema drift and approval bypass are rejected',()=>{for(const patch of [{version:2},{privacy:'public-without-review'},{config:{...valid().config,title:'\u0000'}},{cards:[{title:'X',url:'javascript:alert(1)'}]}])assert.throws(()=>validateSpec({...valid(),...patch}));const s=validateSpec({...valid(),deployment:{mode:'new-domain',hostname:''}});assert.equal(s.deployment.approval,'purchase-required');});
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

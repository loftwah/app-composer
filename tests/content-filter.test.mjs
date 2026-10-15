import test from 'node:test';import assert from 'node:assert/strict';
import {collectionFilter,collectionRequest,collectionAddress} from '../lib/content-model/site-template/src/lib/collection.mjs';
import {starterModel,emdashSeed} from '../lib/content-model/index.mjs';
import {contentPattern,contentPatternSummaries} from '../lib/content-model/patterns.mjs';
import {contentProjectFiles} from '../lib/content-model/project.mjs';
import {validateSeed} from 'emdash/seed';
test('each supported pattern filters its first unconditional declared choice and indexes only that generated field',()=>{
 for(const {id} of contentPatternSummaries){
  const model=contentPattern(id),field=collectionFilter(model);assert.ok(field);assert.equal(field.when,undefined);
  const seed=JSON.parse(contentProjectFiles(model).files['seed/seed.json']);assert.equal(validateSeed(seed).valid,true);
  assert.deepEqual(seed.collections[0].fields.filter(field=>field.indexed).map(field=>field.slug),[field.key]);
  assert.ok(emdashSeed(model).collections[0].fields.every(field=>field.indexed===undefined));
  for(const choice of field.choices){const result=collectionRequest(model,new URLSearchParams({filter:choice,page:'2',status:'draft',field:'id',where:'untrusted'}));assert.equal(result.valid,true);assert.equal(result.page,2);assert.deepEqual(result.where,{[field.key]:choice});}
 }
});
test('malformed, duplicate and undeclared URL values cannot become collection query filters',()=>{
 for(const query of ['page=0','page=-1','page=1.0','page=01','page=100000','page=1&page=2','filter=Online&filter=Online','filter=Unknown','filter=Online%00','filter[format]=Online','page=Infinity']){
  const params=new URLSearchParams(query),result=collectionRequest(starterModel,params);
  if(query==='filter[format]=Online'){assert.equal(result.valid,true);assert.deepEqual(result.where,{});}else{assert.equal(result.valid,false,query);assert.deepEqual(result.where,{});}
 }
 assert.equal(collectionRequest(starterModel,new URLSearchParams('page=99999')).page,99999);
 assert.deepEqual(collectionRequest(starterModel,new URLSearchParams('filter=')).where,{});
});
test('conditional selects and repeating-row choices are never exposed as public filter controls',()=>{
 const model={fields:[{key:'hidden',type:'select',when:{field:'format',equals:'Online'},choices:['Private-looking choice']},{key:'rows',type:'repeater',fields:[{key:'nested',type:'select',choices:['Nested']}]}]};
 assert.equal(collectionFilter(model),null);assert.equal(collectionRequest(model,new URLSearchParams()).valid,true);assert.equal(collectionRequest(model,new URLSearchParams('filter=Nested')).valid,false);
});
test('native pagination preserves exact Unicode/special-character filter values and returns to page one without a page parameter',()=>{
 const choice='Café & repair + <fictional>',model={fields:[{key:'category',type:'select',choices:[choice]}]};
 for(const page of [1,2,99999]){const address=collectionAddress(page,choice),url=new URL(address,'https://example.test');assert.equal(url.hash,'#content');assert.equal(url.searchParams.get('filter'),choice);assert.equal(url.searchParams.has('page'),page>1);const result=collectionRequest(model,url.searchParams);assert.equal(result.valid,true);assert.equal(result.page,page);assert.deepEqual(result.where,{category:choice});}
 assert.equal(collectionAddress(1),'/#content');assert.equal(collectionAddress(2),'/?page=2#content');
});

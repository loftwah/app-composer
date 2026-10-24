import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
// Exact installed EmDash 1.2.0 runtime validator; revisit on a dependency update.
import {nativeFieldSchema} from './fixtures/emdash-runtime.mjs';
import {validateSeed} from 'emdash/seed';
import {validateContentModel,validateModelValues,visibleModelFields,emdashSeed,contentModelHandoff,starterModel} from '../lib/content-model/index.mjs';
const sample=()=>structuredClone(starterModel);
test('portable field structure validates against the actual installed EmDash seed implementation',()=>{
 const model=validateContentModel(sample()),seed=emdashSeed(model),check=validateSeed(seed);assert.equal(check.valid,true,JSON.stringify(check));assert.equal(seed.collections[0].routable,false);assert.deepEqual(seed.collections[0].supports,['drafts','revisions']);assert.equal(seed.collections[0].fields.find(field=>field.slug==='materials').validation.subFields.length,2);assert.doesNotMatch(JSON.stringify(seed),/when|group|token|secret/);assert.match(contentModelHandoff(model),/Native EmDash admin is not claimed to hide conditional fields/);
});
test('model import refuses unknown authority, reserved fields, nesting, duplicate keys and circular/invalid conditions',()=>{
 for(const change of [m=>m.version=2,m=>m.token='fictional-secret',m=>m.fields[0].key='__proto__',m=>m.fields[1].key=m.fields[0].key,m=>m.fields[0].type='script',m=>m.fields[0].when={field:'format',equals:'Online'},m=>m.fields[3].required=true,m=>m.fields[3].when.equals='Missing',m=>m.fields[4].fields[0].type='repeater',m=>m.fields[4].limit=999,m=>m.fields[2].choices=['Same','Same']]){const model=sample();change(model);assert.throws(()=>validateContentModel(model));}
 const oversized=sample();oversized.fields=Array.from({length:13},(_,i)=>({...oversized.fields[0],key:'field_'+i}));assert.throws(()=>validateContentModel(oversized));
});
test('the same model hides inactive values, validates repeaters and refuses unsafe links before content use',()=>{
 const model=sample(),values={title:'A fictional workshop',description:'Synthetic data only',format:'In person',join_link:'javascript:ignored-inactive-value',materials:[{item:'Paper',note:'Recycled'}]};
 assert.equal(visibleModelFields(model,values).some(field=>field.key==='join_link'),false);assert.equal(Object.hasOwn(validateModelValues(model,values),'join_link'),false);
 assert.throws(()=>validateModelValues(model,{...values,format:'Online'}),/HTTPS/);assert.equal(validateModelValues(model,{...values,format:'Online',join_link:'https://example.com/join'}).join_link,'https://example.com/join');
 for(const change of [v=>v.extra='unknown',v=>v.title='',v=>v.materials=[{item:'',note:'Required'}],v=>v.materials=[{item:'Paper',script:'x'}],v=>v.materials=Array(7).fill({item:'Paper'}),v=>v.format='Unknown']){const input=structuredClone(values);change(input);assert.throws(()=>validateModelValues(model,input));}
});
test('actual native EmDash CLI applies the compiled model to an exclusive fictional SQLite database',t=>{
 const model=sample();model.fields[0].defaultValue='Fictional native default';model.fields[2].defaultValue='Online';model.fields[0].validation={maxLength:80};model.fields.push({key:'seats',label:'Seats',type:'integer',required:false,group:model.groups[1],validation:{min:1,max:50},defaultValue:12});
 const root=mkdtempSync(join(tmpdir(),'composer-content-model-')),seedPath=join(root,'model.json'),database=join(root,'model.db');t.after(()=>rmSync(root,{recursive:true,force:true}));writeFileSync(seedPath,JSON.stringify(emdashSeed(model)));
 const output=execFileSync(process.execPath,['node_modules/emdash/dist/cli/index.mjs','seed',seedPath,'--database',database,'--cwd',root,'--on-conflict','error','--no-content'],{encoding:'utf8',timeout:30000,env:{PATH:process.env.PATH,HOME:root,TMPDIR:root}});assert.match(output,/seed|collection/i);assert.ok(readFileSync(database).length>0);
 // Read-only inspection checks the actual persisted native schema, not only JSON acceptance.
 const db=new DatabaseSync(database,{readOnly:true});try{const rows=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();assert.ok(rows.some(row=>row.name==='ec_workshops'));const columns=db.prepare("PRAGMA table_info(ec_workshops)").all();for(const name of ['title','description','format','join_link','materials'])assert.ok(columns.some(column=>column.name===name));const defaults=db.prepare('SELECT slug, default_value FROM _emdash_fields WHERE default_value IS NOT NULL').all();assert.equal(JSON.parse(defaults.find(row=>row.slug==='title').default_value),'Fictional native default');assert.equal(JSON.parse(defaults.find(row=>row.slug==='format').default_value),'Online');const limits=db.prepare('SELECT slug, validation FROM _emdash_fields').all();assert.deepEqual(JSON.parse(limits.find(row=>row.slug==='title').validation),{maxLength:80});assert.deepEqual(JSON.parse(limits.find(row=>row.slug==='seats').validation),{min:1,max:50});}finally{db.close();}
});

test('accepted models roundtrip with normalised choices and false boolean defaults',()=>{
 const input=sample();input.fields[2].choices=[' In person ','Online '];input.fields[3].when.equals='Online ';const clean=validateContentModel(input);assert.deepEqual(validateContentModel(clean),clean);assert.equal(clean.fields[3].when.equals,'Online');assert.doesNotThrow(()=>emdashSeed(clean));assert.ok(visibleModelFields(clean,{format:'Online'}).some(field=>field.key==='join_link'));
 const boolean=sample();boolean.fields[2]={key:'online',label:'Online?',type:'boolean',required:false,group:'Useful details'};boolean.fields[3].when={field:'online',equals:false};assert.ok(Object.hasOwn(validateModelValues(boolean,{title:'Fictional workshop'}),'join_link'));
});

test('optional typed values and repeater rows satisfy actual native EmDash value schemas',()=>{
 const model=sample();model.fields=[{key:'count',label:'Count',type:'integer',required:false,group:model.groups[0]},{key:'choice',label:'Choice',type:'select',required:false,group:model.groups[0],choices:['One','Two']},{key:'enabled',label:'Enabled',type:'boolean',required:false,group:model.groups[0]},{key:'note',label:'Note',type:'text',required:false,group:model.groups[0],when:{field:'enabled',equals:false}},{key:'rows',label:'Rows',type:'repeater',required:false,group:model.groups[0],limit:2,fields:[{key:'count',label:'Count',type:'integer',required:false},{key:'choice',label:'Choice',type:'select',required:false,choices:['One','Two']}]}];
 for(const enabled of [undefined,null,'',false]){const values=validateModelValues(model,{enabled,rows:[{}]});assert.equal(values.enabled,false);assert.ok(Object.hasOwn(values,'note'));assert.equal(values.count,null);assert.equal(values.choice,null);for(const field of emdashSeed(model).collections[0].fields)assert.ok(nativeFieldSchema(field).safeParse(values[field.slug]).success,field.slug);}
});
test('native reserved collection and field names are refused before export',()=>{
 for(const collection of ['users','content','relations','reorder'])assert.throws(()=>validateContentModel({...sample(),collection}));
 for(const key of ['primary_byline_id','scheduled_at','deleted_at','version','terms','bylines']){const input=sample();input.fields[0].key=key;assert.throws(()=>validateContentModel(input));}
});
test('the actual formatted export and compact saved draft can reopen under the same byte cap',()=>{
 const input=sample();input.fields=Array.from({length:12},(_,i)=>({key:'rows_'+i,label:'A bounded repeated group',type:'repeater',required:false,group:input.groups[0],limit:12,fields:Array.from({length:6},(_,j)=>({key:'choice_'+j,label:'A choice field',type:'select',required:false,choices:Array.from({length:8},(_,k)=>String(k)+'x'.repeat(59))}))}));
 const accepted=validateContentModel(input);assert.ok(Buffer.byteLength(JSON.stringify(accepted,null,2))>32768);for(const spacing of [undefined,2])assert.deepEqual(validateContentModel(JSON.parse(JSON.stringify(accepted,null,spacing))),accepted);
 const large=structuredClone(input);for(const field of large.fields)for(const sub of field.fields)sub.choices=sub.choices.map(choice=>choice.replaceAll('x','界'));assert.throws(()=>validateContentModel(large),/64 KiB/);
});

test('typed starting values survive export/native validation and apply only to omitted new-entry values',()=>{
 const model=sample();model.fields[0].defaultValue='Fictional default workshop';model.fields[1].defaultValue='A fictional starting description';model.fields[2].defaultValue='Online';model.fields[3].defaultValue='https://example.com/join';model.fields.push({key:'seats',label:'Seats',type:'integer',required:false,group:model.groups[1],defaultValue:0},{key:'featured',label:'Featured',type:'boolean',required:false,group:model.groups[1],defaultValue:true});
 const clean=validateContentModel(model),seed=emdashSeed(clean);assert.deepEqual(validateContentModel(clean),clean);assert.equal(validateSeed(seed).valid,true);
 const omitted=validateModelValues(clean,{});assert.equal(omitted.title,'Fictional default workshop');assert.equal(omitted.format,'Online');assert.equal(omitted.join_link,'https://example.com/join');assert.equal(omitted.seats,0);assert.equal(omitted.featured,true);
 for(const field of seed.collections[0].fields.filter(field=>Object.hasOwn(field,'defaultValue'))){assert.equal(nativeFieldSchema(field).parse(undefined),omitted[field.slug]);assert.ok(nativeFieldSchema(field).safeParse(omitted[field.slug]).success);}
 const overrides=validateModelValues(clean,{title:'An explicit title',description:'',format:'In person',join_link:'javascript:inactive',seats:0,featured:false});assert.equal(overrides.title,'An explicit title');assert.equal(overrides.description,null);assert.equal(overrides.seats,0);assert.equal(overrides.featured,false);assert.equal(Object.hasOwn(overrides,'join_link'),false);
 assert.equal(validateModelValues(clean,{join_link:null}).join_link,null);assert.equal(validateModelValues(clean,{join_link:''}).join_link,null);assert.throws(()=>validateModelValues(clean,{title:''}),/required/);assert.throws(()=>validateModelValues(clean,{format:''}),/required/);
 // Existing published records do not acquire default values or new visibility.
 assert.equal(visibleModelFields(clean,{}).some(field=>field.key==='join_link'),false);assert.equal(visibleModelFields(clean,{format:null}).some(field=>field.key==='join_link'),false);
});

test('invalid, unsafe, mismatched and repeater starting values refuse before seed/project output',()=>{
 for(const [index,value] of [[0,null],[0,{}],[0,' '],[0,'x'.repeat(241)],[1,'x'.repeat(2001)],[2,'Not a choice'],[3,'javascript:alert(1)'],[3,'https://user:password@example.com'],[4,[]]]){const model=sample();model.fields[index].defaultValue=value;assert.throws(()=>validateContentModel(model));assert.throws(()=>emdashSeed(model));}
 for(const [type,value] of [['boolean','false'],['integer','0'],['integer',1.1],['integer',1000001]]){const model=sample();model.fields=[{key:'value',label:'Value',type,required:false,group:model.groups[0],defaultValue:value}];assert.throws(()=>validateContentModel(model));}
 const sub=sample();sub.fields[4].fields[0].defaultValue='No row defaults';assert.throws(()=>validateContentModel(sub),/top-level/);
 const old=sample();assert.deepEqual(validateContentModel(old),old);assert.equal(emdashSeed(old).collections[0].fields.some(field=>Object.hasOwn(field,'defaultValue')),false);
});

test('creator limits share omitted defaults, value validation and actual native schema boundaries',()=>{
 const model=sample();model.fields[0].validation={maxLength:80};model.fields[1].validation={maxLength:300};model.fields.push({key:'seats',label:'Seats',type:'integer',required:false,group:model.groups[1],validation:{min:1,max:50},defaultValue:12});
 const clean=validateContentModel(model);assert.deepEqual(validateContentModel(JSON.parse(JSON.stringify(clean))),clean);assert.equal(validateSeed(emdashSeed(clean)).valid,true);assert.equal(validateModelValues(clean,{title:'Fictional class',format:'In person'}).seats,12);
 for(const seats of [1,50]){const values=validateModelValues(clean,{title:'x'.repeat(80),description:'y'.repeat(300),format:'In person',seats});for(const field of emdashSeed(clean).collections[0].fields)if(Object.hasOwn(values,field.slug))assert.ok(nativeFieldSchema(field).safeParse(values[field.slug]).success,field.slug);}
 for(const [name,value] of [['title','x'.repeat(81)],['description','y'.repeat(301)],['seats',0],['seats',51],['seats',1.5]]){assert.throws(()=>validateModelValues(clean,{title:'Fictional class',format:'In person',[name]:value}));const native=emdashSeed(clean).collections[0].fields.find(field=>field.slug===name);assert.equal(nativeFieldSchema(native).safeParse(value).success,false);}
 const cleared=validateModelValues(clean,{title:'Fictional class',description:'',format:'In person',seats:null});assert.equal(cleared.description,null);assert.equal(cleared.seats,null);const invalidDefault=structuredClone(model);invalidDefault.fields.at(-1).defaultValue=0;assert.throws(()=>validateContentModel(invalidDefault),/between 1 and 50/);invalidDefault.fields.at(-1).defaultValue=12;invalidDefault.fields[0].defaultValue='x'.repeat(81);assert.throws(()=>validateContentModel(invalidDefault),/at most 80/);
});

test('malformed, widening, unsupported and repeating-row limits refuse before output while old models retain their shape',()=>{
 for(const validation of [{},{maxLength:0},{maxLength:241},{maxLength:1.5},{maxLength:'80'},{min:0},{pattern:'arbitrary-code'},null,[]]){const model=sample();model.fields[0].validation=validation;assert.throws(()=>validateContentModel(model));assert.throws(()=>emdashSeed(model));}
 for(const validation of [{min:2,max:1},{min:-1000001},{max:1000001},{min:1.5},{max:null},{maxLength:20}]){const model=sample();model.fields[0].type='integer';model.fields[0].validation=validation;assert.throws(()=>validateContentModel(model));}
 for(const index of [2,3,4]){const model=sample();model.fields[index].validation={maxLength:40};assert.throws(()=>validateContentModel(model));}const rows=sample();rows.fields[4].fields[0].validation={maxLength:40};assert.throws(()=>validateContentModel(rows),/top-level/);
 const old=sample();assert.deepEqual(validateContentModel(old),old);assert.deepEqual(emdashSeed(old).collections[0].fields[0].validation,{maxLength:240});for(const validation of [{min:0},{max:0},{min:-20,max:0}]){const model=sample();model.fields[0].type='integer';model.fields[0].validation=validation;assert.deepEqual(validateContentModel(model).fields[0].validation,validation);}
});

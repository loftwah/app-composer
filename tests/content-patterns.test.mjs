import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';
import {validateSeed} from 'emdash/seed';
// Exact installed native 1.2.0 validator, pinned/reviewed alongside content-model tests.
import {n as nativeFieldSchema} from '../node_modules/emdash/dist/zod-generator-BQilAboC.mjs';
import {contentPatternSummaries,contentPattern,contentPatternSample} from '../lib/content-model/patterns.mjs';
import {validateContentModel,validateModelValues,emdashSeed} from '../lib/content-model/index.mjs';

test('every reviewed content pattern and fictional example passes actual native seed and field validation',()=>{
 for(const {id} of contentPatternSummaries){const model=contentPattern(id),values=contentPatternSample(id),seed=emdashSeed(model);assert.deepEqual(validateContentModel(model),model);assert.equal(validateSeed(seed).valid,true,id);assert.deepEqual(validateModelValues(model,values),values);for(const field of seed.collections[0].fields)assert.equal(nativeFieldSchema(field).safeParse(values[field.slug]).success,true,id+':'+field.slug);}
 const first=contentPattern('projects');first.fields[0].label='Changed locally';assert.notEqual(contentPattern('projects').fields[0].label,'Changed locally');const example=contentPatternSample('projects');example.credits[0].name='Changed';assert.notEqual(contentPatternSample('projects').credits[0].name,'Changed');assert.throws(()=>contentPattern('__proto__'));assert.throws(()=>contentPatternSample('unknown'));
});

test('pattern conditions remove inactive values and invalid example edits remain rejected',()=>{
 for(const [id,controller,disabled,conditional] of [['workshops','format','In person','join_link'],['projects','stage','In progress','project_link'],['directory','include_website',false,'website'],['briefs','starting_point','New idea','existing_site']]){
  const values=contentPatternSample(id);assert.ok(Object.hasOwn(values,conditional));values[controller]=disabled;values[conditional]='javascript:inactive-fictional-value';assert.equal(Object.hasOwn(validateModelValues(contentPattern(id),values),conditional),false);
 }
 const values=contentPatternSample('directory');values.opening[0].hours='';assert.throws(()=>validateModelValues(contentPattern('directory'),values),/required/);
});

test('one actual native CLI seed creates all four pattern schemas in exclusive fictional storage',t=>{
 const root=mkdtempSync(join(tmpdir(),'composer-pattern-seed-')),database=join(root,'patterns.db'),seed=join(root,'patterns.json');t.after(()=>rmSync(root,{recursive:true,force:true}));const models=contentPatternSummaries.map(pattern=>contentPattern(pattern.id));writeFileSync(seed,JSON.stringify({version:'1',meta:{name:'Fictional content patterns'},collections:models.flatMap(model=>emdashSeed(model).collections)}));
 execFileSync(process.execPath,['node_modules/emdash/dist/cli/index.mjs','seed',seed,'--database',database,'--cwd',root,'--on-conflict','error','--no-content'],{env:{PATH:process.env.PATH,HOME:root,TMPDIR:root},stdio:'pipe',timeout:30000});const db=new DatabaseSync(database,{readOnly:true});try{for(const model of models){const columns=db.prepare('PRAGMA table_info(ec_'+model.collection+')').all().map(column=>column.name);for(const field of model.fields)assert.ok(columns.includes(field.key),model.collection+':'+field.key);}}finally{db.close();}
});

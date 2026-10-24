import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {calendarDatePattern,isCalendarDate,calendarDateLabel} from '../lib/content-model/calendar-date.mjs';
import {validateContentModel,validateModelValues,emdashSeed,starterModel} from '../lib/content-model/index.mjs';
import {contentProjectFiles} from '../lib/content-model/project.mjs';
import {nativeFieldSchema} from './fixtures/emdash-runtime.mjs';
import {validateSeed} from 'emdash/seed';
const model=()=>({schema:'app-composer.content-model',version:1,collection:'events',label:'Fictional events',groups:['Event'],fields:[{key:'day',label:'Event day',type:'date',group:'Event',required:false,defaultValue:'2028-02-29'}]});
test('calendar days share the actual native Gregorian rule, including century and year boundaries',()=>{
 const field=emdashSeed(model()).collections[0].fields[0],native=nativeFieldSchema(field);assert.equal(field.type,'string');assert.equal(field.validation.pattern,calendarDatePattern);assert.equal(validateSeed(emdashSeed(model())).valid,true);
 for(const value of ['0001-01-01','0400-02-29','1600-02-29','2000-02-29','2028-02-29','9999-12-31']){assert.equal(isCalendarDate(value),true,value);assert.equal(native.safeParse(value).success,true,value);assert.equal(validateModelValues(model(),{day:value}).day,value);}
 for(const value of ['0000-01-01','0100-02-29','1900-02-29','2100-02-29','2026-02-29','2028-04-31','2028-06-31','2028-11-31','2028-00-01','2028-13-01','2028-01-00','2028-01-32','2028-2-09','28-02-29','10000-01-01','2028-02-29T00:00:00Z','2028-02-29\n',' 2028-02-29','29/02/2028','<script>x</script>',20280229,{},false]){assert.equal(isCalendarDate(value),false,JSON.stringify(value));assert.equal(native.safeParse(value).success,false,JSON.stringify(value));assert.throws(()=>validateModelValues(model(),{day:value}));}
 // Independent UTC date arithmetic over a complete Gregorian 400-year cycle.
 for(let year=1800;year<2200;year++)for(let month=1;month<=12;month++){const last=new Date(Date.UTC(year,month,0)).getUTCDate();for(const day of [1,last,last+1]){const value=[year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');assert.equal(isCalendarDate(value),day<=last,value);assert.equal(native.safeParse(value).success,day<=last,value);}}
});
test('date defaults never replace an explicit clear and dates cannot leak into unvalidated repeater rows',()=>{
 const input=model();assert.equal(validateModelValues(input,{}).day,'2028-02-29');for(const day of ['',null])assert.equal(validateModelValues(input,{day}).day,null);assert.equal(nativeFieldSchema(emdashSeed(input).collections[0].fields[0]).parse(null),null);
 input.fields[0].required=true;assert.throws(()=>validateModelValues(input,{day:null}),/required/);assert.equal(validateModelValues(input,{}).day,'2028-02-29');
 input.fields[0].defaultValue='2100-02-29';assert.throws(()=>validateContentModel(input),/calendar date/);assert.throws(()=>contentProjectFiles(input));
 const nested=structuredClone(starterModel);nested.fields.find(field=>field.type==='repeater').fields[0].type='date';assert.throws(()=>validateContentModel(nested),/top-level/);
 const limits=model();limits.fields[0].validation={maxLength:10};assert.throws(()=>validateContentModel(limits),/top-level text/);
 const conditional=model();conditional.fields.unshift({key:'enabled',label:'Has a day',type:'boolean',required:false,group:'Event'});conditional.fields[1].when={field:'enabled',equals:true};assert.equal(Object.hasOwn(validateModelValues(conditional,{enabled:false,day:'impossible'}),'day'),false);assert.throws(()=>validateModelValues(conditional,{enabled:true,day:'impossible'}),/calendar date/);
});
test('public day labels and semantic values stay independent of the server timezone',()=>{
 for(const zone of ['America/Los_Angeles','Pacific/Kiritimati','Australia/Melbourne']){const result=execFileSync(process.execPath,['--input-type=module','-e',"import {calendarDateLabel} from './lib/content-model/calendar-date.mjs';console.log(calendarDateLabel('2028-02-29'))"],{encoding:'utf8',env:{PATH:process.env.PATH,TZ:zone}}).trim();assert.equal(result,'29 February 2028');}
 assert.equal(calendarDateLabel('2026-02-29'),null);assert.equal(calendarDateLabel(null),null);assert.equal(calendarDateLabel('0001-01-01'),'1 January 1');
 const result=contentProjectFiles(model()),seed=JSON.parse(result.files['seed/seed.json']);assert.equal(seed.collections[0].fields[0].widget,'composer-content-fields:date');assert.equal(emdashSeed(model()).collections[0].fields[0].widget,undefined);assert.ok(result.provenance.files['src/lib/calendar-date.mjs']);assert.ok(result.provenance.files['src/lib/calendar-date.d.mts']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {entryPath,entryTitle,entryDescription} from '../lib/content-model/site-template/src/lib/entry.mjs';
import {starterModel} from '../lib/content-model/index.mjs';
import {contentProjectFiles} from '../lib/content-model/project.mjs';

test('entry addresses use bounded stable IDs and refuse path/query/HTML injection',()=>{
 for(const id of ['01K7ABCD0123456789ABCDEFGHJ','fictional-entry-01','a_b-2'])assert.equal(entryPath(id),'/entries/'+id);
 for(const id of [undefined,null,0,'','../outside','a/b','a?status=draft','a#private','<script>','bad\nvalue','a'.repeat(121)])assert.equal(entryPath(id),null);
 const first={id:'fictional-entry-01',title:'Before'},second={...first,title:'After'};
 assert.equal(entryPath(first.id),entryPath(second.id));
});
test('entry metadata uses unconditional plain content, with bounded Unicode-safe descriptions',()=>{
 const model=structuredClone(starterModel);
 assert.equal(entryTitle(model,{title:'  Fictional café  '}),'Fictional café');assert.equal(entryTitle(model,{title:5}),'Untitled entry');
 assert.equal(entryDescription(model,{title:'Title',description:'  A workshop\n with friends.  '}),'A workshop with friends.');
 assert.equal(entryDescription(model,{title:'Title'}),'Published entry in Community workshops.');
 model.fields.find(field=>field.key==='description').when={field:'format',equals:'Online'};
 assert.equal(entryDescription(model,{title:'Title',description:'Conditional private detail'}),'Published entry in Community workshops.');
 delete model.fields.find(field=>field.key==='description').when;
 const description=entryDescription(model,{description:'🌏'.repeat(180)});assert.equal(Array.from(description).length,160);assert.equal(description,'🌏'.repeat(159)+'…');
});
test('generated entry source, shared reader and navigation remain fixed code with exact captured provenance',()=>{
 const model={...structuredClone(starterModel),label:'<script>fictional</script>'},created=contentProjectFiles(model);
 for(const name of ['src/pages/entries/[id]/index.astro','src/components/ContentFields.astro','src/layouts/ContentLayout.astro','src/lib/entry.mjs']){
  assert.ok(created.files[name]);assert.equal(created.files[name].includes(Buffer.from(model.label)),false);
  assert.ok(created.provenance.files[name]);
 }
 // Actual EmDash runtime/privacy/navigation acceptance belongs to the isolated
 // native fixture, rather than source-pattern assertions pretending to prove it.
});

import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {tagValues} from '../src/lib/miniapp-tag-fields.mjs';
const id='00000000-0000-4000-8000-000000000001';
const item={id,label:'Fictional tag',description:'One\r\ntwo',citationURL:'https://example.test/source',citationLabel:'Reference',relatedURL:'',relatedLabel:'',status:'hidden'};
const collection={version:1,revision:2,items:[item]};
test('actual native component renders clean selected fields, retained private drafts, unavailable and pending states',async()=>{
 await mkdir(new URL('../.private/',import.meta.url),{recursive:true});const directory=await mkdtemp(new URL('../.private/tag-ui-',import.meta.url));
 try{
  const source=(await readFile(new URL('../src/plugins/tags-admin.tsx',import.meta.url),'utf8')).replace("'../lib/miniapp-tag-fields.mjs'",JSON.stringify(new URL('../src/lib/miniapp-tag-fields.mjs',import.meta.url).href));
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});const target=directory+'/component.mjs';await writeFile(target,compiled.outputText);const {Tags,tagUnsaved}=await import(pathToFileURL(target));
  const props={collection,change(){},busy:false,save:async()=>false};
  const draft={id,from:tagValues(item),value:tagValues(item)};assert.equal(tagUnsaved(draft),false);
  const selected=renderToStaticMarkup(React.createElement(Tags,{...props,draft}));assert.match(selected,/value="Fictional tag"/);assert.match(selected,/One\ntwo/);assert.match(selected,/<button type="submit">Save tag<\/button>/);assert.doesNotMatch(selected,/The saved tag|was removed/);
  const unsaved={...draft,value:{...draft.value,label:'PRIVATE RETAINED EDIT'}};assert.equal(tagUnsaved(unsaved),true);
  const changed=renderToStaticMarkup(React.createElement(Tags,{...props,collection:{...collection,revision:3,items:[{...item,label:'Fictional newer label'}]},draft:unsaved}));assert.match(changed,/PRIVATE RETAINED EDIT/);assert.match(changed,/Fictional newer label/);assert.match(changed,/Compare the saved tag/);assert.match(changed,/<button type="submit" disabled="">Save tag/);
  const removed=renderToStaticMarkup(React.createElement(Tags,{...props,collection:{...collection,items:[]},draft:unsaved}));assert.match(removed,/was removed/);assert.match(removed,/PRIVATE RETAINED EDIT/);assert.doesNotMatch(removed,/>Keep my edits</);
  const unavailable=renderToStaticMarkup(React.createElement(Tags,{...props,collection:null,draft:unsaved}));assert.match(unavailable,/PRIVATE RETAINED EDIT/);assert.match(unavailable,/Nothing was changed/);assert.doesNotMatch(unavailable,/<form/);
  const ambiguous={id:null,from:null,value:{...tagValues(item),status:'draft'},blocked:'ambiguous'};assert.equal(tagUnsaved(ambiguous),true);const uncertain=renderToStaticMarkup(React.createElement(Tags,{...props,draft:ambiguous}));assert.match(uncertain,/could not be confirmed/);assert.doesNotMatch(uncertain,/>Keep my edits</);assert.match(uncertain,/<button type="submit" disabled="">Save draft/);
  for(const [field,bad,help,explanation] of [['citationURL','https://fictional:credential@example.test/','ca-tag-citationURL-help',/full HTTPS address without embedded credentials/],['relatedURL','javascript:alert(1)','ca-tag-relatedURL-help',/full HTTPS address without embedded credentials/]]){
   const invalid={...draft,value:{...draft.value,[field]:bad}};const html=renderToStaticMarkup(React.createElement(Tags,{...props,draft:invalid}));
   const control=html.match(new RegExp('<input\\b[^>]*\\bname="'+field+'"[^>]*>'))?.[0];assert(control,'Invalid field remains rendered');assert.match(control,/aria-invalid="true"/);assert.match(control,new RegExp('aria-describedby="'+help+'"'));assert.match(html,explanation);assert.match(html,/<details class="ca-disclosure ca-tags" open="">/);assert.match(html,/<details class="ca-disclosure ca-tag-references" open="">/);assert.match(html,/<\/details><p role="status" data-tag-reference-error[^>]*>/);assert(control.includes('value="'+bad+'"'),'Invalid value remains editable');assert.match(html,/<button type="submit" disabled="">Save tag/);assert.match(html,/<button type="button" disabled="">Preview without saving/);
   const repaired=renderToStaticMarkup(React.createElement(Tags,{...props,draft:{...invalid,value:tagValues(item)}}));assert.doesNotMatch(repaired,/aria-invalid="true"/);assert.match(repaired,/<button type="submit">Save tag/);assert.match(repaired,/<button type="button">Preview without saving/);
  }
  const pending=renderToStaticMarkup(React.createElement(Tags,{...props,busy:true,draft}));assert.match(pending,/<input[^>]*disabled=""[^>]*value="Fictional tag"/);assert.match(pending,/<button type="submit" disabled="">/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

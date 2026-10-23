import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import ts from 'typescript';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {achievementValues} from '../src/lib/miniapp-achievements.mjs';
const id='00000000-0000-4000-8000-000000000001';
const item={id,title:'Fictional milestone',description:'One\r\ntwo',date:'2026',url:'https://example.test/',icon:'code',status:'hidden'};
const collection={version:1,revision:2,items:[item]};
test('actual native component renders clean selected fields, retained private drafts, unavailable and pending states',async()=>{
 await mkdir(new URL('../.private/',import.meta.url),{recursive:true});const directory=await mkdtemp(new URL('../.private/achievement-ui-',import.meta.url));
 try{
  const source=(await readFile(new URL('../src/plugins/achievements-admin.tsx',import.meta.url),'utf8')).replace(/(['"])\.\.\/lib\/miniapp-achievements\.mjs\1/,JSON.stringify(new URL('../src/lib/miniapp-achievements.mjs',import.meta.url).href));
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});const target=directory+'/component.mjs';await writeFile(target,compiled.outputText);const {Achievements,achievementUnsaved}=await import(pathToFileURL(target));
  const props={collection,change(){},busy:false,save:async()=>false};
  const draft={id,from:achievementValues(item),value:achievementValues(item)};assert.equal(achievementUnsaved(draft),false);
  const selected=renderToStaticMarkup(React.createElement(Achievements,{...props,draft}));assert.match(selected,/value="Fictional milestone"/);assert.match(selected,/One\ntwo/);assert.match(selected,/<button type="submit">Save achievement<\/button>/);assert.doesNotMatch(selected,/The saved achievement|was removed/);
  const unsaved={...draft,value:{...draft.value,title:'PRIVATE RETAINED EDIT'}};assert.equal(achievementUnsaved(unsaved),true);
  const changed=renderToStaticMarkup(React.createElement(Achievements,{...props,collection:{...collection,revision:3,items:[{...item,title:'Fictional newer title'}]},draft:unsaved}));assert.match(changed,/PRIVATE RETAINED EDIT/);assert.match(changed,/Fictional newer title/);assert.match(changed,/Compare the saved achievement/);assert.match(changed,/<button type="submit" disabled="">Save achievement/);
  const removed=renderToStaticMarkup(React.createElement(Achievements,{...props,collection:{...collection,items:[]},draft:unsaved}));assert.match(removed,/was removed/);assert.match(removed,/PRIVATE RETAINED EDIT/);assert.doesNotMatch(removed,/>Keep my edits</);
  const unavailable=renderToStaticMarkup(React.createElement(Achievements,{...props,collection:null,draft:unsaved}));assert.match(unavailable,/PRIVATE RETAINED EDIT/);assert.match(unavailable,/Nothing was changed/);assert.doesNotMatch(unavailable,/<form/);
  const ambiguous={id:null,from:null,value:{...achievementValues(item),status:'draft'},blocked:'ambiguous'};assert.equal(achievementUnsaved(ambiguous),true);const uncertain=renderToStaticMarkup(React.createElement(Achievements,{...props,draft:ambiguous}));assert.match(uncertain,/could not be confirmed/);assert.doesNotMatch(uncertain,/>Keep my edits</);assert.match(uncertain,/<button type="submit" disabled="">Save draft/);
  for(const [field,bad,help,explanation] of [['date','2026-02-30','ca-achievement-date-help',/real calendar day \(YYYY-MM-DD\)/],['url','https://fictional:credential@example.test/','ca-achievement-url-help',/full HTTPS address without embedded credentials/]]){
   const invalid={...draft,value:{...draft.value,[field]:bad}};const html=renderToStaticMarkup(React.createElement(Achievements,{...props,draft:invalid}));
   const control=html.match(new RegExp('<input\\b[^>]*\\bname="'+field+'"[^>]*>'))?.[0];assert(control,'Invalid field remains rendered');assert.match(control,/aria-invalid="true"/);assert.match(control,new RegExp('aria-describedby="'+help+'"'));assert.match(html,explanation);assert(control.includes('value="'+bad+'"'),'Invalid value remains editable');assert.match(html,/<button type="submit" disabled="">Save achievement/);assert.match(html,/<button type="button" disabled="">Preview without saving/);
   const repaired=renderToStaticMarkup(React.createElement(Achievements,{...props,draft:{...invalid,value:achievementValues(item)}}));assert.doesNotMatch(repaired,/aria-invalid="true"/);assert.match(repaired,/<button type="submit">Save achievement/);assert.match(repaired,/<button type="button">Preview without saving/);
  }
  const pending=renderToStaticMarkup(React.createElement(Achievements,{...props,busy:true,draft}));assert.match(pending,/<input[^>]*disabled=""[^>]*value="Fictional milestone"/);assert.match(pending,/<button type="submit" disabled="">/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

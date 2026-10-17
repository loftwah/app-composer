import test from 'node:test';
import assert from 'node:assert/strict';
import {initDraftDescription,initDraftReplacePrompt} from '../src/lib/handoff-draft.mjs';

test('a device with no Init draft is handed the decisions without a confirmation',()=>{
 for(const absent of [null,undefined])assert.equal(initDraftReplacePrompt(absent),null);
});

test('an existing Init draft is named only from its readable saved title',()=>{
 const stored=JSON.stringify({version:1,config:{title:'  Our corner  '},preset:'composition'});
 assert.equal(initDraftDescription(stored),'the saved Init draft “Our corner”');
 const prompt=initDraftReplacePrompt(stored);
 assert.match(prompt,/Replace the saved Init draft “Our corner” on this device/);
 assert.match(prompt,/Choose Cancel, then Download decisions to keep both/);
 assert.equal(initDraftReplacePrompt('{}'),'Replace the saved Init draft on this device with these decisions? Choose Cancel, then Download decisions to keep both.');
});

test('unreadable or untitled drafts keep the generic wording and never leak file text',()=>{
 for(const raw of ['{not json','null','[]',JSON.stringify({config:{title:'   '}}),JSON.stringify({config:{title:12}})])assert.equal(initDraftDescription(raw),'the saved Init draft');
 assert.match(initDraftReplacePrompt('{not json'),/Replace the saved Init draft on this device/);
});

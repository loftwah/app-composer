import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blockedStorageNotice,createSaveStatus} from '../src/lib/explorer-status.mjs';

function view(){
 const status={textContent:'',hidden:true},message={textContent:''};
 return {status,message,save:createSaveStatus(status,message)};
}

test('a refused write raises a standing notice and hides it again when saving works',()=>{
 const {status,save}=view();
 assert.equal(status.hidden,true);
 assert.equal(status.textContent,'');
 save.refused();
 assert.equal(save.blocked(),true);
 assert.equal(status.hidden,false);
 assert.equal(status.textContent,blockedStorageNotice);
 save.saved();
 assert.equal(save.blocked(),false);
 assert.equal(status.hidden,true);
 assert.equal(status.textContent,'');
});

test('an action message cannot replace the reason the path is not saved',()=>{
 const {status,message,save}=view();
 save.refused();
 save.action('Safe defaults proposed. No execution or approval occurred.');
 assert.match(message.textContent,/Safe defaults proposed/);
 assert.equal(status.textContent,blockedStorageNotice,'the blocked-storage notice survives later feedback');
 assert.equal(status.hidden,false);
 save.action('Decisions handed to Init. The draft there is already loaded.');
 assert.equal(status.textContent,blockedStorageNotice);
});

test('an action that needed blocked storage reports that nothing was saved',()=>{
 const {message,save}=view();
 save.refused();
 save.action('Init could not be given these decisions.',{saved:false});
 assert.match(message.textContent,/Init could not be given these decisions\. Nothing was saved on this device\./);
});

test('the download named by the notice is confirmed without claiming storage worked',()=>{
 const {message,save}=view();
 save.refused();
 save.action('Decisions file downloaded. Keep it with your own notes.');
 assert.equal(message.textContent,'Decisions file downloaded. Keep it with your own notes.');
 assert.doesNotMatch(message.textContent,/Nothing was saved/);
});

test('the page uses the shared standing notice and never reuses it as a message',()=>{
 const client=readFileSync(new URL('../src/lib/explorer-client.ts',import.meta.url),'utf8');
 assert.match(client,/createSaveStatus\(document\.querySelector\('#save-status'\)!,message\)/);
 assert.match(client,/saveStatus\.refused\(\)/);
 assert.doesNotMatch(client,/storageWarning|storageBlocked/,'the local flag that lost the notice is gone');
 assert.match(readFileSync(new URL('../src/pages/explore.astro',import.meta.url),'utf8'),/id="save-status"/);
});

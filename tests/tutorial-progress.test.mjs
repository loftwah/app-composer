import test from 'node:test';
import assert from 'node:assert/strict';
import {readTutorialProgress} from '../src/lib/tutorial-progress.mjs';
const checks=['workspace-0','ready-0'], lessons=['workspace','ready'];
test('restores only self-reported known learning observations',()=>{
 const value={version:1,checked:['workspace-0'],lesson:'ready'};
 assert.deepEqual(readTutorialProgress(JSON.stringify(value),checks,lessons),value);
});
test('refuses malformed, future and foreign progress without granting readiness',()=>{
 for(const value of [null,{}, {version:2,checked:[],lesson:'ready'},
  {version:1,checked:['deployed'],lesson:'ready'},
  {version:1,checked:['ready-0','ready-0'],lesson:'ready'},
  {version:1,checked:[],lesson:'unknown'},
  {version:1,checked:[],lesson:'ready',credentials:'secret'},
  {version:1,checked:[],lesson:'ready',verified:true}]) {
  assert.equal(readTutorialProgress(JSON.stringify(value),checks,lessons),null);
 }
 assert.equal(readTutorialProgress('{',checks,lessons),null);
});

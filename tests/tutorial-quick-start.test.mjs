import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaStudioQuickStart, validateQuickStart } from '../src/lib/tutorial-quick-start.mjs';

test('Media Studio prompts cover distinct journeys and preserve ownership boundaries', () => {
  assert.deepEqual(mediaStudioQuickStart.prompts.map(p => p.id), ['build', 'add', 'explain', 'make']);
  for (const prompt of mediaStudioQuickStart.prompts) {
    assert.match(prompt.text, /my own accounts and resources/i);
    assert.match(prompt.text, /credentials/i);
    assert.match(prompt.text, /https:\/\/github.com\/loftwah\/composer-media-studio/);
  }
  assert.match(mediaStudioQuickStart.prompts[0].text, /provider 403/);
  assert.match(mediaStudioQuickStart.prompts[1].text, /without overwriting/i);
  assert.throws(() => validateQuickStart({title:'x',summary:'x',prompts:[{id:'x',label:'x',text:''}]}));
  assert.throws(() => validateQuickStart({title:'x',summary:'x',prompts:[{id:'x',label:'x',text:'x'},{id:'x',label:'y',text:'y'}]}));
});

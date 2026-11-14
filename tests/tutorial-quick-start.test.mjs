import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstAppQuickStart, mediaStudioQuickStart, validateQuickStart } from '../src/lib/tutorial-quick-start.mjs';

test('Media Studio prompts cover distinct journeys and preserve ownership boundaries', () => {
  assert.deepEqual(mediaStudioQuickStart.prompts.map(p => p.id), ['build', 'add', 'explain', 'make']);
  for (const prompt of mediaStudioQuickStart.prompts) {
    assert.match(prompt.text, /my own accounts and resources/i);
    assert.match(prompt.text, /credentials/i);
    assert.match(prompt.text, /https:\/\/github.com\/loftwah\/composer-media-studio/);
  }
  assert.match(mediaStudioQuickStart.prompts[0].text, /provider 403/);
  assert.match(mediaStudioQuickStart.prompts[1].text, /without overwriting/i);
  assert.throws(() => validateQuickStart({title:'x',summary:'x',links:[{label:'guide',href:'/ready'}],prompts:[{id:'x',label:'x',text:''}]}));
  assert.throws(() => validateQuickStart({title:'x',summary:'x',links:[{label:'guide',href:'/ready'}],prompts:[{id:'x',label:'x',text:'x'},{id:'x',label:'y',text:'y'}]}));
});

test('creative prompt describes a real source-to-clip path without granting reuse or spend', () => {
  const prompt = mediaStudioQuickStart.prompts.find(p => p.id === 'make');
  assert.match(prompt.text, /poster-study-fighter/);
  assert.match(prompt.text, /QXaKw_fL9cZenKCg/);
  assert.match(prompt.text, /not a licence to import/i);
  assert.match(prompt.text, /actual provider, input, estimated cost and remaining project allowance/i);
  assert.match(prompt.text, /at most the one requested generation/i);
  assert.match(prompt.text, /outcome is unknown[\s\S]*do not submit it again/i);
  assert.match(prompt.text, /not gameplay/i);
});

test('build prompt names installation settings and current caption limits', () => {
  const text = mediaStudioQuickStart.prompts.find(p => p.id === 'build').text;
  for (const name of ['PUBLIC_ORIGIN', 'MONTHLY_ALLOWANCE_MICRO', 'WOODHOUSE_SHARE', 'COMPOSER_ORIGIN', 'FAL_KEY']) assert.ok(text.includes(name), name);
  assert.match(text, /manually timed caption cues/i);
  assert.match(text, /do not automatically transcribe or burn captions/i);
  assert.match(text, /separate opt-in and rights confirmation/i);
});


test('first-app quick start uses its own sources and distinguishes read-only inspection', () => {
  assert.deepEqual(firstAppQuickStart.prompts.map(p => p.id), ['build', 'existing', 'explain']);
  assert.ok(firstAppQuickStart.links.some(link => link.href === '/ready'));
  assert.ok(!firstAppQuickStart.links.some(link => link.href.includes('media-studio')));
  assert.match(firstAppQuickStart.prompts[0].text, /own GitHub and Cloudflare accounts/i);
  assert.match(firstAppQuickStart.prompts[0].text, /preview or exported spec is not a deployment/i);
  assert.match(firstAppQuickStart.prompts[1].text, /inspection read-only/i);
  assert.match(firstAppQuickStart.prompts[2].text, /Do not change files, accounts or cloud resources/i);
});

test('quick-start links reject unsafe schemes and protocol-relative destinations', () => {
  const valid = {title:'x',summary:'x',prompts:[{id:'x',label:'x',text:'x'}]};
  for (const href of ['javascript:alert(1)', '//example.com', 'https://user:pass@example.com']) {
    assert.throws(() => validateQuickStart({...valid, links:[{label:'test',href}]}), /safe, labelled links/);
  }
  assert.doesNotThrow(() => validateQuickStart({...valid,links:[{label:'guide',href:'/ready'}]}));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { promptModules, renderPrompt, readPromptDraft, promptStorageKey } from '../src/lib/prompt-library.ts';
import { readyTasks } from '../src/lib/ready-handoff.ts';

test('setup/check/resume reuse the maintained engine handoffs without instruction drift', () => {
  for (const id of ['setup', 'check', 'resume']) {
    const result = renderPrompt(id);
    assert.ok(result.text.startsWith(readyTasks[id].prompt));
    assert.deepEqual(result.missing, []);
    assert.match(result.text, /inspect the currently selected authorised project folder/);
  }
  assert.match(renderPrompt('check').text, /Do not install tools, create repositories, change origins or DNS, or deploy/);
  assert.match(renderPrompt('resume').text, /a saved green receipt grants no permission/);
});

test('the public agent assessment is read-only, grounded in the real URL and stops before changes', () => {
  const item = promptModules.find(entry => entry.id === 'assess');
  assert.ok(item, 'assess module is published');
  assert.equal(item.category, 'Get started');
  assert.equal(item.support, 'Ready to use');
  assert.equal(item.related, 'setup');
  assert.ok(item.prerequisites.some(entry => entry.href === '/agent'));
  const result = renderPrompt('assess');
  assert.deepEqual(result.missing, []);
  assert.match(result.text, /Start at https:\/\/composer\.loftwah\.com/);
  assert.match(result.text, /read-only/);
  assert.match(result.text, /supported now, proven only in a bounded local environment, documented but unverified, planned, and unsupported/);
  assert.match(result.text, /recommendation of yes, partly or no/);
  assert.match(result.text, /Never request, print or store passwords, keys, tokens or private records/);
  assert.match(result.text, /Stop before any change and wait for explicit owner authorisation/);
  assert.doesNotMatch(result.text, /\[NEEDED:/);
  const withProject = renderPrompt('assess', { project: '/fictional/field-notes', constraints: 'Keep the current stack' });
  assert.ok(withProject.text.includes('/fictional/field-notes'));
  assert.ok(withProject.text.includes('Keep the current stack'));
  const exact = renderPrompt('assess', { checks: 'go test ./...' });
  assert.ok(exact.text.includes('```sh\ngo test ./...\n```'));
  assert.match(exact.text, /clean Git status does not cover ignored owner drafts/);
  assert.match(exact.text, /difference alone does not authorise re-pinning/);
});

test('completed change and self-use prompts preserve multiline intent and identify missing required answers', () => {
  for (const id of ['change', 'composer']) {
    const missing = renderPrompt(id);
    assert.deepEqual(missing.missing, ['goal']);
    assert.match(missing.text, /\[NEEDED:/);
    const result = renderPrompt(id, { project: '/fictional/field-notes', goal: 'Add a reading list.\nKeep existing entries.', details: '' });
    assert.deepEqual(result.missing, []);
    assert.ok(result.text.includes('Add a reading list.\nKeep existing entries.'));
    assert.doesNotMatch(result.text, /\[NEEDED:|Anything else\?/);
    assert.match(result.text, /Preserve existing work, records, permissions and branding/);
  }
  assert.match(renderPrompt('composer', { goal: 'Add the public prompt desk' }).text, /Identify supplemental agent-authored implementation separately/);
  assert.match(renderPrompt('change', { goal: 'Add a reading list' }).text, /do not migrate it to Composer/);
});

test('templates are explicit, arbitrary module names and inherited input keys are never selected', () => {
  assert.throws(() => renderPrompt('constructor'), /Unknown prompt/);
  assert.throws(() => renderPrompt('__proto__'), /Unknown prompt/);
  const template = renderPrompt('change', { goal: 'Private text' }, { template: true });
  assert.match(template.text, /\[PROJECT\]/);
  assert.match(template.text, /\[GOAL\]/);
  assert.doesNotMatch(template.text, /Private text/);
  assert.deepEqual(renderPrompt('change', Object.create({ goal: 'Inherited' })).missing, ['goal']);
  const result = renderPrompt('change', { goal: 'Safe\u0000 text', details: '<script>alert("fictional")</script>' });
  assert.doesNotMatch(result.text, /\u0000/);
  assert.ok(result.text.includes('<script>alert("fictional")</script>'));
});

test('shared resource modules keep the required operations and authority boundaries', () => {
  for (const id of ['change', 'incident', 'pipeline', 'hook', 'operating-kit']) {
    const item = promptModules.find(item => item.id === id);
    assert.equal(item.resource, id);
    assert.ok(item.prerequisites.length);
    assert.ok(item.result);
    assert.ok(renderPrompt(id, {}, { template: true }).text.length > 600);
  }
  assert.match(renderPrompt('incident').text, /investigation grants no remediation authority/);
  assert.match(renderPrompt('pipeline').text, /do not introduce GitHub Actions/);
  assert.match(renderPrompt('hook').text, /stale or replayed events/);
  assert.match(renderPrompt('stripe').text, /No real charge or production fulfilment is authorised/);
  assert.match(renderPrompt('printful').text, /production order incurs cost/);
  assert.equal(promptModules.find(item => item.id === 'inbox').support, 'Assess and prepare');
});

test('saved prompt details have a separate strict versioned scope and reject corruption', () => {
  const draft = { version: 1, modules: { change: { project: 'Fictional Trail Notes', goal: 'Keep my draft' } } };
  assert.deepEqual(readPromptDraft(JSON.stringify(draft)), draft.modules);
  assert.notEqual(promptStorageKey, 'composer-init');
  for (const value of [null, '', '{}', '[]', 'not-json', JSON.stringify({ ...draft, version: 2 }), JSON.stringify({ version: 1, modules: { constructor: {} } }), JSON.stringify({ version: 1, modules: { change: { apiKey: 'never' } } }), JSON.stringify({ version: 1, modules: { change: { goal: 7 } } }), JSON.stringify({ version: 1, modules: { change: { goal: 'x'.repeat(8001) } } })]) assert.equal(readPromptDraft(value), null);
  assert.equal(readPromptDraft('{"version":1,"modules":{"__proto__":{"goal":"attack"}}}'), null);
});

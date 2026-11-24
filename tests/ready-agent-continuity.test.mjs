// Focused regression for Get Ready host continuity (#1126). A named coding
// agent survives /ready -> /ready/browser-check -> both return links without
// putting an idea, prompt, account or stored state on the URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  agentContextLine,
  browserCheckHref,
  handoffAgent,
  handoffAgentFromParams,
  handoffQuery,
  readyTaskHref,
} from '../src/lib/ready-handoff.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const params = (...entries) => new URLSearchParams(entries);

test('only one allowlisted host id survives; unknown, repeated and generic fall back', () => {
  for (const id of ['opencode', 'codex', 'claude-code', 'cursor', 'antigravity']) {
    assert.equal(handoffAgentFromParams(params(['agent', id])), id);
  }
  assert.equal(handoffAgentFromParams(new URLSearchParams()), 'any');
  assert.equal(handoffAgentFromParams(params(['agent', 'any'])), 'any');
  assert.equal(handoffAgentFromParams(params(['agent', 'bogus'])), 'any');
  assert.equal(handoffAgentFromParams(params(['agent', 'codex'], ['agent', 'cursor'])), 'any');
  assert.equal(handoffAgentFromParams(params(['agent', 'codex'], ['task', 'browser'])), 'codex');
  assert.equal(handoffAgent(null), 'any');
  assert.equal(handoffAgent('Codex'), 'any');
});

test('one canonical query builder keeps generic links byte-identical', () => {
  assert.equal(handoffQuery(), '');
  assert.equal(handoffQuery('setup', 'any'), '?task=setup');
  assert.equal(handoffQuery('browser', 'codex'), '?task=browser&agent=codex');
  assert.equal(handoffQuery(undefined, 'cursor'), '?agent=cursor');
  assert.equal(browserCheckHref(), '/ready/browser-check');
  assert.equal(browserCheckHref('any'), '/ready/browser-check');
  assert.equal(browserCheckHref('codex'), '/ready/browser-check?agent=codex');
  assert.equal(readyTaskHref('browser', 'any'), '/ready?task=browser#agent-start');
  assert.equal(readyTaskHref('setup', 'any'), '/ready?task=setup#agent-start');
  assert.equal(readyTaskHref('browser', 'codex'), '/ready?task=browser&agent=codex#agent-start');
  assert.equal(readyTaskHref('setup', 'codex'), '/ready?task=setup&agent=codex#agent-start');
});

test('only the host id is exposed and nothing is persisted', () => {
  const query = handoffQuery(undefined, 'codex');
  assert.deepEqual([...new URLSearchParams(query.slice(1))], [['agent', 'codex']]);
  const source = read('src/lib/ready-handoff.ts');
  assert.ok(source.includes('conceptContextBlock'), 'the idea stays in the prompt, not the URL');
  assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(source));
});

test('a named host still adds only the existing context line', () => {
  assert.equal(agentContextLine('any'), '');
  assert.equal(
    agentContextLine('codex'),
    'I’m using Codex. Check which tools this session can use in my chosen project. Report what you verified and what remains unverified.',
  );
});

test('Astro and the client use the shared validation and query builder', () => {
  const handoff = read('src/components/ReadyHandoff.astro');
  assert.ok(handoff.includes('handoffAgentFromParams(Astro.url.searchParams)'));
  assert.ok(handoff.includes('browserCheckHref(selectedAgent)'));
  assert.ok(handoff.includes('selected={id===selectedAgent}'));
  assert.ok(handoff.includes("agentContextLine(selectedAgent)+'\\n\\n'+initial.prompt"));
  assert.ok(handoff.includes('const agentId=handoffAgent(agentSelector?.value);'));
  assert.ok(handoff.includes('browserCheckAnchor.href=browserCheckHref(agentId);'));
  assert.ok(handoff.includes("browserTaskAnchor.href=readyTaskHref('browser',agentId);"));
  const ready = read('src/pages/ready.astro');
  assert.ok(ready.includes("readyTaskHref('browser', handoffAgentFromParams(Astro.url.searchParams))"));

  const browserCheck = read('src/pages/ready/browser-check.astro');
  assert.ok(browserCheck.includes('handoffAgentFromParams(Astro.url.searchParams)'));
  assert.ok(browserCheck.includes("readyTaskHref('browser', agent)"));
  assert.ok(browserCheck.includes("readyTaskHref('setup', agent)"));
  assert.ok(browserCheck.includes('Continue to app setup</a>'));
  assert.ok(browserCheck.includes('Back to the browser check in Get Ready</a>'));
});

test('the local Markdown download shares copy gating and keeps private input out of its name', () => {
  const handoff = read('src/components/ReadyHandoff.astro');
  assert.ok(handoff.includes("import { Copy, Download } from '@lucide/astro';"));
  assert.ok(handoff.includes('class="button secondary" data-download-ready disabled'));
  assert.ok(handoff.includes("prompt.closest('details')!.open=true;"));
  assert.ok(handoff.includes('const setDisabled=(value:boolean)=>{button.disabled=value;downloadButton.disabled=value;};'));
  assert.ok(handoff.includes('setDisabled(false);'));
  assert.ok(handoff.includes('catch(error){setDisabled(true);'));

  const download = handoff.slice(handoff.indexOf("downloadButton.addEventListener('click'"));
  assert.ok(download.includes('attempt++;'), 'a clipboard write still in flight is retired');
  assert.ok(download.includes("const text=prompt.textContent??'';"), 'the rendered text is saved verbatim');
  assert.ok(download.includes("new Blob([text],{type:'text/markdown;charset=utf-8'})"));
  assert.ok(download.includes("anchor.download='ready-handoff.md';"), 'one fixed safe filename');
  assert.ok(download.includes('window.setTimeout(()=>URL.revokeObjectURL(url),1000);'));
  assert.ok(!/anchor\.download[^;]*concept/i.test(download));
  assert.ok(!/localStorage|sessionStorage|fetch\(/.test(download));
});

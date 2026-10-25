import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, agentRequestVersion } from '../src/pages/agent.md.ts';
import { publicPagePaths } from '../src/lib/public-pages.mjs';
import { renderPrompt } from '../src/lib/prompt-library.ts';

test('the agent entry is indexable and its Markdown endpoint is versioned', async () => {
  assert.ok(publicPagePaths.includes('/agent'));
  assert.ok(publicPagePaths.includes('/agent.md'));
  const response = await GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /^text\/markdown; charset=utf-8$/);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(response.headers.get('X-Agent-Request-Version'), agentRequestVersion);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  const body = await response.text();
  assert.ok(body.includes(renderPrompt('assess').text));
  assert.match(body, /^# Point your agent at App Composer/m);
  assert.match(body, /Assessment is read-only/);
  assert.match(body, /https:\/\/composer\.loftwah\.com\/setup/);
  assert.match(body, /cannot approve, deploy, merge, spend or read secrets/);
  assert.doesNotMatch(body, /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/);
});

test('the public page routes a visitor to the request, the library and the boundaries', async () => {
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(new URL('../src/pages/agent.astro', import.meta.url), 'utf8');
  assert.match(page, /Point your agent here\./);
  assert.match(page, /renderPrompt\('assess'\)/);
  assert.match(page, /href="\/agent\.md"/);
  assert.match(page, /href="\/prompts#assess"/);
  assert.match(page, /Assessment is read-only|read-only/);
  assert.match(page, /No passwords, keys, tokens or private customer records/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { agentSearchFrontmatter, publicAgentSearch } from '../src/lib/public-agent-search.mjs';

const composer = 'https://composer.loftwah.com';
const prints = 'https://prints.loftwah.com';
const route = (origin, query) => new Request(`${origin}/.well-known/search?q=${encodeURIComponent(query)}`);

test('product questions return canonical Markdown sources for the requested host', async () => {
  for (const [origin, query, source] of [
    [composer, 'What does App Composer do?', '/docs/how-it-works'],
    [composer, 'How do I set up my own coding agent?', '/setup'],
    [composer, 'spin', '/articles/why-we-built-spin'],
    [composer, 'search agent', '/articles/cloudflare-search-for-agents'],
    [prints, 'How do I install Prints Desktop on an Apple Silicon Mac?', '/guide#install'],
    [prints, 'How can I export an original offline?', '/guide#offline'],
    [prints, 'How do I connect Oyster and generate in web Prints?', '/guide#connect'],
  ]) {
    const response = await publicAgentSearch(route(origin, query));
    assert.equal(response.status, 200, query);
    assert.match(response.headers.get('content-type'), /^text\/markdown/);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
    assert.equal(response.headers.get('content-signal'), 'search=yes, ai-input=yes, ai-train=no');
    const body = await response.text();
    assert.ok(body.includes('Source: ' + origin + source), query);
    assert.ok(!body.includes(origin === prints ? composer : prints), query);
  }
});

test('unanswerable queries abstain and the documentation endpoint never opens other routes', async () => {
  const response = await publicAgentSearch(route(prints, 'Can Prints detect a lunar eclipse?'));
  assert.match(await response.text(), /No matching source/);
  assert.equal(await publicAgentSearch(new Request(prints + '/api/private')), null);
  assert.equal(await publicAgentSearch(route('https://preview.example.org', 'agent')), null);
  const guide = await publicAgentSearch(new Request(prints + '/agent.md'));
  assert.ok((await guide.text()).startsWith(agentSearchFrontmatter(prints)));
  assert.match(agentSearchFrontmatter(composer), /composer\.loftwah\.com\/\.well-known\/search/);
});

test('bounded QUERY bodies and unsupported methods return explicit statuses', async () => {
  const url = composer + '/.well-known/search';
  const query = (body, type) => publicAgentSearch(new Request(url, {
    method: 'QUERY', headers: { 'Content-Type': type }, body,
  }));
  for (const [body, type] of [
    ['coding agent', 'text/plain; charset=utf-8'],
    ['{"q":"coding agent"}', 'application/json'],
  ]) {
    const response = await query(body, type);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /Source: https:\/\/composer.loftwah.com\/setup/);
  }
  assert.equal((await query('{', 'application/json')).status, 400);
  assert.equal((await query('x'.repeat(1025), 'text/plain')).status, 413);
  assert.equal((await query('x', 'text/html')).status, 415);
  assert.equal((await publicAgentSearch(route(composer, ''))).status, 400);
  assert.equal((await publicAgentSearch(new Request(url, { method: 'POST' }))).status, 405);
});

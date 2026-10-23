import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, appendFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIntegrationAdapter } from '../lib/platform/integration-adapter.mjs';

const key = 'fictional-routing-key-123456789012';
const base = { operationId: 'op-one', appId: 'field-notes', teamId: 'fictional-a', environment: 'staging', sourceSha: 'a'.repeat(40), releaseId: 'release-one', outcome: 'verified', summary: 'Fictional release verified', planDigest: 'b'.repeat(64), policyRevision: 'policy-1' };
const destination = channel => ({ url: `https://events.pagerduty.com/v2/${channel === 'change' ? 'change/' : ''}enqueue`, token: key });
const ack = body => new Response(JSON.stringify({ status: 'success', ...(body.dedup_key ? { dedup_key: body.dedup_key } : { id: 'change-fixture' }) }), { status: 202 });

// This is a real local HTTP receiver with inspectable disk receipts, not a vendor account.
test('local receiver separates deployment change from incident trigger and verified recovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'composer-platform-integrations-'));
  let server;
  try {
    const log = join(root, 'received.ndjson');
    server = createServer(async (request, response) => {
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        assert.equal(body.routing_key, key);
        const { routing_key, ...publicBody } = body;
        await appendFile(log, JSON.stringify({ path: request.url, body: publicBody }) + '\n', { mode: 0o600 });
        response.writeHead(202, { 'Content-Type': 'application/json' });
        response.end(await ack(body).text());
      } catch {
        response.writeHead(400); response.end();
      }
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const adapter = createIntegrationAdapter({ allowLoopbackFixture: true, destinations: {
      change: { url: `${origin}/v2/change/enqueue`, token: key }, incident: { url: `${origin}/v2/enqueue`, token: key },
    } });
    const change = await adapter.deliverChange(base);
    const trigger = await adapter.deliverIncident({ ...base, outcome: 'failed', incidentId: 'probe-one', action: 'trigger' });
    const resolved = await adapter.deliverIncident({ ...base, operationId: 'op-recovery', outcome: 'recovered', incidentId: 'probe-one', action: 'resolve' });
    assert.deepEqual([change.status, trigger.status, resolved.status], ['accepted', 'accepted', 'accepted']);
    assert.equal(trigger.dedupKey, resolved.dedupKey);
    assert.notEqual(trigger.eventId, resolved.eventId);
    const rows = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(rows.map(row => row.path), ['/v2/change/enqueue', '/v2/enqueue', '/v2/enqueue']);
    assert.equal(rows[0].body.event_action, undefined);
    assert.equal(rows[1].body.event_action, 'trigger');
    assert.equal(rows[2].body.event_action, 'resolve');
    assert.equal(rows[0].body.payload.custom_details.sourceSha, base.sourceSha);
    assert.equal((await readFile(log, 'utf8')).includes(key), false);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(root, { recursive: true, force: true });
    await assert.rejects(stat(root), { code: 'ENOENT' });
  }
});

test('imports cannot select endpoints, credentials, callback URLs, actions or extra data', async () => {
  let calls = 0;
  const selected = { change: destination('change') };
  const adapter = createIntegrationAdapter({ destinations: selected, fetchImpl: async () => { calls++; throw new Error('never'); } });
  selected.change.url = 'https://attacker.invalid/v2/change/enqueue';
  for (const injected of [{ url: 'https://attacker.invalid' }, { token: key }, { callback: 'https://attacker.invalid' }, { data: 'secret' }, { action: 'trigger' }, { summary: 'x'.repeat(513) }, { sourceSha: 'latest' }]) {
    await assert.rejects(adapter.deliverChange({ ...base, ...injected }), TypeError);
  }
  assert.equal(calls, 0);
});

test('host destination is copied once, rejects redirects and never follows injected acknowledgement URLs', async () => {
  let seen;
  const selected = { change: destination('change') };
  const adapter = createIntegrationAdapter({ destinations: selected, fetchImpl: async (url, options) => {
    seen = { url, options }; return new Response('', { status: 302, headers: { Location: 'https://attacker.invalid' } });
  } });
  selected.change.url = 'https://attacker.invalid/v2/change/enqueue';
  const receipt = await adapter.deliverChange(base);
  assert.equal(seen.url, destination('change').url);
  assert.equal(seen.options.redirect, 'error');
  assert.equal(receipt.status, 'unknown');
  for (const url of ['http://127.0.0.1:123/v2/change/enqueue', 'http://example.org/v2/change/enqueue', 'https://key@example.org/v2/change/enqueue', 'https://example.org/v2/change/enqueue?token=x', 'https://example.org/v2/enqueue']) {
    assert.throws(() => createIntegrationAdapter({ destinations: { change: { url, token: key } } }), TypeError);
  }
});

test('a receipt-lost connection is unknown after exactly one attempt with stable event identity', async () => {
  let attempts = 0;
  const adapter = createIntegrationAdapter({ destinations: { change: destination('change') }, fetchImpl: async () => {
    attempts++; throw new Error(`received then disconnected ${key}`);
  } });
  const first = await adapter.deliverChange(base);
  assert.equal(first.status, 'unknown');
  assert.equal(attempts, 1);
  assert.equal(JSON.stringify(first).includes(key), false);
  const reviewed = createIntegrationAdapter({ destinations: { change: destination('change') }, fetchImpl: async (_url, options) => ack(JSON.parse(options.body)) });
  assert.equal((await reviewed.deliverChange({ ...base, summary: 'Updated description' })).eventId, first.eventId);
  assert.notEqual((await reviewed.deliverChange({ ...base, releaseId: 'release-two' })).eventId, first.eventId);
});

test('transport rejection, oversized or mismatched acknowledgements preserve accurate outcomes', async () => {
  for (const [response, status] of [[new Response('no', { status: 403 }), 'rejected'], [new Response('busy', { status: 429 }), 'rejected'], [new Response('timed out', { status: 408 }), 'unknown'], [new Response('conflict', { status: 409 }), 'unknown'], [new Response('server failed', { status: 500 }), 'unknown'], [new Response('x'.repeat(5000), { status: 202 }), 'unknown'], [new Response('{}', { status: 202 }), 'unknown']]) {
    let calls = 0;
    const adapter = createIntegrationAdapter({ destinations: { change: destination('change') }, fetchImpl: async () => { calls++; return response; } });
    assert.equal((await adapter.deliverChange(base)).status, status);
    assert.equal(calls, 1);
  }
  const adapter = createIntegrationAdapter({ destinations: { incident: destination('incident') }, fetchImpl: async () => new Response(JSON.stringify({ status: 'success', dedup_key: 'other-team' }), { status: 202 }) });
  assert.equal((await adapter.deliverIncident({ ...base, action: 'trigger', incidentId: 'one' })).status, 'unknown');
  await assert.rejects(adapter.deliverIncident(base), TypeError);
});

test('timeout aborts one transport attempt without retrying or exposing remote text', async () => {
  let calls = 0;
  const adapter = createIntegrationAdapter({ timeoutMs: 10, destinations: { change: destination('change') }, fetchImpl: async (_url, { signal }) => {
    calls++;
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error(key)), { once: true }));
  } });
  const receipt = await adapter.deliverChange(base);
  assert.equal(receipt.status, 'unknown');
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(receipt).includes(key), false);
});

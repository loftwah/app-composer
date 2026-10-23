#!/usr/bin/env node
// Local-only qualification: never loads provider credentials, deploys, or sends vendor events.
import assert from 'node:assert/strict';
import { mkdtemp, appendFile, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { createIntegrationAdapter } from '../lib/platform/integration-adapter.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === '--dependencies' && resolve(args[1]) === args[1])) throw new Error('Usage: node scripts/platform-qualification.mjs [--dependencies /absolute/existing/node_modules]');
const modules = args.length ? args[1] : join(workspace, 'node_modules');
let server;
let database;
const report = { schema: 'composer.platform-qualification/1', observedAt: new Date().toISOString(), runtime: { node: process.version, platform: process.platform, arch: process.arch }, dependencies: {}, scope: 'Local fictional adapter/database fixture; no Composer Node/celld service or provider qualification.' };
const root = await mkdtemp(join(tmpdir(), 'composer-platform-qualification-'));
try {
  report.sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim();
  for (const name of ['emdash', '@emdash-cms/cloudflare', '@astrojs/cloudflare', 'astro', 'wrangler', '@astrojs/node']) {
    try { report.dependencies[name] = JSON.parse(await readFile(join(modules, name, 'package.json'), 'utf8')).version; }
    catch (error) { if (error.code !== 'ENOENT') throw error; report.dependencies[name] = null; }
  }
  const config = JSON.parse(await readFile(join(workspace, 'wrangler.jsonc'), 'utf8'));
  report.bindings = {
    d1: config.d1_databases.map(row => row.binding), r2: config.r2_buckets.map(row => row.binding),
    kv: config.kv_namespaces.map(row => row.binding), services: config.services.map(row => row.binding),
    rateLimits: config.ratelimits.map(row => row.name), cron: config.triggers.crons,
    compatibilityDate: config.compatibility_date, compatibilityFlags: config.compatibility_flags,
    previewServiceBindings: config.env.preview.services.length,
  };
  try { await import('cloudflare:workers'); throw new Error('Expected an unsupported Node module scheme.'); }
  catch (error) { assert.equal(error.code, 'ERR_UNSUPPORTED_ESM_URL_SCHEME'); report.unchangedNodeWorkerImport = 'blocked: cloudflare:workers unsupported by native Node'; }

  if (report.dependencies.emdash === '1.2.0') {
    const packageFile = await realpath(join(modules, 'emdash', 'package.json'));
    const requireInstalled = createRequire(packageFile);
    const { createDialect } = await import(pathToFileURL(join(dirname(packageFile), 'dist/db/sqlite.mjs')).href);
    const { Kysely } = await import(pathToFileURL(requireInstalled.resolve('kysely')).href);
    database = new Kysely({ dialect: createDialect({ url: join(root, 'fictional.sqlite') }) });
    await database.schema.createTable('fictional_notes').addColumn('team', 'text', col => col.primaryKey()).addColumn('note', 'text', col => col.notNull()).execute();
    await database.insertInto('fictional_notes').values([{ team: 'a', note: 'initial-a' }, { team: 'b', note: 'initial-b' }]).execute();
    const exported = await database.selectFrom('fictional_notes').selectAll().where('team', '=', 'a').execute();
    await database.updateTable('fictional_notes').set({ note: 'later-b' }).where('team', '=', 'b').execute();
    try {
      await database.transaction().execute(async transaction => {
        await transaction.updateTable('fictional_notes').set({ note: 'partial-a' }).where('team', '=', 'a').execute();
        throw new Error('controlled interruption');
      });
    } catch (error) { assert.equal(error.message, 'controlled interruption'); }
    await database.transaction().execute(async transaction => {
      await transaction.deleteFrom('fictional_notes').where('team', '=', 'a').execute();
      await transaction.insertInto('fictional_notes').values(exported).execute();
    });
    assert.deepEqual((await database.selectFrom('fictional_notes').selectAll().orderBy('team').execute()).map(row => ({ ...row })), [{ team: 'a', note: 'initial-a' }, { team: 'b', note: 'later-b' }]);
    report.nodeDatabase = { adapter: 'emdash/db/sqlite', version: report.dependencies.emdash, createReadTransactionRollbackScopedRestore: 'passed', teamBRetainedLaterRecord: true, fullComposerSchemaOrMediaRestore: 'not exercised' };
    await database.destroy(); database = null;
  } else report.nodeDatabase = { status: 'unavailable: existing EmDash 1.2.0 dependency required; nothing installed' };

  const receiptFile = join(root, 'received.ndjson');
  const fixtureKey = 'fictional-local-fixture-key-123456';
  server = createServer(async (request, response) => {
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of request) { length += chunk.length; if (length > 8192) throw new Error('fixture payload too large'); chunks.push(chunk); }
      const { routing_key, ...body } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.equal(routing_key, fixtureKey);
      assert.ok(['/v2/change/enqueue', '/v2/enqueue'].includes(request.url));
      await appendFile(receiptFile, JSON.stringify({ endpoint: request.url, ...body }) + '\n', { mode: 0o600 });
      if (body.payload.custom_details.outcome === 'ack-lost') { request.socket.destroy(); return; }
      response.writeHead(202, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'success', ...(body.dedup_key ? { dedup_key: body.dedup_key } : { id: 'local-change-receipt' }) }));
    } catch { response.writeHead(400); response.end(); }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const adapter = createIntegrationAdapter({ allowLoopbackFixture: true, destinations: {
    change: { url: `${origin}/v2/change/enqueue`, token: fixtureKey }, incident: { url: `${origin}/v2/enqueue`, token: fixtureKey },
  } });
  const candidate = { operationId: 'fixture-release', teamId: 'fictional-a', appId: 'fictional-notes', environment: 'staging', sourceSha: report.sourceSha, releaseId: 'fixture-release-one', outcome: 'verified', summary: 'Fictional scoped release verified', policyRevision: 'fixture-policy-1' };
  const change = await adapter.deliverChange(candidate);
  const triggered = await adapter.deliverIncident({ ...candidate, outcome: 'failed', incidentId: 'fixture-probe', action: 'trigger' });
  const resolved = await adapter.deliverIncident({ ...candidate, outcome: 'recovered', incidentId: 'fixture-probe', action: 'resolve' });
  const unknown = await adapter.deliverChange({ ...candidate, operationId: 'fixture-ack-lost', outcome: 'ack-lost' });
  const receiver = (await readFile(receiptFile, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual([change.status, triggered.status, resolved.status, unknown.status], ['accepted', 'accepted', 'accepted', 'unknown']);
  assert.equal(triggered.dedupKey, resolved.dedupKey);
  assert.equal(receiver.length, 4); // The ambiguous event was received once and never automatically retried.
  report.integration = { receiver: 'owned local Node HTTP fixture, not PagerDuty', outcomes: { change, triggered, resolved, unknown }, received: receiver, unknownReceivedExactlyOnce: true, vendorExecution: false };
  report.celld = { candidate: 'v0.6.3', executed: false, status: 'not qualified; no selected celld fleet/object store' };
  report.providers = { EKS: 'not exercised', AKS: 'not exercised', GKE: 'not exercised' };
} finally {
  try {
    if (database) await database.destroy();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  } finally {
    await rm(root, { recursive: true, force: true });
    await assert.rejects(stat(root), { code: 'ENOENT' });
    report.ownedTemporaryRootRemoved = true;
  }
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

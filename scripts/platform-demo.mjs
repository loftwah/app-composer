#!/usr/bin/env node
// Fictional local programme lab. Actual pinned Guestbook code/SQL; simulated admission.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, mkdir, rm, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { managePlatform } from '../src/lib/platform-admin.ts';
import { workspaceForUser, publicStack } from '../src/lib/stacks.mjs';
import { resourceConnection } from '../src/lib/resource-client.ts';
import { appSettings } from '../src/lib/app-settings.mjs';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const guestbook = process.env.COMPOSER_DEMO_GUESTBOOK ? resolve(process.env.COMPOSER_DEMO_GUESTBOOK) : resolve(workspace, '../app-composer-guestbook');
const pin = appSettings.guestbook.source.commit;
const origin = 'https://composer.loftwah.com';
const account = '1003dc1d93af0ebea56b2f1252f89627';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: guestbook, encoding: 'utf8' }).trim();
const escaped = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Select only the exact reviewed default fetch export. Named Worker entrypoints
// remain outside this Node lab; no cloudflare:workers shim is constructed.
export function selectGuestbookFetchModule(source, typescript) {
  const parsed = typescript.createSourceFile(
    'worker.ts', source, typescript.ScriptTarget.Latest, true,
    typescript.ScriptKind.TS,
  );
  assert.equal(parsed.parseDiagnostics.length, 0,
    'The reviewed entrypoint must parse without errors.');
  const namedExport = statement => typescript.isExportDeclaration(statement)
    && statement.exportClause && typescript.isNamedExports(statement.exportClause);
  const forwards = parsed.statements.filter(statement => {
    if (!namedExport(statement) || statement.isTypeOnly || statement.attributes
      || !statement.moduleSpecifier
      || !typescript.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== './app.ts'
      || statement.exportClause.elements.length !== 1) return false;
    const selected = statement.exportClause.elements[0];
    return !selected.isTypeOnly && selected.name.text === 'default'
      && !selected.propertyName;
  });
  const defaultDeclarations = parsed.statements.filter(statement =>
    typescript.isExportAssignment(statement)
    || statement.modifiers?.some(modifier =>
      modifier.kind === typescript.SyntaxKind.DefaultKeyword)
    || (namedExport(statement) && statement.exportClause.elements.some(element =>
      element.name.text === 'default')));
  if (forwards.length === 1 && defaultDeclarations.length === 1) return 'src/app.ts';
  assert.equal(defaultDeclarations.some(statement =>
    typescript.isExportDeclaration(statement)), false,
  'Only the exact ./app.ts default re-export is supported.');
  assert.equal(defaultDeclarations.length, 1,
    'The reviewed entrypoint must expose one default implementation.');
  const cloudflareImport = parsed.statements.some(statement =>
    typescript.isImportDeclaration(statement)
    && typescript.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === 'cloudflare:workers');
  assert.equal(cloudflareImport, false,
    'Node cannot execute this Workers entrypoint; only an exact default re-export from ./app.ts may select the reviewed fetch module.');
  return 'src/worker.ts';
}

function sqliteD1(path) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys=ON');
  const statement = (sql, params = []) => ({ sql, params,
    bind(...values) { return statement(sql, values); },
    async first() { return sqlite.prepare(sql).get(...params) ?? null; },
    async all() { return { success: true, results: sqlite.prepare(sql).all(...params) }; },
    async run() { const changed = sqlite.prepare(sql).run(...params); return { success: true, meta: { changes: Number(changed.changes) } }; },
  });
  const db = { prepare: statement, async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(({ sql, params }) => ({ success: true, results: sqlite.prepare(sql).all(...params) }));
      sqlite.exec('COMMIT'); return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  return { sqlite, db };
}

export async function runPlatformDemo({ serve = false, onReady } = {}) {
  assert.equal(git('rev-parse', 'HEAD'), pin, 'Select the exact reviewed Guestbook source.');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Preserve and separately review Guestbook changes before running.');
  assert.match(pin, /^[a-f0-9]{40}$/, 'The selected composition requires an exact Guestbook source pin.');
  const composition = JSON.parse(await readFile(join(workspace, 'composition.lock.json'), 'utf8'));
  assert.equal(composition.apps.find(app => app.id === 'guestbook')?.commit, pin, 'App settings and the composition lock must select the same exact source.');
  const report = { schema: 'composer.platform-demo/1', observedAt: new Date().toISOString(), composerSource: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(), guestbookSource: pin,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    boundaries: { admission: 'Synthetic trusted-host actors; Access/EmDash login not exercised', guestbook: 'Exact pinned default fetch module over real local HTTP and SQLite; D1/R2 interfaces use local adapters, not workerd', entrypoint: 'Workers entrypoint and named service binding are not exercised by this Node fetch-module lab', composition: 'Actual StackView React SSR in a labelled local wrapper; Astro routing/layout not exercised', provider: 'No external network, provider writes or vendor events' }, checks: {}, http: [] };
  let server, cms, app;
  const previousBuild = globalThis.BUILD_SHA, previousManifest = globalThis.MANIFEST;
  const root = await mkdtemp(join(tmpdir(), 'composer-platform-demo-'));
  try {
    cms = sqliteD1(join(root, 'composer.sqlite')); app = sqliteD1(join(root, 'guestbook.sqlite'));
    for (const name of (await readdir(join(workspace, 'migrations'))).filter(name => name.endsWith('.sql')).sort()) cms.sqlite.exec(await readFile(join(workspace, 'migrations', name), 'utf8'));
    for (const name of (await readdir(join(guestbook, 'migrations'))).filter(name => name.endsWith('.sql')).sort()) app.sqlite.exec(await readFile(join(guestbook, 'migrations', name), 'utf8'));
    const mediaRoot = join(root, 'media'); await mkdir(mediaRoot);
    const mediaPath = key => { assert.match(key, /^[a-zA-Z0-9._/-]+$/); assert.equal(key.includes('..'), false); return join(mediaRoot, key); };
    const media = {
      async put(key, bytes) { const path = mediaPath(key); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); },
      async get(key) { try { return { body: new Blob([await readFile(mediaPath(key))]).stream() }; } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
      async delete(key) { await rm(mediaPath(key), { force: true }); },
    };
    const requireExisting = createRequire(join(workspace, 'package.json'));
    const typescript = await import(pathToFileURL(requireExisting.resolve('typescript')).href);
    const React = await import(pathToFileURL(requireExisting.resolve('react')).href);
    const { renderToStaticMarkup } = await import(pathToFileURL(requireExisting.resolve('react-dom/server')).href);
    const componentPath = join(workspace, 'src/components/StackView.tsx');
    const source = await readFile(componentPath, 'utf8');
    const compiled = typescript.default.transpileModule(source.replace(/import "\.\.\/styles\/stack-view\.css";/, '').replaceAll('"../lib/', '"' + pathToFileURL(join(workspace, 'src/lib/')).href), { compilerOptions: { jsx: typescript.default.JsxEmit.React, module: typescript.default.ModuleKind.ESNext, target: typescript.default.ScriptTarget.ES2022 } }).outputText;
    const rendererFile = join(root, 'stack-view.mjs');
    await writeFile(rendererFile, `import React from ${JSON.stringify(pathToFileURL(requireExisting.resolve('react')).href)};\n` + compiled);
    const { StackView } = await import(pathToFileURL(rendererFile).href);
    report.rendererSourceHash = hash(source);
    report.authoredSourceHashes = Object.fromEntries(await Promise.all(['src/lib/platform-admin.ts', 'src/lib/platform-contract.ts', 'src/lib/platform-guard.ts', 'src/lib/stack-resources.ts', 'src/lib/resource-client.ts', 'scripts/platform-demo.mjs'].map(async path => [path, hash(await readFile(join(workspace, path)))])));
    globalThis.BUILD_SHA = pin;
    globalThis.MANIFEST = JSON.parse(await readFile(join(guestbook, 'app.manifest.json'), 'utf8'));
    const entrySource = await readFile(join(guestbook, 'src/worker.ts'), 'utf8');
    const executedModule = selectGuestbookFetchModule(entrySource, typescript.default);
    const executedBytes = await readFile(join(guestbook, executedModule));
    report.execution = { entrypoint: 'src/worker.ts', entrypointSha256: hash(entrySource), executedModule, executedModuleSha256: hash(executedBytes), exactDefaultReexport: executedModule === 'src/app.ts', namedServiceBinding: 'not-exercised', workersEntrypointRuntime: 'not-exercised' };
    const { default: worker } = await import(pathToFileURL(join(guestbook, executedModule)).href);
    assert.equal(typeof worker?.fetch, 'function', 'The reviewed default module must expose its actual fetch handler.');
    const token = 'fictional-' + crypto.randomUUID();
    const assetTypes = { '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    const asset = async (assetRequest, base = guestbook) => {
      const path = decodeURIComponent(new URL(assetRequest.url).pathname);
      if (!path.startsWith('/brand/') || path.includes('..')) return new Response(null, { status: 404 });
      try { const bytes = await readFile(join(base, 'public', path)); const ext = path.slice(path.lastIndexOf('.')); return new Response(bytes, { headers: { 'Content-Type': assetTypes[ext] ?? 'application/octet-stream' } }); }
      catch (error) { if (error.code === 'ENOENT') return new Response(null, { status: 404 }); throw error; }
    };
    const stackCSS = (await readFile(join(workspace, 'src/styles/stack-theme.generated.css'), 'utf8')) + '\n' + (await readFile(join(workspace, 'src/styles/stack-view.css'), 'utf8')).replace('@import "./stack-theme.generated.css";', '');
    const env = { DB: app.db, MEDIA: media, ASSETS: { fetch: request => asset(request) }, OWNER_API_TOKEN: token, PUBLIC_ORIGIN: origin, RESOURCE_ACCOUNT_ID: account, RESOURCE_ENVIRONMENT: 'production' };
    let loseActivation = false, lostOperation;
    server = createServer(async (incoming, outgoing) => {
      try {
        const chunks = []; let size = 0;
        for await (const chunk of incoming) { size += chunk.length; if (size > 1200000) throw Error('Local request exceeds fixture bound.'); chunks.push(chunk); }
        const url = new URL(incoming.url, origin);
        const method = incoming.method;
        const headers = new Headers(incoming.headers);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        let response;
        if (url.pathname.startsWith('/s/')) {
          const stack = await publicStack(cms.db, url.pathname.slice(3));
          response = stack ? new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:24px auto;padding:0 20px;max-width:1100px;background:#17201b;color:#f4f0e7;font:17px/1.55 system-ui}a{color:inherit}'+stackCSS+'</style><title>' + escaped(stack.document.name) + ' · App Composer</title><p>Local fictional programme: actual StackView SSR; admission and Astro wrapper are simulated.</p>' + renderToStaticMarkup(React.createElement(StackView, { document: stack.document, link: true, titleAs: 'h1', outcomes: { slug: stack.slug, publication: stack.revision, key: 'local-fixture' } })), { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) : new Response(null, { status: 404 });
        } else if (url.pathname.startsWith('/brand/')) response = await asset(new Request(url), workspace);
        else response = await worker.fetch(new Request(url, { method, headers, ...(body ? { body } : {}) }), env, { waitUntil() {} });
        const command = body ? JSON.parse(body) : null;
        report.http.push({ method, path: url.pathname, ...(command?.operationId ? { operationId: command.operationId, action: command.action } : url.searchParams.has('operation') ? { operationId: url.searchParams.get('operation'), action: 'reconcile' } : {}), status: response.status, bodySha256: hash(await response.clone().arrayBuffer().then(bytes => Buffer.from(bytes))) });
        if (loseActivation && method === 'POST' && body && JSON.parse(body).action === 'activate' && response.ok) {
          loseActivation = false; lostOperation = JSON.parse(body).operationId; incoming.socket.destroy(); return;
        }
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch { outgoing.writeHead(500); outgoing.end('Local demo failure.'); }
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    const forward = async request => {
      const url = new URL(request.url); assert.equal(url.origin, origin);
      return fetch(new Request(localOrigin + url.pathname + url.search, { method: request.method, headers: request.headers, redirect: 'error', signal: request.signal, ...(request.body ? { body: await request.arrayBuffer() } : {}) }));
    };
    const runtime = { DB: cms.db, PUBLIC_ORIGIN: origin, RESOURCE_ACCOUNT_ID: account, RESOURCE_ENVIRONMENT: 'production', GUESTBOOK_OWNER_TOKEN: token, GUESTBOOK: { fetch: forward }, PLATFORM_PUBLIC_FETCH: forward };
    const actors = [{ id: 'fictional-platform-team-a', role: 50, name: 'Fictional Atlas operator' }, { id: 'fictional-platform-team-b', role: 50, name: 'Fictional Beacon operator' }];
    const teams = await Promise.all(actors.map(actor => workspaceForUser(cms.db, actor)));
    const call = (actor, input, reading = false) => managePlatform({ user: actor, input, request: new Request(origin + '/_emdash/api/plugins/composer-stacks/platform', { method: reading ? 'GET' : 'POST', headers: { Origin: origin, 'X-EmDash-Request': '1' } }) }, runtime);
    const profile = { enabled: true, allowedRecipes: ['guestbook'], environments: ['preview'], dataClasses: ['synthetic'], maxApplications: 2, reviewRequired: false };
    for (let i = 0; i < 2; i++) assert.equal((await call(actors[i], { action: 'configure', workspace: teams[i].id, expectedRevision: 0, profile })).ok, true);
    const requested = name => ({ version: 1, name, recipe: 'guestbook', environment: 'preview', dataClass: 'synthetic', location: 'provider-default', quota: 'small' });
    const created = [];
    for (let i = 0; i < 2; i++) {
      const key = crypto.randomUUID(), request = requested(i ? 'Fictional Beacon' : 'Fictional Atlas');
      const result = await call(actors[i], { action: 'submit', workspace: teams[i].id, key, request });
      assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.requests[0].status, 'complete', JSON.stringify(result.requests[0])); created.push(result.requests[0]);
      const before = app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations').get().n;
      const repeat = await call(actors[i], { action: 'submit', workspace: teams[i].id, key, request });
      assert.equal(repeat.requests[0].id, created[i].id); assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations').get().n, before);
    }
    assert.notEqual(created[0].resources[0].resource, created[1].resources[0].resource);
    report.checks.twoTeamCreateAndDuplicateSubmission = true;
    assert.equal((await call(actors[1], { action: 'list', workspace: teams[0].id }, true)).code, 'FORBIDDEN');
    const foreign = await resourceConnection(runtime, teams[1].id).status(created[0].resources[0].resource).then(() => 'unexpected', () => 'denied'); assert.equal(foreign, 'denied');
    report.checks.crossTeamPortalAndRealAppScopeDenied = true;
    const resourceA = created[0].resources[0].resource, resourceB = created[1].resources[0].resource;
    const bBefore = app.sqlite.prepare('SELECT * FROM guestbook_resources WHERE id=?').get(resourceB);
    const updated = await call(actors[0], { action: 'update', workspace: teams[0].id, id: created[0].id, expectedRevision: created[0].revision, request: requested('Fictional Atlas updated') });
    assert.equal(updated.requests[0].status, 'complete', JSON.stringify(updated.requests[0])); assert.equal(updated.requests[0].resources[0].resource, resourceA); assert.equal(updated.requests[0].stackId, created[0].stackId);
    assert.deepEqual(app.sqlite.prepare('SELECT * FROM guestbook_resources WHERE id=?').get(resourceB), bBefore);
    report.checks.scopedUpdatePreservesBothIdentitiesAndTeamB = true;
    loseActivation = true;
    const interrupted = await call(actors[0], { action: 'update', workspace: teams[0].id, id: created[0].id, expectedRevision: updated.requests[0].revision, request: requested('Fictional Atlas recovered') });
    assert.equal(interrupted.requests[0].status, 'needs-attention'); assert.ok(lostOperation);
    const count = app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations').get().n;
    const recovered = await call(actors[0], { action: 'run', workspace: teams[0].id, id: created[0].id, expectedRevision: interrupted.requests[0].revision });
    assert.equal(recovered.requests[0].status, 'complete', JSON.stringify(recovered.requests[0])); assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations').get().n, count);
    assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations WHERE id=?').get(lostOperation).n, 1);
    assert.equal(report.http.filter(row => row.method === 'POST' && row.operationId === lostOperation).length, 1);
    report.checks.realCommittedActivationLostAckReconciledWithoutDuplicate = true;
    const beforeRefused = app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations').get().n;
    const refused = await call(actors[0], { action: 'update', workspace: teams[0].id, id: created[0].id, expectedRevision: recovered.requests[0].revision, request: { ...requested('Unsupported data'), dataClass: 'sensitive' } });
    assert.equal(refused.requests[0].decision.outcome, 'denied'); assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations').get().n, beforeRefused);
    report.checks.refusedUpdateHasNoAppWrites = true;
    // Synthetic approved content is inserted directly as a labelled fixture; public guest admission remains closed.
    const item = 'fictional-platform-media-0001';
    const { PNG } = requireExisting('pngjs');
    const { sanitisePNG } = await import(pathToFileURL(join(guestbook, 'src/png.ts')).href);
    const png = Buffer.from((await sanitisePNG(PNG.sync.write({ width: 1, height: 1, data: Buffer.from([252, 91, 5, 255]) }, { colorType: 6 }))).bytes);
    app.sqlite.prepare("INSERT INTO guestbook_resource_items(id,resource_id,caption,author,status,synthetic) VALUES(?,?,?,?,'approved',1)").run(item, resourceA, 'Fictional demonstration pixel', 'Synthetic fixture');
    await media.put(`resources/${resourceA}/photos/${item}.png`, png);
    const exported = await resourceConnection(runtime, teams[0].id).portable(resourceA);
    assert.equal(exported.items.length, 1); assert.equal(exported.items[0].media.sha256, hash(png));
    const publicMedia = await forward(new Request(origin + `/guestbook/r/${resourceA}/media/${item}`)); assert.equal(publicMedia.status, 200); assert.equal(hash(Buffer.from(await publicMedia.arrayBuffer())), hash(png));
    assert.equal((await forward(new Request(origin + `/guestbook/r/${resourceB}/media/${item}`))).status, 404);
    report.checks.realApprovedMediaAndPortableExport = true;
    assert.deepEqual(cms.sqlite.prepare('PRAGMA foreign_key_check').all(), []); assert.deepEqual(app.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(git('rev-parse', 'HEAD'), pin); assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
    assert.equal(hash(await readFile(join(guestbook, 'src/worker.ts'))), report.execution.entrypointSha256);
    assert.equal(hash(await readFile(join(guestbook, executedModule))), report.execution.executedModuleSha256);
    report.services = created.map((row, i) => ({ team: i ? 'Fictional Beacon' : 'Fictional Atlas', workspace: teams[i].id, request: row.id, stack: row.stackId, resource: row.resources[0].resource, canonicalPage: row.url, localPage: localOrigin + row.url, localApp: localOrigin + (i ? created[i] : recovered.requests[0]).resources[0].configuration.path }));
    report.export = { format: exported.format, items: exported.items.length, mediaSha256: exported.items[0].media.sha256, sourceBuild: exported.source.build };
    report.operations = { resources: app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resources').get().n, durableOperations: app.sqlite.prepare('SELECT COUNT(*) AS n FROM guestbook_resource_operations').get().n, lostAcknowledgementOperation: lostOperation, lostAcknowledgementDispatches: report.http.filter(row => row.method === 'POST' && row.operationId === lostOperation).length };
    if (onReady) await onReady(report);
    if (serve) {
      process.stdout.write(JSON.stringify({ ...report, phase: 'serving-local-fixture', ownedTemporaryRootRemoved: false }, null, 2) + '\n');
      await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    }
  } finally {
    try { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } cms?.sqlite.close(); app?.sqlite.close(); }
    finally { globalThis.BUILD_SHA = previousBuild; globalThis.MANIFEST = previousManifest; await rm(root, { recursive: true, force: true }); await assert.rejects(stat(root), { code: 'ENOENT' }); report.ownedTemporaryRootRemoved = true; }
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.slice(2).every(value => value === '--serve'), 'Usage: node --experimental-transform-types scripts/platform-demo.mjs [--serve]');
  process.stdout.write(JSON.stringify(await runPlatformDemo({ serve: process.argv.includes('--serve') }), null, 2) + '\n');
}

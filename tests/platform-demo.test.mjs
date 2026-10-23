import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { selectGuestbookFetchModule } from '../scripts/platform-demo.mjs';
import { appSettings } from '../src/lib/app-settings.mjs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// One isolated process owns the real Worker globals, databases, filesystem media and listener.
// This checks observable app outcomes, not a duplicated resource HTTP contract.
const workspace = fileURLToPath(new URL('..', import.meta.url));
const source = process.env.COMPOSER_DEMO_GUESTBOOK ? resolve(process.env.COMPOSER_DEMO_GUESTBOOK) : resolve(workspace, '../app-composer-guestbook');
const absent = !existsSync(source);
test('two-team programme exercises actual pinned Guestbook code, media and durable recovery locally', { skip: absent ? 'Optional real-app lab needs an existing Guestbook checkout; select COMPOSER_DEMO_GUESTBOOK.' : false }, () => {
  const output = execFileSync(process.execPath, ['--experimental-transform-types', 'scripts/platform-demo.mjs'], { cwd: workspace, encoding: 'utf8', timeout: 30000, maxBuffer: 200000, stdio: ['ignore', 'pipe', 'pipe'] });
  const receipt = JSON.parse(output);
  const composition = JSON.parse(readFileSync(new URL('../composition.lock.json', import.meta.url), 'utf8'));
  const pin = composition.apps.find(app => app.id === 'guestbook').commit;
  assert.equal(appSettings.guestbook.source.commit, pin);
  assert.equal(receipt.guestbookSource, pin);
  assert.equal(receipt.execution.entrypoint, 'src/worker.ts');
  assert.equal(receipt.execution.namedServiceBinding, 'not-exercised');
  assert.equal(receipt.execution.workersEntrypointRuntime, 'not-exercised');
  assert.match(receipt.execution.executedModuleSha256, /^[a-f0-9]{64}$/);
  assert.match(receipt.execution.entrypointSha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.execution.executedModuleSha256, createHash('sha256').update(readFileSync(resolve(source, receipt.execution.executedModule))).digest('hex'));
  assert.deepEqual(receipt.checks, {
    twoTeamCreateAndDuplicateSubmission: true,
    crossTeamPortalAndRealAppScopeDenied: true,
    scopedUpdatePreservesBothIdentitiesAndTeamB: true,
    realCommittedActivationLostAckReconciledWithoutDuplicate: true,
    refusedUpdateHasNoAppWrites: true,
    realApprovedMediaAndPortableExport: true,
  });
  assert.equal(receipt.operations.resources, 2);
  assert.equal(receipt.operations.lostAcknowledgementDispatches, 1);
  assert.match(receipt.authoredSourceHashes['src/lib/platform-admin.ts'], /^[a-f0-9]{64}$/);
  assert.notEqual(receipt.services[0].resource, receipt.services[1].resource);
  assert.notEqual(receipt.services[0].workspace, receipt.services[1].workspace);
  assert.equal(receipt.export.format, 'guestbook.approved-portable/v1');
  assert.equal(receipt.export.items, 1);
  assert.match(receipt.export.mediaSha256, /^[a-f0-9]{64}$/);
  assert.equal(receipt.export.sourceBuild, receipt.guestbookSource);
  assert.ok(receipt.http.some(row => row.path.startsWith('/s/') && row.status === 200));
  assert.ok(receipt.http.some(row => row.path.endsWith('/portable') && row.status === 200));
  assert.ok(receipt.http.some(row => row.path.includes('/media/') && row.status === 404));
  assert.match(receipt.boundaries.admission, /not exercised/);
  assert.match(receipt.boundaries.guestbook, /not workerd/);
  assert.equal(receipt.ownedTemporaryRootRemoved, true);
  assert.doesNotMatch(output, /Bearer |routing_key|OWNER_API_TOKEN/);
});

// These source-selection boundaries run even when the optional independent checkout is absent.
test('fetch-module selection follows only the exact reviewed default re-export without shimming Workers', () => {
  const typescript = createRequire(import.meta.url)('typescript');
  assert.equal(selectGuestbookFetchModule('export default { async fetch() { return new Response("old"); } };', typescript), 'src/worker.ts');
  const named = 'import { WorkerEntrypoint } from "cloudflare:workers"; export class MemberService extends WorkerEntrypoint {}';
  assert.equal(selectGuestbookFetchModule(named + ' export { default } from "./app.ts";', typescript), 'src/app.ts');
  for (const invalid of [
    named + ' /* export { default } from "./app.ts"; */',
    named + ' export { default as other } from "./app.ts";',
    named + ' export { handler as default } from "./app.ts";',
    named + ' export { default } from "./other.ts";',
    'export { default } from "./other.ts";',
    'export const value = 1;',
    named + ' export { default } from "./app.ts"; export default {};',
  ]) assert.throws(() => selectGuestbookFetchModule(invalid, typescript));
});

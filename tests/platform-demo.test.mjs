import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// One isolated process owns the real Worker globals, databases, filesystem media and listener.
// This checks observable app outcomes, not a duplicated resource HTTP contract.
const workspace = fileURLToPath(new URL('..', import.meta.url));
const source = process.env.COMPOSER_DEMO_GUESTBOOK ? resolve(process.env.COMPOSER_DEMO_GUESTBOOK) : resolve(workspace, '../app-composer-guestbook');
const absent = !existsSync(source);
test('two-team programme exercises actual pinned Guestbook code, media and durable recovery locally', { skip: absent ? 'Optional real-app lab needs an existing Guestbook checkout; select COMPOSER_DEMO_GUESTBOOK.' : false }, () => {
  const output = execFileSync(process.execPath, ['--experimental-transform-types', 'scripts/platform-demo.mjs'], { cwd: workspace, encoding: 'utf8', timeout: 30000, maxBuffer: 200000, stdio: ['ignore', 'pipe', 'pipe'] });
  const receipt = JSON.parse(output);
  assert.equal(receipt.guestbookSource, '376129c8b48d29d26e982777084aa241966569c7');
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

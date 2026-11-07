import test from 'node:test';
import assert from 'node:assert/strict';
import {apps} from '../src/lib/apps.ts';
import {
  appCapabilities,
  capabilitiesReviewed,
  validateCapabilities,
} from '../src/lib/app-capabilities.ts';
import {publicPagePaths} from '../src/lib/public-pages.mjs';

const base = () => structuredClone(appCapabilities[0]);

test('the shipped capability catalogue is valid and follows the app library', () => {
  assert.match(capabilitiesReviewed, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(appCapabilities.map(app => app.id)).size, appCapabilities.length);
  for (const app of appCapabilities)
    assert.ok(apps.some(entry => entry.id === app.id), `${app.id} must exist in the app library`);
  for (const app of appCapabilities) {
    assert.equal(new Set(app.operations.map(op => op.name)).size, app.operations.length);
    for (const operation of app.operations) {
      assert.ok(operation.path.startsWith('/'));
      assert.ok(!operation.path.includes('..'));
      assert.ok(!operation.path.includes('?'));
    }
  }
  assert.ok(publicPagePaths.includes('/capabilities'));
  assert.ok(publicPagePaths.includes('/capabilities.json') === false, 'JSON is not an HTML page');
});

test('an effect must state a permit and confirmation', () => {
  const effect = {
    ...base(),
    operations: [{
      name: 'submit', description: 'Send a bounded postcard.', kind: 'effect',
      method: 'POST', path: '/api/guest-postcard', availability: 'guest-invitation',
      requires: ['guest-invitation'], confirmation: true, verified: '2026-11-06',
    }],
  };
  assert.doesNotThrow(() => validateCapabilities([effect]));
  const unconfirmed = structuredClone(effect);
  unconfirmed.operations[0].confirmation = false;
  assert.throws(() => validateCapabilities([unconfirmed]), /confirmation/);
  const publicEffect = structuredClone(effect);
  publicEffect.operations[0].availability = 'public';
  assert.throws(() => validateCapabilities([publicEffect]), /scoped/);
});

test('the Guestbook effect is a bounded guest-invitation write', () => {
  const guestbook = appCapabilities.find(app => app.id === 'guestbook');
  const effect = guestbook.operations.find(operation => operation.name === 'submit-postcard');
  assert.equal(effect.kind, 'effect');
  assert.equal(effect.method, 'POST');
  assert.equal(effect.availability, 'guest-invitation');
  assert.equal(effect.confirmation, true);
  assert.deepEqual(effect.requires, ['guest-invitation-code', 'consent']);
  assert.equal(effect.path, '/r/:resource/api/guest-postcard');
});

test('unknown apps, unsafe paths and stray fields fail closed', () => {
  const unknown = base();
  unknown.id = 'not-a-shipped-app';
  assert.throws(() => validateCapabilities([unknown]), /shipped library/);

  const traversal = base();
  traversal.operations = [{
    ...traversal.operations[0],
    path: '/../private',
  }];
  assert.throws(() => validateCapabilities([traversal]), /safe relative path/);

  const stray = base();
  stray.token = 'not-allowed';
  assert.throws(() => validateCapabilities([stray]), /unsupported fields/);

  const duplicated = [...appCapabilities, structuredClone(appCapabilities[0])];
  assert.throws(() => validateCapabilities(duplicated), /repeated/);
});

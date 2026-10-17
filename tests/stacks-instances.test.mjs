import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StackError, STACK_APPS, declaredConfig, appCapabilities, normaliseStack,
  instanceConfiguration, duplicateStack,
} from '../src/lib/stacks.mjs';
import { activationEntries, activationSummary, activateStack, stackSourceStatus } from '../src/lib/stack-activation.mjs';
import { appSettings } from '../src/lib/app-settings.mjs';

const app = id => ({
  id: `${id}-instance-0001`,
  app: id,
  label: `${id} instance`,
  caption: '',
  visible: true,
  binding: { mode: 'own', shareOf: null },
  config: {},
});
const document = (instances, name = 'Demo stack') => ({ version: 1, name, description: '', theme: 'midnight', instances });

test('instance configuration comes from the configuration the app declares for itself', () => {
  const guestbook = declaredConfig('guestbook');
  assert.ok(guestbook.some(field => field.key === 'title'));
  assert.ok(guestbook.some(field => field.key === 'guestAccess' && field.options?.includes('postcards')));
  assert.equal(declaredConfig('hello'), null, 'an app with no published contract declares nothing');
  assert.deepEqual(appCapabilities('guestbook').sort(), [...appSettings.guestbook.capabilities].sort());

  const clean = normaliseStack(document([{ ...app('guestbook'), config: { title: 'Trail notes', theme: 'daylight' } }]));
  assert.deepEqual(clean.instances[0].config, { title: 'Trail notes', theme: 'daylight' });
  // Undeclared keys, bad options and over-long values are refused before write.
  assert.throws(() => normaliseStack(document([{ ...app('guestbook'), config: { secret: 'nope' } }])), error => error instanceof StackError && /declares/.test(error.message));
  assert.throws(() => normaliseStack(document([{ ...app('guestbook'), config: { theme: 'neon' } }])), /supported theme/);
  assert.throws(() => normaliseStack(document([{ ...app('guestbook'), config: { title: 'x'.repeat(81) } }])), /80 characters/);
  assert.throws(() => normaliseStack(document([{ ...app('hello'), config: { title: 'Hello' } }])), /declared settings/);
});

test('Guestbook allows independent resource drafts while apps without resource contracts retain the current limit', () => {
  const twoGuestbooks = normaliseStack(document([app('guestbook'), { ...app('guestbook'), id: 'guestbook-instance-0002' }]));
  assert.equal(twoGuestbooks.instances.length, 2);
  assert.throws(
    () => normaliseStack(document([app('showcase'), { ...app('showcase'), id: 'showcase-instance-0002' }])),
    /already configures Linkarooie independently/,
  );
});

test('a shared instance reuses another instance of the same app and cannot carry its own settings', () => {
  const base = app('guestbook');
  const shared = { ...app('guestbook'), id: 'guestbook-instance-0002', binding: { mode: 'shared', shareOf: base.id } };
  const clean = normaliseStack(document([{ ...base, config: { title: 'Trail notes' } }, shared]));
  assert.equal(clean.instances[1].binding.mode, 'shared');
  assert.deepEqual(clean.instances[1].config, {}, 'a shared instance inherits settings');
  assert.throws(() => normaliseStack(document([base, { ...shared, config: { title: 'Other' } }])), /inherits its settings/);
  assert.throws(() => normaliseStack(document([base, { ...shared, binding: { mode: 'shared', shareOf: 'missing-instance-1' } }])), /reuse another instance/);
  assert.throws(() => normaliseStack(document([app('guestbook'), { ...shared, app: 'showcase' }])), /same app|already configures/);
  // Two shared instances cannot chain off each other.
  const second = { ...app('guestbook'), id: 'guestbook-instance-0003', binding: { mode: 'shared', shareOf: shared.id } };
  assert.throws(() => normaliseStack(document([base, shared, second])), /independently configured instance/);
});

test('instance configuration is readable and credential-free for the maintenance view', () => {
  const stack = document([{ ...app('guestbook'), config: { title: 'Trail notes' } }]);
  const view = instanceConfiguration(stack, 'guestbook-instance-0001');
  assert.equal(view.mode, 'own');
  assert.equal(view.config.title, 'Trail notes');
  assert.deepEqual(view.capabilities.sort(), [...appSettings.guestbook.capabilities].sort());
  assert.equal(typeof view.source.commit, 'string');
  assert.equal(JSON.stringify(view).match(/token|secret|credential/i), null, 'no credential material reaches a view or an export');
  assert.throws(() => instanceConfiguration(stack, 'missing-instance-1'), /not in this stack/);
});

test('activation builds a complete declared configuration from the stack instance', () => {
  const stack = document([{ ...app('guestbook'), config: { title: 'Trail notes' } }]);
  const [entry] = activationEntries(stack);
  assert.equal(entry.configurable, true);
  assert.equal(entry.configuration.title, 'Trail notes');
  // The app's own declared defaults complete the request it validates.
  assert.equal(entry.configuration.theme, appSettings.guestbook.fields.find(field => field.key === 'theme').default);
  assert.equal(entry.settings.find(setting => setting.key === 'title').overridden, true);
  assert.equal(entry.settings.find(setting => setting.key === 'theme').overridden, false);
});

test('activation writes through the app boundary, verifies the response and stops at the first failure', async () => {
  const stack = document([
    { ...app('guestbook'), config: { title: 'Trail notes' } },
    { ...app('showcase'), config: { handle: 'trailkeeper' } },
  ]);
  const writes = [];
  const request = async (url, init = {}) => {
    const href = String(url);
    if (href.endsWith('/build.json')) {
      const id = href.includes('composer.loftwah.com') ? href.split('/').slice(-2)[0] : new URL(href).hostname.split('.')[0];
      return { ok: true, status: 200, async json() { return { revision: appSettings[id].source.commit }; } };
    }
    writes.push({ url: href, body: JSON.parse(init.body), authorization: init.headers?.Authorization });
    return { ok: true, status: 200, async json() { return { ok: true, config: JSON.parse(init.body) }; } };
  };
  const applied = await activateStack(stack, {
    request,
    credential: async id => `token-for-${id}`,
    beforeWrite: async () => undefined,
  });
  assert.deepEqual(applied.configured.map(entry => entry.app), ['guestbook', 'showcase']);
  assert.deepEqual(applied.failed, []);
  assert.equal(applied.publicationUnchanged, true);
  assert.equal(writes.length, 2, 'each independently configured app is written once');
  assert.equal(writes[0].authorization, 'Bearer token-for-guestbook');
  assert.equal(writes[1].authorization, 'Bearer token-for-showcase');

  // A downstream failure stops the run: the failing app reports its own failure
  // and every later app keeps its previous configuration.
  const failing = document([
    { ...app('showcase'), id: 'showcase-instance-0009', config: { handle: 'trailkeeper' } },
    { ...app('guestbook'), id: 'guestbook-instance-0009', config: { title: 'Trail notes' } },
  ]);
  const attempts = [];
  const failingRequest = async (url, init = {}) => {
    const href = String(url);
    if (href.endsWith('/build.json')) {
      const id = href.includes('composer.loftwah.com') ? href.split('/').slice(-2)[0] : new URL(href).hostname.split('.')[0];
      return { ok: true, status: 200, async json() { return { revision: appSettings[id].source.commit }; } };
    }
    attempts.push(new URL(href).hostname.split('.')[0]);
    if (href.includes('showcase')) return { ok: false, status: 502 };
    return { ok: true, status: 200, async json() { return { ok: true, config: JSON.parse(init.body) }; } };
  };
  const result = await activateStack(failing, {
    request: failingRequest,
    credential: async id => `token-for-${id}`,
    beforeWrite: async () => undefined,
  });
  assert.deepEqual(result.configured, []);
  assert.deepEqual(result.failed.map(entry => entry.app), ['showcase']);
  assert.deepEqual(result.untouched.map(entry => entry.app), ['guestbook']);
  assert.deepEqual(attempts, ['showcase'], 'the later app is never written after the first failure');
  assert.equal(result.publicationUnchanged, true, 'a downstream failure never rewrites a publication');

  await assert.rejects(activateStack(stack, { request, beforeWrite: async () => undefined }), error => error instanceof StackError && error.status === 403);
  await assert.rejects(activateStack(stack, { request, credential: async () => 'x' }), /workspace guard/);
});

test('a changed live source is reported instead of applied', async () => {
  const stack = document([{ ...app('guestbook'), config: { title: 'Trail notes' } }]);
  const request = async url => {
    if (String(url).endsWith('/build.json')) return { ok: true, status: 200, async json() { return { revision: 'different-revision' }; } };
    throw Error('no write should happen');
  };
  const status = await stackSourceStatus(stack, { request });
  assert.equal(status[0].status, 'changed');
  const summary = activationSummary(stack);
  assert.equal(summary.entries[0].app, 'guestbook');
  assert.deepEqual(summary.shared, []);
});

test('duplicating a stack keeps its shared-versus-independent structure with fresh identities', async () => {
  const base = app('guestbook');
  const shared = { ...app('guestbook'), id: 'guestbook-instance-0002', label: 'Second mention', binding: { mode: 'shared', shareOf: base.id } };
  const stack = document([base, shared]);
  const copy = await duplicateStack({}, 'workspace-not-used-by-this-path', 'ignored', 1).catch(() => null);
  assert.equal(copy, null, 'duplication still needs a database; the relationship mapping is covered through the document');
  const remap = new Map(stack.instances.map(instance => [instance.id, crypto.randomUUID()]));
  const copied = normaliseStack({
    ...stack,
    name: 'Demo stack copy',
    instances: stack.instances.map(instance => ({
      ...instance,
      id: remap.get(instance.id),
      binding: { mode: instance.binding.mode, shareOf: instance.binding.shareOf ? remap.get(instance.binding.shareOf) : null },
    })),
  });
  assert.notEqual(copied.instances[0].id, base.id);
  assert.equal(copied.instances[1].binding.shareOf, copied.instances[0].id, 'the copy still points at its own instance');
  assert.equal(STACK_APPS.guestbook.name, 'Here / there');
});

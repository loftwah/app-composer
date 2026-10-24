import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, user, origin } from './helpers/resource-fixture.mjs';
import { workspaceForUser } from '../src/lib/stacks.mjs';
import { manageOrders } from '../src/lib/orders.ts';
import { orderDocument, orderObservation, reduceOrder, fixtureObservation } from '../src/lib/order-contract.ts';

const baseOrder = () => orderDocument.parse({ version: 'composer.order/1', id: crypto.randomUUID(), workspace: 'fictional-workspace', app: 'fictional-reading-club', checkoutOwner: 'custom', provider: 'stripe', providerAccount: 'fixture-stripe', environment: 'fixture', proof: 'fixture', title: 'Fictional guide', amount: 1200, currency: 'AUD', payment: 'unpaid', refundedAmount: 0, attempt: { id: crypto.randomUUID(), providerReference: null, observationRevision: 0 }, fulfilmentOwner: 'composer-printful', fulfilment: 'not-requested' });
async function prepared(t) {
  const f = fixture(); t.after(() => f.close());
  f.sqlite.exec(readFileSync(new URL('../migrations/0014_orders.sql', import.meta.url), 'utf8'));
  const workspace = await workspaceForUser(f.db, user);
  const route = (input, reading = false, caller = user, headers = {}) => manageOrders({ input, user: caller, request: new Request(origin + '/_emdash/api/plugins/composer-stacks/orders', { method: reading ? 'GET' : 'POST', headers: { Origin: origin, 'X-EmDash-Request': '1', ...headers } }) }, f.runtime);
  const create = async (provider = 'stripe', fulfilmentOwner = 'composer-printful') => {
    const command = { action: 'create-fixture', workspace: workspace.id, operation: crypto.randomUUID(), provider, fulfilmentOwner };
    const reply = await route(command); assert.equal(reply.ok, true, JSON.stringify(reply));
    return { command, view: reply.orders.find(view => view.order.provider === provider) };
  };
  const observe = async (view, scenario, operation = crypto.randomUUID()) => route({ action: 'observe-fixture', workspace: workspace.id, order: view.order.id, expectedRevision: view.revision, operation, scenario });
  return { ...f, workspace, route, create, observe };
}

test('checkout completion and redirects are not payment; delayed current-state proof can establish paid', () => {
  const original = baseOrder();
  const complete = fixtureObservation(original, 'checkout-unpaid', crypto.randomUUID());
  const waiting = reduceOrder(original, complete).order;
  assert.equal(waiting.payment, 'pending'); assert.equal(waiting.fulfilment, 'not-requested');
  assert.throws(() => reduceOrder(original, { ...complete, state: 'paid' }), /completion alone/);
  assert.equal(orderObservation.safeParse({ ...complete, kind: 'browser.redirect', state: 'paid' }).success, false);
  const paid = reduceOrder(waiting, fixtureObservation(waiting, 'payment-paid', crypto.randomUUID())).order;
  assert.equal(paid.payment, 'paid');
  assert.equal(paid.proof, 'fixture'); assert.equal(paid.environment, 'fixture');
  assert.throws(() => reduceOrder(paid, fixtureObservation(paid, 'checkout-unpaid', crypto.randomUUID())), /cannot undo/);
  assert.equal(reduceOrder(paid, complete).outcome, 'ignored-stale');
});

test('refunds preserve fulfilment state and reject stale or inconsistent payment transitions', () => {
  let order = baseOrder();
  order = reduceOrder(order, fixtureObservation(order, 'payment-paid', crypto.randomUUID())).order;
  order = { ...order, fulfilment: 'draft' };
  order = reduceOrder(order, fixtureObservation(order, 'part-refunded', crypto.randomUUID())).order;
  assert.equal(order.payment, 'partially-refunded'); assert.equal(order.refundedAmount, 600);
  assert.equal(order.fulfilment, 'draft');
  assert.throws(() => reduceOrder(order, fixtureObservation(order, 'payment-paid', crypto.randomUUID())), /cannot undo/);
  order = reduceOrder(order, fixtureObservation(order, 'refunded', crypto.randomUUID())).order;
  assert.equal(order.payment, 'refunded'); assert.equal(order.refundedAmount, 1200); assert.equal(order.fulfilment, 'draft');
  assert.throws(() => orderDocument.parse({ ...order, refundedAmount: 600 }));
});

test('wrong amount, currency, account, attempt, workspace and environment cannot affect an order', () => {
  const order = baseOrder(), event = fixtureObservation(order, 'payment-paid', crypto.randomUUID());
  for (const patch of [{ amount: 1 }, { currency: 'USD' }, { providerAccount: 'other-account' }, { attempt: crypto.randomUUID() }, { workspace: 'another-workspace' }, { environment: 'live' }, { provider: 'paypal' }, { order: crypto.randomUUID() }]) assert.throws(() => reduceOrder(order, { ...event, ...patch }), /does not match/);
  assert.throws(() => orderDocument.parse({ ...order, provider: 'stripe', checkoutOwner: 'shopify' }));
  assert.throws(() => orderDocument.parse({ ...order, fulfilmentOwner: 'shopify-native' }));
  assert.throws(() => orderDocument.parse({ ...order, fulfilment: 'submitted' }));
  assert.throws(() => fixtureObservation({ ...order, proof: 'sandbox', environment: 'test' }, 'payment-paid', crypto.randomUUID()), /cannot touch/);
});

test('native fixture creation, observations and duplicate operations are durable and scoped', async t => {
  const f = await prepared(t), { command, view } = await f.create();
  assert.equal(view.order.amount, 1200); assert.equal(view.order.proof, 'fixture');
  assert.equal((await f.route(command)).orders.length, 1);
  assert.equal((await f.route({ ...command, provider: 'paypal' })).code, 'CONFLICT');
  assert.equal((await f.route({ ...command, amount: 1 })).code, 'INVALID');
  const operation = crypto.randomUUID();
  const paid = await f.observe(view, 'payment-paid', operation);
  assert.equal(paid.orders[0].order.payment, 'paid');
  const duplicate = await f.observe(view, 'payment-paid', operation);
  assert.equal(duplicate.orders[0].events.length, 1); assert.equal(duplicate.orders[0].revision, 2);
  assert.equal((await f.observe(view, 'payment-failed', operation)).code, 'CONFLICT');
  assert.equal((await f.observe(view, 'payment-failed')).code, 'CONFLICT');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM creator_order_events').get().n, 1);
});

test('uncertain fixture checkout reconciles its existing action without creating another payment attempt', async t => {
  const f = await prepared(t), { view } = await f.create();
  const timeout = await f.route({ action: 'timeout-fixture', workspace: f.workspace.id, order: view.order.id, operation: crypto.randomUUID(), expectedRevision: view.revision });
  const unknown = timeout.orders[0]; assert.equal(unknown.actions[0].state, 'unknown');
  const again = await f.route({ action: 'timeout-fixture', workspace: f.workspace.id, order: view.order.id, operation: crypto.randomUUID(), expectedRevision: unknown.revision });
  assert.equal(again.code, 'CONFLICT');
  const reconciled = await f.route({ action: 'reconcile-fixture', workspace: f.workspace.id, order: view.order.id, operation: crypto.randomUUID(), expectedRevision: unknown.revision });
  assert.equal(reconciled.orders[0].actions[0].state, 'succeeded');
  assert.equal(reconciled.orders[0].order.attempt.id, view.order.attempt.id);
  assert.equal(reconciled.orders[0].order.payment, 'unpaid');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM creator_order_actions').get().n, 1);
});

test('a fixture fulfilment draft needs paid state and one explicit owner; confirmation is unavailable', async t => {
  const f = await prepared(t), { view } = await f.create();
  const draft = current => ({ action: 'prepare-fixture-draft', workspace: f.workspace.id, order: current.order.id, operation: crypto.randomUUID(), expectedRevision: current.revision });
  assert.equal((await f.route(draft(view))).code, 'INVALID');
  const paid = (await f.observe(view, 'payment-paid')).orders[0];
  const preparedDraft = (await f.route(draft(paid))).orders.find(item => item.order.id === view.order.id);
  assert.equal(preparedDraft.order.fulfilment, 'draft');
  assert.equal(preparedDraft.actions.find(action => action.kind === 'prepare-fulfilment').state, 'succeeded');
  assert.equal((await f.route({ ...draft(preparedDraft), action: 'confirm-printful' })).code, 'INVALID');
  const shopify = (await f.create('shopify', 'shopify-native')).view;
  const paidShopify = (await f.observe(shopify, 'payment-paid')).orders.find(item => item.order.id === shopify.order.id);
  assert.equal((await f.route(draft(paidShopify))).code, 'INVALID');
});

test('wrong-workspace access, changed installation, CSRF and viewer writes fail without effects', async t => {
  const f = await prepared(t), { view } = await f.create();
  const command = { action: 'observe-fixture', workspace: f.workspace.id, order: view.order.id, operation: crypto.randomUUID(), expectedRevision: view.revision, scenario: 'payment-paid' };
  assert.equal((await f.route({ ...command, workspace: 'other-workspace' })).code, 'FORBIDDEN');
  assert.equal((await f.route(command, false, user, { Origin: 'https://example.test' })).code, 'FORBIDDEN');
  assert.equal((await f.route(command, false, user, { 'X-EmDash-Request': '' })).code, 'FORBIDDEN');
  f.runtime.RESOURCE_ENVIRONMENT = 'other-environment';
  assert.equal((await f.route({ action: 'list', workspace: f.workspace.id }, true)).orders.length, 0);
  assert.equal((await f.route(command)).code, 'NOT_FOUND');
  f.runtime.RESOURCE_ENVIRONMENT = 'production';
  f.sqlite.prepare("UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(f.workspace.id, user.id);
  assert.equal((await f.route(command)).code, 'FORBIDDEN');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM creator_order_events').get().n, 0);
});

test('revocation immediately before the atomic event/action transition leaves no event or state change', async t => {
  const f = await prepared(t), { view } = await f.create();
  f.beforeBatch(() => { f.sqlite.prepare('DELETE FROM creator_members WHERE workspace_id=? AND user_id=?').run(f.workspace.id, user.id); });
  const reply = await f.observe(view, 'payment-paid');
  assert.equal(reply.ok, false);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM creator_order_events').get().n, 0);
  const raw = f.sqlite.prepare('SELECT order_json,revision FROM creator_orders').get();
  assert.equal(JSON.parse(raw.order_json).payment, 'unpaid'); assert.equal(raw.revision, 1);
});

test('corrupt persisted order JSON cannot select another identity, scope, payment or checkout action', async t => {
  const f = await prepared(t), { view } = await f.create();
  const original = view.order;
  const write = order => f.sqlite.prepare('UPDATE creator_orders SET order_json=? WHERE id=?').run(JSON.stringify(order), original.id);
  const command = () => ({ action: 'observe-fixture', workspace: f.workspace.id, order: original.id, operation: crypto.randomUUID(), expectedRevision: view.revision, scenario: 'payment-paid' });
  for (const patch of [
    { id: crypto.randomUUID() }, { workspace: 'fictional-other-workspace' }, { provider: 'paypal' },
    { providerAccount: 'fixture-foreign-account' }, { environment: 'test', proof: 'sandbox' },
    { payment: 'paid' }, { attempt: { ...original.attempt, id: crypto.randomUUID() } },
    { attempt: { ...original.attempt, providerReference: 'fixture-session-not-this-attempt' } },
  ]) {
    write({ ...original, ...patch });
    const read = await f.route({ action: 'list', workspace: f.workspace.id }, true);
    assert.equal(read.ok, false, JSON.stringify(patch)); assert.equal(read.orders, undefined);
    assert.equal((await f.route(command())).ok, false);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM creator_order_events').get().n, 0);
  }
  write(original);
  f.sqlite.prepare('UPDATE creator_order_actions SET id=? WHERE order_id=?').run(crypto.randomUUID(), original.id);
  assert.equal((await f.route({ action: 'list', workspace: f.workspace.id }, true)).ok, false);
  assert.equal((await f.route(command())).ok, false);
  assert.equal(f.sqlite.prepare('SELECT revision FROM creator_orders WHERE id=?').get(original.id).revision, 1);
});

test('corrupt stored provider scope columns also fail closed against the validated document', async t => {
  const f = await prepared(t), { view } = await f.create();
  for (const [column, value] of [['provider_account', 'fixture-other-account'], ['payment_environment', 'test'], ['payment_state', 'paid'], ['proof', 'sandbox']]) {
    const old = f.sqlite.prepare(`SELECT ${column} AS value FROM creator_orders WHERE id=?`).get(view.order.id).value;
    f.sqlite.prepare(`UPDATE creator_orders SET ${column}=? WHERE id=?`).run(value, view.order.id);
    assert.equal((await f.route({ action: 'list', workspace: f.workspace.id }, true)).ok, false);
    f.sqlite.prepare(`UPDATE creator_orders SET ${column}=? WHERE id=?`).run(old, view.order.id);
  }
});

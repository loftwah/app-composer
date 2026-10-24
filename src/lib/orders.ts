import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { isCreatorRole } from './creator-access.ts';
import { resolveWorkspace, membership, requireCapability, StackError } from './stacks.mjs';
import { orderCommand, orderDocument, ordersSnapshot, orderVersion, reduceOrder, fixtureObservation, type OrderDocument } from './order-contract.ts';

const origin = 'https://composer.loftwah.com';
const authority = "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role IN ('owner','editor'))";
const readInput = z.object({ action: z.literal('list'), workspace: z.string().regex(/^[a-z0-9-]{6,64}$/).optional() }).strict();
interface Runtime { DB?: D1Database; PUBLIC_ORIGIN?: unknown; RESOURCE_ACCOUNT_ID?: unknown; RESOURCE_ENVIRONMENT?: unknown }
interface User { id: string; role: number; name?: string | null }
interface Context { input: unknown; user?: User; request: Request }
interface OrderRow { id: string; workspace_id: string; creation_key: string; installation_account: string; installation_environment: string; provider: string; provider_account: string; payment_environment: string; proof: string; payment_state: string; revision: number; order_json: string; created_at: string }
interface ActionRow { id: string; kind: 'create-checkout' | 'prepare-fulfilment'; state: 'prepared' | 'unknown' | 'succeeded' | 'failed'; provider_reference: string | null; revision: number }
const conflict = () => new StackError('CONFLICT', 'This order, operation or account changed. Refresh its persisted history before continuing.', 409);
function decodeOrder(row: OrderRow): OrderDocument {
  const order = orderDocument.parse(JSON.parse(row.order_json));
  if (order.id !== row.id || order.workspace !== row.workspace_id || order.provider !== row.provider || order.providerAccount !== row.provider_account || order.environment !== row.payment_environment || order.proof !== row.proof || order.payment !== row.payment_state) throw new StackError('UNAVAILABLE', 'The stored order identity or payment scope is inconsistent. No operation was performed; inspect the saved record.');
  return order;
}
function confirmCheckout(order: OrderDocument, actions: ActionRow[]): void {
  const checkout = actions.find(action => action.kind === 'create-checkout');
  if (!checkout || checkout.id !== order.attempt.id || checkout.provider_reference !== order.attempt.providerReference) throw new StackError('UNAVAILABLE', 'The stored checkout action does not match this payment attempt. No operation was performed; inspect its retained identity.');
}
function installation(runtime: Runtime) {
  if (typeof runtime.RESOURCE_ACCOUNT_ID !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(runtime.RESOURCE_ACCOUNT_ID) || typeof runtime.RESOURCE_ENVIRONMENT !== 'string' || !/^[a-z0-9-]{1,40}$/.test(runtime.RESOURCE_ENVIRONMENT)) throw new StackError('UNAVAILABLE', 'Orders need the selected server account and environment.');
  return { account: runtime.RESOURCE_ACCOUNT_ID, environment: runtime.RESOURCE_ENVIRONMENT };
}
async function selectedOrder(db: D1Database, workspace: string, id: string, target: ReturnType<typeof installation>) {
  const row = await db.prepare('SELECT * FROM creator_orders WHERE id=? AND workspace_id=? AND installation_account=? AND installation_environment=?').bind(id, workspace, target.account, target.environment).first<OrderRow>();
  if (!row) throw new StackError('NOT_FOUND', 'This order is not in the selected workspace and environment.', 404);
  return row;
}
async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function snapshot(db: D1Database, workspace: { id: string; name: string; role: 'owner' | 'editor' | 'viewer' }, target: ReturnType<typeof installation>) {
  const rows = await db.prepare('SELECT * FROM creator_orders WHERE workspace_id=? AND installation_account=? AND installation_environment=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(workspace.id, target.account, target.environment).all<OrderRow>();
  const orders = await Promise.all(rows.results.map(async row => {
    const [events, actions] = await Promise.all([
      db.prepare('SELECT operation,kind,outcome,created_at FROM creator_order_events WHERE order_id=? AND workspace_id=? ORDER BY created_at DESC,operation DESC LIMIT 30').bind(row.id, workspace.id).all<{ operation: string; kind: string; outcome: string; created_at: string }>(),
      db.prepare('SELECT * FROM creator_order_actions WHERE order_id=? AND workspace_id=?').bind(row.id, workspace.id).all<ActionRow>(),
    ]);
    const order = decodeOrder(row);
    confirmCheckout(order, actions.results);
    return { order, revision: row.revision, createdAt: row.created_at, events: events.results.map(event => ({ operation: event.operation, kind: event.kind, outcome: event.outcome, createdAt: event.created_at })), actions: actions.results.map(action => ({ id: action.id, kind: action.kind, state: action.state, providerReference: action.provider_reference, revision: action.revision })) };
  }));
  return ordersSnapshot.parse({ ok: true, version: orderVersion, workspace, installation: target, orders, limit: 200, providerConnection: 'not-qualified' });
}

async function createFixture(db: D1Database, user: User, workspace: string, target: ReturnType<typeof installation>, command: Extract<z.infer<typeof orderCommand>, { action: 'create-fixture' }>) {
  const existing = await db.prepare('SELECT * FROM creator_orders WHERE workspace_id=? AND creation_key=?').bind(workspace, command.operation).first<OrderRow>();
  if (existing) {
    const order = decodeOrder(existing);
    if (existing.installation_account !== target.account || existing.installation_environment !== target.environment || order.provider !== command.provider || order.fulfilmentOwner !== command.fulfilmentOwner) throw conflict();
    return;
  }
  const attempt = crypto.randomUUID(), id = crypto.randomUUID();
  const order = orderDocument.parse({ version: orderVersion, id, workspace, app: 'fictional-reading-club', checkoutOwner: command.provider === 'shopify' ? 'shopify' : 'custom', provider: command.provider, providerAccount: `fixture-${command.provider}`, environment: 'fixture', proof: 'fixture', title: 'Fictional reading-club guide', amount: 1200, currency: 'AUD', payment: 'unpaid', refundedAmount: 0, attempt: { id: attempt, providerReference: null, observationRevision: 0 }, fulfilmentOwner: command.fulfilmentOwner, fulfilment: 'not-requested' });
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO creator_orders (id,workspace_id,creation_key,installation_account,installation_environment,provider,provider_account,payment_environment,proof,payment_state,order_json) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${authority} AND (SELECT COUNT(*) FROM creator_orders WHERE workspace_id=?)<200`).bind(id, workspace, command.operation, target.account, target.environment, order.provider, order.providerAccount, order.environment, order.proof, order.payment, JSON.stringify(order), workspace, user.id, workspace),
    db.prepare(`INSERT OR IGNORE INTO creator_order_actions(id,workspace_id,order_id,kind,state) SELECT ?,?,?,'create-checkout','prepared' WHERE EXISTS(SELECT 1 FROM creator_orders WHERE id=? AND workspace_id=? AND creation_key=?) AND ${authority}`).bind(attempt, workspace, id, id, workspace, command.operation, workspace, user.id),
  ]);
  const saved = await db.prepare('SELECT * FROM creator_orders WHERE workspace_id=? AND creation_key=?').bind(workspace, command.operation).first<OrderRow>();
  if (!saved) throw new StackError('CONFLICT', 'The fixture was not created. Refresh access and history; the workspace may have reached its 200-order limit.', 409);
  const savedOrder = decodeOrder(saved);
  if (saved.installation_account !== target.account || saved.installation_environment !== target.environment || savedOrder.provider !== command.provider || savedOrder.fulfilmentOwner !== command.fulfilmentOwner) throw conflict();
}

async function applyFixture(db: D1Database, user: User, workspace: string, target: ReturnType<typeof installation>, command: Exclude<z.infer<typeof orderCommand>, { action: 'create-fixture' }>) {
  const row = await selectedOrder(db, workspace, command.order, target);
  const order = decodeOrder(row);
  const checkout = await db.prepare("SELECT * FROM creator_order_actions WHERE order_id=? AND workspace_id=? AND kind='create-checkout'").bind(row.id, workspace).first<ActionRow>();
  confirmCheckout(order, checkout ? [checkout] : []);
  if (order.proof !== 'fixture' || order.environment !== 'fixture' || !order.providerAccount.startsWith('fixture-')) throw new StackError('FORBIDDEN', 'Fixture controls cannot change provider-backed orders.', 403);
  const identity = await digest({ action: command.action, order: command.order, ...(command.action === 'observe-fixture' ? { scenario: command.scenario } : {}) });
  const existing = await db.prepare('SELECT order_id,digest FROM creator_order_events WHERE workspace_id=? AND operation=?').bind(workspace, command.operation).first<{ order_id: string; digest: string }>();
  if (existing) { if (existing.order_id !== order.id || existing.digest !== identity) throw conflict(); return; }
  if (row.revision !== command.expectedRevision) throw conflict();
  const count = await db.prepare('SELECT COUNT(*) AS n FROM creator_order_events WHERE order_id=? AND workspace_id=?').bind(order.id, workspace).first<{ n: number }>();
  if ((count?.n ?? 0) >= 100) throw new StackError('UNAVAILABLE', 'This fixture reached its 100-event limit. Existing receipts remain readable.');
  let next: OrderDocument = order, event: unknown = { version: 'composer.fixture-action/1', action: command.action, proof: 'fixture' };
  let outcome = 'applied';
  const additional = [];
  if (command.action === 'observe-fixture') {
    event = fixtureObservation(order, command.scenario, command.operation);
    try { const reduced = reduceOrder(order, event); next = reduced.order; outcome = reduced.outcome; }
    catch { throw new StackError('INVALID', 'This observation would regress a verified payment or refund. Keep the receipt and choose a compatible current-state scenario.'); }
  } else {
    const kind = command.action === 'prepare-fixture-draft' ? 'prepare-fulfilment' : 'create-checkout';
    const action = await db.prepare('SELECT * FROM creator_order_actions WHERE order_id=? AND workspace_id=? AND kind=?').bind(order.id, workspace, kind).first<ActionRow>();
    if (command.action === 'prepare-fixture-draft') {
      if (order.payment !== 'paid' || order.fulfilmentOwner !== 'composer-printful') throw new StackError('INVALID', 'A Composer fulfilment draft needs a paid fixture and explicit Composer–Printful ownership. Shopify-native fulfilment must not be submitted a second time.');
      next = orderDocument.parse({ ...order, fulfilment: 'draft' });
      if (!action) additional.push(db.prepare(`INSERT INTO creator_order_actions(id,workspace_id,order_id,kind,state,provider_reference) SELECT ?,?,?,'prepare-fulfilment','succeeded',? WHERE EXISTS(SELECT 1 FROM creator_order_events WHERE workspace_id=? AND operation=? AND digest=?) AND ${authority}`).bind(crypto.randomUUID(), workspace, order.id, `fixture-draft-${order.id}`, workspace, command.operation, identity, workspace, user.id));
    } else {
      if (!action || (command.action === 'timeout-fixture' && action.state !== 'prepared') || (command.action === 'reconcile-fixture' && action.state !== 'unknown')) throw conflict();
      const state = command.action === 'timeout-fixture' ? 'unknown' : 'succeeded';
      additional.push(db.prepare(`UPDATE creator_order_actions SET state=?,provider_reference=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM creator_order_events WHERE workspace_id=? AND operation=? AND digest=?) AND ${authority}`).bind(state, state === 'succeeded' ? `fixture-session-${order.attempt.id}` : null, action.id, workspace, action.revision, workspace, command.operation, identity, workspace, user.id));
      if (state === 'succeeded') next = orderDocument.parse({ ...order, attempt: { ...order.attempt, providerReference: `fixture-session-${order.attempt.id}` } });
    }
  }
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO creator_order_events(operation,workspace_id,order_id,kind,digest,event_json,outcome) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM creator_orders WHERE id=? AND workspace_id=? AND revision=? AND installation_account=? AND installation_environment=?) AND ${authority}`).bind(command.operation, workspace, order.id, command.action === 'observe-fixture' ? command.scenario : command.action, identity, JSON.stringify(event), outcome, order.id, workspace, row.revision, target.account, target.environment, workspace, user.id),
    ...additional,
    db.prepare(`UPDATE creator_orders SET order_json=?,payment_state=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM creator_order_events WHERE workspace_id=? AND operation=? AND digest=?) AND ${authority}`).bind(JSON.stringify(next), next.payment, order.id, workspace, row.revision, workspace, command.operation, identity, workspace, user.id),
  ]);
  const stored = await db.prepare('SELECT digest,order_id FROM creator_order_events WHERE workspace_id=? AND operation=?').bind(workspace, command.operation).first<{ digest: string; order_id: string }>();
  if (!stored || stored.digest !== identity || stored.order_id !== order.id) throw conflict();
}

export async function manageOrders(ctx: Context, runtime: Runtime) {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role)) throw new StackError('FORBIDDEN', 'A signed-in Composer creator is required.', 403);
    if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB) throw new StackError('UNAVAILABLE', 'Orders are disconnected in this environment.');
    const writing = ctx.request.method === 'POST';
    if ((!writing && ctx.request.method !== 'GET') || (writing && (ctx.request.headers.get('Origin') !== origin || ctx.request.headers.get('X-EmDash-Request') !== '1')) || (!writing && ctx.request.headers.has('Origin') && ctx.request.headers.get('Origin') !== origin)) throw new StackError('FORBIDDEN', 'Open Orders from Composer administration.', 403);
    const command = writing ? orderCommand.parse(ctx.input) : readInput.parse(ctx.input);
    const target = installation(runtime), db = runtime.DB, user = ctx.user;
    const workspace = await resolveWorkspace(db, user, command.workspace ?? null);
    requireCapability(workspace.role, writing ? 'save' : 'read');
    if (command.action === 'create-fixture') await createFixture(db, user, workspace.id, target, command);
    else if (command.action !== 'list') await applyFixture(db, user, workspace.id, target, command);
    const result = await snapshot(db, workspace, target);
    requireCapability(await membership(db, workspace.id, user.id), writing ? 'save' : 'read');
    return result;
  } catch (cause) {
    return cause instanceof StackError ? { ok: false as const, code: cause.code, message: cause.message }
      : cause instanceof z.ZodError ? { ok: false as const, code: 'INVALID', message: 'Choose a supported fictional order and valid fields. Provider events, amounts, secrets and production actions cannot be supplied here.' }
      : { ok: false as const, code: 'UNAVAILABLE', message: 'This order operation could not be confirmed. Keep its identity and refresh history before another attempt.' };
  }
}

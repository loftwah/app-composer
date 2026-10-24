import { z } from 'zod';

export const orderVersion = 'composer.order/1';
const scopedID = z.string().regex(/^[a-z0-9-]{6,64}$/);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const amount = z.number().int().min(0).max(1000000000);
export const paymentState = z.enum(['unpaid', 'pending', 'paid', 'failed', 'cancelled', 'expired', 'partially-refunded', 'refunded']);
export const paymentLabels = { unpaid: 'Waiting for payment', pending: 'Payment pending', paid: 'Payment received', failed: 'Payment failed', cancelled: 'Checkout cancelled', expired: 'Checkout expired', 'partially-refunded': 'Partly refunded', refunded: 'Refunded' } as const;
export const orderProvider = z.enum(['stripe', 'paypal', 'shopify']);
export const orderDocument = z.object({
  version: z.literal(orderVersion), id: z.uuid(), workspace: scopedID, app: scopedID,
  checkoutOwner: z.enum(['custom', 'shopify']), provider: orderProvider,
  providerAccount: z.string().min(1).max(80), environment: z.enum(['fixture', 'test', 'live']),
  proof: z.enum(['fixture', 'sandbox', 'production']),
  title: z.string().min(1).max(120), amount, currency: z.string().regex(/^[A-Z]{3}$/),
  payment: paymentState, refundedAmount: amount,
  attempt: z.object({ id: z.uuid(), providerReference: z.string().max(120).nullable(), observationRevision: revision }).strict(),
  fulfilmentOwner: z.enum(['none', 'shopify-native', 'composer-printful']),
  fulfilment: z.enum(['not-requested', 'draft', 'submitted', 'unknown', 'failed', 'cancelled']),
}).strict().superRefine((order, ctx) => {
  if ((order.provider === 'shopify') !== (order.checkoutOwner === 'shopify')) ctx.addIssue({ code: 'custom', message: 'Shopify owns its checkout; custom payment providers cannot charge Shopify orders.' });
  if (order.fulfilmentOwner === 'shopify-native' && order.checkoutOwner !== 'shopify') ctx.addIssue({ code: 'custom', message: 'Native Shopify fulfilment requires a Shopify checkout.' });
  if (order.refundedAmount > order.amount) ctx.addIssue({ code: 'custom', message: 'Refund exceeds the original amount.' });
  if ((order.refundedAmount > 0) !== ['partially-refunded', 'refunded'].includes(order.payment) || (order.payment === 'refunded' && order.refundedAmount !== order.amount) || (order.payment === 'partially-refunded' && order.refundedAmount >= order.amount)) ctx.addIssue({ code: 'custom', message: 'Payment state and retained refund amount disagree.' });
  if ((order.proof === 'fixture' && order.environment !== 'fixture') || (order.proof === 'sandbox' && order.environment !== 'test') || (order.proof === 'production' && order.environment !== 'live')) ctx.addIssue({ code: 'custom', message: 'Payment environment and evidence scope disagree.' });
  if (order.environment !== 'live' && order.fulfilment === 'submitted') ctx.addIssue({ code: 'custom', message: 'Test orders cannot reach production fulfilment.' });
});
export type OrderDocument = z.infer<typeof orderDocument>;

export const orderObservation = z.object({
  version: z.literal('composer.order-event/1'), id: z.uuid(), order: z.uuid(), workspace: scopedID,
  provider: orderProvider, providerAccount: z.string().min(1).max(80), environment: z.enum(['fixture', 'test', 'live']),
  attempt: z.uuid(), amount, currency: z.string().regex(/^[A-Z]{3}$/),
  observationRevision: revision.refine(value => value > 0),
  kind: z.enum(['checkout.completed', 'payment.current-state', 'refund.current-state']),
  state: paymentState, refundedAmount: amount,
  providerState: z.string().min(1).max(80),
}).strict();
export type OrderObservation = z.infer<typeof orderObservation>;

/** Apply an adapter's current-state observation, not raw webhook order or a
 * browser redirect. Native routes never accept this object from the caller. */
export function reduceOrder(value: unknown, observation: unknown): { order: OrderDocument; outcome: 'applied' | 'ignored-stale' } {
  const order = orderDocument.parse(value), event = orderObservation.parse(observation);
  if (event.order !== order.id || event.workspace !== order.workspace || event.provider !== order.provider || event.providerAccount !== order.providerAccount || event.environment !== order.environment || event.attempt !== order.attempt.id || event.amount !== order.amount || event.currency !== order.currency) throw Error('The payment observation does not match the exact order, attempt, account, environment and amount.');
  if (event.observationRevision <= order.attempt.observationRevision) return { order, outcome: 'ignored-stale' };
  // Completion is not proof of funds, particularly for delayed methods. Only
  // the server adapter's retrieved current payment state may establish paid.
  if (event.kind === 'checkout.completed' && event.state === 'paid') throw Error('Checkout completion alone cannot establish payment.');
  if (order.payment === 'paid' && !['paid', 'partially-refunded', 'refunded'].includes(event.state)) throw Error('A later checkout or failed-attempt event cannot undo an established payment.');
  if ((event.kind === 'refund.current-state') !== ['partially-refunded', 'refunded'].includes(event.state)) throw Error('Refund states need a current refund observation.');
  if (event.kind === 'refund.current-state' && !['paid', 'partially-refunded', 'refunded'].includes(order.payment)) throw Error('A refund needs an established payment.');
  if (event.refundedAmount < order.refundedAmount || event.refundedAmount > order.amount) throw Error('Refund information regressed or exceeds the order.');
  if (order.refundedAmount > 0 && !['partially-refunded', 'refunded'].includes(event.state)) throw Error('A payment observation cannot undo a recorded refund.');
  if ((event.state === 'refunded' && event.refundedAmount !== order.amount) || (event.state === 'partially-refunded' && (event.refundedAmount <= 0 || event.refundedAmount >= order.amount))) throw Error('Refund state and amount disagree.');
  return { order: orderDocument.parse({ ...order, payment: event.state, refundedAmount: event.refundedAmount, attempt: { ...order.attempt, observationRevision: event.observationRevision } }), outcome: 'applied' };
}

export const fixtureScenarios = ['checkout-unpaid', 'payment-paid', 'payment-failed', 'cancelled', 'expired', 'part-refunded', 'refunded'] as const;
export type FixtureScenario = typeof fixtureScenarios[number];
export function fixtureObservation(order: OrderDocument, scenario: FixtureScenario, operation: string): OrderObservation {
  if (order.proof !== 'fixture' || order.environment !== 'fixture' || !order.providerAccount.startsWith('fixture-')) throw Error('The fixture adapter cannot touch provider-backed orders.');
  const state = ({ 'checkout-unpaid': 'pending', 'payment-paid': 'paid', 'payment-failed': 'failed', cancelled: 'cancelled', expired: 'expired', 'part-refunded': 'partially-refunded', refunded: 'refunded' } as const)[scenario];
  return orderObservation.parse({ version: 'composer.order-event/1', id: operation, order: order.id, workspace: order.workspace, provider: order.provider, providerAccount: order.providerAccount, environment: 'fixture', attempt: order.attempt.id, amount: order.amount, currency: order.currency, observationRevision: order.attempt.observationRevision + 1, kind: scenario === 'checkout-unpaid' ? 'checkout.completed' : scenario.includes('refund') ? 'refund.current-state' : 'payment.current-state', state, refundedAmount: scenario === 'refunded' ? order.amount : scenario === 'part-refunded' ? Math.floor(order.amount / 2) : order.refundedAmount, providerState: `fictional.${scenario}` });
}
export const orderCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create-fixture'), workspace: scopedID, operation: z.uuid(), provider: orderProvider, fulfilmentOwner: z.enum(['none', 'shopify-native', 'composer-printful']) }).strict(),
  z.object({ action: z.literal('observe-fixture'), workspace: scopedID, order: z.uuid(), operation: z.uuid(), expectedRevision: revision.refine(value => value > 0), scenario: z.enum(fixtureScenarios) }).strict(),
  z.object({ action: z.enum(['timeout-fixture', 'reconcile-fixture', 'prepare-fixture-draft']), workspace: scopedID, order: z.uuid(), operation: z.uuid(), expectedRevision: revision.refine(value => value > 0) }).strict(),
]);
export const orderView = z.object({
  order: orderDocument, revision: revision.refine(value => value > 0), createdAt: z.string().max(40),
  events: z.array(z.object({ operation: z.uuid(), kind: z.string().max(80), outcome: z.enum(['applied', 'ignored-stale']), createdAt: z.string().max(40) }).strict()).max(30),
  actions: z.array(z.object({ id: z.uuid(), kind: z.enum(['create-checkout', 'prepare-fulfilment']), state: z.enum(['prepared', 'unknown', 'succeeded', 'failed']), providerReference: z.string().max(120).nullable(), revision }).strict()).max(2),
}).strict();
export const ordersSnapshot = z.object({
  ok: z.literal(true), version: z.literal(orderVersion),
  workspace: z.object({ id: scopedID, name: z.string().max(80), role: z.enum(['owner', 'editor', 'viewer']) }),
  installation: z.object({ account: z.string().min(1).max(80), environment: z.string().min(1).max(40) }).strict(),
  orders: z.array(orderView).max(50), limit: z.literal(200), providerConnection: z.literal('not-qualified'),
}).strict();
export type OrdersSnapshot = z.infer<typeof ordersSnapshot>;
export type OrderView = z.infer<typeof orderView>;

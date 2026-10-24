import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { paymentLabels, fixtureScenarios, type FixtureScenario, type OrdersSnapshot, type OrderView } from '../lib/order-contract';
import { ordersCall } from './orders/api';
import { workspaceSelection } from './stacks/workspace-scope';
import './orders-page.css';

const scenarioLabels: Record<FixtureScenario, string> = {
  'checkout-unpaid': 'Completed checkout · payment pending', 'payment-paid': 'Current payment is paid',
  'payment-failed': 'Payment failed', cancelled: 'Checkout cancelled', expired: 'Checkout expired',
  'part-refunded': 'Half the amount refunded', refunded: 'Full amount refunded',
};
function money(view: OrderView) {
  try {
    const formatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: view.order.currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(view.order.amount / 10 ** digits);
  } catch { return `${view.order.amount} minor units ${view.order.currency}`; }
}
export function OrdersPage() {
  const search = useLocation({ select: location => location.searchStr });
  return <Orders key={search} search={search} />;
}
export function Orders({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<OrdersSnapshot>();
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [provider, setProvider] = useState<'stripe' | 'paypal' | 'shopify'>('stripe');
  const [fulfilment, setFulfilment] = useState<'none' | 'shopify-native' | 'composer-printful'>('none');
  const [scenario, setScenario] = useState<FixtureScenario>('checkout-unpaid');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [manual, setManual] = useState('');
  const pending = useRef(false), live = useRef(true), generation = useRef(0), invalidScope = useRef(false);
  const selection = useRef<string | undefined>(undefined);
  const operations = useRef<Record<string, string>>({});
  const canWrite = Boolean(snapshot && snapshot.workspace.role !== 'viewer');
  const current = snapshot?.orders.find(view => view.order.id === selected);
  const shown = snapshot?.orders.filter(view => (providerFilter === 'all' || view.order.provider === providerFilter) && (filter === 'all' || (filter === 'attention' ? ['failed', 'cancelled', 'expired'].includes(view.order.payment) || view.actions.some(action => action.state === 'unknown' || action.state === 'failed') : filter === 'paid' ? view.order.payment === 'paid' : ['unpaid', 'pending'].includes(view.order.payment)))) ?? [];

  async function run(action: string, fields: Record<string, unknown> = {}, message = '') {
    if (pending.current || invalidScope.current) return false;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    const epoch = ++generation.current;
    try {
      const result = await ordersCall(action, selection.current, fields);
      if (!live.current || epoch !== generation.current) return false;
      selection.current = result.workspace.id;
      const fresh = result.orders.find(view => !snapshot?.orders.some(old => old.order.id === view.order.id));
      setSnapshot(result);
      if (action === 'create-fixture' && fresh) { setSelected(fresh.order.id); setFilter('all'); setProviderFilter('all'); }
      else setSelected(previous => previous || result.orders[0]?.order.id || '');
      if (message) setNotice(message);
      return true;
    } catch (cause) {
      if (live.current && epoch === generation.current) setError(cause instanceof Error ? cause.message : 'The order could not be confirmed. Refresh its persisted history.');
      return false;
    } finally { if (live.current && epoch === generation.current) { pending.current = false; setBusy(false); } }
  }
  useEffect(() => {
    live.current = true;
    try { selection.current = workspaceSelection(search); void run('list'); }
    catch (cause) { invalidScope.current = true; setError(cause instanceof Error ? cause.message : 'Choose a workspace from Workspace access.'); }
    return () => { live.current = false; generation.current++; pending.current = false; };
  }, []);
  async function mutate(action: string, view?: OrderView) {
    const key = `${action}:${view?.order.id ?? `${provider}:${fulfilment}`}:${action === 'observe-fixture' ? scenario : ''}`;
    operations.current[key] ??= crypto.randomUUID();
    const fields = action === 'create-fixture' ? { provider, fulfilmentOwner: fulfilment } : { order: view!.order.id, expectedRevision: view!.revision, ...(action === 'observe-fixture' ? { scenario } : {}) };
    if (await run(action, { ...fields, operation: operations.current[key] }, 'The fictional operation was saved. No provider was contacted and no financial or production action occurred.')) delete operations.current[key];
  }
  async function copy(view: OrderView) {
    const text = `Fictional order · ${view.order.title}\n${money(view)} ${view.order.currency}\n${paymentLabels[view.order.payment]} · Fixture\nFulfilment: ${view.order.fulfilment}\nOrder: ${view.order.id}\nNo merchant connection or financial transaction was used.`;
    try { await navigator.clipboard.writeText(text); setNotice('Fictional order summary copied. Its evidence scope is included.'); setManual(''); }
    catch { setManual(text); setNotice('Your browser could not copy this. Select the summary below and copy it manually.'); }
  }
  function download(view: OrderView) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(view, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `fictional-order-${view.order.id}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="composer-orders" aria-busy={busy}>
    <div className="or-heading"><div><h1>Orders</h1><p>Inspect payment, fulfilment and the next safe action.</p></div><button type="button" disabled={busy || invalidScope.current} onClick={() => void run('list', {}, 'Saved orders and operation history refreshed.')}>Refresh</button></div>
    <p className="or-scope">{snapshot ? <>Workspace <strong>{snapshot.workspace.name}</strong> · {snapshot.workspace.role} · installation <strong>{snapshot.installation.environment}</strong></> : 'Confirming the selected workspace…'}</p>
    <p className="or-proof"><strong>Fictional order lab. No merchant is connected.</strong> These records exercise the shared order and recovery contract. They are fixture proof, with no hosted provider checkout, webhook verification or financial transaction.</p>
    <div className="or-links"><a href="/prompts#stripe">Prepare Stripe sandbox setup</a><a href="/prompts#shopify">Prepare a Shopify connection</a><a href="/_emdash/admin/composer-stacks/workspaces">Workspace access</a></div>
    {error && <p className="or-error" role="alert">{error}</p>}
    <p className="or-status" role="status">{busy ? 'Checking the saved order and operation…' : notice}</p>
    {snapshot && <>
      <details className="or-create"><summary>Try a fictional order</summary><p>The fixture product is a reading-club guide, AUD 12.00. Its amount is server-owned. A fixture does not grant payment or fulfilment authority.</p><div className="or-controls"><label>Checkout provider<select value={provider} disabled={busy || !canWrite} onChange={event => { const value = event.target.value as typeof provider; setProvider(value); if (value !== 'shopify' && fulfilment === 'shopify-native') setFulfilment('none'); }}><option value="stripe">Stripe fixture · custom-app checkout</option><option value="paypal">PayPal fixture · custom-app checkout</option><option value="shopify">Shopify fixture · Shopify owns checkout</option></select></label><label>Fulfilment owner<select value={fulfilment} disabled={busy || !canWrite} onChange={event => setFulfilment(event.target.value as typeof fulfilment)}><option value="none">No fulfilment adapter</option><option value="composer-printful">Composer → Printful draft fixture</option>{provider === 'shopify' && <option value="shopify-native">Existing native Shopify fulfilment</option>}</select></label><button type="button" disabled={busy || !canWrite} onClick={() => void mutate('create-fixture')}>Create fictional order</button></div></details>
      <div className="or-controls or-filters"><label>Show<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All recent orders</option><option value="pending">Waiting or pending</option><option value="paid">Payment received</option><option value="attention">Needs attention</option></select></label><label>Provider<select value={providerFilter} onChange={event => setProviderFilter(event.target.value)}><option value="all">All providers</option><option value="stripe">Stripe</option><option value="paypal">PayPal</option><option value="shopify">Shopify</option></select></label><p>{shown.length} shown · latest 50 · limit {snapshot.limit} per workspace</p></div>
      <div className="or-workspace"><section className="or-list" aria-label="Choose an order">
        {!shown.length && <p className="or-empty">{snapshot.orders.length ? 'No orders match these filters. Choose All recent orders to see the saved records.' : 'No orders yet. Open Try a fictional order to inspect payment and recovery safely.'}</p>}
        {shown.map(view => <button key={view.order.id} type="button" className="or-row" aria-pressed={selected === view.order.id} onClick={() => { setSelected(view.order.id); setManual(''); }}><span><strong>{view.order.title}</strong><small>{view.order.provider} · {view.order.checkoutOwner === 'shopify' ? 'Shopify checkout' : 'Custom-app checkout'}</small></span><span><b>{money(view)}</b><small>{paymentLabels[view.order.payment]} · Fixture</small></span></button>)}
      </section><section className="or-detail" aria-label="Selected order">
        {current ? <>
          <div className="or-heading"><h2>{current.order.title}</h2><strong>{money(current)} {current.order.currency}</strong></div>
          <p className="or-payment"><strong>{paymentLabels[current.order.payment]}</strong> · Fictional fixture</p>
          <dl className="or-facts"><dt>Checkout owner</dt><dd>{current.order.checkoutOwner === 'shopify' ? 'Shopify — do not add a separate Stripe or PayPal charge' : `This app, with ${current.order.provider}`}</dd><dt>Fulfilment</dt><dd>{current.order.fulfilment} · {current.order.fulfilmentOwner}</dd><dt>Evidence</dt><dd>Deterministic fixture. No vendor checkout or dashboard link.</dd><dt>Payment environment</dt><dd>{current.order.environment} · {current.order.providerAccount}</dd></dl>
          {current.actions.some(action => action.state === 'unknown') && <p className="or-error">The fixture checkout result is unknown. Reconcile its existing action before any repetition. A second checkout is not offered.</p>}
          <div className="or-actions"><button type="button" disabled={busy} onClick={() => void copy(current)}>Copy summary</button><button type="button" disabled={busy} onClick={() => download(current)}>Export order JSON</button></div>
          <details className="or-scenarios"><summary>Exercise a fixture state</summary><p>These commands use deterministic fictional observations. They do not call {current.order.provider}, verify a real signature or establish sandbox acceptance.</p><label>Observed scenario<select value={scenario} disabled={busy || !canWrite} onChange={event => setScenario(event.target.value as FixtureScenario)}>{fixtureScenarios.map(value => <option key={value} value={value}>{scenarioLabels[value]}</option>)}</select></label><div className="or-actions"><button type="button" disabled={busy || !canWrite} onClick={() => void mutate('observe-fixture', current)}>Apply fictional observation</button>{current.actions.some(action => action.kind === 'create-checkout' && action.state === 'prepared') && <button type="button" disabled={busy || !canWrite} onClick={() => void mutate('timeout-fixture', current)}>Simulate checkout timeout</button>}{current.actions.some(action => action.kind === 'create-checkout' && action.state === 'unknown') && <button type="button" disabled={busy || !canWrite} onClick={() => void mutate('reconcile-fixture', current)}>Reconcile existing fixture action</button>}{current.order.payment === 'paid' && current.order.fulfilmentOwner === 'composer-printful' && current.order.fulfilment === 'not-requested' && <button type="button" disabled={busy || !canWrite} onClick={() => void mutate('prepare-fixture-draft', current)}>Prepare fictional Printful draft</button>}</div><p>Draft preparation does not submit a Printful production order. Refunds do not establish that a fulfilment order was cancelled.</p></details>
          <section className="or-history"><h3>Actions and recovery</h3>{current.actions.map(action => <div key={action.id}><strong>{action.kind === 'create-checkout' ? 'Create checkout' : 'Prepare fulfilment draft'}</strong><span>{action.state}</span><p>{action.state === 'prepared' ? 'Prepared fixture identity; no external checkout has been created.' : action.state === 'unknown' ? 'Completion is uncertain. Reconcile the existing action; do not create another.' : 'The fictional action was reconciled or its draft persisted. No vendor request was sent.'}</p></div>)}</section>
          <details className="or-diagnostics"><summary>Order identity and event history</summary><dl className="or-facts"><dt>Order</dt><dd><code>{current.order.id}</code> · revision {current.revision}</dd><dt>App</dt><dd>{current.order.app}</dd><dt>Payment attempt</dt><dd><code>{current.order.attempt.id}</code></dd><dt>Provider reference</dt><dd><code>{current.order.attempt.providerReference ?? 'Unavailable — no provider checkout'}</code></dd><dt>Refund</dt><dd>{current.order.refundedAmount} minor units · {current.order.currency}</dd><dt>Installation account</dt><dd><code>{snapshot.installation.account}</code></dd></dl><ol>{current.events.map(event => <li key={event.operation}><strong>{event.kind}</strong> · {event.outcome}<small>{event.createdAt} UTC · <code>{event.operation}</code></small></li>)}</ol>{!current.events.length && <p>No observations yet. A browser return alone would not mark this order paid.</p>}</details>
        </> : <p>Choose an order to inspect its amount, payment state and recovery history.</p>}
      </section></div>
    </>}
    {manual && <label className="or-manual">Manual copy — select the fictional summary<textarea rows={8} value={manual} readOnly onFocus={event => event.target.select()} /></label>}
  </div>;
}

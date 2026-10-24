# Orders and commerce foundation

The native EmDash **Orders** page now reads durable, workspace-scoped order,
payment-attempt, event and action records. Its current creation and state controls
are explicitly fictional fixtures. No merchant connection, hosted checkout,
provider webhook, payment, refund or Printful order is exercised by this release.

## Try the supported journey

1. Open Orders from the existing selected workspace. Check its installation
   environment. Open **Try a fictional order**, choose the provider/fulfilment
   owner and create the AUD 12.00 reading-club guide fixture.
2. Open the order. Apply **Completed checkout · payment pending**: the order stays
   pending, with no fulfilment. Apply **Current payment is paid** to exercise the
   fixture's retrieved-current-state boundary. The row and details retain the
   **Fictional fixture** label.
3. With Composer–Printful selected, a paid fixture can prepare one **fictional
   draft**. There is no production-confirm control or server command. A refund
   updates payment/refund information; it does not pretend fulfilment was cancelled.
4. Create another fixture and **Simulate checkout timeout**. The persisted action
   becomes unknown. **Reconcile existing fixture action** records the known
   fictional session against the same attempt/action. It creates no second
   checkout and never marks the payment paid merely from that reconciliation.
5. Refresh/reopen to inspect the retained state. Filter by pending, paid, needs
   attention or provider; inspect operation identities in Details; copy a labelled
   summary or export the bounded order JSON.

Only a project's existing editor/owner membership permits mutation. Viewers can
read/export within their selected workspace. Origin/native-request checks protect
writes. Installation account/environment comes from the server, not imported
order data. A different installation target cannot read or replay these records.

## Shared contract

`src/lib/order-contract.ts` owns strict `composer.order/1` and
`composer.order-event/1` schemas. They retain app/workspace, provider account,
payment environment, proof class, local order/payment-attempt identity, amount,
currency, payment/refund state, checkout ownership and fulfilment ownership.

Shopify owns Shopify checkout; it cannot be charged again through a custom Stripe
or PayPal attempt. Native Shopify fulfilment is distinct from an explicitly
selected Composer–Printful draft. Non-live orders cannot be submitted to production
fulfilment. Fixture functions reject provider-backed order records.

The reducer accepts a server adapter's current-state observation. The native
browser route cannot submit raw events, amounts, provider accounts, credentials or
an assertion that something is paid. Event and order scope, attempt, amount and
currency must match exactly. Older observation revisions are ignored; an
established payment/refund cannot regress from a later checkout or failure event.
Observation revisions belong to the trusted adapter's reconciliation process,
not webhook arrival order or a guessed Stripe event sequence.

## Durable identity and recovery

`0014_orders.sql` adds records to the existing Composer D1:

- `creator_orders`: exact scope, creation operation, version and validated order.
- `creator_order_events`: unique workspace/operation identity, request digest,
  bounded observation and applied/ignored result.
- `creator_order_actions`: one stable identity per order/action, with prepared,
  unknown, succeeded or failed state and its provider reference.

An event, corresponding action and current order revision update in one D1 batch.
SQL predicates recheck membership and expected revision at the write boundary.
Replaying an identical operation returns its saved result; changing its payload
under the same identity conflicts. An uncertain action must be reconciled before
repetition. No automatic retry of unknown financial effects exists.

The view shows the latest 50 orders and latest 30 events per order. Fixture
creation stops at 200 retained orders per workspace; fixture observations stop at
100 per order. No user/source data is automatically removed. These records contain
fictional product data only, with no customer/contact fields or secret values.
Exports are records, not restoration or execution instructions. A future real
provider adapter needs an explicit privacy, retention and permission review.

## Provider qualification still required

The sandbox checkout-to-verified-order journey remains open under #294. Before
claiming it: select and verify an authorised Stripe sandbox/account/API version;
configure secret references through supported server-side Connections; create
hosted sessions from server-owned prices; verify signatures on the exact raw
body through the supported Stripe library; retrieve current account/session/
payment state; test delayed methods, duplicates/reordering, cancellation,
expiration, revocation and uncertainty. Connect the actual order exception to
Inbox/notification only after that boundary is qualified.

Stripe's [fulfilment guidance](https://docs.stripe.com/checkout/fulfillment)
distinguishes completed checkout from delayed payment success. Its
[webhook guidance](https://docs.stripe.com/webhooks) requires the original raw
body for signature verification. Its [idempotency reference](https://docs.stripe.com/api/idempotent_requests)
describes provider keys and their retention; durable local action identity and
reconciliation remain necessary. Those documents were checked on 24 October
2026. No provider SDK/API version is represented as installed or qualified here.

Shopify development-store checkout/scopes, PayPal sandbox approval/capture and
Printful unconfirmed provider drafts each retain their own acceptance. The
matching public prompts `/prompts#stripe`, `#shopify`, `#paypal` and `#printful`
remain labelled **Assess and prepare**. No real financial transaction,
production fulfilment, account change or new paid commitment is authorised by
the fixture UI or exported records.

## Local verification

```sh
node --test tests/orders.test.mjs
```

The focused tests exercise the exact native route with FK-enabled in-memory
SQLite plus deterministic provider fixtures: completion without paid funds,
delayed success, stale observations, refunds, exact-scope mismatches, duplicate
creation/events, changed idempotency payload, uncertainty/reconciliation,
fulfilment ownership, production-confirm rejection, CSRF, viewer permissions and
membership revocation immediately before the transaction. Fixture proof is
separate from provider sandbox, hosted native-admin and physical-device proof.

# The owner inbox journey

One journey joins the app-owned private brief to Composer's workflow run and its
separate owner-notice delivery record:

1. A visitor submits a fictional enquiry; Guestbook confirms the exact receipt.
2. Composer records a body-free `queued` workflow event for that intent.
3. The owner reads the actual brief in the Inbox and can process the event.
4. Processing prepares the owner notice idempotently, or records why it cannot.
5. Delivery is a separate explicit owner action with its own recorded outcome.
6. A failure or an unknown outcome stays visible with only the supported next
   action.

The brief itself is never copied into Composer's workflow or outbox rows.
Guestbook still owns the text, consent and retention. The journey reads the
app-owned export for the brief and Composer D1 for the run and outbox metadata.

## State model

The model has three independent states. The UI shows all three together so a
delivery outcome cannot be mistaken for review state, and vice versa.

### Enquiry (Guestbook-owned)

| Stored status | Displayed | Next action |
| --- | --- | --- |
| `pending` | New | Mark reviewed (owner/editor) |
| `reviewed` | Reviewed | No review action; delete/reject remain available |
| `rejected` | Rejected | No review action; delete remains available |

“Reviewed” is an owner decision. It is not a reply, sale, contact or
conversion, and it does not send mail. Deleting clears the submitted text
immediately; the bounded operation receipt remains until expiry.

### Workflow run (Composer-owned)

| State | Meaning | Supported next action |
| --- | --- | --- |
| `unlinked` | No exact receipt-to-brief link was proven | None; the brief stays readable |
| `queued` | Event identity retained; processing is explicit | Process this enquiry |
| `running` | A processing claim exists but no outcome was recorded | Re-check processing (idempotent; no provider) |
| `finished` | Scope checked and the notice prepared, or notifications are off | None; move to delivery or review |
| `failed` | A specific local reason was recorded | Retry processing while attempts remain, otherwise none |

**Receipt identity and brief identity are different.** The receipt hook knows the
submission intent; the pinned Guestbook export exposes each retained brief by its
own item id and does not include that intent. At submission, Composer therefore
looks for **exactly one pending export item** in the same scope with the same
submission values. Exactly one match records that item id on the run and outbox;
zero or multiple matches stay `unlinked` and offer no processing or delivery
action. No brief text is stored in Composer; the stored mapping is only the item
id. A future Guestbook export that carries the receipt intent can replace this
bounded match without changing the journey states.

Processing is on demand. There is no scheduler or automatic provider effect.
Each run stores its exact workspace, app resource, account, environment, target,
actor kind and actor id. A member retry updates the actor; the original receipt
hook is recorded as the `system` actor `receipt`.

Attempts are bounded at three. A duplicate confirmed receipt never increments
the attempt count and a finished run is not reprocessed. Processing calls the
same idempotent notice preparation as the receipt hook, so a retry cannot create
a second outbox row.

### Delivery (Composer outbox)

| Displayed | Stored outbox | Meaning | Supported next action |
| --- | --- | --- | --- |
| Not configured | no row, or `blocked` | Owner mail is off/absent, or no notice exists | Configure mail outside this page; no send |
| Ready to send | `queued`, 0 attempts | Notice prepared for a ready owner connection | Send the owner notice (owner only) |
| Attempt in progress | `sending` | A durable claim exists; outcome not recorded | Reconcile only |
| Accepted by provider | `accepted` | Provider returned a message identity | None; no resend |
| Outcome uncertain | `uncertain` | Timeout, interruption or no usable identity | Reconcile only; no resend |
| Send failed | `failed` | Definite provider refusal | Retry with the same key while attempts remain |

`ready` is the one state named beyond the five required delivery states; it
distinguishes a prepared notice with a usable owner connection from an
unconfigured one. It is not a provider health or delivery claim.

## Reliability rules

**Idempotency.** `creator_enquiry_workflow_runs` has one row per
workspace/resource/event/account/environment/target. The outbox retains
`UNIQUE(workspace_id,resource_id,event_id,version)` from migration 0013.
Concurrent or repeated receipt hooks use `INSERT OR IGNORE`; repeated
processing returns the finished record unchanged.

**Bounded retries.** A workflow run stops after three processing attempts. A
delivery stops after three provider attempts. A definite provider refusal
(400/401/403/404/405/413/415/422/429) is `failed`; an interrupted or identity-less
response is `uncertain`. Only `queued`, `blocked` and `failed` rows are offered
for send. `accepted`, `uncertain` and `sending` are refused with a specific
message before any provider call.

**Same message identity.** Every retry reuses
`composer-enquiry-v1/<outbox row id>`. The provider therefore sees one operation
even when the local attempt count increases.

**Reconciliation.** `Re-check`/`Reconcile` re-reads the persisted row, records
`reconciled_at` and increments `reconciliations`, and never contacts the
provider or changes an unknown outcome to success. Repeating it is harmless. A
`state='sending'` row keeps its state during reconciliation, so a concurrent
send that later records its own outcome cannot be overwritten.

**Scoped actors.** The journey read and every action re-resolve workspace
membership, select the exact owned Guestbook resource and verify the app export
after the remote wait. A changed account/environment/target, a foreign resource,
a viewer session or revoked membership is refused. Only the workspace owner can
send or reconcile; owners and editors can read and process. The run records the
actor and exact scope rather than a browser-supplied scope.

**Meaningful, non-secret errors.** Failure reasons name the supported cause:
owner access revoked, notice not prepared, provider status class, unknown
outcome. Provider response bodies, API keys, sender/recipient addresses and
brief text are never written to the run/outbox metadata. The UI shows a
12-character SHA-256 fingerprint of the destination digest instead of an
address.

## Routes and storage

- `journeyRead` (`GET`) and `journeyWrite` (`POST`) on the existing
  `composer-stacks` native plugin; the same creator permission, origin and
  `X-EmDash-Request` checks as the rest of the admin.
- `0017_inbox_journey.sql` adds the workflow run table and the reconciliation
  columns. Migration 0013 remains the outbox/preference owner.
- A workspace retains at most 500 enquiry runs. At the limit, existing runs
  remain readable and new receipts are not recorded; the Inbox then offers a
  local repair that reports the missing record rather than inventing one.
- Neither the run nor the notification metadata has automatic expiry in this
  slice. Deleting the app resource cascades both. Guestbook's 30-day body and
  35-day operation-receipt retention remain separate.
- The Inbox read still uses the existing app-owned export. There is no
  parallel enquiry store.

## What is proven and what is not

Deterministic local tests and the rendered fixture prove the state transitions,
idempotency, scope refusal, error text, reconciliation and bounded retry with a
fictional provider transport. They do not prove:

- real Resend delivery, provider callbacks, bounce/suppression or reading;
- inbound mail or replies (no incoming-mail adapter exists);
- an authenticated production click-through of this new build;
- a scheduler or automatic event processing;
- physical phone, touch or screen-reader acceptance;
- that the recipient identity remains a verified owner at a future provider
  account change.

## Verification

```sh
node --test tests/inbox-journey.test.mjs tests/migration-order.test.mjs
node --test tests/private-enquiries.test.mjs tests/enquiry-notifications.test.mjs
```

The rendered acceptance captures and their exact measurements are in
[`docs/evidence/inbox-workflow-20261025/`](evidence/inbox-workflow-20261025/README.md).

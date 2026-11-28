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

## Reply job — one draft, one exact approval, one manual export (#598)

This slice ships the draft, approval, receipt and safe-replay path. It does not
send email. The only dispatch is an explicit manual export that records a
receipt saying Composer did not send the reply. The current no-contact form
(`contacts: false`, v1 export) stays exactly as it is and offers no reply.

### Consent comes only from the versioned form

Reply eligibility requires a `guestbook.private-enquiries/v2` export item with a
`reply` object: version `2`, the consented and expiry timestamps, and the
app-owned recipient. A v1 item has no such object, so no reply job, draft,
approval or export action is available. An item that carries reply consent under
a v1 format is rejected by `enquiryExport`.

The pinned Guestbook source does not serve this v2 export yet, so production
still shows no reply action. The deterministic fixture in
`tests/enquiry-reply.test.mjs` exercises the exact contract. Shipping the
Guestbook-owned consented form and receipt remains a separate release boundary.

### One job per exact brief

`0030_enquiry_reply_jobs.sql` adds one Composer-owned job row keyed by
`UNIQUE(workspace_id, resource_id, item_id, account_id, environment)`. An
accepted receipt that links to exactly one consented item prepares the job with
no draft. A duplicate link, replayed request or concurrent submit cannot create a
second row. If that best-effort preparation fails, the explicit draft path
creates the same one row. Guestbook still owns the brief, consent and recipient.
Composer stores no enquiry body, no recipient address (only its SHA-256 digest)
and no provider identity.

The job records the exact brief revision and a source digest over the item's
values, provenance, producer source and private-delivery consent. The draft also
records its generator (`owner` or `agent`) and an optional agent identity. The
provenance label is recorded, not a claim that an agent runtime was invoked.

### States and supported action

| Stored / displayed | Meaning | Supported next action |
| --- | --- | --- |
| `draft` | A saved draft revision; no approval | Owner approves the exact text |
| `approved` | Approval bound to the draft digest, brief revision, consent and recipient | Owner exports manually |
| `exported` | A manual handoff and receipt exist; Composer sent nothing | None; the receipt is retained |
| `invalidated` | The approval no longer matches the current text, brief, consent, recipient or expiry | Owner approves the current draft again |
| `declined` | The owner declined before export | None |

`replyJourney` also returns `unavailable` when the form has no reply consent, the
consent expired, or the brief was rejected. That is a display state, not a new
stored job state. An editor may read and save drafts; only the workspace owner
may approve, export or decline. A viewer cannot read the journey at all.

### Approval binds the exact revision

`replyApprove` requires the current draft revision and digest. In one write it
records:

- the draft revision and SHA-256 of the exact body;
- the brief revision and source digest;
- the repository scope (workspace, resource, account, environment, target);
- the approving owner;
- the consent version, consented-at, expiry and recipient digest;
- an approval UUID, its timestamp and a 24-hour expiry;
- a composite SHA-256 over all of those values.

The approval performs no provider call. Repeating the same approval returns the
existing approval and records no second event. The manual subject is derived
from the current brief title and strips control characters; it is shown with the
exact text before approval and is never stored as a copy of the brief. A changed
body, brief revision, recipient, consent record, approval expiry or owner
permission voids it. The export path rechecks each binding, moves the job to
`invalidated` with a specific reason and refuses to export. A changed consented
address therefore needs a new draft revision (which records the current recipient
digest) and a new owner approval; the previous approval cannot be replayed. The
owner must approve the current text again.

### Manual export, receipt and replay

`replyExport` is the only dispatch. It rechecks the approval, exact body digest,
brief revision, consent and recipient digest after the remote export read, then
performs one conditional `approved → exported` update. It never reads a mail
credential, never calls Resend or another provider and never creates a `sent`
claim. The response includes the app-owned recipient once for copying, the
derived plain-text subject, the exact body and a receipt record with the approval
and export timestamps, both digests, the exact scope and `Sent by Composer: no`.
Composer does not persist the recipient address.

`creator_enquiry_reply_events` appends the draft, approval, export, invalidation
and decline timeline. A partial unique index allows exactly one `exported` event
per approval. Replaying the same export returns the original receipt and records
no second handoff; an already-exported job refuses a different approval. The
Inbox can reload the retained receipt later through that same idempotent path,
which shows the recipient again without creating a second handoff. A failure
before the conditional update leaves no receipt and can be retried after the
named cause is resolved. A failure after an uncertain response is read back from
the stored state, never resent.

### What is not proven

- A real send through the canonical owner mail path, provider acceptance,
  delivery, bounce, suppression or reading.
- The Guestbook-owned v2 consented form, its private receipt and production
  source promotion.
- A real agent runtime producing the draft or authenticating a separate agent
  identity; the contract accepts and labels an agent proposal but does not host
  or authenticate the agent.
- Authenticated production click-through, physical-device or screen-reader
  acceptance of the new reply panel.
- Any claim that “Reviewed”, an approval or a manual export is a sent reply.
- Per-item deletion or retention reconciliation. If Guestbook removes a brief,
  Composer can no longer read it and the reply job/receipt becomes unreachable,
  but the retained reply text does not expire automatically. Deleting the app
  resource cascades the Composer rows. A bounded per-job retention or deletion
  reconciliation is a later gate; this slice does not silently purge owner work.

### Verification

```sh
node --test tests/enquiry-reply.test.mjs tests/inbox-journey.test.mjs
node --test tests/private-enquiries.test.mjs tests/migration-order.test.mjs
```

The reply tests prove: an accepted link creates one empty job and a replay
creates none; a v1 brief offers no reply; the production item schema rejects
missing, oversized and unknown fields; HTML stays inert and the subject cannot
carry a header newline; an agent draft is bound to the brief revision; the same
approval and export replay into one effect; one changed character refuses export
and requires a new approval; an expired consent, changed recipient, changed
brief revision, expired approval, revoked owner access and changed app
connection are refused; and a manual receipt contains the exact approved body
with `Sent by Composer: no`.

The rendered draft, approved and exported component states and their public-safe
receipt are in
[`docs/evidence/enquiry-reply-20261116/`](evidence/enquiry-reply-20261116/README.md).

## What is proven and what is not

Deterministic local tests and the rendered fixtures prove the state transitions,
idempotency, scope refusal, error text, reconciliation and bounded retry for the
owner notice, plus the separate reply draft, exact approval, manual export
receipt and safe replay with a fictional transport. They do not prove:

- real Resend delivery, provider callbacks, bounce/suppression or reading;
- a live v2 consented form or any reply send through the canonical mail path;
- inbound mail or replies (no incoming-mail adapter exists);
- an authenticated production click-through of this new build;
- a scheduler or automatic event processing;
- physical phone, touch or screen-reader acceptance;
- that the recipient identity remains a verified owner at a future provider
  account change.

## Verification

```sh
node --test tests/inbox-journey.test.mjs tests/migration-order.test.mjs
node --test tests/private-enquiries.test.mjs tests/resend-delivery.test.mjs
```

The rendered acceptance captures and their exact measurements are in
[`docs/evidence/inbox-workflow-20261025/`](evidence/inbox-workflow-20261025/README.md).

## Owner feedback in context

An administrator can leave a private note on a Composer page, a Share artwork
detail, the Keep a Copy playhead or a Decisions question. Use one sentence and
optionally choose a type or raise an incident. The form shows the selected
target and revision. The Inbox retains the exact note, original URL, deployed
source and environment. On a film note, the original link seeks to the saved
time. A later revision can still find earlier notes for the same target.

Open **Inbox → Owner feedback** to search text and see open incidents or
attempts awaiting review. Record an attempt with a preview, release or evidence
link. An administrator can accept parts, return feedback or explicitly close
an incident after reviewing a delivered attempt. Reopening keeps the earlier
closure and notes. Visitor enquiries remain in the same Inbox.

The Composer shared layout covers the indexable Composer pages named in
`public-pages.mjs`. Mounted and standalone apps, Prints Desktop, and the
Media Studio editor retain their own interaction and authentication. Link back
to a published result through its Composer share or page when available.

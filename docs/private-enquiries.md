# Private enquiries (#117)

Guestbook owns the private record store, retention, consent, receipt and moderation API. Composer owns no copy of submitted records. Its role20 native Inbox brokers supported app APIs only after current workspace owner/editor membership and exact app account/environment/target/source checks. Only the workspace owner can enable a form. This is the bounded no-contact enquiry slice; audience automation and replies remain unavailable. The default-off manual owner-notification preparation slice is described below.

The fixed `briefs/v1` model is captured from Guestbook with provenance in `private-enquiries-assets.json`. It asks for a project name, goal, starting point, optional conditional HTTPS website and up to eight deliverables. It collects no contact fields, account, upload or notification permission. Consent authorises private workspace delivery only. The public renderer and browser validation are local maintained copies; `scripts/enquiry-assets.mjs` checks the four strict browser outputs without fetching or importing another repository.

## Authority and publication scope

Forms default closed. The native Inbox offers the exact enabled form URL after the app confirms it; public stack cards do not advertise a form that may be closed. A standalone Guestbook resource has its own explicit scope. A Composer form belongs to an immutable current publication, stack ID, instance ID and app resource/configuration. Publishing another revision does not open it. Closing, archiving, deleting or replacing that publication denies its Composer form and submission path without changing separately enabled standalone scope. Enabling a newer Composer publication retires the older form for that stack and instance in the app.

Composer derives the workspace and binding from the current validated publication, then rechecks the same bytes and membership after remote waits and immediately before app dispatch. Public bodies cannot select a workspace, URL, resource or scope. A publication key includes stack identity and immutable snapshot, so a reassigned slug cannot reuse an earlier form. The app rechecks actual-write resource identity, scope/version and restored-source eligibility. An operation already dispatched while authorised may commit before a later cross-service closure; this does not promise a distributed transaction.

## Private inbox and uncertain responses

The Inbox distinguishes pending, reviewed, rejected and all retained entries. Review and deletion use exact resource/item revisions. Private export comes from the Guestbook API; it is never persisted in Composer. Entry text is rendered inertly; no website or image from a brief is fetched. A viewer cannot read the inbox.

The Inbox also shows counts by page. It asks the app for the same bounded export, validates the resource, source and each item's provenance, then groups by the exact published stack/instance or standalone scope. The summary contains counts, publication revisions and latest dates, not brief text, contacts or visitor identity. It covers up to the 200 items Composer accepts from the export and says when that limit is reached; expired briefs and older additions beyond that limit are absent. “Reviewed” is an owner decision, not a sale, reply, contact or conversion.

Each write has one operation UUID. A malformed or lost acknowledgement retains the exact source, command and revisions in tab storage without a submitted body. Receipt lookup does not resend it. Only a successful missing-receipt check offers an explicit retry of the same operation; source, authority or scope drift refuses that retry. The public form similarly retains only an opaque intent, keeps newer text after delayed acknowledgements, and offers original-snapshot retry only while the original remains in memory. Reload does not recover private draft text. Native navigation guards and public before-unload prompts preserve current unsent/unknown work; leaving deliberately may discard in-memory input.

Bodies become inaccessible after 30 days and deletion clears them immediately. Guestbook's daily scheduled task and request cleanup remove expired text; scheduler outages may delay physical removal, not logical expiry. Minimal delivery/operation metadata lasts 35 days. Queue, filters, payloads and rates are finite. No contact, reply, public approval, conversion or adoption metric is implied. The separately configured minimal owner notice includes no brief text. Private enquiry metrics in Outcomes remain unavailable.

## Release and qualification

Guestbook migration `0004_private_enquiries.sql` follows the unchanged reviewed `0003_portability_lineage.sql`. The original enquiry slice added no Composer migration; the later notification preparation slice adds migration 0013. App and Composer must be reviewed/released independently and the exact source promoted through the existing service/pin path before native support is claimed. Preview remains isolated through `CLOUDFLARE_ENV=preview`; local proof uses only fictional records.

Focused Composer checks: `node --test tests/private-enquiries.test.mjs tests/stack-resource-content.test.mjs`. The former combines FK-enabled Composer SQLite with an explicitly limited HTTP contract double; actual app workerd and native browser evidence is recorded separately in ignored `output/private-enquiries/`. Build/type/source gates do not establish production Access, human acceptance, physical-device or demand proof.

## Owner notification preparation — 24 October 2026

Composer migration `0013_enquiry_notifications.sql` adds default-off per-resource
preferences and a minimal durable outbox. The existing native Inbox shows this
separately from review and moderation. Only the current workspace owner can queue
future notices or request a send. Existing enquiries are not mailed retroactively.
A confirmed Composer publication receipt queues one versioned notification by
workspace, app resource and original enquiry intent. Duplicate receipts cannot
create another message. Standalone Guestbook submissions do not pass this broker
and are not covered by this queue hook.

Notification records copy no brief, contact value, attachment or visitor identity.
They retain the event/message identity, exact app account/environment/target,
owner identity, recipient digest, attempt count and minimum provider message ID.
These minimal duplicate-protection records remain with their owning resource;
they have no automatic expiry in this slice. This is distinct from Guestbook's
30-day body / 35-day receipt retention. Resource deletion cascades the metadata.
An email copy, once actually sent, follows the provider and recipient's retention;
deleting the enquiry cannot recall it. No submitted brief is included in the email.

No automatic sending, digest, quiet hours, background processor or new scheduler
is installed. Status checks send nothing. A send requires an explicit native
owner action, server-side `ENQUIRY_NOTIFICATIONS_ENABLED=true`, the existing
Resend credentials and sender/recipient allowlist, and the server-owned
`ENQUIRY_NOTIFICATION_RECIPIENT`. That address must match the owner identity
that enabled the preference. Public inputs never select a recipient or credential.
Changing account/environment/target, membership, preferences or destination
refuses the effect. This run sent no real email and changed no production mail
configuration; provider transport was a deterministic fictional fixture.

A durable atomic claim precedes the effect. At most three definite-rejection
attempts use the same persisted message key. Accepted messages retain their
provider identity and never resend, including after provider key retention.
Interrupted or uncertain sends remain held; there is no blind retry or automatic
claim recovery. A definite provider rejection or missing configuration is visible
without losing the enquiry. Acceptance is not delivery or reading. Callback
verification, actual delivery/bounce/suppression reconciliation, owner acceptance
and production provider proof remain open #117 gates. References:
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) and
[send response](https://resend.com/docs/api-reference/emails/send-email).

# Private enquiries (#117)

Guestbook owns the private record store, retention, consent, receipt and moderation API. Composer owns no copy of submitted records. Its role20 native Inbox brokers supported app APIs only after current workspace owner/editor membership and exact app account/environment/target/source checks. Only the workspace owner can enable a form. This is the bounded no-contact enquiry slice; audience automation, replies and notifications remain unavailable.

The fixed `briefs/v1` model is captured from Guestbook with provenance in `private-enquiries-assets.json`. It asks for a project name, goal, starting point, optional conditional HTTPS website and up to eight deliverables. It collects no contact fields, account, upload or notification permission. Consent authorises private workspace delivery only. The public renderer and browser validation are local maintained copies; `scripts/enquiry-assets.mjs` checks the four strict browser outputs without fetching or importing another repository.

## Authority and publication scope

Forms default closed. The native Inbox offers the exact enabled form URL after the app confirms it; public stack cards do not advertise a form that may be closed. A standalone Guestbook resource has its own explicit scope. A Composer form belongs to an immutable current publication, stack ID, instance ID and app resource/configuration. Publishing another revision does not open it. Closing, archiving, deleting or replacing that publication denies its Composer form and submission path without changing separately enabled standalone scope. Enabling a newer Composer publication retires the older form for that stack and instance in the app.

Composer derives the workspace and binding from the current validated publication, then rechecks the same bytes and membership after remote waits and immediately before app dispatch. Public bodies cannot select a workspace, URL, resource or scope. A publication key includes stack identity and immutable snapshot, so a reassigned slug cannot reuse an earlier form. The app rechecks actual-write resource identity, scope/version and restored-source eligibility. An operation already dispatched while authorised may commit before a later cross-service closure; this does not promise a distributed transaction.

## Private inbox and uncertain responses

The Inbox distinguishes pending, reviewed, rejected and all retained entries. Review and deletion use exact resource/item revisions. Private export comes from the Guestbook API; it is never persisted in Composer. Entry text is rendered inertly; no website or image from a brief is fetched. A viewer cannot read the inbox.

Each write has one operation UUID. A malformed or lost acknowledgement retains the exact source, command and revisions in tab storage without a submitted body. Receipt lookup does not resend it. Only a successful missing-receipt check offers an explicit retry of the same operation; source, authority or scope drift refuses that retry. The public form similarly retains only an opaque intent, keeps newer text after delayed acknowledgements, and offers original-snapshot retry only while the original remains in memory. Reload does not recover private draft text. Native navigation guards and public before-unload prompts preserve current unsent/unknown work; leaving deliberately may discard in-memory input.

Bodies become inaccessible after 30 days and deletion clears them immediately. Guestbook's daily scheduled task and request cleanup remove expired text; scheduler outages may delay physical removal, not logical expiry. Minimal delivery/operation metadata lasts 35 days. Queue, filters, payloads and rates are finite. No contact, email, reply, public approval, conversion or adoption metric is implied. Private enquiry metrics in Outcomes remain unavailable.

## Release and qualification

Guestbook migration `0004_private_enquiries.sql` follows the unchanged reviewed `0003_portability_lineage.sql`. No Composer migration is added. App and Composer must be reviewed/released independently and the exact source promoted through the existing service/pin path before native support is claimed. Preview remains isolated through `CLOUDFLARE_ENV=preview`; local proof uses only fictional records.

Focused Composer checks: `node --test tests/private-enquiries.test.mjs tests/stack-resource-content.test.mjs`. The former combines FK-enabled Composer SQLite with an explicitly limited HTTP contract double; actual app workerd and native browser evidence is recorded separately in ignored `output/private-enquiries/`. Build/type/source gates do not establish production Access, human acceptance, physical-device or demand proof.

# Private creator outcomes

This source candidate extends #116. Public `/activity` keeps its existing app-wide counter contract. Private reporting uses the existing authenticated native Creator plugin and current workspace membership. It does not grant CMS, owner or deployment access.

The useful questions are which published app instance receives an Open action, which moderation transitions have a verified successful receipt, and which publication snapshots the workspace still retains. These are separate measures. Their totals cannot establish people, sessions, adoption, destination delivery or a conversion funnel.

## Measures and dates

| Measure | Trigger and meaning | Earlier history |
| --- | --- | --- |
| App Open actions | A supported trusted activation of an allowed visible instance on the current published stack. A fixed same-origin request is sent once without delaying navigation. Keyboard, touch/pointer and same/new-tab disposition describe the activation where supported. | Starts at its first retained observation; no invented earlier zeros. A click does not prove the destination loaded. |
| Verified approval, hide and deletion transitions | A current app content read verifies the item's previous state at the exact requested resource version. That proof is bound to the exact operation. Only the first confirmed journal receipt, including later reconciliation, can count a change to another state. | Forward proof only. An old confirmed command does not establish its previous state. The UTC date is when the confirmed outcome is recorded here, which may follow the app's commit. |
| Retained publication snapshots | Existing immutable publication history created by successful stack publication, dated by its stored snapshot timestamp. | Describes records still retained, including older unclassified history. It does not count every republish/rollback or reconstruct deleted stacks/history. |

Already-approved commands, refused writes, unconfirmed acknowledgements and repeated delivery cannot create an approval transition. An analytics failure cannot change an app's confirmed result. Missing or late pre-dispatch proof is never filled in from the item's later state. Optional recording can drop an outcome.

Scoped Linkarooie card actions, enquiries, scoped guest submissions, external destination completion, revenue, unique visitors and funnels remain unavailable. No zero is supplied for an unsupported measure. Carry / forward's private actions and contents remain excluded.

## Scope and collection

Public collection accepts a versioned fixed body containing only the current publication revision, supported activation enums and a random token generated for that activation. Slug/instance selectors resolve the current published stack and workspace on the server. No body field selects a workspace, app, destination or record owner. Draft, archived, missing, invisible, stale or invalid instances cannot record.

No visitor IDs, cookies, IP addresses, entered URLs, raw referrers, captions, account emails, search text or app content enter the aggregate store or export. The opaque token deduplicates one delivery and expires with the counters; it is never reused across actions. There is no cross-domain beacon or analytics provider.

The owner may explicitly classify a stack's **future** recorded activity as demonstration traffic. The setting is workspace-authorized, revision-guarded and read by the collector. A public payload or URL cannot choose that classification. Earlier records stay unclassified. Marked verification/release probes and confidently recognized robots are excluded; unmarked demonstrations, automation and bots may still count. Unclassified traffic is not evidence of customer demand.

New aggregates and activation receipts expire after 35 UTC days. Daily counts are capped at 1,000 per stack; public ingestion also uses the existing bounded location rate limiter. Caps, outage and best-effort delivery make counts lower bounds. Existing app journals/publication history retain their existing ownership and lifecycle; this feature does not silently delete or copy them.

## Reporting and export

The native report has bounded 7/30-day UTC windows, a preceding window of the same length, and workspace-owned stack/instance selectors. The server verifies membership and every selected dimension. Previous periods outside retained or observed coverage remain unavailable. Today and first observed days are partial. Percentage change is unavailable when periods are missing/partial or the prior denominator is zero.

The aggregate export uses the same selected report and definitions. It contains internal scope IDs, UTC dates, enum dimensions and totals, without visitor identity, links, captions or request payloads. A failed report is unavailable rather than zero. The HTML table remains the accessible equivalent of the plotted values.

## Verification and delivery gates

Migration `0009_private_outcomes.sql` is forward-only and adds bounded private tables/indexes after the existing resource journal and workspace access migrations. Verify old stack, publication, membership and journal bytes remain unchanged with foreign keys enabled. Exercise two fictional stacks and a second workspace; rejected selectors, lost acknowledgements, duplicate tokens, approval no-ops, retention, publication drift, revoked roles and recorder failures must not inflate successful outcomes or block navigation.

This is a source candidate until exact-source independent review, combined gates and actual native/public browser journeys pass. It does not establish production collection, real customer traffic, provider attribution or physical-device acceptance.

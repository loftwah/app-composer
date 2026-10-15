# App event dictionary — contract 1, receipt extension

Existing `lib/usage/index.mjs` remains the runtime allowlist and owning aggregate store. This document describes it; it creates no parallel registry. Collector bodies stay exactly `{contract: 1, event}`. Private per-app tokens scope writes, queries are bounded, and no content or identities are accepted. Fork publishers remain absent/off by default.

| Event | Owner and trigger | Recorded meaning | Retry/duplicate rule |
|---|---|---|---|
| `app_open` | Owning app, successful public home HTML | Recorded home requests | Reloads/bots may repeat; not unique people |
| `item_open` | Guestbook, successful public contribution HTML | Recorded contribution opens | Repeated opens may count |
| `inspection_completed` | Link Check, accepted completed inspection | Recorded completed checks | Completion, not a button click |
| `postcard_received` | Guestbook, POST of the exact guest-postcard route returns JSON with status 201 after its new pending insert commits | One newly accepted pending postcard per successful request | The publisher sends once with no retries. A retried form that creates a second record is a second admission, not a unique-message/person count. Failed, rejected, closed, paused, full-queue and non-201 responses do not count |

`guest_postcards_received` is the separate public-safe daily aggregate of `postcard_received`. It contains no caption, alias, item ID, URL, visitor/IP/session identity or owner activity. It cannot describe successful approval/publication, a unique person, a private creator workspace or a conversion funnel. Those remain separate unmeasured outcomes under #116 and its workspace/stack dependencies. Existing `actions` and `/activity` totals keep their contribution-open/inspection meaning.

Standalone Guestbook uses its optional existing publisher. Composed Guestbook receipts are recorded once by Composer after the pinned service's successful response; pinned services omit standalone publisher credentials. Native owner API paths do not match the guest route and are not counted. Verification is excluded by the app/proxy and by an authenticated, shape-validated collector; the marker never supplies authentication. Publisher outage, rate limits and daily caps can drop counts without blocking submission.

## History and availability

The existing table has no publisher-enablement registry. Use the first **retained observed receipt day**, queried across the retained range rather than merely the selected window, as a conservative per-measure lower bound. With no observation, or when a selected window ends before it, return `null`, unavailable quality and no daily points. Never invent older zeroes. The first observed day is partial; later zero means no recorded receipt, not proof that nobody submitted or that every publisher stayed enabled. Existing measures keep their own earlier availability.

The counter remains capped at 1,000 per app/event/surface/day, subject to the existing shared location rate limit and 35-day retention. It supplies recorded lower bounds, without sessions or cross-domain attribution.

## Schema and release

`0003_postcard_receipts.sql` rebuilds the existing aggregate table with one additional Guestbook-only event and copies every old row; it creates no new database/provider and changes no Guestbook content table. The release guard checks the extended schema before upload. Before applying remotely, inspect the actual owned schema/dependencies, retain a D1 restore bookmark and aggregate before-image, and prove old rows unchanged afterward. Local SQLite transaction tests are not D1 or production acceptance. Use official [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) and [D1 transaction/foreign-key semantics](https://developers.cloudflare.com/d1/sql-api/foreign-keys/); do not turn constraints off. Exact source, migration, live browser/API and collector evidence belongs in #11. No new publisher or measure is adopted merely because this source exists.

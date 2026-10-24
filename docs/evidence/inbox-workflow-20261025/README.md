# Inbox journey acceptance — 25 October 2026

Local rendered acceptance for the owner Inbox journey on
`codex/lane-e-inbox-20261025`, captured from the working tree based on
`8651468` and committed with this change. The exact capture identity and
measurements are in [`receipt.json`](receipt.json). It renders the actual
`JourneyDetail` React component with data read by the actual
`manageInboxJourney` server function from an in-memory D1 fixture built with
migrations `0013_enquiry_notifications.sql` and `0017_inbox_journey.sql`.

## What is real in this fixture

- The real Composer D1 schema for notification preferences, the outbox and the
  new workflow-run table.
- The real app-export contract (`guestbook.private-enquiries/v1`) with fictional
  guestbook resource and briefs; each brief's provenance is a fictional
  Composer publication 11 / visitor-book instance.
- The real journey read model, state mapping, next-action computation and
  rendered component. The fixture seeds the receipt-to-brief `item_id` link
  directly; in production the submission path records that link only on one
  exact pending scope/values match, and otherwise shows `unlinked`.
- Real measurements in headless Chrome: viewport, `scrollWidth`, focusable
  control count, negative `tabIndex` count and a real keyboard `Tab` focus
  outline.

## What is simulated

- The Guestbook HTTP service is an in-process fixture. No app Worker, EmDash API
  transport, authentication session, Access policy or browser admin shell is
  exercised.
- The journey pages show the Inbox header, brief list and detail only. The
  visitor-book/review selectors, “Enquiries by page” table and the closed form
  section are present in the product page but omitted from these fixture pages
  so the state machine stays legible.
- `accepted` and `uncertain` are seeded from fictional provider outcomes. No
  Resend request, real email, callback, bounce or reading occurred.
- No production data, owner record, credential or recipient address was read or
  written.

## Capture matrix

Five fixture scenes, each selecting one fictional brief from a four-brief list. Every
page is captured at 390 and 1440 CSS pixels in both themes: 20 PNGs.

| Page | Enquiry | Workflow | Delivery | Next action |
| --- | --- | --- | --- | --- |
| `queued-unconfigured` | New | Queued | Not configured | Process this enquiry |
| `running-interrupted` | New | Running | Not configured | Re-check processing |
| `accepted` | Reviewed | Finished | Accepted by provider | No supported action |
| `uncertain` | Reviewed | Finished | Outcome uncertain | Reconcile delivery |
| `failed-retry` | New | Failed | Send failed | Retry processing |

The footer table in each capture is evidence scaffolding, not product UI. It
marks the states visible in that capture and lists the other supported states.

## Measurements

From [`receipt.json`](receipt.json), all 20 captures:

- 390px viewport: `scrollWidth` 390; 1440px viewport: `scrollWidth` 1440. No
  horizontal overflow.
- 11–12 native focusable controls per page, 0 with a negative `tabIndex`.
- A real keyboard `Tab` focuses “Export private inbox”; the primary next action
  or the notification control then receives `:focus-visible` with the declared
  `3px solid rgb(255, 155, 80)` outline.
- No capture contains `owner@example.test` or `fictional-key`.
- Dates use YYYY/MM/DD with UTC and Australia/Melbourne; the fictional brief
  received `2026/10/24 22:40 UTC` renders as `2026/10/25 09:40 AEDT`.

## Commands

```sh
# Render the fixture pages and their real read-model output.
node docs/evidence/inbox-workflow-20261025/render.mjs <owned-temp-html-dir>

# Serve those pages, run isolated headless Chrome, measure and capture.
node docs/evidence/inbox-workflow-20261025/capture.mjs <owned-temp-html-dir> \
  docs/evidence/inbox-workflow-20261025
```

`render.mjs` creates a temporary compiled component under the ignored
`.private/` directory so React and Zod resolve from this repository, then
removes it. `capture.mjs` starts its own ephemeral HTTP server and a fresh
Chrome profile under the supplied HTML directory, and removes the profile at the
end. No shared browser profile or owner session is used.

## Limits

Headless Chrome 155, desktop emulation at both widths (`mobile: false`),
`deviceScaleFactor: 1`. This is not a physical phone, tablet, touch, screen
reader or text-only zoom test. The component is mounted without the EmDash admin
chrome, so its host spacing and theme variables are approximated by the
committed plugin CSS and the page shell. Authenticated production interaction,
real provider delivery and inbound mail remain open.

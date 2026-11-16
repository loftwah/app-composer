# Reply job acceptance — 16 November 2026

Local rendered acceptance for Composer [#598](https://github.com/loftwah/app-composer/issues/598)
on `codex/batch-c598-enquiry`. It renders the actual `JourneyDetail` React
component from data produced by the actual `manageInboxJourney` route handlers
against an in-memory D1 fixture built with migrations `0013_enquiry_notifications.sql`,
`0017_inbox_journey.sql` and `0030_enquiry_reply_jobs.sql`.

## What is real in this fixture

- The real reply job and timeline schema, unique job key and one-export-per-approval index.
- The real `guestbook.private-enquiries/v2` shape with a fictional consented recipient
  (`visitor@example.test`), fictional brief and fictional workspace/resource scope.
- The real journey read, agent draft, exact owner approval and manual export actions.
- The real rendered component, including the exact-text approval block, approval
  digest, receipt timestamp, copy/download actions and “Sent by Composer: no”.
- The generated `receipt.json` records the actual job state, draft and approval
  digests, timestamps, event sequence and manual-export flags.

The source commit in the receipt is the pinned Guestbook source read from
`app-settings`; it is not a Composer release identity.

## What is simulated or absent

- The Guestbook HTTP service is an in-process fixture. No app Worker, EmDash API
  transport, authentication session, Access policy or browser admin shell is
  exercised.
- No email, provider request, `RESEND_API_KEY`, callback, delivery, bounce or
  reading occurred. The only dispatch is the manual export.
- The pinned Guestbook source does not serve the v2 consented export. This
  fixture proves Composer’s side of the contract; the live no-contact form still
  shows no reply action.
- No production data, owner record or real recipient address was read or written.

## Pages

| Page | Reply state | What to look for |
| --- | --- | --- |
| `initial.html` | Draft, no saved revision | No reply text yet; save action only |
| `draft.html` | Draft revision 1 | Agent identity, exact text, confirmation checkbox |
| `approved.html` | Approved, not sent | Approval timestamp, expiry, exact text, manual export action |
| `expired.html` | Approval invalid (expired) | Exact text retained; owner can approve the current revision again or decline |
| `exported.html` | Exported for manual sending | Receipt, exact body, consent fingerprint, copy/download, “Composer did not send this reply” |

The footer text is evidence scaffolding, not product UI.

## Commands

```sh
node docs/evidence/enquiry-reply-20261116/render.mjs <owned-output-dir>
node --test tests/enquiry-reply.test.mjs tests/inbox-journey.test.mjs
```

The generated HTML and `receipt.json` stay in ignored `output/` except for the
committed public-safe receipt in this directory.

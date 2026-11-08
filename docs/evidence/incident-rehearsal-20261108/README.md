# Write-free incident decision rehearsal — 8 November 2026

Scoped [#367](https://github.com/loftwah/app-composer/issues/367) rehearsal
slice. Production is Composer
`0acd7ff185347580e034f417f2ffb7e5fc761ce9`, Worker
`86a1e589-5442-4b95-aaaa-c46ce0e14b4c`; `/build.json` matches the source.

## Delivered

`/incident-replay` now includes **Rehearse the decision**, a client-side,
write-free walkthrough of the existing proposal contract:

- Version 1 shows its digest, observations and proposed change.
- **Send back with notes** requires a useful instruction (12–500 characters).
  The first version stays readable, a linked version 2 is created with the
  retained evidence plus the reproduction, scoped data read and regression
  check, and the digest changes.
- Approving the stale version 1 is refused with a plain message; only the
  active version can be decided.
- Approval records a **simulated** outcome only: no email, deployment, recovery
  or agent call. Rejection preserves both versions and never treats the incident
  as resolved.
- The owner-notification preview is fictional (`owner@example.invalid`), states
  that nothing was sent, and contains no approval link or bearer value.
- The page navigation now links to the rehearsal, and decided versions are
  labelled **Approved in this rehearsal** or **Rejected in this rehearsal**.

The controller is `src/lib/incident-rehearsal.ts` (pure state machine) plus
`src/lib/incident-rehearsal-client.ts` (DOM). It imports no network helper and
never calls an admin endpoint.

## Live production check

Using a separate automation browser against `https://composer.loftwah.com`:

| Step | Result |
| --- | --- |
| Load `/incident-replay` | 200; title `Incident Desk: inspect a safe replay · App Composer`; nav contains **Rehearse it** |
| Send back with `fix` | Refused: “Add at least 12 characters of useful instruction.” |
| Send back with a real instruction | Version 1 retained as **Retained · stale for approval**; version 2 active with digest `7e758e286f67` |
| Approve stale version 1 | Refused: “Version 1 is stale after the send-back. Decide on version 2.” |
| Approve version 2 | **Approved in this rehearsal**; status says “Nothing was executed.” Outcome states no email, deployment or recovery ran |
| Network during all of the above | 27 recorded requests before and after; no action request. The only external entry is the expected CSP-blocked Cloudflare Insights beacon; Cloudflare challenge-platform requests are browser protection, not page actions |
| Console | No application error. One expected blocked Insights beacon and browser Permissions-Policy warnings |

Viewports and themes: 1440 × 1000 dark (initial), 1440 × 1000 light (approved)
and 390 × 844 dark (approved). No horizontal overflow at either width. Keyboard
Tab reaches the controls with a 2px orange `:focus-visible` outline, and the
approved outcome heading receives focus with the same ring.

Screenshots: [`prod-1440-dark.png`](prod-1440-dark.png),
[`prod-1440-light-approved.png`](prod-1440-light-approved.png),
[`prod-390-dark-approved.png`](prod-390-dark-approved.png).

## Checks

```sh
pnpm check:fast -- tests/incident-rehearsal.test.mjs
```

Types and generated source, semantic lint and format passed; 7 focused tests
passed with 0 failures: start state; instruction minimum and version retention;
stale approval refusal; idempotent repeat approval with no effect; rejection
preservation; reset; and a fictional unsent email preview with no link or
secret.

The guarded `pnpm deploy` ran the full check, production build, migrations,
upload and every live gate, then verified the exact live source. The first
rehearsal deploy (`04120da` / Worker `2fd7a2c0`) passed the same journey; the
final label/nav patch is `0acd7ff` / Worker `86a1e589`, rechecked above.

## What this does not prove

- This is the **safe rehearsal** scenario. It is not a real EmDash incident, a
  signed-in owner decision, a configured recipient, a delivery receipt, an
  execution or an independent recovery.
- No email, PagerDuty, signed-in Incident Desk interaction, physical device or
  screen-reader acceptance was exercised.
- The private proposal store, review endpoints and execution adapter are
  unchanged and remain owner-gated.

#367 therefore stays open with the real lab incident, authorised email,
signed-in decisions, execution/recovery and provider gates unchanged.

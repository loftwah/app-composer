# Incident Desk local acceptance — 25 October 2026

This is actual native EmDash 1.3.1 browser interaction with a synthetic local D1,
not the earlier static proposal markup harness. Node 22.23.4, Chromium headless
shell 1248, 1440×1000 and 390×844, native theme controls in both modes.

`capture.mjs` performed native setup and virtual-passkey registration, dismissed
the normal first-account welcome dialog, read the selected workspace, and used
the real Incident Desk component and proposal endpoints. All records, accounts,
observations and service names are invented. The receipt records source
`473b8b9` plus `sourceDirty: true`; `source-hashes.json` binds the finished source
files. This is not a clean-main release or production authentication receipt.

The observed journey:

- Read a SIMULATED REPLAY SITREP with impact, observations, hypotheses,
  uncertainty, next checks and separate recovery / notification / provider state.
- Reach the reason with Tab from the case list, type useful instructions, then
  use Tab and Space to send the proposal back.
- Submit version 2 with a **new same-grant briefing and an additional evidence
  item**. Retain version 1, both original evidence items and its review reason.
- Refuse native approval of the old digest with HTTP409 and its useful message.
- Approve version 2 in native administration; observe accepted digest but no
  execution. Retrieve both persisted versions and both decisions.
- Reject a second proposal without deleting its investigation; recovery stays
  unverified. Anonymous proposal reading returns HTTP401.
- Inspect the native page at phone/desktop in both modes, and the public
  read-only replay at 390px in both themes. No horizontal document overflow.

The one browser error is the **expected** HTTP409 response from the deliberate
stale-approval test. The receipt names it separately. There were no page-script
errors or other console errors. Tests: 34/34 across `agent-proposals.test.mjs`
and `agent-grants.test.mjs`; strict source/type check: 0 errors, 0 warnings.
Root integration still owns the required full check/build and live release.

The read-only public page uses only committed fictional data and has no action
endpoint. The harness uses direct store calls only to prepare the fictional
proposal and submit its revision; review decisions, authentication and reads
run through the real native browser/API. Its native actor is a local role50
administrator; cross-workspace/viewer/revoked-grant/source denials are separately
covered by the maintained route/store tests, not fabricated as browser proof.

## Fixes found by the journey

A revision previously retained the original current briefing ID/digest even
when it cited newly requested evidence from a new briefing. The current pointer
now updates atomically with the proposal digest; original version bodies and
immutable briefing records remain. Native domain failures are translated to
EmDash's `PluginRouteError`, so expected conflicts/denials retain their status
and message rather than becoming generic HTTP500 failures. Incident filtering
happens before the list limit. Full patch history loads only for the selected
scoped proposal.

## Limits and cleanup

This run sends no email or PagerDuty event, calls no model, applies no fault,
executes no recovery and makes no deployment. It does not qualify the genuine
isolated Worker failure/recovery exercise, real Access admission, mandatory MFA,
physical passkeys, screen readers, monitoring or provider notifications.
The existing availability lab retains its separate scope.

The Incident Desk panel is readable in both native themes. The installed native
shell sidebar has low-contrast labels in the observed dark mode; the images
retain that limitation rather than claiming complete EmDash accessibility.

The runner reuses the existing admin fixture. Only that copy replaces production
Access with EmDash native authentication, selects a local origin, removes
provider bindings/routes/cron, and registers the candidate page. Reused installed
dependencies are APFS-cloned into the one owned temporary root because the
Cloudflare Vite runner denies outside-root stylesheet imports through a symlink.
No package is installed. `finally` stops the native dev server and removes the
root; `cleanup.json` confirms removal. Logs and extra diagnostic captures stay
under ignored `output/`.

# Local availability recovery foundation

This optional exercise extends the native two-team fixture after its ordinary request, contribution, moderation, update and export journey succeeds. It is a deterministic runbook for a deliberately isolated resource visibility fault. It is **not** the complete [#215 Agentic Responder](https://github.com/loftwah/app-composer/issues/215), a code rollback, data restoration or a live PagerDuty integration. The [platform films](/platform/demo) retain their own pre-incident source and scope and show no outage or incident response.

## Recorded local result — 23 October 2026

Composer `25dc7589f7a92d5ba22eb44c49b9a774991799a3` passed the separate opt-in
native run with receipt SHA-256
`da2aa155ab9376e34244b6610c6f049085800e9ee25b0ee9c9abff9c5d06ab33`.
The scenario `availability-9e304d30-a54f-4443-ba50-1b9b1c3288a2.json` has SHA-256
`135de57a90f6c02eabd0faf7758bade40f95f23b5b149beed957e321ef5ec63a`.
The [qualification record](https://github.com/loftwah/app-composer/issues/11#issuecomment-6364634030)
binds these to Guestbook `e097e4dd46abe5dd49a0ee1209276cc506e601fa` and
Linkarooie `9e166d3c3dcc9d3746ba1680b9f74015c0b521cb`.

Actual HTML and PNG reads changed from 200 to 404 while source-matched liveness
stayed 200. Confirmed control operations advanced resource versions 7 → 8 → 9.
Recovery passed three HTML/PNG samples over 2.08 seconds with the original media
digest. Team B's semantic HTML digest stayed equal while its raw nonce-bearing
hash changed. Three correlated change/trigger/resolve events received local HTTP
202 acknowledgements with matching incident deduplication. Public contributions
stayed closed, anonymous owner access returned 401 and cross-team media returned
404. There were **zero retained private items**, so this run did not exercise
private-item recovery denial. Browser/root/pointer cleanup and receiver closure
were confirmed. This is local visibility recovery, not production or vendor
acceptance, lost-acknowledgement recovery, full restore or retirement.

## What it runs

The host-only `--availability-fixture` flag is off by default. The reused lifecycle still owns one temporary root, fictional native users, independent local workerd/D1/R2 state and fixed loopback services. Before faults, the extra admission check inspects all three owned local configurations, rejects remote bindings and production deployment selection, and requires the existing local TLS bridge on independent reads. It never calls the production rollback/deployment scripts or obtains provider credentials.

The actual native role50 operator must still own each selected workspace. The exercise reads the retained completed request, exact source/plan/policy/configuration, current stack publication, app-owned resource and approved synthetic PNG. The initial publication must be visible and unpaused, with no unfinished operation. This is an explicit public fixture contract: an intentionally private application is not an incident.

1. Independently check the existing resource HTML and the previously measured PNG digest; record the unaffected Team B snapshot.
2. Send the existing typed `moderateResource` / `control` operation through native administration, setting only Team A visibility false and retaining its pause state. Current membership, stack CAS, app version, source and target checks remain enforced. Managed-workspace lifecycle fences are unchanged.
3. Observe the actual resource HTML and media returning 404 while Guestbook's source-matched shallow `/healthz` still returns 200. Send a control-change observation and an incident trigger to a real local PagerDuty-shaped HTTP receiver.
4. Re-read current ownership, policy, plan, configuration, publication, content and Team B. Restore only the recorded visibility/pause baseline through a fresh typed control operation. Drift blocks the action. An unknown outcome receives one read-only journal reconciliation; it never causes an automatic mutation retry.
5. Require three separate successful HTML identity and PNG digest samples, spaced one second apart. Recheck closed public contributions, unauthenticated owner-API refusal, cross-team media refusal, any retained private items and the unchanged Team B snapshot. Only then send resolve for the same local incident episode.

A changed policy/source/publication/content or another actor changing the fault state stops further effects. A failed or flapping verifier leaves the incident unresolved. Incident delivery and service recovery are separate: unconfirmed trigger delivery prevents automatic resolve, and an unknown resolve remains unknown. Local receiver acceptance proves neither vendor incident creation nor notification.

## Evidence and commands

Prepare with the same exact clean app checkouts used by the native fixture:

```sh
node labs/platform/native-run.mjs prepare --availability-fixture \
  --guestbook /path/to/exact-clean-guestbook \
  --showcase /path/to/exact-clean-showcase \
  --output output/platform-availability
```

Preparation starts no browser or service. After the existing shared host admission is handed over, replace `prepare` with `run --admitted`. Do not queue a nested reservation or run alongside another lab on the fixed ports. No dependency installation is attempted.

The bounded `availability-RUN_ID.json` receipt records source identities, request/plan/policy/configuration/resource/publication correlation, stable control operation IDs, actual status/digest observations, monotonic timings, three-sample stability, privacy/control results and local event IDs/outcomes. Once admitted, a failed scenario retains its receipt too. The local receiver's redacted event rows appear in that same receipt; routing keys and private browser state do not. Team B raw HTML hashes remain recorded; its separate semantic digest normalizes only the reviewed per-response script CSP nonce, retaining every other byte. Two actual public-page screenshots reuse the native capture helper and source/actor/hash receipts. All service, file, browser and temporary receiver cleanup belongs to the existing one-root `finally` lifecycle.

Focused tests exercise the local target admission guard, actual managed-resource control/journal behaviour on SQLite with labelled app contract doubles, and the verifier's consecutive-sample/flapping semantics. Set the trusted host `COMPOSER_INCIDENT_GUESTBOOK` to the exact clean pinned checkout to also exercise two real Guestbook HTML responses with distinct nonces. Without a sibling checkout, only that supplemental source test skips; an explicit invalid selection fails. These tests do not establish native browser/workerd execution. Source changes require a fresh admitted native run at the candidate revision.

## Remaining #215 / #221 gates

This slice supplies one causal availability failure/action/verification foundation. It does not deliver a defective-code deployment, agent investigation, Accept/Reject/Request revision UI, compatible code rollback, full data recovery, continuous monitoring, synthetic storm, real PagerDuty sandbox, three clean rehearsals, production admission or incident films. Those remain with their existing owners. Visibility controls preserve configuration/content; they do not reverse external business effects or repair a code defect.

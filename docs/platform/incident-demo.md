# Local availability recovery foundation

This optional exercise extends the native two-team fixture after its ordinary request, contribution, moderation and update journey succeeds. It is a deterministic runbook for a deliberately isolated resource visibility fault. It is **not** the complete [#215 Agentic Responder](https://github.com/loftwah/app-composer/issues/215), a code rollback, data restoration or a live PagerDuty integration. The existing pre-incident films retain their original source and scope.

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

The bounded `availability-RUN_ID.json` receipt records source identities, request/plan/policy/configuration/resource/publication correlation, stable control operation IDs, actual status/digest observations, monotonic timings, three-sample stability, privacy/control results and local event IDs/outcomes. A failed scenario retains its receipt too. The local receiver's redacted event rows appear in that same receipt; routing keys and private browser state do not. Two actual public-page screenshots reuse the native capture helper and source/actor/hash receipts. All service, file, browser and temporary receiver cleanup belongs to the existing one-root `finally` lifecycle.

Focused tests exercise the local target admission guard, actual managed-resource control/journal behaviour on SQLite with labelled app contract doubles, and the verifier's consecutive-sample/flapping semantics. They do not establish native browser/workerd execution. Actual qualification requires a fresh admitted native run at the candidate source; this document contains no fabricated qualification receipt.

## Remaining #215 / #221 gates

This slice supplies one causal availability failure/action/verification foundation. It does not deliver a defective-code deployment, agent investigation, Accept/Reject/Request revision UI, compatible code rollback, full data recovery, continuous monitoring, synthetic storm, real PagerDuty sandbox, three clean rehearsals, production admission or incident films. Those remain with their existing owners. Visibility controls preserve configuration/content; they do not reverse external business effects or repair a code defect.

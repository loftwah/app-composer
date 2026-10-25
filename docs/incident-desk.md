# Incident Desk

Incident Desk is the incident view of the existing workspace agent proposals.
It reuses the proposal-only grant, briefing, version digest, owner/editor/viewer
checks, source freshness and review endpoints. It adds no scheduler, provider connection or separate incident database.
The [finite owner-local recovery consumer](incident-execution.md) can execute one
explicitly approved fictional canary action in the isolated lab.

Open `/_emdash/admin/plugins/composer-stacks/incidents` in the existing creator
session. An agent submits the optional `change.incident` situation report using
`node scripts/agent-proposal.mjs` or its existing scoped connection. Every
observation must cite an evidence ID selected from that briefing. The report,
source, evidence, risk and change all enter the same proposal digest.

The view includes impact, service/owner, first/last seen, observations, competing
hypotheses and checks, steps taken, unknowns, next update trigger, and separate
reported recovery / owner notice / PagerDuty status. An isolated-lab report is
still submitted evidence; its claimed recovery is not an independent verifier.
Production proposals remain refused by the existing grant contract.

Only the grant’s named accountable owner or fallback can decide. They need
workspace owner/editor access to reject or send back, and workspace owner access
to approve an exact submitted proposal. Send-back keeps the first report and its
review reason, and the revised work receives a new digest. The list filters incidents before its 20-row limit. The selected proposal’s
latest 20 stored versions remain readable with their original source, evidence and change. A
revision cannot drop or change its incident ID, service or replay/lab identity.
An old digest, moved local source, wrong workspace, revoked grant, viewer or agent
review is refused. Once a version receives its decision, the next decision waits
for a revised proposal rather than offering another write to the same version.

The public `/incident-replay` page reads only committed fictional data. It never
queries private proposals, sends email, calls an agent, applies a fault, deploys
or approves anything. Its chronological explanation is a read-only walkthrough,
not a new replay state machine.

Approval records the decision only. The separate existing handoff has
`execution: not-performed`; target/source checks and authorised execution still
belong to the existing release flow. No recovery, notification delivery,
PagerDuty, continuous monitoring or 24/7 response claim follows from approval.
The existing local availability exercise in `docs/platform/incident-demo.md`
retains its independent visibility-failure/recovery scope.

## Local verification

`node --test tests/agent-proposals.test.mjs` covers retained original/revised
reports, stale approval refusal, evidence/reference validation, future timestamps,
false replay recovery claims, incident identity changes, terminal rejection,
workspace/role/grant/source checks, idempotency and the existing CLI workflow.
The native API boundary converts domain errors into EmDash's documented
`PluginRouteError`, preserving HTTP conflict/denial statuses instead of hiding
expected failures as internal errors.

`node docs/evidence/incident-desk-20261025/run.mjs` reuses the maintained native
admin fixture with one owned temporary root and an already installed dependency
tree cloned locally. It removes production Access and all provider bindings in
that copy, uses native EmDash authentication with a virtual authenticator, and
cleans up the native dev server and root in `finally`. These seams do not change
production authentication or prove real MFA.

`node docs/evidence/incident-lab-20261025/run.mjs` adds a temporary canary only to
that owned fixture. Its [recorded drill](evidence/incident-lab-20261025/README.md)
measures a real localhost nullable-caption 500, successful shallow health/data
reads and an unchanged control; retains native send-back, revision, stale
approval refusal and current approval; then records explicit manual D1
configuration restoration and three recovery requests matching the baseline.
The original accepted proposal stays immutable, with recovery observations in
a separate accepted SITREP. This qualifies that controlled local sequence only.
That original receipt predates the finite execution consumer below. The source
defect remains and the investigator knew the injected fault; production recovery
and provider notifications remain open.

## Explicit local execution

The maintained native incident lab now consumes its exact approved handoff with
`node scripts/incident-execution.mjs`, rechecking source, grant, scope and revision
before one fixed caption restoration. The atomic receipt remains
`applied-unverified` until three independent HTTP samples and the unchanged
control match baseline. Duplicate invocation does not repeat the action.
See [the operator procedure](incident-execution.md) and [separate content/object
recovery drill](recovery-drill.md). This local consumer adds no production action,
email authority or capability to proposal-only agent connections.

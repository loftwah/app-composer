# Governed member-only contributions

Reviewed 23 October 2026. Independent Guestbook source
`e097e4dd46abe5dd49a0ee1209276cc506e601fa` passed its actual named workerd
entrypoint qualification and normal standalone release. Composer deliberately
selects that version 2 contract in its reviewed composition. The standalone
release, private service promotion, root release and native member journey have
separate receipts in #11; the source pin alone proves none of those later gates.

## Request and policy

`contributions` is an optional platform-request field with `closed` and `members`
values. Omission retains the existing closed behavior. The optional workspace
policy field `allowMemberContributions` must be explicitly true. Its absence is
off. Neither schema inserts a new default property into older JSON or plans.

A member request requires the current reviewed manifest's exact version 2 named
service descriptor and `guestAccess` options `closed,postcards,members`, with a
closed default. Until an independently reviewed source is promoted, evaluation
records `unsupported`. Its plan identifies requested members mode and the
non-executable closed fallback; it never substitutes public postcards.

Legacy global controls, portable settings specs and global maintenance remain
limited to closed/postcards. Native resource staging accepts members mode only
from the same unforgeable in-process actor used for governed publication, with
its current request lease, exact candidate and opted-in policy. A manifest
promotion alone grants no unmanaged resource this mode.

An owner configures policy through native administration. `/me` self-service
uses separate authenticated `composer-members/platformRead` and `platformWrite`
routes. A current explicit workspace editor/owner assignment is required; a
Subscriber's app/profile grant alone is insufficient. The global EmDash role
stays unchanged. Native policy configuration and independent approval still
require a Creator role (20–50) and the relevant workspace-owner checks. A
globally demoted Subscriber retaining a workspace-owner row cannot configure or
review policy. Member-route denials use actual HTTP 403, not a successful JSON
acknowledgement.

An explicit readiness link uses `/me?view=platform&workspace=ID`. The selected
workspace must be confirmed for the signed-in account; an invalid selection
does not fall back to another workspace. Opening this panel does not read an
unrelated profile service.

`platformSnapshot.setup` is an additive read-only observation of the host-derived
target, confirmed workspace stack count and managed state. A disabled existing
profile remains managed. It carries no credentials or grants. Older responses
may omit the field.
Its optional `canConfigurePolicy` observes the current native Creator role and
final workspace ownership check. It is distinct from global account/grant
administration. An explicit false overrides older administrator hints; an older
response conservatively recognizes only an administrator workspace owner.
Runner availability validates adapter configuration only. It does not establish
upstream network connectivity or provider permission; execution checks the
actual app service separately.

Saved platform plans use a bounded read-only decoder for the maintained
guestbook recipe. Its retained spec source must exactly match the saved plan
source, and member mode must agree with the retained request and qualification
observation. A historical pin remains inspectable with its original spec bytes;
the UI identifies the current Composer pin separately. This does not migrate,
approve or execute old plans. Planning an update and every actual effect retain
the existing current source/policy/role checks. Generic portable specs and global
maintenance still refuse stale pins and members mode.

## Trusted version 2 bridge

The bridge retains the existing binding and dedicated member token. It builds
this envelope from trusted account identity, the currently published governed
synthetic service, the stored app-resource configuration and fresh app reads:

```text
schema: composer.member-operation/2
actor: {issuer, accountId}
workspace, resource, action
configuration: {revision, digest, source}
context: {dataClass: synthetic}
input
```

Browser-supplied configuration, proof, actor or data-class assertions cannot
select this authority. Dispatch requires current membership and the exact
`contribute` or `moderate` grant. The final audit SQL also checks that the
observed policy, request, publication and configuration remain unchanged.
Actual source, active configuration, visibility/mode and version 2 build
descriptor must match. Existing closed/postcard paths retain the version 1
envelope. Members mode cannot fall through to that older contract.

Contribute input includes one stable `operationId`, caption, author, consent and
PNG. An unconfirmed response retains the original ID and exact input. The UI
offers an explicit `contribution-status` lookup with only that ID. A matching
completed receipt confirms the submission. `pending` sends no new submission;
`not-recorded` permits a deliberate retry of the same unchanged operation.
For durable `pending` operations, Composer offers an explicit same-ID Resume
only when the original configuration matches the current governed service and
its synthetic body digest matches the frozen postcard input. The app performs
its normal current checks again; no payload edits or new ID are permitted.
There is no automatic replay or replacement ID. The lookup requires the current
contribution grant, but can observe the original receipt after an explicit
closure or policy pause. These reads cannot reopen contribution access.
An invitation cannot switch workspace while a profile/app draft, in-flight
operation or uncertain receipt is retained. If work starts while an invitation
is being accepted, membership acceptance leaves the current scope intact.

## Verification and remaining gates

Focused tests cover omitted-field closed plan bytes/digest at the reviewed pin,
finite source qualification, explicit policy opt-in and generic portable refusal,
finite manifest qualification, delegated role 10 access, current native/CMS
denials, additive setup observations and stable receipt identity. A separate
in-memory synthetic module graph exercises the v2 bridge and policy/grant/source/
configuration denials without editing the actual lock or qualifying its source.
That fixture is not independent Guestbook runtime proof.

Release evidence must identify Guestbook's exact qualified source, private
service promotion, native interactions and the clean pushed-main Composer guard.
Inspect both themes and phone/desktop operation at the integrated source.
Browser, production, physical-device and human acceptance remain separate.
No build, deployment, invitations or production records are authorised by this
document.

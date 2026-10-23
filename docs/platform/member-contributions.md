# Member-only contributions: prepared increment

This increment is prepared from Composer `7a9b964dfab7b39a0d561ee55af3a64911f472c6`.
It does not promote an independent app, change credentials or configure production.
The committed Guestbook source remains the version 1 member-service release;
member contributions remain **unqualified** on that source.

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
Runner availability validates adapter configuration only. It does not establish
upstream network connectivity or provider permission; execution checks the
actual app service separately.

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
There is no automatic replay or replacement ID. The lookup requires the current
contribution grant, but can observe the original receipt after an explicit
closure or policy pause. These reads cannot reopen contribution access.

## Verification and remaining gates

Focused tests cover unchanged omitted-field plan bytes/digest, current v1 refusal,
finite manifest qualification, delegated role 10 access, current native/CMS
denials, additive setup observations and stable receipt identity. A separate
in-memory synthetic module graph exercises the v2 bridge and policy/grant/source/
configuration denials without editing the actual lock or qualifying its source.
That fixture is not independent Guestbook runtime proof.

Before release: independently qualify/release Guestbook's exact v2 source,
deliberately promote its manifest/source pin, rerun source and native interaction
checks, inspect both themes and phone/desktop operation, then use Composer's
normal clean pushed-main release guard. Browser, production, physical-device and
human acceptance remain separate. No build, deployment, invitations or production
records are authorised by this document.

# Invited creators: profiles and shared app tools

Open **[My profile / My apps](/me)** to maintain your own Linkarooie profile and
use the app actions shared with your account. Workspace owners use
**[People & access](/people)** to prepare invitations, grant selected actions and
revoke them. Both surfaces use the installed EmDash account and session.

An invitation is a workspace record. Admission by the configured authentication
provider, account creation, invitation acceptance, profile creation and usable
app permission are separate states. Preparing an invitation sends no email and
changes no Cloudflare Access policy. A person who can sign in but has no accepted
membership or profile grant sees the relevant next step in My apps.

## Set up two invited members

In People, select a workspace you own and prepare a recipient-bound invitation.
After each intended person has an account and accepts their invitation in My
apps, grant their app actions explicitly:

| Person | Profile actions | Selected visitor book |
| --- | --- | --- |
| Member A | Create, maintain, and separately publish/export their profile | Contribute |
| Member B | Create, maintain, and separately publish/export their profile | Moderate only after an explicit grant |
| Owner | Manage workspace membership and exact app grants | Separately authorised operator tools |

Creation uses the **New profile** entitlement. On successful creation or recovery,
Composer binds only the still-current selected entitlements to that app-owned
profile ID. Creation alone does not grant publication or export. Select an
existing ready visitor book for Guestbook permissions; a profile never owns its
contributions or inherits moderation authority.

My apps opens the saved profile draft. Edit identity and introduction, organise
links and groups, feature links, and use the existing tags and milestones.
**Preview my edits** previews the current editor state. **Save profile draft**
saves privately; **Publish saved profile** deliberately updates the visitor
snapshot. Refresh preserves unsaved fields for comparison, and navigation warns
about unfinished work. Account, workspace and profile changes invalidate pending
results instead of applying them to the new selection.

A profile has a stable app ID owned by the authenticated installation/account
pair. Its editable public handle changes its URL, not its owner. An account can
have no profile; a saved profile can remain private or hidden; revoking a grant
retains app content. The existing owner's root profile, artwork and collection
remain independent and are not replaced by these member documents.

## Prepare, release and publish a card

1. Save the profile content that should appear on the card. **Prepare share
   card** hands that saved public-safe snapshot to the maintained Launch Kit
   editor in a separate tab. Unsaved profile edits remain in the original tab.
   **Download profile snapshot** is the fallback when browser restrictions stop
   the hand-off.
2. Choose a maintained preset, inspect the encoded PNG and download its recipe
   and image. Text-only rendering works with AI disabled. Original artwork stays
   local; the snapshot contains the selected public name, handle, introduction,
   image description and profile identity/revision, not account or app records.
3. An authorised publisher prepares and releases the selected immutable asset.
   The member receives an adoption receipt, not deployment credentials.
4. Back in My profile, select that receipt and compare the current/proposed
   images. **Select image for next publication** validates the exact profile/revision,
   text and deployed image. **Publish saved profile** then activates that saved
   profile/card snapshot for visitors.
5. **Verify served result** checks the mounted public URL, selected profile
   revision, image MIME type, actual PNG dimensions and hash. The operator also
   verifies the supported standalone route. Native social rendering is a
   separate acceptance item.
6. To restore the previous image, use **Restore previous approved image**, then publish
   the saved profile again and verify its public result. This keeps revision
   checks and does not rewind unrelated app records.

In the independently owned Launch Kit checkout, the existing local command runs
the same renderer with external requests blocked:

```sh
pnpm build
pnpm render /absolute/selected-recipe.json /absolute/render-output --compare
```

In the intended Linkarooie checkout, the bounded publisher hand-off is:

```sh
node scripts/prepare-share-card.mjs \
  --recipe /absolute/selected-recipe.json \
  --image /absolute/inspected-card.png \
  --snapshot /absolute/saved-profile.json \
  --output /absolute/adoption-receipt.json
```

Review and commit the prepared asset, then use Linkarooie's existing clean
pushed-main `pnpm deploy` guard. Composer's mounted copy additionally requires
its exact source-pin promotion and guarded root release before adoption there.
A prepared receipt or uploaded asset does not publish a member profile. A stale
snapshot, newer manual image, wrong profile, revoked permission or failed asset
release must be resolved before selection; uncertain outcomes require a fresh
saved-state check rather than an automatic retry. Unsupported font coverage
remains an explicit error. See [Launch Kit](launch-kit.md) for the renderer and
[Linkarooie's app-owned contract](https://github.com/loftwah/app-composer-showcase/blob/main/docs/member-profiles.md).

## Access and recovery boundaries

Subscriber role 10 can use the private `composer-members` plugin through EmDash's
`content:read` permission. The existing Creator draft-content gate and operator
`plugins:manage` gate remain separate. A workspace role or app grant does not
grant CMS drafts, global settings, account management, secrets or deployments.
[The shared backend contract](invited-member-access.md) describes the exact
session, invitation, grant, actor and revision checks.

Immediately before app dispatch, a single SQL statement records the operation
only while the current membership and exact active grant revision still exist.
That statement is the dispatch boundary: already dispatched work may finish
after revocation, but the next protected dispatch is denied. Removing B's
Guestbook moderation grant preserves B's profile grants and the Guestbook's
content. Guestbook independently enforces its selected resource, pending review,
source visibility and media revocation. Its named member service cannot dispatch
settings, exports, private-media downloads or general owner APIs.

Linkarooie publishes a separate public-only profile snapshot. Other members may
read that public profile, but cannot read its private draft, write it or export
it. Login emails, invitations, internal account keys and access/audit records
stay out of public profiles and metadata. Settings export contains the supported
settings only; it is not a complete profile backup or reconstruction promise.
The separate collection export retains its declared scope and explicit export
permission. Source-backed contributions recheck the owning app's current
eligibility on render/export.

`composition.lock.json` pins each app source and its versioned manifest. Promotion
adds the named Guestbook member binding only for an explicitly declared
`memberService` contract and keeps member credentials separate from owner
credentials. The workbench's copied pure view adapters keep their own exact
source pins and SHA-256 values in `src/vendor/workbench/sources.json`; an app
release does not silently update those copies or promote its mounted service.
Forward Composer grant and Linkarooie profile migrations are additive. Preserve
a normal authorised D1 export before remote application and retain new tables
when rolling code back; do not delete member content as rollback.

## Qualification and remaining human steps

The [owned local lab](../labs/invited-members/README.md) uses supported EmDash
native account/passkey APIs with a fictional owner and two distinct role-10
members, actual local app storage and real browser components. It qualifies a
local authenticated journey, not production Cloudflare Access admission. Native
virtual authenticators are not physical passkeys or device acceptance.

The lab keeps its copied projects, databases, credentials, certificates, sessions
and registered processes under one owned temporary root. Preserve only bounded
redacted receipts, screenshots and labelled recordings before stopping it.
`node labs/invited-members/run.mjs stop` removes only that registered root and
matching process identities; an active qualification session remains until its
owner explicitly finishes it. The separate Guestbook release checkout was
removed after its bounded production receipt was copied into the integration's
ignored evidence directory.

Production fresh-person admission may still require a specific Access or
authentication-mode change. Prepare the exact account/policy proposal,
consequences and recovery first, then obtain owner approval; do not send real
invitations or grant real people access for demonstration. Physical iPhone,
actual screen-reader use, native social unfurls and owner acceptance remain
separate gates. [Issue #11](https://github.com/loftwah/app-composer/issues/11) owns
the final exact-source receipt, local/production distinction and outstanding
acceptance; screenshots or an app release alone do not establish the complete
production journey.

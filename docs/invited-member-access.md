# Invited member access

`/me` uses the installed EmDash account/session and the private
`composer-members` plugin. Its `content:read` host permission accepts Subscriber
(role 10); the existing Creator `content:read_drafts` and operator
`plugins:manage` routes keep their gates. The member surface requires the same
site Origin on writes and `X-EmDash-Request: 1` on every request.

The installed runtime is EmDash 1.2.0. The maintained official contracts are
[authentication](https://docs.emdashcms.com/guides/authentication/) and
[plugin routes](https://docs.emdashcms.com/plugins/creating-plugins/api-routes/).
On private plugin requests, production external authentication revalidates
Access; it does not substitute an old session after Access refusal. EmDash
records the authenticated account in its Astro session for ordinary pages.
The installed dispatcher is exercised directly by `tests/member-access.test.mjs`.
A successful dispatcher test is distinct from browser sign-in qualification.

The configured production authentication provider still admits/provisions
people separately. A pending workspace invitation neither changes Access policy
nor sends email nor creates an account. Subscriber accounts can list and accept
recipient-bound invitations without acquiring CMS drafts/settings permission.
They receive no automatic personal owner workspace. Owners select workspace
membership and app actions separately; app account identifiers come only from
the authenticated context. Email is used for invitation recipient matching,
never ownership.

## Shared data and app boundaries

Migration `0010_member_app_grants.sql` adds Composer-owned grant and audit tables.
It reuses `creator_members` and existing invitations, including their one-time
acceptance, expiry and workspace access revision checks. Each app grant records
installation issuer `https://composer.loftwah.com`, stable account subject,
workspace, app, resource, action, status and revision. These records and login
emails remain private. Resource content remains app-owned.

Profile creation is a separate `new-profile:create` entitlement. The owner can
also select `maintain`, `publish` and `export` entitlements independently. A
successful app create or own-profile recovery read returns its stable profile
UUID; Composer binds only the selected current entitlements to that UUID in a
single transaction. Membership, workspace revision and every observed grant
revision must still match. The consumed entitlements are retained as revoked
rows. Creation alone never manufactures publish/export access. A lost result
retains entitlements so an own-profile read can recover. Revocation while the
app was creating prevents binding; the app draft is preserved for a later
explicit owner decision.

Profile `create/read/config/cards/presentation/tags/achievements/invitation/
profile-settings/export/publish/hide/share-card` operations use one narrow
app service endpoint. Server identity is `{issuer,subject}`. Share-card adoption
and rollback require the `publish` grant. Draft rendering and snapshot reading
use `maintain`; export requires `export`. The app independently verifies profile
ownership, revisions and its dedicated bridge token.

Guestbook grants select an existing ready workspace resource and either
`contribute` or `moderate`. The named `GUESTBOOK_MEMBERS` service binding calls
only `GuestbookMemberService.fetch` with the existing resource's exact account,
environment, source and mounted target plus a dedicated member token. The
ordinary public Worker never handles that endpoint. App-owned approval,
visibility, resource revisions and media rules remain in Guestbook.

Immediately before dispatch, one SQL statement records the dispatch only if
membership and the exact active grant revision still exist. This audit insertion
is the dispatch boundary. A request already dispatched may finish after a
revoke; revocation does not undo app content. The next dispatch is denied and
new profile-grant binding is refused after an intervening access change. Client
responses retain their original actor identity so account/workspace generation
checks can discard a delayed result. Removing a member prevents all subsequent
app dispatch without deleting app content.

## Migration and recovery

This additive Composer migration changes no existing owner profile, settings,
media, stack or publication. Existing members/invitations remain intact; no app
grant is inferred from old CMS roles. Apply through the existing reviewed D1
migration/release path after the app services and exact source pins are ready.
The SQLite tests apply representative prior migrations and exercise existing
owner membership alongside two distinct role-10 accounts.

Before an authorised remote application, preserve a normal D1 export using the
existing operator process. To disable this slice, roll back the Composer source
and app service bindings: prior code does not consult the new tables, and app
content stays intact. Keep the additive tables for audit and later recovery;
do not drop them as an automatic rollback. Re-enable only against the same
issuer/account authority and reviewed source pins. Dedicated secrets are
`COMPOSER_PROFILE_BRIDGE_TOKEN` and `GUESTBOOK_MEMBER_TOKEN`; no deployment
credential is supplied to a member.

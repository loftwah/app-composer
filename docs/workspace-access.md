# Workspace access

The native **Workspace access** page in Composer administration lists your
workspaces, their roles and invitations addressed to your signed-in account.
**Open this workspace’s stacks** selects that exact workspace for subsequent
Creator stacks requests. The server checks membership on every request; a URL
or a copied invitation page link grants no authority. The existing personal
workspace remains the default even when another membership was created at the
same time. Saved stacks and publication snapshots remain in their workspace.

## Existing Access authentication comes first

Creator pages and their private routes use EmDash 1.2.0's native React page
registration and existing `content:read_drafts` contributor permission. An
already Access-authorized contributor (role 20 or higher) can use their
personal Creator workspace and accept an explicitly
recorded editor/viewer invitation. Every Creator operation also checks the
selected workspace membership and capability. Subscribers (role 10), anonymous
callers and machine tokens without a bound user cannot use these routes.

Workspace membership cannot create a CMS account, promote an EmDash user,
change an Access policy or bypass sign-in. No global permissions are granted.
Legacy **Manage mini-apps** remains `plugins:manage`/role 50, as do the existing
EmDash global administrator APIs. Existing site administrators retain their
independent global privileges; a workspace role does not reduce them.

The current Access configuration auto-provisions new accounts as subscribers
(role 10), with role synchronization disabled. Existing account roles, including
the owner’s administrator role, are preserved. Invited subscribers use **My
profile / My apps** at `/me`; its private member routes require the supported
`content:read` permission plus current workspace membership and exact app,
resource and action grants. Owners manage those invitations and grants at
`/people`. These member surfaces do not open the legacy Creator routes or
`Manage mini-apps`, and a workspace invitation does not create a personal
Creator workspace for a subscriber.

A new person still needs the site's existing Access admission. The member
feature neither performs nor verifies that consequential prerequisite. The
historical exact-owner Access allowlist remains unchanged until MP explicitly
authorizes selected additional identities; changing the new-account role does
not admit anyone through that policy. The official
[EmDash authentication guide](https://docs.emdashcms.com/guides/authentication/)
and [native page/API documentation](https://docs.emdashcms.com/plugins/creating-native-plugins/react-admin/)
describe these host boundaries. Installed 1.2.0 page routing and the production
plugin permission dispatcher are exercised by the fictional local proof.

## Roles and invitations

| Workspace role | Supported actions |
| --- | --- |
| Owner | Existing stack lifecycle, including stack deletion; prepare/revoke editor or viewer invitations; change or remove non-owner memberships. |
| Editor | Read/export, create, edit, publish, archive/restore and duplicate stacks; app writes continue to require the app’s existing capability checks. |
| Viewer | Read and export stacks. No app settings, private moderation or membership writes. |

Only owners see the membership roster and invitation history. Other members see
their own workspace role. No site-wide user directory is exposed. Existing
legacy member rows keep their IDs; accepted members supply their own trusted
account name/email for that workspace’s roster.

An owner records an invitation for an account email and an editor/viewer
role. It remains pending for seven days. **No email is sent.** The optional
copied link opens the protected Workspace access page; it is not a bearer
credential. Only the authenticated creator whose trusted account email
matches the record can accept it. Acceptance is explicit, atomic and one-time.
It adds that workspace membership while keeping the recipient’s existing
personal workspace. Revoked or expired records cannot grant access. Preparing
another record for the same email requires revoking or expiring the old pending
record first.

Owner memberships, original personal ownership, ownership transfer and workspace
deletion are protected from these routine controls. Those consequential actions
remain a separate reviewed product and permission decision. Removing a member
leaves the workspace’s stacks, publications and app-owned records intact.

## Changes, conflicts and recovery

Each membership/invitation mutation compares the selected workspace’s access
revision and the specific member role or invitation revision in the same D1
transaction as its writes. A concurrent change must be refreshed before another
write. Recipient identity comes from EmDash’s authenticated context, never the
request body. The forms keep entries made while a reply is delayed. A lost or
malformed acknowledgement blocks further writes until **Refresh access** reads
the current records; it never claims an email was delivered.

Native stack mutations also include their required current member role in the
durable SQL predicate. A revocation committed before that write refuses the
write without changing stack/publication bytes. Private resource journal writes
have the same guard. An app service operation already dispatched cannot be
cancelled by changing a local membership; its existing operation receipt and
reconciliation contract still applies. This feature does not claim remote
cancellation, general account recovery or production invitation delivery.

Creator and Workspace access forms use the installed EmDash host router's
supported navigation blocker for sidebar links and browser Back/Forward. Dirty
forms ask before discarding entries; pending operations refuse these route
changes. Full-document refresh/navigation retains the native beforeunload
warning. The exact direct `@tanstack/react-router` dependency matches EmDash
1.2.0's existing 1.163.2 dependency and resolves to the same router context;
it adds no second router/provider or authentication layer. The exact old
`@tanstack/history@1.161.4` request is overridden to official `1.162.2`, the
first release containing [upstream traversal fix #8264](https://github.com/TanStack/router/pull/8264).
The installed older history always reversed a blocked POP by one forward entry,
which left cancelled Forward/multi-entry traversals at the wrong browser URL.
The fixed release restores the signed traversal distance and preserves native
unload warnings. No runtime history method is patched by Composer. See the
[TanStack navigation-blocking API](https://tanstack.com/router/latest/docs/api/router/useBlockerHook).

Creator stacks keeps its workspace selector fixed for the page and sends it explicitly on requests;
responses for another workspace are refused. Workspace access keeps invitation
entries with their original workspace and disables selection while a request
is pending.

Limits are 32 memberships per account, 64 members per workspace and 32
unexpired pending invitations per workspace. The owner view shows up to 50
recent invitation records, with pending records first.

The forward migration is `0008_workspace_access.sql`; it adds access revisions,
optional roster profile fields and recipient-bound invitation records. Existing
personal selections, owner memberships, stack documents and publication bytes
are retained. Fictional-only local tests and browser fixtures do not establish
new-person admission, a real invitation send or live collaboration acceptance.

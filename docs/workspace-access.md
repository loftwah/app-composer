# Workspace access

The native **Workspace access** page in Composer administration lists your
workspaces, their roles and invitations addressed to your signed-in account.
**Open this workspace’s stacks** selects that exact workspace for subsequent
Creator stacks requests. The server checks membership on every request; a URL
or a copied invitation page link grants no authority. The existing personal
workspace remains the default even when another membership was created at the
same time. Saved stacks and publication snapshots remain in their workspace.

## Administrator access comes first

This collaboration slice stays behind the existing Cloudflare Access boundary,
EmDash administrator role 50 and native `plugins:manage` permission. Access
auto-provisioning currently gives role 20 and does not itself grant these native
administration permissions. Workspace membership cannot create a CMS account,
promote an EmDash user, change an Access policy or bypass either sign-in check.
There is no public signup or guest-to-owner login path here.

Workspace roles govern the scoped Creator APIs. They do not reduce an existing
EmDash administrator’s independent site or legacy global mini-app privileges.
Admitting a new person as a CMS administrator is a separate consequential grant;
this is not a least-privilege customer-admission or tenant-signup workflow.

The site operator must separately admit any real administrator through the
supported Access and EmDash account process. This feature does not perform or
verify that prerequisite for a new person. See the official
[EmDash authentication guide](https://docs.emdashcms.com/guides/authentication/).

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

An owner records an invitation for an administrator email and an editor/viewer
role. It remains pending for seven days. **No email is sent.** The optional
copied link opens the protected Workspace access page; it is not a bearer
credential. Only the authenticated administrator whose trusted account email
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

Creator stacks warns before leaving unsaved edits or a pending operation. Its
workspace selector is fixed for the page and sent explicitly on requests;
responses for another workspace are refused. Workspace access keeps invitation
entries with their original workspace and disables selection while a request
is pending.

Limits are 32 memberships per administrator, 64 members per workspace and 32
unexpired pending invitations per workspace. The owner view shows up to 50
recent invitation records, with pending records first.

The forward migration is `0008_workspace_access.sql`; it adds access revisions,
optional roster profile fields and recipient-bound invitation records. Existing
personal selections, owner memberships, stack documents and publication bytes
are retained. Fictional-only local tests and browser fixtures do not establish
new-person admission, a real invitation send or live collaboration acceptance.

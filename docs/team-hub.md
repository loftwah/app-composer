# Team Hub: private local application slice

Team Hub at `/team-hub` stores a team's requests, assignment, status, private text
attachments and immutable request history. This is a Composer-owned application
route using the installed EmDash 1.3.1 sessions and private plugin dispatcher.
It is not an independently deployed reference application. Broader #354/#351
delivery, including EmDash-backed knowledge and runbooks, remains open.

## Admission and authority

The only admitted authentication profile is explicit `TEAM_HUB_AUTH_PROFILE=native-local`
with a loopback `PUBLIC_ORIGIN`. Missing configuration and every production
origin return 503 before reading application data. There is no production MFA
qualification flag or automatic grant. The account and environment come from
`RESOURCE_ACCOUNT_ID` and `RESOURCE_ENVIRONMENT`; browser input cannot select them.

A current, enabled EmDash account must also have current workspace membership
and an explicit active `team-hub` / `team-hub-<environment>` / `contribute` grant.
Native role 50 does not bypass membership or application grants. A workspace
owner can explicitly enable a previously absent hub, granting only that owner
use and management access. Owners with `maintain` can grant eligible members
access and revoke other users; self-revocation is refused to preserve recovery.
Workspace invitations still use existing `/me` acceptance and do not send mail
or change provider admission.

| Workspace role | Explicit app use                               | Explicit app management                                 |
| -------------- | ---------------------------------------------- | ------------------------------------------------------- |
| Viewer         | Read requests/history and download attachments | None                                                    |
| Editor         | Viewer actions plus create/update requests     | None                                                    |
| Owner          | Editor actions                                 | Grant/revoke eligible members when `maintain` is active |

Every mutation compares the hub revision and relevant request/grant revision.
Its SQL authority condition rechecks membership, current role, enabled user,
application grants and eligible recipients at the update boundary. Losing a race
does not overwrite a previous request version. Reads check access before their
snapshot queries: revocation is enforced on the next request, and does not cancel
a response already admitted. The browser clears its private snapshot on access
denial and clears the previous team's data when switching scope.

## Data and native integration

Migration `0021_team_hub.sql` widens the existing application discriminator with
`team-hub`. It copies every existing grant column without changing grant IDs,
issuer, status, revision, timestamps, uniqueness or membership cascade. Existing
audit rows remain untouched. The focused suite compares legacy rows exactly,
runs with SQLite foreign keys enabled, checks `foreign_key_check` and exercises
membership deletion. The legacy member API deliberately continues to return
only its existing Showcase/Guestbook schema; Team Hub grants use this app's API.

Application tables are scoped by installation account, environment and team.
Each team has at most 40 requests; titles are at most 100 characters and bodies
3,000. One optional ASCII-named `.txt` attachment is limited to 16,000 UTF-8
bytes and stays in the private application tables. It is never registered as
public EmDash media. Downloads require the same fresh authority checks as reads.
Request updates retain immutable versions; this slice provides history, not a
history-restoration command. Responses use `Cache-Control: no-store` and
`X-Robots-Tag: noindex`; the ordinary document contains no private SSR snapshot.

The official [plugin route contract](https://docs.emdashcms.com/plugins/creating-plugins/api-routes/)
was rechecked against installed 1.3.1. The shared `composer-members` plugin
registers `teamHubRead` (GET) and `teamHubWrite` (POST, JSON, 24,000 bytes), both
with `content:read` and `response: "raw"`; the helper returns `pluginResponse`.
The client uses the native anti-CSRF header and same-origin requests. The
document guard `teamHubPageGate` must run in middleware before page rendering.
These are the only required shared integration points. No new public sitemap
entry, native administrator permission or duplicate app navigation is added.

An optional `TEAM_HUB_SERVICE` binding can answer the fixed
`https://team-hub-private.invalid/status` request with a bounded availability
result. The browser cannot supply a URL, credential or binding name. A two-second
abort signal is passed; provider payloads, addresses and credentials are not
echoed. Only mocked binding behavior is tested: no real connection is qualified.

## Required production gate

The existing outer Access boundary covers `/_emdash*`, **not the ordinary
`/team-hub` document**. Before adding any production-admitting profile, implement
and qualify verified Access admission for both the document and private APIs,
including aliases/preview/assets where applicable. Select the exact production
passwordless sign-in policy with mandatory MFA and no bypass; record real
IdP/Access policy proof and negative live session/revocation journeys. An existing
native cookie, a claimed MFA flag, local passkeys or API-only Access coverage
cannot satisfy that contract. This slice changes no production IdP policy.

EmDash-backed knowledge/runbooks need a separately qualified private content
lifecycle. Installed native `content.update` has no revision CAS; use immutable
draft entries with an application CAS pointer, and enforce the publication
boundary before claiming those entries cannot leak through native public REST.
Current private request records make no EmDash content or public-media writes.

Actual local browser evidence and its explicit seams are recorded in
[the native receipt](evidence/team-hub-20261025/README.md). Physical passkeys,
assistive technology, actual phones, provider service bindings, hosted Access
and production passwordless/MFA acceptance remain unqualified.

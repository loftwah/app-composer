# Federated identity, Active Directory/Entra ID, and a credible optional Microsoft exit

**Issue:** [#352](https://github.com/loftwah/app-composer/issues/352)
**Dated:** 2026-10-25 UTC (Australia/Melbourne, 25 October 2026)
**Lane:** parallel run J3 — read-only research
**Repository inspected:** `loftwah/app-composer` at `5e012f98e15dceb009e98468d0e541e00401d918`
(also the live production revision, observed 2026-10-25 06:04 UTC)
**Report path:** `output/parallel-run-20261025/research/352-federated-identity.md`
**Related owners:** #257 (sign-in/MFA/Access and identity lifecycle), #113 (workspace/team roles), #10 (trust boundaries), #198 (EmDash admin), #253 (portability/exit), #255 (integration catalogue), #216 (Platform Teams), #29/#30/#286 (presentation), #11 (release evidence).

## Evidence boundary

What this report is based on:

- Direct inspection of this revision: `astro.config.mjs`, `wrangler.jsonc`, `src/worker.ts`,
  `src/lib/access-boundary.mjs`, the `composer-members` plugin and its workspace/grant modules,
  migrations `0008` and `0010`, `tests/access-boundary.test.mjs`, and the installed
  `emdash@1.3.1` / `@emdash-cms/cloudflare@1.3.1` packages in `node_modules`.
- Read-only live probes of the public production origin on 2026-10-25 06:04 UTC
  (`/build.json`, `/healthz`, and unauthenticated status codes for five paths).
- Current vendor documentation fetched 2026-10-25 UTC; each source records its own
  last-updated date and is listed in §11.

What was **not** done, and is therefore **not** claimed:

- No Entra tenant, Entra External ID tenant, Cloudflare Zero Trust organisation, Access
  application, IdP connection, SCIM application, policy, DNS record or production identity
  setting was created, changed or tested.
- No paid licence was purchased, trialled or assumed. No credential was handled.
- No generic OIDC or SAML IdP was run end-to-end. No federated sign-in fixture was executed.
- No tenant-specific behaviour was observed. Everything about Conditional Access sync,
  group-claim contents, SCIM timing, session revocation timing and email-claim shape is
  **documentary or unverified** unless marked *verified in source*.
- Nothing here establishes enterprise SSO, SCIM provisioning, device compliance, custom
  roles, MFA policy or multi-tenant onboarding as shipped.

---

## 1. Verdict

1. **Composer is a single-IdP application today, and that IdP is whoever Cloudflare Access
   is configured to trust.** The repository pins Cloudflare Access as the *exclusive*
   production authentication mode. There is no OIDC client, SAML SP, SCIM endpoint, tenant
   model or group-to-role mapping in Composer source. (Verified in source; see §3.)
2. **Two of the four customer journeys are already credible, one is configuration-only,
   and one is a genuinely separate programme.** Journey A (keep Entra, adopt Composer) is
   plausible on vendor-documented rails because Cloudflare Access has a first-class Entra
   connector and generic OIDC/SAML. Journey B (non-Windows endpoints) is mostly true for
   *browser* access and false for *managed device* assurance. Journey C (leave Microsoft
   identity) is standards-portable at the protocol layer and sticky at the policy layer.
   Journey D (legacy AD-dependent apps) is out of scope for Workers and needs a bridge or a
   rewrite.
3. **The sharpest defect is identity binding, not SSO.** The installed EmDash Access adapter
   resolves users by **email address** and discards the IdP subject. Composer then binds
   workspace membership and app grants to the local EmDash ULID. That works, but it means a
   recycled email at the same or a new IdP can inherit an existing account and its role.
   Until a durable `(issuer, subject)` binding is stored and new subjects cannot silently
   inherit privileges, "enterprise SSO" is an admission feature, not an identity assurance
   feature. (Verified in installed source; see §3.3 and §7.)
4. **Group-to-role mapping exists in the adapter and is turned off here.** `syncRoles:false`,
   no `roleMapping`, `defaultRole:10`. New Access-admitted identities become Subscribers, and
   IdP groups are read but not used for authorisation. Mapping by **group display name** is
   also a weak key: names are mutable and non-unique, and the adapter does not match on group
   ID. (Verified in source and adapter types.)
5. **Smart-card, phishing-resistant, Conditional Access and device-compliance controls remain
   upstream.** Composer does not implement MFA, passkeys, device trust or risk. When Entra is
   the IdP those controls still apply *at Entra*; Cloudflare can additionally require an
   Entra authentication context, an MFA method, or Cloudflare device posture. Composer cannot
   see or enforce any of them, and must never infer deployment authority from an IdP group.
6. **A Microsoft exit is credible only as an incremental, reversible re-pointing of the
   Access IdP plus a local identity-binding contract.** OIDC/SAML and SCIM are portable.
   Entra Conditional Access, Intune compliance, Entra ID Protection risk, Entra group object
   IDs, `oid` values, Entra ID Governance, Teams/SharePoint data and Windows device
   management are not. Losing them is a security regression unless a replacement is chosen
   deliberately. §8 proposes a contract, not an implementation.
7. **Recommendation: do not build an identity platform.** Run one narrow, no-cost experiment
   that proves the *origin-side contract* (durable binding, fail-closed group mapping,
   deprovisioning, session revocation) against synthetic identities. Defer any real IdP
   tenant until the owner authorises an isolated tenant and the experiment's assertions are
   agreed. (§9.)

---

## 2. Separating the things people call "Active Directory"

The issue is right that this is the first source of confusion. These are five different
products with different protocols, different attack surfaces and different exit costs.
Microsoft's own comparison is the primary source [S18]; hybrid identity is separately
defined [S19].

| Thing | What it actually is | Protocol / mechanism | What it does | What it is not |
| --- | --- | --- | --- | --- |
| **AD DS** (on-premises) | Self-managed directory on Windows Server domain controllers | LDAP/LDAPS, Kerberos, NTLM, DNS, SMB, GPO | Authentication and authorisation for domain-joined Windows, file shares, printers, legacy apps, Group Policy | Not a web SSO service; not cloud; not reachable safely from Workers; not replaced by OIDC |
| **Microsoft Entra ID** (formerly Azure AD) | Cloud identity provider and directory | OIDC/OAuth 2.0, SAML 2.0, SCIM, Microsoft Graph | Workforce sign-in, app assignment, Conditional Access, device registration, group claims, provisioning | Not AD DS; no Kerberos/NTLM for legacy apps; not a device management product by itself |
| **Hybrid AD DS ↔ Entra** | Synchronisation or federation between the two | Entra Connect / Cloud Sync, or AD FS federation | One identity across on-prem and cloud; source-of-truth and sync direction are design choices | Not a single directory; stale membership, dual write and recovery are real operational issues |
| **Entra Domain Services** | Microsoft-managed domain with a *subset* of AD DS features | LDAP, Kerberos, NTLM, domain join, GPO, trusts (Enterprise SKU) | Lift-and-shift legacy apps needing domain protocols | Not Entra ID; not full AD DS (no schema extension, no domain/enterprise admin); not a web IdP |
| **Windows / Intune / Microsoft 365** | Endpoint management and productivity estate | Entra join, Intune MDM/MAM, GPO, Exchange/SharePoint/Teams | Device compliance, app deployment, mail/files/collaboration, Windows-only line-of-business apps | Replacing web sign-in does not replace any of it |

**The critical sentence for product copy:** replacing web-app sign-in changes *who can open a
web application*. It does not change domain join, device compliance, file shares, printing,
DNS, Group Policy, Windows-only applications, mailbox/file data in Microsoft 365, or Teams
and SharePoint integrations. Those are separate projects with separate owners.

### Six different authorities that are routinely conflated

| Layer | Question | Where it is enforced in this stack (2026-10-25) |
| --- | --- | --- |
| Authentication | Who is this person? | Cloudflare Access, delegating to the configured IdP (Entra, generic OIDC/SAML, OTP, Cloudflare account) |
| Directory | What is the canonical record of people/groups? | The IdP; optionally synchronised into Cloudflare's user registry by SCIM |
| Provisioning | How do accounts appear and disappear? | IdP → (SCIM) → Cloudflare; EmDash JIT-provisions on first authenticated request; Composer invitations are local |
| App authorisation | What may this person do here? | EmDash role (10–50) + Composer workspace role + `creator_app_grants` |
| Device trust | Is the endpoint healthy/managed? | Entra/Intune and/or Cloudflare One Client posture; **not Composer** |
| Workload identity | What may this machine/deployment do? | Cloudflare API tokens, Worker bindings, Composer agent grant hashes; **never** an Entra group |

The field guide already states this separation for the platform programme [R1]; this report
confirms it against the actual installed code.

---

## 3. What Composer actually does today (verified in source and live)

### 3.1 The five enforcement layers

```
                     ┌──────────────────────────────────────────────┐
  Browser ──HTTPS──▶ │ Cloudflare edge                              │
                     │  Access application (hostname/path scope)    │
                     │  policy: Allow + Require/Exclude             │
                     │  IdP: Entra / generic OIDC / generic SAML /  │
                     │       OTP / Cloudflare account               │
                     │  optional: MFA method, CA auth context,      │
                     │            device posture, session duration  │
                     └───────────────┬──────────────────────────────┘
                                     │ Cf-Access-Jwt-Assertion (+ cookie)
                     ┌───────────────▼──────────────────────────────┐
                     │ Composer Worker (src/worker.ts)              │
                     │  protectAdministration(): only /_emdash*     │
                     │  verify RS256, iss=team, aud=AUD, exp        │
                     │  deny if unconfigured / ambiguous path       │
                     └───────────────┬──────────────────────────────┘
                     ┌───────────────▼──────────────────────────────┐
                     │ EmDash 1.3.1 external auth on private routes │
                     │  re-verify JWT; GET /get-identity for groups │
                     │  find-or-provision by EMAIL; role mapping    │
                     │  set Astro KV session for public pages       │
                     └───────────────┬──────────────────────────────┘
                     ┌───────────────▼──────────────────────────────┐
                     │ Composer plugins                             │
                     │  EmDash permission (content:read,            │
                     │  content:read_drafts, plugins:manage)        │
                     │  + workspace membership (owner/editor/viewer)│
                     │  + exact app/resource/action grant           │
                     └───────────────┬──────────────────────────────┘
                     ┌───────────────▼──────────────────────────────┐
                     │ Generated apps (Guestbook, Showcase, …)      │
                     │  separate Workers and data; public visitors  │
                     │  anonymous; member calls use Composer account│
                     │  IDs and server-held tokens, not IdP tokens  │
                     └──────────────────────────────────────────────┘
```

| # | Layer | Enforced at | What it actually enforces | What it does **not** enforce |
| --- | --- | --- | --- | --- |
| 1 | **Access admission** | Cloudflare edge, before the Worker | Who may reach the protected hostname/path, using the IdP login and Access policy; optional MFA method, Entra auth-context, device posture, session lifetime, revocation [S5][S6][S8][S12][S13] | Composer roles; workspace membership; app grants; anything outside the Access application's path scope; a `Bypass` policy enforces nothing and is not logged [S8] |
| 2 | **Worker gate** | `src/lib/access-boundary.mjs`, called first in `src/worker.ts` | For `/_emdash*` only: requires `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUDIENCE` and a `Cf-Access-Jwt-Assertion`; verifies RS256 signature, issuer `https://<team>` and audience; rejects ambiguous/encoded/dot-segment paths; **fails closed** when unconfigured | Email, group, role, tenant, device, session freshness; **any path outside `/_emdash`** |
| 3 | **EmDash external auth** | `node_modules/emdash/dist/astro/middleware/auth.mjs` + `@emdash-cms/cloudflare/dist/auth/index.mjs` | Re-validates the Access JWT on every private request; calls Access `get-identity` for full groups; finds/provisions a local user by email; applies role mapping only on first provisioning unless `syncRoles`; honours `disabled`; writes `{id}` to the Astro session | Durable IdP subject storage; SCIM; IdP logout; instant group-role change; protection of public page shells; protection when Access is bypassed upstream |
| 4 | **Composer authorisation** | `composer-members`, `composer-stacks`, `composer-miniapps` plugins and their SQL predicates | EmDash permission, then `creator_members` role (owner/editor/viewer), then exact `creator_app_grants` row; revision guards; `creator_app_access_audit`; role 10 may use member surfaces but not Creator/admin surfaces | Any IdP group; remote app sessions; work already dispatched (the repo documents that an in-flight app operation can finish after revocation) |
| 5 | **App audience** | Each generated app Worker | App-owned data and its own public/anonymous visitor model; Composer-mediated member operations keyed by local account ID and server-held shared tokens | IdP tokens; OIDC audience validation; enterprise SSO for app end-users; cross-app single sign-on |

### 3.2 Source evidence for each claim

| Claim | Evidence at `5e012f9` |
| --- | --- |
| Access is the exclusive production auth provider | `astro.config.mjs`: `auth: access({ teamDomain: 'jolly-cake-2b85.cloudflareaccess.com', audienceEnvVar: 'CF_ACCESS_AUDIENCE', autoProvision: true, defaultRole: 10, syncRoles: false })`; no `authProviders` array |
| The Worker gate covers only `/_emdash` | `src/lib/access-boundary.mjs` returns `null` unless `path.startsWith('/_emdash')`; `src/lib/access-boundary.d.mts` type |
| The gate fails closed | `if(!team||!audience||!jwt) return denied('Owner administration is closed until trusted Cloudflare Access authentication is configured.')`; deny is `403` + `no-store` |
| Audience is runtime-supplied, not committed | `wrangler.jsonc` `vars` contains `CF_ACCESS_TEAM_DOMAIN` but not `CF_ACCESS_AUDIENCE`; `docs/operator-reference.md` says the audience is a runtime secret |
| Preview has no audience and stays closed | `docs/operator-reference.md`; `wrangler.jsonc` preview env has no Access vars |
| Private plugin routes re-verify Access | EmDash middleware `handlePluginRouteAuth`: in production external mode, `handleExternalAuth` is authoritative and the session is deliberately not a fallback |
| Users are matched by email | `handleExternalAuth`: `adapter.getUserByEmail(authResult.email)`; no read or write of `authResult.subject` |
| The IdP subject is discarded | `AccessAdapter.authenticate` returns `subject: payload.sub`, but the middleware never persists it; `email_verified` is set to `1` on provisioning |
| First-ever user becomes Admin | `const role = isFirstUser ? ROLE_ADMIN : authResult.role` |
| Role mapping is off | `syncRoles: false`; no `roleMapping` object in `astro.config.mjs`; new accounts get `defaultRole: 10` |
| Role mapping keys on group **name** | `resolveRoleFromGroups(groups, config)` matches `config.roleMapping[group.name]` |
| Identity is logged | Adapter logs `email`, `name`, `groups[].name`, `idp` on every authentication; middleware logs provisioned email |
| Session is an Astro KV session | `@astrojs/cloudflare` auto-selects the KV session driver (`SESSION` binding present in both environments); EmDash stores `{id}` only |
| Workspace roles are local | `creator_members.role CHECK IN ('owner','editor','viewer')` (`migrations/0003`, `0008`); `creator-access.ts` `isCreatorRole` = 20/30/40/50 |
| App grants bind to local user IDs | `creator_app_grants` has `issuer='https://composer.loftwah.com'` and `user_id`, FK to `creator_members`; no IdP issuer/subject column |
| Grants are revision-guarded and audited | `creator_app_access_audit`; `auditDispatch` linearises grant check + audit in one SQL statement |
| Generated apps use shared server tokens | `member-contribution-bridge.ts`, `GUESTBOOK_MEMBER_TOKEN`, `SHOWCASE_OWNER_TOKEN`; no OIDC audience or token exchange |

### 3.3 The identity-binding defect, precisely

The installed adapter's return value includes `subject: payload.sub`, where `sub` is the
Cloudflare Access user ID. Cloudflare documents that this `sub` is unique **to an email
address per account**, and changes if the user is removed and re-added or logs into another
organisation [S5]. So even if EmDash stored it, it is an Access-scoped identifier, not the
IdP's identifier.

The middleware ignores it and calls `getUserByEmail`. Consequences, all verifiable from the
code path:

1. **A new IdP subject with an existing local email inherits the local user and its role.**
   If the old holder left and the address is recycled, the new holder gets the old role,
   memberships and grants (grants are keyed to `user_id`, which is unchanged).
2. **Changing IdP providers is implicitly an email-based account merge.** Point Access at a
   different IdP and every matching email links to the existing EmDash account. That is
   convenient for migration and dangerous as an unreviewed default.
3. **The code sets `email_verified = 1` on external provisioning** regardless of whether the
   IdP verified the address. The Access JWT `email` claim is described by Cloudflare as
   "verified by the identity provider" [S5], but EmDash does not itself check a verification
   claim, and the value ultimately depends on the IdP and claim mapping.
4. **There is no unlink.** There is an `oauth_accounts(provider, provider_account_id, user_id)`
   table in EmDash for built-in providers, but the Access path does not use it.

This is a #257/#10 issue. It is not fixed by choosing a different IdP, and it gets worse if a
customer changes IdP or recycles addresses during an exit.

### 3.4 Version and documentation drift (found during inspection)

| Item | Recorded in docs | Actual pin / runtime | Effect |
| --- | --- | --- | --- |
| EmDash | "EmDash 1.2.0" in 40+ places (`docs/workspace-access.md`, `docs/invited-member-access.md`, `docs/operator-reference.md`, `docs/engineering-baseline.md`) | `emdash@1.3.1`, `@emdash-cms/cloudflare@1.3.1` in `package.json` and the lockfile | Auth semantics documented here are those of **1.3.1**. The docs are stale and could mislead a future auth change. |
| Node | `.node-version` = 22.23.4 | local `node -v` = 22.23.1 in this run | Not an auth issue, but it means "supported Node" claims were not exercised on the pinned patch here. |
| `build.json` review date | — | live `/build.json` reports `reviewed: 2026-10-13` with commit `5e012f9` | The build receipt's review date predates the 25 October release. Not an identity issue; note for #11. |

The deployed revision is `5e012f98…`, matching this checkout exactly, confirmed by read-only
`/build.json` and `/healthz` on 2026-10-25 06:04 UTC. Because the release guard deploys a
clean pushed commit, the pinned 1.3.1 is the version that revision builds. That is an
inference from the guard plus the commit match, not a runtime version banner — EmDash does not
expose its version publicly.

### 3.5 Live anonymous probes (2026-10-25 06:04 UTC)

| Path | Status | Interpretation |
| --- | --- | --- |
| `/_emdash/admin` | `302` | Access redirect; administration is not anonymously reachable |
| `/_emdash/api/users` | `302` | Same edge gate; no JSON leak |
| `/_emdash/api/plugins/composer-members/people` | `302` | Plugin route also behind Access |
| `/people` | `200` | Public client-rendered shell; data comes from the gated API |
| `/me` | `200` | Same pattern |

This confirms the layering: `/people` and `/me` are **not** server-side protected HTML.
They are shells that fail closed when their API calls fail. That is a legitimate design, but
it means "the page is behind Access" is imprecise — say "the data APIs are behind Access".

### 3.6 What is *not* in the repository

A repository-wide search found no OIDC client, SAML service provider, SCIM endpoint,
tenant model, group-ID mapping, IdP-initiated logout handler, or `iss`/`sub` persistence.
`scim`, `saml`, `oidc`, `entra` and `active directory` appear only in documentation,
the field guide's proposed architecture, and a source list. The only federation code is the
Access JWT verification described above.

---

## 4. Enterprise requirements map

Status vocabulary:
**Shipped** = this revision enforces it.
**Available, unused** = the installed dependency supports it but Composer has not configured it.
**Vendor-supported** = documented by Cloudflare/Microsoft, not exercised here.
**Adapter needed** = no standard path; Composer or an intermediary must do work.
**Unsupported / out of scope** = not a Composer deliverable.
**Unverified** = plausible, not tested in this run.

| Requirement | Status 2026-10-25 | Where it is enforced | Gap / caveat | Owner |
| --- | --- | --- | --- | --- |
| **SSO** to Composer admin and creator surfaces | **Shipped** (single IdP via Access) | Cloudflare Access → IdP [S1][S2][S3] | Only one active production mode; no multi-IdP policy design; no customer-facing tenant selection | #257 |
| **SSO** to generated app *end-users* | **Unsupported** | — | Generated apps do not accept IdP tokens; visitors are anonymous and member operations are Composer-mediated | #253/#216 |
| **MFA enforcement** | **Vendor-supported**, not configured here | IdP MFA (Entra/any OIDC/SAML) and/or Cloudflare independent MFA [S12] | Composer cannot see MFA; enforcement is only as good as the Access policy; the repo has no policy-as-code for it | #257 |
| **Phishing-resistant / passkeys** | **Vendor-supported** | Entra passkeys/FIDO2 [S21], Keycloak WebAuthn/passkeys [S32], Cloudflare independent MFA [S12] | Composer's own EmDash passkeys are disabled when Access is exclusive; a virtual authenticator is not a physical passkey | #257 |
| **Conditional Access** | **Vendor-supported**, Entra-only for auth-context sync | Entra CA evaluated at Entra; Cloudflare can require an `Azure AD - Auth context` selector [S11] | Requires Entra P1 or M365 Business Premium [S22][S27]; requires `Policy.Read.ConditionalAccess` app permission; **no equivalent for generic OIDC/SAML** | #257 |
| **Device compliance** | **Vendor-supported**, not tested | Entra "require compliant device" via Intune [S23]; Cloudflare device posture via Cloudflare One Client or third-party provider [S13] | Requires an endpoint agent/registration; Composer cannot observe device state; posture detection is polled (default ~5 min for Client checks) [S13] | #257/#253 |
| **Group → role mapping** | **Available, unused** | EmDash adapter `roleMapping` by group **name** + `syncRoles` [S17] | Off today (`syncRoles:false`, no mapping). Enabling it makes IdP authoritative and overwrites manual role edits at each login. Names are mutable/non-unique; no group-ID matching. JWT `groups` may be trimmed (~1 KB) but `get-identity` returns the full set [S5] | #257/#113 |
| **SCIM provisioning** | **Vendor-supported** IdP↔Cloudflare only | Entra → Access SCIM; generic OIDC/SAML → Access SCIM [S2][S3][S4][S7] | Requires Entra P1/P2 and a **separate** enterprise app [S2]. Access does **not** use SCIM groups to evaluate a login; it uses token claims. SCIM can revoke sessions on deprovision/group change [S2][S7]. EmDash/Composer ingest **no** SCIM | #257 |
| **Deprovisioning / offboarding** | **Partial, manual** | IdP disable + Access revoke + EmDash `disabled` + workspace/grant revoke, four separate actions | No single runbook or test. Access revocation takes up to ~1 minute to block new logins, and existing sessions are ended by revoke (logged-out tokens stop being accepted in ~20–30 s) [S6]. A directory delete alone is **not** a downstream session revoke | #257/#113 |
| **Break-glass access** | **Absent** | Only out-of-band: Cloudflare dashboard policy change | Access is exclusive in production, so IdP/Access outage can lock out all administration; if dashboard SSO uses the same tenant, recovery has a circular dependency (**unverified** whether it does). Empty-DB restore + `autoProvision` means the next admitted identity becomes Admin | #257/#10 |
| **Audit logs** | **Split** | Access authentication logs; Entra audit/sign-in (7 days free, 30 days P1/P2) [S24][S25]; Worker observability (0.1 head sampling); `creator_app_access_audit` | No correlation ID across the four. EmDash logs email/groups/IdP to Worker logs on every auth, which is a privacy and retention question. No export, retention policy or tamper evidence in Composer | #10/#11 |
| **Data residency** | **Unsupported for identity; constrained for app data** | D1 jurisdiction only at creation (`eu`, `fedramp`, `us`; not Australia; location hint is best-effort) [S14] | No jurisdiction pinning is documented for the Access user registry/session data, so it should be treated as Cloudflare-global until a contract says otherwise (**unverified**). Existing production D1 jurisdiction is **unverified** and cannot be changed after creation | #253/#10 |
| **Custom roles / fine-grained IAM** | **Unsupported** | Fixed EmDash 10–50 + workspace owner/editor/viewer | Field guide already says do not invent custom roles until tested [R1] | #113 |
| **Multi-tenant customer IdP onboarding** | **Unsupported** | — | One Access org and one IdP path; no per-customer tenant registry, domain verification or configuration UI | #216/#255 |

---

## 5. The four journeys

### A. Keep Microsoft, adopt Composer

**Verdict: credible, vendor-documented, unverified.** This is the path with the least
invention: Entra stays the source of truth, Cloudflare Access is the front door, Composer
stays a single-IdP app.

What must be true:

1. Entra app registration with redirect
   `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`, client ID, tenant ID and a
   client secret; seven delegated Graph permissions (or a narrower reviewed set) [S2].
2. Cloudflare Access application scoped to **all** private paths (`/_emdash/*` at minimum;
   decide deliberately whether `/people` and `/me` shells stay public), with an Allow policy
   bound to a group or claim, not merely an email domain [S8].
3. Optional but expected in enterprise: Entra Conditional Access via an authentication
   context plus Cloudflare policy sync [S11]; this needs `Policy.Read.ConditionalAccess`
   application permission and Entra P1 [S11][S22].
4. EmDash group→role mapping decision: keep `syncRoles:false` (local roles authoritative) or
   enable `roleMapping` + `syncRoles:true` (IdP authoritative). Do not enable one without the
   other and expect change.
5. Composer workspace membership remains a **separate** grant. SSO admission must not create
   an owner membership, and an Entra group must never imply deployment authority.

What it does not give you: SSO for generated app end-users; automatic SCIM into EmDash;
removal of Microsoft from the endpoint; protection from email-based account linking.

**Failure modes to test before claiming success:** guest/B2B identity with a
`#EXT#` UPN; UPN ≠ email (needs an email claim or custom claim) [S2]; user in >150/200 groups
(group claim omitted) [S28][S29]; group display-name collision; tenant `common` /
`organizations` misconfiguration (EmDash deliberately accepts no unverified guest address
[¶S17]); client-secret expiry (max 24 months) [S17]; Conditional Access block; session
revocation lag.

### B. Ditch Windows, keep company accounts

**Verdict: true for browser access, false for managed endpoints.** A Linux or macOS user with
a modern browser and a passkey/security key can use Composer and any generated app exactly as
a Windows user can, provided the IdP and Access policy admit them. Nothing in Composer
requires Windows.

What remains, and must be qualified rather than promised:

- Device compliance and Conditional Access device grants are Windows/macOS/iOS/Android/Ubuntu
  with Intune enrolment [S23]; a personal Linux desktop may not satisfy them.
- Domain join, GPO, drive mappings, printers, line-of-business Windows apps, PowerShell
  automation and Kerberos/NTLM authentication are unaffected by replacing web sign-in.
- Microsoft 365 data (Exchange, SharePoint, OneDrive, Teams) remains in Microsoft's service
  and is a separate migration.
- If the organisation uses Entra Private Access or a VPN for private resources, that is a
  network-access product, not something Composer replaces.

The honest product statement is: **"supported apps work from any modern browser; managed
device assurance is a separate decision."** Do not say "Windows-free" without that clause.

### C. Ditch Microsoft identity

**Verdict: protocol-portable, policy-sticky, operationally non-trivial.** This is journey C
and the exit contract in §8. Summary: OIDC/SAML and SCIM move; Conditional Access, device
compliance, risk, governance, group object IDs and Microsoft 365 do not.

### D. Legacy AD-dependent application

**Verdict: out of scope for Workers; needs a bridge or a rewrite.** A Worker cannot speak
LDAP, Kerberos or NTLM to a domain controller, and must never be given raw AD credentials.
Options, in increasing cost:

1. **Federate the front door only.** Put Cloudflare Access/Tunnel in front of an app that
   already supports OIDC/SAML; leave its AD dependency untouched. This is the cheapest
   correct answer and is what Access is for.
2. **Bridge with a trusted connector.** An on-premises agent (AD FS, Keycloak with LDAP user
   federation [S32], Entra Domain Services, Samba AD, FreeIPA) translates AD protocols to
   OIDC/SAML. The connector is a new high-value server and must be patched, monitored and
   restricted.
3. **Rewrite or retire.** Usually correct for anything internet-facing.

Never: expose LDAP/Kerberos to the internet; put domain credentials in a generated client;
claim Composer "supports Active Directory" because Access can federate an IdP.

---

## 6. Decision table

| Journey | Decision | Why | Prerequisites | Security impact | Maintenance | Cost evidence | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Keep Entra** | **Adopt, with conditions** | Least invention; Access has a first-class Entra connector [S2] | Entra app + secret; Access app/policy; P1 for CA; group-claim design; email-claim design | Adds SSO/MFA/CA/device signal; keeps Microsoft lock-in; email-linking risk remains | Secret rotation, claim drift, Access policy review | Entra P1 required for CA [S22]; exact price **unverified** | Disable the Access IdP connection; keep Composer's local users intact |
| **B. Non-Windows endpoints** | **Qualify, do not promise** | Browser access is OS-neutral; managed-device assurance is not | Device inventory; compliance policy; browser/passkey support | Drops Windows-only controls if not replaced | Endpoint management remains | Not a Composer cost | Re-enrol devices; no app change |
| **C. Leave Microsoft identity** | **Needs proof before adoption** | Standards exist; policy equivalence does not | Replacement IdP; OIDC/SAML; SCIM or session-revocation substitute; break-glass; audit export | **Regression risk**: CA/device/risk/governance lost | New IdP is a new critical service to run or buy | Managed IdP pricing **unverified**; self-hosted = staff time + hosting | Keep old IdP configured but disabled; switch policy back |
| **D. Legacy AD app** | **Avoid / bridge deliberately** | Workers cannot speak AD protocols | Connector or rewrite; network path | Connector is a new attack surface | Patch/own the connector | Hosting + licences **unverified** | Retain AD DS; remove the bridge |

---

## 7. Microsoft exit: portable vs sticky

### 7.1 Portable (standards-based, can move)

| Asset | Portability | Notes (2026-10-25) |
| --- | --- | --- |
| **OIDC / OAuth 2.0** | High | Access supports generic OIDC with discovery endpoints, PKCE, custom claims, and RS/PS/ES algorithms [S3] |
| **SAML 2.0** | High | Access supports generic SAML, signed requests, encrypted assertions, multi-record attributes [S4] |
| **SCIM 2.0** | Medium-high | Access supports SCIM 2.0 from any SAML/OIDC IdP, including deprovision and group-change session revocation [S7]; Entra's SCIM client and SCIM service-provider APIs are documented [S20] |
| **Email / UPN** | Low as a key, high as a hint | Mutable and reassignable; Microsoft explicitly says not to use it for identity [S30] |
| **Group claims** | Medium | Entra emits object IDs by default, or sAMAccountName/SID/display name on request; limits 150 SAML / 200 JWT, after which the groups claim is replaced by an overage claim pointing at Microsoft Graph [S28][S29][S30] |
| **User data in Composer D1** | High | App data is not tied to the IdP; only identity bindings and roles are |
| **Access policy structure** | Medium | Re-creatable as API/Terraform; selectors that are Entra-specific are not portable [S8][S11] |
| **Audit records** | Medium | Exportable per vendor; formats differ; correlation is manual |

### 7.2 Sticky (Microsoft-specific; loss is a real regression)

| Sticky asset | Why it does not move | Substitute, if any |
| --- | --- | --- |
| **Conditional Access** | Evaluated at Entra; Cloudflare can consume an auth context only for the Entra connector [S11] | Cloudflare independent MFA + device posture + Access policy; weaker, different semantics |
| **Intune device compliance** | `Require compliant device` depends on Intune enrolment and Entra device registration [S23] | Cloudflare One Client posture or a third-party posture provider [S13] |
| **Entra ID Protection risk** | Sign-in/user risk is P2 [S22][S27] | No direct equivalent in Access; external evaluation could approximate, not replicate |
| **Entra group object IDs** | Tenant-scoped GUIDs; meaningless in another directory | Re-map by name with a reviewed table, or by external ID you control |
| **`oid` / `tid`** | `oid` is immutable **within a tenant** and differs per tenant; `tid` identifies the tenant [S30] | Your own `(issuer, subject)` binding, stored at first sight |
| **Entra ID Governance** (PIM, access reviews, entitlement management, lifecycle workflows) | P2/Governance features [S27] | Process + scripts, or a replacement governance product |
| **Teams / SharePoint / Exchange** | Data and integrations live in Microsoft 365 | Separate migration; not an IdP swap |
| **Windows device management / GPO / Entra join** | Endpoint and OS management | Intune alternatives, or accept unmanaged devices |
| **Audit retention / Purview** | Entra 30 days P1; longer only via export/Purview [S24][S25] | Export to your own SIEM before cutover |
| **App registration + Graph permissions** | Entra-specific app model | New client registration in the replacement IdP |

### 7.3 What "credible exit" must mean

An exit is credible when **all** of the following are true, and not before:

1. A named replacement IdP passes the same admission tests as Entra on one isolated app.
2. Identity bindings are durable and reviewed, not email-merged.
3. Offboarding is one runbook with measured revocation times.
4. Break-glass does not depend on the IdP being migrated away from.
5. Audit export is proven before cutover.
6. The lost controls (CA, device, risk) are explicitly replaced or explicitly accepted by the
   owner with a written risk decision.
7. Rollback is a policy switch, rehearsed, with the old IdP still configured but disabled.

---

## 8. Proposed exit-path contract (normative, not implemented)

This is the contract a future implementation and test suite should satisfy. It deliberately
does not prescribe a vendor or a schema.

### 8.1 Identity binding

- Store `issuer` (exact `iss`), `subject` (opaque, never displayed), `tenant` (if provided),
  `email_at_link_time`, `linked_at`, `linked_by`, `status`.
- **One active binding per user per issuer.** A second issuer is a new binding requiring an
  explicit, audited link action by an owner or by the user with step-up authentication.
- **Email is a hint, never a key.** Email change does not relink. Email reuse does not
  inherit. A subject never seen before must provision at the lowest role and with zero
  workspace membership.
- **No silent merge on IdP change.** A bulk migration requires an import with a reviewed
  mapping file (old local user ID ↔ new subject), a dry run, and a rollback export.
- **Unlink is supported** and revokes sessions, memberships and grants for that binding only.

### 8.2 Admission

- Access policy has an explicit Allow bound to a group or claim from the expected issuer,
  plus `Require` for MFA/auth strength where the IdP supports it; no `Bypass` on admin paths
  [S8][S12].
- The Access application covers every private path, and the Worker gate remains as
  defence-in-depth for `/_emdash*`.
- The Access audience is a runtime secret; preview stays closed.
- Issuer/tenant is asserted in the application layer too, not only at the edge: a valid
  Access JWT for a *different* Access application must be rejected (already true via `aud`).

### 8.3 Authorisation

- Group→role mapping is explicit, versioned, and **fail-closed**: an identity in no mapped
  group gets the lowest role and no workspace membership; an identity in an unknown group
  gets nothing.
- Prefer immutable group IDs where the IdP supplies them. If only names are available,
  document the collision risk and monitor for renames.
- Role changes are effective at next authentication **and** have an explicit "apply now"
  revocation path; the chosen `syncRoles` mode is recorded in the runbook.
- No IdP group ever grants deployment, provider-write, agent-grant or owner authority.

### 8.4 Lifecycle and revocation

- Offboarding is one runbook with four independently verified steps: disable in IdP, revoke
  Access sessions, disable the EmDash user, revoke workspace membership and app grants.
- Target: new logins blocked within 1 minute of revoke (Access documented behaviour [S6]);
  existing sessions ended by revoke; app-owned sessions are separately terminated or expire
  within a stated ceiling.
- Group removal triggers re-authentication when the IdP/Access supports it (SCIM group-change
  reauthentication) [S2][S7]; otherwise the maximum staleness is the Access session duration
  and is written down.
- A quarterly offboarding drill with timestamps is the evidence, not a configuration claim.

### 8.5 Break-glass

- At least two independent owner paths. At least one must not depend on the primary IdP.
- Options to evaluate (owner decision): a separate Access IdP restricted to sealed
  break-glass identities; a separate Cloudflare account/tenant with Access to the admin path;
  an out-of-band recovery procedure that does not require the same tenant's dashboard SSO.
- Break-glass use alerts, is time-boxed, and is reviewed afterwards.
- Restore procedures must account for "first user becomes Admin" on an empty user table.

### 8.6 Audit and privacy

- One correlation key per authentication event: `(issuer, subject_hash, access_session_id)`
  where available, plus the Composer request ID.
- Export Access auth logs, IdP audit/sign-in logs and `creator_app_access_audit` to a retained
  store; state retention explicitly.
- Remove or redact email/groups from routine application logs; if kept for diagnosis, bound
  retention and access.
- Record who changed identity configuration, not only who signed in.

### 8.7 Portability and rollback

- Identity configuration is documented as data (issuer, client ID reference, claim mapping,
  group mapping, session durations) with secrets in a secret store.
- A one-app migration rehearsal is mandatory before a tenant-wide change; the old IdP stays
  configured but disabled for a stated rollback window.
- Exit acceptance includes: old tokens rejected, new tokens accepted, roles re-derived,
  memberships preserved, grants preserved, audit exported, break-glass tested.

---

## 9. Recommended narrow next experiment (no paid accounts, no tenant)

**Name:** origin-side federated identity contract harness.
**Why this and not a real IdP:** Cloudflare Access cannot run locally, and a real Access/Entra
test requires a Zero Trust organisation, a public callback hostname and (for Conditional
Access) a paid Entra tier. The valuable, unproven part is **our** contract: binding, role
mapping, fail-closed behaviour and revocation. That can be tested without either vendor.

### Design

1. One explicitly owned temporary root, registered for cleanup, removed on success and
   failure. Reuse the `labs/invited-members` isolation pattern (owned copy, loopback-only TLS,
   isolated browser context) rather than touching production config.
2. A local HTTPS server emulates only the two endpoints the installed adapter calls:
   `/cdn-cgi/access/certs` (JWKS) and `/cdn-cgi/access/get-identity` (identity JSON). It signs
   RS256 JWTs with a locally generated key.
3. Run the **installed** EmDash adapter and middleware path, with the production gate's
   team-domain regex bypassed only in the disposable copy — exactly as the existing lab
   substitutes the passkey path. No production file changes.
4. Fictional fixtures: two groups (`composer-admins`, `composer-viewers`), two people, one
   person with the same email at a second issuer, one disabled user, one guest-style
   `#EXT#` identity, one identity in no mapped group, one identity with a very large group
   list.

### Assertions

| # | Assertion | Expected |
| --- | --- | --- |
| 1 | Wrong audience / issuer / expired / forged JWT | Refused |
| 2 | Ambiguous encoded `/_emdash` path | Refused before CMS |
| 3 | Unmapped group with `defaultRole:10` | Role 10, no workspace, no grants |
| 4 | Mapped group with `roleMapping` + `syncRoles:true` | Expected role at login; changes on next login |
| 5 | Same with `syncRoles:false` | Role stays as first provisioned; group change has no effect |
| 6 | Disabled EmDash user, valid Access JWT | Refused (403), no session upgrade |
| 7 | Second issuer, same email | **Documents the current email link**; expected to inherit the existing user. This assertion is the defect proof. |
| 8 | New subject, new email | Provisions at lowest role, zero memberships |
| 9 | Group removal | No effect until re-authentication (or session revoke) — measure it |
| 10 | Access session still valid after IdP disable | Documented as an open window until revoke |
| 11 | `get-identity` unavailable | Fail closed (401/403), no fallback to session on private routes |
| 12 | Log capture | Confirms whether email/groups are written to logs |

### Explicitly out of scope for this experiment

- Real Entra, real Cloudflare Access, real DNS, SCIM, Conditional Access, device posture.
- Any claim of browser, screen-reader, physical-key or production acceptance.
- Any change to production Access, users, secrets or deployment.

### Stop conditions

Stop and escalate to the owner if the experiment would need: a real tenant, a paid licence, a
public hostname, a DNS change, a production policy change, or any real person's identity.

### Follow-on, only if the harness passes and the owner authorises

A single generic OIDC IdP (Keycloak container is the cheapest documented candidate [S32][S33])
connected to a **new, isolated** Cloudflare Access application. This step needs a Zero Trust
organisation and a public callback, so it is a separate authority decision. Until then, every
"generic OIDC works" statement is vendor documentation, not evidence.

---

## 10. Gap table

Effort is an agent estimate for a narrow slice, not a quote. Risk is the consequence of
leaving it undone.

| # | Gap | Effort | Risk | Evidence class | Owner |
| --- | --- | --- | --- | --- | --- |
| 1 | No durable `(issuer, subject)` binding; email is the join key | M | **High** — account/role inheritance on email reuse or IdP change | Verified in installed source | #257/#10 |
| 2 | `email_verified=1` set by the external path without an explicit verification check | S | Medium-high | Verified in source | #257 |
| 3 | No group→role mapping configured; `syncRoles:false` undocumented as a decision | S | Medium — expectation mismatch, not a breach | Verified in source | #257/#113 |
| 4 | Mapping keyed on group display name; no group-ID support | M | Medium-high — rename/collision changes authorisation | Verified in adapter source | #257 |
| 5 | No SCIM ingestion in EmDash/Composer; provisioning is JIT by email | L | Medium — offboarding lag | Verified absence + vendor docs | #257 |
| 6 | Offboarding is four manual steps with no runbook or drill | M | **High** — stale access after departure | Verified absence | #257/#113 |
| 7 | No break-glass path independent of the primary IdP | M | **High** — total admin lockout | Verified design + vendor docs | #257/#10 |
| 8 | Audit split across four systems; no correlation or retention policy | M | Medium-high — cannot reconstruct an incident | Verified + vendor docs | #10/#11 |
| 9 | EmDash logs email/name/groups/IdP on every auth | S | Medium — PII in Worker logs; retention unclear | Verified in source | #10 |
| 10 | Identity/session data cannot be pinned to Australia; D1 jurisdiction immutable | M | Medium — blocks some customers | Vendor docs [S14] | #253 |
| 11 | Generated apps have no federated end-user audience | L | **High if mis-sold** — "enterprise SSO" claim would be false | Verified absence | #253/#216 |
| 12 | Conditional Access/device/risk have no non-Microsoft equivalent in the current stack | L | **High** on exit — security regression | Vendor docs [S11][S13][S22] | #253/#257 |
| 13 | No tested generic OIDC/SAML path at all | M | Medium — portability is documentary | Verified absence | #257 |
| 14 | Docs say EmDash 1.2.0; pin is 1.3.1 | S | Medium — wrong auth assumptions in future work | Verified | #198/#11 |
| 15 | `/people` and `/me` are public shells; "behind Access" wording is imprecise | S | Low — no data exposure observed | Verified by live probe | #198/#29 |
| 16 | Access policy is dashboard-managed, not reviewed as code | M | Medium — drift, no review trail | Verified absence | #257/#10 |
| 17 | Exact Cloudflare Zero Trust seat cap/price and Entra P1 price unverified | S | Low for this report; blocks customer quotes | Unverified | #257/#352 |

**What is *not* a gap:** single-IdP exclusivity is a legitimate design. It keeps the security
model simple. The gap is the missing binding and lifecycle contract, not the absence of a
second simultaneous login method.

---

## 11. Sources (retrieved 2026-10-25 UTC)

Vendor pages show their own last-updated date. Where a page is undated, that is stated.

### Cloudflare One / Access

- **[S1]** Identity providers — updated 2026-06-19 —
  https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/
- **[S2]** Microsoft Entra ID identity provider (SCIM, CA sync, UPN/email, object ID) — updated 2026-10-12 —
  https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/entra-id/
- **[S3]** Generic OIDC (discovery, PKCE, custom claims, algorithms) — updated 2026-10-12 —
  https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/
- **[S4]** Generic SAML 2.0 (attributes, encryption, ForceAuthn) — updated 2026-09-14 —
  https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-saml/
- **[S5]** Application token (claims, `sub`, `get-identity`, group trimming, service tokens) —
  updated 2026-06-25 —
  https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
- **[S6]** Session management (global/policy/application durations, revoke, logout timing) —
  updated 2026-10-14 —
  https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
- **[S7]** SCIM provisioning (Access does not use SCIM groups at login; deprovision revokes) —
  updated 2026-08-26 —
  https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/scim/
- **[S8]** Policies (Allow/Block/Bypass/Service Auth; selectors; Bypass not logged) — updated 2026-10-01 —
  https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
- **[S9]** Seat management (seats, revoke vs remove) — updated 2026-05-01 —
  https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/
- **[S10]** Service tokens (machine identity) — updated 2026-10-02 —
  https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
- **[S11]** Entra Conditional Access in Cloudflare Access (auth context, Graph permission) —
  updated 2026-05-06 —
  https://developers.cloudflare.com/cloudflare-one/tutorials/entra-id-conditional-access/
- **[S12]** Enforce MFA (IdP-based and independent MFA) — updated 2026-08-13 —
  https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/
- **[S13]** Posture checks (Cloudflare One Client, third-party, polling, enforcement delay) —
  updated 2026-10-12 —
  https://developers.cloudflare.com/cloudflare-one/reusable-components/posture-checks/
- **[S14]** D1 data location (jurisdictions, immutability, hints) — updated 2026-10-02 —
  https://developers.cloudflare.com/d1/configuration/data-location/
- **[S15]** Cloudflare One setup (free plan exists; payment details required) — updated 2026-10-12 —
  https://developers.cloudflare.com/cloudflare-one/setup/
- **[S16]** Zero Trust getting-started FAQ (seat/revoke semantics) — updated 2026-04-30 —
  https://developers.cloudflare.com/cloudflare-one/faq/getting-started-faq/

### EmDash

- **[S17]** Authentication (passkeys, providers, Access exclusivity, role mapping, sessions,
  Microsoft caveats) — undated page, retrieved 2026-10-25 —
  https://docs.emdashcms.com/guides/authentication/

### Microsoft Entra

- **[S18]** Compare Microsoft directory-based services (AD DS vs Entra ID vs Entra Domain
  Services, device join) — `ms.date` 2025-06-30, page updated 2026-02-19 —
  https://learn.microsoft.com/en-us/entra/identity/domain-services/compare-identity-solutions
- **[S19]** What is hybrid identity — `ms.date` 2025-04-09, updated 2026-06-15 —
  https://learn.microsoft.com/en-us/entra/identity/hybrid/whatis-hybrid-identity
- **[S20]** SCIM support in Entra ID (client and service provider) — `ms.date` 2026-03-31 —
  https://learn.microsoft.com/en-us/entra/identity/app-provisioning/scim-support-in-entra-id
- **[S21]** Passkeys (FIDO2) in Entra ID — `ms.date` 2026-02-02 —
  https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-passkeys-fido2
- **[S22]** Conditional Access overview and licence requirement (P1 / M365 Business Premium) —
  `ms.date` 2026-04-27 —
  https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview
- **[S23]** Conditional Access grant controls (compliant device, hybrid join, supported OS) —
  `ms.date` 2026-06-02 —
  https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-grant
- **[S24]** Audit logs overview — `ms.date` 2026-06-05 —
  https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-audit-logs
- **[S25]** Data retention (Free 7 days; P1/P2 30 days; export required for longer) —
  `ms.date` 2026-01-06 —
  https://learn.microsoft.com/en-us/entra/identity/monitoring-health/reference-reports-data-retention
- **[S26]** Entra External ID overview (workforce vs external tenants; B2B guests; MAU
  billing) — `ms.date` 2026-04-24 —
  https://learn.microsoft.com/en-us/entra/external-id/external-identities-overview
- **[S27]** Microsoft Entra licensing (CA=P1; ID Protection=P2; External ID 50,000 MAU;
  provisioning logs P1) — `ms.date` 2026-06-18 —
  https://learn.microsoft.com/en-us/entra/fundamentals/licensing
- **[S28]** Optional claims and group limits (150 SAML / 200 JWT; extension limit) —
  `ms.date` 2026-08-11 —
  https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims
- **[S29]** Configure group claims (object ID, sAMAccountName, SID; group filtering limits;
  omits groups on overage) — `ms.date` 2025-04-09 —
  https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/how-to-connect-fed-group-claims
- **[S30]** ID token claims (`oid`, `sub`, `tid`, email mutability, guest guidance) —
  `ms.date` 2023-05-30 —
  https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference
- **[S31]** Tokens and claims overview (issuer/tenant separation, external tenant endpoints,
  MSAL validation) — `ms.date` 2025-03-21 —
  https://learn.microsoft.com/en-us/entra/identity-platform/security-tokens

### Exit candidates (capability evidence only)

- **[S32]** Keycloak Server Administration 26.8.1 (OIDC, SAML, identity brokering, LDAP/AD and
  Kerberos federation, WebAuthn/passkeys, step-up, workflows, SCIM endpoints) — retrieved
  2026-10-25 — https://www.keycloak.org/docs/latest/server_admin/
- **[S33]** Keycloak containers guide 26.8.1 (dev vs production modes, DB, hostname) —
  retrieved 2026-10-25 — https://www.keycloak.org/server/containers
- **[S34]** authentik 2026.8 SCIM provider (outbound SCIM 2.0, hourly full sync, OAuth token
  marked Enterprise) — retrieved 2026-10-25 —
  https://docs.goauthentik.io/add-secure-apps/providers/scim/

### Repository

- **[R1]** `docs/platform/field-guide.md` §4, "Six permission domains" (reviewed previously;
  read 2026-10-25)
- **[R2]** `docs/workspace-access.md`, `docs/invited-member-access.md` (read 2026-10-25)
- **[R3]** `SECURITY.md` (13–14 October 2026 review), `docs/STATUS.md` (25 October 2026)
- **[R4]** `AGENTS.md` (owner direction through 18 October 2026)

---

## 12. Verification, limitations and open questions

### What is verified

- The deployed revision equals this checkout (`5e012f9…`) via public `/build.json` and
  `/healthz`, 2026-10-25 06:04 UTC.
- Access is the exclusive production auth mode; the audience is runtime-supplied; preview is
  closed; the Worker gate covers only `/_emdash`; private plugin routes re-verify Access.
- Users are matched by email; the IdP subject is not persisted; first user becomes Admin;
  role mapping is off; group mapping keys on names.
- Workspace roles, app grants and audit rows exist and are server-enforced with revisions.
- `/people` and `/me` return `200` anonymously; `/_emdash` paths return `302`.
- EmDash logs identity fields on authentication.

### What is unverified

- Any real Entra tenant behaviour: CA sync, auth contexts, group claim contents, email/UPN
  shape, guest identities, tenant restrictions, secret expiry handling.
- Any real Cloudflare Access behaviour: policy evaluation, session revocation timing,
  `get-identity` availability/latency, SCIM deprovision timing, log retention.
- Cloudflare Zero Trust free-tier seat cap and paid per-seat price.
- Entra P1/P2 and External ID prices.
- D1 jurisdiction of the existing production database.
- Whether Cloudflare dashboard SSO uses the same tenant (break-glass circularity).
- Whether any generated app has its own identity feature not visible in this repository.
- Real browser, screen-reader, physical security-key or passkey acceptance.

### Open questions for the owner

1. Is group→role mapping wanted at all, or should Composer roles stay local and deliberately
   manual?
2. Is a single-IdP production posture a product constraint (simple, safe) or a limitation to
   remove for multi-tenant customers?
3. For a customer exit, who owns the lost Conditional Access/device assurance: Composer
   (via Cloudflare posture), the customer's new IdP, or an explicit accepted risk?
4. Is Australian-only handling a hard requirement for identity data, or only for app content?
   The current stack cannot pin Access identity data to Australia.
5. Is there an existing break-glass identity outside the primary tenant? If not, that is the
   highest-severity operational gap in this report.

---

## 13. Bottom line for product copy

Truthful today:

> "App Composer uses your organisation's identity provider through Cloudflare Access. If you
> use Microsoft Entra ID, your people sign in with their existing work account and your
> Conditional Access and device policies still apply at Microsoft. Composer then applies its
> own workspace roles and per-app permissions."

Not truthful today, and must not ship:

- "Enterprise SSO and SCIM provisioning" — SSO is single-IdP admission; SCIM does not reach
  Composer.
- "Replaces Active Directory / Entra / Intune / Microsoft 365."
- "Workspace roles sync from your directory" — they do not; groups are read but unused.
- "SSO for your generated apps" — generated app end-users are not federated.
- "Australian data residency" for identity data.

The defensible promise is narrower and still valuable: **keep your people and your access
policies, adopt Composer without a second password, and keep a documented, reversible path
if you later change identity providers.** That promise is supportable once the binding and
offboarding contract in §8 is implemented and tested — not before.

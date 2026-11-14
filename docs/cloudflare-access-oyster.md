# Cloudflare sign-in for Composer, Media Studio and Oyster

## Decision

Use **Cloudflare Access native email one-time codes and passkeys** for the selected browser sign-in profile. Keep application keys for agents and automation. Composer continues to own its users, workspace membership and application grants; Media Studio continues to use its existing Composer handoff. Propose an optional Access authentication adapter in Oyster for installations that want the same browser experience.

This guide is the maintained integration brief to share with Levi and other contributors. It describes existing code, the selected implementation, prerequisites and ownership. **The native Access account-binding change and live email/passkey rollout are still delivery work. Publishing this document does not enable them.** Track that work in [Composer #257](https://github.com/loftwah/app-composer/issues/257).

Cloudflare now supplies these login methods directly, so this implementation needs **no Pocket ID, extra identity server, SMTP service or tailnet enrolment**. Email sign-in here means a one-time code, not a password or magic link. Pocket ID is useful elsewhere, but its server and persistent database would add an identity workload we do not need. Cloudflare Containers could host server software with a deliberately designed persistence layer; their ephemeral disk does not make Pocket ID a drop-in Workers component. [Access passkeys][passkeys] · [Email codes][otp] · [Pocket ID installation][pocket-install] · [Container persistence][containers]

The selected profile applies to the intended application and admission policy. It does not relax the separate private Team Hub requirement for passwordless sign-in and independently enforced MFA in [#354](https://github.com/loftwah/app-composer/issues/354). An email fallback is appropriate only where the application's policy permits it. Native passkey sign-in does not retrieve external IdP groups or custom claims; preserve any policy that depends on those claims until its actual replacement works. [Passkey limitations][passkeys]

## What exists and what changes

The source baseline reviewed for this decision is:

| Component | Baseline | Existing behaviour | Selected remaining work |
| --- | --- | --- | --- |
| App Composer | [`439c491`](https://github.com/loftwah/app-composer/tree/439c4916085c8952e03cda486a030d824fd49d42) | EmDash 1.4.0 with Cloudflare Access; validated admin JWT boundary; local users, workspaces and application grants | Add an explicit native Access account-binding path, preserve owner recovery, then enable and demonstrate the selected login methods |
| Media Studio | [`4511cfe`](https://github.com/loftwah/composer-media-studio/tree/4511cfe1ba54d27f88458f23521629fb3f6c855b) | Two-minute, single-use Composer handoff; 30-minute Studio session; selected-project scope; current-grant checks for privileged actions | Reuse this entry; settle private-read revocation timing and demonstrate an ordinary admitted member |
| Oyster | [`251a8ce`](https://github.com/fungi-computer/oyster/tree/251a8ce830a35a13f7456b4d384c2e589ccfc4e3) | Authentication adapters, subject-based membership, Auth0 integration and key authentication; standalone provisioned-owner model | Optional native Access adapter and explicit existing-owner binding; a general multi-user product remains separate |

The [existing Studio receipt](evidence/media-studio-integration-20261114/README.md) records a live owner handoff and rejected invalid/replayed/wrong-project handoffs. It does not establish a live second-user or native Access passkey journey. Studio currently rechecks Composer grants for edit/generate/publish/admin; private reads can retain their session's access until expiry. Do not advertise immediate revocation of every read until that path is changed and demonstrated. [Studio authentication source][studio-auth]

## The person's experience

1. Open Composer or **Open your studio**. If needed, Cloudflare presents the login methods enabled for that application.
2. Use an email code for the permitted first sign-in, then enrol a passkey through Cloudflare. Later sign-ins use the device or password manager's passkey prompt. Cloudflare handles the challenge and credential; Composer does not store a passkey or email-delivery secret. [Passkey setup][passkeys]
3. Composer resolves the authenticated Access account to the intended local user, then checks workspace membership and the Studio grant. An admitted but unbound or unauthorised person sees a clear access/recovery outcome; successful Access login does not grant ownership.
4. Open the Studio through the existing signed handoff. The browser receives a short-lived Studio session containing the permitted workspace/project/actions. There is no second owner-key or passphrase prompt on this route. [Composer entry][composer-entry] · [Studio authentication][studio-auth]
5. Publicly published media remains readable according to its publication state. Private originals, project state and editing operations retain their application checks. [Studio routes][studio-routes]

A workspace invitation and Cloudflare admission are separate. The owner or authorised setup agent must arrange both; a pending Composer invitation currently neither admits an Access user nor sends an invitation email. Keep that explanation beside the invitation and login experience. [Current invitation behaviour](invited-member-access.md)

Standalone Studio ownership remains supported. Connecting Composer should preserve the existing deployment, data and owner recovery route. Logging out of Studio, Composer and Access ends different sessions; the product must say which action it performs. Removing a passkey alone does not revoke existing Access sessions. [Access sessions][sessions] · [Passkey removal][passkeys]

## Where the work belongs

| Owner | Responsibility | Reason |
| --- | --- | --- |
| Cloudflare configuration, operated by the installation owner | Login methods, permitted people, required factors, Access application/audience and protected routes | These are deployment and admission decisions, not an application user directory |
| App Composer | Bind external accounts to existing local users; admission/invitation guidance; workspace and app grants; Studio entry; setup/tutorial | Composer knows the existing account, workspace and permitted actions |
| Media Studio | Verify the handoff, keep project/action checks and enforce the documented revocation behaviour | Studio owns its private data and execution boundary |
| Oyster upstream | Reusable optional Access adapter, clear credential precedence, explicit owner/principal mapping and example configuration | Every Oyster installation should be able to reuse the mechanism without depending on Composer |
| EmDash upstream | Resolve external identities by provider/issuer and subject, with deliberate migration/account linking | Its current core external-auth middleware resolves a local user by email; this is a CMS-wide concern |

Composer must not gain cloud administration authority merely because someone signs in. An Access service token, application key, deployment API token and human session have different purposes.

### Composer and EmDash account binding

The installed EmDash Access profile takes over production authentication; native EmDash passkeys are an alternative profile. Adding a hidden EmDash login endpoint would not implement the selected Access design. [EmDash authentication][emdash-auth]

The reviewed EmDash 1.4.0 [external-auth middleware][emdash-code] uses `getUserByEmail`. Composer's [existing guard](access-subject-binding.md) checks an explicitly reviewed mapping before and after that lookup, but requires an external OIDC issuer/subject from Access's identity endpoint. **Native Access email/passkeys need a separate explicit profile. Do not simply enable the existing OIDC guard or remove its upstream identity checks globally.**

For the native profile, bind:

**Configured Access issuer + validated Access subject → existing immutable local user ID.**

The implementation must reject an absent, revoked or mismatched binding, a disabled local user and an unexpected post-authentication local account. Existing email checks can remain a consistency check around EmDash's lookup; email must not create or move the binding. Preserve existing users, ownership, content and grants. An owner deliberately links an account through the established owner/operator recovery path; the first person through Access must never become the owner automatically.

Cloudflare documents Access `sub` as unique to an email address per Cloudflare account. Deleting and recreating an Access user changes it. This is an **Access account binding**, not proof of an immutable upstream person. A recreated user starts unbound. Before reassigning a mailbox, retire the old local binding/access and relevant Access user/sessions. Leaving an old email-associated Access account active while transferring its mailbox cannot distinguish the new mailbox holder. Prove once that email and passkey sign-in reach the same intended account. [Application token semantics][application-token]

Keep the OIDC-backed profile available for installations that need it. Prefer a supported EmDash external-identity fix when available; a bounded compatibility guard must not become a forked CMS or parallel identity platform. [Composer binding code][composer-binding]

The bounded downstream implementation can use EmDash's supported external-auth `AuthDescriptor` entrypoint. Resolve the verified native Access binding first, then return the bound local user's email/name/role with `autoProvision`, `syncRoles` and `syncName` disabled for that profile. Retain the post-authentication local-ID check. Use an additive native binding record rather than inventing OIDC fields or rewriting the existing OIDC records. Extend the existing binding module/operator command; its current SQLite command does not itself apply a remote D1 change. [EmDash auth extension][emdash-auth-types] · [Existing binding command](../scripts/access-subject-binding.mjs)

Cover the real Studio entry as part of that implementation: the current public `/media-studio/studio` page mints its handoff from the persisted Composer session, outside the `/_emdash` guard. Move or validate the minting operation through the existing protected native action boundary. The current `/api/studio/access` grant check also needs the relevant local disabled/binding state if account removal is to stop an already open Studio. Merely changing admin login does not establish those properties. [Composer entry][composer-entry] · [Current grant endpoint][composer-studio-access]

### What Levi could add to Oyster

The smallest useful upstream contribution is an opt-in **Cloudflare Access `AuthAdapter`**, following Oyster's [existing authentication contract][oyster-contract]. It can be developed independently of Composer's UI and EmDash migration.

- Validate the Access application JWT against the configured team's signing keys, exact issuer, application audience, signature and lifetime. The human path requires an application token (`type: "app"`) and a non-empty user `sub`. Accommodate signing-key rotation. Use verified claims, never an unvalidated email header. [Cloudflare validation][jwt] · [Token claims][application-token]
- Return a provider/issuer-scoped identity with the Access subject; email/name are display data. Resolve it through Oyster's existing registry/principal boundary to an explicitly authorised existing owner or user.
- Preserve the existing provisioned owner and data. Do not reset the standalone registry or make all Access-admitted people owners. Oyster's current standalone `soleMember` assumptions mean a complete multi-user lifecycle is a separate change. [Standalone tenancy][oyster-standalone]
- Explicit application-key credentials select the key path and must pass it. A recognised invalid credential is refused; it must not fall through to a browser identity or a server-held owner key. Missing credentials may pass to the next supported adapter according to the existing contract.
- Keep human and service identities separate. If an API route also requires Access, a service token gets the request through that outer gate; the application key still supplies application authority. A service assertion must not become a human owner. [Service tokens][service-tokens]
- Offer a small configuration example and the browser route without asking people to paste or retain the shared owner key.

Oyster already has an [Auth0-specific adapter][oyster-auth0]. A generic direct-OIDC adapter is optional later work, not required for native Cloudflare login. An upstream IdP configured as an Access login method can still reach this adapter through the Access assertion. Composer does not need to wait for a general Oyster account system to improve its own sign-in.

## Routes and deployment prerequisites

Protect the routes that carry private operations while preserving deliberate public outputs and machine protocols:

| Route or caller | Required behaviour |
| --- | --- |
| Private browser UI/API | Valid human identity or app session, then current local/resource authority |
| Public article, tutorial and published media | Normal public access and publication withdrawal rules |
| API/MCP automation | Existing scoped application credentials, plus Access service authentication where that route requires it; useful protocol errors rather than an HTML login loop |
| WebSockets, if an affected Oyster surface uses them | Authorise before upgrade; use a supported hostname-based Access application |
| Provider callback | Its existing signature and job-scope checks; no blanket public exemption for other private routes |
| Service Bindings/RPC | Carry a verified principal or scoped delegated grant through the trusted internal call; the receiving service enforces permissions |
| Alternate hostname or direct origin | Disable unused aliases or enforce the same Access admission on private paths; offline JWT validation alone must not bypass Access revocation |

Cloudflare's Worker-level Access integration currently rejects WebSocket upgrades; hostname-based Access is the documented route for those applications. Verified `ctx.access` is not propagated through service bindings/RPC, and Static Assets routing has additional limitations. Retain the validated JWT boundary where the actual Astro/Worker topology needs it. Do not adopt `ctx.access` merely to remove a few lines of verification. [Workers integration][workers-access]

The actual rollout needs access to the existing Zero Trust organisation's application, policies and login-method settings; the correct issuer/audience and host/path; an explicitly bound existing owner and recovery route; and deployment access for changed code. Workers deployment permission alone does not establish permission to change Access settings. Passkey enrolment and use require the owner's real authenticator interaction.

Keep current Composer/Studio origins and bridge/session secrets in their existing secret stores. Their values do not belong in this guide, screenshots, prompts or issue comments. No credential rotation is necessary merely to publish the design.

## Tailscale compatibility, without setting it up

Tailscale is an optional private-network transport for a future backend, not the sign-in provider or a browser-user prerequisite. Keep backend requests behind a small server-side fetch boundary with a configured destination, existing application authentication, timeouts and the existing job contract.

A candidate Cloudflare path is **Worker → Workers VPC service binding → `cloudflared` on an existing machine with tailnet reachability → private HTTP backend**. Workers VPC is beta. This composition is a design to verify when that dependency is needed; it has not been configured or demonstrated here. Use a fixed configured destination and preserve the backend's application credentials. A tunnel reaching a machine does not grant a Composer user access to its data. [Workers VPC][vpc] · [VPC service configuration][vpc-service]

A future connector needs authorised tailnet reachability, working backend DNS/TLS, a supported `cloudflared` version and outbound QUIC connectivity over UDP 7844. These are future connection prerequisites, not setup work for this delivery. [Tunnel requirements][vpc-tunnel]

A normal Worker does not run `tailscaled`. A backend host may use Tailscale Serve for private HTTPS. Tailscale Funnel exposes a service publicly; it is not the private-network option described here. Tailscale identity headers are not a substitute for verified app authority, especially for machine-tagged callers. No tailnet, connector, public Funnel or new network control plane is being provisioned for this delivery. [Worker runtime][worker-node] · [Tailscale Serve][tailscale-serve]

## Delivery and proportionate proof

Implement the bounded native Access binding and preserve the owner first; then configure the intended application, exercise the real login and update the public tutorial with the observed result. Run the owning repository's existing release process. **No new CI workflows, release gates, qualification dashboard, provider matrix or mandatory Tailscale setup.**

Use existing tests for changed authentication boundaries and reuse existing evidence. The useful proof is:

1. One permitted person signs in by email, enrols/uses a passkey, reaches the same allowed Studio project without an owner-key prompt and signs out. Record the actual recovery/sign-out behaviour.
2. Focused checks reject a wrong issuer/audience, invalid or expired assertion, unmapped/removed account and invalid explicit key. Check the affected private read/action after removal; retain public publication access where intended.
3. One existing automation call still works through its actual deployed route with the expected application credential and, where needed, Access service credential.

These are evidence for this change, not another general test programme. Do not add physical-device/provider combinations unless the product is making that specific compatibility claim. Tailscale remains documented until an actual private dependency makes a live check useful.

### Existing delivery owners

| Record | Bounded responsibility |
| --- | --- |
| [Composer #257](https://github.com/loftwah/app-composer/issues/257) | Native Access account binding, selected login policy, owner recovery and real login journey |
| [Composer #422](https://github.com/loftwah/app-composer/issues/422) | Oyster adapter contribution/integration contract; preserve scoped app and agent access |
| [Studio #2](https://github.com/loftwah/composer-media-studio/issues/2) | Existing bridge/session behaviour and private-read revocation decision |
| [Composer #351](https://github.com/loftwah/app-composer/issues/351) | Optional Tailscale/private-backend compatibility; no current provisioning |
| [Composer #459](https://github.com/loftwah/app-composer/issues/459) | User-facing article/tutorial explanation and actual completed login walkthrough |
| [Composer #11](https://github.com/loftwah/app-composer/issues/11) | One concise release/evidence receipt with real implementation and live status |

The broader identity research in [#352](https://github.com/loftwah/app-composer/issues/352) and other #257 profiles remain separate. Keep EmDash's subject-based external-user resolution and Oyster's Access adapter as distinct upstream proposals. No upstream acceptance is implied by this document.

The public explanation belongs in [`src/pages/media-studio.astro`](../src/pages/media-studio.astro), at **How it fits together**. The ordinary user journey belongs in [`src/pages/media-studio/tutorial.astro`](../src/pages/media-studio/tutorial.astro), at **Enter through Composer**, with this guide linked from **Technical reference**. Describe the selected approach now; only label native email/passkey login live after the deployed journey succeeds. Keep the broader article rebuild independent of publishing this narrow integration reference.

[passkeys]: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/passkeys/
[otp]: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
[pocket-install]: https://pocket-id.org/docs/setup/installation
[containers]: https://developers.cloudflare.com/containers/faq/
[sessions]: https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
[application-token]: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
[jwt]: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
[service-tokens]: https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
[workers-access]: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
[worker-node]: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
[vpc]: https://developers.cloudflare.com/workers-vpc/
[vpc-service]: https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/
[vpc-tunnel]: https://developers.cloudflare.com/workers-vpc/configuration/tunnel/
[tailscale-serve]: https://tailscale.com/docs/features/tailscale-serve
[emdash-auth]: https://docs.emdashcms.com/guides/authentication/
[emdash-code]: https://github.com/emdash-cms/emdash/blob/10beb8c5a99e41c3a8554b09ac5123c4dddc8d11/packages/core/src/astro/middleware/auth.ts
[emdash-auth-types]: https://github.com/emdash-cms/emdash/blob/10beb8c5a99e41c3a8554b09ac5123c4dddc8d11/packages/core/src/auth/types.ts
[composer-entry]: https://github.com/loftwah/app-composer/blob/439c4916085c8952e03cda486a030d824fd49d42/src/pages/media-studio/studio.astro
[composer-binding]: https://github.com/loftwah/app-composer/blob/439c4916085c8952e03cda486a030d824fd49d42/src/lib/access-subject-bindings.mjs
[composer-studio-access]: https://github.com/loftwah/app-composer/blob/439c4916085c8952e03cda486a030d824fd49d42/src/pages/api/studio/access.ts
[studio-auth]: https://github.com/loftwah/composer-media-studio/blob/4511cfe1ba54d27f88458f23521629fb3f6c855b/src/lib/auth.mjs
[studio-routes]: https://github.com/loftwah/composer-media-studio/blob/4511cfe1ba54d27f88458f23521629fb3f6c855b/src/worker.mjs
[oyster-contract]: https://github.com/fungi-computer/oyster/blob/251a8ce830a35a13f7456b4d384c2e589ccfc4e3/src/tenancy/contracts.ts
[oyster-standalone]: https://github.com/fungi-computer/oyster/blob/251a8ce830a35a13f7456b4d384c2e589ccfc4e3/src/standalone/tenancy.ts
[oyster-auth0]: https://github.com/fungi-computer/oyster/blob/251a8ce830a35a13f7456b4d384c2e589ccfc4e3/src/tenancy/auth0.ts

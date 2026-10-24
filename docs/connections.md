# Connections: reference inventory and checked reads

The native **Connections** page is a read-only inventory for current workspace
owners/editors. It exposes named references and supported dependencies, with one
explicit low-impact Guestbook read check. It accepts no key values, changes no
binding and creates no secret store or connection toggle.

## What is shown

The server derives installation account/environment and fixed destinations from
the existing runtime. It reports presence of the reviewed `GUESTBOOK_OWNER_TOKEN`
and `RESEND_API_KEY` references, never their values, recoverable masked portions,
sender/recipient addresses, arbitrary environment variables or provider errors.
Availability is not a verified account, permission, credential or provider health
claim. Expiry is explicitly unknown.

Saved Guestbook consumers are read from exact workspace/account/environment/
target resource bindings. Owner-mail dependencies come from that same scope's
saved notification preferences. Each list is bounded to 50 and marks unavailable
storage separately from an empty list. The Inbox journey reports only whether
the owner-mail connection is configured, a 12-character SHA-256 destination
fingerprint and the recorded delivery state; it never renders the recipient or
sender address, API key or provider response body. The two current native workflow recipes
use local records; no external credential dependency is invented for them.

**Check an owned visitor-book read** server-selects one ready owned resource and
uses the existing `resourceConnection.status()` implementation. It reads the fixed
`/guestbook/build.json` and authenticated resource route, verifies exact reviewed
source/account/environment/resource identity. After public source verification
returns, it rechecks the exact local resource and current membership immediately
before forwarding the credential-bearing read, then rechecks scope and membership
before returning its result. It proves only that resource read at that time. It does not test
writes, all resources, complete provider grants, expiry or recovery.

Missing configuration/resource means unavailable or unknown without a request.
Refusal, rate limit, interrupted/outage and contract mismatch remain distinct.
Raw errors and response bodies never leave the check. A redirect is not followed.
Owner-mail has no check button because no safe non-sending provider check is
qualified; this view never sends a test message. Check results live in the current
view, not a fabricated persistent freshness record. Refresh returns metadata
without retaining an old successful check.

## Local loading: verified installed behavior

This repository ignores `.dev.vars*` and `.env*`. No local file is written or
exported by Connections. A local plaintext file is readable by any permitted
process/agent with file access; naming a reference does not make it invisible.
Use hosting secrets in production and never inject actual secret values into
`import.meta.env`, client bundles, prompts or public specifications.

The installed Wrangler **4.152.0** export `unstable_getVarsForDev` was exercised
with fictional files in `tests/local-secret-precedence.test.mjs`:

- `.dev.vars.<environment>` replaces `.dev.vars` and excludes the `.env` family.
- Without it, `.dev.vars` excludes the `.env` family.
- For the `.env` family, this installed version resolves
  `.env.<environment>.local` → `.env.<environment>` → `.env.local` → `.env`.

The [current Cloudflare secrets page](https://developers.cloudflare.com/workers/configuration/secrets/)
lists the two middle `.env` entries in the opposite order. The test records the
actual installed behavior; it is not a replacement loader. Use one local file
where possible and rerun after a Wrangler change. These rules concern Wrangler
local runtime loading, not Vite's separate build-time environment behavior.

Placeholder-only example, entered locally through the appropriate existing flow:

```dotenv
GUESTBOOK_OWNER_TOKEN="<set-locally-never-share>"
RESEND_API_KEY="<set-locally-never-share>"
```

## Hosting-managed lifecycle and remaining gates

Connect/replace/disconnect remain host-managed operations under the existing
version-aware deployment guard. Review dependencies, exact account/environment
and in-flight effects first; verify a replacement before switching, preserve a
working reference on failure, and recheck actual consumers after release.
Removing a reference does not revoke the credential at its provider. A cosmetic
local toggle would not establish revocation across existing consumers.

Cloudflare's standalone secret put/delete commands can deploy immediately; do not
bypass this installation's guarded release path. [EmDash's secret guidance](https://docs.emdashcms.com/deployment/secrets/)
also distinguishes runtime secrets from build-time configuration. Official
references were checked on 24 October 2026.

No Basic Auth, external vault, arbitrary webhook URL, merchant connector or local
agent credential lifecycle is qualified here. A future Basic Auth integration
must use HTTPS, one explicit destination, a limited account and no cross-origin
credential forwarding; it cannot replace the admin's admission or MFA policy.
Existing personal password-vault choices remain separate from a service-account
secret-manager integration. No subscription is required by this inventory.

The public matching module remains `/prompts#connections` with **Assess and
prepare** support. Full connect/check/rotate/disconnect, provider revocation,
local-agent grants and broader secret-manager acceptance remain open in #291.

## Verification and cleanup

```sh
node --test tests/connections.test.mjs tests/local-secret-precedence.test.mjs
```

The route tests use the existing FK-enabled in-memory SQLite/app-service fixture.
They exercise actual maintained read requests, canary-secret absence, precise
scope, no effect, wrong-workspace/viewer denial, late revocation, interrupted and
failed reads, stale source and unavailable dependency storage. They do not count
as a real provider or hosted owner session. The loader test registers cleanup for
one owned temporary root immediately, removes it on success/failure and asserts
its absence. It creates no Worker, account, browser or package installation.

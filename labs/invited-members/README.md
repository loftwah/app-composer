# Invited-member local account qualification

This lab copies explicitly selected checkouts into one owned temporary root. It
uses EmDash 1.2.0's supported native passkey setup/invitation/registration/login
APIs and the browser's actual WebAuthn implementation with virtual platform
authenticators. It creates a fictional role-50 owner and two distinct role-10
members, logs members out and back in, verifies their persisted native sessions,
and tests member-plugin success plus unrelated native route denials. It does
not inject `ctx.user`, insert accounts/sessions into SQLite, or mock the member
components. Native account invitations are local `example.test` records and
manual link handoffs; the copied config removes the email transport.

Production uses Cloudflare Access. Only the disposable copy removes that
provider option and substitutes the normal Cloudflare handler for Composer's
Access wrapper. Production source and policy remain intact. A loopback-only TLS
proxy on port 8443 plus an isolated Chrome resolver maps the HTTPS endpoint to that local port and keeps the stable installation
issuer and the exact same-origin guards. No system DNS/hosts setting changes.
The self-signed certificate is trusted only by the isolated browser context.

Start after Composer integration includes the member plugin and exact app pins:

```sh
node labs/invited-members/run.mjs start \
  --composer /absolute/integrated-composer \
  --guestbook /absolute/reviewed-guestbook \
  --showcase /absolute/reviewed-showcase
node labs/invited-members/auth.mjs --pointer /absolute/composer/output/invited-members/local-root
node labs/invited-members/run.mjs status
```

Existing installed dependencies are reused through isolated APFS clones on this macOS host. The Composer copy is built once;
all three Workers use actual local D1/R2/KV emulation and named service bindings.
The source receipt records original SHA/dirty status and the separate temporary
lab commit. The lab's local config, tokens, certificates, native sessions,
virtual authenticator profile and databases remain under that single root.
Native storage states let the subsequent labelled member/owner journey use the
same accounts. They must never be copied into public evidence or committed.

The real native sign-in proof is distinct from production Access admission,
physical passkeys, physical devices and human acceptance. The native shell
observation is recorded separately from the purpose-built member surface.

Refresh only Composer source and its built artifact while retaining native accounts,
all D1/R2/KV state, sessions, the app workers and the TLS proxy:

```sh
node labs/invited-members/run.mjs refresh-composer --composer /absolute/integrated-composer
```

The refresh explicitly aligns the temporary composition's source/manifests with
its already running app Workers, verifies unchanged reviewed adapter hashes,
and records a separate lab source commit. It never promotes production pins.
An interrupted local auth experiment can use `reset-accounts` to erase only this
owned Composer fixture's accounts, sessions, stacks and workspace configuration
without rebuilding or touching independent app data. Do not reset during a
member journey.

Stop the named CLI session after interaction and then remove the owned root:

```sh
# The auth command prints the exact session name; never close unrelated sessions.
/path/to/playwright_cli.sh -s=THE_PRINTED_SESSION close
node labs/invited-members/run.mjs stop
```

Startup failure removes its root and stops only registered process groups whose
PID/start identity still matches. Normal stop also closes the registered auth CLI session. It preserves neither the temporary
project nor credentials. Keep only bounded, redacted interaction receipts and
screenshots under ignored `output/invited-members/` before stopping. A port
collision fails without touching the process using it.

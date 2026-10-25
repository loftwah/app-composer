# Owner-approved initial EmDash key recovery

Owning issue [#291](https://github.com/loftwah/app-composer/issues/291); release
index [#11](https://github.com/loftwah/app-composer/issues/11).

This source change is based on `d3e0b67de2b05315351af9ff2c89b70dec75fd56` with
EmDash / Cloudflare adapter 1.3.1, Wrangler 4.152.0 and Node 22.23.4. It does not
itself establish a production deployment or healthy provider credentials.

## Authority and scope

The owner explicitly approved a fresh key for this fresh installation after the
malformed-key finding and full native storage scope correction. The maintained
three-store metadata gate confirmed empty plugin options, collection storage and
nonempty state data immediately before the official CLI generated the key. No
option names, plaintext, ciphertext or key values were output. The generated key
is securely retained outside Git; the owner operator holds its location. Keep
that key with future encrypted database backups.

This permits one bounded initial recovery. It is not a rotation tool, an
installer, permission to replace existing settings, or authority to discard data.
A later nonempty metadata observation stops this path even when a recognised
encryption envelope count is zero. Restoring older encrypted backups requires
their matching original key, not this fresh key.

## Reviewed release input

The production release owner stages only the approved JSON file at
`.private/emdash-encryption-secrets.json` in a disposable clean release clone.
The directory must be owned and 0700; the file must be owned, regular, 0600,
not a symlink, not hard-linked and at most 256 bytes. The JSON accepts exactly
`EMDASH_ENCRYPTION_KEY` with the canonical native `emdash_enc_v1_` encoding of
32 bytes. No file path, target or arbitrary binding override is accepted.

Run the existing reviewed release with `pnpm deploy --emdash-key`. Existing
`--miniapp-secrets` remains compatible, including an explicitly selected combined
invocation. Both inputs are independently validated; the existing 0600 temporary
snapshot is removed on success or failure. Neither input source is removed.
Key-bearing Wrangler output is captured and suppressed even on parse/upload
failure. If upload outcome is uncertain, inspect the actual Worker/version
before retrying; do not infer failure means nothing changed.

All existing clean pushed-main, fresh remote-main, account, site, generated-target,
composition, audit, required checks, migration, package, build and verification
gates remain. Immediately before upload, the fixed three-store SELECTs run again.
Any nonempty, malformed or unavailable result refuses the key upload. A final
fresh remote-main guard follows the metadata check. These observations cannot
lock out an independent owner writer; coordinate release ownership and stop if
any settings are written during this initial recovery window.

Wrangler's `--secrets-file` is additive. The installed 4.152.0 implementation adds
only listed secret bindings, deploys with `keepSecrets: true`, and emits
`keep_bindings` for `secret_text` and `secret_key`; it explicitly preserves
unlisted secrets. The [official Workers command reference](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
also states that existing omitted secrets are preserved and deployment does not
delete secrets. Normal service/storage bindings still come from the reviewed
configuration and existing target guards. No standalone `secret put` bypass is
introduced.

## Real native Connections verification

Existing native plugins did not declare a suitable owner-editable secret
setting. The existing Composer plugin now registers one optional reserved secret
field under a UUID-namespaced name. It has no provider meaning or default and
must remain empty outside a check. This is registered at plugin construction,
not a request-time mutation of global configuration.

The production Connections page offers **Verify encrypted storage** only to a
workspace owner who is also a global administrator. Its administrator-only POST
rechecks current database account/disabled state and workspace owner membership;
it requires the exact production origin, site/environment and native request
header, refuses bearer/machine credentials, and sends `private, no-store`.
A GET cannot create a setting. Supplied input contains only the workspace.

The server generates a new synthetic secret and uses real installed native
`ctx.settings.compareAndSet(field, null, value)`. It refuses existing native or
legacy values. It observes only its reserved row internally, requires the native
encrypted envelope, then reloads/decrypts through native `getVersioned`. The
response contains fixed metadata only. No secret, envelope, arbitrary option
name, provider key or provider request is accepted or returned.

Finally it conditionally deletes only the exact captured ciphertext and native
revision it owns. A concurrent replacement is preserved. If CAS commits but its
response is lost, the revision is unknown: the check only observes presence and
reports cleanup required rather than claiming absence or deleting an uncertain
row. Failed cleanup is explicit and the next check refuses the retained value.
The operator must inspect any retained reserved option under the matching key
before a separately reviewed, exact cleanup; this endpoint has no force/delete
operation. Repeated authorised POSTs are fresh checks; native CAS prevents
concurrent overwrite. No provider action, grant or unrelated audit row is made.

**Verified** proves native encryption at rest, native decryption after reload,
and owned temporary-value cleanup for the served runtime. It does not qualify
provider credential health, mail delivery, older backups or another environment.
Record the exact source, Worker identity, timestamp and authenticated owner
result after deployment. Physical-device and assistive-technology coverage are
not supplied by this source lane.

## Focused evidence

- Real native EmDash runtime/dispatcher plus SQLite exercises encrypted envelope,
  native readback and cleanup. Only Astro virtual configuration / DEV flags and
  the database adapter are local harness boundaries. Synthetic keys only.
- Negatives cover anonymous/editor/viewer/disabled access, wrong scope/origin,
  bearer credentials, GET, unknown input, invalid/missing key, existing values,
  repeated/concurrent checks, access revocation, independent replacement, lost
  CAS response, native read failure and failed conditional cleanup.
- Disposable clean pushed-main deployment fixtures run the actual deployment
  guard/key upload path while stubbing expensive build/package checks. They
  prove a store populated after checks refuses upload, merged key names remain
  bounded, private tool failures are suppressed and temporary snapshots clear.
  They do not qualify a build or provider upload.
- Parser/filesystem tests cover exact canonical key format, duplicate/unknown
  fields, legacy/noncanonical encodings, permissions, symlinks/hard links,
  source preservation and unknown/nonempty/redacted metadata failures.

All disposable fixture roots register cleanup before work and are removed by
node:test finalizers. No temporary native project or key is retained as evidence.
The legitimate operator backup is intentionally retained separately.

Local implementation acceptance on 25 October 2026:

```sh
node --test tests/emdash-key-recovery.test.mjs tests/emdash-key-deploy-gate.test.mjs tests/deployment-target.test.mjs tests/audit-gate.test.mjs tests/connection-encryption.test.mjs tests/connections.test.mjs
pnpm check:types
pnpm build
```

The combined fixture run passed 32/32 in 5.47 seconds. Type checking reported
zero errors, zero warnings and 74 existing hints. The real production-target
build passed; Astro reported 7.02 seconds for the server build and publication
inspection passed for 1,280 files and 150 archive members. The existing large
chunk warning remains; no checks or size thresholds were weakened. Independent
review reran 24 focused cases in 6.72 seconds and found no remaining critical or
important issue after the CAS-response ambiguity was fixed. Full guarded release
checks and production interaction belong to the release owner after integration.

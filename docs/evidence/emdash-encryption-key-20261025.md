# EmDash encryption-key rejection — read-only finding

Observed 25 October 2026 against Composer `5e012f98` / Worker
`57c5873f-77a9-4c0c-a413-bd1d1ad4b2b4`. This note records a read-only
investigation. No key was read, printed, generated, rotated, replaced or
deployed.

## What the runtime reported

`wrangler tail app-composer` reported:

> `EMDASH_ENCRYPTION_KEY is invalid: ... expected "emdash_enc_v1_" followed by 43 base64url chars. Plugin secret settings are unavailable until this is fixed.`

The secret **name** is present on the Worker. Its value was not read. EmDash
1.3.1 validates the value at startup with `parseEncryptionKeys()` in
`node_modules/emdash/dist/secrets-*.mjs`. The accepted shape is exactly:

- prefix `emdash_enc_v1_`
- 43 canonical unpadded base64url characters
- decoding to 32 bytes

The validator fails closed for plugin secret settings; unrelated public routes
continue to work.

## What encrypted data exists

Read-only D1 queries (no values, no row bodies):

```text
_plugin_storage: 0 rows
_plugin_state: 4 rows (composer-members, composer-miniapps, composer-resend,
               composer-stacks), each data length 0
```

`_plugin_storage` is the EmDash store for plugin collections and settings.
There are currently **no persisted plugin-secret rows**. `_plugin_state.data`
is also empty for every installed plugin. This means the malformed key has no
ciphertext at rest that could be lost by replacing it today.

This does **not** authorise a rotation automatically: the original key may be
needed by private operator records, another environment, or a future restore.

## Exact owner recovery action

1. Check private operator storage for the original key.
2. If the original value is available and valid, restore it unchanged:
   `wrangler secret put EMDASH_ENCRYPTION_KEY --name app-composer` and paste the
   original value over stdin. Do not echo it into shell history or logs.
3. If no valid original exists, generate a new key with
   `npx emdash secrets generate`, store it with the database backups, and set it
   the same way. This is safe **today** only because `_plugin_storage` is empty.
   Re-check that fact immediately before writing.
4. Redeploy/restart the Worker so startup validation runs.
5. Verify: startup logs contain no `EMDASH_ENCRYPTION_KEY is invalid`; one
   owner-authorised plugin settings page loads; one owned Connections read
   succeeds. Record the exact Worker version and timestamp.
6. Keep encrypted settings marked degraded until step 5 is observed. Do not
   claim the key is fixed from a successful deploy alone.

## What remains unverified

- No owner key value, backup, or encrypted-setting content was inspected.
- No production secret write or rotation was performed.
- The exact reason the deployed value is malformed (truncation, legacy format,
  paste error) is unknown because the value was not read.
- The Connections UI read was not performed in this read-only lane.
- This finding does not establish that any other Worker or environment uses the
  same key.

Owning issue: [#291](https://github.com/loftwah/app-composer/issues/291).
Release index: [#11](https://github.com/loftwah/app-composer/issues/11).

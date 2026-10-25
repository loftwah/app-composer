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

## What encrypted data exists — corrected storage scope

The original observation inspected `_plugin_storage` and `_plugin_state` only.
That was insufficient: real installed EmDash 1.3.1 native settings use the
`options` table under `plugin:{pluginId}:settings:{key}`. `OptionsRepository`
and `api/handlers/plugin-settings.ts` establish the actual layout. An empty
collection table does not establish absence of encrypted native settings.

A fresh metadata-only production observation on 25 October at approximately
10:55 UTC completed the scope:

| Store | Observed metadata |
| --- | --- |
| `options`, names beginning `plugin:` | 0 rows |
| Native `plugin:%:settings:%` options | 0 rows |
| Recognised plugin-setting encryption envelopes in plugin options | 0 |
| `_plugin_storage` (earlier same-run observation) | 0 rows |
| `_plugin_state` (earlier same-run observation) | 4 rows, 0 nonempty data rows |

The options query returned counts only and made zero writes. No option names,
plaintext, ciphertext or key values were returned. The maintained fixed queries
and conservative summary are in `scripts/plugin-secret-inventory.mjs`; its tests
cover ordinary native settings, recognised encrypted envelopes, malformed
values, non-settings plugin options and nonempty legacy/collection stores. Any
nonempty plugin store requires review, even when no recognised envelope exists.

There is no current plugin ciphertext in these observed stores. This does not
validate the deployed key, demonstrate decryption, qualify older backups or
other environments, or grant rotation authority. Recheck **all three stores**
immediately before any approved write.

## Owner recovery procedure

1. Identify the exact site, environment, source and Worker version; preserve
   current database/recovery bookmarks and the existing key references.
2. Check private operator storage for the valid original key. Restoring that
   original is preferable when it is needed by older backups or other records.
   Never print or paste the value into chat, a prompt, a command-line argument
   or a retained diagnostic.
3. If no valid original exists, obtain explicit owner authority before generating
   a replacement with official EmDash tooling. Save it with the relevant backups.
   Recheck the complete metadata inventory immediately before a write. Nonempty
   stores or uncertain backup keys require a documented restoration/re-encryption
   decision; do not try keys against production data speculatively.
4. Stage the approved key through a reviewed, version-aware secret/release path
   for the exact environment, then use the clean pushed-main release guard.
   A standalone `wrangler secret put` can immediately deploy and must not bypass
   that guard. This finding does not introduce a general secret-rotation tool.
5. Verify startup no longer rejects `EMDASH_ENCRYPTION_KEY`, a real owner-native
   secret-settings path works, and an owned Connections read succeeds. Record
   the exact served source/Worker and timestamp. A valid format or deployment
   alone does not demonstrate encrypted-settings recovery.
6. Keep encrypted settings marked degraded until those checks pass.

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

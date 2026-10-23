# Launch Kit: local artwork into an owned app

Launch Kit is an independent static browser application. Its source and release are at https://github.com/loftwah/app-composer-launch-kit; Composer's entry is `/launch-kit` and explicit import is `/init/launch-kit`. Preparation needs no account, server image processing, upload storage or model API.

The editor generates nine PNGs, separately treated maskable icons, a validated manifest template, HTML markup, versioned configuration/source digest/output hashes and installation notes. It previews decoded exported bytes. ZIP STORE packaging has bounded file counts/size, safe names and CRC; adoption also verifies hashes, exact dimensions, complete PNG chunks/decompressed scanlines/opacity and the supported manifest. Imported HTML/notes are never executed or copied into a generated app.

Choose the local ZIP on the import screen. Inspect icon/social pixels and choose title, subtitle, icons and social artwork separately. Deliberate adoption retains a separate IndexedDB draft; current Init/content-model drafts stay intact. Download the adoption record and keep the original ZIP. Cancel/replace invalidates pending work and aborts an outstanding write.

## Supported application paths

`pnpm init:launch-kit --package PACKAGE_ZIP --adoption ADOPTION_JSON --destination NEW_ABSOLUTE_ABSENT_DIRECTORY` creates a working independent static listening timer. Serve `public/` with an existing static HTTP server. Start, pause, resume, reset and session duration work locally; no audio or listening history is collected. Supply an explicitly reviewed `--origin HTTPS_ORIGIN --base /public/path/` when the destination is known. The default `example.invalid` is only a placeholder and grants no deployment authority.

`pnpm init:site --model MODEL_JSON --destination NEW_ABSOLUTE_ABSENT_DIRECTORY --launch-kit PACKAGE_ZIP --adoption ADOPTION_JSON` applies selected branding while creating the existing independent EmDash content app. It preserves collection schema, uses selected title in actual page metadata/header, keeps Composer-owned launcher artwork, resolves manifest start/scope to app root and emits app-owned assets plus provenance. This remains local project preparation: its cloud account, authentication, database/storage and deployment configuration require their existing review.

Both paths share the existing inode-bound, absent-directory write path. Neither updates an existing owner project or imports source images. Partial failures retain bounded files for inspection; no automatic overwrite/retry is implied.

## Reference and evidence

`/launch-kit/example/` is the actual static listening timer generated from the browser-downloaded fictional Night Signal package and the deliberately exported Composer adoption record. Its checked provenance lists every output hash and the package SHA-256. The same trusted renderer can produce an independent root-path app. Hosted reference and generated EmDash app remain separate paths.

Verify the served PNG bytes/manifest/HTML and inspect the public page with existing Link Check. Link Check's current reviewed host boundary stays unchanged; it reads page icons/social assets/manifest but does not itself reconcile every package hash or certify installation/native platform unfurls. Exact-byte checks are recorded separately in #11.

Generation, export requested, imported draft, applied project, deployed and served inspection are separate states. Physical iOS, screen-reader use, native social unfurls and MP artistic acceptance remain separate from browser automation. Release receipts in #11 carry exact source/Worker identities and Australia/Melbourne plus UTC timestamps.

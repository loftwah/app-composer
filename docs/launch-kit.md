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

## Profile cards and Linkarooie

The focused editor is `https://composer-launch-kit.loftwah.workers.dev/profile.html`.
It uses the same `app-composer.profile-card` version 1 recipe and maintained
renderer as Launch Kit's pinned local Chromium adapter. Five versioned treatments
cover typography, portraits, editorial banners, music/creative work and existing
artwork. Text-only rendering needs no image. Portrait and banner inputs have
separate crop/focal settings. Source images stay local and are excluded from
portable recipes; reopening an image recipe requires the matching local files.
Unsupported font coverage or readable text overflow produces a recoverable error,
not a substituted name or silent truncation. The displayed preview and downloaded
PNG are the same encoded bytes.

In the Linkarooie owner settings, **Profile shared-link image** downloads only the
selected public name, handle, introduction, image description and saved profile
identity/revision. It does not export cards, provider contributions or account
information. A separate editor tab preserves the current native settings draft.
Unsaved settings may be inspected locally, but must be saved and a fresh snapshot
rendered before activation. Keep original artwork separate from downloaded
recipes. A source hash records identity; it does not grant publication rights.

The editor's adoption ZIP is separate from the complete launch-package ZIP.
Extract its PNG and recipe locally. In the independently owned Launch Kit checkout:

```sh
pnpm build
pnpm render public/examples/river-typography.json output/river --compare
```

That command starts an owned loopback server and runs the same renderer under
pinned Chromium with external requests blocked before the page loads. The receipt
records browser/renderer/font identity and encoded output hashes. This proves
offline processing after dependencies are available; the public website's first
load, offline relaunch, PWA installation and publication are different claims.

In the independently owned Linkarooie checkout, prepare the reviewed output with
`node scripts/prepare-share-card.mjs --recipe RECIPE --image PNG --output RECEIPT`.
The command stages an immutable `public/brand/generated/profile-SHA256.png` and a
bounded adoption receipt. Review, commit and deploy that asset through Linkarooie's
existing clean pushed-main release. Composer's mounted copy still needs its exact
source-pin promotion and guarded root release. A prepared asset changes no profile
settings. Return to owner settings, select the receipt, compare current/proposed
images and explicitly publish. The app verifies deployed asset bytes and expected
profile revision before a compare-and-swap update. A conflict, interrupted result
or failed generation retains the prior approved image. There is no blind retry.
Repeated activation of the same completed operation is safe; restoring the previous
approved image uses the same revision guard.

**Rendered locally**, **selected**, **prepared asset**, **published** and **served
result verified** remain distinct. Native Composer verification checks the mounted
public canonical/image URL, PNG content type, decoded dimensions, hash and current
profile revision. Linkarooie's separate sharing verifier checks standalone and
mounted metadata against HTTP type and raster format, plus dimensions, duplicate
tags, public-origin/size/crawler boundaries. Link Check retains its existing page
inspection scope; it does not certify recipe/package hashes or revision agreement.
Native social caches and downloaded third-party copies cannot be recalled.

The fictional card examples under `/launch-kit/cards/` are generated outputs, not
owner-approved replacement art. Source recipes and the source artwork they reference
are maintained in Launch Kit's `public/examples/`. The separate fictional Linkarooie
profile demonstration is `/showcase/examples/launch-kit/` (mounted) and
`https://showcase.loftwah.com/examples/launch-kit/` (standalone). The existing owner's
profile and manual share-image selection must not be replaced for demonstration.

Optional AI artwork remains outside the static editor. Its trusted local adapter
requires explicit enablement, selected provider key, a deliberate prompt and a
configured allowance before every request; a present key alone performs zero calls.
Final exact names and typography are rendered locally. Provider acceptance and
image quality need their own evidence; mocked gates do not prove paid generation.

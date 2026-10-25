# LDraw dark refresh — 25 October 2026

Composer-side evidence for adopting the independent LDraw release
`fa7a2ab6171cf53edc53c01630fbba2d5d4888aa` ("Open LDraw in dark mode with a
named portfolio block library"). This run captured the live editor from a brand
new browser profile, re-bound the public artwork to that exact source, and
re-ran the browser journeys behind the device-support record. No Composer
deployment, catalogue edit or independent-app release is claimed here.

The previous release's dated evidence stays intact in
[`../ldraw-20261025/`](../ldraw-20261025/README.md) and its `c9c2339…` assets
remain in `public/brand/apps/`.

## Release identity

| Check | Result |
| --- | --- |
| Live `build.json` | `source fa7a2ab6171cf53edc53c01630fbba2d5d4888aa`, tree `32c3a77f…edcbb8`, `workingTreeClean true`, Excalidraw `0.18.1`, built `2026-10-25T01:38:59.825Z`; file SHA-256 `b0fb830b…e58843` |
| Live `/app.manifest.json` | 1462 bytes, SHA-256 `1a01d019656533e62c919568bc1a911983459563121804f28cad28bc5d1e6e36`, byte-identical to that commit's `public/app.manifest.json` |
| Manifest digest | `sha256:fd2cdff1bfa84745e0228b0a0ec88340d7cd7b37eb24b93edaeca2e9356a7be4`, recomputed from the compact manifest JSON; recorded in [`lib/ldraw/source.json`](../../../lib/ldraw/source.json) |
| Manifest contract | `1.1.0`, `static-assets`, no capabilities, no configuration, no Composer service binding |
| New manifest features | `dark-default-appearance`, `named-block-library`, `finished-examples` |

## Capture

[`capture.mjs`](capture.mjs) is the exact script that produced the pixels.

- New empty persistent Chromium profile (no inherited cookies, localStorage or
  IndexedDB). An init script records `localStorage` keys and
  `indexedDB.databases()` before any app script runs: both empty.
- Chromium 1248 headless shell (Playwright 1.64 alpha), `1440×1000`,
  `deviceScaleFactor 1`, `colorScheme dark`, no browser chrome.
- `https://ldraw.loftwah.com/` exactly, no query string.
- Default dark appearance (`dataset.theme=dark`, `dataset.appearance=dark`,
  `.excalidraw.theme--dark`, `theme-color #121212`).
- Default Creator journey scene: 34 elements, including the title
  `Creator journey`, its subtitle and the four portfolio cards.
- No `dialog[open]`; the named block library installs (`ldraw:library:20261025=1`)
  without opening its dialog; one Excalidraw root; page title
  `LDraw — draw and explain`; status `Saved on this browser`.
- Zero page errors, zero console errors and zero failed requests.

| Field | Value |
| --- | --- |
| Captured at | `2026-10-25T02:01:23.326Z` |
| URL | `https://ldraw.loftwah.com/` |
| Released source | `fa7a2ab6171cf53edc53c01630fbba2d5d4888aa` |
| File | `public/brand/apps/ldraw-capture-fa7a2ab6171c-010cfbd2-r2.png` |
| PNG file SHA-256 | `010cfbd233b61c5619a5c2d4c19fbd2f5ef82683ba388c15535ec18b1a02c2db` |
| Decoded RGBA8 pixel SHA-256 | `2cae5bc3fa95792244ede857b95b2950cd7729f49b9cf6466ba078f27a11fc4e` |
| Dimensions | 1440 × 1000 opaque RGB PNG |

[`capture.json`](capture.json) is the run report. The only edit applied to it
after the run is replacing the temporary run-root prefix with `<run>`.

## Derived assets

`scripts/ldraw-discovery-assets.py` (recipe `composer.ldraw-discovery/2`,
compositor SHA-256 `7b0a3949…e242e5`, Pillow 11.3.0) produced these immutable
files from that capture. The original PNG is preserved unchanged and every
derived file keeps its recorded bytes and pixels:

| Role | File | Dimensions | File SHA-256 | Pixel SHA-256 |
| --- | --- | --- | --- | --- |
| Original capture | `ldraw-capture-fa7a2ab6171c-010cfbd2-r2.png` | 1440 × 1000 | `010cfbd2…02c2db` | `2cae5bc3…11fc4e` |
| Workspace preview | `ldraw-workspace-fa7a2ab6171c-010cfbd2-r2-960.webp` | 960 × 667 | `1c72dd08…3aba6a6b` | `22f7f1b5…b498c31` |
| Workspace preview (wide) | `ldraw-workspace-fa7a2ab6171c-010cfbd2-r2-1440.webp` | 1440 × 1000 | `325323e8…22ce72e` | `2cae5bc3…11fc4e` |
| Share card | `ldraw-share-fa7a2ab6171c-010cfbd2-r2.png` | 1200 × 630 | `15248624…fe85352c` | `537a7781…6ce829de` |
| Discovery tile | `ldraw-tile-fa7a2ab6171c-010cfbd2-r2-96.webp` | 96 × 96 | `eeabb304…2b15748f` | `9604b7e9…b8bebe9a` |
| Provenance | `ldraw-provenance-fa7a2ab6171c-010cfbd2-r2.json` | — | recorded in the file itself | — |

All five files live in `public/brand/apps/`. The 1440 preview is a lossless
resize of the capture and keeps its exact pixel hash; the 960 preview and the
share card are reviewed Lanczos derivatives with their own recorded hashes. The
96px tile is unchanged art from the previous recipe revision — the app's own
name in Space Grotesk on canonical orange — and is still not an LDraw logo.

## Device-support journeys

[`device-support.mjs`](device-support.mjs) re-ran the journeys behind
`config/device-support.json` against the live release, in fresh profiles:
desktop `1440×1000` and phone `390×844` with pointer and keyboard emulation.
[`device-support.json`](device-support.json) records the results.

All checks passed:

- fresh visitor opens the default dark editor on both viewports;
- the default Creator journey scene is present and editable;
- native keyboard text entry, undo and redo keep the element identity;
- the named block library lists 18 blocks in 6 groups and inserts an editable
  block (desktop);
- native file open and **Save editable** preserve element IDs, the embedded
  image bytes and human text;
- PNG (real signature and dimensions) and SVG (text, embedded image and
  `@font-face`) exports come from this release's renderer;
- autosave reload restores the current scene on both viewports;
- the offline cached workspace reloads with the imported image (desktop);
- no horizontal overflow at 390 or 1440.

This is browser emulation. Physical touch, stylus, tablet, screen reader and
native mobile file handling remain unchecked, which is why the phone record
stays **limited** and tablet stays **unknown**.

## Composer bindings

- `lib/ldraw/app.manifest.json` is the byte-exact new manifest;
  `lib/ldraw/source.json` records the commit, file hash and canonical digest.
- `src/lib/apps.ts` moves the card image, tile, share card, previews,
  provenance, capture date and both source links to the new release.
- `src/browser/launcher.ts` and `scripts/public-ui-assets.mjs` point the shared
  launcher row at the new source-bound tile name; the reviewed tile bytes and
  pinned SHA-256 are unchanged.
- `lib/content-model/project.mts` and `tests/content-project.test.mjs` carry the
  same tile name for portable project exports, regenerated with
  `pnpm source:write`.
- `config/device-support.json` keeps the desktop supported / phone limited /
  tablet unknown intention, now with this release's journeys.

## Composer render check

[`render-check.mjs`](render-check.mjs) rendered the committed Composer source in
a local `pnpm dev` server and recorded
[`render-check.json`](render-check.json). All nine checks passed:

- the library card names LDraw and decodes the new 96px tile;
- the card links `/ldraw`, the live origin and the exact new `tree/fa7a2ab…`
  source;
- device support still reads **Desktop supported · Phone limited**;
- the preview request serves the new 960px lossless WebP at 960 × 667 (the
  element reports a `srcset`-density-corrected width, so the file itself is
  decoded);
- the explanation names the default dark workspace and the named block library;
- the tile caption still says it is not an LDraw logo;
- the Cmd+K launcher row opens the live editor with the new tile at 96px, and
  the server-rendered page already carries that row before JavaScript runs.

Screenshots: [`apps-1440-dark.png`](apps-1440-dark.png) (LDraw card),
[`apps-ldraw-preview-1440-dark.png`](apps-ldraw-preview-1440-dark.png) (card
preview and caption) and
[`launcher-1440-dark-ldraw.png`](launcher-1440-dark-ldraw.png) (launcher row).

## Commands

```sh
git checkout -b codex/ldraw-dark-refresh-20261025 origin/main
pnpm install --frozen-lockfile
node <run>/capture.mjs                 # fresh profile, live capture
python3 scripts/ldraw-discovery-assets.py render \
  --capture <run>/capture-final/ldraw-live-1440x1000.png \
  --sha256 010cfbd233b61c5619a5c2d4c19fbd2f5ef82683ba388c15535ec18b1a02c2db \
  --pixel-sha256 2cae5bc3fa95792244ede857b95b2950cd7729f49b9cf6466ba078f27a11fc4e \
  --source fa7a2ab6171cf53edc53c01630fbba2d5d4888aa \
  --url https://ldraw.loftwah.com/ \
  --captured-at 2026-10-25T02:01:23.326Z \
  --qualification "Composer #11: independent LDraw release fa7a2ab… qualified by the LDraw lane; Composer re-checked the live build.json source and recorded the fresh-profile capture in docs/evidence/ldraw-refresh-20261025. No owner approval is claimed."
node <run>/verify-live-device.mjs      # live device journeys
pnpm source:write
pnpm check
pnpm build
pnpm dev            # review server, then node <run>/render-check.mjs
```

## Limits and remaining gates

1. Owner review of the typographic tile and of the new card copy, and the
   coordinator's own EmDash catalogue edit. This lane did not touch production
   data.
2. Seven independent launcher consumers still need their own
   `pnpm ui:assets --write <checkout>` review, release and exact pin before
   they carry `apps/ldraw-tile-fa7a2ab6171c-010cfbd2-r2-96.webp`.
3. Composer itself is not deployed from this branch; release needs the clean
   pushed-main guard and live re-verification.
4. Physical touch/tablet/stylus, screen reader and native mobile file handling
   remain separate #288/#290 acceptance.
5. The compositor checks supplied bytes only. It performs no browser, source or
   deployment verification and establishes no owner approval.

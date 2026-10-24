# LDraw discovery acceptance — 25 October 2026

Composer-side evidence for the LDraw discovery slice on
`codex/ldraw-adoption-20261025` (captured at `90c9eb4`). It renders the committed
Astro source in Chromium, exercises the real `/ldraw` redirect into the live
independent editor, and records the measurements and pixels in
[`receipt.json`](receipt.json). No Composer deployment, catalogue publication or
independent-app release is claimed.

## What was reconciled

| Check | Result |
| --- | --- |
| Released independent source | `c9c2339a1296ee7c06a7d94f274c69143478acba`, clean tree `f2eb24f0fa1cbda06f6203ed290d5d6a7a1157da`, Excalidraw `0.18.1` |
| Live `build.json` | Same source, tree, clean flag and build time (`2026-10-24T11:59:21.840Z`) as the local `dist` of that commit |
| Live `/` bytes | Byte-identical to that commit's built `dist/index.html` |
| Live `app.manifest.json` | `fa15f5e279eb4af500331b314a04b3467c46e6f1b6c6e785feddf3bb84db8775`, equal to `lib/ldraw/app.manifest.json` |
| Manifest digest | `sha256:70b9389…97feaa` recomputed from the compact manifest JSON, equal to `lib/ldraw/source.json` |
| Frozen capture | Original 1440×1000 PNG, file `d2e0dc4b…db2534`, decoded RGBA8 `9bd0358a…ba0bb4` |
| Derived pixels | 1440 WebP keeps the capture's exact pixel hash; 960 WebP `553f1cc0…e0e206`; 1200×630 share `db22ca29…3f4221`; all match the recorded provenance |
| Device assessment | Bound to the same commit: desktop supported, phone limited (390px Chromium with keyboard/pointer), tablet unchecked |

The images are real decodes, not placeholders: the capture shows the LDraw
toolbar, the Composer preset and the Creator journey example; the share card
frames that same capture beside a white LDraw wordmark and the Composer mark.

## What changed in this slice

`PR #323`'s checkpoint used a reduced 1440×1000 capture as the 96px launcher
tile. At the launcher's 40px slot it reads as a blank white square
([before](launcher-row-before-zoom.png)), which the visual direction treats as
a shrunk scene rather than an optical small size. LDraw has no approved
identity mark, so the tile is now App Composer's typographic discovery tile:
the app's own name in the reviewed Space Grotesk face on the canonical orange
(`#FC5B05`), with no invented symbol
([after](launcher-row-after-zoom.png)). The card image, preview and share card
keep the real workspace pixels, and the caption says plainly that the tile is
not an LDraw logo. This is an agent-selected decision awaiting owner review;
the previous tile is retained as
[`thumbnail-before-checkpoint-96.png`](thumbnail-before-checkpoint-96.png).

Compositor recipe revision 2 replaced the never-pushed revision 1 files rather
than mutating them. The bound tests require the tile, its provenance role and
the unchanged source-bound capture.

## Commands

```sh
git worktree add <run>/ldraw -b codex/ldraw-adoption-20261025 origin/main
git cherry-pick -x 899ee96 7193e9e 53e05d9 838937c 172ef48 65b6b08
pnpm install --frozen-lockfile
pnpm source:write
COMPOSER_DEMO_GUESTBOOK=<run>/guestbook-pinned \
COMPOSER_INCIDENT_GUESTBOOK=<run>/guestbook-pinned pnpm check
COMPOSER_DEMO_GUESTBOOK=<run>/guestbook-pinned \
COMPOSER_INCIDENT_GUESTBOOK=<run>/guestbook-pinned pnpm build
pnpm dev -- --port 4391   # Astro reported its own port 4324
node capture.mjs          # from this directory's parent run root
```

`pnpm check`: Astro 541 files, 0 errors, 0 warnings, 50 hints; lint and format
pass; 963 tests pass. `pnpm build`: publication guard 1202 files, 131 archive
members.

## Captures

| File | What it shows |
| --- | --- |
| `apps-1440-{dark,light}.png` | Library with the LDraw card, device note and tile |
| `apps-390-{dark,light}.png`, `apps-390-dark-200-percent-text.png` | Phone card at 100% and 200% root text |
| `ldraw-thumbnail-96.png`, `launcher-row-{before,after}-zoom.png` | The 96px tile and the 40px launcher row before/after |
| `catalogue-list-1440-dark.png`, `catalogue-list-390-dark.png` | Catalogue list with the LDraw contract |
| `catalogue-ldraw-{1440-dark,1440-light,390-dark}.png` | Detail page, device support, real capture and native handoff |
| `launcher-1440-dark-ldraw.png`, `launcher-1440-light.png` | Cmd+K launcher, LDraw row and keyboard focus |
| `launcher-390-{dark,light}.png`, `launcher-390-dark-200-percent-text.png` | Phone launcher, Close focus, 200% text |
| `live-editor-entry-1440.png`, `live-editor-entry-390.png` | The `/ldraw` entry after redirect: the live Excalidraw editor |

## Verified in this run

- `/ldraw` answers `302` with `Location: https://ldraw.loftwah.com/?analytics=off&qa=proof-290`;
  drawing, project, token and unknown query fields are dropped. A source
  fragment stays client-side (the browser never sends it and the editor does
  not read it).
- The redirected page is the live editor (`LDraw — draw and explain`, one
  Excalidraw root) and opens a real workspace.
- Library, catalogue and launcher link the exact origin; the library card's
  `Open app` is `/ldraw`, `Standalone` is the live origin, and `GitHub source`
  pins `…/tree/c9c2339a1296ee7c06a7d94f274c69143478acba`.
- Device support reads **Desktop supported · Phone limited** and filters as
  `desktop limited`; unchecked tablet support is not claimed.
- The 96px tile decodes, its field samples `#FC5B05` and it carries white
  wordmark ink; the launcher row decodes the same tile at 40px.
- The share image is a real 1200×630 PNG; the card preview is the reviewed
  960px WebP.
- No horizontal overflow at 390 or 1440 in either theme, including 200% root
  text; the phone launcher keeps Close visible, scrolls only its destination
  list and computes a 32px search field at 200%.
- Cmd+K opens with search focused, the result narrows to one destination,
  ArrowDown focuses the LDraw link, Escape closes with and without text, and a
  click-open restores focus to the Apps trigger. Reduced motion reports `0s`
  animation and transition durations.
- The server-rendered launcher already contains `<a href="/ldraw">` before
  JavaScript runs.
- Zero page errors or console errors across the rendered pages.

## Local fixture, not a publication

`/catalogue/ldraw` needs a published EmDash contract. This run inserted one
**local fictional** contract into its own gitignored D1 dev database to render
the detail page, labelled as a fixture in the screenshots. The owner's native
LDraw catalogue draft was not published, edited, duplicated or exported, and
nothing from the fixture exists outside this run.

## Limits

Chromium 1248 headless at 390×844 and 1440×1000, `deviceScaleFactor 1`,
pointer/keyboard emulation only. No physical phone, tablet, stylus, touch,
screen reader, native file picker or share-sheet acceptance is established.
Root text-size scaling is a layout probe, not text-only zoom. The receipt is
dated evidence for one revision; later changes need their own run.

## Remaining gates

1. The owner decision on the typographic tile (or a restored screenshot tile)
   and on publishing/replacing the native LDraw catalogue draft. This slice
   created no catalogue entry.
2. The seven existing independent launcher consumers (Guestbook, Linkarooie,
   Link Check, Hello, State, Launch Kit, Paperwork) have not received the LDraw
   row or `apps/ldraw-tile-c9c2339a1296-d2e0dc4b-r2-96.webp`; each needs its own
   `pnpm ui:assets --write <checkout>` review, release and exact pin before the
   shared menu is consistent.
3. Composer itself is not deployed from this branch; release needs the clean
   pushed-main guard, exact Worker identity and live re-verification.
4. Physical touch/tablet/stylus, screen reader and native file handling remain
   separate #288/#290 acceptance.

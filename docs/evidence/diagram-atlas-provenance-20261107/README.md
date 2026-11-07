# Diagram atlas provenance and true dimensions — 7 November 2026

Issues: [#375](https://github.com/loftwah/app-composer/issues/375). This is the
Composer-owned consumption gate for the existing LDraw atlas, not new artwork.

## Production identity

- Composer source `0f95ada10899ce3b9f189d36983031236816f7aa` (`0f95ada`).
- Worker version `04a3866a-5abe-48bf-99d0-7ad7c064407c`.
- Released through `pnpm deploy` from clean pushed `main`; the guard ran the
  audit, full check, production build and every live gate.
- `/build.json` returned the same commit.

The prior release was `dbf5614` / Worker `0a3210fc-2fee-4085-b863-5bf46c757f2b`.

## What changed

1. **Reviewed manifest.** `public/diagrams/ldraw/manifest.json` now records the
   contract, review date, owner, licence, renderer (`LDraw` /
   `@excalidraw/excalidraw@0.18.1` / `https://ldraw.loftwah.com`) and, for every
   atlas scene, its editable source path, status, review date, real PNG
   dimensions and SHA-256 hashes for the `.excalidraw`, `.svg` and `.png`.
2. **Provenance gate.** `pnpm diagrams:check` validates the manifest against the
   atlas and the committed files. A changed hash is refused with the exact
   review step (`pnpm diagrams:manifest --write` after inspecting 390 and 1440).
   A manifest dimension that disagrees with the PNG is refused. Five focused
   tests cover the clean state, the four scenes, a changed scene, a wrong
   dimension and dimension rebuilding.
3. **True image dimensions.** `get-ready-lifecycle` (2176 × 1355) and
   `cloudflare-isolation` (2335 × 1355) previously relied on the component
   default `1600 × 700`, so the page reserved the wrong space before load. Both
   now declare their real PNG size; the manifest prevents the drift returning.
4. **Phone affordance.** Every figure now has a visible 44px **View full-size
   PNG** action beside the downloads. The image already linked to the PNG, but
   nothing told a phone reader that the labels could be inspected at full size.

No scene, SVG or PNG was replaced, no Composer identity was altered and no new
artwork was generated.

## Checks that ran

| Check | Result |
| --- | --- |
| `node --test tests/diagram-manifest.test.mjs` | 5 passed |
| `node scripts/diagram-manifest.mjs` | 4 reviewed scenes verified |
| `pnpm check:types` | 0 errors |
| `pnpm deploy` | audit, full check, build and all live gates passed |
| Live `/diagrams/ldraw/manifest.json` | contract 1, 4 shipped scenes, dimensions match |
| Live `/diagrams` at 1440 × 1000 | 4 figures, document width 1440, no overflow, one `h1`, all figures loaded, 4-step text alternative each, alt text 236–471 characters |
| Live `/diagrams` at 390 × 1000 | document width 390, no overflow, four 340px figures, all 25 actions at least 44px, 44px text-alternative summaries |
| Light and dark | both themes render the atlas without overflow at 390; theme colour changes correctly |
| Editable scenes | 17–36 elements each, with text, arrows and rectangles preserved |

The only console error was the known CSP refusal of Cloudflare's Insights
beacon. No application error occurred.

## Remaining gates

- Physical touch and screen-reader acceptance remain part of the general
  [#35](https://github.com/loftwah/app-composer/issues/35)/#264 gates and were
  not claimed here.
- A new diagram still needs a human check that its content is clear and true
  before its manifest is regenerated. The gate records that review; it cannot
  perform it.

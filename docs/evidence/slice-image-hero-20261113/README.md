# Slice image hero: implementation and release handoff

2026/11/13 AEDT (Australia/Melbourne, UTC+11) / 2026/11/13 UTC.

Status: reviewed in a real browser at 1440, 390 and 320 px in both themes. The
release section below records the deployment once the clean pushed-main
`pnpm deploy` path has run; the live source, Worker version and affected-flow
check also belong in [#7](https://github.com/loftwah/app-composer/issues/7) and
the [#11 release index](https://github.com/loftwah/app-composer/issues/11).

## What changed

The owner's [Slice reference](https://slice-image.dev/) shows a continuous image
through rounded vertical strips. `SlicedImage.astro` uses one image and twenty
equal SVG clipping rectangles with deterministic dimensions and a unique
caller-supplied clip-path ID. Equal lengths matter: the first draft tapered the
outer strips into a fan, which stopped reading as one picture. It adds no
dependency, runtime fetch service, image export step or animation loop.

The homepage uses the existing approved
`public/brand/composer-icon-tile-20261022b.svg` in that treatment, behind the
existing two app sheets. Paperwork's screenshot, the fictional Launch Kit export,
captions, copy and links remain intact. The decoration is hidden from assistive
technology. Existing responsive layout, reserved aspect ratio and optional motion
behaviour remain. Slice's source code and demonstration image were not copied.

The strip gaps are the plate showing through, so the plate is part of the design:
near-ink (`#0b0d10`) on the dark hero, where it is all but the page colour, and
the brand's deep orange (`#a03406`) on paper. Without that ground the white mark
disappears into the paper and the strips read as separate orange pills. The plate
keeps a soft shadow so it matches the app sheets' depth rather than introducing a
second shadow language.

## Checks actually completed

- `pnpm exec astro check`: 669 files, zero errors, zero warnings, 79 existing hints.
- Rendered the real homepage from `astro dev` in Chromium at 1440×900, 390×844 and
  320×720, in both themes: strips visible as rounded capsules, the plate reads as
  one object, screenshots and labels readable, no horizontal overflow
  (`scrollWidth === clientWidth` at 1440, 1024, 820, 600, 390 and 320).
- Primary links resolve (`/ready`, `/prompts`, `/creator-hub`, `#make-something`);
  keyboard traversal shows a 3 px orange focus ring on the skip link, brand, main
  navigation and hero actions.
- Reduced motion keeps the resting 3D composition without the arrival or tilt
  animation. With scripts blocked, the sliced artwork still renders (20 rects) and
  the page keeps its reserved hero height.
- `git diff --check`: passed.
- Impeccable 4.8.0 detector over `ProductHome.astro`, `SlicedImage.astro` and
  `product-home.css`: 32 advisories (undefined literal colours in existing code),
  no non-advisory findings.
- The built candidate's integrated checks and build run once inside `pnpm deploy`;
  they were not duplicated immediately beforehand.

## Design workflow and limits

The actual upstream Impeccable 4.8.0 skill was read from
`~/.claude/skills/impeccable/`. Its launcher ran `context --target
src/components/SlicedImage.astro` from this repository once; the output inlined
PRODUCT.md, omitted the long DESIGN.md with an instruction to read it, and
reported no persisted surface brief for this target. DESIGN.md, the polish
playbook and the craft floor informed the refinement. The rendered composition,
not a detector score, is the evidence for appearance.

A headless Chromium paint quirk initially showed the app screenshots as empty
sheets at phone widths. The unchanged live production page behaved identically in
the same browser, so it is a capture artefact rather than a regression: forcing a
repaint showed the real screenshots and confirmed the DOM, CSS and image bytes are
unchanged by this work.

No formal critique score or owner visual approval is claimed. Remaining limit:
the live check confirms the deployed composition and interaction; it is not a
substitute for MP's taste judgement on the treatment.

# Slice image hero: implementation and release handoff

2026/11/13 AEDT (Australia/Melbourne, UTC+11) / 2026/11/13 UTC.

Status: released and verified in production. The live source, Worker version and
affected-flow check are recorded below and in
[#7](https://github.com/loftwah/app-composer/issues/7) and the
[#11 release index](https://github.com/loftwah/app-composer/issues/11).

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

## Release — 2026/11/13 AEDT / UTC

- Integrated as the squash commit `c8ffb5e5029ea291adeedad79127580cae244f93`
  (PR #458) on top of `f9302e4`.
- Released from clean pushed `main` with `pnpm deploy`, which owned the integrated
  checks and build. Release elapsed **105.4 s**.
- Worker `app-composer` version **`a851f328-c9b9-4b5d-bf4c-96906a1d0b9e`**,
  origin <https://composer.loftwah.com> (custom domain on the production Worker).
- Release gates reported: Worker upload, `Verified exact live Composer source
  c8ffb5e5029ea291adeedad79127580cae244f93`, live sharing output, live publication
  privacy (no findings), anonymous administration boundary, release record.
- Live check in Chromium on the real origin at 1440×900, 390×844 and 320×720 in
  both themes: 20 strip rects render, both app screenshots load
  (`complete` with real `naturalWidth`), `scrollWidth === clientWidth` at every
  width, headline/actions unaffected.
- Screenshots (public-safe): `shots/home-1440-dark.webp`,
  `shots/home-1440-light.webp`, `shots/home-390-dark.webp`,
  `shots/home-390-light.webp`, `shots/home-320-dark.webp`.

This follow-up evidence commit is documentation only; the deployed runtime
remains `c8ffb5e`, so no second deployment is required for it.

## Subsequent three-tool motion candidate — local, not released

The owner's later direction highlights Paperwork, LDraw and analytics, explains
App Composer, and preserves/enhances the existing hero's visual motion. This
candidate starts from `05ae65a27ff5dbb2135d507f4878a1bf2c366bcf`, preserving the
merged equal-strip treatment and its light-theme plate. PR #458 is already merged;
it is not an open publication target for this follow-on work.

The live homepage was inspected in the cloud browser. Its sliced plate, exploded
screens and perspective were visible; moving the pointer changed the assembly's
computed 3D transform. The revised local `HeroShowcase.astro` retains that CSS
perspective and bounded pointer tilt, adds staggered finite unfolding, and raises
the selected tool's illustrated panel. Three views use one image request and
show separate thirds of the studio artwork. The supporting registration pulse
is decorative, not a suggestion that private PDFs flow into analytics.

The hero keeps truthful app descriptions, real catalogue destinations and native
public analytics. Tabs support arrows, Home/End/Space, repeated selection and
roving focus. Pointer motion ignores touch, clamps its range, resets on leave or
cancel and responds to changed motion preferences. Reduced-motion/no-JavaScript
visitors keep the complete resting artwork. The first-action copy stays top-aligned
rather than being pushed down by the taller showcase.

Checks on the current candidate: five focused controller/motion tests pass;
`pnpm check:types` reports 671 files, zero errors, zero warnings and 79 existing
hints; production build/publication guard passes (1,329 files, 150 archive
members); `git diff --check` passes. Runtime: Node 26.13.1, pnpm 12.19.0.

Local browser preview remains blocked. Normal `pnpm dev` exits before readiness;
the documented foreground mode, after status confirmed no running server, exposes
`uv_interface_addresses` from Cloudflare Vite's `getPorts`/`os.networkInterfaces`.
No policy or network restriction was bypassed. The live inspection above is not
verification of the new candidate's pixels. A local agent must inspect the final
layout, all three selected states, keyboard focus and both themes at desktop and
phone widths before integration/deployment. Actual Impeccable is unavailable in
this executor; no new Impeccable run is claimed.

The earlier push was denied before execution and was not retried against the now
merged PR. The owner's later approval named the existing draft PR; the target's
merged state requires resolving the new publication destination. No production
deployment has been attempted for this revision. Preserve the existing release
record above and add the eventual new source/Worker identity only after release.

# Slice image hero: implementation and release handoff

2026/11/13 AEDT (Australia/Melbourne, UTC+11) / 2026/11/13 UTC.

Status: implemented and built locally; not merged or production verified by this
record. Continue through the existing release process and record the outcome in
[#7](https://github.com/loftwah/app-composer/issues/7) and the
[#11 release index](https://github.com/loftwah/app-composer/issues/11).

## What changed

The owner's [Slice reference](https://slice-image.dev/) shows a continuous image
through rounded vertical strips. The original `SlicedImage.astro` component uses
one image and twenty SVG clipping rectangles with deterministic dimensions and a
unique caller-supplied clip-path ID. It adds no dependency, runtime fetch service,
image export step or animation loop.

The homepage uses the existing approved
`public/brand/composer-icon-tile-20261022b.svg` in that treatment. The wider sliced
image replaces the solid orange backing plate behind the existing two app sheets.
Paperwork's screenshot, the fictional Launch Kit export, captions, copy and links
remain intact. The decoration is hidden from assistive technology. Existing
responsive layout, reserved aspect ratio and optional motion behaviour remain.
Slice's source code and demonstration image were not copied.

## Checks actually completed

- `pnpm install --frozen-lockfile` completed without a lockfile change.
- `pnpm exec astro check`: 669 files, zero errors, zero warnings, 79 existing hints.
- `pnpm build`: completed, including the publication guard (1,327 files and 150
  archive members).
- `git diff --check`: passed.
- One Impeccable 4.8.2 source detector pass over `ProductHome.astro` and
  `SlicedImage.astro` returned an empty findings array. This checks source patterns;
  it does not establish rendered design quality.
- The actual built homepage component was rendered through Astro Container into
  an ignored static inspection fixture, with the built Base/homepage CSS. That is
  a static render, not a browser interaction check or deployment.

## Design workflow and limits

The actual upstream Impeccable 4.8.2 skill was read from the verified local
Woodhouse installation. Its launcher ran `context --target
src/components/ProductHome.astro` from this repository once. The existing product,
design, visual direction and copy guidance, plus the upstream polish/adapt
playbooks and craft floor, informed the refinement. This was an implementation
refinement; no complete formal critique score or owner visual approval is claimed.
Fresh-session discovery and automatic hooks were unavailable in this ChatGPT
harness, so the manual source pass was used. Context reported an already stale
design sidecar and missing build-path setting; those unrelated metadata records
were not rewritten.

The cloud development server failed in the Cloudflare Vite integration at
`os.networkInterfaces()` with `uv_interface_addresses` before becoming ready.
Browser verification could not be completed in this executor. Source/build checks
therefore do not certify the desktop/phone appearance, pointer motion or keyboard
journey. The executor used Node 24.22.1 and pnpm 11.25.0; the repository documents
Node 26.13.1 and pnpm 12.19.0 as its preferred local tools. No dependency versions
were changed to accommodate the executor.

## Local delivery

Use the PR/branch supplied with this record and preserve current local work. Review
the actual home hero at representative desktop and phone widths, in both themes.
Confirm that the full screenshot remains readable, strips remain visible, the
page does not overflow, primary links and keyboard focus work, and reduced-motion
and JavaScript-free browsing retain the resting artwork. Keep this focused on the
affected hero; do not reopen unrelated product audits.

Integrate with current main, then run the existing clean pushed-main `pnpm deploy`
path from the authenticated local environment. It owns the integrated checks and
build; do not repeat a separate full suite immediately beforehand. Verify the
affected live page and actual source/Worker identity, record the result in #7/#11,
and report any specific remaining blocker without describing this candidate as
already shipped.

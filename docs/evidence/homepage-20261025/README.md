# Homepage gap correction — 25 October 2026

Issue [#382](https://github.com/loftwah/app-composer/issues/382), within #313/#7.
Baseline production source: `f14fbf48ce9897c1c99c15680bbef17e97f009a4`.
Implementation base: `473b8b9354f511bc38b8b5570af3d2d76c79d617`.

## Reproduction and cause

Real Chromium, original production homepage, dark default, scroll top, images
and fonts loaded. At 1440×1000 the wrapping flex hero had a 672×560 copy column
and a 480×691 proof panel. The next section started at y=875; the short column
left about 180px unused below its text. At 900×1000 the breakpoint stacked a
704×937 proof panel below the copy, while leaving 148px unused to its right;
the next useful section did not start until y=1681. This was intrinsic image
height plus the proof grid's full-width main image and flex/breakpoint sizing,
not missing content, a failed image or a global hero min-height.

The corrected grid uses explicit zero-minimum tracks, centres the two desktop
columns and puts the main screenshot beside the two smaller screens. Tablet
uses a compact three-screen strip; phone uses the two-column arrangement. No
image/content is cropped or hidden and all original links remain. Orange/white
identity, Get Ready, TLDR and the existing-agent entry retain their order.

## Qualification

`verifyHomepage` in `scripts/homepage-journey.mjs` reuses an admitted browser
page. The regression qualification covered 320/390/430/768/900/1024/1280/1440/
1920px in both themes (18 views), reduced motion, loaded images, no horizontal
overflow, main CTA visibility, Skip→Get Ready→prompts→agent keyboard focus and
activation. Separate 720px/200% root-text probes exercise text reflow; these
are **not native browser zoom or physical-device acceptance**. Full-page
captures scroll through lazy content before decoding images. Visually reviewed
1440 dark, 1920 light, 900 dark, 768 light and phone dark/light pixels. The
layout mechanical scan returned no findings. Independent source review found
no material regression; its capture-comment/settling nits were corrected.

Focused tests: 14 pass across product identity, campaign and owner experience.
Full checks/build/deploy and exact live source/Worker identity are recorded
once in #11 after the clean pushed-main deployment. This directory retains
representative production before/after pixels and a bounded browser receipt.
No owner settings, records, independent app source or credentials changed.

Post-release slow-loading check: actual production at390/1440px with PNG/WebP/font responses delayed500ms retained hero height within4px before/after decode. Native Chrome zoom automation could not be completed (native input timed out); the200%text/reflow probe remains separately labelled, not a native zoom pass.

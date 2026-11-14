Media Studio share kit — 2026-11-14
===================================

Canonical article: https://composer.loftwah.com/media-studio
Tutorial: https://composer.loftwah.com/media-studio/tutorial
Open your studio: https://composer.loftwah.com/media-studio/studio
Example assembled master: https://media.loftwah.com/p/Na9FNUB_VhzZ7zA9
True 9:16 cut: https://media.loftwah.com/p/5KqkS8ZEC-mj_yjm
Brand 9:16 motion: https://media.loftwah.com/p/X9b5nsfqX03CVJMf
Brand share card: https://media.loftwah.com/p/B_HA5PV6YMmHDA7N
Source (MIT): https://github.com/loftwah/composer-media-studio
App Composer: https://composer.loftwah.com

Everything below is public-safe: fictional studio content, original generated
artwork, no credentials, no private projects and no customer data.

---------------------------------------------------------------
Short post (X / Mastodon)
---------------------------------------------------------------
I wanted a media studio I could keep, not rent.

So I described it, and my agent built it: an MIT Cloudflare app with its own D1,
R2 and release. Stills, real masked edits, image-to-video, generated music,
narration and effects, a bounded storyboard, and deliberate public pages.

Then I used it to make this page's artwork and 9:16 motion.

Build log, code, costs and the change I made after shipping:
https://composer.loftwah.com/media-studio

---------------------------------------------------------------
LinkedIn
---------------------------------------------------------------
Most "AI media" tools are rented workspaces. Your prompts, references and edits
live in someone else's database, and you cannot change the tool when your work
changes.

We took a different composition. App Composer writes a portable brief; a
supported agent builds and deploys an independent, MIT-licensed studio with its
own database, storage and release. Cloudflare runs it. The models stay vendor
services: Workers AI for stills, fal.ai for masked edits, video, sound and
bounded renders.

What is actually in it: projects and saved takes, four still routes, a real
masked fill and outpaint, background removal, 2× upscale, two image-to-video
routes, music, narration and effects saved as separate audio assets, a browser
mix with trim/gain/fades, a storyboard that renders one bounded export, a true
720×1280 9:16 derivative that keeps the chosen shot order, scoped Composer
access, and public pages with byte-range playback. Not a mock-up: the article
links the deployed app, the published cut, the brand artwork and the source.

The part I care about most: after shipping it, I changed it. The same agent
fixed the Assemble tab and added a bed length that fits the cut. Later I added
the edit routes, the mix, the scoped entry and the 9:16 path. One vendor route
changed underneath the last fix: new fal ffmpeg compose jobs are accepted but
their result route returns 403. The 9:16 derivative was finished
deterministically with local ffmpeg from the same saved media; the in-product
button is not being called live.

Build log, including what failed and what it cost:
https://composer.loftwah.com/media-studio

---------------------------------------------------------------
dev.to / technical forum intro
---------------------------------------------------------------
Building an open-source AI media studio with App Composer

A build log from a real deployment: how a portable brief becomes an independent
Cloudflare application, how one durable job engine keeps paid requests honest,
why image edits need a same-size mask and data-URI inputs, why renders need
signed single-asset links with byte ranges, and what changed when we replaced a
false 9:16 label with a real order-preserving derivative.

Includes the actual specification, the assembly and edit dispatch excerpts, a
request-level ledger (US$1.6647 recorded across the two studio projects, plus
US$0.50 for the separately qualified 720p slate, none of it invoice-confirmed),
and the changes made after the first release. Fictional sample content and
original generated artwork; no vendor affiliation claimed.

https://composer.loftwah.com/media-studio

---------------------------------------------------------------
Alt text
---------------------------------------------------------------
Hero library: "The Media Studio library for the Paper & Light project: an
assembled 17-second cut, two generated sound assets drawn as waveforms, and
three saved takes."

Share card: "Build your own media studio: a paper-cut studio desk with a
waveform, camera and orange signal ring, with exact App Composer type and mark."

Mask: "A white ellipse on black over the empty upper-right panel; the rest of
the illustration is protected."

Masked edit: "The same paper studio with a clean burnt-orange ring added in the
upper-right panel; the camera, waveform and paper layers are unchanged."

9:16 motion: "A 720×1280 frame with the exact title Build your own media studio,
a generated motion window of the paper studio, the App Composer mark and the
label Generated artwork, not a product recording."

Public page: "The published 9:16 cut, signed out, with title, description,
player, download and byte-range playback."

---------------------------------------------------------------
Assets in this folder
---------------------------------------------------------------
media-studio-og-1200x630-20261114.png      1200×630 share card (PNG, exact type)
media-studio-square-1080-20261114.png      1080×1080 square still
media-studio-portrait-1080x1350-20261114.png  1080×1350 portrait still
media-studio-916-motion-20261114.mp4       720×1280, 5.875 s, SAR 1:1, DAR 9:16
media-studio-library-1200.jpg              earlier library capture
media-studio-og-1200x630.jpg               earlier library OG card

Originals and lineage live in /media-studio/brand/:
brand-still-20261114.jpg, brand-mask-20261114.png,
brand-edit-20261114.png, brand-motion-master-20261114.mp4,
brand-916-poster-20261114.png.

Films and captures live one level up:
/media-studio/watch/overview.mp4       1:08, captions + transcript
/media-studio/watch/walkthrough.mp4    1:24, six chapters, captions + transcript
/media-studio/studio-*.jpg             the article's product captures

---------------------------------------------------------------
Provenance
---------------------------------------------------------------
Original still: Workers AI @cf/leonardo/lucid-origin, 1280×720.
Masked edit: fal.ai fal-ai/flux-pro/v1/fill, same-size painted mask, 1280×704.
Motion: fal.ai Hailuo 2.3 Standard, image-to-video, 5.875 s, 1396×768.
Sound bed: fal.ai ElevenLabs sound effects v2, 5.04 s, 44.1 kHz stereo.
9:16 slate: fal.ai Wan 2.5 image-to-video, 720×1280, 5.04 s, retained and
reused; the selected first second opens the Paper & Light 9:16 cut.
Deterministic finishing: Pillow + ffmpeg; Space Grotesk (OFL) and the approved
App Composer mark. No generated lettering or logo.
The full SHA-256 values and provider request IDs are in the studio's retained
project record and the article's lineage table. Public files do not carry
prompts, credentials or private inputs.

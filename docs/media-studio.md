# Media Studio

Implemented for [#457](https://github.com/loftwah/app-composer/issues/457). An
independent, MIT image, video and sound studio that people select and configure
through Composer, then own and operate as its own application.

- Source: https://github.com/loftwah/composer-media-studio
- Live: https://media.loftwah.com
- Composer source pin: `config/media-studio-standalone.json`
- Reuse decision: [studio Darkroom assessment](https://github.com/loftwah/composer-media-studio/blob/main/docs/darkroom-assessment.md)

## What a person gets

**From Composer:** Init → *Media Studio* → name, creative direction, visibility,
still/video/sound defaults and bed length → saved specification (revision 2;
revision 1 drafts still validate) → portable export → the chosen agent's
handoff. The handoff pins the studio repository and
commit and tells the agent to create an owner-controlled copy with its own D1
database, R2 bucket, Workers AI binding, secrets, cron and release.

**In the studio:** real uploads (JPEG/PNG/WebP and WAV/MP3/M4A to 32 MB,
MP4/WebM to 64 MB), project collections, search and filters, an accessible
viewer, rename, download, delete, creative references, storyboards, project
export and deliberate public pages. These work with no model account.

**Generation and edits:** four still routes and one reference-guided variation
on the studio's own Cloudflare Workers AI account; masked fill and 25% outpaint
through FLUX.1 Fill; BiRefNet background removal and 2× Clarity upscale; two
image-to-video routes; Studio Score (10–30 s), Studio Voice and Studio Effect;
a browser mix with trim/gain/fades; and one bounded assembly route through the
studio's own fal.ai key. Every request shows an estimate and requires
confirmation. Originals, masks and results stay as separate assets with hashes
and parent links.

**Storyboards and assembly:** two to six saved takes (≤10.5 s each, ≤60 s total)
plus up to four saved music/voice/effect tracks. A browser mix with trim, gain
and fades becomes a new WAV; the source tracks stay in the manifest. Rendering
is one `fal-ai/ffmpeg-api/compose` call over 30-minute signed single-asset
links; the result is copied into the studio's R2. Editing a storyboard updates
it in place and keeps earlier renders. The 9:16 path keeps the selected order:
a deterministic 1080×1920 slate, one generated 720×1280 vertical slate video
retained and reused, then a compose of the selected takes and sound.

**Current provider block:** new fal `ffmpeg-api/compose` jobs are accepted and
reported complete, but their result route returns 403 ("Access denied: You
do not have permission to use this endpoint") for the payload that
worked earlier. The in-product assembly and 9:16 controls are coded and
unit-tested but cannot produce a new master today. The article's 9:16
derivative was finished deterministically with local ffmpeg from the same saved
takes, sound and slate: 720×1280, SAR 1:1, DAR 9:16, 17.79 s. Published media,
downloads and render inputs support byte ranges.

## Provider truth

| Capability | Provider | Status at delivery |
| --- | --- | --- |
| Editorial still | Workers AI `@cf/leonardo/lucid-origin` | Verified live |
| Cinematic still | Workers AI `@cf/leonardo/phoenix-1.0` | Verified live |
| Photographic draft | Workers AI `@cf/bytedance/stable-diffusion-xl-lightning` | Verified live |
| Reference variation | Workers AI `@cf/black-forest-labs/flux-2-klein-4b` | Verified live |
| Image-to-video | fal.ai Hailuo 2.3 Standard | Verified live: 5.875 s, 768 × 960, 589,717 bytes, saved in studio R2 |
| Image-to-video | fal.ai Kling 2.5 Turbo Pro | Verified live: 5.04 s, 1288 × 1608, 13,450,699 bytes, saved in studio R2 |
| Masked fill | fal.ai `fal-ai/flux-pro/v1/fill` | Verified live: 1280×704 variant, original + mask retained |
| Background removal | fal.ai `fal-ai/birefnet/v2` | Verified live: 1024×1024 transparent PNG |
| Upscale | fal.ai `fal-ai/clarity-upscaler` | Verified live: 2048×2048 PNG |
| Sound effect | fal.ai `fal-ai/elevenlabs/sound-effects/v2` | Verified live: 5.04 s, 44.1 kHz stereo |
| Assembly / in-product 9:16 | fal.ai `fal-ai/ffmpeg-api/compose` | Blocked: new jobs return 403 at the result route; earlier masters retained |

Model identifiers are server-owned and revalidated on every request. The studio
does not advertise Higgsfield's reference count, duration or resolution claims.
Reference variation keeps palette, ink quality and subject cues; it does not
promise identical composition or pixels, and the UI says so.

## Durable work and cost correctness

- Intent is persisted before dispatch; one unique client request id per project.
- An atomic dispatch lease prevents two workers submitting the same admitted job.
- Provider output is retained in R2 before the library record. A failed save is
  retried with the same bytes and no second inference call.
- One SQL admission reserves the monthly allowance for the whole project; two
  concurrent requests cannot oversubscribe it.
- Unknown provider outcomes keep their reservation and are never resubmitted.
- Cancellation shows what the provider confirmed; it is not represented as a
  refund.
- Deleted jobs and assets are tombstoned; a late completion is discarded instead
  of restoring media or a publication.
- A cron trigger advances asynchronous jobs after the browser closes; reopening
  the job continues from the same provider identity.

## Finishing and publishing

A published page exposes only the title, description and media, plus a download
link. Prompts, private filenames and other projects stay private. Withdrawing a
page stops new visits; copies already downloaded cannot be recalled. Video pages
can publish the source still as their poster.

The studio's **Use in Launch Kit** action downloads the still for Launch Kit's
existing import path; finishing stays in Launch Kit. A deliberately published
page is a normal HTTPS card destination for Linkarooie/Showcase, so the same
asset can appear in a composed app without copying private metadata.

## Sign-in and access

Composer already opens the studio through a short-lived, scoped handoff, without
asking the person for the standalone owner passphrase. The selected next sign-in
profile uses Cloudflare Access's native email codes and passkeys. Its explicit
account binding and real login demonstration remain delivery work; it is not
enabled by this documentation update.

The [Cloudflare integration brief](cloudflare-access-oyster.md) explains the user
journey, prerequisites, Composer/Studio/EmDash/Oyster responsibilities, existing
automation keys and the optional private-backend path. It needs no Pocket ID
server. Tailscale compatibility is considered, with no tailnet setup required.
The brief also records the current private-read revocation limit and the small
set of checks needed for the change, using the existing release process.

## Ownership

The studio owns its D1 metadata, R2 bytes, Worker release and provider keys. It
runs after detaching Composer and has no licence callback. Composer stores only
the repository, commit and manifest digest. The owner passphrase, session secret
and provider key never enter a Composer specification, prompt, screenshot or
repository.

## Checks and evidence

- Studio: 15 focused tests covering spec validation, byte parsing, idempotent
  admission, one budget authority, save retry without regeneration, tombstones,
  unknown outcomes and the fal request/status/download contract.
- Composer: focused media-studio spec tests (source pin, defaults round trip,
  fail-closed settings, old-spec compatibility, recommendation switching,
  handoff/build plan) plus the existing suite.
- Live still, reference-variation and image-to-video generations were saved into
  owned storage and are visible at https://media.loftwah.com.
- Published pages: https://media.loftwah.com/p/JYCl_dWcb2yqya6h (still) and
  https://media.loftwah.com/p/LpATM63K8aXYVmL4 (video with poster).
- Launch Kit consumed the studio still and produced a 1200 × 630 profile card.
- Showcase lists **The wheel, in motion** as a published card linking to the
  studio page.

Exact commits, Worker versions, screenshots and remaining gates are recorded in
[#457](https://github.com/loftwah/app-composer/issues/457) and [#11](https://github.com/loftwah/app-composer/issues/11).

## Remaining gates

- Both asynchronous image-to-video routes were verified (Hailuo 2.3 Standard and
  Kling 2.5 Turbo Pro). A provider balance is still required for any paid
  generation; the studio reports a funding refusal honestly.
- Optional Oyster/Prints interoperability remains [#422](https://github.com/loftwah/app-composer/issues/422),
  not a prerequisite for this native studio.
- Physical-device capture and social unfurl caches remain separate from the
  browser checks.


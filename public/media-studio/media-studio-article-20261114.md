# Building an open-source AI media studio with App Composer

Canonical: <https://composer.loftwah.com/media-studio> · Tutorial: <https://composer.loftwah.com/media-studio/tutorial> · Published 2026/11/14, Australia/Melbourne (AEDT, UTC+11).

*Syndication draft. If you republish this, keep the canonical link, the attribution and the date.*

---

I wanted a studio I could keep. Not a subscription with a generate button, and not another folder of downloads — a workspace where the projects, the takes, the sound and the edits live together, in an account I control, with code I can change.

App Composer is the composition layer for that idea: one catalogue, separate apps, each with its own source, data and release. Media Studio is one of those apps. I described it in a sentence, Init turned that into a specification I could read and save, and my agent built and deployed it as an independent Cloudflare Worker with its own D1 database and R2 bucket.

This is what it does, how it is put together, what it cost, and how the studio then made the artwork and vertical motion on this page.

## What actually works

The deployed studio has a project library with real uploads; four Workers AI still routes (Lucid Origin, Phoenix, SDXL Lightning and a FLUX.2 Klein reference variation); real masked fill and outpaint through FLUX.1 Fill; BiRefNet background removal and a 2× Clarity upscale; two fal.ai image-to-video routes (Hailuo 2.3 Standard, Kling 2.5 Turbo Pro); three sound routes (Studio Score beds of 10–30 seconds, Studio Voice narration and Studio Effect cues); a browser mix with trim, gain and fades; a storyboard that renders a bounded assembly of two to six takes plus the mixed bed; a true 720×1280 9:16 derivative; scoped Composer access; and deliberate publication with byte-range media.

Sound is a first-class asset, not a soundtrack bolted onto a video. The studio reads the real duration, sample rate and channel count from the bytes, records provenance and cost, and draws the waveform from the decoded audio. Music, narration and effects are separate saved assets; the mix is rendered deterministically in the browser and saved as a new WAV, while the source tracks and settings stay in the manifest.

Not built, and not advertised: voice cloning, a general non-linear editor, 4K, 30-second single inferences, or a claim that every vendor route is permanently available. “Open-source Higgsfield-style” describes the category, not parity: we integrate vendor models, we do not train or host them.

One route is blocked right now. New fal `ffmpeg-api` compose jobs are accepted and reported complete, but their result route returns 403 for the exact payload that worked earlier. The in-product assembly and 9:16 controls are coded; the 9:16 derivative on this page was finished deterministically with local ffmpeg from the same saved takes and sound. That is an external permission change, not a claim that the application or its stored work disappeared.

## From a sentence to a specification

Init asks what the studio should make, which models to start with, the default frame and clip length, and the sound model and bed length. Saving the draft provisions nothing and buys nothing.

The portable specification is small on purpose:

```json
"mediaStudio": {
  "version": 2,
  "focus": "both",
  "imageModel": "studio-print",
  "videoModel": "hailuo-standard",
  "audioModel": "studio-score",
  "audioSeconds": 15,
  "aspect": "portrait",
  "durationSeconds": 6,
  "projectName": "Paper & Light"
}
```

Revision 2 added the sound defaults; a revision 1 draft still validates and gains them. The studio rechecks every value on its own server.

The agent handoff pins the repository and an exact commit, names the D1, R2, Workers AI and secret bindings, and separates the human-only actions — creating accounts, signing in, approving spend — from the technical work. The tutorial now hands over the saved brief only after Init has created it; sending the pinned source before it exists was an ordering mistake in the previous version.

## How the agent builds it

Get Ready checks the machine and the accounts. The agent creates the owner's copy, applies the migrations in order, sets the secrets without printing them, deploys, and reads back the live revision. The release script refuses a dirty tree, a branch other than `main`, or an unpushed commit, runs the focused tests once, deploys, then fails unless `/healthz` reports the commit it just shipped.

Three decisions shaped the build.

**One job authority.** Every paid request becomes a row before anything is sent. A client request id can only create one job. One atomic SQL statement is the only budget authority. Provider bytes are retained in R2 before the library record exists, so a failed save is retried without a second inference. An ambiguous outcome keeps its reservation and is never resubmitted automatically.

**Bounded rendering.** A composition takes two to six saved clips, each at most 10.5 seconds and 60 seconds in total, plus the mixed soundtrack. The render copies the manifest into the job and the result is copied into the studio's own bucket. The same durable engine drives the 9:16 path: a deliberate slate, one generated vertical slate video, then a compose of the selected takes in their chosen order.

**Scoped entry.** Composer's member grants now include Media Studio as an app with read, edit, generate, publish and admin. A short-lived handoff names the actor, workspace, selected project and only those actions. The studio re-checks the current grant with Composer before a privileged dispatch, so a revoked member stops the next action even with an open tab.

The renderer needs to read the participating files, and the studio's media requires a session. Rather than publishing a project, the server signs one asset for one project for thirty minutes:

```js
const payload = `${assetId}.${projectId}.${expires}`;
const signature = await hmac(env.SESSION_SECRET, payload);
const url = new URL(`/render-input/${assetId}`, origin);
url.searchParams.set("p", projectId);
url.searchParams.set("e", String(expires));
url.searchParams.set("s", signature);
```

The link lists nothing, grants no session, carries no provider key, and expires on its own. The interface says so before a render starts. Published media, downloads and render inputs answer `Range` requests with a real 206 and `Content-Range`, so playback can seek.

## A real mask, not a prompt pretending to be one

The earlier version said masked editing was not built. It is built now, through FLUX.1 Fill on fal. Pick a still, paint the area to change, write what belongs there, and the studio uploads the source and a same-size mask as separate assets. The original stays; the fill is saved as a variant with its own hash and a parent link. The mask is real white-on-black pixels, not a sentence asking a model to “keep the rest the same”.

Outpainting uses the same tool: the studio builds a 25% larger canvas, centres the original, and masks the new border. Background removal is BiRefNet returning a transparent PNG; upscaling is Clarity at 2×. All three were exercised on the deployed studio, and all three save the result beside the source rather than over it.

One implementation detail was not obvious: the provider's image fetcher refused the studio's signed HTTPS links, even though they were public and worked in a browser. The fix was to send the exact bytes as a data URI. That is also why the fill job stores the source and mask hashes on the generation row: the provider never needs a durable public copy of either.

## The mix and the 9:16 cut

A storyboard is an ordered manifest of saved takes plus the soundtrack. The interface shows the running duration, refuses a cut under two takes or over sixty seconds, and estimates the render before it is sent. Saved compositions stay editable; a render copies the manifest into the job, so editing the storyboard later never rewrites what an earlier render used.

Music, narration and effects are separate saved assets. A composition can take up to four of them, with a role, start offset, trim in/out, gain and fades. The browser decodes the saved bytes and renders the mix deterministically with the Web Audio API, then uploads the result as a new WAV. The separate tracks and their settings stay in the manifest, so the mix can be rebuilt; the render uses the saved WAV and never claims the compose endpoint applied gain it does not support.

The previous release called a 768×960 file 9:16. It was 4:5, and the portrait-first sort changed the edit to suit the frame. Both were defects, and the claim was withdrawn. The replacement composes a deliberate 1080×1920 slate, generates one 720×1280 vertical slate video with Wan 2.5, and keeps those bytes so later renders reuse them. The selected takes then follow in the order chosen, composed into the slate's frame with the saved sound. No shot is re-sorted, stretched or silently regenerated.

The fal account cannot currently read the result of a new compose job, so the in-product button is not being called live. The derivative on this page was finished with local ffmpeg from the same saved takes, sound and slate: 720×1280, SAR 1:1, DAR 9:16, 17.79 seconds, 44.1 kHz stereo. The earlier 4:5 file remains as evidence of the bug, not as the 9:16 proof.

## Made in the studio shown here

We used the studio we built to produce the App Composer artwork and motion used on this page.

The project is **App Composer — studio launch artwork**, kept in the same deployed studio as the earlier work. The brief asked for an editorial illustration about owning a studio: tactile paper, warm ink, a controlled orange signal route and room for exact type. The first still came from Workers AI Lucid Origin at 1280×720. The selected refinement was a real masked fill: a white ellipse in the empty upper-right panel, a prompt for a paper signal ring, and FLUX.1 Fill returning a 1280×704 variant while the original, the mask and the result stayed separate. The motion is Hailuo 2.3 animating that selected edit; the sound bed is a separate Studio Effect. The type, mark, crops and the 9:16 frame were then finished deterministically, because generated lettering and a generated logo would be the wrong tool.

| Step | Route and setting | Retained result |
| --- | --- | --- |
| Brief | Studio project “App Composer — studio launch artwork” | Private project with creative direction |
| Original still | Workers AI `@cf/leonardo/lucid-origin`, wide 1280×720 | `d88505518eec…` · US$0.025 |
| Mask | White ellipse, 1280×720, saved as its own asset | `6cbd0e338458…` |
| Selected edit | fal.ai `fal-ai/flux-pro/v1/fill`, same-size mask, data-URI inputs | `0b2a33581a21…` · 1280×704 · US$0.05 est. |
| Motion | fal.ai Hailuo 2.3 Standard, 5.875 s | `4397ccfbd639…` · 1396×768 · US$0.28 |
| Sound bed | fal.ai ElevenLabs sound effects v2, 5.04 s | `f8d78e30d18a…` · 44.1 kHz stereo · US$0.008 |
| Derivatives | Pillow/ffmpeg: 1200×630, 1080×1080, 1080×1350, 720×1280 | `ba20457c953e…`, `111c9cbc1e79…`, `3aaf19084a2d…`, `afca9b476e8b…` |
| Publication | Deliberate Studio pages plus the article’s OG/share card | <https://media.loftwah.com/p/jWri1dDSfWbZ8HXD> · <https://media.loftwah.com/p/B_HA5PV6YMmHDA7N> |

The 9:16 motion is 720×1280, 5.875 s, SAR 1:1, DAR 9:16. It is generated promotional artwork, not a product screen recording. The title, mark and frame are deterministic overlays; the label says so in the file.

The page remains a build article. The artwork supports the story, and the actual product captures stay the evidence of the application. The studio did not generate its own screenshots, and a model named in another project's provenance does not make that same endpoint qualified here.

## Changing the application

A studio you cannot change is another subscription with extra steps. Two things were wrong in ways a screenshot would not reveal.

The Assemble tab could not see saved storyboards: the server returned them and the client loader dropped the field, so the tab said “No storyboard saved yet” while a storyboard with a rendered master existed. And the audio length was fixed at thirty seconds, so a bed could not fit a seventeen-second cut.

The change shipped as one release: sound length of 10 to 30 seconds with a scaled estimate; “Edit shots” loading the existing storyboard and saving in place rather than duplicating it; a note when a cut has changed since its last render; and the loader fix. Three smaller fixes came from the same pass: assembled exports no longer appear in the shot picker, published media is briefly cacheable so withdrawal stops resolving promptly, and every published file, download and signed render input answers byte ranges.

The second change replaced the false 9:16 label with a real path: a deterministic 1080×1920 slate, a generated 720×1280 vertical slate video retained and reused, then the selected takes in their chosen order with the saved sound. The same job engine, budget and tombstones apply. The provider then changed underneath it: new compose jobs return 403 at the result route. The 9:16 derivative was finished deterministically with local ffmpeg; the in-product button stays coded and unit-tested but is not called live.

The same release added the masked fill, cutout, upscale, Studio Effect, browser mix and the scoped Composer grants. Those are not a rewrite of the studio; they are the capabilities the earlier page said were missing.

Before and after is measurable: the same storyboard still has the 17.02-second and 30.00-second masters in the library, both downloadable, neither regenerated. The failed 4:5 job and the failed provider compose jobs remain in history as the honest record of what was learned.

## Evidence, costs and limits

Each advertised route was checked in four steps: official documentation and schema, actual account access, a bounded request through the studio's real server adapter, and the released interface reading the retained output.

| Route | Provider and model | State |
| --- | --- | --- |
| Stills | Workers AI Lucid Origin, Phoenix, SDXL Lightning, FLUX.2 Klein | Live |
| Masked fill and outpaint | fal.ai FLUX.1 Fill, same-size mask, data-URI inputs | Live |
| Cutout and upscale | fal.ai BiRefNet v2 and Clarity Upscaler | Live |
| Video | fal.ai Hailuo 2.3 Standard, Kling 2.5 Turbo Pro | Live |
| Music | fal.ai Stable Audio | Live |
| Narration | ElevenLabs voice model hosted by fal.ai | Live via fal |
| Sound effect | ElevenLabs sound effects v2 hosted by fal.ai | Live |
| Narration (direct) | ElevenLabs official API | Not qualified: no account key held |
| Assembly / in-product 9:16 | fal.ai ffmpeg compose | Blocked: new jobs return 403 at the result route; earlier masters retained |
| 9:16 derivative | Same takes, sound and slate; deterministic local ffmpeg | Live: 720×1280, SAR 1:1, DAR 9:16, 17.79 s |
| Scoped access | Composer session, workspace grant, project-scoped studio session, server re-check | Live on this release |

The studio's own ledger records **US$1.6647** across the two projects: US$1.3017 in Paper & Light and US$0.363 in the brand project. A further **US$0.50** qualified the 720p Wan slate outside the studio budget; the rejected 1080p Wan attempt and smaller LTX tests added roughly US$1.08 of qualification overhead. None of these figures is invoice-confirmed. Hosting is separate and shared: Workers Paid and R2 storage still cost money when nothing is rendering, so there is no zero-cost idle state.

The saved narration asset is 23.25 seconds; earlier copy said 33 seconds, which was wrong. The table uses the asset record.

Also not claimed:

- In-product compose is blocked. New fal compose jobs are accepted and reported complete, but the result route returns 403. The assembly and 9:16 controls stay coded; the derivative here was finished locally.
- Grants are workspace/installation level. The handoff binds one selected project and the studio enforces that scope, but People & access does not yet offer a separate grant row per studio project. A wrong-project session is denied; per-project grants remain next work.
- No voice cloning, no training on anyone's likeness, no rights workflow for either.
- No full non-linear editor, no 4K, no 30-second single inference, no guarantee of identity across takes. The composition is a bounded manifest with a 60-second ceiling.
- The mix is a browser mix. The controls and the offline WAV path exist; a complete music + narration + effect mix was exercised as a saved asset, not as a full studio export through the blocked compose route.
- No by-ear listening review. Duration, loudness, transcript and waveform checks were performed; an audio-capable reviewer did not listen to the complete films or the generated mix in this run.
- No physical-device matrix. Phone, tablet and wide-desktop layout were checked in the browser at representative widths, including both themes and reduced motion; that is not a hardware claim.
- The films are screen recordings with cuts and time compression stated in the captions; they are not one uninterrupted take, and the build/use/software-change recording is not yet a complete fresh-instance lesson.

## Repeat it

You need a Cloudflare account on Workers Paid, a supported agent, and a funded fal.ai key for video, sound, edits and rendering. Creating accounts, signing in and approving spend are yours; the agent does the technical work. You do not need Docker, Wrangler or a database seed.

1. Build your studio in Init and save the draft.
2. Export the specification and copy the agent handoff.
3. Let the agent create your copy, apply the migrations, add secrets and deploy.
4. Open it from the Composer menu or **Open your studio**. Read, edit, generate, publish and admin are separate grants; the studio re-checks the current grant at dispatch.
5. Upload, make a still, apply a real mask, generate a bed or effect, mix the soundtrack, build a storyboard and publish one piece.
6. Come back with a change you actually want.

The illustrated tutorial carries the same recipe chapter by chapter, with what you do, what the agent does, what you should see and how to recover. The share kit carries the public-safe text, alt text and derivatives from the brand project.

Full-quality assets:

- Article: <https://composer.loftwah.com/media-studio>
- Tutorial: <https://composer.loftwah.com/media-studio/tutorial>
- Open your studio: <https://composer.loftwah.com/media-studio/studio>
- True 9:16 cut: <https://media.loftwah.com/p/5KqkS8ZEC-mj_yjm>
- Brand 9:16 motion: <https://media.loftwah.com/p/jWri1dDSfWbZ8HXD>
- Brand share card: <https://media.loftwah.com/p/B_HA5PV6YMmHDA7N>
- Source: <https://github.com/loftwah/composer-media-studio> (MIT) · <https://github.com/loftwah/app-composer>

Oyster, Prints and Darkroom are Levi's MIT-licensed Fungi projects. ACE Music is excluded from this delivery entirely.

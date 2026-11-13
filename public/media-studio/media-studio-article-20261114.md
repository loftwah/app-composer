# Building an open-source AI media studio with App Composer

Canonical: <https://composer.loftwah.com/media-studio> · Tutorial: <https://composer.loftwah.com/media-studio/tutorial> · Published 14 November 2026 (Australia/Melbourne).

*Syndication draft. If you republish this, keep the canonical link, the attribution and the date.*

---

I wanted a studio I could keep. Not a subscription with a generate button, and not another folder of downloads — a workspace where the projects, the takes, the sound and the edits live together, in an account I control, with code I can change.

App Composer is the composition layer for that idea: one catalogue, separate apps, each with its own source, data and release. Media Studio is one of those apps. I described it in a sentence, Init turned that into a specification I could read and save, and my agent built and deployed it as an independent Cloudflare Worker with its own D1 database and R2 bucket.

This is what it does, how it is put together, what it cost, and the change I made to it afterwards.

## What actually works

The deployed studio has a project library with real uploads, four Workers AI still routes (Lucid Origin, Phoenix, SDXL Lightning, and a FLUX.2 Klein reference variation), two fal.ai image-to-video routes (Hailuo 2.3 Standard, Kling 2.5 Turbo Pro), two sound routes (Studio Score instrumental beds of 10–30 seconds, Studio Voice narration), a storyboard that renders a bounded assembly of two to six takes plus one bed, a portrait-first 9:16 cut of the same material, and deliberate publication with separate withdrawal.

Sound is a first-class asset, not a soundtrack bolted onto a video. The studio reads the real duration, sample rate and channel count from the bytes, records provenance and cost, and draws the waveform from the decoded audio.

Not built, and not advertised: masked inpainting, outpainting, background removal, upscaling, voice cloning, member roles, 4K, or 30-second single inferences. "Open-source Higgsfield-style" describes the category, not parity: we integrate vendor models, we do not train or host them.

## From a sentence to a specification

Init asks what the studio should make, which models to start with, the default frame and clip length, and — after this release — the sound model and bed length. Saving the draft provisions nothing and buys nothing.

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

The agent handoff pins the repository and an exact commit, names the D1, R2, Workers AI and secret bindings, and separates the human-only actions — creating accounts, signing in, approving spend — from the technical work.

## How the agent builds it

Get Ready checks the machine and the accounts. The agent creates the owner's copy, applies the migrations in order, sets the secrets without printing them, deploys, and reads back the live revision. The release script refuses a dirty tree, a branch other than `main`, or an unpushed commit, runs the focused tests once, deploys, then fails unless `/healthz` reports the commit it just shipped.

Two decisions shaped the build.

**One job authority.** Every paid request becomes a row before anything is sent. A client request id can only create one job. One atomic SQL statement is the only budget authority. Provider bytes are retained in R2 before the library record exists, so a failed save is retried without a second inference. An ambiguous outcome keeps its reservation and is never resubmitted automatically.

**Bounded rendering.** A composition takes two to six saved clips, each at most 10.5 seconds and 60 seconds in total, plus one saved bed. The render is one provider composition and the result is copied into the studio's own bucket. The same durable engine drives it, so a closed browser does not lose the render.

The renderer needs to read the participating files, and the studio's media requires the owner session. Rather than publishing a project, the server signs one asset for one project for thirty minutes:

```js
const payload = `${assetId}.${projectId}.${expires}`;
const signature = await hmac(env.SESSION_SECRET, payload);
const url = new URL(`/render-input/${assetId}`, origin);
url.searchParams.set("p", projectId);
url.searchParams.set("e", String(expires));
url.searchParams.set("s", signature);
```

The link lists nothing, grants no session, carries no provider key, and expires on its own. The interface says so before a render starts.

## Making something real

The studio opens from the Composer menu with the existing EmDash sign-in. No second password, and the browser never holds the studio passphrase or the provider keys.

A 30-second bed under a 17-second cut gives a container with thirteen seconds of black and music. Choosing a 17-second bed produced a 17.02-second master with a 16.79-second picture: three takes, one bed, no tail.

The storyboard is the edit: an ordered manifest of saved takes plus one bed, with the running duration shown, refusals for under two takes or over sixty seconds, and an estimate before the render is sent. A render copies the manifest into the job, so editing the storyboard later never rewrites what an earlier render used.

Publication is deliberate and separate from visibility. A published page exposes the title, description and media; prompts and other projects stay private; private APIs return 401 signed out. Withdrawing stops new visits and cannot recall a download already taken.

## Changing the application

A studio you cannot change is another subscription with extra steps. Two things were wrong in ways a screenshot would not reveal.

The Assemble tab could not see saved storyboards: the server returned them and the client loader dropped the field, so the tab said "No storyboard saved yet" while a storyboard with a rendered master existed. And the audio length was fixed at thirty seconds, so a bed could not fit a seventeen-second cut.

The change shipped as one release: sound length of 10 to 30 seconds with a scaled estimate; "Edit shots" loading the existing storyboard and saving in place rather than duplicating it; a note when a cut has changed since its last render; and the loader fix. Two smaller fixes came from the same pass: assembled exports no longer appear in the shot picker, and published media is briefly cacheable so withdrawal stops resolving promptly.

The first real 9:16 request found a third defect. The portrait cut was built as a merge of a single assembled master; the provider needs at least two inputs and the job surfaced its own 422 detail. The fix was structural: compose the same takes with portrait sources first, because the frame follows the first keyframe. The failed request remains in the project's history.

Before and after is measurable: the same storyboard now renders a 17.02-second master next to the earlier 30.00-second version, both in the library, neither regenerated.

## Evidence, costs and limits

Each advertised route was checked in four steps: official documentation and schema, actual account access, a bounded request through the studio's real server adapter, and the released interface reading the retained output.

| Route | Provider and model | State |
| --- | --- | --- |
| Stills | Workers AI Lucid Origin, Phoenix, SDXL Lightning, FLUX.2 Klein | Live |
| Video | fal.ai Hailuo 2.3 Standard, Kling 2.5 Turbo Pro | Live |
| Music | fal.ai Stable Audio | Live |
| Narration | ElevenLabs voice model hosted by fal.ai | Live via fal |
| Narration (direct) | ElevenLabs official API | Not qualified: no account key held |
| Assembly | fal.ai ffmpeg compose | Live |
| Masked edit | No qualified vendor edit route yet | Not built |

This run used US$0.2035 of inference: two Studio Score beds (US$0.015 and US$0.0085), two Studio Voice narrations (US$0.06 each), two assemblies and a portrait cut (US$0.02 estimated each). Across both studio projects since the studio existed, observed inference is US$1.50. Hosting is separate and shared: Workers Paid, R2 storage, no charge while idle. ACE Music is excluded from this delivery entirely.

Also not claimed: by-ear audio review (checks were loudness and duration analysis plus transcript reading), a physical-device matrix, social unfurl caching, or a full restore drill.

## Repeat it

You need a Cloudflare account on Workers Paid, a supported agent, and a funded fal.ai key for video, sound and rendering. Creating accounts, signing in and approving spend are yours; the agent does the technical work. You do not need Docker, Wrangler or a database seed.

1. Build your studio in Init and save the draft.
2. Export the specification and copy the agent handoff.
3. Let the agent create your copy, apply the migrations, add secrets and deploy.
4. Open it from the Composer menu. Upload, generate, assemble, publish one piece.
5. Come back with a change you actually want.

The illustrated tutorial carries the same recipe chapter by chapter, with what you do, what the agent does, what you should see and how to recover.

Source: <https://github.com/loftwah/composer-media-studio> (MIT) · <https://github.com/loftwah/app-composer>. Oyster, Prints and Darkroom are Levi's MIT-licensed Fungi projects.

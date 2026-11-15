# Replay this journey — 16 November 2026

This is the shortest honest path through the product as it is released now. Each
step names what you should see and what it proves. Steps 1–4 need no account;
steps 5–8 need the owner session for that installation, because they read or
change an owner's own project and media.

## 1. Start in Composer, on the studio story

<https://composer.loftwah.com/media-studio#free-tools>

The page explains what Media Studio is, then — before any prerequisites — lists
three operations you can run yourself. Each link opens a browser-local tool.

**Proves:** the product explains itself before asking for an account, Cloudflare
project or provider key.

## 2. Try the three free tools

- <https://media.loftwah.com/tools/audio-trim> — trim a song, add fades, export a WAV.
- <https://media.loftwah.com/tools/video-clip> — clip, crop to 9:16/16:9/1:1, pick a poster, export an MP4.
- <https://media.loftwah.com/tools/add-music> — combine a video with music or narration and export a playable clip.

Bring your own file. Nothing is uploaded and no model is called until you press
**Import to Studio**, which needs the owner session and a project.

**Proves:** useful work before sign-in, with the upload boundary stated in the UI.

## 3. See what people actually published

<https://media.loftwah.com/gallery>

Search, choose a kind, and change the order. Sixteen public works are listed;
other publications are unlisted but still readable by anyone holding the link,
and nothing is public unless its owner published it.

**Proves:** a real public catalogue, not a marketing mock. On 16 November the
gallery's 16 preview images total **792,638 bytes**; the original media they
stand in for totals **121,622,092 bytes** (153× less), and none failed to load.

## 4. Open an approved film, play it, come back

<https://media.loftwah.com/p/hSV7NN15-vlPvqXK>

Play the clip; use **← Back to gallery**. If you arrived from a filtered
gallery, the filter is preserved.

The page carries its own poster and a share image, so the link keeps a
thumbnail when it is shared. That share image is the publication's stored
preview, not the 3 MB original.

**Proves:** playback, poster, share metadata, withdrawal semantics and return
navigation on a real published film in WebKit and Firefox.

## 5. Choose on evidence (owner session)

Open Media Studio, choose a project with two saved takes, and open the model
comparison. It starts in **blind review**: model names and the estimate /
allocated / provider-charge rows stay hidden until you pick or reject a take.
A vote is bound to the exact saved take and stays in your browser.

**Proves:** a comparison that produces a decision without revealing the brand
first, and without inventing a bill.

**Needs:** the owner session. A visitor cannot open `/compare`, by design.

## 6. Recover the editable project (owner/CLI)

Export the project bundle, then restore it into another Studio through the
dry-run and restore path. The bundle carries records, references, prompts,
lineage and publications; media bytes are separate and must be carried with it.

**Proves:** the project is portable, not trapped in one deployment.

**Needs:** an owner session or the documented CLI, plus a target installation
that owns its own D1 and R2.

## 7. Build or change an owned app

From <https://composer.loftwah.com/init?start=media-studio>, choose the studio,
name the project and export the handoff. Your agent creates your copy, applies
its migrations, adds the secrets and deploys; the handoff names the ordering.

Then come back and change something. The same application keeps its own data.

**Proves:** create → publish → return → change, on an app you own.

**Needs:** a Cloudflare account on Workers Paid and a supported agent. Creating
those accounts and approving spend are yours.

## 8. Prepare the approved result for sharing

A published piece already has: a canonical URL, a poster, a share image, a
download, credit/provenance text and a withdrawal control. Withdrawal stops the
page and the media resolving, and stops the preview resolving too.

**Proves:** sharing is a deliberate state with a revoke path, not a permanent
publish.

## What this leg changed

| Change | Surface | Source |
| --- | --- | --- |
| Published films share their stored preview as `og:image`/`twitter:image`, and use it as the video poster | Studio | `33fe578` |
| Checkboxes keep their native size in tool rows (mute, review, import) | Studio | `730aeb5` |
| `/learn` lesson copy uses the shared copy fallback: select + focus + announced status | Composer | `1f4a47b` |
| Media Studio story lists all three free tools before prerequisites | Composer | `d36d4b2` (release `19237b9e`) |

## Remaining owner steps

- Studio owner sign-in for steps 5–7 on production; the passphrase lives only in
  the production secret store.
- Safari Remote Automation is disabled on this machine, so Safari clipboard and
  physical-iPhone checks cannot be automated here. WebKit (Safari's engine) and
  Firefox were used and are named where they apply.
- Screen-reader speech, a five-person first-impression panel and a second
  independent agent remain human evidence, not agent claims.

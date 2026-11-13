Media Studio share kit — 2026-11-14
===================================

Canonical article: https://composer.loftwah.com/media-studio
Tutorial: https://composer.loftwah.com/media-studio/tutorial
Example output: https://media.loftwah.com/p/Na9FNUB_VhzZ7zA9
Portrait cut: https://media.loftwah.com/p/vRqU7_F3ElVIk65U
Source (MIT): https://github.com/loftwah/composer-media-studio
App Composer: https://composer.loftwah.com

Everything below is public-safe: fictional studio content, no credentials, no
private projects, no customer data.

---------------------------------------------------------------
Short post (X / Mastodon)
---------------------------------------------------------------
I wanted a media studio I could keep, not rent.

So I described it, and my agent built it: an MIT Cloudflare app with its own D1,
R2 and release — stills, video, generated sound, storyboards, bounded renders.

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
services: Workers AI for stills, fal.ai for video, sound and bounded renders.

What is actually in it: projects and saved takes, four still routes, two
image-to-video routes, generated music and narration saved as real audio assets,
storyboards that render one bounded assembled export, a portrait-first 9:16 cut,
and deliberate public pages. Not a mock-up — the article links the deployed app,
the published 17-second cut and the source.

The part I care about most: after shipping it, I changed it. The same agent
fixed the Assemble tab, added a bed length that fits the cut, and let a
storyboard be edited in place. Same application, same projects, earlier renders
kept.

Build log, including what failed and what it cost:
https://composer.loftwah.com/media-studio

---------------------------------------------------------------
dev.to / technical forum intro
---------------------------------------------------------------
Building an open-source AI media studio with App Composer

A build log from a real deployment: how a portable brief becomes an independent
Cloudflare application, how one durable job engine keeps paid requests honest,
why renders need signed single-asset links, and what broke when we tried to make
a 9:16 cut from a single assembled master.

Includes the actual specification, the assembly dispatch excerpt, a measured
cost ledger (US$0.2035 of inference in this run), and the change made after the
first release. Fictional sample content; no vendor affiliation claimed.

https://composer.loftwah.com/media-studio

---------------------------------------------------------------
Alt text
---------------------------------------------------------------
Library: "The Media Studio library for the Paper & Light project: an assembled
17-second cut, two generated sound assets drawn as waveforms, and three saved
takes."

Storyboard: "The Assemble tab with a saved storyboard of three shots, an audio
bed, render controls and the assembled result."

Before/after: "Before: the Assemble tab says no storyboard saved yet. After: the
same tab loads the saved composition for editing and keeps both renders."

Public page: "The published assembled cut, signed out, with title, description,
player and download."

---------------------------------------------------------------
Assets in this folder
---------------------------------------------------------------
media-studio-library-1200.jpg   the library, 1600px wide
media-studio-og-1200x630.jpg    social/OG card

Films and captures live one level up:
/media-studio/watch/overview.mp4       1:08, captions + transcript
/media-studio/watch/walkthrough.mp4    1:24, six chapters, captions + transcript
/media-studio/studio-*.jpg             the article's product captures

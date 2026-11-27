---
layout: "../../layouts/Article.astro"
title: "Two Cloudflare app trials"
description: "Fill and recover a PDF in Paperwork, then trace an original illustration from Workers AI to Prints. A Melbourne workshop operator rehearsal with measured results."
cover: "/articles/free-first-rehearsal-20261127.jpg"
coverAlt: "App Composer card for Two Cloudflare app trials, with the working Paperwork editor and the Prints illustration."
coverCaption: "A live Paperwork capture and the published illustration from the earlier Prints run."
published: "2026-11-27"
---

## A PDF editor for a club

The prompt for this rehearsal was simple. A club needs members to fill in a reusable form before a workshop. [Paperwork](https://paperwork.loftwah.com/?sample=lab) already edits PDFs in the browser, so we started with the existing tool and a fictional form.

In signed-out Chromium, the first field edit took **1.2 seconds** at 1440 px and **1.7 seconds** at 390 px from opening the live sample. A damaged replacement was refused with the current work intact. We changed the field again, downloaded the result and reopened it in a fresh page. The full loop took **2.3 and 2.8 seconds**, with zero non-GET browser requests and zero inference calls. These are single automated browser timings.

<figure>
  <video controls preload="metadata" width="1280" height="720" poster="/articles/paperwork-rehearsal-20261127.webp">
    <source src="/articles/paperwork-rehearsal-20261127.mp4" type="video/mp4">
    <track kind="captions" src="/articles/paperwork-rehearsal-20261127.vtt" srclang="en" label="English" default>
  </video>
  <figcaption>Screen capture from the live fictional sample. Pauses make the recovery and second edit easier to see.</figcaption>
</figure>

We exported a Club Forms configuration from [Paperwork in Init](/init/paperwork) and built a separate local copy. The existing recipe took **1.7 s** to prepare. A frozen install took **11.4 s** after an offline attempt found a missing package. The first build took **1.6 s**. A second build took **0.5 s** after we added instructions to save and bring the completed form. A separate local browser opened that revision and edited the sample. Wrangler’s **1.2 s** dry run counted 257 static assets and zero bindings.

The existing Paperwork reference runs on the operator’s Workers Paid account. Its [previous guarded release](https://github.com/loftwah/app-composer-paperwork/pull/65#issuecomment-7184631297) took **17.9 s** from final qualification through exact live identity and **12 min 23 s** from the first edit. Club Forms was checked locally. A separate account and live URL for the remix are still needed.

## An editorial original from Workers AI

The App Composer article needed an illustration of a workshop press. A generated image made it possible to explore several compositions and choose one for the article. The earlier [owner run](https://github.com/loftwah/app-composer/issues/997#issuecomment-7162591975) recorded **three successful** `@cf/leonardo/lucid-origin` calls through Cloudflare AI Gateway. Prints indexed each image. A later read and a native export independently returned the same bytes for the selected original.

The published result is [From Workers AI to a byte-for-byte original](/articles/workers-ai-to-original). Read a known successful output back before considering another generation. This rehearsal opened the published result and made **zero new inference calls**. Per-call latency, billed cost and model-attributed Neurons were unavailable. An interrupted generation and a new participant-owned deployment still need their own checks.

## What the costs cover

Cloudflare lists ordinary static asset requests as free. Paperwork’s configuration uses static assets, and the browser performs PDF edits locally. **US$0** is the estimated marginal serving cost for that setup under [Cloudflare’s static asset pricing](https://developers.cloudflare.com/workers/platform/pricing/). It excludes the owner’s existing subscription, domain costs, any differently configured paid service and the agent used for the build. Agent charges and an attributable hosting invoice were unavailable.

[Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) lists a daily allocation of 10,000 Neurons, model-specific eligibility and paid usage beyond the included allocation. Confirm the selected account and model before generating. For this rehearsal we used the existing public references and local tools. No plan change, new paid call or additional infrastructure was needed.

## Run the workshop

Start with **“What is one thing you have wanted online but never got around to making?”** Choose one job the person can try in the session. Check [Discover](/discover) for a tool they can reuse and [Get Ready](/ready) for the supported agent handoff. [Start for free](/ready/start-for-free) covers prerequisites and the cost decisions.

Use the [facilitator guide](https://github.com/loftwah/app-composer/blob/main/docs/melbourne-first-app-session.md) for the setup, demonstration prompt, filming sequence and evidence checklist. The [recorded results](/benchmarks#free-first-01) and [share pack](/demo/examples/first-app-rehearsal) carry the public evidence.

The operator used fictional inputs and an existing reference account. The first independent participant will supply their own idea, select their own accounts and approve the first live release and a subsequent change.

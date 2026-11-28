---
layout: "../../layouts/Article.astro"
title: "I kept asking the AI twice"
description: "What went wrong when we delegated App Composer’s design work, and how we built a way for the next attempt to learn from the first."
cover: "/articles/asking-the-ai-twice-20261128.png"
coverAlt: "I kept asking the AI twice. Beside the title, a solid orange panel replaces ‘Which poster?’ with ‘What’s worth showing?’"
coverCaption: "The question we had to change before the work could improve."
published: "2026-11-28"
---

The first version of App Composer’s Decisions screen asked me to pick one of three campaign posters. I used the comment box to ask why we were choosing a single campaign at all. A working example that teaches someone to deploy an app, a Media Studio film, and an editable resource in Share each give people a different reason to open the link. They deserve their own briefs.

The agent had made the posters, installed the review screen, verified production and recorded the release. I'd still had to interrupt to ask for the work that should have come first. Which campaigns are worth making? What do we already have that deserves a lead? Who is supposed to do something with it?

I use AI agents for software, design, media and games. I keep seeing this pattern in work I know the agents can do. I open the result and become the person who notices the omission, finds the right reference and asks whether the job is finished. Every time that happens, I trust the next delivery a little less and spend a little more time checking it.

## We asked the tools to grade the easier part

The brief was to raise the creative quality across Composer, Share, Media Studio, Paperwork and Spin. I wanted work with sharp typography, committed colours and enough personality that I might ask the agent to pull it back. The Cloudflare campaigns I sent had a useful discipline. The card for its CLI launch gave one thing the lead and took you directly to the announcement. I wanted that kind of decision behind our own graphics. [The Cloudflare launch](https://blog.cloudflare.com/cloudflare-cf-cli-launch/) · [Our design review and references](https://github.com/loftwah/app-composer/tree/7a1d4144456c38eadbff67943117ff9b85680b72/docs/design-evidence/20261128)

We used Google Stitch for layout explorations and Clef-flash to evaluate several comparisons. We got real improvements in finding actions on a phone. We also promoted whatever imagery was handy, then overcorrected by stripping too much of it out. Share’s candidate combined a dog poster and an album cover. Both were ours. Neither had much to do with what someone would come to Share to find. The tools-first release made the leading actions easier to reach and made the openings lose character. We brought back the Composer workshop print, a published film alongside Studio’s tools and Paperwork’s press alongside its real sample. The larger creative brief is still open. [Portfolio review](https://github.com/loftwah/app-composer/issues/1422) · [Artwork restoration receipt](https://github.com/loftwah/app-composer/issues/11#issuecomment-7233994850)

<figure>
  <img src="/articles/composer-openings-restored-20261128.webp" alt="Three historical phone views. Composer shows the workshop print, Media Studio shows a film next to its editing tools, and Paperwork shows a press and sample PDF below its open button." width="774" height="598" loading="lazy">
  <figcaption>Three phone captures from the artwork restoration. Each opening gives the main action and the relevant artwork a place.</figcaption>
</figure>

The model had answered the questions we gave it. In one comparison with phone-sized renders, Clef leaned toward the prototype for finding a first action and toward the existing page for seeing artwork sooner. Those results describe a trade-off. We needed to put that trade-off in front of the owner before deciding what to ship. Asking a model where the controls are gives you evidence about where the controls are. It leaves you with the harder editorial decision about the artwork. [Share evaluation and source material](https://github.com/loftwah/app-composer/issues/1020#issuecomment-7230790764)

## The same mistake looked different in Spin and Prints

**Spin had a finished poster that the user still had to wait to see.** Showing the drawn result and encoding the downloadable PNG were coupled. A slow photo for a losing choice could hold up the winning poster. In a focused reproduction, holding that photo made the existing release take 3.6 seconds to show the preview. The local candidate showed it in about 39 milliseconds under the same test. The patch let the poster appear while export continued in the background. The reproduction told us where to look because it timed the thing a person was waiting for. [Spin patch and test conditions](https://github.com/loftwah/app-composer/pull/1434)

**Prints Desktop showed a plausible preview after silently dropping a file.** Drop two images on the old preview and the first appeared, making the import look successful. The second never made it into the comparison. The useful check was to drop two distinct files, see both in the app, compare them, then export and compare the bytes against the chosen original. The fix also made the count visible. That gave the user something to check immediately. [The Prints Desktop field note](/articles/picking-release-art)

**Our own feedback screen got in the way of leaving feedback.** It greeted you with a sidebar of questions and dense cards full of scores and trade-offs. Meanwhile, Composer’s public stylesheet had leaked into EmDash administration and overridden the native buttons, spacing and layout. Both problems were plain once we sat down to answer a question. We scoped the public styles to the public site, then rebuilt the review around one question, Back, Skip, Save & next and a question list. We reopened the earlier answers in production. The first feedback survived the change of interface. [What failed and what we checked](https://github.com/loftwah/app-composer/issues/1432#issuecomment-7234727183)

These failures have different fixes. They share a useful diagnostic. Ask what someone was trying to do, where they stopped, and what evidence would show that they got all the way through. Ask it early enough to change what gets built.

## The question that changed the work

Start with this one from our current review.

> Which working example should lead the Composer homepage?

The question follows my earlier preference to lead with a live app and its build path. It turns that preference into a choice a person can make after opening the actual work. [Open this exact question in Decisions](/_emdash/admin/plugins/composer-decisions/review?id=composer-live-example)

- **Deploy Hello World.** A beginner gets the shortest path from source to a live app. The challenge is making a small success feel worth someone’s attention. [Get Ready](/ready)
- **Open the connected Guestbook and Linkarooie demo.** A builder can see how an approved postcard travels between independently run apps. It takes more context to understand the handoff. [Connected apps](/demo/connected-apps)
- **Spin a real wheel.** A visitor gets a result in seconds and can follow the source. It shows the character of one app more clearly than the composition of several. [Spin](https://spin.loftwah.com/)
- **Sign Paperwork’s fictional sample.** A visitor can finish a familiar job and see the output. The page has to make the relationship between Paperwork and Composer clear. [Paperwork sample](https://paperwork.loftwah.com/?sample=garden)
- **Watch a Media Studio cut and follow how it was made.** A creator sees a finished piece and the process behind it. It makes a heavier opening for someone arriving to deploy a simple app. [Media Studio films](/media-studio/films)

The agent can do most of the work before asking. Open each route. Verify what someone can complete today. Find a credible outside reference and describe what it does well at that specific job. If a candidate deserves a look, make it easy to compare on a real screen. Then ask the owner which audience and trade-off matter. A useful answer might be “Lead with Hello for newcomers. Give Media Studio a separate campaign where the finished cut can lead.” That gives the next round two concrete jobs.

The Share questions work the same way. Useful questions include “Which item should have matched this search?”, “What would make you open this artwork at full size?” and “Which piece did you want to reuse, and what stopped you?” A note can name the exact item, crop or missing source. We can come back to the same revision when we use that feedback. [Live Share catalogue](/share) · [Discovery work in progress](https://github.com/loftwah/app-composer/issues/1020)

## What Clef does in that loop

Clef-flash takes evidence and a set of typed questions. We use a choice when the possible answers are explicit, yes/no for one testable condition, and a score when we can write out what each level means. A project example would ask, “Does the supplied evidence describe someone completing the task?” A stronger follow-up rates the evidence from an unsupported claim through a repeatable real journey. For a set of images, provide the rendered candidates and name the specific judgement and placement. [Cloudflare’s Clef-flash documentation](https://developers.cloudflare.com/workers-ai/models/clef-flash/)

Our larger pass assessed 23 public project briefs and classified the metadata of all 3,764 eligible artwork records in the captured Share catalogue. It suggested uses such as visual story, workflow proof and usable resource. It labelled 597 records unclear. The artwork input was titles, descriptions and tags. A useful next step for a doubtful item is to open it, identify a real use and look at it at the right size. We keep the recorded inputs and model results available for inspection. [Run evidence and usage](https://github.com/loftwah/app-composer/issues/1432#issuecomment-7235012811)

I answer the questions about my own taste. I can pick examples I’d use, say which edits I dislike and explain how much context I want when a decision reaches me. In EmDash I can take a project interview, open a question about a specific Share item, or revisit earlier notes. The first batch added 112 interview questions across the indexed portfolio, Share and personal working preferences. Composer keeps the answers in its private decision store and keeps the public model results with the evaluation. The model scores give agents something to investigate. My choices give them context for the next brief. [What shipped and where the data lives](https://github.com/loftwah/app-composer/blob/main/docs/agent-connect.md#project-interviews-share-index-and-saved-feedback)

## Put the answer where the next agent will find it

A good correction needs a destination. If I reject several share cards because they feature an incidental image, record the reason with the actual examples. Then give the next campaign issue a useful acceptance check. The chosen subject should have a specific job, an eligible source and an honest destination. The agent should render it at the size people will see and visit the page it promises. A palette, crop or copy choice goes in the relevant project’s record so it survives a new chat and the next agent can find it. [Portfolio campaign work](https://github.com/loftwah/app-composer/issues/1408)

For product work, I want the agent to carry routine authorised changes through the relevant check, merge, deploy and live replay. I want to enter the loop for choices that change the direction or require real permission. App Composer can support this with the agent and credentials a creator already uses, infrastructure on Cloudflare and independently owned apps that keep their own data and release history. The same pattern applies to a Bubbles opening, a PDF signing flow or a Studio cut. The project owns the result and its acceptance evidence. The feedback travels with the work. [App Composer’s operating contract](https://github.com/loftwah/app-composer/blob/main/PRODUCT.md#reference-led-creation-and-operation)

There’s a difference worth tracking between a task that took two attempts because we learnt something new and a task that took two because I had to remind the agent to open the deployed page. The numbers I want to see are **first-pass acceptance, avoidable interventions, repeated defects, and time and cost to a verified outcome**. To diagnose why a system improves, replay the same historical cases with the same brief, starting state and authority. Change one part at a time and review the actual result independently. Our 72-session search experiment is one example of the discipline. A smaller payload was directly measurable. Request count, answer quality and elapsed time told different stories. [The Search for Agents experiment](/articles/cloudflare-search-for-agents)

## Open the questions

If you’re a Composer administrator, open EmDash and choose **Decisions** in the sidebar. **Projects & preferences** opens the interviews, **Share index** opens the catalogue and **Saved feedback** brings the prior responses together. The existing scoped MCP tools can read and record interview responses and add follow-up briefs. The release record carries the remaining live-client verification gap. [Projects & preferences](/_emdash/admin/plugins/composer-decisions/review?view=projects) · [Share index](/_emdash/admin/plugins/composer-decisions/review?view=share) · [Saved feedback](/_emdash/admin/plugins/composer-decisions/review?view=feedback) · [MCP setup](https://github.com/loftwah/app-composer/blob/main/docs/agent-connect.md#portfolio-decisions-in-emdash-and-mcp)

I’ve added three questions from this write-up about creative retries, useful regression cases and the interruptions we should count. [Open the first follow-up](/_emdash/admin/plugins/composer-decisions/review?id=interview-your-preferences-regression-replay)

For a public starting point, open the five examples above and choose one audience to serve first. Name the result they should reach and what you would see if the attempt worked. That gives the next agent enough to do a real piece of work, and gives you something concrete to judge when it comes back.

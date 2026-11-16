# Complete creator path — replay guide

This is the shortest honest route through the product we actually run: open an
owned app, change it, publish it, share it, read the analytics, then take an
image through Studio's local tools and reuse it in a project. It ends with a
real model comparison and a recorded judgement.

It is written for a fresh agent or a signed-in owner. Every step names the real
URL, the expected state and the evidence to keep. It does not require a new
account, a new model key or any spend.

## What this path proves

- A real owned app can be edited and published without a developer.
- The published revision is what the share metadata and public page serve.
- Analytics distinguish a recorded request from a person or a conversion.
- A browser-local Studio edit exports real bytes, imports into an existing
  Studio project as a private asset, and is reusable inside that project.
- A saved model comparison can be judged against a stated job, not a vibe.

It does not prove a second independent owner, a paid provider invoice, physical
device behaviour, or a complete benchmark ranking.

## Preconditions

- Chrome profile signed in to `composer.loftwah.com` as the owner (`dean`).
- A current Cloudflare Access session. It expires; if the admin redirects to
  `jolly-cake-2b85.cloudflareaccess.com`, re-authenticate before continuing.
- Studio access through **Continue with App Composer**; no second password.
- The controlled Studio project **Agent proof · 16 Nov 2026** exists.
- No new spend. The image path is local; the comparison uses saved jobs.

## 1. Open a real owned app and change it

1. Open
   `https://composer.loftwah.com/_emdash/admin/plugins/composer-miniapps/apps?app=showcase`.
2. Find **Milestones & credits → Add an achievement**.
3. Add a real milestone: title, description, a known date (`YYYY-MM-DD`), an
   optional HTTPS destination, an icon. Save it as a **draft** first.
4. Press **Publish** on the new row. The row must read `published`.
5. Open `https://showcase.loftwah.com/` signed out. The milestone must appear
   under **Milestones & credits** with its date and description.

Expected evidence: the public HTML contains the title and description; the
draft state was not served before publishing.

## 2. Share the published result

1. On the public profile, press **Share profile**. If native sharing is
   unavailable, the page must say so and offer **Copy profile link**.
2. Press **Copy profile link**; the status must read `Link copied.`
3. Check the canonical and share metadata:

```sh
curl -s https://showcase.loftwah.com/ | grep -o '<meta[^>]*og:[^>]*>'
```

The `og:url`, `og:title`, `og:description` and `og:image` must describe the
published profile, not an unsaved preview. The share image must return `200`.

## 3. Read useful analytics

Open
`https://composer.loftwah.com/activity/showcase?days=30&surface=all&metric=app_opens`.

The page must show:

- the exact UTC window and that today is partial;
- a recorded total, not a people count;
- the definition: successful public home-page requests, reloads and bots may
  count;
- the daily table and the shareable insight.

Record the total and the window. Do not call it visitors, users or conversions.
For the owner-only outcome view, open the Creator stacks outcomes page for a
controlled stack; it reports recorded actions and approvals, not revenue.

## 4. Studio: local edit → export → import → reuse

1. Open `https://media.loftwah.com/tools/images` signed out.
2. Choose a real owned JPEG/PNG/WebP. The page shows source dimensions, type,
   bytes and SHA-256. Nothing is uploaded.
3. Apply a real transform: centre crop 16:9, long edge 1200, WebP quality 82.
4. Press **Make this image**. Keep the before/after dimensions, bytes and the
   result SHA-256.
5. Open **Import to Studio**, press **Check sign-in and studios**, choose the
   **Agent proof** project, then press **Upload WebP**. The result is a new
   private `upload` asset with a caption recording the source filename, source
   SHA-256 and transform settings.
6. In the project library, press **Compare stills**, select the imported asset
   and one other project still. The imported asset is now in use in a native
   project operation; the original and the local result remain unchanged.

Expected state: `Imported as a new private library asset`; the asset page shows
`Size`, `Frame`, `Type`, `Added`, the provenance caption and reuse actions.
Nothing is published automatically.

Optional publication check: press **Publish page**, confirm the title and
description, and open the resulting unlisted `/p/` address signed out. Press
**Add to public gallery** and confirm the work appears in `/gallery` after the
one-minute cache. Press **Withdraw** and confirm the page then returns 404 and
leaves the gallery. Withdrawal needs a valid owner session; a signed-out session
will not complete it.

## 5. Compare two real model outputs for a stated job

Open
`https://composer.loftwah.com/benchmarks/media?run=animate-a-still-v1-d20cbf5`.

Job: animate the supplied still as a slow push-in, holding the palette, grain
and marks, with no new objects or scene change.

1. Play both takes before revealing labels.
2. Note the saved-job latency and recorded Studio estimate for each.
3. Judge the job criteria, not resolution or file size. This pair has an
   observed resolution difference and only one clip has audio; those are not
   controlled variables.
4. **Choosing a side submits immediately.** To keep a reason, first press
   **Record another observation**, select the reason chips and type the reason,
   then press the side. The page appends a new submission; it does not replace
   the earlier one. The reviewer label is self-declared and unauthenticated.
5. Reload and export the run JSON. Every submission must still be present, with
   its reason and a token hash (never the raw token).

Observed on 16 November 2026: take B held the supplied still and moved the
character; take A cut to a new lamp-and-paper scene, which fails the stated
job. Take B was slower and estimated dearer. That is the trade-off, not a model
ranking.

## Exact checks to keep

```sh
curl -s https://showcase.loftwah.com/build.json
curl -s https://media.loftwah.com/build.json
curl -s https://composer.loftwah.com/build.json
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height \
  -of default=nw=1 take-b.mp4
```

Record the source revision each live surface reports, the browser URL you used,
the public HTML checks, the asset id, the benchmark run id and any limitation.

## Known limits

- The composed Linkarooie route is pinned to an older source; a standalone
  change does not automatically update the composed pin.
- The benchmark pair has one saved job per model, no repeated trials and a
  recorded prompt/still conflict. It is an observation, not a ranking.
- Analytics are aggregate requests/actions. They do not identify people,
  sessions or conversions.
- Studio import requires an existing Studio project and an explicit upload; the
  local edit itself never uploads.
